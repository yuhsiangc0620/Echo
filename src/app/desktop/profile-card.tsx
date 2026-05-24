"use client";

import { useMemo, useSyncExternalStore } from "react";

type EchoProfile = {
  name: string;
  userId: string;
};

const PROFILE_STORAGE_KEY = "echo.profile.v1";

function parseStoredProfile(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EchoProfile;
  } catch {
    return null;
  }
}

function getStoredProfileRaw() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PROFILE_STORAGE_KEY);
}

function subscribeStoredProfile(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("echo-profile-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("echo-profile-change", onStoreChange);
  };
}

function useStoredProfile() {
  const rawProfile = useSyncExternalStore(subscribeStoredProfile, getStoredProfileRaw, () => null);

  return useMemo(() => parseStoredProfile(rawProfile), [rawProfile]);
}

export default function ProfileCard() {
  const profile = useStoredProfile();

  return (
    <article className="rounded-lg border border-black/10 bg-[#fffaf0] p-4">
      <h2 className="font-black">同步中的用戶</h2>
      {profile ? (
        <div className="mt-3 rounded-md bg-[#f6f1e7] px-3 py-2">
          <p className="text-sm font-black">{profile.name}</p>
          <p className="mt-1 truncate text-xs font-bold text-[#62594e]">User_ID: {profile.userId}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-6 text-[#62594e]">
          回到首頁輸入糖果罐名稱後，這裡會顯示手機端要和桌面端共用的 User_ID。
        </p>
      )}
    </article>
  );
}
