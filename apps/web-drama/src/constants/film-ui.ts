// ─────────────────────────────────────────────────────────────────────────────
// film-ui.ts — 影视业务状态色 / 角色 badge 色配置。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DramaStatus, MovieStatus, MovieRole,
  AdStatus, VoiceWorkStatus,
} from "@ai-star-eco/types/film";

/** 合并四个子域的状态色（值互相不冲突）。 */
export const FILM_STATUS_COLORS: Record<
  DramaStatus | MovieStatus | AdStatus | VoiceWorkStatus,
  string
> = {
  casting:          "bg-blue-500/20 text-blue-300 border-blue-500/30",
  filming:          "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "post-production":"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  released:         "bg-green-500/20 text-green-300 border-green-500/30",
  "pre-production": "bg-gray-500/20 text-gray-300 border-gray-500/30",
  negotiating:      "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  shooting:         "bg-purple-500/20 text-purple-300 border-purple-500/30",
  completed:        "bg-green-500/20 text-green-300 border-green-500/30",
  recording:        "bg-purple-500/20 text-purple-300 border-purple-500/30",
  editing:          "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  delivered:        "bg-green-500/20 text-green-300 border-green-500/30",
};

export const MOVIE_ROLE_BADGE_COLORS: Record<MovieRole, string> = {
  lead:       "text-yellow-400 border-yellow-400/30",
  supporting: "text-cyan-400 border-cyan-400/30",
  cameo:      "text-gray-400 border-gray-400/30",
};
