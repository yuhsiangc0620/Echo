import { type CandyAudioClass } from "@/lib/candy/catalog";

export type WeeklyScreenshot = {
  id: string;
  pageId?: string;
  ageHours: number;
  audioClasses: CandyAudioClass[];
  screenshotTone: "code" | "doc" | "chat";
  screenshotUrl?: string;
  minutes: number;
  messages: string[];
};

export type JarUser = {
  id: string;
  name: string;
  handle: string;
  online: boolean;
  accent: string;
  jar: CandyAudioClass[];
  caption: string;
  weeklyScreenshots: WeeklyScreenshot[];
};

export const MOBILE_USERS: JarUser[] = [];
