"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

interface Props {
  totalPlays: string;
  totalConversions: string;
  activeStars: number;
}

/** P1 顶部 Hero：渐变 + 3 项关键指标 */
export function CelebrityMarketHero({ totalPlays, totalConversions, activeStars }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-cyan-500/[0.08] via-purple-500/[0.06] to-pink-500/[0.05] p-6">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -bottom-32 right-12 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-widest">
              AI Star Eco · 明星专区
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white/95 sm:text-3xl">
            真人授权 × AI 视频生成 × 全渠道分发
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            选择已授权的真人明星形象，输入商品信息，AI 自动生成带货短视频，并一键分发到抖音、快手、小红书等渠道。
          </p>
        </div>

        <div className="flex flex-wrap gap-6 lg:gap-8">
          <Stat label="累计播放" value={totalPlays} accent="text-cyan-300" />
          <Stat label="转化单数" value={totalConversions} accent="text-purple-300" />
          <Stat label="授权明星" value={`${activeStars} 位`} accent="text-pink-300" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
      <span className="mt-0.5 text-xs text-white/45">{label}</span>
    </div>
  );
}
