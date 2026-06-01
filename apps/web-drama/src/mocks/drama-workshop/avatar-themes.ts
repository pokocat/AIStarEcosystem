// 数字人色卡主题 — 设计真源 data.js `avatarTheme`。
// 跨项目统一注册；Avatar 组件按 key 索引。

export interface AvatarTheme {
  from: string;
  to: string;
  label: string;
}

export const AVATAR_THEMES: Record<string, AvatarTheme> = {
  default: { from: "#cbd5e1", to: "#e2e8f0", label: "?" },

  // 落地窗后（悬疑）
  linxia: { from: "#a78bfa", to: "#f0abfc", label: "林夏" },
  gu:     { from: "#60a5fa", to: "#22d3ee", label: "顾沉舟" },
  boss:   { from: "#34d399", to: "#a3e635", label: "苏总" },
  zhou:   { from: "#fbbf24", to: "#fb923c", label: "老周" },
  girl:   { from: "#f472b6", to: "#fda4af", label: "小满" },

  // 重生后她在冷宫杀疯了（宫斗）
  shenzhao: { from: "#e879f9", to: "#f0abfc", label: "沈昭" },
  xiaoheng: { from: "#818cf8", to: "#38bdf8", label: "萧珩" },
  queen:    { from: "#fb7185", to: "#f43f5e", label: "皇后" },
  chuntao:  { from: "#fcd34d", to: "#fb923c", label: "春桃" },

  // 闪婚老公竟是隐藏首富（都市甜宠）
  suwan:  { from: "#fda4af", to: "#fbcfe8", label: "苏晚" },
  lushen: { from: "#38bdf8", to: "#6366f1", label: "陆深" },
  qin:    { from: "#a3e635", to: "#34d399", label: "秦助理" },
  mom:    { from: "#fbbf24", to: "#f59e0b", label: "陆母" },

  // 星核纪元（科幻）
  lingxiao: { from: "#22d3ee", to: "#3b82f6", label: "凌霄" },
  ita:      { from: "#a78bfa", to: "#6366f1", label: "伊塔" },
  kron:     { from: "#94a3b8", to: "#475569", label: "克戎" },

  // 向阳而生（公益）
  lixiao: { from: "#34d399", to: "#22d3ee", label: "李晓" },
  tudou:  { from: "#fbbf24", to: "#fb923c", label: "土豆" },

  // 匠心智造（企业）
  spk: { from: "#f59e0b", to: "#ef4444", label: "代言人" },
  arm: { from: "#94a3b8", to: "#64748b", label: "机械臂" },
};

export type AvatarThemeKey = keyof typeof AVATAR_THEMES;
