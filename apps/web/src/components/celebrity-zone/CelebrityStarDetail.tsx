"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Flame, Plus, Wand2 } from "lucide-react";
import type { CelebrityStar } from "@/types/celebrity-zone";
import {
  AUTH_STATUS_META,
  CATEGORY_BADGE_CLASS,
} from "@/constants/celebrity-zone-ui";
import { CelebrityAuthBanner } from "./CelebrityAuthBanner";
import { CelebrityPricingTierCard } from "./CelebrityPricingTierCard";
import { cn } from "@/components/ui/utils";

interface Props {
  star: CelebrityStar;
}

/** P2 明星详情：33% 资料 + 67% 示例/套餐/CTA。 */
export function CelebrityStarDetail({ star }: Props) {
  const auth = AUTH_STATUS_META[star.authorization.status];
  const isAuthorized = star.authorization.status === "authorized";
  const generateHref = `/producer/celebrity-zone/star/${star.id}/generate`;

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部：返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Link
          href="/producer/celebrity-zone"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/30 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </Link>
        <h1 className="text-lg font-semibold text-white/90">
          {star.name} · 明星详情
        </h1>
        {star.isHot && (
          <span className="inline-flex items-center gap-1 rounded-md border border-pink-400/40 bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-medium text-pink-200">
            <Flame className="h-3 w-3" /> 热门
          </span>
        )}
      </div>

      {/* 授权横幅（unauthorized / pending / expired 时） */}
      <CelebrityAuthBanner star={star} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* 左：资料 */}
        <div className="flex flex-col gap-4">
          {/* 个人信息 */}
          <div className="flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="relative w-full">
              <img
                src={star.cover}
                alt={star.name}
                loading="lazy"
                className="aspect-[3/4] w-full rounded-xl object-cover"
              />
              <span
                className={cn(
                  "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-white/30",
                  star.authorization.status === "authorized" && "bg-emerald-500/95",
                  star.authorization.status === "pending" && "bg-amber-500/95",
                  star.authorization.status === "expired" && "bg-rose-500/95",
                  star.authorization.status === "unauthorized" && "bg-zinc-700/85",
                )}
              >
                {auth.label}
              </span>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-white/95">
                {star.name}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px]",
                    CATEGORY_BADGE_CLASS[star.category],
                  )}
                >
                  {star.category}
                </span>
                {star.subCategories?.map((sc) => (
                  <span
                    key={sc}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px]",
                      CATEGORY_BADGE_CLASS[sc],
                    )}
                  >
                    {sc}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/50">
                {star.description}
              </p>
            </div>
          </div>

          {/* 授权信息 */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">授权信息</div>
            <dl className="space-y-2 text-xs">
              <Row k="状态" v={<span className={authToneClass(auth.tone)}>{auth.label}</span>} />
              {star.authorization.scenes.length > 0 && (
                <Row k="场景" v={star.authorization.scenes.join(" · ")} />
              )}
              {star.authorization.expireDate && (
                <Row k="有效期" v={star.authorization.expireDate} />
              )}
              <Row
                k="可用风格"
                v={`${star.authorization.availableStyles} 种`}
              />
              {star.pricingTier && (
                <Row
                  k="您的套餐"
                  v={`${star.pricingTier} · ${star.quotaUsed ?? 0}/${
                    star.quotaTotal ?? 0
                  } 条`}
                />
              )}
            </dl>
          </div>

          {/* 效果数据 */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">效果数据</div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="已生成" value={star.stats.totalGenerated.toString()} accent="text-cyan-300" />
              <Metric label="总播放" value={star.stats.totalPlays} accent="text-purple-300" />
              <Metric label="转化率" value={star.stats.conversionRate} accent="text-emerald-300" />
              <Metric label="GMV" value={star.stats.gmv} accent="text-pink-300" />
            </div>
          </div>
        </div>

        {/* 右：示例 + 套餐 + CTA */}
        <div className="flex flex-col gap-4">
          {/* 示例视频 */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">示例视频</span>
              <span className="text-[11px] text-white/35">
                {star.sampleVideos.length} 个样片
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {star.sampleVideos.slice(0, 8).map((sv) => (
                <div
                  key={sv.id}
                  className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/8"
                >
                  <img
                    src={sv.thumb}
                    alt={sv.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <div className="text-[11px] font-medium text-white">
                      {sv.label}
                    </div>
                    <div className="text-[10px] text-white/55">{sv.category}</div>
                  </div>
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap text-[10px] font-light text-white/15"
                    aria-hidden
                  >
                    AI Star Eco · 样片
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 套餐 */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">授权套餐</span>
              {!isAuthorized && (
                <span className="text-[11px] text-white/35">
                  授权通过后方可开通
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {star.pricing.map((tier) => (
                <CelebrityPricingTierCard
                  key={tier.id}
                  tier={tier}
                  authorized={isAuthorized}
                />
              ))}
            </div>
          </div>

          {/* 主 CTA */}
          <div className="flex flex-wrap items-center gap-3">
            {isAuthorized ? (
              <Link
                href={generateHref}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-purple-500 px-5 py-3 text-base font-semibold text-black shadow-[0_0_30px_rgba(6,182,212,0.35)] transition hover:shadow-[0_0_40px_rgba(168,85,247,0.45)] sm:flex-initial"
              >
                <Wand2 className="h-4 w-4" /> 开始生成带货视频 <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={auth.hint}
                className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-base font-semibold text-white/35 sm:flex-initial"
              >
                <Wand2 className="h-4 w-4" /> 开始生成带货视频
              </button>
            )}
            <Link
              href="/producer/celebrity-zone?tab=projects"
              className={cn(
                "inline-flex items-center gap-1 rounded-xl border px-5 py-3 text-sm font-medium transition",
                isAuthorized
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/20"
                  : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35",
              )}
              aria-disabled={!isAuthorized}
              onClick={(e) => {
                if (!isAuthorized) e.preventDefault();
              }}
            >
              <Plus className="h-3.5 w-3.5" /> 加入项目
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/40">{k}</dt>
      <dd className="text-white/75 text-right">{v}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] py-3">
      <span className={cn("text-xl font-bold tabular-nums", accent)}>{value}</span>
      <span className="mt-1 text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function authToneClass(tone: "success" | "warning" | "danger" | "muted") {
  switch (tone) {
    case "success":
      return "text-emerald-300";
    case "warning":
      return "text-amber-300";
    case "danger":
      return "text-rose-300";
    default:
      return "text-white/55";
  }
}
