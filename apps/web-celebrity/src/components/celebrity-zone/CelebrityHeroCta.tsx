"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Coins, Plus, Wallet, Wand2 } from "lucide-react";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import { formatCredits } from "@ai-star-eco/api-client/format";
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
      <div className="overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.06] p-5">
        <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15">
            <Coins className="h-5 w-5 text-amber-300" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-zinc-900">积分不足，无法生成</div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              当前钱包余额 <span className="text-amber-300 tabular-nums">✦{formatCredits(walletBalance)}</span>
              ，本次生成至少需要{" "}
              <span className="text-amber-300 tabular-nums">✦{formatCredits(requiredCredits)}</span>
              。请先充值积分，或更换更经济的引擎。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Link
              href="/producer/finance"
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
            >
              <Wallet className="h-4 w-4" /> 立即充值
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" /> 加入项目
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/[0.08] via-violet-500/[0.06] to-pink-500/[0.05] p-5">
      <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
              ✓ 授权有效
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-violet-200">
              套餐余量 {quotaText}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200 tabular-nums">
              <Coins className="h-3 w-3" /> ✦{formatCredits(walletBalance)}
            </span>
          </div>
          <div className="mt-1 text-base font-semibold text-zinc-900">
            一切就绪，开始为 {star.name} 生成带货视频
          </div>
          <p className="text-xs text-zinc-500">
            最低消耗 ✦{formatCredits(requiredCredits)} 积分起 · 视引擎档位浮动。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0">
          <Link
            href={generateHref}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500 px-5 py-3 text-sm font-bold text-zinc-50 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition hover:shadow-[0_0_36px_rgba(168,85,247,0.5)]",
            )}
          >
            <Wand2 className="h-4 w-4" /> 开始生成带货视频 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> 加入项目
          </Link>
        </div>
      </div>
    </div>
  );
}
