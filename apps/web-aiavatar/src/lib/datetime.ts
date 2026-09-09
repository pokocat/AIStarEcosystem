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

// 实现在共享包（`packages/api-client/src/format.ts`）—— 它跟 formatCredits /
// formatDuration 是同一类东西，五个 app 都要用，不该有五份。这里只转出去，
// 好处是本 app 的调用点仍写 `@/lib/datetime`，不必每个页面都从 api-client 引。
export { formatDateTime } from "@ai-star-eco/api-client";
