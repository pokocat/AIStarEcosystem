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

export const STATUS_LABEL: Record<Artist["status"], string> = {
  active: "在线",
  trainee: "训练中",
  debut: "出道期",
  rest: "休养",
  retired: "退役",
};

const STATUS_HINT: Record<Artist["status"], string> = {
  active: "",
  trainee: "（训练中）",
  debut: "（出道期）",
  rest: "（休养）",
  retired: "（退役）",
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
  if (!firstClause) {
    return `${QUALITY_LABEL[a.quality]}${statusHint}`;
  }
  if (/[A-Z]\s*类|S\s*类|[一二三四五六七八九十]\s*类/.test(firstClause)) {
    return `${firstClause}${statusHint}`;
  }
  return `${firstClause}${statusHint} · ${QUALITY_LABEL[a.quality]}`;
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
