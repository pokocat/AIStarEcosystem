"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { CelebrityZoneTabs } from "./CelebrityZoneTabs";
import { PendingJobsBadge } from "./PendingJobsBadge";
import { STAR_DETAIL_MAP, CELEBRITY_PROJECTS } from "@/mocks/celebrity-zone";
import type { ZoneTabId } from "@/constants/celebrity-zone-ui";

type ResolvedTab = ZoneTabId | null;

interface Crumb {
  label: string;
  href?: string;
}

function resolveTabId(raw: string | null | undefined): ZoneTabId {
  if (raw === "projects" || raw === "library" || raw === "data" || raw === "products") return raw;
  return "market";
}

function buildCrumbs(pathname: string, sp: URLSearchParams): Crumb[] {
  const crumbs: Crumb[] = [{ label: "明星专区", href: "/console" }];
  // /console/star/[starId]
  const starMatch = pathname.match(/^\/console\/star\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (starMatch) {
    const starId = starMatch[1];
    const sub = starMatch[2];
    const star = STAR_DETAIL_MAP[starId];
    crumbs.push({
      label: star?.name ?? starId,
      href: `/console/star/${starId}`,
    });
    if (sub === "generate") crumbs.push({ label: "生成视频" });
    else if (sub === "apply") crumbs.push({ label: "申请合作" });
    return crumbs;
  }
  // /console/projects/[projectId]
  const projMatch = pathname.match(/^\/console\/projects\/([^/]+)\/?$/);
  if (projMatch) {
    const proj = CELEBRITY_PROJECTS.find((p) => p.id === projMatch[1]);
    crumbs.push({ label: `项目详情：${proj?.name ?? projMatch[1]}` });
    return crumbs;
  }
  // 主页：附加当前 tab
  if (pathname === "/console") {
    const tabId = resolveTabId(sp.get("tab"));
    const TAB_LABEL: Record<ZoneTabId, string> = {
      market: "明星市场",
      projects: "我的项目",
      products: "商品库",
      library: "视频库",
      data: "数据中心",
    };
    crumbs.push({ label: TAB_LABEL[tabId] });
  }
  return crumbs;
}

function activeTabFor(pathname: string, sp: URLSearchParams): ResolvedTab {
  if (pathname === "/console") return resolveTabId(sp.get("tab"));
  return null;
}

export function CelebrityZoneTopBar() {
  const pathname = usePathname() ?? "/console";
  const searchParams = useSearchParams();
  const sp = React.useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ""),
    [searchParams],
  );
  const crumbs = buildCrumbs(pathname, sp);
  const activeTab = activeTabFor(pathname, sp);

  return (
    <div className="flex flex-col gap-3 border-b border-white/5 pb-3">
      {/* 顶部一行：标题 + 面包屑 + 进行中任务徽章 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-white/85">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <span className="text-sm font-semibold tracking-tight">AI 明星专区</span>
          <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
            B 端 SaaS
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-1 text-[11px] text-white/45">
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-white/25" />}
              {c.href && i < crumbs.length - 1 ? (
                <Link href={c.href} className="transition hover:text-white/80">
                  {c.label}
                </Link>
              ) : (
                <span className={i === crumbs.length - 1 ? "text-white/75" : ""}>
                  {c.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className="flex-1" />
        <PendingJobsBadge />
      </div>

      {/* Tabs 始终可见，子路由不高亮但仍可点击跳回主页 */}
      <CelebrityZoneTabs active={activeTab ?? "market"} highlight={activeTab !== null} />
    </div>
  );
}
