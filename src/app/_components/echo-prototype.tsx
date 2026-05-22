"use client";

import {
  Archive,
  Bell,
  Check,
  Clock,
  Cloud,
  Database,
  Gift,
  Keyboard,
  Mic,
  Monitor,
  MousePointerClick,
  Package,
  Paintbrush,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Smartphone,
  Square,
  TrafficCone,
  Volume2,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import CandyShape from "@/app/_components/candy-shape";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  type CandyAudioClass,
} from "@/lib/candy/catalog";

type AudioClass = CandyAudioClass;
type CandyStatus = "Pending" | "Raw" | "Wrapped";
type MaskMode = "block" | "brush";

type Mask = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
};

type PendingCandy = {
  id: string;
  audioClass: AudioClass;
  durationSec: number;
  status: "Pending";
  x: number;
};

type CandyRecord = {
  id: string;
  userId: string;
  audioClass: AudioClass;
  durationSec: number;
  status: Exclude<CandyStatus, "Pending">;
  screenshotFile: string;
  createdTime: string;
  masks: Mask[];
};

type FeedItem = {
  id: string;
  friend: string;
  online: boolean;
  audioClass: AudioClass;
  candyId: string;
  createdTime: string;
  masks: Mask[];
  replies: string[];
};

const CANDY_ICONS: Record<(typeof AUDIO_CONFIG)[AudioClass]["icon"], LucideIcon> = {
  cloud: Cloud,
  keyboard: Keyboard,
  mic: Mic,
  mouse: MousePointerClick,
  traffic: TrafficCone,
  volume: Volume2,
};

const INITIAL_MASKS: Mask[] = [
  { id: "mask-a", left: 58, top: 17, width: 28, height: 8, rotate: 0 },
  { id: "mask-b", left: 11, top: 46, width: 38, height: 10, rotate: -1 },
  { id: "mask-c", left: 62, top: 69, width: 25, height: 9, rotate: 1 },
];

const INITIAL_RECORDS: CandyRecord[] = [
  {
    id: "ECH-RAW-1009",
    userId: "local-user",
    audioClass: "Keyboard_heavy",
    durationSec: 760,
    status: "Raw",
    screenshotFile: "空",
    createdTime: "09:40",
    masks: [],
  },
  {
    id: "ECH-WRP-1011",
    userId: "local-user",
    audioClass: "Sigh",
    durationSec: 11,
    status: "Wrapped",
    screenshotFile: "masked-workscreen-1011.png",
    createdTime: "10:12",
    masks: INITIAL_MASKS,
  },
];

const INITIAL_FEED: FeedItem[] = [
  {
    id: "feed-mika-101",
    friend: "Mika",
    online: true,
    audioClass: "Sigh",
    candyId: "MKA-WRP-503",
    createdTime: "10:18",
    masks: [
      { id: "friend-mask-a", left: 12, top: 27, width: 32, height: 9, rotate: 0 },
      { id: "friend-mask-b", left: 55, top: 57, width: 35, height: 11, rotate: -1 },
    ],
    replies: ["我懂，這一聲很真。"],
  },
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 7).toUpperCase()}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, seconds % 60);

  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function progressFor(audioClass: AudioClass, seconds: number) {
  return Math.min(100, Math.round((seconds / AUDIO_CONFIG[audioClass].thresholdSec) * 100));
}

