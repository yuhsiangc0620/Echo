import { Apple, ChevronLeft, Download, Monitor, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import ProfileCard from "@/app/desktop/profile-card";

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

type DesktopDownloads = {
  macUrl: string | null;
  windowsUrl: string | null;
  releaseUrl: string;
};

export const revalidate = 60;

const RELEASES_URL = "https://github.com/yuhsiangc0620/Echo/releases";
const LATEST_RELEASE_API = "https://api.github.com/repos/yuhsiangc0620/Echo/releases/latest";

async function getDesktopDownloads(): Promise<DesktopDownloads> {
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      next: {
        revalidate,
      },
    });

    if (!response.ok) {
      return {
        macUrl: null,
        windowsUrl: null,
        releaseUrl: RELEASES_URL,
      };
    }

    const release = (await response.json()) as GitHubRelease;
    const assets = release.assets ?? [];

    return {
      macUrl:
        assets.find((asset) => /^Echo-.+-arm64-mac\.zip$/.test(asset.name))?.browser_download_url ??
        null,
      windowsUrl:
        assets.find((asset) => /^Echo-.+-x64-win\.zip$/.test(asset.name))?.browser_download_url ??
        null,
      releaseUrl: release.html_url ?? RELEASES_URL,
    };
  } catch {
    return {
      macUrl: null,
      windowsUrl: null,
      releaseUrl: RELEASES_URL,
    };
  }
}

function DownloadCard({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string | null;
  icon: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
      <div className="mb-4 flex items-start gap-3">
        {icon}
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="text-sm font-semibold leading-6 text-[#62594e]">{description}</p>
        </div>
      </div>
      {href ? (
        <a
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-black text-[#fff7e6]"
          href={href}
        >
          <Download aria-hidden className="size-4" />
          下載 {title}
        </a>
      ) : (
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-black/12 bg-white/56 px-4 text-sm font-black text-[#62594e]"
          type="button"
          disabled
        >
          <Download aria-hidden className="size-4" />
          尚未產生
        </button>
      )}
    </article>
  );
}

export default async function DesktopPage() {
  const downloads = await getDesktopDownloads();

  return (
    <main className="min-h-screen bg-[#171412] text-[#171412]">
      <section className="mx-auto min-h-screen w-full max-w-[480px] bg-[#f6f1e7]">
        <header className="flex h-14 items-center justify-between border-b border-black/10 bg-[#fffaf0] px-4">
          <Link className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60" href="/">
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="text-base font-black">桌面端下載</h1>
          <span className="size-9" />
        </header>

        <section className="space-y-4 px-4 py-4">
          <DownloadCard
            title="macOS"
            description="Apple Silicon 開發版。第一次打開後輸入和手機一樣的名稱，即會用同一個 User_ID 上傳。"
            href={downloads.macUrl}
            icon={
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#171412] text-[#fff7e6]">
                <Apple aria-hidden className="size-5" />
              </span>
            }
          />

          <DownloadCard
            title="Windows"
            description="Windows x64 開發版。會和 macOS 版本放在同一個 GitHub Release。"
            href={downloads.windowsUrl}
            icon={
              <span className="grid size-11 shrink-0 place-items-center rounded-md border border-black/10 bg-white/60">
                <Monitor aria-hidden className="size-5" />
              </span>
            }
          />

          <ProfileCard />

          <div className="grid grid-cols-2 gap-3">
            <Link
              className="flex items-center justify-between rounded-lg border border-black/10 bg-[#fffaf0] p-4 text-sm font-black"
              href="/mobile/data"
            >
              資料總覽
              <SquareArrowOutUpRight aria-hidden className="size-4" />
            </Link>
            <a
              className="flex items-center justify-between rounded-lg border border-black/10 bg-[#fffaf0] p-4 text-sm font-black"
              href={downloads.releaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              全部版本
              <SquareArrowOutUpRight aria-hidden className="size-4" />
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
