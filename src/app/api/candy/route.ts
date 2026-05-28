import { AUDIO_CLASSES, AUDIO_CONFIG } from "@/lib/candy/catalog";
import { broadcastPushNotification } from "@/lib/push/subscriptions";
import { broadcastCandyEvent, broadcastCandyMessageEvent } from "@/lib/realtime/candy-events";

export const runtime = "nodejs";

const NOTION_FILE_UPLOAD_VERSION = "2026-03-11";
const NOTION_DATABASE_QUERY_VERSION = "2022-06-28";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_SCREENSHOT_BYTES = 7 * 1024 * 1024;
const MOBILE_FEED_WINDOW_DAYS = 7;

type CandyPayload = {
  id?: string;
  userId?: string;
  deviceId?: string;
  primaryAudioClass?: string;
  audioClasses?: string[];
  audioClass?: string;
  mediapipeCategory?: string;
  mediapipeScore?: number;
  durationSec?: number;
  status?: "Raw" | "Wrapped";
  screenshotFile?: string;
  screenshotDataUrl?: string;
  screenshotBase64?: string;
  screenshotMimeType?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  screenshotMasked?: boolean;
  localCreatedAt?: string;
};

type CandyMessagePayload = {
  pageId?: string;
  candyId?: string;
  userId?: string;
  userName?: string;
  message?: string;
};

type UploadedScreenshot = {
  fileUploadId: string;
  fileName: string;
  storage: "notion_file_upload";
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  masked: boolean;
};

type NotionText = {
  plain_text?: string;
  text?: {
    content?: string;
  };
};

type NotionFile = {
  name?: string;
  type?: "file" | "external" | "file_upload";
  file?: {
    url?: string;
    expiry_time?: string;
  };
  external?: {
    url?: string;
  };
  file_upload?: {
    id?: string;
  };
};

type NotionProperty = {
  title?: NotionText[];
  rich_text?: NotionText[];
  select?: {
    name?: string;
  } | null;
  multi_select?: Array<{
    name?: string;
  }>;
  number?: number | null;
  status?: {
    name?: string;
  } | null;
  files?: NotionFile[];
};

type NotionPage = {
  id: string;
  created_time?: string;
  properties?: Record<string, NotionProperty>;
};

type WeeklyFeedItem = {
  pageId: string;
  candyId: string;
  userId: string;
  primaryAudioClass: string;
  audioClasses: string[];
  durationSec: number;
  createdTime: string;
  screenshotUrl: string | null;
  screenshotExpiresAt: string | null;
  screenshotName: string | null;
  messages: string[];
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...init?.headers,
    },
  });
}

function textProperty(content: string) {
  return {
    rich_text: richTextChunks(content),
  };
}

function richTextChunks(content: string) {
  const chunks: Array<{ text: { content: string } }> = [];

  for (let index = 0; index < content.length; index += 1900) {
    chunks.push({
      text: {
        content: content.slice(index, index + 1900),
      },
    });
  }

  return chunks;
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

function extensionForContentType(contentType: string) {
  if (contentType === "image/webp") {
    return "webp";
  }

  if (contentType === "image/jpeg") {
    return "jpg";
  }

  return "png";
}

function parseScreenshotPayload(payload: CandyPayload) {
  const dataUrlMatch = payload.screenshotDataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  const contentType = dataUrlMatch?.[1] ?? payload.screenshotMimeType ?? "image/png";
  const base64 = dataUrlMatch?.[2] ?? payload.screenshotBase64;

  if (!base64) {
    return null;
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new Error("Unsupported screenshot image type. Use PNG, JPEG, or WebP.");
  }

  const body = Buffer.from(base64, "base64");

  if (!body.byteLength || body.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new Error("Screenshot image is empty or exceeds the 7 MB API limit.");
  }

  return {
    body,
    contentType,
  };
}

async function uploadScreenshotToNotion(payload: CandyPayload, candyId: string): Promise<UploadedScreenshot | null> {
  const notion = getNotionEnv();
  const screenshot = parseScreenshotPayload(payload);

  if (!notion || !screenshot) {
    return null;
  }

  const fileName = `masked-workscreen-${candyId}.${extensionForContentType(screenshot.contentType)}`;
  const createResponse = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_FILE_UPLOAD_VERSION,
    },
    body: JSON.stringify({
      mode: "single_part",
      filename: fileName,
      content_type: screenshot.contentType,
    }),
  });
  const created = await createResponse.json();

  if (!createResponse.ok) {
    throw new Error(created?.message ?? "Could not create Notion file upload.");
  }

  const formData = new FormData();
  const fileBlob = new Blob([new Uint8Array(screenshot.body)], {
    type: screenshot.contentType,
  });

  formData.append("file", fileBlob, fileName);

  const sendResponse = await fetch(created.upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Notion-Version": NOTION_FILE_UPLOAD_VERSION,
    },
    body: formData,
  });
  const uploaded = await sendResponse.json();

  if (!sendResponse.ok || uploaded?.status !== "uploaded") {
    throw new Error(uploaded?.message ?? "Could not send screenshot to Notion file upload.");
  }

  return {
    fileUploadId: created.id,
    fileName,
    storage: "notion_file_upload",
    contentType: screenshot.contentType,
    sizeBytes: screenshot.body.byteLength,
    width: payload.screenshotWidth,
    height: payload.screenshotHeight,
    masked: payload.screenshotMasked ?? true,
  };
}

