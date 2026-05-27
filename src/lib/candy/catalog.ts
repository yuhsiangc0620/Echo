export type CandyAudioClass =
  | "Keyboard_heavy"
  | "Sigh"
  | "Mouse_click"
  | "Speech"
  | "Music"
  | "Air_conditioner"
  | "Traffic"
  | "Door_knock"
  | "Silence";

export type CandyModifier = "default" | "music" | "speech" | "outdoor" | "cold" | "quiet";

export type CandyIconKey =
  | "keyboard"
  | "cloud"
  | "mouse"
  | "mic"
  | "traffic"
  | "volume";

export type CandyDefinition = {
  audioClass: CandyAudioClass;
  label: string;
  candyName: string;
  mediapipeCategory: string;
  trigger: string;
  thresholdSec: number;
  confidence: string;
  drops: boolean;
  icon: CandyIconKey;
  css: string;
  color: string;
  short: string;
  role: "work" | "ambient" | "quiet";
};

export const AUDIO_CLASSES: CandyAudioClass[] = [
  "Keyboard_heavy",
  "Sigh",
  "Mouse_click",
  "Speech",
  "Music",
  "Air_conditioner",
  "Traffic",
  "Door_knock",
  "Silence",
];

export const CANDY_CATALOG: Record<CandyAudioClass, CandyDefinition> = {
  Keyboard_heavy: {
    audioClass: "Keyboard_heavy",
    label: "急躁鍵盤聲",
    candyName: "帶刺跳跳糖",
    mediapipeCategory: "Computer keyboard / Typing",
    trigger: "MediaPipe score >= 0.72, 本地累計 40:00",
    thresholdSec: 2400,
    confidence: "0.72",
    drops: true,
    icon: "keyboard",
    css: "candy-keyboard",
    color: "#ff8aa6",
    short: "Keyboard",
    role: "work",
  },
  Sigh: {
    audioClass: "Sigh",
    label: "長嘆氣",
    candyName: "雲朵軟糖",
    mediapipeCategory: "Sigh",
    trigger: "MediaPipe 偵測 Sigh，連續事件 >= 1.4s",
    thresholdSec: 8,
    confidence: "0.68",
    drops: true,
    icon: "cloud",
    css: "candy-sigh",
    color: "#ffb088",
    short: "Sigh",
    role: "work",
  },
  Mouse_click: {
    audioClass: "Mouse_click",
    label: "滑鼠連擊",
    candyName: "薄荷夾心糖",
    mediapipeCategory: "Clicking / Mouse click",
    trigger: "MediaPipe score >= 0.65，高頻點擊累計 10:00",
    thresholdSec: 600,
    confidence: "0.65",
    drops: true,
    icon: "mouse",
    css: "candy-mouse",
    color: "#88e0b0",
    short: "Mouse",
    role: "work",
  },
  Speech: {
    audioClass: "Speech",
    label: "周圍人聲",
    candyName: "對話泡泡糖",
    mediapipeCategory: "Speech / Conversation",
    trigger: "環境聲記錄；不作為工作掉糖門檻",
    thresholdSec: 300,
    confidence: "0.55",
    drops: false,
    icon: "volume",
    css: "candy-speech",
    color: "#b896f5",
    short: "Speech",
    role: "ambient",
  },
  Music: {
    audioClass: "Music",
    label: "背景音樂",
    candyName: "旋律硬糖",
    mediapipeCategory: "Music",
    trigger: "環境聲記錄；用於糖果多樣性",
    thresholdSec: 300,
    confidence: "0.55",
    drops: false,
    icon: "volume",
    css: "candy-music",
    color: "#ffc878",
    short: "Music",
    role: "ambient",
  },
  Air_conditioner: {
    audioClass: "Air_conditioner",
    label: "空調風扇",
    candyName: "薄霜涼糖",
    mediapipeCategory: "Air conditioning / Fan / Hum",
    trigger: "環境聲記錄；長時段背景脈絡",
    thresholdSec: 600,
    confidence: "0.5",
    drops: false,
    icon: "volume",
    css: "candy-air",
    color: "#92c8f3",
    short: "Air",
    role: "ambient",
  },
  Traffic: {
    audioClass: "Traffic",
    label: "交通戶外聲",
    candyName: "柏油黑糖",
    mediapipeCategory: "Traffic noise / Vehicle",
    trigger: "環境聲記錄；通勤或街邊工作脈絡",
    thresholdSec: 300,
    confidence: "0.55",
    drops: false,
    icon: "traffic",
    css: "candy-traffic",
    color: "#8585b8",
    short: "Traffic",
    role: "ambient",
  },
  Door_knock: {
    audioClass: "Door_knock",
    label: "門聲碰撞",
    candyName: "敲敲脆糖",
    mediapipeCategory: "Knock / Door / Thump",
    trigger: "環境聲記錄；短事件糖果素材",
    thresholdSec: 20,
    confidence: "0.55",
    drops: false,
    icon: "volume",
    css: "candy-door",
    color: "#c89572",
    short: "Door",
    role: "ambient",
  },
  Silence: {
    audioClass: "Silence",
    label: "停頓靜默",
    candyName: "透明晶糖",
    mediapipeCategory: "Silence / Outside known classes",
    trigger: "只記錄低活動狀態，不觸發掉糖",
    thresholdSec: 900,
    confidence: "0.18",
    drops: false,
    icon: "mic",
    css: "candy-silence",
    color: "#b0d8d2",
    short: "Silence",
    role: "quiet",
  },
};

export const AUDIO_CONFIG = CANDY_CATALOG;

export const CANDY_VARIANT_NAMES: Partial<Record<CandyAudioClass, Record<CandyModifier, string>>> = {
  Keyboard_heavy: {
    default: "帶刺跳跳糖",
    music:   "旋律跳跳糖",
    speech:  "嘈雜跳跳糖",
    outdoor: "都市跳跳糖",
    cold:    "冷靜跳跳糖",
    quiet:   "靜謐跳跳糖",
  },
  Sigh: {
    default: "雲朵軟糖",
    music:   "旋律雲朵糖",
    speech:  "對話雲朵糖",
    outdoor: "街霧雲朵糖",
    cold:    "霜雲軟糖",
    quiet:   "靜雲軟糖",
  },
  Mouse_click: {
    default: "薄荷夾心糖",
    music:   "旋律薄荷糖",
    speech:  "對話薄荷糖",
    outdoor: "都市薄荷糖",
    cold:    "極光薄荷糖",
    quiet:   "靜室薄荷糖",
  },
};

export function getCandyModifier(secondaryClasses: CandyAudioClass[]): CandyModifier {
  if (secondaryClasses.includes("Music")) return "music";
  if (secondaryClasses.includes("Speech")) return "speech";
  if (secondaryClasses.includes("Traffic")) return "outdoor";
  if (secondaryClasses.includes("Air_conditioner")) return "cold";
  if (secondaryClasses.includes("Silence")) return "quiet";
  return "default";
}

export function getCandyVariantName(audioClass: CandyAudioClass, modifier: CandyModifier): string {
  return CANDY_VARIANT_NAMES[audioClass]?.[modifier] ?? CANDY_CATALOG[audioClass].candyName;
}
