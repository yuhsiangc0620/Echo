"use client";

import { Plus, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CandyShape from "@/app/_components/candy-shape";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export default function MobileInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const candyGradient = useMemo(
    () => "linear-gradient(160deg, #ff8aa6 0%, #ff8aa6 42%, #b896f5 72%, #88e0b0 100%)",
    [],
  );

  useEffect(() => {
    const standaloneCheck = window.setTimeout(() => {
      setInstalled(isStandaloneDisplay());
    }, 0);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowGuide(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(standaloneCheck);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installMobileApp() {
    if (installed) {
      return;
    }

    if (!installPrompt) {
      setShowGuide((current) => !current);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowGuide(false);
    }

    setInstallPrompt(null);
  }

  return (
    <article className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center">
          <CandyShape
            audioClass="Keyboard_heavy"
            gradient={candyGradient}
            shape="spiky"
            size={34}
          />
        </span>
        <div>
          <h2 className="font-black">手機版捷徑</h2>
          <p className="text-sm font-semibold leading-6 text-[#62594e]">
            把 Echo 加到手機桌面，之後會像 app 一樣直接打開。
          </p>
        </div>
      </div>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-black text-[#fff7e6] disabled:opacity-45"
        type="button"
        disabled={installed}
        onClick={installMobileApp}
      >
        <Plus aria-hidden className="size-4" />
        {installed ? "已加入桌面" : "加入手機桌面"}
      </button>

      {showGuide ? (
        <div className="mt-3 rounded-md bg-[#f6f1e7] px-3 py-3 text-xs font-bold leading-5 text-[#62594e]">
          <p className="flex items-center gap-2 text-[#171412]">
            <Share2 aria-hidden className="size-3.5" />
            iPhone / Safari
          </p>
          <p className="mt-1">點瀏覽器分享按鈕，再選「加入主畫面」。</p>
          <p className="mt-2 text-[#8d857d]">Android Chrome 若支援安裝，會直接跳出安裝提示。</p>
        </div>
      ) : null}
    </article>
  );
}
