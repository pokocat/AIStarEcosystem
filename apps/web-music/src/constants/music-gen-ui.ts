// ─────────────────────────────────────────────────────────────────────────────
// 音乐生成的创作参数选项。
//
// value 是模型契约要求的原值（英文枚举），label 是给用户看的中文 —— 界面上不暴露原值。
// 这些不是随便编的：取值范围来自音乐模型的公开参数表，传错会被上游拒绝。
// ─────────────────────────────────────────────────────────────────────────────

export interface GenOption {
  value: string;
  label: string;
}

/** 曲风。 */
export const GENRE_OPTIONS: GenOption[] = [
  { value: "Pop", label: "流行" },
  { value: "Folk", label: "民谣" },
  { value: "Rock", label: "摇滚" },
  { value: "Chinese Style", label: "国风" },
  { value: "Hip Hop/Rap", label: "嘻哈 / 说唱" },
  { value: "R&B/Soul", label: "R&B / 灵魂" },
  { value: "Electronic", label: "电子" },
  { value: "Jazz", label: "爵士" },
  { value: "Punk", label: "朋克" },
  { value: "Reggae", label: "雷鬼" },
  { value: "DJ", label: "DJ" },
];

/** 情绪。 */
export const MOOD_OPTIONS: GenOption[] = [
  { value: "Happy", label: "快乐" },
  { value: "Dynamic/Energetic", label: "动感 · 有活力" },
  { value: "Sentimental/Melancholic/Lonely", label: "伤感 · 孤独" },
  { value: "Inspirational/Hopeful", label: "励志 · 充满希望" },
  { value: "Nostalgic/Memory", label: "怀旧" },
  { value: "Excited", label: "兴奋" },
  { value: "Sorrow/Sad", label: "悲伤" },
  { value: "Chill", label: "松弛 · Chill" },
  { value: "Romantic", label: "浪漫" },
];

/** 音色（人声）。 */
export const TIMBRE_OPTIONS: GenOption[] = [
  { value: "Warm", label: "温暖" },
  { value: "Bright", label: "明亮" },
  { value: "Husky", label: "沙哑" },
  { value: "Electrified voice", label: "电音" },
  { value: "Sweet", label: "甜美" },
  { value: "Cute", label: "可爱" },
  { value: "Loud and sonorous", label: "嘹亮" },
  { value: "Powerful", label: "有力" },
  { value: "Sexy/Lazy", label: "慵懒" },
];

/** 演唱声线。 */
export const GENDER_OPTIONS: GenOption[] = [
  { value: "Female", label: "女声" },
  { value: "Male", label: "男声" },
];

/** 人声歌曲时长区间（秒）。 */
export const VOCAL_DURATION = { min: 30, max: 240, step: 10, default: 120 };

/** 纯音乐时长区间（秒）。 */
export const BGM_DURATION = { min: 30, max: 60, step: 5, default: 60 };

/** 创作模式。 */
export type ComposeMode = "inspiration" | "lyrics" | "instrumental";

export const COMPOSE_MODES: { id: ComposeMode; label: string; hint: string }[] = [
  { id: "inspiration", label: "灵感成曲", hint: "描述你想要的感觉，AI 写词谱曲并演唱" },
  { id: "lyrics", label: "我有歌词", hint: "粘贴你自己的歌词，AI 谱曲并演唱" },
  { id: "instrumental", label: "纯音乐", hint: "只要伴奏，不含人声" },
];

/** 歌词结构标签速查 —— 贴在歌词输入框旁，帮用户写出模型能识别的结构。 */
export const LYRIC_TAGS = ["[intro]", "[verse]", "[chorus]", "[bridge]", "[inst]", "[outro]"];

/** 把秒格式化成 "3:20"。 */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
