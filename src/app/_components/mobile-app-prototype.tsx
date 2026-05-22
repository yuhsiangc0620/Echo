"use client";

import {
  Bell,
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import CandyShape from "@/app/_components/candy-shape";
import { type CandyAudioClass } from "@/lib/candy/catalog";

type JarUser = {
  id: string;
  name: string;
  handle: string;
  online: boolean;
  accent: string;
  jar: CandyAudioClass[];
  screenshotTone: "code" | "doc" | "chat";
  caption: string;
  messages: string[];
};

const USERS: JarUser[] = [
  {
    id: "you",
    name: "You",
    handle: "local jar",
    online: true,
    accent: "#ef6f7f",
    jar: ["Keyboard_heavy", "Mouse_click", "Speech", "Air_conditioner"],
    screenshotTone: "code",
    caption: "40 分鐘鍵盤糖剛進罐，畫面已遮蔽。",
    messages: ["Mika: 這張很像 deadline 前五分鐘", "Ren: 我看到那個黑塊，懂。"],
  },
  {
    id: "mika",
    name: "Mika",
    handle: "design desk",
    online: true,
    accent: "#65c7df",
    jar: ["Sigh", "Music", "Speech", "Door_knock"],
    screenshotTone: "doc",
    caption: "剛包了一顆雲朵軟糖。",
    messages: ["You: 先喝水，剩下慢慢拆。"],
  },
  {
    id: "ren",
    name: "Ren",
    handle: "ops corner",
    online: false,
    accent: "#7cd7b8",
    jar: ["Mouse_click", "Traffic", "Keyboard_heavy"],
    screenshotTone: "chat",
    caption: "滑鼠連擊累積中，手機通知待讀。",
    messages: ["Mika: 這種點擊聲我也有。"],
  },
  {
    id: "jia",
    name: "Jia",
    handle: "night shift",
    online: true,
    accent: "#f5b642",
    jar: ["Music", "Air_conditioner", "Keyboard_heavy", "Sigh"],
    screenshotTone: "code",
    caption: "背景音樂很多，但還沒有觸發工作糖。",
    messages: [],
  },
];

function WorkScreenshot({ tone }: { tone: JarUser["screenshotTone"] }) {
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
          {Array.from({ length: 12 }).map((_, index) => (
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
          <div className="h-28 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="mb-3 h-2 w-20 rounded-sm" style={{ background: palette[0] }} />
            <div className="mb-2 h-2 w-5/6 rounded-sm bg-white/22" />
            <div className="h-2 w-2/3 rounded-sm" style={{ background: palette[2] }} />
          </div>
        </div>
      </div>
      <span className="absolute left-[14%] top-[46%] z-20 h-8 w-[42%] rounded-[3px] bg-black" />
      <span className="absolute right-[9%] top-[30%] z-20 h-7 w-[34%] rounded-[3px] bg-black" />
      <span className="absolute bottom-[18%] right-[18%] z-20 h-7 w-[28%] rounded-[3px] bg-black" />
    </div>
  );
}

function JarPreview({ user, active, onSelect }: { user: JarUser; active: boolean; onSelect: () => void }) {
  return (
    <button
      className={`h-full min-w-[148px] snap-center rounded-lg border p-3 text-left transition ${
        active ? "border-black/55 bg-[#fffaf0] shadow-[0_14px_30px_rgba(23,20,18,.14)]" : "border-black/10 bg-white/50"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black">{user.name}</span>
        <span className={`size-2 rounded-full ${user.online ? "bg-[#2da66f]" : "bg-[#9f988e]"}`} />
      </div>
      <div className="relative h-[72px] overflow-hidden rounded-b-2xl rounded-t-md border border-black/12 bg-[#e9fbff]/70">
        {user.jar.slice(0, 5).map((audioClass, index) => (
          <span
            key={`${user.id}-${audioClass}-${index}`}
            className="absolute"
            style={{
              left: `${10 + ((index * 21) % 56)}%`,
              bottom: `${6 + (index % 2) * 20}px`,
              transform: `rotate(${index * 8 - 14}deg)`,
            }}
          >
            <CandyShape audioClass={audioClass} size={30} wrapped={index === 0} />
          </span>
        ))}
      </div>
      <p className="mt-2 truncate text-xs font-semibold text-[#62594e]">{user.handle}</p>
    </button>
  );
}

export default function MobileAppPrototype() {
  const [activeId, setActiveId] = useState(USERS[0].id);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Record<string, string[]>>(
    Object.fromEntries(USERS.map((user) => [user.id, user.messages])),
  );
  const activeUser = useMemo(
    () => USERS.find((user) => user.id === activeId) ?? USERS[0],
    [activeId],
  );
  const activeMessages = messages[activeUser.id] ?? [];

  function sendMessage() {
    const text = draft.trim();

    if (!text) {
      return;
    }

    setMessages((current) => ({
      ...current,
      [activeUser.id]: [...(current[activeUser.id] ?? []), `You: ${text}`],
    }));
    setDraft("");
  }

  return (
    <main className="min-h-screen bg-[#171412] text-[#171412]">
      <section className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col overflow-hidden bg-[#f6f1e7]">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-[#fffaf0] px-4">
          <Link className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60" href="/">
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <div className="text-center">
            <p className="text-xs font-bold text-[#62594e]">Echo Mobile</p>
            <h1 className="text-base font-black">辦公桌糖果罐</h1>
          </div>
          <button className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60" type="button" aria-label="Notifications">
            <Bell aria-hidden className="size-4" />
          </button>
        </header>

        <section className="h-[30svh] min-h-[190px] shrink-0 border-b border-black/10 bg-[#fbf4e6] px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#62594e]">Glass jars</p>
              <h2 className="text-lg font-black">朋友的罐子</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white/60 px-2 py-1 text-xs font-bold">
              <Sparkles aria-hidden className="size-3.5" />
              {USERS.filter((user) => user.online).length} online
            </span>
          </div>
          <div className="flex h-[calc(100%-48px)] snap-x gap-3 overflow-x-auto pb-2">
            {USERS.map((user) => (
              <JarPreview
                key={user.id}
                user={user}
                active={user.id === activeUser.id}
                onSelect={() => setActiveId(user.id)}
              />
            ))}
          </div>
        </section>

        <section className="flex h-[calc(70svh-56px)] min-h-[430px] flex-1 flex-col bg-[#f6f1e7]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="grid size-10 place-items-center rounded-md text-sm font-black text-[#fff7e6]"
                style={{ background: activeUser.accent }}
              >
                {activeUser.name.slice(0, 1)}
              </span>
              <div>
                <p className="font-black">{activeUser.name}</p>
                <p className="text-xs font-semibold text-[#62594e]">{activeUser.caption}</p>
              </div>
            </div>
            <button className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60" type="button" aria-label="Attach screenshot">
              <ImageIcon aria-hidden className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 px-4">
            <WorkScreenshot tone={activeUser.screenshotTone} />
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3">
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {activeUser.jar.slice(0, 4).map((audioClass, index) => (
                <span
                  key={`${activeUser.id}-tag-${audioClass}-${index}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-black/10 bg-white/64 px-2.5 py-1 text-xs font-bold"
                >
                  <CandyShape audioClass={audioClass} size={22} wrapped={index === 0} />
                  {audioClass.replace("_", " ")}
                </span>
              ))}
            </div>

            <div className="mb-3 max-h-24 space-y-2 overflow-auto">
              {activeMessages.length ? (
                activeMessages.map((message, index) => (
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
              <button className="grid size-11 shrink-0 place-items-center rounded-md border border-black/12 bg-[#fffaf0]" type="button" aria-label="Camera">
                <Camera aria-hidden className="size-4" />
              </button>
              <div className="relative flex-1">
                <MessageCircle aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62594e]" />
                <input
                  className="h-11 w-full rounded-md border border-black/12 bg-[#fffaf0] pl-10 pr-3 text-sm font-semibold outline-none focus:border-black/50"
                  value={draft}
                  placeholder={`回覆 ${activeUser.name}`}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                />
              </div>
              <button className="grid size-11 shrink-0 place-items-center rounded-md bg-[#171412] text-[#fff7e6]" type="button" onClick={sendMessage} aria-label="Send">
                <Send aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
