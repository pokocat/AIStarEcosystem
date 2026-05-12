"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Flame, RefreshCcw } from "lucide-react";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import {
  AUTH_STATUS_META,
  CATEGORY_BADGE_CLASS,
  ENGINE_META,
} from "@/constants/celebrity-zone-ui";
import { CelebrityAuthBanner } from "./CelebrityAuthBanner";
import { CelebrityPricingTierCard } from "./CelebrityPricingTierCard";
import { CelebrityHeroCta } from "./CelebrityHeroCta";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { useProducerShell } from "@/lib/celebrity-shell-context";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
}

const CHEAPEST_CREDIT_PRICE = Math.min(
  ...Object.values(ENGINE_META).map((m) => m.creditPrice),
);

/** P2 明星详情：左资料 + 右示例/套餐；已授权且积分够时顶部显示醒目 CTA。 */
export function CelebrityStarDetail({ star }: Props) {
  const { wallet } = useProducerShell();
  const auth = AUTH_STATUS_META[star.authorization.status];
  const isAuthorized = star.authorization.status === "authorized";
  const generateHref = `/console/star/${star.id}/generate`;
  const walletBalance = wallet?.totalBalance ?? 0;

  const currentTier = isAuthorized
    ? star.pricing.find((t) => t.name === star.pricingTier)
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部：返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Link
          href="/console"
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

      {/* 已授权 → 醒目 Hero CTA（积分不足切到充值态） */}
      {isAuthorized && (
        <CelebrityHeroCta
          star={star}
          walletBalance={walletBalance}
          requiredCredits={CHEAPEST_CREDIT_PRICE}
          generateHref={generateHref}
        />
      )}

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

        {/* 右：示例 + 套餐 */}
        <div className="flex flex-col gap-4">
          {/* 示例视频（真实可播放） */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">示例视频</span>
              <span className="text-[11px] text-white/35">
                {star.sampleVideos.length} 个样片 · 点击播放
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {star.sampleVideos.slice(0, 8).map((sv) => (
                <div key={sv.id} className="flex flex-col gap-1.5">
                  <CelebrityVideoPlayer
                    src={sv.videoUrl ?? ""}
                    poster={sv.thumb}
                    aspect="9/16"
                  />
                  <div className="px-0.5">
                    <div className="text-[11px] font-medium text-white/85">
                      {sv.label}
                    </div>
                    <div className="text-[10px] text-white/40">{sv.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 套餐：按授权态分支 */}
          {isAuthorized && currentTier ? (
            <CurrentTierBlock star={star} />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentTierBlock({ star }: { star: CelebrityStar }) {
  const tier = star.pricing.find((t) => t.name === star.pricingTier);
  if (!tier) return null;
  const used = star.quotaUsed ?? 0;
  const total = star.quotaTotal ?? 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.06] to-purple-500/[0.04] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/85">您的套餐</span>
          <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            ✓ 当前
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/console/star/${star.id}/apply`}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/20"
          >
            <ArrowUpRight className="h-3 w-3" /> 升级套餐
          </Link>
          <Link
            href={`/console/star/${star.id}/apply`}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:border-white/30 hover:text-white"
          >
            <RefreshCcw className="h-3 w-3" /> 续费
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="text-2xl font-bold text-cyan-200 tabular-nums">{tier.price}</div>
          <ul className="mt-2 flex flex-col gap-1 text-[11px] text-white/55">
            {tier.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/45">本月用量</span>
            <span className="tabular-nums text-white/85">{used}/{total} 条</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-white/35">
            提示：套餐余量耗尽后可继续按积分扣费生成。
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