function shouldWriteScreenshotIndexFields() {
  return process.env.NOTION_SCREENSHOT_INDEX_FIELDS === "true";
}

function textFromProperty(property?: NotionProperty) {
  return (property?.rich_text ?? property?.title ?? [])
    .map((part) => part.plain_text ?? part.text?.content ?? "")
    .join("")
    .trim();
}

function titleFromProperty(property?: NotionProperty) {
  return textFromProperty(property);
}

function messagesFromProperty(property?: NotionProperty) {
  return textFromProperty(property)
    .split("\n")
    .map((message) => message.trim())
    .filter(Boolean);
}

function sanitizeMessagePart(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\s+/g, " ").trim();
}

function fileFromProperty(property?: NotionProperty) {
  const file = property?.files?.[0];

  if (!file) {
    return {
      url: null,
      expiresAt: null,
      name: null,
    };
  }

  return {
    url: file.file?.url ?? file.external?.url ?? null,
    expiresAt: file.file?.expiry_time ?? null,
    name: file.name ?? null,
  };
}

function mapNotionPageToWeeklyFeedItem(page: NotionPage): WeeklyFeedItem {
  const properties = page.properties ?? {};
  const screenshot = fileFromProperty(properties.Screenshot_File);
  const candyId = titleFromProperty(properties.Candy_ID) || page.id;
  const userId = textFromProperty(properties.User_ID) || "unknown-user";
  const primaryAudioClass = properties.Primary_Audio_Class?.select?.name || "Keyboard_heavy";
  const audioClasses = (properties.Audio_Classes?.multi_select ?? [])
    .map((option) => option.name)
    .filter((audioClass): audioClass is string => Boolean(audioClass));

  return {
    pageId: page.id,
    candyId,
    userId,
    primaryAudioClass,
    audioClasses: Array.from(new Set([primaryAudioClass, ...audioClasses])),
    durationSec: properties.Duration_Sec?.number ?? 0,
    createdTime: page.created_time ?? new Date().toISOString(),
    screenshotUrl: screenshot.url,
    screenshotExpiresAt: screenshot.expiresAt,
    screenshotName: screenshot.name,
    messages: messagesFromProperty(properties.message_log ?? properties.Messages ?? properties.Attached_Messages),
  };
}

async function getNotionPage(pageId: string) {
  const notion = getNotionEnv();

  if (!notion) {
    throw new Error("Notion API token or database ID is not configured.");
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Notion-Version": NOTION_DATABASE_QUERY_VERSION,
    },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message ?? "Could not read Notion page.");
  }

  return result as NotionPage;
}

async function appendMessageLog(payload: CandyMessagePayload) {
  const notion = getNotionEnv();

  if (!notion) {
    throw new Error("Notion API token or database ID is not configured.");
  }

  if (!payload.pageId?.trim()) {
    throw new Error("Missing pageId.");
  }

  const userName = sanitizeMessagePart(payload.userName, "Echo user");
  const userId = sanitizeMessagePart(payload.userId, "unknown-user");
  const message = sanitizeMessagePart(payload.message, "");

  if (!message) {
    throw new Error("Missing message.");
  }

  const page = await getNotionPage(payload.pageId);
  const currentLog = textFromProperty(page.properties?.message_log);
  const nextLine = `${userName}：${message}`;
  const nextLog = [currentLog, nextLine].filter(Boolean).join("\n");
  const response = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_DATABASE_QUERY_VERSION,
    },
    body: JSON.stringify({
      properties: {
        message_log: {
          rich_text: richTextChunks(nextLog),
        },
      },
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message ?? "Could not update message_log.");
  }

  return {
    pageId: payload.pageId,
    candyId: payload.candyId ?? titleFromProperty(page.properties?.Candy_ID) ?? payload.pageId,
    userId,
    userName,
    message,
    line: nextLine,
    messages: messagesFromProperty({
      rich_text: richTextChunks(nextLog).map((part) => ({
        plain_text: part.text.content,
        text: part.text,
      })),
    }),
  };
}

