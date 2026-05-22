import { type CandyAudioClass } from "@/lib/candy/catalog";

export type JarUser = {
  id: string;
  name: string;
  handle: string;
  online: boolean;
  accent: string;
  jar: CandyAudioClass[];
  screenshotTone: "code" | "doc" | "chat";
  caption: string;
  messages: string[];
};

export const MOBILE_USERS: JarUser[] = [
  {
    id: "you",
    name: "You",
    handle: "local jar",
    online: true,
    accent: "#ef6f7f",
    jar: ["Keyboard_heavy", "Mouse_click", "Speech", "Air_conditioner"],
    screenshotTone: "code",
    caption: "40 分鐘鍵盤糖剛進罐，畫面已遮蔽。",
    messages: ["Mika: 這張很像 deadline 前五分鐘", "Ren: 我看到那個黑塊，懂。"],
  },
  {
    id: "mika",
    name: "Mika",
    handle: "design desk",
    online: true,
    accent: "#65c7df",
    jar: ["Sigh", "Music", "Speech", "Door_knock"],
    screenshotTone: "doc",
    caption: "剛包了一顆雲朵軟糖。",
    messages: ["You: 先喝水，剩下慢慢拆。"],
  },
  {
    id: "ren",
    name: "Ren",
    handle: "ops corner",
    online: false,
    accent: "#7cd7b8",
    jar: ["Mouse_click", "Traffic", "Keyboard_heavy"],
    screenshotTone: "chat",
    caption: "滑鼠連擊累積中，手機通知待讀。",
    messages: ["Mika: 這種點擊聲我也有。"],
  },
  {
    id: "jia",
    name: "Jia",
    handle: "night shift",
    online: true,
    accent: "#f5b642",
    jar: ["Music", "Air_conditioner", "Keyboard_heavy", "Sigh"],
    screenshotTone: "code",
    caption: "背景音樂很多，但還沒有觸發工作糖。",
    messages: [],
  },
];
