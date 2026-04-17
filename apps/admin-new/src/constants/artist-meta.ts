import type { ArtistType } from "@/types/artist";

export const ARTIST_TYPE_META: Record<ArtistType, { label: string; icon: string }> = {
  singer:      { label: "歌手", icon: "🎤" },
  actor:       { label: "演员", icon: "🎭" },
  entertainer: { label: "综艺", icon: "🎪" },
  dancer:      { label: "舞者", icon: "💃" },
  host:        { label: "主持", icon: "🎙️" },
  all_rounder: { label: "全能", icon: "🌟" },
  idol:        { label: "偶像", icon: "💎" },
};

export const TALENT_LABELS: Record<string, string> = {
  singing: "声乐",
  acting:  "演技",
  dancing: "舞蹈",
  hosting: "主持",
  comedy:  "喜剧",
  variety: "综艺",
};

export const ARTIST_NEXT_STATUS: Record<string, { to: string; label: string }[]> = {
  trainee: [{ to: "debut", label: "批准出道" }],
  debut:   [{ to: "active", label: "转为活跃艺人" }, { to: "trainee", label: "回炉重造" }],
  active:  [{ to: "rest", label: "进入休整期" }, { to: "retired", label: "办理退役" }],
  rest:    [{ to: "active", label: "恢复活跃" }, { to: "retired", label: "办理退役" }],
  retired: [],
};
