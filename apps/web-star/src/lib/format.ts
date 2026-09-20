// ─────────────────────────────────────────────────────────────────────────────
// lib/format.ts — web-star 展示层格式化（中文语境）。
// 后端 / mocks 一律存原始整数（§4.5），所有展示文本经本文件派生。
// 通用工具复用 @ai-star-eco/api-client/format，此处补充中文单位形态。
// ─────────────────────────────────────────────────────────────────────────────

export { formatNumber, formatPercent, formatDate } from "@ai-star-eco/api-client";

/** 金额（分）→ 整数价 "¥398"；非整元保留两位 "¥99.50"。 */
export function formatYuan(cents: number): string {
  const yuan = (cents || 0) / 100;
  if (Number.isInteger(yuan)) return `¥${yuan.toLocaleString("en-US")}`;
  return `¥${yuan.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 大额金额（分）→ 万元形态 "¥580万" / "¥16.2万"；万元以下回退整数价。 */
export function formatWanYuan(cents: number): string {
  const yuan = (cents || 0) / 100;
  if (Math.abs(yuan) >= 10_000) {
    const wan = yuan / 10_000;
    const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, "");
    return `¥${text}万`;
  }
  return formatYuan(cents);
}

/** 计数 → 中文万形态 "128.4万" / "4530万"；万以下千分位。 */
export function formatWan(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10_000) {
    const wan = n / 10_000;
    const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, "");
    return `${text}万`;
  }
  return Math.trunc(n).toLocaleString("en-US");
}

/** 秒 → "3分28秒" / "58秒"。 */
export function formatDurationZh(totalSec: number): string {
  const sec = Math.max(0, Math.trunc(totalSec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}秒`;
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

/** 月数 → "12个月" / "2年3个月"（账号年龄、授权期共用）。 */
export function formatMonthsZh(months: number): string {
  const m = Math.max(0, Math.trunc(months || 0));
  if (m < 12) return `${m}个月`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return rest > 0 ? `${years}年${rest}个月` : `${years}年`;
}

/**
 * ISO 时间 → "2026-05-06 14:30"（浏览器本地时区；无时间部分时仅日期）。
 *
 * §4.8：不能直接从 ISO 串上抠 `YYYY-MM-DD HH:mm` —— 那切的是 UTC，晚上八点之后
 * 落库的东西在 +08 页面上会显示成前一天、并差 8 小时。按本地时区解析后再拼，
 * 与 `@ai-star-eco/api-client` 的 formatDateTime 同一套时区口径（这里只到分钟）。
 * 纯日期串（无时间部分）没有时区含义，交给 formatDate 原样处理。
 */
export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "—";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
