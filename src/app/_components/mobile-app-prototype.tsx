"use client";

/* eslint-disable @next/next/no-img-element */

import {
  BarChart3,
  Bell,
  Camera,
  MonitorDown,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import CandyShape from "@/app/_components/candy-shape";
import { AUDIO_CLASSES, type CandyAudioClass } from "@/lib/candy/catalog";
import { MOBILE_USERS, type JarUser } from "@/lib/mobile/mock-data";

type EchoProfile = {
  name: string;
  userId: string;
};

const PROFILE_STORAGE_KEY = "echo.profile.v1";
const WEEKLY_FEED_HOURS = 24 * 7;
const EMPTY_WEEKLY_FEED_SNAPSHOT: WeeklyFeedSnapshot = {
  status: "idle",
  items: [],
};
const CANDY_AUDIO_CLASS_SET = new Set<string>(AUDIO_CLASSES);

type WeeklyFeedApiItem = {
  candyId: string;
  userId: string;
  primaryAudioClass: string;
  audioClasses: string[];
  durationSec: number;
  createdTime: string;
  screenshotUrl: string | null;
  messages: string[];
};

type WeeklyFeedSnapshot = {
  status: "idle" | "loading" | "ready" | "error";
  items: WeeklyFeedApiItem[];
  error?: string;
};

const weeklyFeedStore: {
  snapshot: WeeklyFeedSnapshot;
  listeners: Set<() => void>;
  promise: Promise<void> | null;
  eventSource: EventSource | null;
} = {
  snapshot: EMPTY_WEEKLY_FEED_SNAPSHOT,
  listeners: new Set(),
  promise: null,
  eventSource: null,
};

function userIdFromName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `user_${normalized || "echo"}`;
}

function parseStoredProfile(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EchoProfile;
  } catch {
    return null;
  }
}

function getStoredProfileRaw() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PROFILE_STORAGE_KEY);
}

function subscribeStoredProfile(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("echo-profile-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("echo-profile-change", onStoreChange);
  };
}

function emitStoredProfileChange() {
  window.dispatchEvent(new Event("echo-profile-change"));
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function enablePushNotifications(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support web push.");
  }

  const keyResponse = await fetch("/api/push/public-key");
  const keyResult = await keyResponse.json();

  if (!keyResult.configured || !keyResult.publicKey) {
    throw new Error("Web Push VAPID keys are not configured.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey),
    }));

  const subscribeResponse = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON(),
    }),
  });
  const subscribeResult = await subscribeResponse.json();

  if (!subscribeResponse.ok || !subscribeResult.ok) {
    throw new Error(subscribeResult?.error ?? "Could not register push subscription.");
  }
}

function useStoredProfile() {
  const rawProfile = useSyncExternalStore(subscribeStoredProfile, getStoredProfileRaw, () => null);

  return useMemo(() => parseStoredProfile(rawProfile), [rawProfile]);
}

function notifyWeeklyFeedListeners() {
  weeklyFeedStore.listeners.forEach((listener) => listener());
}

async function loadWeeklyFeed() {
  if (weeklyFeedStore.promise) {
    return weeklyFeedStore.promise;
  }

  weeklyFeedStore.snapshot = {
    ...weeklyFeedStore.snapshot,
    status: "loading",
  };
  notifyWeeklyFeedListeners();
  weeklyFeedStore.promise = fetch("/api/candy?view=weekly-feed", {
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result?.error?.message ?? "Weekly feed unavailable");
      }

      weeklyFeedStore.snapshot = {
        status: "ready",
        items: Array.isArray(result.items) ? result.items : [],
      };
    })
    .catch((error) => {
      weeklyFeedStore.snapshot = {
        status: "error",
        items: [],
        error: error instanceof Error ? error.message : "Weekly feed unavailable",
      };
    })
    .finally(() => {
      weeklyFeedStore.promise = null;
      notifyWeeklyFeedListeners();
    });

  return weeklyFeedStore.promise;
}

function subscribeWeeklyFeed(onStoreChange: () => void) {
  weeklyFeedStore.listeners.add(onStoreChange);
  ensureWeeklyFeedRealtime();

  if (weeklyFeedStore.snapshot.status === "idle") {
    void loadWeeklyFeed();
  }

  return () => {
    weeklyFeedStore.listeners.delete(onStoreChange);
  };
}

