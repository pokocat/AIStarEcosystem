// 画布左上角的「返回」回到进画布之前的那一页，而不是一律回项目列表（2026-11-07 用户反馈：
// 从 AI 视频进画布后回不去）。AI 视频、AI 图片的地址带场景和草稿号，回去时页面按草稿把内容放回来。
//
// 不做成弹窗：场景页和画布写的是同一份草稿，叠在一起两边都会保存，容易撞版本冲突；
// 画布本来就占满全屏，弹窗也不会多露出什么。
//
// 记在 sessionStorage：每个标签页各记各的，刷新画布不丢，直接打开链接的新标签页没有记录，回项目。

/** 能作为返回目的地的页面，名字和导航栏一致。没列出来的页面（登录、回调、账号…）不当目的地。 */
const DESTINATIONS: readonly (readonly [RegExp, string])[] = [
  [/^\/video\/?$/, "AI 视频"],
  [/^\/image\/?$/, "AI 图片"],
  [/^\/create\/?$/, "画布"],
  [/^\/director(\/|$)/, "短剧导演台"],
  [/^\/projects\/demos(\/|$)/, "灵感"],
  [/^\/projects\/?$/, "项目"],
  [/^\/assets(\/|$)/, "资产"],
  [/^\/ips\/?$/, "资产"],
  [/^\/templates(\/|$)/, "灵感"],
  [/^\/distribution(\/|$)/, "发行"],
  [/^\/dashboard\/?$/, "首页"],
  [/^\/$/, "首页"],
];

const STORAGE_KEY = "studio:canvas-return";

export type CanvasReturn = { href: string; label: string };
export const CANVAS_RETURN_DEFAULT: CanvasReturn = { href: "/projects", label: "项目" };

/** /projects/{id} 是画布；/projects/demos 是普通列表页。 */
export const isCanvasPath = (pathname: string) =>
  /^\/projects\/[^/]+\/?$/.test(pathname) && pathname.replace(/\/$/, "") !== "/projects/demos";

const labelOf = (pathname: string) => DESTINATIONS.find(([path]) => path.test(pathname))?.[1];

/**
 * 记下当前页。在画布里不动（画布之间跳转、刷新都还回最初那一页）；
 * 到了不能当目的地的页面就清掉，免得回到更早的不相干页面。
 */
export function rememberCanvasReturn(pathname: string, search: string) {
  if (isCanvasPath(pathname)) return;
  try {
    if (labelOf(pathname)) window.sessionStorage.setItem(STORAGE_KEY, search ? `${pathname}?${search}` : pathname);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* 隐私模式下存不了：返回项目列表，不影响使用 */ }
}

export function readCanvasReturn(): CanvasReturn {
  try {
    const href = window.sessionStorage.getItem(STORAGE_KEY);
    // 只认站内路径，`//evil.com` 这种协议相对地址不算
    if (!href || !href.startsWith("/") || href.startsWith("//")) return CANVAS_RETURN_DEFAULT;
    const label = labelOf(href.split("?")[0]);
    return label ? { href, label } : CANVAS_RETURN_DEFAULT;
  } catch {
    return CANVAS_RETURN_DEFAULT;
  }
}
