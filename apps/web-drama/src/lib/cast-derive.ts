// 演员卡片显示字段派生工具：从 Artist 类型计算出 UI 用的色调、渐变、保真度、播放、收益等。
// 复用：总览视图（前 4 张精简卡片）和演员阵容全屏视图都需要。

import type { Artist } from "@ai-star-eco/types/artist";

export type CastTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "neutral";

export interface CastView {
  id: string;
  name: string;
  role: string;
  fidelity: number;
  series: number;
  plays: string;
  revenue: string;
  tone: CastTone;
  gradient: string;
}

export const QUALITY_TONE: Record<Artist["quality"], CastTone> = {
  legendary: "accent",
  epic: "violet",
  rare: "info",
  common: "neutral",
};

export const QUALITY_GRADIENT: Record<Artist["quality"], string> = {
  legendary: "linear-gradient(135deg, rgba(212,175,106,0.55), rgba(234,215,168,0.3))",
  epic: "linear-gradient(135deg, rgba(164,76,255,0.5), rgba(61,224,255,0.3))",
  rare: "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(76,224,160,0.3))",
  common: "linear-gradient(135deg, rgba(86,81,106,0.6), rgba(38,31,54,0.4))",
};

export const QUALITY_LABEL: Record<Artist["quality"], string> = {
  legendary: "S 类",
  epic: "A 类",
  rare: "B 类",
  common: "C 类",
};

// v0.197：短剧端的「演员」就是数字人，没有「在线 / 出道期 / 休养」这些偶像孵化的说法（音乐线沿用下来的）。
// 页面按钮与筛选都叫「归档」，徽标也叫「已归档」，不再写「退役」。
export const STATUS_LABEL: Record<Artist["status"], string> = {
  active: "可出演",
  trainee: "制作中",
  debut: "可出演",
  rest: "暂停使用",
  retired: "已归档",
};

const STATUS_HINT: Record<Artist["status"], string> = {
  active: "",
  trainee: "（制作中）",
  debut: "",
  rest: "（暂停使用）",
  retired: "（已归档）",
};

export function formatCompact(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCny(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `¥${Math.round(n / 1_000)}K`;
  return `¥${n}`;
}

export function deriveRole(a: Artist): string {
  // 引入数字人创建的艺人可能没有 bio（空串兜底）
  const firstClause = (a.bio ?? "").split(/[，,。.;；]/)[0].trim();
  const rawHint = STATUS_HINT[a.status] ?? "";
  const statusHint = rawHint && !firstClause.includes(rawHint) ? rawHint : "";
  // v0.197：不再拼「S 类 / C 类」等级 —— 从 AiAvatar 引入的数字人一律是 C 类，这个等级在短剧端没有意义。
  if (!firstClause) {
    return `数字人${statusHint}`;
  }
  return `${firstClause}${statusHint}`;
}

export function deriveCastView(a: Artist): CastView {
  return {
    id: a.id,
    name: a.name,
    role: deriveRole(a),
    fidelity: Math.max(a.talents.acting, Math.min(a.stats.popularity, 95)),
    series: a.stats.dramas,
    plays: formatCompact(a.stats.fans * 200),
    revenue: formatCny(a.stats.revenue),
    tone: QUALITY_TONE[a.quality],
    gradient: QUALITY_GRADIENT[a.quality],
  };
}
