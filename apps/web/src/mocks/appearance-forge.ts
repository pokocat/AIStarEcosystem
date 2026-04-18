// ─────────────────────────────────────────────────────────────────────────────
// mocks/appearance-forge.ts — AI 形象锻造炉样本数据（中文）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ColorScheme,
  FaceSlider,
  ForgeOptions,
  ForgeResult,
  ForgeTemplate,
  LabeledOption,
} from "@/types/appearance-forge";

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  { id: "t1", name: "霓虹偶像", image: "https://images.unsplash.com/photo-1587930708915-55a36837263b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBuZW9uJTIwcG9ydHJhaXQlMjBmdXR1cmlzdGljfGVufDF8fHx8MTc3NjQxNDc1N3ww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["cyberpunk", "neon", "idol"], style: "neon" },
  { id: "t2", name: "暗黑歌姬", image: "https://images.unsplash.com/photo-1760493608711-09ead5e0b7ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWVzdGhldGljJTIwYW5pbWUlMjBzdHlsZSUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NjQxNDc1OHww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["dark", "gothic", "singer"], style: "dark" },
  { id: "t3", name: "未来超模", image: "https://images.unsplash.com/photo-1633767448616-85ff30bdb047?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwZmFzaGlvbiUyMG1vZGVsJTIwbmVvbnxlbnwxfHx8fDE3NzY0MTQ3NTh8MA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["futuristic", "fashion", "elegant"], style: "future" },
  { id: "t4", name: "街头叛客", image: "https://images.unsplash.com/photo-1642522501650-ff7d99154e98?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBzdHJlZXQlMjBzdHlsZSUyMGZhc2hpb258ZW58MXx8fHwxNzc2NDE0NzU5fDA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["street", "punk", "rebel"], style: "street" },
  { id: "t5", name: "全息幻影", image: "https://images.unsplash.com/photo-1764336312138-14a5368a6cd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob2xvZ3JhcGhpYyUyMGRpZ2l0YWwlMjBhcnQlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzY0MTQ3NjB8MA&ixlib=rb-4.1.0&q=80&w=1080", tags: ["holographic", "digital", "ethereal"], style: "holo" },
  { id: "t6", name: "哥特暗夜", image: "https://images.unsplash.com/photo-1762554561321-75a03de93c2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3RoaWMlMjBkYXJrJTIwZmFzaGlvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NjQxNDc2MHww&ixlib=rb-4.1.0&q=80&w=1080", tags: ["gothic", "dark", "mysterious"], style: "gothic" },
];

export const HAIR_STYLES: LabeledOption[] = [
  { id: "h1", label: "银色短发" },
  { id: "h2", label: "霓虹长发" },
  { id: "h3", label: "赛博莫西干" },
  { id: "h4", label: "全息渐变" },
  { id: "h5", label: "黑色直发" },
  { id: "h6", label: "粉色双马尾" },
];

export const EYE_COLORS: LabeledOption[] = [
  { id: "e1", label: "电光蓝",  color: "#00d4ff" },
  { id: "e2", label: "烈焰红",  color: "#ff2d55" },
  { id: "e3", label: "量子紫",  color: "#a855f7" },
  { id: "e4", label: "翡翠绿",  color: "#22c55e" },
  { id: "e5", label: "琥珀金",  color: "#f59e0b" },
  { id: "e6", label: "虹膜银",  color: "#94a3b8" },
];

export const STYLE_TAGS: LabeledOption[] = [
  { id: "s1", label: "赛博纹身" },
  { id: "s2", label: "机械义肢" },
  { id: "s3", label: "全息护目镜" },
  { id: "s4", label: "荧光耳饰" },
  { id: "s5", label: "数据面纹" },
  { id: "s6", label: "量子项圈" },
  { id: "s7", label: "光棱翅膀" },
  { id: "s8", label: "暗黑斗篷" },
];

export const FACE_SLIDERS: FaceSlider[] = [
  { id: "jawline",   label: "下颌线" },
  { id: "cheekbone", label: "颧骨" },
  { id: "eyeSize",   label: "眼型大小" },
  { id: "noseWidth", label: "鼻翼宽度" },
  { id: "lipFull",   label: "唇部丰满" },
  { id: "skinTone",  label: "肤色色调" },
];

export const COLOR_SCHEMES: ColorScheme[] = [
  { id: "cs1", name: "霓虹", colors: ["#00d4ff", "#a855f7"] },
  { id: "cs2", name: "烈焰", colors: ["#ef4444", "#f59e0b"] },
  { id: "cs3", name: "深海", colors: ["#0ea5e9", "#06b6d4"] },
  { id: "cs4", name: "暗夜", colors: ["#6366f1", "#1e1b4b"] },
];

export const PROMPT_SUGGESTIONS: string[] = [
  "赛博朋克",
  "未来主义",
  "极简优雅",
  "暗黑哥特",
  "复古蒸汽",
];

export const FORGE_OPTIONS: ForgeOptions = {
  templates: FORGE_TEMPLATES,
  hairStyles: HAIR_STYLES,
  eyeColors: EYE_COLORS,
  styleTags: STYLE_TAGS,
  faceSliders: FACE_SLIDERS,
  colorSchemes: COLOR_SCHEMES,
  promptSuggestions: PROMPT_SUGGESTIONS,
};

/** 历史记录：默认空，由组件在本地状态中追加。 */
export const FORGE_HISTORY: ForgeResult[] = [];
