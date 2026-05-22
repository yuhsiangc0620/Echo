"use client";

import {
  BarChart3,
  Camera,
  MonitorDown,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import CandyShape from "@/app/_components/candy-shape";
import { MOBILE_USERS, type JarUser } from "@/lib/mobile/mock-data";

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

function JarPreview({ user, active, onSelect }: { user: JarUser; active: boolean; onSelect: () => void }) {
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
      <span className={`w-full truncate text-xs font-black ${active ? "text-[#171412]" : "text-[#62594e]"}`}>
        {user.name}
      </span>
    </button>
  );
}

export default function MobileAppPrototype() {
  const [activeId, setActiveId] = useState(MOBILE_USERS[0].id);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Record<string, string[]>>(
    Object.fromEntries(MOBILE_USERS.map((user) => [user.id, user.messages])),
  );
  const activeUser = useMemo(
    () => MOBILE_USERS.find((user) => user.id === activeId) ?? MOBILE_USERS[0],
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
          <Link
            className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60"
            href="/mobile/data"
            aria-label="Open data page"
          >
            <BarChart3 aria-hidden className="size-4" />
          </Link>
        </header>

        <section className="h-[28svh] min-h-[170px] shrink-0 border-b border-black/10 bg-[#fbf4e6] px-4 py-4">
          <div className="flex h-full snap-x gap-4 overflow-x-auto pb-2">
            {MOBILE_USERS.map((user) => (
              <JarPreview
                key={user.id}
                user={user}
                active={user.id === activeUser.id}
                onSelect={() => setActiveId(user.id)}
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
                <p className="truncate text-xs font-semibold text-[#62594e]">{activeUser.caption}</p>
              </div>
            </div>
            <button className="grid size-9 shrink-0 place-items-center rounded-md border border-black/10 bg-white/60" type="button" aria-label="Reply with camera">
              <Camera aria-hidden className="size-4" />
            </button>
          </div>

          <div className="min-h-[280px] flex-1 px-4">
            <WorkScreenshot tone={activeUser.screenshotTone} />
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3">
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
