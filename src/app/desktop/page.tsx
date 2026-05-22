import { Apple, ChevronLeft, Download, Monitor, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";

const RELEASES_URL = "https://github.com/yuhsiangc0620/Echo/releases";

export default function DesktopPage() {
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
          <article className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#171412] text-[#fff7e6]">
                <Apple aria-hidden className="size-5" />
              </span>
              <div>
                <h2 className="font-black">macOS</h2>
                <p className="text-sm font-semibold text-[#62594e]">
                  Apple Silicon 開發版已可打包，下載檔建議放在 GitHub Releases。
                </p>
              </div>
            </div>
            <a
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-black text-[#fff7e6]"
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
            >
              <Download aria-hidden className="size-4" />
              前往 releases
            </a>
          </article>

          <article className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md border border-black/10 bg-white/60">
                <Monitor aria-hidden className="size-5" />
              </span>
              <div>
                <h2 className="font-black">Windows</h2>
                <p className="text-sm font-semibold text-[#62594e]">
                  Windows 版需要在 Windows runner 上打包，之後會跟 macOS 一起放在同一個 release。
                </p>
              </div>
            </div>
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-black/12 bg-white/56 px-4 text-sm font-black text-[#62594e]"
              type="button"
              disabled
            >
              <Download aria-hidden className="size-4" />
              尚未提供
            </button>
          </article>

          <Link
            className="flex items-center justify-between rounded-lg border border-black/10 bg-[#fffaf0] p-4 text-sm font-black"
            href="/mobile/data"
          >
            資料總覽
            <SquareArrowOutUpRight aria-hidden className="size-4" />
          </Link>
        </section>
      </section>
    </main>
  );
}
