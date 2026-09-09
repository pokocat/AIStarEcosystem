"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 全局外壳挂载点。挂在根 layout 上，但**不是每个页面都挂**：
//
//   /card/p/*      公开名片页 —— 匿名访客看的对外页面，不能套产品导航
//   /login         登录页
//   /auth/callback OIDC 回调中转
//
// 这三类之外的应用页，**桌面形态**显示顶栏。手机形态什么都不加，
// 底部 tab 栏仍由各页面经 HubScreen 渲染（桌面形态下由 globals.css 隐藏）。
// 形态怎么定：见 shell/layout-mode.ts —— 默认按视口 960 判，用户可以显式切换。
//
// body 上的 has-desktop-bar 类负责给固定顶栏让出高度 —— 只在挂了顶栏的页面加，
// 否则公开名片页顶部会平白多出 52px 空白。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { auth, USE_MOCK } from "@/proto/api";
import { DesktopTopBar } from "./desktop-top-bar";
import { useLayoutMode } from "./layout-mode";

const BARE_PREFIXES = ["/card/p/", "/login", "/auth/callback"];
/** 精确匹配（不走前缀）：根目录是落地页，它自带一条顶栏，不能再叠一条产品导航。 */
const BARE_EXACT = ["/"];

export function AppChrome() {
  // 订阅形态：这是根布局里**唯一常驻**的客户端组件，靠它保证「视口变了 →
  // <html data-layout> 跟着改」在每一页都生效（见 shell/layout-mode.ts）。
  useLayoutMode();
  const pathname = usePathname() ?? "";
  const bare = BARE_EXACT.includes(pathname)
    || BARE_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));

  // 顶栏那几个入口全都要登录才进得去 —— 给访客看等于给一排点了就弹登录的链接。
  // 判定与首页那套一致（app/page.tsx）：挂载后读 auth.isAuthed()，初值 false。
  // 初值取 false 而不是 true：SSR 与首帧都不渲染顶栏，既不会 hydration 不匹配，
  // 也不会让访客先看到一排导航再消失。已登录用户晚一拍出现，代价可以接受。
  //
  // 不用 useSearchParams 读 `?landing=1`：那个 hook 在根 layout 里会要求 Suspense
  // 边界，否则 `/_not-found` 的静态预渲染直接失败（本次踩过）。反正这段只在挂载后
  // 跑，直接读 window.location.search 更省事。
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const forcedLanding = new URLSearchParams(window.location.search).get("landing") === "1";
    setShow(!bare && (USE_MOCK || auth.isAuthed()) && !forcedLanding);
  }, [bare, pathname]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("has-desktop-bar", show);
    return () => document.body.classList.remove("has-desktop-bar");
  }, [show]);

  if (!show) return null;
  return <DesktopTopBar />;
}
