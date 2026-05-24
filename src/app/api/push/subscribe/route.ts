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

  const normalizedSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  };
  const result = registerPushSubscription(payload.userId ?? "mobile-demo-user", normalizedSubscription);

  return Response.json({
    ok: true,
    subscribers: result.count,
  });
}
