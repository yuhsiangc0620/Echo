import { getVapidPublicKey } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

export function GET() {
  const publicKey = getVapidPublicKey();

  return Response.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}
