"use client";

/* eslint-disable @next/next/no-img-element */

import {
  BarChart3,
  Bell,
  MonitorDown,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import CandyShape from "@/app/_components/candy-shape";
import { AUDIO_CLASSES, AUDIO_CONFIG, type CandyAudioClass } from "@/lib/candy/catalog";
import { type JarUser, type WeeklyScreenshot } from "@/lib/mobile/mock-data";

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
  pageId: string;
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
  weeklyFeedStore.eventSource.addEventListener("candy.message", () => {
    void loadWeeklyFeed();
  });
}

function useWeeklyFeed() {
  return useSyncExternalStore(subscribeWeeklyFeed, getWeeklyFeedSnapshot, getWeeklyFeedServerSnapshot);
}

function weeklyScreenshotsFor(user: JarUser) {
  // The waterfall shows wrapped candies only — those with a real screenshot.
  // Raw candies still live in the bag (see JarPreview / liveUsersFromFeed).
  return user.weeklyScreenshots
    .filter((screenshot) => screenshot.screenshotUrl && screenshot.ageHours <= WEEKLY_FEED_HOURS)
    .sort((a, b) => a.ageHours - b.ageHours);
}

function formatAge(ageHours: number) {
  const totalMinutes = Math.round(ageHours * 60);
  if (totalMinutes < 60) return `${Math.max(1, totalMinutes)}m`;
  if (ageHours < 24) return `${Math.round(ageHours)}h`;
  return `${Math.round(ageHours / 24)}d`;
}

function toCandyAudioClass(audioClass: string): CandyAudioClass {
  return CANDY_AUDIO_CLASS_SET.has(audioClass) ? (audioClass as CandyAudioClass) : "Keyboard_heavy";
}

// Build the same multi-stop gradient the desktop candy uses, from the sound mix
// stored on the candy (its audioClasses). Same colour palette as AUDIO_CONFIG,
// so a candy here looks identical to the one that dropped on the desktop.
function candyGradient(classes: CandyAudioClass[]): string | undefined {
  const colors = classes.filter((cls) => AUDIO_CONFIG[cls]).map((cls) => AUDIO_CONFIG[cls].color);
  if (colors.length === 0) return undefined;
  if (colors.length === 1) return `linear-gradient(160deg, ${colors[0]} 0%, ${colors[0]} 100%)`;

  const stops: string[] = [];
  colors.forEach((color, i) => {
    const center = (((i + 0.5) / colors.length) * 100).toFixed(1);
    if (i === 0) stops.push(`${color} 0%`);
    stops.push(`${color} ${center}%`);
    if (i === colors.length - 1) stops.push(`${color} 100%`);
  });
  return `linear-gradient(160deg, ${stops.join(", ")})`;
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

  // Every candy counts toward the bag — Raw (no screenshot) included. The
  // screenshot waterfall filters by screenshotUrl separately (weeklyScreenshotsFor).
  items.forEach((item) => {
    grouped.set(item.userId, [...(grouped.get(item.userId) ?? []), item]);
  });

  return Array.from(grouped.entries()).map(([userId, userItems], index) => {
    const accent = ["#ff8aa6", "#92c8f3", "#88e0b0", "#ffc878", "#b896f5"][index % 5];
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
        pageId: item.pageId,
        ageHours,
        audioClasses,
        screenshotTone: toneForAudioClass(primaryAudioClass),
        screenshotUrl: item.screenshotUrl ?? undefined,
        minutes,
        messages: item.messages ?? [],
      };
    });
    const jar = weeklyScreenshots
      .filter((screenshot) => screenshot.ageHours <= WEEKLY_FEED_HOURS)
      .map((screenshot) => screenshot.audioClasses[0])
      .filter((audioClass): audioClass is CandyAudioClass => Boolean(audioClass));

    return {
      id: userId,
      name: nameFromUserId(userId, profile),
      handle: userId,
      online: true,
      accent,
      jar,
      caption: "最近一週的工作截圖。",
      weeklyScreenshots,
    };
  });
}

