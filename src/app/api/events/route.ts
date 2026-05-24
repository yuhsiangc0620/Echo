import { createCandyEventStream } from "@/lib/realtime/candy-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(createCandyEventStream(), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
