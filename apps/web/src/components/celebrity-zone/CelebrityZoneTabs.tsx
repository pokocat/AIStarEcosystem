"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ZONE_TABS, type ZoneTabId } from "@/constants/celebrity-zone-ui";
import { cn } from "@/components/ui/utils";

interface Props {
  /** 服务端解析过的 active tab，避免 SSR 闪烁 */
  active: ZoneTabId;
  /** 是否高亮当前 active；子路由（生成页/明星详情）传 false：tabs 仍可见可点，但都不高亮 */
  highlight?: boolean;
}

/** 顶部 5 Tab：?tab=market|projects|products|library|data。市场为默认。 */
export function CelebrityZoneTabs({ active, highlight = true }: Props) {
  const params = useSearchParams();

  const buildHref = (tab: ZoneTabId) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (tab === "market") next.delete("tab");
    else next.set("tab", tab);
    const qs = next.toString();
    return qs ? `/producer/celebrity-zone?${qs}` : "/producer/celebrity-zone";
  };

  return (
    <div className="flex flex-wrap gap-1">
      {ZONE_TABS.map((t) => {
        const isActive = highlight && active === t.id;
        return (
          <Link
            key={t.id}
            href={buildHref(t.id)}
            scroll={false}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition",
              isActive ? "text-cyan-300" : "text-white/45 hover:text-white/80",
            )}
          >
            {t.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-cyan-400 to-cyan-300" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
