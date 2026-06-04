import CandyShape, { type CandyShapeKind } from "@/app/_components/candy-shape";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  type CandyAudioClass,
} from "@/lib/candy/catalog";

export const revalidate = 60;

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const NOTION_SOURCE_DATABASE_ID = "368a7f1b413c80e9bfd7ca9001026462";
const DATE_COLUMNS = [
  "2026-05-31",
  "2026-06-01",
  "2026-06-02",
  "2026-06-03",
  "2026-06-04",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type OverviewCandy = {
  userId: string;
  primaryAudioClass: string;
  audioClasses: string[];
  createdTime: string;
  screenshotUrl: string | null;
};

type DayBucket = {
  dateStr: string;
  candies: OverviewCandy[];
  countByClass: Map<CandyAudioClass, number>;
  total: number;
};

type UserBucket = {
  userId: string;
  total: number;
  maxDay: number;
  days: DayBucket[];
  dayMap: Map<string, DayBucket>;
};

type NotionFetchResult = {
  candies: OverviewCandy[];
  error: string | null;
};

type SoundMix = { cls: CandyAudioClass; weight: number };
type CandyDrop = {
  candy: OverviewCandy;
  cls: CandyAudioClass;
  x: number;
  tones: SoundMix[];
  screenshotUrl: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidAudioClass(s: string): s is CandyAudioClass {
  return AUDIO_CLASSES.includes(s as CandyAudioClass);
}

function toCandyAudioClass(s: string): CandyAudioClass {
  return isValidAudioClass(s) ? s : "Keyboard_heavy";
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace("-", "/");
}

function displayNameFor(userId: string): string {
  const cleaned = userId.replace(/^user_/, "").replace(/[-_]/g, " ").trim();
  return cleaned || userId || "匿名用戶";
}

function initialsFor(userId: string): string {
  return displayNameFor(userId)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";
}

function f(n: number): number {
  return Math.round(n * 100) / 100;
}

const SHAPE_BY_CLASS: Partial<Record<CandyAudioClass, Exclude<CandyShapeKind, "circle">>> = {
  Keyboard_heavy: "spiky",
  Sigh: "pea",
  Mouse_click: "donut",
};

function shapeFor(cls: CandyAudioClass): CandyShapeKind {
  return SHAPE_BY_CLASS[cls] ?? "circle";
}

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

// ── Notion fetch (all candies, paginated) ─────────────────────────────────────

async function getAllCandies(): Promise<NotionFetchResult> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_CANDY_DATABASE_ID || NOTION_SOURCE_DATABASE_ID;
  if (!token) {
    return {
      candies: [],
      error: "需要設定 NOTION_TOKEN，並將 integration 分享到指定的 Notion database。",
    };
  }

  const all: OverviewCandy[] = [];
  let cursor: string | undefined;

  try {
    do {
      const body: Record<string, unknown> = {
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 100,
      };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(body),
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        return {
          candies: all,
          error: `Notion query failed: ${res.status} ${res.statusText}. 請確認 integration 已分享給 ${NOTION_SOURCE_DATABASE_ID}。`,
        };
      }

      const data = (await res.json()) as {
        results?: Array<{
          created_time?: string;
          properties?: Record<
            string,
            {
              select?: { name?: string } | null;
              multi_select?: Array<{ name?: string }>;
              rich_text?: Array<{ plain_text?: string }>;
              files?: Array<{ file?: { url?: string }; external?: { url?: string } }>;
            }
          >;
        }>;
        has_more?: boolean;
        next_cursor?: string;
      };

      for (const page of data.results ?? []) {
        const props = page.properties ?? {};
        const userId = props.User_ID?.rich_text?.[0]?.plain_text || "unknown-user";
        const primaryAudioClass = props.Primary_Audio_Class?.select?.name ?? "Keyboard_heavy";
        const audioClasses = (props.Audio_Classes?.multi_select ?? [])
          .map((o) => o.name ?? "")
          .filter(Boolean);
        const file = props.Screenshot_File?.files?.[0];
        const screenshotUrl = file?.file?.url ?? file?.external?.url ?? null;

        all.push({
          userId,
          primaryAudioClass,
          audioClasses: Array.from(new Set([primaryAudioClass, ...audioClasses])),
          createdTime: page.created_time ?? new Date().toISOString(),
          screenshotUrl,
        });
      }

      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
  } catch (error) {
    return {
      candies: all,
      error: error instanceof Error ? error.message : "Notion query failed.",
    };
  }

  return { candies: all, error: null };
}

// ── Grouping ──────────────────────────────────────────────────────────────────

function groupByUserAndDay(candies: OverviewCandy[]): UserBucket[] {
  const users = new Map<string, Map<string, DayBucket>>();

  for (const candy of candies) {
    const dateStr = formatLocalDate(new Date(candy.createdTime));
    if (!DATE_COLUMNS.includes(dateStr)) continue;

    let dayMap = users.get(candy.userId);
    if (!dayMap) {
      dayMap = new Map();
      users.set(candy.userId, dayMap);
    }

    let day = dayMap.get(dateStr);
    if (!day) {
      day = {
        dateStr,
        candies: [],
        countByClass: new Map(),
        total: 0,
      };
      dayMap.set(dateStr, day);
    }

    const cls = toCandyAudioClass(candy.primaryAudioClass);
    day.candies.push(candy);
    day.total += 1;
    day.countByClass.set(cls, (day.countByClass.get(cls) ?? 0) + 1);

  }

  const result: UserBucket[] = [];
  for (const [userId, dayMap] of users) {
    const days = Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const total = days.reduce((sum, d) => sum + d.total, 0);
    const maxDay = days.reduce((max, d) => Math.max(max, d.total), 0);
    result.push({ userId, total, maxDay, days, dayMap });
  }

  return result.sort((a, b) => b.total - a.total);
}

function buildActivity(user: UserBucket) {
  const n = DATE_COLUMNS.length * 96; // 15-minute buckets across all selected days.
  const density = Array.from({ length: n }, () => 0);
  const drops: CandyDrop[] = [];
  const dateIndexByStr = new Map(DATE_COLUMNS.map((dateStr, index) => [dateStr, index]));

  for (const day of user.days) {
    const dayIndex = dateIndexByStr.get(day.dateStr);
    if (dayIndex == null) continue;

    for (const candy of day.candies) {
      const dt = new Date(candy.createdTime);
      const minutes = dt.getHours() * 60 + dt.getMinutes();
      const dayFraction = minutes / (24 * 60);
      const x = (dayIndex + dayFraction) / DATE_COLUMNS.length;
      const i = Math.min(n - 1, Math.max(0, Math.round(x * (n - 1))));
      const primary = toCandyAudioClass(candy.primaryAudioClass);
      const classes = candy.audioClasses.filter(isValidAudioClass);
      const toneClasses = classes.length > 0 ? classes : [primary];
      const weight = 1 / toneClasses.length;
      const tones = toneClasses.map((cls) => ({ cls, weight }));

      for (let j = 0; j < n; j++) {
        const dist = Math.abs(j - i);
        density[j] += Math.exp(-(dist * dist) / 10);
      }

      drops.push({ candy, cls: primary, x, tones, screenshotUrl: candy.screenshotUrl });
    }
  }

  const maxDensity = Math.max(...density, 1);
  const values = density.map((d) => {
    const normalized = d / maxDensity;
    return 0.07 + Math.pow(normalized, 0.72) * 0.76;
  });

  return { values, drops };
}

function timelineStopsFromDrops(drops: CandyDrop[]) {
  const sorted = [...drops].sort((a, b) => a.x - b.x);
  if (!sorted.length) return [];

  return sorted.flatMap((drop, index) => {
    const offset = drop.x * 100;
    const prevOffset = index === 0 ? 0 : sorted[index - 1].x * 100;
    const nextOffset =
      index === sorted.length - 1 ? 100 : sorted[index + 1].x * 100;
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

// ── Visual components ─────────────────────────────────────────────────────────

function ActivityCurve({ user }: { user: UserBucket }) {
  const W = 1580;
  const H = 128;
  const padX = 18;
  const topY = 12;
  const baseY = 72;
  const innerW = W - padX * 2;
  const { values, drops } = buildActivity(user);
  const n = values.length;
  const xs = values.map((_, i) => padX + (i / (n - 1)) * innerW);
  const ys = values.map((v) => topY + (1 - v) * (baseY - topY));

  let pathD = `M ${f(xs[0])} ${f(ys[0])}`;
  for (let i = 1; i < n; i++) {
    const cp1x = xs[i - 1] + (xs[i] - xs[i - 1]) / 3;
    const cp2x = xs[i] - (xs[i] - xs[i - 1]) / 3;
    pathD += ` C ${f(cp1x)} ${f(ys[i - 1])} ${f(cp2x)} ${f(ys[i])} ${f(xs[i])} ${f(ys[i])}`;
  }
  const fillD = `${pathD} L ${f(xs[n - 1])} ${baseY} L ${padX} ${baseY} Z`;
  const toneStops = timelineStopsFromDrops(drops);
  const gradientId = `tone-${user.userId}`.replace(/[^a-zA-Z0-9_-]/g, "");
  const maskId = `fade-${gradientId}`;

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-2 top-2 z-10 rounded-[4px] border border-[var(--rule)] bg-[rgba(255,255,255,0.78)] px-2.5 py-1 backdrop-blur-sm">
        <span className="text-[12px] font-semibold text-[var(--ink)]">{displayNameFor(user.userId)}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {toneStops.length ? (
              <>
                <stop offset="0%" stopColor={toneStops[0].color} stopOpacity="0.18" />
                {toneStops.map((stop, k) => (
                  <stop key={k} offset={`${f(stop.offset)}%`} stopColor={stop.color} stopOpacity="0.28" />
                ))}
                <stop offset="100%" stopColor={toneStops.at(-1)?.color} stopOpacity="0.18" />
              </>
            ) : (
              <stop offset="0%" stopColor="var(--ribbon)" stopOpacity="0.05" />
            )}
          </linearGradient>
          <linearGradient id={maskId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${maskId}-mask`}>
            <path d={fillD} fill={`url(#${maskId})`} />
          </mask>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill={`url(#${gradientId})`} mask={`url(#${maskId}-mask)`} />
        <path
          d={pathD}
          stroke="var(--ink)"
          strokeWidth="0.95"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {DATE_COLUMNS.slice(1).map((dateStr, index) => {
          const x = padX + ((index + 1) / DATE_COLUMNS.length) * innerW;
          return (
            <line
              key={dateStr}
              x1={f(x)}
              x2={f(x)}
              y1="0"
              y2={H}
              stroke="var(--rule-soft)"
              strokeWidth="0.55"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {drops.map((drop, k) => (
          <line
            key={`${drop.candy.createdTime}-${k}`}
            x1={f(padX + drop.x * innerW)}
            y1={f(ys[Math.round(drop.x * (n - 1))] + 7)}
            x2={f(padX + drop.x * innerW)}
            y2={baseY + 8}
            stroke={AUDIO_CONFIG[drop.cls].color}
            strokeWidth="0.45"
            strokeDasharray="3 4"
            opacity="0.32"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {drops.map((drop, k) => {
        const pointIndex = Math.round(drop.x * (n - 1));
        const x = padX + drop.x * innerW;
        const y = ys[pointIndex];
        return (
          <span
            key={`${drop.candy.createdTime}-${k}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(x / W) * 100}%`,
              top: `${(y / H) * 100}%`,
              zIndex: 2,
            }}
          >
            <CandyShape
              audioClass={drop.cls}
              gradient={gradientFromSoundMix(drop.tones)}
              shape={shapeFor(drop.cls)}
              size={22}
            />
          </span>
        );
      })}

      {drops
        .filter((drop) => drop.screenshotUrl)
        .map((drop, k) => {
          const x = padX + drop.x * innerW;
          const y = baseY + 15 + (k % 2) * 15;
          return (
            <span
              key={`shot-${drop.candy.createdTime}-${k}`}
              className="pointer-events-none absolute -translate-x-1/2 overflow-hidden rounded-[3px] border border-white bg-white shadow-[0_3px_10px_rgba(28,25,22,0.14)]"
              style={{
                left: `${(x / W) * 100}%`,
                top: `${(y / H) * 100}%`,
                width: 28,
                height: 18,
                zIndex: 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={drop.screenshotUrl ?? ""} alt="" className="h-full w-full object-cover" />
              <span
                className="absolute inset-0"
                style={{ boxShadow: `inset 0 0 0 1.5px ${AUDIO_CONFIG[drop.cls].color}` }}
              />
            </span>
          );
        })}

      <div className="absolute inset-x-[18px] bottom-0 grid grid-cols-5 text-[13px] font-semibold tabular-nums text-[var(--ink-soft)]">
        {DATE_COLUMNS.map((dateStr) => (
          <div key={dateStr} className="relative flex justify-between px-2">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserRow({ user }: { user: UserBucket }) {
  const shotCount = user.days.reduce((sum, d) => sum + d.candies.filter((c) => c.screenshotUrl).length, 0);

  return (
    <div className="grid min-h-0 grid-cols-[280px_1fr] border-t border-[var(--rule)]">
      <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.48)] px-7">
        <div className="grid size-[58px] shrink-0 place-items-center rounded-full border border-[var(--line)] bg-white">
          <span className="font-display text-[20px] text-[var(--ink)]">{initialsFor(user.userId)}</span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[28px] font-semibold tracking-normal text-[var(--ink)]">
            {displayNameFor(user.userId)}
          </h2>
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            {user.total} candies · {shotCount} shots
          </p>
        </div>
      </div>

      <div className="min-h-0 border-l border-[var(--rule-soft)] px-5 py-3">
        <ActivityCurve user={user} />
      </div>
    </div>
  );
}

function SourceState({ error }: { error: string | null }) {
  return (
    <div className="grid h-full place-items-center px-12 text-center">
      <div className="max-w-[780px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
          notion source only
        </p>
        <h2 className="font-display mt-5 text-[54px] leading-none text-[var(--ink)]">
          尚未讀到指定 Notion 資料
        </h2>
        <p className="mt-5 text-[17px] font-medium leading-relaxed text-[var(--ink-muted)]">
          {error ?? "5/31 到 6/4 之間沒有可視覺化的糖果紀錄。"}
        </p>
        <p className="mt-4 text-[13px] font-semibold text-[var(--ink-soft)]">
          source · {NOTION_SOURCE_DATABASE_ID}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DataOverviewPage() {
  const source = await getAllCandies();
  const users = groupByUserAndDay(source.candies);
  const sourceError = source.error;

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto flex min-h-screen w-full items-start justify-center overflow-x-auto bg-[var(--paper)]">
        <div
          className="relative shrink-0 overflow-hidden bg-[var(--paper)]"
          style={{ width: CANVAS_W, height: CANVAS_H }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(28,25,22,0.024)_1px,transparent_1px),linear-gradient(rgba(28,25,22,0.02)_1px,transparent_1px)] bg-[size:96px_96px]" />
          <div className="relative grid h-full grid-rows-[62px_1fr] p-0">
            <div className="grid grid-cols-[280px_1fr] border-b border-[var(--rule)] bg-[rgba(255,255,255,0.54)]">
              <div className="flex items-center px-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                user name
              </div>
              <div className="grid grid-cols-5">
                {DATE_COLUMNS.map((dateStr) => (
                  <div
                    key={dateStr}
                    className="flex items-center justify-between border-l border-[var(--rule-soft)] px-5"
                  >
                    <span className="text-[18px] font-semibold text-[var(--ink)]">{shortDate(dateStr)}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      continuous
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {sourceError || users.length === 0 ? (
              <SourceState error={sourceError} />
            ) : (
              <div
                className="grid min-h-0 bg-[rgba(255,255,255,0.36)]"
                style={{ gridTemplateRows: `repeat(${users.length}, minmax(0, 1fr))` }}
              >
                {users.map((user) => (
                  <UserRow key={user.userId} user={user} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
