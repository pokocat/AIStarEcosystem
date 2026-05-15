"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Coins, Plus, Wallet, Wand2 } from "lucide-react";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { CTA_PRIMARY_LG, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
  walletBalance: number;
  /** 本次生成的最低积分门槛（默认取最便宜引擎的 creditPrice） */
  requiredCredits: number;
  generateHref: string;
}

/**
 * 已授权 + 积分充足 → 醒目「开始生成」+「加入项目」CTA。
 * 已授权 + 积分不足 → 黄色「积分不足，立即充值」CTA。
 */
export function CelebrityHeroCta({
  star,
  walletBalance,
  requiredCredits,
  generateHref,
}: Props) {
  const canGenerate = walletBalance >= requiredCredits;
  const quotaUsed = star.quotaUsed ?? 0;
  const quotaTotal = star.quotaTotal ?? 0;
  const quotaText =
    quotaTotal > 0 ? `${quotaUsed}/${quotaTotal} 条` : "按量计费";

  if (!canGenerate) {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-gradient-to-r from-amber-500/[0.10] to-orange-500/[0.06] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15">
            <Coins className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-zinc-900">积分不足，无法生成</div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              当前钱包余额 <span className="text-amber-600 tabular-nums">✦{formatCredits(walletBalance)}</span>
              ，本次生成至少需要{" "}
              <span className="text-amber-600 tabular-nums">✦{formatCredits(requiredCredits)}</span>
              。请先充值积分，或更换更经济的引擎。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Link
              href="/producer/finance"
              className={cn(
                CTA_PRIMARY_LG,
                "bg-[var(--warning)] hover:opacity-90 hover:bg-[var(--warning)]",
              )}
            >
              <Wallet className="h-4 w-4" /> 立即充值
            </Link>
            <Link href="/projects" className={CTA_SECONDARY}>
              <Plus className="h-3.5 w-3.5" /> 加入项目
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/[0.08] via-violet-500/[0.06] to-pink-500/[0.05] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-600">
              ✓ 授权有效
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-violet-600">
              套餐余量 {quotaText}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 tabular-nums">
              <Coins className="h-3 w-3" /> ✦{formatCredits(walletBalance)}
            </span>
          </div>
          <div className="mt-1 text-base font-semibold text-zinc-900">
            一切就绪，开始为 {star.name} 生成带货视频
          </div>
          <p className="text-xs text-zinc-600">
            最低消耗 ✦{formatCredits(requiredCredits)} 积分起 · 视引擎档位浮动。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0">
          <Link href={generateHref} className={CTA_PRIMARY_LG}>
            <Wand2 className="h-4 w-4" /> 开始生成带货视频 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/projects" className={CTA_SECONDARY}>
            <Plus className="h-3.5 w-3.5" /> 加入项目
          </Link>
        </div>
      </div>
    </div>
  );
}