function StatusPill({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "rose";
  icon?: LucideIcon;
}) {
  const toneClass = {
    neutral: "border-black/15 bg-white/60 text-[#302a24]",
    green: "border-emerald-700/25 bg-emerald-100/80 text-emerald-950",
    amber: "border-amber-700/25 bg-amber-100/80 text-amber-950",
    rose: "border-rose-700/25 bg-rose-100/80 text-rose-950",
  }[tone];

  return (
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold ${toneClass}`}>
      {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
      {children}
    </span>
  );
}

function ScreenshotMock({
  masks,
  interactive = false,
  mode = "block",
  onAddMask,
  compact = false,
}: {
  masks: Mask[];
  interactive?: boolean;
  mode?: MaskMode;
  onAddMask?: (mask: Mask) => void;
  compact?: boolean;
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onAddMask) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const left = ((event.clientX - rect.left) / rect.width) * 100;
    const top = ((event.clientY - rect.top) / rect.height) * 100;

    onAddMask({
      id: makeId("MSK"),
      left: Math.max(3, Math.min(84, left - (mode === "block" ? 13 : 8))),
      top: Math.max(8, Math.min(83, top - (mode === "block" ? 4 : 2))),
      width: mode === "block" ? 28 : 18,
      height: mode === "block" ? 9 : 4.5,
      rotate: mode === "brush" ? -4 + Math.random() * 8 : 0,
    });
  };

  return (
    <div
      className={`screenshot-mock ${interactive ? "cursor-crosshair" : ""} ${compact ? "h-36" : "h-[320px]"}`}
      onClick={handleClick}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label="Masked work screenshot mock"
    >
      <div className="absolute left-0 top-0 z-10 flex h-9 w-full items-center gap-2 border-b border-white/10 bg-black/30 px-3">
        <span className="size-2 rounded-full bg-[#ef6f7f]" />
        <span className="size-2 rounded-full bg-[#f5b642]" />
        <span className="size-2 rounded-full bg-[#7cd7b8]" />
        <span className="ml-2 h-3 w-28 rounded-sm bg-white/16" />
      </div>
      <div className="absolute inset-x-4 bottom-5 top-14 z-10 grid grid-cols-[0.72fr_1fr] gap-4 text-xs text-white/72">
        <div className="space-y-2">
          {Array.from({ length: compact ? 5 : 9 }).map((_, index) => (
            <div key={`line-left-${index}`} className="flex items-center gap-2">
              <span className="font-mono text-white/28">{(index + 11).toString().padStart(2, "0")}</span>
              <span
                className="h-2 rounded-sm"
                style={{
                  width: `${48 + ((index * 17) % 38)}%`,
                  background:
                    index % 3 === 0
                      ? "rgba(101, 199, 223, 0.66)"
                      : index % 3 === 1
                        ? "rgba(245, 182, 66, 0.66)"
                        : "rgba(255, 255, 255, 0.28)",
                }}
              />
            </div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <div className="h-16 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="mb-3 h-2 w-24 rounded-sm bg-white/28" />
            <div className="h-2 w-4/5 rounded-sm bg-[#7cd7b8]/70" />
          </div>
          <div className="h-20 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="mb-3 h-2 w-32 rounded-sm bg-[#ef6f7f]/70" />
            <div className="h-2 w-2/3 rounded-sm bg-white/24" />
          </div>
          {!compact ? (
            <div className="h-14 rounded-md border border-white/10 bg-white/8 p-3">
              <div className="h-2 w-3/5 rounded-sm bg-[#f5b642]/70" />
            </div>
          ) : null}
        </div>
      </div>
      {masks.map((mask) => (
        <span
          key={mask.id}
          className="absolute z-20 rounded-[3px] bg-black"
          style={{
            left: `${mask.left}%`,
            top: `${mask.top}%`,
            width: `${mask.width}%`,
            height: `${mask.height}%`,
            transform: `rotate(${mask.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function EchoPrototype() {
  const [activeClass, setActiveClass] = useState<AudioClass>("Keyboard_heavy");
  const [isHarvesting, setIsHarvesting] = useState(true);
  const [buffer, setBuffer] = useState<Record<AudioClass, number>>({
    Keyboard_heavy: 940,
    Sigh: 0,
    Mouse_click: 260,
    Speech: 140,
    Music: 80,
    Air_conditioner: 360,
    Traffic: 40,
    Door_knock: 0,
    Silence: 520,
  });
  const [pendingCandy, setPendingCandy] = useState<PendingCandy | null>(null);
  const [records, setRecords] = useState<CandyRecord[]>(INITIAL_RECORDS);
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [jarTab, setJarTab] = useState<"jar" | "feed">("jar");
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [wrapCandy, setWrapCandy] = useState<PendingCandy | null>(null);
  const [maskMode, setMaskMode] = useState<MaskMode>("block");
  const [masks, setMasks] = useState<Mask[]>(INITIAL_MASKS);
  const [syncState, setSyncState] = useState("本地緩衝啟動");
  const [phoneDrop, setPhoneDrop] = useState<CandyRecord | null>(null);
  const [friendDrop, setFriendDrop] = useState<{ id: string; audioClass: AudioClass; wrapped: boolean } | null>(null);
  const [shakeJar, setShakeJar] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const pendingConfig = pendingCandy ? AUDIO_CONFIG[pendingCandy.audioClass] : null;

  const todaysWrapped = useMemo(
    () => records.filter((record) => record.status === "Wrapped").length,
    [records],
  );

  function triggerDemoDrop(audioClass: AudioClass, wrapped = false) {
    setActiveClass(audioClass);
    setPendingCandy({
      id: makeId(wrapped ? "WRAP" : "DROP"),
      audioClass,
      durationSec: AUDIO_CONFIG[audioClass].thresholdSec,
      status: "Pending",
      x: 16 + Math.random() * 58,
    });
    setSyncState(`快捷鍵觸發：MediaPipe ${AUDIO_CONFIG[audioClass].label}`);
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const hasCommandOrControl = event.metaKey || event.ctrlKey;
      const hasOptionOrAlt = event.altKey;
      const key = event.key.toLowerCase();

      if (!hasCommandOrControl || !hasOptionOrAlt) {
        return;
      }

      if (key === "e") {
        event.preventDefault();
        triggerDemoDrop("Keyboard_heavy");
      }

      if (key === "w") {
        event.preventDefault();
        triggerDemoDrop("Sigh", true);
      }
    }

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!isHarvesting || pendingCandy) {
      return;
    }

    const interval = window.setInterval(() => {
      setBuffer((current) => {
        const increment = activeClass === "Sigh" ? 3 : activeClass === "Mouse_click" ? 18 : activeClass === "Door_knock" ? 2 : 26;
        const cap = AUDIO_CONFIG[activeClass].thresholdSec + 90;

        return {
          ...current,
          [activeClass]: Math.min(cap, current[activeClass] + increment),
        };
      });
    }, 900);

    return () => window.clearInterval(interval);
  }, [activeClass, isHarvesting, pendingCandy]);

  useEffect(() => {
    if (pendingCandy) {
      return;
    }

    const readyClass = AUDIO_CLASSES.find(
      (audioClass) =>
        AUDIO_CONFIG[audioClass].drops &&
        buffer[audioClass] >= AUDIO_CONFIG[audioClass].thresholdSec,
    );

    if (!readyClass) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPendingCandy({
        id: makeId("DROP"),
        audioClass: readyClass,
        durationSec: buffer[readyClass],
        status: "Pending",
        x: 16 + Math.random() * 58,
      });
      setSyncState(`MediaPipe: ${AUDIO_CONFIG[readyClass].label}已達門檻`);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [buffer, pendingCandy]);

  function primeAudioClass(audioClass: AudioClass) {
    setActiveClass(audioClass);
    setBuffer((current) => ({
      ...current,
      [audioClass]: AUDIO_CONFIG[audioClass].thresholdSec,
    }));
  }

  function buildRecord(
    candy: PendingCandy,
    status: Exclude<CandyStatus, "Pending">,
    screenshotMasks: Mask[] = [],
  ): CandyRecord {
    return {
      id: candy.id.replace("DROP", status === "Wrapped" ? "ECH-WRP" : "ECH-RAW"),
      userId: "local-user",
      audioClass: candy.audioClass,
      durationSec: candy.durationSec,
      status,
      screenshotFile: status === "Wrapped" ? `masked-workscreen-${candy.id.slice(-5).toLowerCase()}.png` : "空",
      createdTime: nowLabel(),
      masks: screenshotMasks,
    };
  }

  async function postCandy(record: CandyRecord) {
    setSyncState("寫入 /api/candy");

    try {
      const response = await fetch("/api/candy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...record,
          primaryAudioClass: record.audioClass,
          audioClasses: [
            record.audioClass,
            ...AUDIO_CLASSES.filter((audioClass) => audioClass !== record.audioClass && buffer[audioClass] > 0),
          ],
          mediapipeCategory: AUDIO_CONFIG[record.audioClass].mediapipeCategory,
          mediapipeScore: Number(AUDIO_CONFIG[record.audioClass].confidence),
        }),
      });
      const body = (await response.json()) as { websocket?: { event: string } };

      setSyncState(
        body.websocket
          ? "Notion Row 已存 + WebSocket 廣播"
          : "Raw 已存入 Notion Row",
      );
    } catch {
      setSyncState("本地快取保留；API 不可用");
    }
  }

  function clearClassBuffer(audioClass: AudioClass) {
    setBuffer((current) => ({
      ...current,
      [audioClass]: 0,
    }));
  }

  function stashCandy() {
    if (!pendingCandy) {
      return;
    }

    const record = buildRecord(pendingCandy, "Raw");

    setRecords((current) => [record, ...current]);
    clearClassBuffer(pendingCandy.audioClass);
    setPendingCandy(null);
    void postCandy(record);
  }

  function requestWrap() {
    if (!pendingCandy) {
      return;
    }

    if (!hasPrivacyConsent) {
      setPrivacyOpen(true);
      return;
    }

    setMasks(INITIAL_MASKS);
    setWrapCandy(pendingCandy);
  }

  function acceptPrivacy() {
    setHasPrivacyConsent(true);
    setPrivacyOpen(false);

    if (pendingCandy) {
      setMasks(INITIAL_MASKS);
      setWrapCandy(pendingCandy);
    }
  }

  function confirmWrap() {
    if (!wrapCandy) {
      return;
    }

    const record = buildRecord(wrapCandy, "Wrapped", masks);
    const feedItem: FeedItem = {
      id: makeId("feed-local"),
      friend: "You",
      online: true,
      audioClass: record.audioClass,
      candyId: record.id,
      createdTime: record.createdTime,
      masks: record.masks,
      replies: [],
    };

    setRecords((current) => [record, ...current]);
    setFeed((current) => [feedItem, ...current]);
    setJarTab("feed");
    setPhoneDrop(record);
    setFriendDrop({ id: record.id, audioClass: record.audioClass, wrapped: true });
    clearClassBuffer(record.audioClass);
    setPendingCandy(null);
    setWrapCandy(null);
    void postCandy(record);

    window.setTimeout(() => setPhoneDrop(null), 1250);
    window.setTimeout(() => setFriendDrop(null), 2100);
  }

  function shakePhoneJar() {
    setShakeJar(true);
    window.navigator.vibrate?.(32);
    window.setTimeout(() => setShakeJar(false), 700);
  }

  function giveSugar() {
    const source = records.find((record) => record.status === "Wrapped") ?? records[0];
    const audioClass = source?.audioClass ?? "Sigh";

    setFriendDrop({ id: makeId("AIR"), audioClass, wrapped: false });
    setSyncState("Give Sugar -> WebSocket 送出");
    window.navigator.vibrate?.(18);
    window.setTimeout(() => setFriendDrop(null), 2100);
  }

  function sendReply(feedId: string) {
    const draft = replyDrafts[feedId]?.trim();

    if (!draft) {
      return;
    }

    setFeed((current) =>
      current.map((item) =>
        item.id === feedId
          ? {
              ...item,
              replies: [...item.replies, draft],
            }
          : item,
      ),
    );
    setReplyDrafts((current) => ({ ...current, [feedId]: "" }));
    setSyncState("回覆已掛上包裝糖");
  }

  return (
    <main className="min-h-screen px-4 py-4 text-[#171412] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-4">
        <header className="echo-panel flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md border border-black/15 bg-[#171412] text-[#fff7e6]">
              <Zap aria-hidden className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#62594e]">Echo</p>
              <h1 className="text-2xl font-black sm:text-3xl">數位勞動糖果操作台</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="echo-button min-h-8 px-2.5 text-xs" href="/mobile">
              <Smartphone aria-hidden className="size-3.5" />
              Mobile app
            </Link>
            <StatusPill icon={Monitor} tone="green">PC online</StatusPill>
            <StatusPill icon={ShieldCheck} tone="green">RAM-only audio</StatusPill>
            <StatusPill icon={Wifi} tone="amber">{syncState}</StatusPill>
            <StatusPill icon={Clock}>{todaysWrapped} wrapped today</StatusPill>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="echo-panel overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="border-b border-black/10 bg-[#fffaf0]/72 p-4 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#62594e]">The Harvester</p>
                    <h2 className="text-xl font-black">MediaPipe 全聲景緩衝</h2>
                  </div>
                  <button
                    className="echo-button"
                    type="button"
                    onClick={() => setIsHarvesting((current) => !current)}
                    aria-label={isHarvesting ? "Pause harvester" : "Start harvester"}
                  >
                    {isHarvesting ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                    {isHarvesting ? "Pause" : "Start"}
                  </button>
                </div>

                <div className="mb-5 grid grid-cols-4 gap-1.5 rounded-md border border-black/10 bg-white/55 p-1.5">
                  {Array.from({ length: 20 }).map((_, index) => (
                    <span
                      key={`meter-${index}`}
                      className="meter-spark h-12 origin-bottom rounded-[3px] bg-[#171412]"
                      style={{
                        animationDelay: `${index * 90}ms`,
                        opacity: index % 4 === 0 ? 0.9 : 0.48,
                        background:
                          index % 5 === 0
                            ? "#ef6f7f"
                            : index % 4 === 0
                              ? "#65c7df"
                              : index % 3 === 0
                                ? "#7cd7b8"
                                : "#171412",
                      }}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  {AUDIO_CLASSES.map((audioClass) => {
                    const config = AUDIO_CONFIG[audioClass];
                    const progress = progressFor(audioClass, buffer[audioClass]);
                    const Icon = CANDY_ICONS[config.icon];

                    return (
                      <button
                        key={audioClass}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          activeClass === audioClass
                            ? "border-black/45 bg-white shadow-sm"
                            : "border-black/10 bg-white/45 hover:border-black/25"
                        }`}
                        type="button"
                        onClick={() => setActiveClass(audioClass)}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-bold">
                            <Icon aria-hidden className="size-4" style={{ color: config.color }} />
                            {config.label}
                          </span>
                          <span className="font-mono text-xs text-[#62594e]">{formatDuration(buffer[audioClass])}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-sm bg-black/10">
                          <span
                            className="block h-full rounded-sm"
                            style={{
                              width: `${progress}%`,
                              background: config.color,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-[#62594e]">
                          <span>{config.mediapipeCategory}</span>
                          <span>{progress}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {AUDIO_CLASSES.map((audioClass) => (
                    <button
                      key={`prime-${audioClass}`}
                      className="echo-button min-h-9 px-2 text-xs"
                      type="button"
                      onClick={() => primeAudioClass(audioClass)}
                    >
                      <Zap aria-hidden className="size-3.5" />
                      {AUDIO_CONFIG[audioClass].short}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="desktop-surface relative min-h-[620px] overflow-hidden p-4 text-[#fff7e6]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(245,182,66,0.22),transparent_44%)]" />
                <div className="relative z-10 flex h-full min-h-[590px] flex-col">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white/62">MediaPipe Audio Classifier to Invisible Overlay</p>
                      <h2 className="text-2xl font-black">全螢幕透明糖果層</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-white/12 bg-white/8 px-2.5 py-1.5 text-xs font-semibold text-white/78">
                        frameless
                      </span>
                      <span className="rounded-md border border-white/12 bg-white/8 px-2.5 py-1.5 text-xs font-semibold text-white/78">
                        alwaysOnTop
                      </span>
                      <span className="rounded-md border border-white/12 bg-white/8 px-2.5 py-1.5 text-xs font-semibold text-white/78">
                        click-through
                      </span>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
                    <div className="relative min-h-[460px] overflow-hidden rounded-md border border-white/12 bg-black/22">
                      <div className="absolute left-5 top-5 w-[52%] rounded-md border border-white/10 bg-white/8 p-4">
                        <div className="mb-4 h-3 w-28 rounded-sm bg-white/22" />
                        <div className="grid gap-2">
                          <div className="h-3 w-4/5 rounded-sm bg-[#65c7df]/58" />
                          <div className="h-3 w-3/5 rounded-sm bg-white/20" />
                          <div className="h-3 w-5/6 rounded-sm bg-[#f5b642]/58" />
                        </div>
                      </div>
                      <div className="absolute bottom-8 left-6 right-6 rounded-md border border-white/10 bg-white/8 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="size-2 rounded-full bg-[#7cd7b8]" />
                          <span className="h-2 w-36 rounded-sm bg-white/24" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="h-16 rounded-md bg-white/8" />
                          <span className="h-16 rounded-md bg-white/8" />
                          <span className="h-16 rounded-md bg-white/8" />
                        </div>
                      </div>

                      {pendingCandy && pendingConfig ? (
                        <div
                          className="drop-candy absolute top-16 z-20 flex w-[188px] flex-col items-center gap-3"
                          style={{
                            left: `clamp(12px, ${pendingCandy.x}%, calc(100% - 204px))`,
                          }}
                        >
                          <CandyShape audioClass={pendingCandy.audioClass} size={74} />
                          <div className="w-full rounded-md border border-white/18 bg-[#fffaf0] p-3 text-[#171412] shadow-2xl">
                            <div className="mb-2 flex items-center gap-2">
                              <CandyShape audioClass={pendingCandy.audioClass} size={28} />
                              <div>
                                <p className="text-sm font-black">{pendingConfig.candyName}</p>
                                <p className="font-mono text-xs text-[#62594e]">
                                  {formatDuration(pendingCandy.durationSec)}
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <button className="echo-button min-h-9 w-full" type="button" onClick={stashCandy}>
                                <Archive aria-hidden className="size-4" />
                                收進罐子
                              </button>
                              <button className="echo-button echo-button-warm min-h-9 w-full" type="button" onClick={requestWrap}>
                                <Package aria-hidden className="size-4" />
                                給它包裝紙
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute left-1/2 top-1/2 z-10 w-[min(320px,80%)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/12 bg-black/24 p-5 text-center">
                          <CandyShape audioClass={activeClass} size={54} />
                          <p className="mt-3 text-lg font-black">{AUDIO_CONFIG[activeClass].candyName}</p>
                          <p className="mt-1 text-sm text-white/62">
                            {isHarvesting ? "緩衝累積中" : "Harvester paused"}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="relative overflow-hidden rounded-md border border-white/12 bg-white/8 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-black">Friend PC</p>
                        <span className="rounded-md border border-emerald-300/30 bg-emerald-200/16 px-2 py-1 text-xs text-emerald-100">
                          online
                        </span>
                      </div>
                      <div className="relative h-48 overflow-hidden rounded-md border border-white/10 bg-black/28">
                        {friendDrop ? (
                          <div className="friend-drop absolute left-[38%] top-2">
                            <CandyShape
                              audioClass={friendDrop.audioClass}
                              size={58}
                              wrapped={friendDrop.wrapped}
                            />
                          </div>
                        ) : (
                          <div className="grid h-full place-items-center text-center text-sm text-white/54">
                            <span>waiting for broadcast</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-white/72">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span>WebSocket</span>
                          <span className="text-[#7cd7b8]">ready</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span>Social TTL</span>
                          <span>24h</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Mouse events</span>
                          <span>hover candy only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="echo-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#62594e]">The Glass Jar</p>
                <h2 className="text-xl font-black">手機糖果罐</h2>
              </div>
              <StatusPill icon={Smartphone} tone="green">iOS / Android</StatusPill>
            </div>

            <div className="mx-auto w-full max-w-[390px] rounded-[28px] border-[10px] border-[#171412] bg-[#171412] shadow-2xl">
              <div className="relative min-h-[720px] overflow-hidden rounded-[18px] bg-[#fff7e6]">
                {phoneDrop ? (
                  <div className="phone-drop pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2">
                    <CandyShape audioClass={phoneDrop.audioClass} size={60} wrapped />
                  </div>
                ) : null}

                <div className="border-b border-black/10 bg-[#fffaf0] px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#62594e]">Echo Mobile</p>
                      <h3 className="text-lg font-black">工作糖果罐</h3>
                    </div>
                    <Bell aria-hidden className="size-5 text-[#62594e]" />
                  </div>
                  <div className="flex gap-2">
                    {[
                      { name: "Mika", online: true },
                      { name: "Ren", online: false },
                      { name: "You", online: true },
                    ].map((friend) => (
                      <span
                        key={friend.name}
                        className="flex items-center gap-1 rounded-md border border-black/10 bg-white/60 px-2 py-1 text-xs font-semibold"
                      >
                        <span
                          className={`size-2 rounded-full ${friend.online ? "bg-[#2da66f]" : "bg-[#9f988e]"}`}
                        />
                        {friend.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 border-b border-black/10 bg-[#fffaf0] p-2">
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-bold ${jarTab === "jar" ? "bg-[#171412] text-[#fff7e6]" : "text-[#62594e]"}`}
                    type="button"
                    onClick={() => setJarTab("jar")}
                  >
                    我的罐子
                  </button>
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-bold ${jarTab === "feed" ? "bg-[#171412] text-[#fff7e6]" : "text-[#62594e]"}`}
                    type="button"
                    onClick={() => setJarTab("feed")}
                  >
                    辦公桌
                  </button>
                </div>

                {jarTab === "jar" ? (
                  <div className="p-4">
                    <div className={`relative mb-4 h-[400px] overflow-hidden rounded-b-[48px] rounded-t-md border-2 border-black/20 bg-white/48 ${shakeJar ? "jar-shake" : ""}`}>
                      <div className="absolute inset-x-8 top-5 h-4 rounded-full border border-black/12 bg-white/70" />
                      <div className="absolute bottom-4 left-1/2 h-[330px] w-[76%] -translate-x-1/2 rounded-b-[42px] rounded-t-md border border-black/12 bg-[#e9fbff]/54 shadow-inner" />
                      <div className="absolute bottom-8 left-1/2 h-[280px] w-[68%] -translate-x-1/2 overflow-hidden rounded-b-[38px] rounded-t-md">
                        {records.slice(0, 12).map((record, index) => {
                          const left = 8 + ((index * 21) % 58);
                          const bottom = 8 + Math.floor(index / 3) * 46 + (index % 2) * 9;

                          return (
                            <span
                              key={record.id}
                              className="absolute"
                              style={{
                                left: `${left}%`,
                                bottom,
                                transform: `rotate(${(index % 5) * 9 - 12}deg)`,
                              }}
                            >
                              <CandyShape
                                audioClass={record.audioClass}
                                size={record.status === "Wrapped" ? 54 : 48}
                                wrapped={record.status === "Wrapped"}
                              />
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button className="echo-button" type="button" onClick={shakePhoneJar}>
                        <Smartphone aria-hidden className="size-4" />
                        搖一下
                      </button>
                      <button className="echo-button echo-button-primary" type="button" onClick={giveSugar}>
                        <Gift aria-hidden className="size-4" />
                        Give Sugar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[563px] space-y-4 overflow-auto p-4">
                    {feed.map((item) => {
                      const config = AUDIO_CONFIG[item.audioClass];

                      return (
                        <article key={item.id} className="rounded-md border border-black/12 bg-white/70 p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="grid size-9 place-items-center rounded-md bg-[#171412] text-sm font-black text-[#fff7e6]">
                                {item.friend.slice(0, 1)}
                              </span>
                              <div>
                                <p className="text-sm font-black">{item.friend}</p>
                                <p className="text-xs text-[#62594e]">{config.candyName} · {item.createdTime}</p>
                              </div>
                            </div>
                            <CandyShape audioClass={item.audioClass} size={38} wrapped />
                          </div>
                          <ScreenshotMock masks={item.masks} compact />
                          {item.replies.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {item.replies.map((reply, index) => (
                                <p key={`${item.id}-reply-${index}`} className="rounded-md bg-[#f2ead9] px-3 py-2 text-sm">
                                  {reply}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 flex gap-2">
                            <input
                              className="echo-input min-h-9 text-sm"
                              value={replyDrafts[item.id] ?? ""}
                              placeholder="打字回覆"
                              onChange={(event) =>
                                setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                            />
                            <button className="echo-button min-h-9 px-3" type="button" onClick={() => sendReply(item.id)}>
                              <Send aria-hidden className="size-4" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="echo-panel p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#62594e]">Unified Standard</p>
              <h2 className="text-xl font-black">MediaPipe 聲音與環境分類</h2>
              </div>
              <StatusPill icon={Mic} tone="amber">Audio Classifier on device</StatusPill>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {AUDIO_CLASSES.map((audioClass) => {
                const config = AUDIO_CONFIG[audioClass];
                const Icon = CANDY_ICONS[config.icon];

                return (
                  <div key={`standard-${audioClass}`} className="rounded-md border border-black/10 bg-white/54 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon aria-hidden className="size-4" style={{ color: config.color }} />
                        <p className="font-black">{config.label}</p>
                      </div>
                      <CandyShape audioClass={audioClass} size={34} />
                    </div>
                    <dl className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[#62594e]">Candy</dt>
                        <dd className="font-semibold">{config.candyName}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[#62594e]">MediaPipe label</dt>
                        <dd className="font-semibold">{config.mediapipeCategory}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[#62594e]">Min score</dt>
                        <dd className="font-mono">{config.confidence}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[#62594e]">Threshold</dt>
                        <dd className="font-mono">{config.drops ? formatDuration(config.thresholdSec) : "不掉糖"}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 rounded-md bg-[#f2ead9] px-3 py-2 text-xs text-[#62594e]">{config.trigger}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="echo-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-black/10 bg-[#fffaf0]/74 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-[#62594e]">The Archive</p>
                <h2 className="text-xl font-black">Notion Master Database</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill icon={Database}>Route Handler</StatusPill>
                <StatusPill icon={Clock} tone="rose">Wrapped TTL 24h</StatusPill>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#171412] text-[#fff7e6]">
                  <tr>
                    {["Candy_ID", "User_ID", "Audio_Class", "Duration_Sec", "Status", "Screenshot_File", "Created_Time"].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-bold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-black/10 bg-white/55">
                      <td className="px-3 py-3 font-mono text-xs">{record.id}</td>
                      <td className="px-3 py-3">{record.userId}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2">
                          <CandyShape audioClass={record.audioClass} size={24} wrapped={record.status === "Wrapped"} />
                          {record.audioClass}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono">{record.durationSec}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            record.status === "Wrapped"
                              ? "bg-[#ffd57a] text-[#171412]"
                              : "bg-[#e7e0d2] text-[#62594e]"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#62594e]">{record.screenshotFile}</td>
                      <td className="px-3 py-3 font-mono">{record.createdTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {privacyOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#171412]/72 px-4 backdrop-blur-sm">
          <section className="echo-panel w-full max-w-lg bg-[#fffaf0] p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-[#171412] text-[#fff7e6]">
                  <ShieldCheck aria-hidden className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#62594e]">Privacy</p>
                  <h2 className="text-xl font-black">截圖與遮蔽確認</h2>
                </div>
              </div>
              <button className="echo-button min-h-9 px-2.5" type="button" onClick={() => setPrivacyOpen(false)}>
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <p className="text-base leading-7 text-[#302a24]">
              截圖僅會在遮蔽後上傳至您的個人 Notion 資料庫，並於 24 小時後從社交動態中自動銷毀。
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button className="echo-button" type="button" onClick={() => setPrivacyOpen(false)}>
                取消
              </button>
              <button className="echo-button echo-button-primary" type="button" onClick={acceptPrivacy}>
                <Check aria-hidden className="size-4" />
                同意並繼續
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {wrapCandy ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#171412]/82 px-4 py-6 backdrop-blur-sm">
          <section className="echo-panel mx-auto grid w-full max-w-6xl gap-4 bg-[#fffaf0] p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#62594e]">Wrap & Share</p>
                  <h2 className="text-2xl font-black">遮蔽工作畫面</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`echo-button ${maskMode === "block" ? "echo-button-primary" : ""}`}
                    type="button"
                    onClick={() => setMaskMode("block")}
                  >
                    <Square aria-hidden className="size-4" />
                    方塊
                  </button>
                  <button
                    className={`echo-button ${maskMode === "brush" ? "echo-button-primary" : ""}`}
                    type="button"
                    onClick={() => setMaskMode("brush")}
                  >
                    <Paintbrush aria-hidden className="size-4" />
                    筆刷
                  </button>
                </div>
              </div>
              <ScreenshotMock
                masks={masks}
                interactive
                mode={maskMode}
                onAddMask={(mask) => setMasks((current) => [...current, mask])}
              />
            </div>

            <aside className="flex flex-col justify-between gap-4 rounded-md border border-black/10 bg-white/55 p-4">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <CandyShape audioClass={wrapCandy.audioClass} size={58} wrapped />
                  <div>
                    <p className="font-black">{AUDIO_CONFIG[wrapCandy.audioClass].candyName}</p>
                    <p className="font-mono text-sm text-[#62594e]">{formatDuration(wrapCandy.durationSec)}</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="rounded-md bg-[#f2ead9] p-3">
                    <p className="font-bold">Status</p>
                    <p className="text-[#62594e]">包裝糖會新增 Notion Row，並向在線好友廣播掉落事件。</p>
                  </div>
                  <div className="rounded-md bg-[#f2ead9] p-3">
                    <p className="font-bold">遮蔽</p>
                    <p className="text-[#62594e]">{masks.length} 個遮蔽區塊</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <button className="echo-button" type="button" onClick={() => setWrapCandy(null)}>
                  <X aria-hidden className="size-4" />
                  取消
                </button>
                <button className="echo-button echo-button-primary" type="button" onClick={confirmWrap}>
                  <Package aria-hidden className="size-4" />
                  上傳包裝糖
                </button>
              </div>
            </aside>
          </section>
        </div>
      ) : null}
    </main>
  );
}
