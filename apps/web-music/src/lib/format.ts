// ─────────────────────────────────────────────────────────────────────────────
// lib/format.ts — 统一展示层格式化工具。
// 所有数值字段在前端展示前必须经过本文件方法处理；
// 后端返回原始数值（见 product_spec.md §3.1）。
// ─────────────────────────────────────────────────────────────────────────────

export type CurrencyCode = "CNY" | "USD";

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  CNY: "¥",
  USD: "$",
};

/** 千分位分隔，无单位。例：128500 → "128,500" */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.trunc(n).toLocaleString("en-US");
}

/** 点数 / Credits。例：128500 → "128,500" */
export function formatCredits(credits: number): string {
  return formatNumber(credits);
}

/** 法币（后端单位「分」），渲染为带符号的两位小数文本。例：12850 / "CNY" → "¥128.50" */
export function formatCurrency(cents: number, currency: CurrencyCode = "CNY"): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const value = (cents || 0) / 100;
  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 紧凑数字：用于粉丝量、播放量。例：2300000 → "2.3M"，128000 → "128K" */
export function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return trimZero(abs / 1_000_000_000) + "B";
  if (abs >= 1_000_000) return trimZero(abs / 1_000_000) + "M";
  if (abs >= 1_000) return trimZero(abs / 1_000) + "K";
  return String(Math.trunc(n));
}

/** 百分比：传入 0–100 的整数。例：35.5 → "35.5%" */
export function formatPercent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

/** 带正负号的金额（用于流水）。正数显示 +¥..., 负数 -¥...。 */
export function formatSignedCurrency(cents: number, currency: CurrencyCode = "CNY"): string {
  const sign = cents >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(cents), currency)}`;
}

/** 带正负号的点数文案。例：+8200 / -20000 */
export function formatSignedCredits(credits: number): string {
  const sign = credits >= 0 ? "+" : "-";
  return `${sign}${formatCredits(Math.abs(credits))}`;
}

/** 时长（秒）→ "mm:ss" 或 "hh:mm:ss" */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.trunc(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * 时间戳 → `2026-05-06`（只到日；浏览器本地时区）。§4.8。
 *
 * 不要写 `iso.slice(0, 10)`：它切的是 UTC 段，晚上落库的记录在 +08 会显示成前一天。
 * 带时间的 ISO 串先换算到本地再取日；纯日历日（`2026-05-06`，无时间部分）原样返回，
 * 避免 `new Date("2026-05-06")` 按 UTC 零点解析导致西区倒退一天。
 */
export function formatDate(iso?: string | null, fallback = ""): string {
  if (!iso) return fallback;
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return fallback;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