function getWeeklyFeedSnapshot() {
  return weeklyFeedStore.snapshot;
}

function getWeeklyFeedServerSnapshot() {
  return EMPTY_WEEKLY_FEED_SNAPSHOT;
}

function ensureWeeklyFeedRealtime() {
  if (typeof window === "undefined" || weeklyFeedStore.eventSource) {
    return;
  }

  weeklyFeedStore.eventSource = new EventSource("/api/events");
  weeklyFeedStore.eventSource.addEventListener("candy.wrapped", () => {
    void loadWeeklyFeed();
  });
}

function useWeeklyFeed() {
  return useSyncExternalStore(subscribeWeeklyFeed, getWeeklyFeedSnapshot, getWeeklyFeedServerSnapshot);
}

function weeklyScreenshotsFor(user: JarUser) {
  return user.weeklyScreenshots
    .filter((screenshot) => screenshot.ageHours <= WEEKLY_FEED_HOURS)
    .sort((a, b) => a.ageHours - b.ageHours);
}

function formatAge(ageHours: number) {
  if (ageHours < 24) {
    return `${Math.max(1, Math.round(ageHours))}h`;
  }

  return `${Math.round(ageHours / 24)}d`;
}

function toCandyAudioClass(audioClass: string): CandyAudioClass {
  return CANDY_AUDIO_CLASS_SET.has(audioClass) ? (audioClass as CandyAudioClass) : "Keyboard_heavy";
}

function toneForAudioClass(audioClass: string) {
  if (audioClass === "Speech" || audioClass === "Mouse_click") {
    return "chat" as const;
  }

  if (audioClass === "Sigh" || audioClass === "Writing" || audioClass === "Telephone") {
    return "doc" as const;
  }

  return "code" as const;
}

function nameFromUserId(userId: string, profile: EchoProfile | null) {
  if (profile?.userId === userId) {
    return profile.name;
  }

  return userId.replace(/^user_/, "").replace(/-/g, " ") || "Echo user";
}

function liveUsersFromFeed(items: WeeklyFeedApiItem[], profile: EchoProfile | null): JarUser[] {
  const grouped = new Map<string, WeeklyFeedApiItem[]>();

  items
    .filter((item) => item.screenshotUrl)
    .forEach((item) => {
      grouped.set(item.userId, [...(grouped.get(item.userId) ?? []), item]);
    });

  return Array.from(grouped.entries()).map(([userId, userItems], index) => {
    const accent = ["#ef6f7f", "#65c7df", "#7cd7b8", "#f5b642", "#d78be8"][index % 5];
    const weeklyScreenshots = userItems.map((item) => {
      const primaryAudioClass = toCandyAudioClass(item.primaryAudioClass);
      const audioClasses = item.audioClasses.length
        ? item.audioClasses.map(toCandyAudioClass)
        : [primaryAudioClass];
      const createdAt = new Date(item.createdTime).getTime();
      const ageHours = Number.isFinite(createdAt) ? (Date.now() - createdAt) / (60 * 60 * 1000) : 0;
      const minutes = Math.max(1, Math.round(item.durationSec / 60));

      return {
        id: item.candyId,
        ageHours,
        audioClasses,
        screenshotTone: toneForAudioClass(primaryAudioClass),
        screenshotUrl: item.screenshotUrl ?? undefined,
        caption: `${minutes} 分鐘工作聲音包裝截圖。`,
        messages: item.messages ?? [],
      };
    });
    const jar = Array.from(new Set(weeklyScreenshots.flatMap((screenshot) => screenshot.audioClasses))).slice(0, 4);

    return {
      id: userId,
      name: nameFromUserId(userId, profile),
      handle: userId,
      online: true,
      accent,
      jar: jar.length ? jar : ["Keyboard_heavy"],
      caption: "最近一週的工作截圖。",
      weeklyScreenshots,
    };
  });
}

