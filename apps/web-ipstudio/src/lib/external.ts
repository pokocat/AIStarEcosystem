// 站外地址 —— 只有 aiavatar 一处。
//
// 名片公开页与数字资产平台都在 aiavatar 站点上（工作台与它共用一份开通、同一套接口，
// 但各自是独立的前端应用）。`NEXT_PUBLIC_*` 是**构建期**内联的，改这个值必须重新构建，
// 光改服务器上的 env 文件不生效。

export const AIAVATAR_URL = process.env.NEXT_PUBLIC_AIAVATAR_URL ?? "http://localhost:3013";

/**
 * 名片公开页的完整地址。
 *
 * 服务端返回的 `publicUrl` 是站内路径（`/card/p/<slug>`），而名片页在 aiavatar 站点上，
 * 不在工作台 —— 直接把这个相对路径当 href 会跳到工作台自己的 404。
 */
export function cardPublicHref(publicUrl: string): string {
  if (/^https?:\/\//i.test(publicUrl)) return publicUrl;
  return `${AIAVATAR_URL}${publicUrl.startsWith("/") ? "" : "/"}${publicUrl}`;
}
