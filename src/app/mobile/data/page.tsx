import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import CandyShape, { type CandyShapeKind } from "@/app/_components/candy-shape";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  type CandyAudioClass,
} from "@/lib/candy/catalog";

const PAGE_BG = "var(--paper)";

// Deterministic PRNG so the chart is stable per seed (no hydration drift).
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
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
const f = (n: number) => Math.round(n * 100) / 100;

type SoundMix = { cls: CandyAudioClass; weight: number };
type Drop = { i: number; shape: CandyShapeKind; tones: SoundMix[] };

function gradientFromSoundMix(tones: SoundMix[]) {
  let cursor = 0;
  const stops = tones.flatMap(({ cls, weight }) => {
    const start = cursor;
    cursor += weight;
    const color = AUDIO_CONFIG[cls].color;

    return [`${color} ${f(start * 100)}%`, `${color} ${f(cursor * 100)}%`];
  });

  return `linear-gradient(180deg, ${stops.join(", ")})`;
}

function timelineStopsFromDrops(drops: Drop[], pointCount: number) {
  const sortedDrops = [...drops].sort((a, b) => a.i - b.i);

  if (!sortedDrops.length) {
    return [];
  }

  return sortedDrops.flatMap((drop, index) => {
    const offset = (drop.i / (pointCount - 1)) * 100;
    const previousOffset = index === 0 ? 0 : (sortedDrops[index - 1].i / (pointCount - 1)) * 100;
    const nextOffset =
      index === sortedDrops.length - 1 ? 100 : (sortedDrops[index + 1].i / (pointCount - 1)) * 100;
    const start = index === 0 ? 0 : (previousOffset + offset) / 2;
    const end = index === sortedDrops.length - 1 ? 100 : (offset + nextOffset) / 2;
    const width = end - start;
    let cursor = start;

    return drop.tones.flatMap(({ cls, weight }) => {
      const color = AUDIO_CONFIG[cls].color;
      const stopStart = cursor;
      cursor += width * weight;

      return [
        { color, offset: stopStart },
        { color, offset: cursor },
      ];
    });
  });
}

function buildActivity(seed: string) {
  const n = 48;
  const rand = mulberry32(hashString(seed));
  const values = Array.from({ length: n }, () => 0.07 + rand() * 0.01);
  const drops: Drop[] = [];

  return { values, drops };
}