function WorkScreenshot({ tone, url }: { tone: "code" | "doc" | "chat"; url?: string }) {
  if (url) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden rounded-[10px] bg-[var(--paper-mid)]">
        <img className="h-full w-full object-cover" src={url} alt="" />
      </div>
    );
  }

  const palette = {
    code: ["#83e0ff", "#ff8fb5", "#ffe56f"],
    doc: ["#ffe56f", "#b6ff76", "#c68cff"],
    chat: ["#b6ff76", "#83e0ff", "#ff905d"],
  }[tone];

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[10px] bg-[#fffdf8]">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(90deg, rgba(28,25,22,.035) 1px, transparent 1px), linear-gradient(rgba(28,25,22,.025) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <span
        className="absolute left-[9%] top-[12%] h-[34%] w-[38%] rounded-full blur-[18px]"
        style={{ background: palette[0], opacity: 0.54 }}
      />
      <span
        className="absolute right-[10%] top-[22%] h-[22%] w-[32%] rounded-full blur-[18px]"
        style={{ background: palette[1], opacity: 0.55 }}
      />
      <span
        className="absolute bottom-[11%] left-[28%] h-[30%] w-[42%] rounded-full blur-[20px]"
        style={{ background: palette[2], opacity: 0.48 }}
      />
      <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2">
        <span className="h-1.5 w-16 rounded-full bg-[rgba(28,25,22,.10)]" />
        <span className="h-1.5 w-9 rounded-full bg-[rgba(28,25,22,.06)]" />
      </div>
      <span className="absolute left-[12%] top-[42%] z-20 h-7 w-[44%] rounded-[3px] bg-[var(--ink)]" />
      <span className="absolute right-[10%] top-[31%] z-20 h-6 w-[31%] rounded-[3px] bg-[var(--ink)]" />
      <span className="absolute bottom-[18%] right-[19%] z-20 h-6 w-[27%] rounded-[3px] bg-[var(--ink)]" />
    </div>
  );
}

// (Jar-ring geometry constants removed — replaced by translucent Bag SVG.)

/* === Algorithmic helpers =================================================
 * Deterministic hashing + mulberry32 PRNG let us generate per-user visuals
 * (avatar palette, candy jitter) that stay stable across renders.
 * ======================================================================= */
