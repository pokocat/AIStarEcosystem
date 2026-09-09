// 时间戳统一显示成 `2026-09-09 14:49:36`（本地时区）。
//
// 此前各页各写各的：项目列表是「3 小时前」、资产详情与明星页是 `iso.slice(0, 10)`、
// 名片页干脆把整串 ISO 原样印在页脚（`REG · CARD-xxx · 2026-09-07T04:00:00Z`）。
//
// `slice(0, 10)` 还顺带错了 8 小时 —— 它切的是 UTC 那一段，晚上八点之后落库的东西
// 在页面上显示的是前一天。这里一律走 `Intl` 按浏览器本地时区格式化。
//
// 相对时间（「3 小时前」）也一并退役：它读着轻快，但要对时间做任何事
// （对账、报障、跟同事说是哪一版）都得先在脑子里换算一遍。

const FMT = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

/** `2026-09-09 14:49:36`。解析不出来返回 `fallback`（默认 `—`），不显示 `Invalid Date`。 */
export function formatDateTime(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const p = Object.fromEntries(FMT.formatToParts(d).map((x) => [x.type, x.value]));
  // 不同运行时给的连接符不一样（`2026/09/09` vs `2026-09-09`），按 part 自己拼稳当
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
