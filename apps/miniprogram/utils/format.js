// 与 apps/web/src/lib/format.ts 形状一致；小程序里所有展示层都走这里。
// 数字字段保持原始 number / bigint，**不做"128K"格式化**，仅在渲染前调用本工具。

/** 大数压缩：12345 → "1.2w"；1234567 → "123.5w" */
function formatCompactNumber(n) {
  if (n == null) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num);
  if (abs >= 1_0000_0000) return (num / 1_0000_0000).toFixed(1) + "亿";
  if (abs >= 1_0000) return (num / 1_0000).toFixed(1) + "w";
  if (abs >= 1000) return (num / 1000).toFixed(1) + "k";
  return String(num);
}

/** 货币：49210 → "¥49,210"；49210.5 → "¥49,210.50" */
function formatCurrency(n, currency) {
  if (n == null) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const sym = currency || "¥";
  const fixed = Number.isInteger(num) ? String(num) : num.toFixed(2);
  const [int, frac] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sym + withSep + (frac ? "." + frac : "");
}

/** 积分：48290 → "48,290" */
function formatCredits(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("zh-CN");
}

/** 时长：30 → "00:30"；75 → "01:15" */
function formatDuration(seconds) {
  if (seconds == null) return "—";
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

/** 百分比：0.624 → "62.4%" */
function formatPercent(n, fractionDigits) {
  if (n == null) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return (num * 100).toFixed(fractionDigits == null ? 1 : fractionDigits) + "%";
}

/** 激活码格式化：xxxx-xxxx-xxxx，自动转大写 + 加分隔符 */
function formatActivationCode(raw) {
  if (!raw) return "";
  const s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const parts = [];
  for (let i = 0; i < s.length; i += 4) parts.push(s.slice(i, i + 4));
  return parts.join("-");
}

module.exports = {
  formatCompactNumber,
  formatCurrency,
  formatCredits,
  formatDuration,
  formatPercent,
  formatActivationCode,
};
