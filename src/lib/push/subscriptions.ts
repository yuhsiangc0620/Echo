import webPush from "web-push";
import type { PushSubscription } from "web-push";

type StoredSubscription = {
  userId: string;
  subscription: PushSubscription;
  createdAt: string;
};

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
  // When set, the notification is sent to all subscribers *except* this user
  // (so the person who dropped a candy doesn't notify themselves).
  excludeUserId?: string;
};

const globalForPush = globalThis as typeof globalThis & {
  __echoPushSubscriptions?: Map<string, StoredSubscription>;
};

const subscriptions = globalForPush.__echoPushSubscriptions ?? new Map<string, StoredSubscription>();

globalForPush.__echoPushSubscriptions = subscriptions;

export function getVapidPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY ?? null;
}

function getVapidConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject: process.env.WEB_PUSH_SUBJECT || "mailto:echo@example.com",
  };
}

export function registerPushSubscription(userId: string, subscription: PushSubscription) {
  subscriptions.set(subscription.endpoint, {
    userId,
    subscription,
    createdAt: new Date().toISOString(),
  });

  return {
    count: subscriptions.size,
  };
}

export async function broadcastPushNotification(payload: PushPayload) {
  const vapid = getVapidConfig();

  if (!vapid) {
    return {
      configured: false,
      sent: 0,
      failed: 0,
      subscribers: subscriptions.size,
    };
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const targets = Array.from(subscriptions.values()).filter(
    ({ userId }) => !payload.excludeUserId || userId !== payload.excludeUserId,
  );

  const results = await Promise.allSettled(
    targets.map(async ({ subscription }) => {
      try {
        await webPush.sendNotification(subscription, JSON.stringify(payload));

        return "sent";
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;

        if (statusCode === 404 || statusCode === 410) {
          subscriptions.delete(subscription.endpoint);
        }

        throw error;
      }
    }),
  );

  return {
    configured: true,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    subscribers: subscriptions.size,
  };
}
