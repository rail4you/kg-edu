export type FaceScene =
  | "entry"
  | "video_start"
  | "video_playing"
  | "video_resume"
  | "video_end"
  | "timed"
  | "random";

export interface FaceCheckSettings {
  nodes: Record<"entry" | "video_start" | "video_playing" | "video_resume" | "video_end", boolean>;
  timedEnabled: boolean;
  timedIntervalSec: number;
  randomEnabled: boolean;
  /** record: 记录并继续学习；block: 不允许学习 */
  mode: "record" | "block";
  /** 演示用：强制识别失败 */
  simulateFail: boolean;
}

export const DEFAULT_FACE_SETTINGS: FaceCheckSettings = {
  nodes: {
    entry: true,
    video_start: true,
    video_playing: true,
    video_resume: true,
    video_end: true,
  },
  timedEnabled: true,
  timedIntervalSec: 600,
  randomEnabled: true,
  mode: "record",
  simulateFail: false,
};

export const FACE_SCENE_LABEL: Record<FaceScene, string> = {
  entry: "进入课程",
  video_start: "视频开始",
  video_playing: "播放中",
  video_resume: "继续播放",
  video_end: "视频结束",
  timed: "定时抓拍",
  random: "随机抓拍",
};

const SETTINGS_KEY = "face-check-settings";

export function loadFaceSettings(): FaceCheckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_FACE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_FACE_SETTINGS };
}

export function saveFaceSettings(s: FaceCheckSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
