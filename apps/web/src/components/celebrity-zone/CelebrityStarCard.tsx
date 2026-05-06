"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, Lock, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CelebrityStar } from "@/types/celebrity-zone";
import {
  AUTH_STATUS_META,
  CATEGORY_BADGE_CLASS,
} from "@/constants/celebrity-zone-ui";
import { cn } from "@/components/ui/utils";

interface Props {
  star: CelebrityStar;
}

const AUTH_ICONS = {
  ShieldCheck,
  Clock,
  ShieldAlert,
  Lock,
} as const;

/** 明星卡片：3:4 公开图 + 名字 + 热门 + 类目/价格 + 授权徽章 */
export function CelebrityStarCard({ star }: Props) {
  const auth = AUTH_STATUS_META[star.authorization.status];
  const Icon = AUTH_ICONS[auth.icon];

  return (
    <Link
      href={`/producer/celebrity-zone/star/${star.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)]"
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

        {/* 顶部右：热门 / 授权徽章 */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          {star.isHot && (
            <span className="inline-flex items-center gap-1 rounded-md border border-pink-400/40 bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-200 backdrop-blur">
              <Flame className="h-3 w-3" /> 热门
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur",
              auth.badgeClass,
            )}
          >
            <Icon className="h-3 w-3" /> {auth.label}
          </span>
        </div>

        {/* 底部：起拍价 */}
        <div className="absolute bottom-2 left-2 inline-flex items-center rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-100 backdrop-blur">
          {star.startingPrice}
        </div>
      </div>

      {/* 信息条 */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-white/90">{star.name}</span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px]",
              CATEGORY_BADGE_CLASS[star.category],
            )}
          >
            {star.category}
          </span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-white/45">
          {star.description}
        </p>
      </div>
    </Link>
  );
}
