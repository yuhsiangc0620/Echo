import { AUDIO_CLASSES, AUDIO_CONFIG } from "@/lib/candy/catalog";

type CandyPayload = {
  id?: string;
  userId?: string;
  audioClass?: string;
  mediapipeCategory?: string;
  mediapipeScore?: number;
  durationSec?: number;
  status?: "Raw" | "Wrapped";
  screenshotFile?: string;
  createdTime?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as CandyPayload;
  const status = payload.status ?? "Raw";
  const candyId = payload.id ?? crypto.randomUUID();

  return Response.json(
    {
      ok: true,
      destination: "notion.master_database",
      row: {
        Candy_ID: candyId,
        User_ID: payload.userId ?? "local-user",
        Audio_Class: payload.audioClass ?? "Keyboard_heavy",
        MediaPipe_Category: payload.mediapipeCategory ?? null,
        MediaPipe_Score: payload.mediapipeScore ?? null,
        Duration_Sec: payload.durationSec ?? 0,
        Status: status,
        Screenshot_File: status === "Wrapped" ? payload.screenshotFile ?? "masked-workscreen.png" : null,
        Created_Time: payload.createdTime ?? new Date().toISOString(),
      },
      websocket:
        status === "Wrapped"
          ? {
              provider: "ably-or-pusher",
              channel: "friends.online",
              event: "candy.drop",
              candyId,
            }
          : null,
    },
    { status: 201 },
  );
}

export async function GET() {
  const standards = Object.fromEntries(
    AUDIO_CLASSES.map((audioClass) => {
      const config = AUDIO_CONFIG[audioClass];

      return [
        audioClass,
        {
          normalizedFrom: config.mediapipeCategory.split(" / "),
          minScore: Number(config.confidence),
          aggregation: config.trigger,
          thresholdSec: config.thresholdSec,
          dropsCandy: config.drops,
          role: config.role,
          candyName: config.candyName,
        },
      ];
    }),
  );

  return Response.json({
    classifier: {
      engine: "MediaPipe Audio Classifier",
      runtime: "desktop edge process",
      persistedAudio: false,
      output: "categoryName + score per inference window",
    },
    standards,
  });
}
