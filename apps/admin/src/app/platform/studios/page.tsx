// /platform/studios 已并入 /platform/accounts（账号 ↔ 经纪公司 1:1）。
// 保留本路由作为兼容重定向，避免外链 / 历史页面 404。

import { redirect } from "next/navigation";

export default function StudiosRedirectPage(): never {
  redirect("/platform/accounts");
}