function ActivityChart() {
  const W = 320;
  const H = 100;
  const padX = 8;
  const padY = 14;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const baseY = H - padY;

  const { values, drops } = buildActivity("empty");
  const n = values.length;

  const xs = values.map((_, i) => padX + (i / (n - 1)) * innerW);
  const ys = values.map((v) => padY + (1 - v) * innerH);

  let pathD = `M ${f(xs[0])} ${f(ys[0])}`;
  for (let i = 1; i < n; i++) {
    const cp1x = xs[i - 1] + (xs[i] - xs[i - 1]) / 3;
    const cp1y = ys[i - 1];
    const cp2x = xs[i] - (xs[i] - xs[i - 1]) / 3;
    const cp2y = ys[i];
    pathD += ` C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(xs[i])} ${f(ys[i])}`;
  }
  const fillD = `${pathD} L ${f(xs[n - 1])} ${f(baseY)} L ${f(xs[0])} ${f(baseY)} Z`;

  // hour ticks at every 4 hours assuming 24h span across n points
  const hourTicks = [0, 6, 12, 18, 24];

  const toneStops = timelineStopsFromDrops(drops, n);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="echo-eyebrow">today · 工作聲音</p>
        <p className="text-[10px] font-medium text-[var(--ink-soft)]">等待桌面資料</p>
      </div>
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label="今日工作聲音活動圖"
        >
          <defs>
            <linearGradient id="actToneGrad" x1="0" y1="0" x2="1" y2="0">
              {toneStops.length ? (
                <>
                  <stop offset="0%" stopColor={toneStops[0].color} stopOpacity="0.18" />
                  {toneStops.map((stop, k) => (
                    <stop key={k} offset={`${f(stop.offset)}%`} stopColor={stop.color} stopOpacity="0.26" />
                  ))}
                  <stop offset="100%" stopColor={toneStops[toneStops.length - 1].color} stopOpacity="0.18" />
                </>
              ) : (
                <stop offset="0%" stopColor="var(--ribbon)" stopOpacity="0.2" />
              )}
            </linearGradient>
            <linearGradient id="actFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="actFillFade">
              <path d={fillD} fill="url(#actFade)" />
            </mask>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="url(#actToneGrad)" mask="url(#actFillFade)" />
          <path
            d={pathD}
            stroke="var(--ink)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {drops.map(({ i }, k) => (
            <line
              key={k}
              x1={f(xs[i])}
              y1={f(ys[i])}
              x2={f(xs[i])}
              y2={f(baseY)}
              stroke="var(--ink-soft)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              opacity="0.34"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {drops.map(({ i, shape, tones }, k) => (
          <span
            key={k}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(xs[i] / W) * 100}%`,
              top: `${(ys[i] / H) * 100}%`,
            }}
          >
            <CandyShape
              audioClass={tones[0].cls}
              gradient={gradientFromSoundMix(tones)}
              shape={shape}
              size={11}
            />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between px-1 text-[9px] font-medium tracking-wider text-[var(--ink-soft)]">
        {hourTicks.map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}

const SHAPES: { kind: CandyShapeKind; label: string; rep: CandyAudioClass; sample: string; size?: number }[] = [
  { kind: "circle", label: "圓形", rep: "Speech", sample: "環境聲、靜默", size: 24 },
  { kind: "pea",    label: "豌豆",  rep: "Sigh",          sample: "長嘆氣" },
  { kind: "spiky",  label: "河豚",  rep: "Keyboard_heavy", sample: "急躁鍵盤" },
  { kind: "donut",  label: "甜甜圈", rep: "Mouse_click",   sample: "滑鼠連擊" },
];

function ShapeIndex() {
  return (
    <div>
      <p className="echo-eyebrow">形狀 · 4 種</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {SHAPES.map(({ kind, label, rep, sample, size = 44 }) => (
          <div key={kind} className="flex flex-col items-center gap-1.5 py-2">
            <div className="grid h-12 place-items-center">
              <CandyShape audioClass={rep} shape={kind} size={size} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--ink)]">{label}</p>
            <p className="text-center text-[9px] leading-tight text-[var(--ink-soft)]">{sample}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorIndex() {
  return (
    <div>
      <p className="echo-eyebrow">聲音顏色 · {AUDIO_CLASSES.length} 種</p>
      <ul className="mt-3 divide-y divide-[var(--rule)]">
        {AUDIO_CLASSES.map((cls) => {
          const config = AUDIO_CONFIG[cls];
          return (
            <li key={cls} className="flex items-center gap-3 py-2.5">
              <span
                className="size-[18px] shrink-0 rounded-full"
                style={{
                  background: config.color,
                  boxShadow: `0 0 8px ${config.color}`,
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{config.label}</p>
                <p className="truncate text-[11px] text-[var(--ink-soft)]">{config.mediapipeCategory}</p>
              </div>
              <span className="text-[10px] font-medium tracking-wider text-[var(--ink-soft)] uppercase">
                {config.short}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function MobileDataPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto min-h-screen w-full max-w-[480px]" style={{ background: PAGE_BG }}>
        <header className="relative flex h-12 items-center justify-center px-4">
          <Link
            className="echo-press absolute left-3 grid size-8 place-items-center text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            href="/mobile"
            aria-label="返回"
          >
            <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={1.5} />
          </Link>
          <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] lowercase">
            candy <span className="echo-underline">index.</span>
          </h1>
        </header>

        <div className="space-y-9 px-5 pt-4 pb-10">
          <ActivityChart />
          <ShapeIndex />
          <ColorIndex />
        </div>
      </section>
    </main>
  );
}
