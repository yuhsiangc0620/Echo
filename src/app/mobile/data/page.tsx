import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import CandyShape from "@/app/_components/candy-shape";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  getCandyVariantName,
  type CandyAudioClass,
  type CandyModifier,
} from "@/lib/candy/catalog";
import { MOBILE_USERS } from "@/lib/mobile/mock-data";

const WORK_CLASSES = AUDIO_CLASSES.filter((c) => AUDIO_CONFIG[c].role === "work");
const AMBIENT_CLASSES = AUDIO_CLASSES.filter((c) => AUDIO_CONFIG[c].role === "ambient");
const QUIET_CLASSES = AUDIO_CLASSES.filter((c) => AUDIO_CONFIG[c].role === "quiet");

const MODIFIERS: { key: CandyModifier; label: string }[] = [
  { key: "default", label: "純淨" },
  { key: "music", label: "音樂" },
  { key: "speech", label: "人聲" },
  { key: "cold", label: "冷氣" },
  { key: "outdoor", label: "戶外" },
  { key: "quiet", label: "靜謐" },
];

const PAGE_BG = "var(--paper)";
const CATALOG_CARD = "rounded-[18px] border border-[var(--rule)] bg-white/60";
const SOFT_SHADOW = "0 18px 48px rgba(28,25,22,.045)";

function formatThreshold(secs: number) {
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} 分鐘`;
  return `${Math.round(mins / 60)} 小時`;
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <p className="echo-eyebrow">{title}</p>
      <p className="mt-1 text-[12px] font-medium leading-snug text-[var(--ink-muted)]">{subtitle}</p>
    </div>
  );
}

function WorkCandyCard({ audioClass }: { audioClass: CandyAudioClass }) {
  const config = AUDIO_CONFIG[audioClass];

  return (
    <article className={`${CATALOG_CARD} p-4`} style={{ boxShadow: SOFT_SHADOW }}>
      <div className="mb-4 flex items-center gap-4">
        <CandyShape audioClass={audioClass} size={76} />
        <div className="min-w-0">
          <p className="font-display text-[24px] italic leading-none text-[var(--ink)]">{config.candyName}</p>
          <p className="mt-1 text-sm font-medium text-[var(--ink-muted)]">{config.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)]">
              累積 {formatThreshold(config.thresholdSec)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{
                background: "var(--ribbon)",
              }}
            >
              觸發掉落
            </span>
          </div>
        </div>
      </div>

      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="h-px flex-1 bg-[var(--rule)]" />
        <p className="echo-eyebrow">音場光譜</p>
        <span className="h-px flex-1 bg-[var(--rule)]" />
      </div>
      <p className="mb-3 text-[11px] font-medium leading-relaxed text-[var(--ink-muted)]">
        工作期間偵測到的環境聲組合，決定這顆糖的最終外觀
      </p>

      <div className="grid grid-cols-2 gap-2">
        {MODIFIERS.map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--rule-soft)] bg-[var(--paper)] py-3"
          >
            <CandyShape audioClass={audioClass} size={42} modifier={key} />
            <p className="text-[10px] font-semibold text-[var(--ink)]">{label}</p>
            <p className="px-1 text-center text-[9px] font-medium leading-tight text-[var(--ink-soft)]">
              {getCandyVariantName(audioClass, key)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function AmbientCandyCard({ audioClass }: { audioClass: CandyAudioClass }) {
  const config = AUDIO_CONFIG[audioClass];

  return (
    <article className={`${CATALOG_CARD} flex items-center gap-3 p-3`} style={{ boxShadow: SOFT_SHADOW }}>
      <CandyShape audioClass={audioClass} size={54} />
      <div className="min-w-0">
        <p className="truncate font-display text-[18px] italic leading-tight text-[var(--ink)]">{config.candyName}</p>
        <p className="truncate text-xs font-medium text-[var(--ink-muted)]">{config.label}</p>
        <span className="mt-1 inline-block rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-muted)]">
          環境記錄
        </span>
      </div>
    </article>
  );
}

export default function MobileDataPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto min-h-screen w-full max-w-[480px]" style={{ background: PAGE_BG }}>
        <header className="relative flex h-14 items-center justify-between border-b border-[var(--rule)] px-4">
          <span
            className="absolute inset-x-5 bottom-2 h-[3px]"
            style={{
              background:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 4' preserveAspectRatio='none'><path d='M1 2 Q 25 0 50 2 T 99 2' fill='none' stroke='%23ff1f63' stroke-width='1.2' stroke-linecap='round'/></svg>\") center/100% 100% no-repeat",
            }}
          />
          <Link
            className="echo-press grid size-9 place-items-center text-[var(--ink-muted)]"
            href="/mobile"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="font-display text-[22px] italic text-[var(--ink)]">candy index</h1>
          <span className="size-9" />
        </header>

        <div className="space-y-9 px-5 py-6">
          <section>
            <SectionLabel
              title="工作糖果 · 3 種"
              subtitle="累積特定工作聲達門檻後掉落，外觀由音場決定"
            />
            <div className="space-y-3">
              {WORK_CLASSES.map((audioClass) => (
                <WorkCandyCard key={audioClass} audioClass={audioClass} />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel
              title="環境糖果 · 6 種"
              subtitle="記錄工作場景脈絡，影響光譜但不直接掉落"
            />
            <div className="grid grid-cols-2 gap-2">
              {AMBIENT_CLASSES.map((audioClass) => (
                <AmbientCandyCard key={audioClass} audioClass={audioClass} />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel
              title="靜默糖果 · 1 種"
              subtitle="低活動狀態記錄，不觸發掉落"
            />
            <div className="grid grid-cols-2 gap-2">
              {QUIET_CLASSES.map((audioClass) => (
                <AmbientCandyCard key={audioClass} audioClass={audioClass} />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel title="成員糖果罐" subtitle="本週各成員收集的糖果" />
            <div className="space-y-3">
              {MOBILE_USERS.map((user) => (
                <article
                  key={user.id}
                  className={`${CATALOG_CARD} p-4`}
                  style={{ boxShadow: SOFT_SHADOW }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-black text-white"
                        style={{
                          background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${user.accent} 45%, #fff 55%), ${user.accent} 76%)`,
                          boxShadow: `0 8px 16px color-mix(in srgb, ${user.accent} 22%, transparent)`,
                        }}
                      >
                        {user.name.slice(0, 1)}
                      </span>
                      <div>
                        <p className="font-display text-[20px] italic leading-tight text-[var(--ink)]">{user.name}</p>
                        <p className="text-xs font-medium text-[var(--ink-soft)]">{user.handle}</p>
                      </div>
                    </div>
                    <span
                      className="size-2.5 rounded-full"
                      style={{
                        background: user.online ? "var(--ribbon)" : "var(--rule)",
                        boxShadow: user.online
                          ? "0 0 0 4px rgba(255,31,99,.08)"
                          : "none",
                      }}
                    />
                  </div>
                  {user.jar.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {user.jar.map((audioClass, index) => (
                        <div key={`${user.id}-${audioClass}-${index}`} className="flex flex-col items-center gap-1">
                          <CandyShape audioClass={audioClass} size={46} wrapped={index === 0} />
                          <span className="text-[10px] font-medium text-[var(--ink-soft)]">
                            {AUDIO_CONFIG[audioClass].short}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-[var(--ink-muted)]">罐子還是空的</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
