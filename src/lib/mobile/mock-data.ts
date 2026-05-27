import { type CandyAudioClass } from "@/lib/candy/catalog";

export type WeeklyScreenshot = {
  id: string;
  ageHours: number;
  audioClasses: CandyAudioClass[];
  screenshotTone: "code" | "doc" | "chat";
  screenshotUrl?: string;
  caption: string;
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

export const MOBILE_USERS: JarUser[] = [
  {
    id: "you",
    name: "You",
    handle: "local jar",
    online: true,
    accent: "#ff8aa6",
    jar: ["Keyboard_heavy", "Mouse_click", "Speech", "Air_conditioner"],
    caption: "本週還留著的工作截圖。",
    weeklyScreenshots: [
      {
        id: "you-week-1",
        ageHours: 3,
        audioClasses: ["Keyboard_heavy", "Speech"],
        screenshotTone: "code",
        caption: "40 分鐘鍵盤糖剛包好，畫面已遮蔽。",
        messages: ["Mika: 這張很像 deadline 前五分鐘", "Ren: 我看到那個黑塊，懂。"],
      },
      {
        id: "you-week-2",
        ageHours: 52,
        audioClasses: ["Mouse_click", "Air_conditioner"],
        screenshotTone: "chat",
        caption: "滑鼠連擊那段留下來了。",
        messages: ["Jia: 這種連擊我今天也有。"],
      },
    ],
  },
  {
    id: "mika",
    name: "Mika",
    handle: "design desk",
    online: true,
    accent: "#92c8f3",
    jar: ["Sigh", "Music", "Speech", "Door_knock"],
    caption: "剛包了一顆雲朵軟糖。",
    weeklyScreenshots: [
      {
        id: "mika-week-1",
        ageHours: 7,
        audioClasses: ["Sigh", "Music"],
        screenshotTone: "doc",
        caption: "剛包了一顆雲朵軟糖。",
        messages: ["You: 先喝水，剩下慢慢拆。"],
      },
    ],
  },
  {
    id: "ren",
    name: "Ren",
    handle: "ops corner",
    online: false,
    accent: "#88e0b0",
    jar: ["Mouse_click", "Traffic", "Keyboard_heavy"],
    caption: "滑鼠連擊累積中，手機通知待讀。",
    weeklyScreenshots: [
      {
        id: "ren-week-1",
        ageHours: 25,
        audioClasses: ["Mouse_click", "Traffic"],
        screenshotTone: "chat",
        caption: "高頻點擊留下的工作截圖。",
        messages: ["Mika: 這種點擊聲我也有。"],
      },
      {
        id: "ren-old-1",
        ageHours: 190,
        audioClasses: ["Keyboard_heavy"],
        screenshotTone: "code",
        caption: "這張已經超過一週，不會出現在主畫面。",
        messages: ["You: 這張應該進資料頁。"],
      },
    ],
  },
  {
    id: "jia",
    name: "Jia",
    handle: "night shift",
    online: true,
    accent: "#ffc878",
    jar: ["Music", "Air_conditioner", "Keyboard_heavy", "Sigh"],
    caption: "背景音樂很多，但還沒有觸發工作糖。",
    weeklyScreenshots: [],
  },
];
