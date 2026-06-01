import { registerPushSubscription } from "@/lib/push/subscriptions";
import type { PushSubscription } from "web-push";

export const runtime = "nodejs";

type SubscribePayload = {
  userId?: string;
  subscription?: PushSubscriptionJSON;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SubscribePayload;
  const subscription = payload.subscription;

  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
    return Response.json(
      {
        ok: false,
        error: "Invalid push subscription.",
      },
      { status: 400 },
    );
  }

  if (!payload.userId?.trim()) {
    return Response.json(
      {
        ok: false,
        error: "Missing userId.",
      },
      { status: 400 },
    );
  }

  const normalizedSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  };

  try {
    const result = await registerPushSubscription(payload.userId, normalizedSubscription);

    return Response.json({
      ok: true,
      subscribers: result.count,
      // "memory" here in production means NOTION_PUSH_DATABASE_ID is missing —
      // the subscription won't be visible to other serverless instances.
      storage: result.storage,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not store subscription.",
      },
      { status: 500 },
    );
  }
}
