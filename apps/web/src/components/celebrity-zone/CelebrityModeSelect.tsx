"use client";

import * as React from "react";
import { ArrowRight, Dice5, LayoutTemplate, Sparkles } from "lucide-react";
import { CelebrityWatermarkVideo } from "./CelebrityWatermarkVideo";
import type { GenerationMode, CelebrityStar } from "@/types/celebrity-zone";

interface Props {
  star: CelebrityStar;
  onSelectMode: (mode: GenerationMode) => void;
  onSwitchStar?: () => void;
}

/** Step 1：生成模式选择页（模板 / 盲盒）。 */
export function CelebrityModeSelect({ star, onSelectMode, onSwitchStar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* 明星 mini 信息条 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
        <img
          src={star.avatar}
          alt={star.name}
          className="h-10 w-10 rounded-full object-cover border border-cyan-500/30"
        />
        <div className="flex flex-col">
          <div className="text-sm font-semibold">
            {star.name}
            <span className="ml-2 rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
              {star.category}
            </span>
          </div>
          <div className="text-[11px] text-white/40">
            {star.pricingTier} · 已用 {star.quotaUsed}/{star.quotaTotal} 条
          </div>
        </div>
        <div className="flex-1" />
        {onSwitchStar && (
          <button
            onClick={onSwitchStar}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
          >
            换明星
          </button>
        )}
      </div>

      <div>
        <div className="text-sm text-white/45">选择生成模式</div>
        <div className="mt-1 text-[12px] text-white/30">
          模板生成确定性强、效果可控；盲盒模式由 AI 自由发挥，更省心、有惊喜。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 模板生成 */}
        <button
          onClick={() => onSelectMode("template")}
          className="group relative flex flex-col gap-4 rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.06] to-cyan-500/[0.02] p-6 text-left transition hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10">
              <LayoutTemplate className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-cyan-200">模板生成</span>
                <span className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                  推荐
                </span>
              </div>
              <div className="text-xs text-white/45">
                基于成熟模板生成，效果稳定可预期
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-white/55">
            选择模板 → 填入商品 → 确定性输出。适合有明确带货需求的场景。
          </p>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {["确定性高", "效果可控", "多模板可选"].map((t) => (
              <span
                key={t}
                className="rounded-md border border-cyan-400/30 bg-cyan-500/[0.08] px-2 py-0.5 text-cyan-200/80"
              >
                ✓ {t}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["种草模板", "测评模板", "开箱模板"].map((t) => (
              <CelebrityWatermarkVideo key={t} label={t} />
            ))}
          </div>

          <div className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(6,182,212,0.35)] transition group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            选择模板 <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* 盲盒生成 */}
        <button
          onClick={() => onSelectMode("blindbox")}
          className="group relative flex flex-col gap-4 rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.07] to-pink-500/[0.03] p-6 text-left transition hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.18)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/40 bg-purple-500/10">
              <Dice5 className="h-5 w-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-purple-200">AI 自主生成</span>
                <span className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-200">
                  开盲盒
                </span>
              </div>
              <div className="text-xs text-white/45">
                AI 自由发挥创意，可能产出意想不到的优质内容
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-white/55">
            只需输入商品信息，AI 自主决定脚本、风格、节奏。适合探索新玩法。
          </p>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-md border border-purple-400/30 bg-purple-500/[0.08] px-2 py-0.5 text-purple-200/80">
              ✓ 创意惊喜
            </span>
            <span className="rounded-md border border-purple-400/30 bg-purple-500/[0.08] px-2 py-0.5 text-purple-200/80">
              ✓ 省心省力
            </span>
            <span className="rounded-md border border-amber-400/30 bg-amber-500/[0.08] px-2 py-0.5 text-amber-200/80">
              ⚡ 可能翻车
            </span>
          </div>

          <div className="flex items-center justify-center py-6">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-dashed border-purple-400/40 bg-purple-500/5">
              <Sparkles className="absolute right-1 top-1 h-3 w-3 text-purple-200/70" />
              <span className="text-4xl font-light text-purple-300">?</span>
            </div>
          </div>
          <div className="text-center text-xs text-white/35">
            AI 将根据明星特质和商品属性自由创作
          </div>

          <div className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-purple-400/50 bg-gradient-to-r from-purple-500/30 to-pink-500/20 px-4 py-2.5 text-sm font-semibold text-purple-100 transition group-hover:border-purple-300/80">
            开盲盒 <Dice5 className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}
