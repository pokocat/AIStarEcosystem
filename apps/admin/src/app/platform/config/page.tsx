// /platform/config 已并入 /base/presets（孵化 / 锻造炉 预设）。
// 保留本路由作为兼容重定向。

import { redirect } from "next/navigation";

export default function PlatformConfigRedirectPage(): never {
  redirect("/base/presets");
}