function hashString(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───── BAG — translucent candy bag ──────────────────────────────────────
 * Pure SVG composition. Bag silhouette has gathered ridges on top and a
 * very light vellum outline. No internal folds, ribbons, or shadow bands.
 * ─────────────────────────────────────────────────────────────────────── */
function Bag({
  width = 92,
  height = 116,
  active = false,
  children,
}: {
  width?: number;
  height?: number;
  active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className="relative inline-block" style={{ width, height }}>
      {/* SVG bag silhouette */}
      <svg
        viewBox="0 0 100 130"
        width={width}
        height={height}
        fill="none"
        aria-hidden
        className="absolute inset-0"
        preserveAspectRatio="none"
      >
        {/* translucent vellum fill */}
        <path
          d="M 28 19
             Q 33 8 40 20
             Q 48 7 56 20
             Q 64 8 72 20
             Q 82 22 84 35
             C 88 62 94 92 94 119
             C 80 122 62 123 49 123
             C 36 123 20 122 7 120
             C 8 92 15 61 18 35
             Q 18 22 28 19 Z"
          fill="rgba(255,255,255,.46)"
          stroke="rgba(28,25,22,.16)"
          strokeWidth={active ? "1.05" : "0.8"}
          strokeLinejoin="round"
        />
      </svg>

      {/* Candies inside */}
      <span className="absolute inset-0 z-[1]">{children}</span>
    </span>
  );
}

/* Algorithmic candy packing — bottom-up rows inside the bag.
 * Seed by userId so candies settle differently but always accumulate upward. */
function packedCandyPositions(seed: string, count: number) {
  const rng = mulberry32(hashString(seed));
  const positions: { left: number; top: number; rot: number }[] = [];
  let placed = 0;
  let row = 0;

  while (placed < count) {
    const remaining = count - placed;
    const colsInRow = Math.min(3, remaining);
    const rowWidth = colsInRow === 1 ? 0 : colsInRow === 2 ? 24 : 38;
    const startLeft = 48 - rowWidth / 2;

    for (let col = 0; col < colsInRow && placed < count; col++) {
      const step = colsInRow === 1 ? 0 : rowWidth / (colsInRow - 1);
      const left = startLeft + col * step + (rng() - 0.5) * 3;
      const top = 72 - row * 11 + rng() * 1.2;
      const rot = (rng() - 0.5) * 28;
      positions.push({ left, top, rot });
      placed += 1;
    }

    row += 1;
  }

  return positions;
}

// ── SpotlightPortal ───────────────────────────────────────────────────────────
// Renders into document.body so CSS transforms on ancestor elements don't clip
// the overlay. Animates in/out with a simple opacity + scale transition.

function SpotlightPortal({ url, onClose }: { url: string | null | undefined; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !url) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "rgba(18,16,14,0.90)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "echo-spotlight-in 180ms ease",
      }}
      onClick={onClose}
    >
      <img
        src={url}
        alt=""
        style={{
          maxHeight: "90svh",
          maxWidth: "100%",
          borderRadius: "12px",
          objectFit: "contain",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <style>{`
        @keyframes echo-spotlight-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function ScreenshotCard({
  screenshot,
  messages,
  onReply,
  currentUserName,
  userName,
}: {
  screenshot: WeeklyScreenshot;
  messages: string[];
  onReply: (text: string) => void;
  currentUserName: string;
  userName: string;
}) {
  const [draft, setDraft] = useState("");
  const [zoomed, setZoomed] = useState(false);
  const primaryAudioClass = screenshot.audioClasses[0];
  const mainSounds = screenshot.audioClasses.slice(0, 3);

  function send() {
    const text = draft.trim();
    if (!text) return;
    onReply(text);
    setDraft("");
  }

  return (
    <article className="relative pt-4">
      {/* meta row — age + main ambient-sound tags inline, candy shape on right */}
      <header className="mb-3 flex items-center gap-2">
        <span className="echo-eyebrow">{formatAge(screenshot.ageHours)} ago</span>
        {mainSounds.map((cls, i) => (
          <span
            key={`${screenshot.id}-sound-${cls}-${i}`}
            className="rounded-full border border-[var(--rule)] px-1.5 py-px text-[9px] font-medium tracking-wide text-[var(--ink-soft)]"
          >
            {AUDIO_CONFIG[cls].short.toLowerCase()}
          </span>
        ))}
        <span className="flex-1" />
        {primaryAudioClass ? (
          <CandyShape
            audioClass={primaryAudioClass}
            gradient={candyGradient(screenshot.audioClasses)}
            size={14}
          />
        ) : null}
      </header>

      {/* screenshot — minimal thin border, tap to spotlight */}
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          aspectRatio: "16 / 11",
          border: "1px solid var(--rule)",
          cursor: screenshot.screenshotUrl ? "zoom-in" : "default",
        }}
        role={screenshot.screenshotUrl ? "button" : undefined}
        tabIndex={screenshot.screenshotUrl ? 0 : undefined}
        onClick={() => {
          if (screenshot.screenshotUrl) setZoomed(true);
        }}
      >
        <WorkScreenshot tone={screenshot.screenshotTone} url={screenshot.screenshotUrl} />
      </div>

      {/* spotlight — portal to body so transform ancestors don't clip it */}
      <SpotlightPortal
        url={zoomed ? screenshot.screenshotUrl : null}
        onClose={() => setZoomed(false)}
      />

      {/* messages — dash-prefixed prose, never bubbles */}
      {messages.length > 0 ? (
        <div className="mt-5 flex flex-col gap-2">
          {messages.map((message, i) => {
            const separatorIndex = message.search(/[:：]/);
            const author = separatorIndex >= 0 ? message.slice(0, separatorIndex).trim() : "—";
            const body = separatorIndex >= 0 ? message.slice(separatorIndex + 1).trim() : message;
            const isYou = author === currentUserName || author === "You";
            return (
              <p
                key={`${screenshot.id}-msg-${i}`}
                className="text-[13.5px] leading-[1.55]"
                style={{ color: "var(--ink)", fontWeight: 500 }}
              >
                <span
                  className="mr-1.5 text-[12px]"
                  style={{
                    color: isYou ? "var(--ribbon)" : "var(--ink-muted)",
                    fontWeight: 700,
                  }}
                >
                  — {author}
                </span>
                {body}
              </p>
            );
          })}
        </div>
      ) : null}

      {/* reply — minimal line, no boxes */}
      <div className="mt-5 flex items-center gap-3 pb-2">
        <MessageCircle aria-hidden className="size-3.5 shrink-0 text-[var(--ink-soft)]" />
        <input
          className="flex-1 bg-transparent text-[14px] font-medium text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
          style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6 }}
          value={draft}
          placeholder={`reply to ${userName}…`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              send();
            }
          }}
        />
        <button
          className="echo-press grid size-8 shrink-0 place-items-center rounded-full disabled:opacity-25"
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          aria-label="Send"
          style={{
            background: draft.trim() ? "var(--ribbon)" : "transparent",
            color: draft.trim() ? "#fff" : "var(--ink-soft)",
            border: draft.trim() ? "none" : "1px solid var(--rule)",
          }}
        >
          <Send aria-hidden className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

function JarPreview({
  active,
  onSelect,
  user,
}: {
  active: boolean;
  onSelect: () => void;
  user: JarUser;
}) {
  // seeded micro-tilt — each bag leans a touch
  const tilt = ((hashString(user.id) % 800) / 800 - 0.5) * 5; // ±2.5°
  const slice = user.weeklyScreenshots
    .filter((screenshot) => screenshot.ageHours <= WEEKLY_FEED_HOURS)
    .map((screenshot) => screenshot.audioClasses)
    .filter((classes) => classes.length > 0 && Boolean(classes[0]))
    .slice(0, 8);
  const positions = packedCandyPositions(user.id, slice.length);
  return (
    <button
      className={`echo-press grid min-w-[78px] snap-center justify-items-center gap-2 text-center transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-[0.35]"
      }`}
      type="button"
      data-user-id={user.id}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span
        className="relative transition-transform duration-300"
        style={{ transform: `rotate(${active ? 0 : tilt}deg) scale(${active ? 1.04 : 1})` }}
      >
        <Bag width={74} height={96} active={active}>
          {slice.map((classes, index) => {
            const p = positions[index];
            return (
              <span
                key={`${user.id}-${classes[0]}-${index}`}
                className="absolute"
                style={{
                  left: `${Math.min(75, Math.max(5, p.left))}%`,
                  top: `${p.top}%`,
                  transform: `rotate(${p.rot * 0.5}deg)`,
                }}
              >
                <CandyShape audioClass={classes[0]} gradient={candyGradient(classes)} size={13} />
              </span>
            );
          })}
        </Bag>
        {/* tiny activity dot — sits just outside the bag */}
        {user.online ? (
          <span
            className="absolute right-0 top-1 z-[3] size-1.5 rounded-full"
            style={{ background: "var(--ribbon)" }}
          />
        ) : null}
      </span>

      {/* name — minimal type */}
      <span className="grid w-full gap-0.5">
        <span
          className={`truncate text-[13px] leading-none ${
            active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
          }`}
          style={{ fontWeight: active ? 700 : 500 }}
        >
          {user.name}
        </span>
      </span>
    </button>
  );
}

export default function MobileAppPrototype() {
  const [activeId, setActiveId] = useState("");
  const jarDragStartXRef = useRef<number | null>(null);
  const jarDragDeltaRef = useRef(0);
  const [jarDragDelta, setJarDragDelta] = useState(0);
  const profile = useStoredProfile();
  const weeklyFeed = useWeeklyFeed();
  const [nameDraft, setNameDraft] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // On mount, check if push is already subscribed so the Bell icon shows the
  // correct state without requiring the user to tap it again after a refresh.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setPushStatus("ready");
      }).catch(() => {/* ignore */});
    }).catch(() => {/* ignore */});
  }, []);
  const [messages, setMessages] = useState<Record<string, string[]>>({});
  const liveUsers = useMemo(() => liveUsersFromFeed(weeklyFeed.items, profile), [profile, weeklyFeed.items]);
  const users = useMemo(() => {
    if (!profile) {
      return liveUsers;
    }

    const hasProfileUser = liveUsers.some((user) => user.id === profile.userId);

    if (hasProfileUser) {
      return liveUsers;
    }

    return [
      {
        id: profile.userId,
        name: profile.name,
        handle: profile.userId,
        online: true,
        accent: "#ff8aa6",
        jar: [],
        caption: "你的工作糖果罐。",
        weeklyScreenshots: [],
      },
      ...liveUsers,
    ];
  }, [liveUsers, profile]);
  const activeUser = useMemo(
    () => users.find((user) => user.id === activeId) ?? users[0] ?? null,
    [activeId, users],
  );
  const activeIndex = activeUser ? Math.max(0, users.findIndex((user) => user.id === activeUser.id)) : 0;
  const activeWeeklyScreenshots = useMemo(
    () => (activeUser ? weeklyScreenshotsFor(activeUser) : []),
    [activeUser],
  );

  function focusJarByIndex(nextIndex: number) {
    if (!users.length) {
      return;
    }

    const clampedIndex = Math.min(users.length - 1, Math.max(0, nextIndex));
    const nextUser = users[clampedIndex];
    if (nextUser) {
      setActiveId(nextUser.id);
    }
  }

  function beginJarDrag(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    jarDragStartXRef.current = event.clientX;
    jarDragDeltaRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateJarDrag(event: PointerEvent<HTMLDivElement>) {
    if (jarDragStartXRef.current === null) return;
    event.preventDefault();
    const delta = event.clientX - jarDragStartXRef.current;
    jarDragDeltaRef.current = delta;
    setJarDragDelta(delta);
  }

  function endJarDrag() {
    if (jarDragStartXRef.current === null) return;
    const delta = jarDragDeltaRef.current;
    const threshold = 34;

    if (delta < -threshold) {
      focusJarByIndex(activeIndex + 1);
    } else if (delta > threshold) {
      focusJarByIndex(activeIndex - 1);
    }

    jarDragStartXRef.current = null;
    jarDragDeltaRef.current = 0;
    setJarDragDelta(0);
  }

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

  async function addMessage(screenshot: WeeklyScreenshot, text: string) {
    if (!profile) {
      return;
    }

    const pageId = screenshot.pageId;
    const line = `${profile.name}：${text}`;

    setMessages((current) => ({
      ...current,
      [screenshot.id]: [...(current[screenshot.id] ?? screenshot.messages ?? []), line],
    }));

    if (!pageId) {
      return;
    }

    const response = await fetch("/api/candy", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pageId,
        candyId: screenshot.id,
        userId: profile.userId,
        userName: profile.name,
        message: text,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      setMessages((current) => ({
        ...current,
        [screenshot.id]: current[screenshot.id]?.filter((message) => message !== line) ?? [],
      }));
      return;
    }

    void loadWeeklyFeed();
  }

  async function handleEnablePush() {
    if (!profile) {
      setPushStatus("error");
      return;
    }

    try {
      setPushStatus("loading");
      await enablePushNotifications(profile.userId);
      setPushStatus("ready");
    } catch {
      setPushStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto flex h-[100svh] min-h-[720px] w-full max-w-[480px] flex-col overflow-hidden bg-[var(--paper)]">
        {/* ══════════════ minimal top bar ══════════════ */}
        <header className="flex h-12 shrink-0 items-center justify-between px-5">
          <Link
            className="echo-press grid size-8 place-items-center"
            href="/desktop"
            aria-label="Desktop app downloads"
            style={{ color: "var(--ink-muted)" }}
          >
            <MonitorDown aria-hidden className="size-4" />
          </Link>
          <h1 className="text-[14px] font-semibold tracking-tight text-[var(--ink)]">
            echo
          </h1>
          <div className="flex gap-1">
            <button
              className="echo-press grid size-8 place-items-center"
              type="button"
              onClick={handleEnablePush}
              aria-label="Enable notifications"
              title={pushStatus === "ready" ? "Notifications ready" : "Enable notifications"}
              disabled={pushStatus === "loading"}
              style={{
                color:
                  pushStatus === "ready"
                    ? "var(--ribbon)"
                    : pushStatus === "error"
                      ? "var(--ribbon)"
                      : "var(--ink-muted)",
              }}
            >
              <Bell aria-hidden className="size-4" />
            </button>
            <Link
              className="echo-press grid size-8 place-items-center"
              href={profile?.userId ? `/mobile/data?userId=${encodeURIComponent(profile.userId)}` : "/mobile/data"}
              aria-label="Open data page"
              style={{ color: "var(--ink-muted)" }}
            >
              <BarChart3 aria-hidden className="size-4" />
            </Link>
          </div>
        </header>

        {/* ══════════════ POSTER HERO — bags on the shelf ══════════════ */}
        <section className="shrink-0 overflow-hidden px-5 pb-2 pt-3">
          <div
            className="echo-jar-carousel relative h-[136px] overflow-clip touch-pan-y select-none"
            onPointerDown={beginJarDrag}
            onPointerMove={updateJarDrag}
            onPointerUp={endJarDrag}
            onPointerCancel={endJarDrag}
            onDragStart={(event) => event.preventDefault()}
          >
            <div
              className="absolute left-0 top-1 flex gap-2.5 transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(calc(50% - 39px - ${activeIndex * 88}px + ${jarDragDelta}px))`,
              }}
            >
              {users.map((user, i) => (
                <div
                  key={user.id}
                  className="echo-rise shrink-0"
                  style={{ ["--i" as keyof React.CSSProperties as string]: i } as React.CSSProperties}
                >
                  <JarPreview
                    user={user}
                    active={user.id === activeUser.id}
                    onSelect={() => focusJarByIndex(i)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ ACTIVE BAG — minimal title row ══════════════ */}
        <section className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center px-5 pb-3 pt-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[var(--ink-soft)]">
                {activeUser?.online ? "online · just now" : "offline"}
              </p>
              <h3 className="truncate text-[20px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
                {activeUser?.name ?? "echo"}
                <span className="text-[var(--ink-soft)]"> ’s candy</span>
              </h3>
            </div>
          </div>

          {/* ══════ Waterfall of screenshots — generous breathing room ══════ */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            {activeWeeklyScreenshots.length > 0 ? (
              <div className="flex flex-col">
                {activeWeeklyScreenshots.map((screenshot, i) => (
                  <div
                    key={screenshot.id}
                    className="echo-rise pb-3"
                    style={{ ["--i" as keyof React.CSSProperties as string]: i } as React.CSSProperties}
                  >
                    <ScreenshotCard
                      screenshot={screenshot}
                      messages={messages[screenshot.id] ?? screenshot.messages ?? []}
                      onReply={(text) => {
                        void addMessage(screenshot, text);
                      }}
                      currentUserName={profile?.name ?? "You"}
                      userName={activeUser?.name ?? "echo"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div className="grid gap-4 justify-items-center">
                  <Bag width={88} height={110}>
                    <span className="absolute inset-0 grid place-items-center opacity-40">
                      <CandyShape audioClass={activeUser?.jar[0] ?? "Speech"} size={20} />
                    </span>
                  </Bag>
                  <p className="text-[14px] font-medium leading-snug text-[var(--ink-muted)]">
                    nothing in the bag yet
                    <br />
                    <span className="text-[var(--ink-soft)]">本週還沒有包裝截圖</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>

      {!profile ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-5"
          style={{ background: "rgba(28,25,22,.42)", backdropFilter: "blur(6px)" }}
        >
          <form
            className="w-full max-w-[340px] rounded-2xl bg-[var(--paper)] px-6 py-7 text-center"
            style={{ border: "1px solid var(--rule)" }}
            onSubmit={saveProfile}
          >
            <div className="mb-5 flex justify-center">
              <Bag width={80} height={100}>
                <span className="absolute inset-0 grid place-items-center">
                  <CandyShape audioClass="Speech" size={22} />
                </span>
              </Bag>
            </div>
            <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
              name your{" "}
              <span className="echo-underline font-display italic">bag</span>?
            </h2>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--ink-muted)]">
              手機與桌面端使用同一名稱，便會以同一個 User_ID 寫入 Notion。
            </p>
            <input
              className="mt-5 h-10 w-full bg-transparent text-center text-[16px] font-medium outline-none"
              style={{
                color: "var(--ink)",
                borderBottom: "1px solid var(--rule)",
              }}
              value={nameDraft}
              placeholder="Yuhsiang"
              autoFocus
              onChange={(event) => setNameDraft(event.target.value)}
            />
            {nameDraft.trim() ? (
              <p className="mt-3 text-[10px] font-medium tracking-wide text-[var(--ink-soft)]">
                id · {userIdFromName(nameDraft)}
              </p>
            ) : null}
            <button
              className="echo-press mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 text-[13px] font-semibold"
              style={{ background: "var(--ribbon)", color: "#fff" }}
              type="submit"
            >
              begin
              <span aria-hidden>→</span>
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
