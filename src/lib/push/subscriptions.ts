import webPush from "web-push";
import type { PushSubscription } from "web-push";

// ---------------------------------------------------------------------------
// Notion backend for push subscriptions
// ---------------------------------------------------------------------------
// Subscriptions were previously stored in globalThis memory, which broke on
// Vercel serverless — each function instance has its own heap, so the
// subscription registered on instance A was invisible to instance B when the
// notification was sent, resulting in subscribers: 0.
//
// Notion is already integrated and shared across all instances, making it the
// simplest durable store. Each subscription is one page in a dedicated
// Push_Subscriptions database (NOTION_PUSH_DATABASE_ID).
//
// Database schema (create once in Notion):
//   Endpoint   — Title (rich_text) — the push endpoint URL (unique key)
//   User_ID    — rich_text
//   Auth       — rich_text
//   P256dh     — rich_text
//   Created_At — date
// ---------------------------------------------------------------------------

const NOTION_VERSION = "2022-06-28";

type StoredSubscription = {
  pageId: string;
  userId: string;
  subscription: PushSubscription;
};

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  // When set, skips every subscription belonging to this user so they don't
  // get notified for their own candy drop.
  excludeUserId?: string;
};

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function getVapidPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY ?? null;
}

function getVapidConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.WEB_PUSH_SUBJECT ?? "mailto:echo@example.com",
  };
}

function getNotionPushEnv() {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_PUSH_DATABASE_ID;
  if (!token || !databaseId) return null;
  return { token, databaseId };
}

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Register / upsert a subscription
// ---------------------------------------------------------------------------

export async function registerPushSubscription(
  userId: string,
  subscription: PushSubscription,
): Promise<{ count: number; storage: "notion" | "memory" }> {
  const notion = getNotionPushEnv();

  if (!notion) {
    // Local dev fallback. In production this branch means NOTION_PUSH_DATABASE_ID
    // (or NOTION_TOKEN) is missing — surfaced as storage:"memory" so the caller
    // can tell the subscription will NOT survive across serverless instances.
    memoryStore.set(subscription.endpoint, { pageId: "", userId, subscription });
    return { count: memoryStore.size, storage: "memory" };
  }

  // Check if this endpoint already exists (upsert by endpoint).
  const existing = await findPageByEndpoint(notion.token, notion.databaseId, subscription.endpoint);

  const res = existing
    ? await fetch(`https://api.notion.com/v1/pages/${existing}`, {
        method: "PATCH",
        headers: notionHeaders(notion.token),
        body: JSON.stringify({
          properties: {
            User_ID: { rich_text: [{ text: { content: userId } }] },
            Auth: { rich_text: [{ text: { content: subscription.keys.auth } }] },
            P256dh: { rich_text: [{ text: { content: subscription.keys.p256dh } }] },
          },
        }),
      })
    : await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(notion.token),
        body: JSON.stringify({
          parent: { database_id: notion.databaseId },
          properties: {
            Endpoint: { title: [{ text: { content: subscription.endpoint } }] },
            User_ID: { rich_text: [{ text: { content: userId } }] },
            Auth: { rich_text: [{ text: { content: subscription.keys.auth } }] },
            P256dh: { rich_text: [{ text: { content: subscription.keys.p256dh } }] },
            Created_At: { date: { start: new Date().toISOString() } },
          },
        }),
      });

  if (!res.ok) {
    // Surface the real Notion error (bad schema, integration has no access to
    // the DB, wrong database id, etc.) instead of silently doing nothing.
    const detail = await res.text().catch(() => "");
    throw new Error(`Notion write failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const count = await countSubscriptions(notion.token, notion.databaseId);
  return { count, storage: "notion" };
}

// ---------------------------------------------------------------------------
// Broadcast a push notification
// ---------------------------------------------------------------------------

export async function broadcastPushNotification(payload: PushPayload) {
  const vapid = getVapidConfig();
  if (!vapid) return { configured: false, sent: 0, failed: 0, subscribers: 0 };

  const notion = getNotionPushEnv();
  let allSubscriptions: StoredSubscription[];

  if (notion) {
    allSubscriptions = await loadAllSubscriptions(notion.token, notion.databaseId);
  } else {
    allSubscriptions = Array.from(memoryStore.values());
  }

  const targets = allSubscriptions.filter(
    ({ userId }) => !payload.excludeUserId || userId !== payload.excludeUserId,
  );

  if (!targets.length) {
    return { configured: true, sent: 0, failed: 0, subscribers: allSubscriptions.length };
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const results = await Promise.allSettled(
    targets.map(async ({ pageId, subscription }) => {
      try {
        await webPush.sendNotification(subscription, JSON.stringify(payload));
        return "sent";
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : null;

        // 404/410 — subscription is gone, archive the Notion page.
        if (statusCode === 404 || statusCode === 410) {
          if (notion && pageId) {
            await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
              method: "PATCH",
              headers: notionHeaders(notion.token),
              body: JSON.stringify({ archived: true }),
            }).catch(() => {/* best-effort */});
          } else {
            memoryStore.delete(subscription.endpoint);
          }
        }

        throw error;
      }
    }),
  );

  return {
    configured: true,
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    subscribers: allSubscriptions.length,
  };
}

// ---------------------------------------------------------------------------
// Notion query helpers
// ---------------------------------------------------------------------------

type NotionPage = {
  id: string;
  archived?: boolean;
  properties: Record<string, {
    title?: Array<{ plain_text?: string }>;
    rich_text?: Array<{ plain_text?: string }>;
    date?: { start?: string } | null;
  }>;
};

function textFrom(page: NotionPage, key: string): string {
  return (
    page.properties[key]?.rich_text?.[0]?.plain_text ??
    page.properties[key]?.title?.[0]?.plain_text ??
    ""
  );
}

async function queryAll(token: string, databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = (await res.json()) as { results?: NotionPage[]; has_more?: boolean; next_cursor?: string };
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

async function findPageByEndpoint(
  token: string,
  databaseId: string,
  endpoint: string,
): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      filter: { property: "Endpoint", title: { equals: endpoint } },
      page_size: 1,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: NotionPage[] };
  return data.results?.[0]?.id ?? null;
}

async function loadAllSubscriptions(
  token: string,
  databaseId: string,
): Promise<StoredSubscription[]> {
  const pages = await queryAll(token, databaseId);

  return pages
    .filter((p) => !p.archived)
    .map((p) => {
      const endpoint = textFrom(p, "Endpoint");
      const auth = textFrom(p, "Auth");
      const p256dh = textFrom(p, "P256dh");
      const userId = textFrom(p, "User_ID");

      if (!endpoint || !auth || !p256dh) return null;

      return {
        pageId: p.id,
        userId,
        subscription: {
          endpoint,
          expirationTime: null,
          keys: { auth, p256dh },
        } as PushSubscription,
      };
    })
    .filter((s): s is StoredSubscription => s !== null);
}

async function countSubscriptions(token: string, databaseId: string): Promise<number> {
  const pages = await queryAll(token, databaseId);
  return pages.filter((p) => !p.archived).length;
}

// ---------------------------------------------------------------------------
// In-memory fallback for local development (no Notion env vars needed)
// ---------------------------------------------------------------------------

const globalForPush = globalThis as typeof globalThis & {
  __echoPushSubscriptions?: Map<string, StoredSubscription>;
};
const memoryStore =
  globalForPush.__echoPushSubscriptions ?? new Map<string, StoredSubscription>();
globalForPush.__echoPushSubscriptions = memoryStore;
