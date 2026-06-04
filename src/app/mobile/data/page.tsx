import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import CandyShape, { type CandyShapeKind } from "@/app/_components/candy-shape";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  type CandyAudioClass,
} from "@/lib/candy/catalog";

export const revalidate = 60;

const PAGE_BG = "var(--paper)";

// ── Types ─────────────────────────────────────────────────────────────────────

type SoundMix = { cls: CandyAudioClass; weight: number };
type Drop = { i: number; shape: CandyShapeKind; tones: SoundMix[] };

type DailyCandy = {
  primaryAudioClass: string;
  audioClasses: string[];
  createdTime: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidAudioClass(s: string): s is CandyAudioClass {
  return AUDIO_CLASSES.includes(s as CandyAudioClass);
}

function toCandyAudioClass(s: string): CandyAudioClass {
  return isValidAudioClass(s) ? s : "Keyboard_heavy";
}

// Same shape mapping as candy-shape.tsx
const SHAPE_BY_CLASS: Partial<Record<CandyAudioClass, Exclude<CandyShapeKind, "circle">>> = {
  Keyboard_heavy: "spiky",
  Sigh: "pea",
  Mouse_click: "donut",
};

const f = (n: number) => Math.round(n * 100) / 100;

// ── Notion fetch ──────────────────────────────────────────────────────────────

// Parse YYYY-MM-DD in local time
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function getTodayFeed(dateStr: string, userId?: string): Promise<DailyCandy[]> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_CANDY_DATABASE_ID;
  if (!token || !databaseId) return [];

  const todayStart = parseLocalDate(dateStr);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  // Scope the chart to a single user when a userId is supplied (User_ID is a
  // rich_text property in Notion). Without it the chart would aggregate every
  // user's candies, which is not what the per-user data page wants.
  const filters: unknown[] = [
    { timestamp: "created_time", created_time: { on_or_after: todayStart.toISOString() } },
    { timestamp: "created_time", created_time: { on_or_before: todayEnd.toISOString() } },
  ];
  if (userId) {
    filters.push({ property: "User_ID", rich_text: { equals: userId } });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: {
          and: filters,
        },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 100,
      }),
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        created_time?: string;
        properties?: Record<
          string,
          {
            select?: { name?: string } | null;
            multi_select?: Array<{ name?: string }>;
          }
        >;
      }>;
    };

    return (data.results ?? []).map((page) => {
      const props = page.properties ?? {};
      const primaryAudioClass = props.Primary_Audio_Class?.select?.name ?? "Keyboard_heavy";
      const audioClasses = (props.Audio_Classes?.multi_select ?? [])
        .map((o) => o.name ?? "")
        .filter(Boolean);
      return {
        primaryAudioClass,
        audioClasses: Array.from(new Set([primaryAudioClass, ...audioClasses])),
        createdTime: page.created_time ?? new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// ── Chart data ────────────────────────────────────────────────────────────────

function buildActivity(candies: DailyCandy[]) {
  const n = 48; // 48 × 30-min buckets = 24h
  // Start with a low flat baseline
  const values = Array.from({ length: n }, () => 0.08);
  const drops: Drop[] = [];

  for (const candy of candies) {
    const dt = new Date(candy.createdTime);
    const fraction = (dt.getHours() * 60 + dt.getMinutes()) / (24 * 60);
    const i = Math.min(n - 1, Math.round(fraction * (n - 1)));

    // Gaussian bump centred on this candy's time slot
    for (let j = 0; j < n; j++) {
      const dist = Math.abs(j - i);
      const bump = 0.68 * Math.exp(-(dist * dist) / 3.5);
      values[j] = Math.max(values[j], 0.08 + bump);
    }

    // Build sound mix with equal weights from audioClasses
    const primary = toCandyAudioClass(candy.primaryAudioClass);
    const classes = candy.audioClasses
      .filter(isValidAudioClass)
      .map((c) => c as CandyAudioClass);
    const weight = 1 / (classes.length || 1);
    const tones: SoundMix[] = (classes.length > 0 ? classes : [primary]).map((cls) => ({
      cls,
      weight,
    }));

    drops.push({ i, shape: SHAPE_BY_CLASS[primary] ?? "circle", tones });
  }

  return { values, drops };
}

// ── Gradient helpers ──────────────────────────────────────────────────────────

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
  const sorted = [...drops].sort((a, b) => a.i - b.i);
  if (!sorted.length) return [];

  return sorted.flatMap((drop, index) => {
    const offset = (drop.i / (pointCount - 1)) * 100;
    const prevOffset = index === 0 ? 0 : (sorted[index - 1].i / (pointCount - 1)) * 100;
    const nextOffset =
      index === sorted.length - 1 ? 100 : (sorted[index + 1].i / (pointCount - 1)) * 100;
    const start = index === 0 ? 0 : (prevOffset + offset) / 2;
    const end = index === sorted.length - 1 ? 100 : (offset + nextOffset) / 2;
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

// ── ActivityChart ─────────────────────────────────────────────────────────────

function ActivityChart({ candies, dateStr, prevDate, nextDate, isToday, userId }: {
  candies: DailyCandy[];
  dateStr: string;
  prevDate: string;
  nextDate: string;
  isToday: boolean;
  userId?: string;
}) {
  // Preserve the user scope across day navigation.
  const userParam = userId ? `&userId=${encodeURIComponent(userId)}` : "";
  const W = 320;
  const H = 100;
  const padX = 8;
  const padY = 14;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const baseY = H - padY;

  const { values, drops } = buildActivity(candies);
  const n = values.length;

  const xs = values.map((_, i) => padX + (i / (n - 1)) * innerW);
  const ys = values.map((v) => padY + (1 - v) * innerH);

  let pathD = `M ${f(xs[0])} ${f(ys[0])}`;
  for (let i = 1; i < n; i++) {
    const cp1x = xs[i - 1] + (xs[i] - xs[i - 1]) / 3;
    const cp2x = xs[i] - (xs[i] - xs[i - 1]) / 3;
    pathD += ` C ${f(cp1x)} ${f(ys[i - 1])} ${f(cp2x)} ${f(ys[i])} ${f(xs[i])} ${f(ys[i])}`;
  }
  const fillD = `${pathD} L ${f(xs[n - 1])} ${f(baseY)} L ${f(xs[0])} ${f(baseY)} Z`;

  const hourTicks = [0, 6, 12, 18, 24];
  const toneStops = timelineStopsFromDrops(drops, n);
  const count = candies.length;

  // Format date label: today / 昨天 / MM/DD
  const todayStr = formatLocalDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);
  const dateLabel =
    dateStr === todayStr ? "today" :
    dateStr === yesterdayStr ? "昨天" :
    dateStr.slice(5).replace("-", "/");

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="echo-eyebrow">{dateLabel} · 工作聲音</p>
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-medium text-[var(--ink-soft)] mr-1">
            {count > 0 ? `${count} 顆糖果` : "無紀錄"}
          </p>
          <Link
            href={`/mobile/data?date=${prevDate}${userParam}`}
            className="grid size-6 place-items-center rounded text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-mid)] transition-colors"
            aria-label="前一天"
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </Link>
          <Link
            href={isToday ? "#" : `/mobile/data?date=${nextDate}${userParam}`}
            className={`grid size-6 place-items-center rounded transition-colors ${isToday ? "opacity-20 pointer-events-none" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-mid)]"}`}
            aria-label="後一天"
            aria-disabled={isToday}
          >
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
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
                  <stop offset="0%" stopColor={toneStops[0].color} stopOpacity="0.22" />
                  {toneStops.map((stop, k) => (
                    <stop key={k} offset={`${f(stop.offset)}%`} stopColor={stop.color} stopOpacity="0.30" />
                  ))}
                  <stop offset="100%" stopColor={toneStops[toneStops.length - 1].color} stopOpacity="0.22" />
                </>
              ) : (
                <stop offset="0%" stopColor="var(--ribbon)" stopOpacity="0.14" />
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

          {/* Gradient fill under curve */}
          <rect x="0" y="0" width={W} height={H} fill="url(#actToneGrad)" mask="url(#actFillFade)" />

          {/* Activity line */}
          <path
            d={pathD}
            stroke="var(--ink)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Vertical tick at each candy */}
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
              opacity="0.38"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Candy shapes overlaid on the SVG at the correct time position */}
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
              size={12}
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

// ── Shape / Color index ───────────────────────────────────────────────────────

const SHAPES: { kind: CandyShapeKind; label: string; rep: CandyAudioClass; sample: string; size?: number }[] = [
  { kind: "circle", label: "圓形",  rep: "Speech",         sample: "環境聲、靜默", size: 24 },
  { kind: "pea",    label: "豌豆",  rep: "Sigh",           sample: "長嘆氣" },
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
                style={{ background: config.color, boxShadow: `0 0 8px ${config.color}` }}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MobileDataPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; userId?: string }>;
}) {
  const params = await searchParams;
  const todayStr = formatLocalDate(new Date());
  const dateStr = params.date ?? todayStr;
  const userId = params.userId;
  const isToday = dateStr === todayStr;

  const dateObj = parseLocalDate(dateStr);
  const prevObj = new Date(dateObj);
  prevObj.setDate(prevObj.getDate() - 1);
  const nextObj = new Date(dateObj);
  nextObj.setDate(nextObj.getDate() + 1);
  const prevDate = formatLocalDate(prevObj);
  const nextDate = formatLocalDate(nextObj);

  const candies = await getTodayFeed(dateStr, userId);

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
          <Link
            className="echo-press absolute right-3 text-[11px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            href="/mobile/data/overview"
          >
            全部數據
          </Link>
        </header>

        <div className="space-y-9 px-5 pt-4 pb-10">
          <ActivityChart
            candies={candies}
            dateStr={dateStr}
            prevDate={prevDate}
            nextDate={nextDate}
            isToday={isToday}
            userId={userId}
          />
          <ShapeIndex />
          <ColorIndex />
        </div>
      </section>
    </main>
  );
}
