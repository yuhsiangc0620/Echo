import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import CandyShape from "@/app/_components/candy-shape";
import { AUDIO_CONFIG } from "@/lib/candy/catalog";
import { MOBILE_USERS } from "@/lib/mobile/mock-data";

export default function MobileDataPage() {
  return (
    <main className="min-h-screen bg-[#171412] text-[#171412]">
      <section className="mx-auto min-h-screen w-full max-w-[480px] bg-[#f6f1e7]">
        <header className="flex h-14 items-center justify-between border-b border-black/10 bg-[#fffaf0] px-4">
          <Link className="grid size-9 place-items-center rounded-md border border-black/10 bg-white/60" href="/mobile">
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="text-base font-black">資料頁面</h1>
          <span className="size-9" />
        </header>

        <section className="space-y-4 px-4 py-4">
          {MOBILE_USERS.map((user) => (
            <article key={user.id} className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black">{user.name}</h2>
                  <p className="text-xs font-semibold text-[#62594e]">{user.handle}</p>
                </div>
                <span className={`size-2.5 rounded-full ${user.online ? "bg-[#2da66f]" : "bg-[#9f988e]"}`} />
              </div>

              <div className="grid gap-2">
                {user.jar.map((audioClass, index) => {
                  const config = AUDIO_CONFIG[audioClass];

                  return (
                    <div key={`${user.id}-${audioClass}-${index}`} className="flex items-center gap-3 rounded-md border border-black/8 bg-white/56 px-3 py-2">
                      <CandyShape audioClass={audioClass} size={28} wrapped={index === 0} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{config.label}</p>
                        <p className="truncate text-xs font-semibold text-[#62594e]">{config.trigger}</p>
                      </div>
                      <span className="rounded-sm border border-black/10 px-2 py-1 text-[11px] font-black">
                        {config.drops ? "掉糖" : "記錄"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
