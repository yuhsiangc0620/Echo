import { AUDIO_CLASSES, AUDIO_CONFIG } from "@/lib/candy/catalog";

type CandyPayload = {
  id?: string;
  userId?: string;
  deviceId?: string;
  audioClass?: string;
  mediapipeCategory?: string;
  mediapipeScore?: number;
  durationSec?: number;
  status?: "Raw" | "Wrapped";
  screenshotFile?: string;
  localCreatedAt?: string;
};

function textProperty(content: string) {
  return {
    rich_text: [
      {
        text: {
          content,
        },
      },
    ],
  };
}

function titleProperty(content: string) {
  return {
    title: [
      {
        text: {
          content,
        },
      },
    ],
  };
}

function dateProperty(start: string) {
  return {
    date: {
      start,
    },
  };
}

function getNotionEnv() {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_CANDY_DATABASE_ID;

  if (!token || !databaseId) {
    return null;
  }

  return { token, databaseId };
}

async function createNotionCandyPage(payload: CandyPayload, candyId: string, status: "Raw" | "Wrapped") {
  const notion = getNotionEnv();

  if (!notion) {
    return null;
  }

  const now = new Date();
  const jarExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const audioClass = payload.audioClass ?? "Keyboard_heavy";
  const config = AUDIO_CONFIG[audioClass as keyof typeof AUDIO_CONFIG];
  const screenshotUrl =
    status === "Wrapped" && payload.screenshotFile?.startsWith("https://")
      ? payload.screenshotFile
      : null;

  const properties: Record<string, unknown> = {
    Candy_ID: titleProperty(candyId),
    User_ID: textProperty(payload.userId ?? "desktop-demo-user"),
    Device_ID: textProperty(payload.deviceId ?? "desktop-overlay"),
    Audio_Class: {
      select: {
        name: audioClass,
      },
    },
    Duration_Sec: {
      number: payload.durationSec ?? 0,
    },
    Status: {
      status: {
        name: status,
      },
    },
    MediaPipe_Category: textProperty(payload.mediapipeCategory ?? config?.mediapipeCategory ?? audioClass),
    Local_Created_At: dateProperty(payload.localCreatedAt ?? now.toISOString()),
    Jar_Expires_At: dateProperty(jarExpiresAt),
    Show_In_Jar: {
      checkbox: true,
    },
  };

  if (typeof payload.mediapipeScore === "number") {
    properties.MediaPipe_Score = {
      number: payload.mediapipeScore,
    };
  }

  if (screenshotUrl) {
    properties.Screenshot_File = {
      files: [
        {
          name: "masked-workscreen.png",
          external: {
            url: screenshotUrl,
          },
        },
      ],
    };
  }

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: {
        database_id: notion.databaseId,
      },
      properties,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      result,
    };
  }

  return {
    ok: true,
    pageId: result.id,
    url: result.url,
  };
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CandyPayload;
  const status = payload.status ?? "Raw";
  const candyId = payload.id ?? crypto.randomUUID();
  const notionResult = await createNotionCandyPage(payload, candyId, status);

  if (notionResult && !notionResult.ok) {
    return Response.json(
      {
        ok: false,
        destination: "notion.master_database",
        error: notionResult.result,
      },
      { status: notionResult.status },
    );
  }

  return Response.json(
    {
      ok: true,
      destination: notionResult ? "notion.master_database" : "mock.notion.master_database",
      notion: notionResult,
      row: {
        Candy_ID: candyId,
        User_ID: payload.userId ?? "desktop-demo-user",
        Device_ID: payload.deviceId ?? "desktop-overlay",
        Audio_Class: payload.audioClass ?? "Keyboard_heavy",
        MediaPipe_Category: payload.mediapipeCategory ?? null,
        MediaPipe_Score: payload.mediapipeScore ?? null,
        Duration_Sec: payload.durationSec ?? 0,
        Status: status,
        Screenshot_File: status === "Wrapped" ? payload.screenshotFile ?? "masked-workscreen.png" : null,
        Local_Created_At: payload.localCreatedAt ?? new Date().toISOString(),
        Jar_Expires_At: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        Show_In_Jar: true,
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