function WorkScreenshot({ tone, url }: { tone: "code" | "doc" | "chat"; url?: string }) {
  if (url) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden rounded-lg border border-black/15 bg-[#141312]">
        <img className="h-full w-full object-cover" src={url} alt="" />
      </div>
    );
  }

  const palette = {
    code: ["#65c7df", "#ef6f7f", "#f5b642"],
    doc: ["#f5b642", "#7cd7b8", "#d78be8"],
    chat: ["#7cd7b8", "#65c7df", "#c28f5a"],
  }[tone];

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-lg border border-black/15 bg-[#141312]">
      <div className="absolute left-0 top-0 z-10 flex h-10 w-full items-center gap-2 border-b border-white/10 bg-black/28 px-3">
        <span className="size-2 rounded-full bg-[#ef6f7f]" />
        <span className="size-2 rounded-full bg-[#f5b642]" />
        <span className="size-2 rounded-full bg-[#7cd7b8]" />
        <span className="ml-2 h-2.5 w-28 rounded-sm bg-white/16" />
      </div>
      <div className="absolute inset-x-4 bottom-4 top-14 grid grid-cols-[0.68fr_1fr] gap-3 text-xs">
        <div className="space-y-2">
          {Array.from({ length: 13 }).map((_, index) => (
            <div key={`mobile-line-${index}`} className="flex items-center gap-2">
              <span className="font-mono text-white/24">{(index + 21).toString().padStart(2, "0")}</span>
              <span
                className="h-2 rounded-sm"
                style={{
                  width: `${42 + ((index * 19) % 44)}%`,
                  background: index % 3 === 0 ? palette[0] : index % 3 === 1 ? palette[1] : "rgba(255,255,255,.22)",
                }}
              />
            </div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <div className="h-20 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="mb-3 h-2 w-28 rounded-sm" style={{ background: palette[1] }} />
            <div className="h-2 w-4/5 rounded-sm bg-white/22" />
          </div>
          <div className="h-32 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="mb-3 h-2 w-20 rounded-sm" style={{ background: palette[0] }} />
            <div className="mb-2 h-2 w-5/6 rounded-sm bg-white/22" />
            <div className="mb-2 h-2 w-2/3 rounded-sm" style={{ background: palette[2] }} />
            <div className="h-2 w-3/5 rounded-sm bg-white/18" />
          </div>
        </div>
      </div>
      <span className="absolute left-[14%] top-[46%] z-20 h-8 w-[42%] rounded-[3px] bg-black" />
      <span className="absolute right-[9%] top-[30%] z-20 h-7 w-[34%] rounded-[3px] bg-black" />
      <span className="absolute bottom-[18%] right-[18%] z-20 h-7 w-[28%] rounded-[3px] bg-black" />
    </div>
  );
}

function JarPreview({
  active,
  onSelect,
  user,
  weeklyCount,
}: {
  active: boolean;
  onSelect: () => void;
  user: JarUser;
  weeklyCount: number;
}) {
  return (
    <button
      className="grid min-w-[118px] snap-center justify-items-center gap-2 text-center"
      type="button"
      onClick={onSelect}
      aria-pressed={active}
    >
      <span
        className={`relative h-[74px] w-[106px] overflow-hidden rounded-b-[30px] rounded-t-lg border transition ${
          active ? "border-black bg-[#fffaf0] shadow-[0_12px_26px_rgba(23,20,18,.16)]" : "border-black/10 bg-white/58"
        }`}
      >
        <span
          className="absolute right-2 top-2 z-20 size-3 rounded-full border-2 border-[#fbf4e6]"
          style={{ background: user.online ? "#2da66f" : "#9f988e" }}
        />
        <span className="absolute inset-x-2 bottom-2 top-3 rounded-b-[24px] rounded-t-md border border-black/14 bg-[#e9fbff]/72" />
        <span className="absolute inset-x-3 top-3 h-5 rounded-[50%] border border-black/10 bg-white/45" />
        <span className="absolute inset-x-4 bottom-3 h-5 rounded-[50%] bg-black/5" />
        <span className="absolute inset-0">
          {user.jar.slice(0, 4).map((audioClass, index) => (
            <span
              key={`${user.id}-${audioClass}-${index}`}
              className="absolute"
              style={{
                left: `${16 + ((index * 20) % 55)}%`,
                bottom: `${10 + (index % 2) * 18}px`,
                transform: `rotate(${index * 9 - 12}deg)`,
              }}
            >
              <CandyShape audioClass={audioClass} size={24} wrapped={index === 0} />
            </span>
          ))}
        </span>
      </span>
      <span className="grid w-full gap-0.5">
        <span className={`truncate text-xs font-black ${active ? "text-[#171412]" : "text-[#62594e]"}`}>
          {user.name}
        </span>
        <span className="text-[11px] font-black text-[#8f877d]">本週 {weeklyCount}</span>
      </span>
    </button>
  );
}

export default function MobileAppPrototype() {
  const [activeId, setActiveId] = useState(MOBILE_USERS[0].id);
  const [activeScreenshotIndex, setActiveScreenshotIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const profile = useStoredProfile();
  const weeklyFeed = useWeeklyFeed();
  const [nameDraft, setNameDraft] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [messages, setMessages] = useState<Record<string, string[]>>(
    Object.fromEntries(
      MOBILE_USERS.flatMap((user) => user.weeklyScreenshots.map((screenshot) => [screenshot.id, screenshot.messages])),
    ),
  );
  const liveUsers = useMemo(() => liveUsersFromFeed(weeklyFeed.items, profile), [profile, weeklyFeed.items]);
  const users = useMemo(
    () =>
      liveUsers.length
        ? liveUsers
        : MOBILE_USERS.map((user) =>
            user.id === "you" && profile
              ? {
                  ...user,
                  name: profile.name,
                  handle: profile.userId,
                  caption: "這是你的工作糖果罐，桌面端使用同一個名稱即可同步。",
                }
              : user,
          ),
    [liveUsers, profile],
  );
  const activeUser = useMemo(
    () => users.find((user) => user.id === activeId) ?? users[0],
    [activeId, users],
  );
  const activeWeeklyScreenshots = useMemo(() => weeklyScreenshotsFor(activeUser), [activeUser]);
  const activeScreenshot = activeWeeklyScreenshots.length
    ? activeWeeklyScreenshots[activeScreenshotIndex % activeWeeklyScreenshots.length]
    : null;
  const activeMessages = activeScreenshot ? (messages[activeScreenshot.id] ?? activeScreenshot.messages ?? []) : [];

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = nameDraft.trim();

    if (!name) {
      return;
    }

    const nextProfile = {
      name,
      userId: userIdFromName(name),
    };

    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    emitStoredProfileChange();
  }

  function sendMessage() {
    const text = draft.trim();

    if (!text) {
      return;
    }

    if (!activeScreenshot) {
      return;
    }

    setMessages((current) => ({
      ...current,
      [activeScreenshot.id]: [...(current[activeScreenshot.id] ?? []), `You: ${text}`],
    }));
    setDraft("");
  }

  async function handleEnablePush() {
    try {
      setPushStatus("loading");
      await enablePushNotifications(profile?.userId ?? "mobile-demo-user");
      setPushStatus("ready");
    } catch {
      setPushStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#171412] text-[#171412]">
      <section className="mx-auto flex h-[100svh] min-h-[720px] w-full max-w-[480px] flex-col overflow-hidden bg-[#f6f1e7]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-[#fffaf0] px-4">
          <Link
            className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60"
            href="/desktop"
            aria-label="Desktop app downloads"
          >
            <MonitorDown aria-hidden className="size-4" />
          </Link>
          <h1 className="text-base font-black">Echo</h1>
          <div className="flex gap-2">
            <button
              className={`grid size-9 place-items-center rounded-md border border-black/10 bg-white/60 ${
                pushStatus === "ready" ? "text-[#2da66f]" : pushStatus === "error" ? "text-[#ef6f7f]" : ""
              }`}
              type="button"
              onClick={handleEnablePush}
              aria-label="Enable notifications"
              title={pushStatus === "ready" ? "Notifications ready" : "Enable notifications"}
              disabled={pushStatus === "loading"}
            >
              <Bell aria-hidden className="size-4" />
            </button>
            <Link
              className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60"
              href="/mobile/data"
              aria-label="Open data page"
            >
              <BarChart3 aria-hidden className="size-4" />
            </Link>
          </div>
        </header>

        <section className="h-[28svh] min-h-[170px] shrink-0 border-b border-black/10 bg-[#fbf4e6] px-4 py-4">
          <div className="flex h-full snap-x gap-4 overflow-x-auto pb-2">
            {users.map((user) => (
              <JarPreview
                key={user.id}
                user={user}
                weeklyCount={weeklyScreenshotsFor(user).length}
                active={user.id === activeUser.id}
                onSelect={() => {
                  setActiveId(user.id);
                  setActiveScreenshotIndex(0);
                }}
              />
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col bg-[#f6f1e7]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-black text-[#fff7e6]"
                style={{ background: activeUser.accent }}
              >
                {activeUser.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-black">{activeUser.name}</p>
                <p className="truncate text-xs font-semibold text-[#62594e]">
                  {activeScreenshot ? activeScreenshot.caption : activeUser.caption}
                </p>
              </div>
            </div>
            <button className="grid size-9 shrink-0 place-items-center rounded-md border border-black/10 bg-white/60" type="button" aria-label="Reply with camera">
              <Camera aria-hidden className="size-4" />
            </button>
          </div>

          <div className="min-h-[280px] flex-1 px-4">
            {activeScreenshot ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
                <div className="flex items-center justify-between text-xs font-black text-[#62594e]">
                  <span>{formatAge(activeScreenshot.ageHours)} ago</span>
                  <span>
                    {activeScreenshotIndex + 1}/{activeWeeklyScreenshots.length}
                  </span>
                </div>
                <WorkScreenshot tone={activeScreenshot.screenshotTone} url={activeScreenshot.screenshotUrl} />
              </div>
            ) : (
              <div className="grid h-full place-items-center rounded-lg border border-dashed border-black/18 bg-[#fffaf0] px-6 text-center">
                <p className="text-sm font-black leading-6 text-[#62594e]">本週還沒有包裝截圖。</p>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3">
            {activeWeeklyScreenshots.length > 1 ? (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  className="h-9 rounded-md border border-black/10 bg-[#fffaf0] text-xs font-black"
                  type="button"
                  onClick={() =>
                    setActiveScreenshotIndex((current) =>
                      current === 0 ? activeWeeklyScreenshots.length - 1 : current - 1,
                    )
                  }
                >
                  上一張
                </button>
                <button
                  className="h-9 rounded-md border border-black/10 bg-[#fffaf0] text-xs font-black"
                  type="button"
                  onClick={() => setActiveScreenshotIndex((current) => (current + 1) % activeWeeklyScreenshots.length)}
                >
                  下一張
                </button>
              </div>
            ) : null}
            <div className="mb-3 flex max-h-20 flex-col gap-2 overflow-auto">
              {activeMessages.length ? (
                activeMessages.slice(-2).map((message, index) => (
                  <p key={`${activeUser.id}-message-${index}`} className="rounded-md bg-[#fffaf0] px-3 py-2 text-sm font-semibold">
                    {message}
                  </p>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-black/18 px-3 py-2 text-sm font-semibold text-[#62594e]">
                  還沒有人回覆。
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <MessageCircle aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62594e]" />
                <input
                  className="h-11 w-full rounded-md border border-black/12 bg-[#fffaf0] pl-10 pr-3 text-sm font-semibold outline-none focus:border-black/50"
                  value={draft}
                  placeholder={activeScreenshot ? `回覆 ${activeUser.name}` : "等待本週截圖"}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                />
              </div>
              <button
                className="grid size-11 shrink-0 place-items-center rounded-md bg-[#171412] text-[#fff7e6] disabled:opacity-40"
                type="button"
                onClick={sendMessage}
                disabled={!activeScreenshot}
                aria-label="Send"
              >
                <Send aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </section>

      {!profile ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#171412]/78 px-5 backdrop-blur-sm">
          <form className="w-full max-w-[340px] rounded-lg bg-[#fffaf0] p-5 shadow-[0_24px_80px_rgba(0,0,0,.32)]" onSubmit={saveProfile}>
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#62594e]">Echo onboarding</p>
            <h2 className="mt-2 text-2xl font-black">你的糖果罐名稱</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#62594e]">
              手機和桌面端輸入同一個名稱，就會使用同一個 User_ID 寫入 Notion。
            </p>
            <input
              className="mt-5 h-12 w-full rounded-md border border-black/12 bg-white px-3 text-base font-black outline-none focus:border-black/55"
              value={nameDraft}
              placeholder="例如 Yuhsiang"
              autoFocus
              onChange={(event) => setNameDraft(event.target.value)}
            />
            {nameDraft.trim() ? (
              <p className="mt-3 truncate rounded-md bg-[#f6f1e7] px-3 py-2 text-xs font-bold text-[#62594e]">
                User_ID: {userIdFromName(nameDraft)}
              </p>
            ) : null}
            <button className="mt-5 h-12 w-full rounded-md bg-[#171412] text-sm font-black text-[#fff7e6]" type="submit">
              開始使用
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
