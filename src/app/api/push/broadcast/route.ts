import { broadcastPushNotification } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

type BroadcastPayload = {
  title?: string;
  body?: string;
  data?: Record<string, string | number | boolean | null>;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as BroadcastPayload;
  const result = await broadcastPushNotification({
    title: payload.title || "Echo",
    body: payload.body || "有一顆包裝糖果剛掉進網路。",
    data: payload.data,
  });

  return Response.json({
    ok: true,
    notification: result,
  });
}
