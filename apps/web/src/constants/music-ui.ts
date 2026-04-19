// ─────────────────────────────────────────────────────────────────────────────
// music-ui.ts — 音乐业务 UI 配置。
// 见 product_spec.md §10：Album 已降级为歌单（无生命周期），故仅保留
// Song/Concert 的状态色。
// ─────────────────────────────────────────────────────────────────────────────

import type { SongStatus, ConcertStatus } from "@/types/music";

export const MUSIC_STATUS_COLORS: Record<SongStatus | ConcertStatus, string> = {
  recording: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  mixing:    "bg-purple-500/20 text-purple-300 border-purple-500/30",
  released:  "bg-green-500/20 text-green-300 border-green-500/30",
  planning:  "bg-gray-500/20 text-gray-300 border-gray-500/30",
  selling:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
};

export const SONG_STATUS_LABEL: Record<SongStatus, string> = {
  recording: "录制中",
  mixing:    "混音中",
  released:  "已发布",
};

export const CONCERT_STATUS_LABEL: Record<ConcertStatus, string> = {
  planning:  "筹备中",
  selling:   "售票中",
  completed: "已完成",
};

/**
 * MVP 占位音频 URL；后续接 OSS 时只需改这里。
 * 当前指向 SoundHelix —— 一个公开可用的算法合成音乐样例库（允许免费试听 / demo 使用）。
 */
export const PLACEHOLDER_AUDIO_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

/** 免费可播放的预览音频池；按歌曲 id 循环取用，保证不同歌曲播放不同旋律。 */
export const PREVIEW_AUDIO_POOL: readonly string[] = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
];

/** 按 song.id 稳定取一个预览音频 URL（同一 id 永远返回同一条）。 */
export function previewAudioForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PREVIEW_AUDIO_POOL.length;
  return PREVIEW_AUDIO_POOL[idx];
}

/** 模型版本选项（P2 由 admin 工作流计费配置下发） */
export const MODEL_VERSION_OPTIONS = [
  { id: "suno-v3",         label: "Suno v3（标准）" },
  { id: "suno-v3-deep",    label: "Suno v3 · Deep" },
  { id: "musicgen-large",  label: "MusicGen Large" },
];

/** 思考深度档位。MVP 仅占位，正式价格由 admin 配置。 */
export const THINK_DEPTH_OPTIONS = [
  { id: "fast",     label: "快速" },
  { id: "standard", label: "标准" },
  { id: "deep",     label: "深度思考" },
] as const;

/**
 * 占位扣费计算：MVP 按 (modelVersion, thinkDepth) 给个随机段落值。
 * 正式策略见 product_spec.md §10.3。
 */
export function mockCreditsFor(modelVersion?: string, thinkDepth?: string): number {
  const base = modelVersion?.includes("deep") ? 120 : 60;
  const mult = thinkDepth === "deep" ? 2 : thinkDepth === "standard" ? 1.3 : 1;
  return Math.round(base * mult + Math.random() * 40);
}
