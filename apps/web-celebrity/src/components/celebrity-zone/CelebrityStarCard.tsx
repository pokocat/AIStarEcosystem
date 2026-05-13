"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, Lock, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CelebrityAuthStatus, CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import { AUTH_STATUS_META, CATEGORY_BADGE_CLASS } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
}

const AUTH_ICONS = {
  ShieldCheck,
  Clock,
  ShieldAlert,
  Lock,
} as const;

/**
 * 卡片封面上的徽章统一样式：实色背景 + 白字 + 投影，保证在任意亮度的封面图上
 * 都有足够对比度。AUTH_STATUS_META.badgeClass 仍用于详情页等深色背景内嵌位置。
 */
const COVER_BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold tracking-wide text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-white/30";

const AUTH_COVER_BADGE: Record<CelebrityAuthStatus, string> = {
  authorized: "bg-emerald-500/95",
  pending: "bg-amber-500/95",
  expired: "bg-pink-500/95",
  unauthorized: "bg-zinc-700/85",
};

/** 明星卡片：3:4 公开图 + 名字 + 热门 + 类目/价格 + 授权徽章 */
export function CelebrityStarCard({ star }: Props) {
  const auth = AUTH_STATUS_META[star.authorization.status];
  const Icon = AUTH_ICONS[auth.icon];

  return (
    <Link
      href={`/console/star/${star.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 transition hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-zinc-100 hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)]"
    >
      {/* 3:4 cover */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={star.cover}
          alt={star.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {/* 顶部右：热门 / 授权徽章（实色 + 白字 + 投影，保证亮背景下可读） */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          {star.isHot && (
            <span className={cn(COVER_BADGE_BASE, "bg-pink-500/95")}>
              <Flame className="h-3 w-3" /> 热门
            </span>
          )}
          <span
            className={cn(
              COVER_BADGE_BASE,
              AUTH_COVER_BADGE[star.authorization.status],
            )}
          >
            <Icon className="h-3 w-3" /> {auth.label}
          </span>
        </div>

        {/* 底部：起拍价 */}
        <div className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-white/65 px-2.5 py-[3px] text-[11px] font-semibold text-violet-100 ring-1 ring-violet-300/50 backdrop-blur-sm">
          {star.startingPrice}
        </div>
      </div>

      {/* 信息条 */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-zinc-800">{star.name}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px]",
              CATEGORY_BADGE_CLASS[star.category],
            )}
          >
            {star.category}
          </span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
          {star.description}
        </p>
      </div>
    </Link>
  );
}
