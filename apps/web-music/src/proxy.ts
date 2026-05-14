// proxy.ts — 兼容层（Next 16 中 middleware.ts 已重命名为 proxy.ts）。
// 原工作台挂在 /console；现已迁到顶层（/dashboard、/artist、/studio…）。
// 这里把所有遗留的 /console[?...] / /console/<seg> 链接 308 重定向到对应新路径。
// 下个版本（无残留旧书签时）可删除。

import { NextRequest, NextResponse } from "next/server";

// /console?tab=<id> → 对应顶层路径。overview 是 dashboard 的历史别名。
const TAB_MAP: Record<string, string> = {
  overview: "/dashboard",
  artist: "/artist",
  artists: "/artists",
  incubator: "/incubator",
  appearance: "/appearance",
  wardrobe: "/wardrobe",
  studio: "/studio",
  music: "/music",
  copyright: "/copyright",
  distribution: "/distribution",
  community: "/community",
  finance: "/finance",
  settings: "/settings",
};

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/console") {
    const tab = searchParams.get("tab");
    const target = (tab && TAB_MAP[tab]) ?? "/dashboard";
    const url = req.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

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
