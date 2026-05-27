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
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
        {star.avatar ? (
          <img
            src={star.avatar}
            alt={star.name}
            className="h-10 w-10 rounded-full object-cover border border-violet-500/30"
          />
        ) : (
          <span
            aria-label={star.name}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/30 bg-zinc-100 text-sm font-semibold text-zinc-500"
          >
            {star.name.charAt(0)}
          </span>
        )}
        <div className="flex flex-col">
          <div className="text-sm font-semibold text-zinc-800">
            {star.name}
            <span className="ml-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600">
              {star.category}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500">
            {star.pricingTier ?? "未购套餐"} ·
            已用 {star.quotaUsed ?? 0}/{star.quotaTotal ?? 0} 条
          </div>
        </div>
        <div className="flex-1" />
        {onSwitchStar && (
          <button
            onClick={onSwitchStar}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            换明星
          </button>
        )}
      </div>

      <div>
        <div className="text-sm text-zinc-500">选择生成模式</div>
        <div className="mt-1 text-[12px] text-zinc-600">
          模板生成确定性强、效果可控；盲盒模式由 AI 自由发挥，更省心、有惊喜。
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        {/* 模板生成 */}
        <ModeCard
          accent="accent"
          icon={<LayoutTemplate className="h-5 w-5 text-violet-600" />}
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
                  src={p.videoUrl}
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
          accent="aurora"
          icon={<Dice5 className="h-5 w-5 text-violet-600" />}
          title="AI 自主生成"
          tag="开盲盒"
          description="只需输入商品信息，AI 自主决定脚本、风格、节奏。适合探索新玩法。"
          tags={["✓ 创意惊喜", "✓ 省心省力", "⚡ 可能翻车"]}
          onClick={() => onSelectMode("blindbox")}
          ctaLabel="开盲盒"
          ctaIcon={<Dice5 className="h-4 w-4" />}
          media={
            <div className="flex h-full w-full items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-dashed border-violet-400/50 bg-violet-500/10">
                <Sparkles className="absolute right-1 top-1 h-3 w-3 text-violet-500" />
                <span className="text-5xl font-light text-violet-600">?</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

interface ModeCardProps {
  accent: "accent" | "aurora";
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

// 两种 accent：accent（纯紫罗兰，模板模式）/ aurora（紫→粉 渐变，盲盒模式）
// 颜色与阴影全部走 var(--*) 令牌；不再使用 cyan/purple 等 dark-mode 残留命名。
const ACCENT_STYLE = {
  accent: {
    border: "border-violet-500/25",
    bg: "from-violet-500/[0.08] to-violet-500/[0.02]",
    hover: "hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]",
    iconBox: "border-violet-400/40 bg-violet-500/10",
    title: "text-zinc-800",
    tagBox: "border-violet-400/40 bg-violet-500/10 text-violet-600",
    chipBox: "border-violet-400/30 bg-violet-500/[0.08] text-violet-600",
    cta: "bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]",
    ctaHover: "group-hover:bg-[var(--accent-strong)] group-hover:shadow-[var(--shadow-lift)]",
  },
  aurora: {
    border: "border-violet-500/25",
    bg: "from-violet-500/[0.08] to-pink-500/[0.04]",
    hover: "hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]",
    iconBox: "border-violet-400/40 bg-violet-500/10",
    title: "text-zinc-800",
    tagBox: "border-violet-400/40 bg-violet-500/10 text-violet-600",
    chipBox: "border-violet-400/30 bg-violet-500/[0.08] text-violet-600",
    cta: "border-2 border-violet-400/50 bg-gradient-to-r from-violet-500 to-pink-400 text-white shadow-[var(--shadow-soft)]",
    ctaHover: "group-hover:border-violet-500 group-hover:shadow-[var(--shadow-lift)]",
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
      className={`group relative flex h-full cursor-pointer flex-col rounded-2xl border ${s.border} bg-gradient-to-br ${s.bg} p-6 text-left shadow-[var(--shadow-soft)] transition outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${s.hover}`}
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
            <div className="text-xs text-zinc-600">{description}</div>
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
        className={`mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition ${s.cta} ${s.ctaHover}`}
      >
        {ctaLabel} {ctaIcon}
      </div>
    </div>
  );
}
