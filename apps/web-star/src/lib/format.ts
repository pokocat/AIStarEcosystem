// ─────────────────────────────────────────────────────────────────────────────
// lib/format.ts — web-star 展示层格式化（中文语境）。
// 后端 / mocks 一律存原始整数（§4.5），所有展示文本经本文件派生。
// 通用工具复用 @ai-star-eco/api-client/format，此处补充中文单位形态。
// ─────────────────────────────────────────────────────────────────────────────

// formatDateTime 复用共享实现（`new Date(iso)` + `Intl`，按浏览器本地时区 → `yyyy-MM-dd HH:mm:ss`，
// §4.8）。此前 web-star 自写的版本用正则/`slice(0,10)` 直接抠 ISO 字符里的字面数字、不做时区换算：
// 服务端发的是 OffsetDateTime（UTC 时区 JVM 上带 `Z`），+08 的浏览器会看到差最多 8 小时、
// 16:00 UTC 之后还整整差一天——正是 §4.8 记的那个坑。约 21 处工作台展示（合作 / 白名单 / 肖像 /
// 数字人 / 品牌授权 / 侵权 / 商品库…）都经这两个函数，改这一处即全部修正。
export { formatNumber, formatPercent, formatDateTime } from "@ai-star-eco/api-client";

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

/** ISO 日期 → "2026-05-06"（按浏览器本地时区取年月日；禁止 `slice(0,10)` 切 UTC 段——§4.8）。 */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
