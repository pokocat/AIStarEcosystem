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
 * 卡片封面上的徽章统一样式：实色背景 + 白字 + 柔投影，覆盖在明星封面图片上
 * 需要对抗任意亮度的图像背景，故保留 ring + 阴影（但 ring 改 white/40 更轻盈）。
 */
const COVER_BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-semibold tracking-wide text-white shadow-[var(--shadow-lift)] ring-1 ring-white/40";

const AUTH_COVER_BADGE: Record<CelebrityAuthStatus, string> = {
  authorized: "bg-emerald-500",
  pending: "bg-amber-500",
  expired: "bg-pink-500",
  unauthorized: "bg-zinc-700",
};

/** 明星卡片：3:4 公开图 + 名字 + 热门 + 类目/价格 + 授权徽章 */
export function CelebrityStarCard({ star }: Props) {
  const auth = AUTH_STATUS_META[star.authorization.status];
  const Icon = AUTH_ICONS[auth.icon];

  return (
    <Link
      href={`/star/${star.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]"
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

        {/* 顶部右：热门 / 授权徽章（实色 + 白字 + 柔阴影，对抗封面图像） */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          {star.isHot && (
            <span className={cn(COVER_BADGE_BASE, "bg-pink-500")}>
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

        {/* 底部：起拍价（覆盖在图像上，半透明白底 + 紫罗兰深字） */}
        <div className="absolute bottom-2 left-2 inline-flex items-center rounded-full bg-white/90 px-2.5 py-[3px] text-[11px] font-semibold text-violet-700 ring-1 ring-white/60 backdrop-blur-sm">
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
        <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-600">
          {star.description}
        </p>
      </div>
    </Link>
  );
}
