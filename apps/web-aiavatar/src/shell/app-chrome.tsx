"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 全局外壳挂载点。挂在根 layout 上，但**不是每个页面都挂**：
//
//   /card/p/*      公开名片页 —— 匿名访客看的对外页面，不能套产品导航
//   /login         登录页
//   /auth/callback OIDC 回调中转
//
// 这三类之外的应用页，桌面（≥1024）显示顶栏。手机形态什么都不加，
// 底部 tab 栏仍由各页面经 HubScreen 渲染（globals.css 里 ≥1024 时把它隐藏）。
//
// body 上的 has-desktop-bar 类负责给固定顶栏让出高度 —— 只在挂了顶栏的页面加，
// 否则公开名片页顶部会平白多出 52px 空白。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { DesktopTopBar } from "./desktop-top-bar";

const BARE_PREFIXES = ["/card/p/", "/login", "/auth/callback"];

export function AppChrome() {
  const pathname = usePathname() ?? "";
  const bare = BARE_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("has-desktop-bar", !bare);
    return () => document.body.classList.remove("has-desktop-bar");
  }, [bare]);

  if (bare) return null;
  return <DesktopTopBar />;
}
