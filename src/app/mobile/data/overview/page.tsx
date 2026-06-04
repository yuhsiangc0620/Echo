import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import {
  AUDIO_CLASSES,
  AUDIO_CONFIG,
  type CandyAudioClass,
} from "@/lib/candy/catalog";

export const revalidate = 60;

const PAGE_BG = "var(--paper)";

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
  screenshots: string[];
  countByClass: Map<CandyAudioClass, number>;
  total: number;
};

type UserBucket = {
  userId: string;
  total: number;
  maxDay: number;
  days: DayBucket[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// user_jane-doe → "jane doe"; falls back to the raw id.
function displayNameFor(userId: string): string {
  const cleaned = userId.replace(/^user_/, "").replace(/[-_]/g, " ").trim();
  return cleaned || userId || "匿名用戶";
}

// ── Notion fetch (all candies, paginated) ─────────────────────────────────────

async function getAllCandies(): Promise<OverviewCandy[]> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_CANDY_DATABASE_ID;
  if (!token || !databaseId) return [];

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

      if (!res.ok) break;

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
  } catch {
    return all;
  }

  return all;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

function groupByUserAndDay(candies: OverviewCandy[]): UserBucket[] {
  const users = new Map<string, Map<string, DayBucket>>();

  for (const candy of candies) {
    const dateStr = formatLocalDate(new Date(candy.createdTime));

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
        screenshots: [],
        countByClass: new Map(),
        total: 0,
      };
      dayMap.set(dateStr, day);
    }

    day.candies.push(candy);
    day.total += 1;
    if (candy.screenshotUrl) day.screenshots.push(candy.screenshotUrl);

    const cls = toCandyAudioClass(candy.primaryAudioClass);
    day.countByClass.set(cls, (day.countByClass.get(cls) ?? 0) + 1);
  }

  const result: UserBucket[] = [];
  for (const [userId, dayMap] of users) {
    const days = Array.from(dayMap.values()).sort((a, b) =>
      b.dateStr.localeCompare(a.dateStr),
    );
    const total = days.reduce((sum, d) => sum + d.total, 0);
    const maxDay = days.reduce((max, d) => Math.max(max, d.total), 0);
    result.push({ userId, total, maxDay, days });
  }

  // Most active users first.
  return result.sort((a, b) => b.total - a.total);
}

// ── Distribution bar ──────────────────────────────────────────────────────────

function DistributionBar({ day }: { day: DayBucket }) {
  // Ordered segments using the catalog order so colors are stable.
  const segments = AUDIO_CLASSES
    .map((cls) => ({ cls, count: day.countByClass.get(cls) ?? 0 }))
    .filter((s) => s.count > 0);

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--paper-mid)]">
      {segments.map(({ cls, count }) => (
        <span
          key={cls}
          title={`${AUDIO_CONFIG[cls].label} · ${count}`}
          style={{
            width: `${(count / day.total) * 100}%`,
            background: AUDIO_CONFIG[cls].color,
          }}
        />
      ))}
    </div>
  );
}

// ── Day row ───────────────────────────────────────────────────────────────────

function DayRow({ day, maxDay }: { day: DayBucket; maxDay: number }) {
  const label = day.dateStr.slice(5).replace("-", "/");
  // Scale the bar container width by how big this day is vs the user's busiest.
  const widthPct = maxDay > 0 ? Math.max(18, (day.total / maxDay) * 100) : 100;

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-[var(--ink)]">
          {label}
        </span>
        <div className="flex-1" style={{ maxWidth: `${widthPct}%` }}>
          <DistributionBar day={day} />
        </div>
        <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-[var(--ink-soft)]">
          {day.total} 顆
        </span>
      </div>

      {day.screenshots.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pl-[52px] pb-0.5">
          {day.screenshots.map((url, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={k}
              src={url}
              alt={`${label} 截圖 ${k + 1}`}
              loading="lazy"
              className="h-12 w-[72px] shrink-0 rounded-md border border-[var(--rule)] object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── User section ──────────────────────────────────────────────────────────────

function UserSection({ user }: { user: UserBucket }) {
  const shotCount = user.days.reduce((sum, d) => sum + d.screenshots.length, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {displayNameFor(user.userId)}
        </p>
        <p className="text-[10px] font-medium tracking-wider text-[var(--ink-soft)]">
          {user.total} 顆 · {user.days.length} 天 · {shotCount} 截圖
        </p>
      </div>
      <div className="mt-2 divide-y divide-[var(--rule)]">
        {user.days.map((day) => (
          <DayRow key={day.dateStr} day={day} maxDay={user.maxDay} />
        ))}
      </div>
    </div>
  );
}

// ── Color legend ──────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div>
      <p className="echo-eyebrow">聲音顏色</p>
      <div className="mt-3 grid grid-cols-3 gap-y-2">
        {AUDIO_CLASSES.map((cls) => {
          const config = AUDIO_CONFIG[cls];
          return (
            <div key={cls} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: config.color }}
                aria-hidden
              />
              <span className="truncate text-[10px] text-[var(--ink-soft)]">{config.short}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DataOverviewPage() {
  const candies = await getAllCandies();
  const users = groupByUserAndDay(candies);
  const totalShots = candies.filter((c) => c.screenshotUrl).length;

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto min-h-screen w-full max-w-[480px]" style={{ background: PAGE_BG }}>
        <header className="relative flex h-12 items-center justify-center px-4">
          <Link
            className="echo-press absolute left-3 grid size-8 place-items-center text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            href="/mobile/data"
            aria-label="返回"
          >
            <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={1.5} />
          </Link>
          <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] lowercase">
            all <span className="echo-underline">data.</span>
          </h1>
        </header>

        <div className="px-5 pt-4 pb-10">
          <div className="flex items-center justify-between">
            <p className="echo-eyebrow">每位用戶 · 每日分布</p>
            <p className="text-[10px] font-medium tracking-wider text-[var(--ink-soft)]">
              {candies.length} 顆 · {users.length} 人 · {totalShots} 截圖
            </p>
          </div>

          {users.length === 0 ? (
            <p className="mt-8 text-center text-[12px] text-[var(--ink-soft)]">尚無資料</p>
          ) : (
            <>
              <div className="mt-5 space-y-8">
                {users.map((user) => (
                  <UserSection key={user.userId} user={user} />
                ))}
              </div>
              <div className="mt-9 border-t border-[var(--rule)] pt-6">
                <Legend />
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
