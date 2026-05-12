"use client";

import * as React from "react";
import { ArrowRight, Dice5, LayoutTemplate, Sparkles } from "lucide-react";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { CELEBRITY_TEMPLATES } from "@/mocks/celebrity-zone";
import type { GenerationMode, CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

interface Props {
  star: CelebrityStar;
  onSelectMode: (mode: GenerationMode) => void;
  onSwitchStar?: () => void;
}

/** Step 1：生成模式选择页（模板 / 盲盒）。两卡顶部 / 媒体区 / 底部 CTA 三段对齐。 */
export function CelebrityModeSelect({ star, onSelectMode, onSwitchStar }: Props) {
  // 取前 3 个模板的预览视频做模板卡的媒体区缩略
  const templatePreviews = React.useMemo(
    () =>
      CELEBRITY_TEMPLATES.slice(0, 3).map((t, i) => ({
        thumb: t.previews?.[0]?.thumb,
        videoUrl: t.previews?.[0]?.videoUrl,
        label: t.name,
        key: `${t.id}-${i}`,
      })),
    [],
  );

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
            {star.pricingTier ?? "未购套餐"} ·
            已用 {star.quotaUsed ?? 0}/{star.quotaTotal ?? 0} 条
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

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        {/* 模板生成 */}
        <ModeCard
          accent="cyan"
          icon={<LayoutTemplate className="h-5 w-5 text-cyan-300" />}
          title="模板生成"
          tag="推荐"
          description="选择模板 → 填入商品 → 确定性输出。适合有明确带货需求的场景。"
          tags={["✓ 确定性高", "✓ 效果可控", "✓ 多模板可选"]}
          onClick={() => onSelectMode("template")}
          ctaLabel="选择模板"
          ctaIcon={<ArrowRight className="h-4 w-4" />}
          media={
            <div className="flex h-full items-center justify-center gap-2">
              {templatePreviews.map((p) => (
                <CelebrityVideoPlayer
                  key={p.key}
                  src={p.videoUrl ?? ""}
                  poster={p.thumb}
                  aspect="9/16"
                  className="h-full w-auto shrink-0"
                />
              ))}
            </div>
          }
        />

        {/* 盲盒生成 */}
        <ModeCard
          accent="purple"
          icon={<Dice5 className="h-5 w-5 text-purple-300" />}
          title="AI 自主生成"
          tag="开盲盒"
          description="只需输入商品信息，AI 自主决定脚本、风格、节奏。适合探索新玩法。"
          tags={["✓ 创意惊喜", "✓ 省心省力", "⚡ 可能翻车"]}
          onClick={() => onSelectMode("blindbox")}
          ctaLabel="开盲盒"
          ctaIcon={<Dice5 className="h-4 w-4" />}
          media={
            <div className="flex h-full w-full items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-dashed border-purple-400/40 bg-purple-500/5">
                <Sparkles className="absolute right-1 top-1 h-3 w-3 text-purple-200/70" />
                <span className="text-5xl font-light text-purple-300">?</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

interface ModeCardProps {
  accent: "cyan" | "purple";
  icon: React.ReactNode;
  title: string;
  tag: string;
  description: string;
  tags: string[];
  media: React.ReactNode;
  ctaLabel: string;
  ctaIcon: React.ReactNode;
  onClick: () => void;
}

const ACCENT_STYLE = {
  cyan: {
    border: "border-cyan-500/25",
    bg: "from-cyan-500/[0.06] to-cyan-500/[0.02]",
    hover: "hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)]",
    iconBox: "border-cyan-400/40 bg-cyan-500/10",
    title: "text-cyan-200",
    tagBox: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    chipBox: "border-cyan-400/30 bg-cyan-500/[0.08] text-cyan-200/80",
    cta: "bg-gradient-to-r from-cyan-500 to-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.35)]",
    ctaHover: "group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]",
  },
  purple: {
    border: "border-purple-500/25",
    bg: "from-purple-500/[0.07] to-pink-500/[0.03]",
    hover: "hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.18)]",
    iconBox: "border-purple-400/40 bg-purple-500/10",
    title: "text-purple-200",
    tagBox: "border-purple-400/40 bg-purple-500/10 text-purple-200",
    chipBox: "border-purple-400/30 bg-purple-500/[0.08] text-purple-200/80",
    cta: "border-2 border-purple-400/50 bg-gradient-to-r from-purple-500/30 to-pink-500/20 text-purple-100",
    ctaHover: "group-hover:border-purple-300/80",
  },
} as const;

function ModeCard({
  accent,
  icon,
  title,
  tag,
  description,
  tags,
  media,
  ctaLabel,
  ctaIcon,
  onClick,
}: ModeCardProps) {
  const s = ACCENT_STYLE[accent];
  // 用 div[role=button] 而不是 <button>：内部包含的视频缩略组件本身有 <button>，嵌套会触发 hydration error。
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex h-full cursor-pointer flex-col rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} p-6 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${s.hover}`}
    >
      {/* 顶部固定区（图标 + 标题 + 描述 + 标签） */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${s.iconBox}`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-semibold ${s.title}`}>{title}</span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] ${s.tagBox}`}>
                {tag}
              </span>
            </div>
            <div className="text-xs text-white/45">{description}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          {tags.map((t) => (
            <span key={t} className={`rounded-md border px-2 py-0.5 ${s.chipBox}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 媒体区：固定高度 + 居中，两卡完全对齐 */}
      <div className="my-5 flex h-[176px] items-center justify-center">
        {media}
      </div>

      {/* 底部 CTA：mt-auto 推到底端 */}
      <div
        className={`mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${s.cta} ${s.ctaHover}`}
      >
        {ctaLabel} {ctaIcon}
      </div>
    </div>
  );
}