async function getWeeklyFeedFromNotion() {
  const notion = getNotionEnv();
  const sinceDate = new Date(Date.now() - MOBILE_FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = sinceDate.toISOString();

  if (!notion) {
    return {
      configured: false,
      since,
      items: [] as WeeklyFeedItem[],
    };
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${notion.databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_DATABASE_QUERY_VERSION,
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: "Status",
            status: {
              equals: "Wrapped",
            },
          },
          {
            timestamp: "created_time",
            created_time: {
              on_or_after: since,
            },
          },
        ],
      },
      sorts: [
        {
          timestamp: "created_time",
          direction: "descending",
        },
      ],
      page_size: 75,
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.message ?? "Could not query Notion weekly feed.");
  }

  const pages = Array.isArray(result?.results) ? (result.results as NotionPage[]) : [];

  return {
    configured: true,
    since,
    items: pages.map(mapNotionPageToWeeklyFeedItem).filter((item) => Boolean(item.screenshotUrl)),
  };
}

async function createNotionCandyPage(
  payload: CandyPayload,
  candyId: string,
  status: "Raw" | "Wrapped",
  uploadedScreenshot: UploadedScreenshot | null,
) {
  const notion = getNotionEnv();

  if (!notion) {
    return null;
  }

  const now = new Date();
  const jarExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const primaryAudioClass = payload.primaryAudioClass ?? payload.audioClass ?? "Keyboard_heavy";
  const audioClasses = Array.from(new Set([primaryAudioClass, ...(payload.audioClasses ?? [])])).filter(Boolean);
  const config = AUDIO_CONFIG[primaryAudioClass as keyof typeof AUDIO_CONFIG];
  const externalScreenshotUrl =
    status === "Wrapped" && payload.screenshotFile?.startsWith("https://") ? payload.screenshotFile : null;

  const properties: Record<string, unknown> = {
    Candy_ID: titleProperty(candyId),
    User_ID: textProperty(payload.userId ?? "unknown-user"),
    Device_ID: textProperty(payload.deviceId ?? "desktop-overlay"),
    Primary_Audio_Class: {
      select: {
        name: primaryAudioClass,
      },
    },
    Audio_Classes: {
      multi_select: audioClasses.map((audioClass) => ({ name: audioClass })),
    },
    Duration_Sec: {
      number: payload.durationSec ?? 0,
    },
    Status: {
      status: {
        name: status,
      },
    },
    MediaPipe_Category: textProperty(payload.mediapipeCategory ?? config?.mediapipeCategory ?? primaryAudioClass),
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

  if (uploadedScreenshot) {
    properties.Screenshot_File = {
      files: [
        {
          type: "file_upload",
          name: uploadedScreenshot.fileName,
          file_upload: {
            id: uploadedScreenshot.fileUploadId,
          },
        },
      ],
    };
  } else if (externalScreenshotUrl) {
    properties.Screenshot_File = {
      files: [
        {
          type: "external",
          name: `masked-workscreen-${candyId}.png`,
          external: {
            url: externalScreenshotUrl,
          },
        },
      ],
    };
  }

  if (uploadedScreenshot && shouldWriteScreenshotIndexFields()) {
    properties.Screenshot_Storage = {
      select: {
        name: uploadedScreenshot.storage,
      },
    };
    properties.Screenshot_Masked = {
      checkbox: uploadedScreenshot.masked,
    };
    properties.Screenshot_Size_Bytes = {
      number: uploadedScreenshot.sizeBytes,
    };

    if (typeof uploadedScreenshot.width === "number") {
      properties.Screenshot_Width = {
        number: uploadedScreenshot.width,
      };
    }

    if (typeof uploadedScreenshot.height === "number") {
      properties.Screenshot_Height = {
        number: uploadedScreenshot.height,
      };
    }
  }

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notion.token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_FILE_UPLOAD_VERSION,
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
  let uploadedScreenshot: UploadedScreenshot | null = null;

  if (!payload.userId?.trim()) {
    return jsonResponse(
      {
        ok: false,
        destination: "notion.master_database",
        error: {
          message: "Missing userId. Complete Echo onboarding before uploading candy.",
        },
      },
      { status: 400 },
    );
  }

  try {
    uploadedScreenshot =
      status === "Wrapped" ? await uploadScreenshotToNotion(payload, candyId) : null;
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        destination: "notion.file_upload",
        error: {
          message: error instanceof Error ? error.message : "Screenshot upload failed",
        },
      },
      { status: 400 },
    );
  }

  const notionResult = await createNotionCandyPage(payload, candyId, status, uploadedScreenshot);

  if (!notionResult) {
    return jsonResponse(
      {
        ok: false,
        destination: "notion.master_database",
        error: {
          message: "Notion API token or database ID is not configured.",
        },
      },
      { status: 503 },
    );
  }

  if (notionResult && !notionResult.ok) {
    return jsonResponse(
      {
        ok: false,
        destination: "notion.master_database",
        error: notionResult.result,
      },
      { status: notionResult.status },
    );
  }

  const notificationResult =
    status === "Wrapped"
      ? await broadcastPushNotification({
          title: "Echo",
          body: `${payload.userId ?? "有人"} 包裝了一顆工作糖果。`,
          data: {
            candyId,
            userId: payload.userId,
            status,
          },
        }).catch((error) => ({
          configured: true,
          sent: 0,
          failed: 1,
          subscribers: 0,
          error: error instanceof Error ? error.message : "Push broadcast failed",
        }))
      : null;
  const realtimeResult =
    status === "Wrapped"
      ? broadcastCandyEvent({
          candyId,
          userId: payload.userId,
          status,
          createdAt: new Date().toISOString(),
        })
      : null;

  return jsonResponse(
    {
      ok: true,
      destination: "notion.master_database",
      notion: notionResult,
      row: {
        Candy_ID: candyId,
        User_ID: payload.userId,
        Device_ID: payload.deviceId ?? "desktop-overlay",
        Primary_Audio_Class: payload.primaryAudioClass ?? payload.audioClass ?? "Keyboard_heavy",
        Audio_Classes: Array.from(
          new Set([payload.primaryAudioClass ?? payload.audioClass ?? "Keyboard_heavy", ...(payload.audioClasses ?? [])]),
        ),
        MediaPipe_Category: payload.mediapipeCategory ?? null,
        MediaPipe_Score: payload.mediapipeScore ?? null,
        Duration_Sec: payload.durationSec ?? 0,
        Status: status,
        Screenshot_File:
          status === "Wrapped"
            ? uploadedScreenshot?.fileUploadId ?? payload.screenshotFile ?? "masked-workscreen.png"
            : null,
        Screenshot_URL: null,
        Screenshot_Storage: uploadedScreenshot?.storage ?? null,
        Screenshot_Masked: uploadedScreenshot?.masked ?? null,
        Screenshot_Width: uploadedScreenshot?.width ?? null,
        Screenshot_Height: uploadedScreenshot?.height ?? null,
        Screenshot_Size_Bytes: uploadedScreenshot?.sizeBytes ?? null,
        Local_Created_At: payload.localCreatedAt ?? new Date().toISOString(),
        Jar_Expires_At: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        Show_In_Jar: true,
      },
      storage: {
        screenshot:
          status === "Wrapped"
            ? uploadedScreenshot
            : null,
      },
      websocket:
        status === "Wrapped"
          ? {
              provider: "web-push",
              channel: "echo.network",
              event: "candy.wrapped",
              candyId,
              notification: notificationResult,
              realtime: realtimeResult,
            }
          : null,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as CandyMessagePayload;

  try {
    const result = await appendMessageLog(payload);
    const realtime = broadcastCandyMessageEvent({
      candyId: result.candyId,
      pageId: result.pageId,
      userId: result.userId,
      userName: result.userName,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse({
      ok: true,
      destination: "notion.master_database",
      messageLog: result,
      realtime,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        destination: "notion.master_database",
        error: {
          message: error instanceof Error ? error.message : "Could not append message_log.",
        },
      },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("view") === "weekly-feed") {
    try {
      const feed = await getWeeklyFeedFromNotion();

      return jsonResponse({
        ok: true,
        view: "weekly-feed",
        source: feed.configured ? "notion.master_database" : "empty",
        windowDays: MOBILE_FEED_WINDOW_DAYS,
        since: feed.since,
        items: feed.items,
        notionConfigured: feed.configured,
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          view: "weekly-feed",
          source: "notion.master_database",
          error: {
            message: error instanceof Error ? error.message : "Could not load weekly feed.",
          },
        },
        { status: 502 },
      );
    }
  }

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

  return jsonResponse({
    classifier: {
      engine: "MediaPipe Audio Classifier",
      runtime: "desktop edge process",
      persistedAudio: false,
      output: "categoryName + score per inference window",
    },
    standards,
    mobileFeed: {
      scope: "network",
      windowDays: MOBILE_FEED_WINDOW_DAYS,
      includedStatuses: ["Wrapped"],
      includes: ["Screenshot_File", "message_log"],
      messageLogField: "message_log",
      excludes: ["Raw candy history", "full audio metrics"],
    },
    storage: {
      screenshot: {
        strategy: "notion_file_upload",
        notionConfigured: Boolean(getNotionEnv()),
        notionIndexFields: shouldWriteScreenshotIndexFields(),
        acceptedPayloads: ["screenshotDataUrl", "screenshotBase64 + screenshotMimeType", "screenshotFile external URL fallback"],
        maxScreenshotBytes: MAX_SCREENSHOT_BYTES,
      },
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
