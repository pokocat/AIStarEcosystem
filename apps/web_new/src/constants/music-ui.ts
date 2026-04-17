// ─────────────────────────────────────────────────────────────────────────────
// music-ui.ts — 音乐业务状态色配置。
// ─────────────────────────────────────────────────────────────────────────────

import type { SongStatus, AlbumStatus, ConcertStatus } from "@/types/music";

/**
 * 六种状态合并在同一个表中，组件中通过状态字符串索引。
 * SongStatus / AlbumStatus / ConcertStatus 的值互相不冲突。
 */
export const MUSIC_STATUS_COLORS: Record<SongStatus | AlbumStatus | ConcertStatus, string> = {
  recording: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  mixing:    "bg-purple-500/20 text-purple-300 border-purple-500/30",
  released:  "bg-green-500/20 text-green-300 border-green-500/30",
  planning:  "bg-gray-500/20 text-gray-300 border-gray-500/30",
  selling:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
};
