// proxy.ts — 兼容层（Next 16 中 middleware.ts 已重命名为 proxy.ts）。
// 原工作台挂在 /console + ?tab=xxx；现已迁到顶层路径
// （/dashboard、/market、/cast、/projects、/products、/library、/data）。
// 详情页 /console/star/<id> → /star/<id>；/console/projects/<id> → /projects/<id>。
// 这里把所有遗留链接 308 重定向到对应新路径。下个版本（无残留旧书签时）可删除。

import { NextRequest, NextResponse } from "next/server";

// /console?tab=<id> → 对应顶层路径。无 tab 时 → /dashboard。
const TAB_MAP: Record<string, string> = {
  market: "/market",
  cast: "/cast",
  projects: "/projects",
  products: "/products",
  library: "/library",
  data: "/data",
};

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/console") {
    const tab = searchParams.get("tab");
    const target = (tab && TAB_MAP[tab]) ?? "/dashboard";
    const url = req.nextUrl.clone();
    url.pathname = target;
    // 透传其它 query（如 ?tier=trial、?action=distribute）；只去掉 tab。
    url.searchParams.delete("tab");
    return NextResponse.redirect(url, 308);
  }

  // /console/star/<id>/...  → /star/<id>/...
  // /console/projects/<id>  → /projects/<id>
  if (pathname.startsWith("/console/")) {
    const rest = pathname.replace(/^\/console/, "");
    const url = req.nextUrl.clone();
    url.pathname = rest || "/dashboard";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/console", "/console/:path*"],
};
