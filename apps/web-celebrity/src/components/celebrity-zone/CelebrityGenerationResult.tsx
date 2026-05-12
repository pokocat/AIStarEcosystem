"use client";

import * as React from "react";
import {
  CheckCircle2,
  Download,
  Globe,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
  engine: CelebrityEngine;
  product: CelebrityProductInput;
  durationSec?: number;
  /** 「采纳并保存」：进入项目使用，回到工作台首页 */
  onAdopt: () => void;
  /** 「重新生成」：保留当前配置但重跑生成 */
  onRegenerate: () => void;
  /** 「再来一条」：回到模式选择 */
  onStartOver: () => void;
  /** 直接进入分发（可选） */
  onDistribute?: () => void;
}

const SAMPLE_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

/** 生成完成结果页：左大预览 + 右元数据/动作。 */
export function CelebrityGenerationResult({
  star,
  engine,
  product,
  durationSec = 30,
  onAdopt,
  onRegenerate,
  onStartOver,
  onDistribute,
}: Props) {
  const meta = ENGINE_META[engine];
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(true);
  const [muted, setMuted] = React.useState(true);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部状态条 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] px-5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white/90">
            视频已生成完成
          </div>
          <div className="text-xs text-white/45">
            预览满意可一键采纳保存到项目；不满意可调整参数后重新生成。
          </div>
        </div>
        <div className="hidden items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200 md:inline-flex">
          <Sparkles className="h-3 w-3" /> {meta.name} · {meta.level}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 左：9:16 预览 */}
        <div>
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_40px_rgba(6,182,212,0.18)]">
            <video
              ref={videoRef}
              src={SAMPLE_VIDEO_URL}
              poster={star.cover}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
            {/* 控件 */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-3">
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                  {playing ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="ml-0.5 h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <span className="pointer-events-auto rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/85 backdrop-blur">
                {pad2(Math.floor(durationSec / 60))}:{pad2(durationSec % 60)}
              </span>
            </div>
            {/* 角标 */}
            <span className="absolute left-2 top-2 rounded-md border border-cyan-400/40 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100 backdrop-blur">
              预览
            </span>
          </div>
        </div>

        {/* 右：元数据 + 动作 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="mb-3 text-sm font-medium text-white/70">视频信息</div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <Cell k="明星" v={star.name} />
              <Cell k="商品" v={product.name || "未命名"} />
              <Cell k="时长" v={`${durationSec} 秒`} />
              <Cell k="引擎" v={`${meta.name} · ${meta.level}`} accent={meta.color} />
              <Cell k="额度消耗" v={`${meta.cost} 条`} />
              <Cell k="状态" v={<span className="text-emerald-300">已生成 · 待采纳</span>} />
            </dl>
            {product.sellingPoints && (
              <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[11px] text-white/40">商品卖点</div>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/65">
                  {product.sellingPoints}
                </p>
              </div>
            )}
          </div>

          {/* 主动作 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onAdopt}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-purple-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.45)]"
            >
              <CheckCircle2 className="h-4 w-4" /> 采纳并保存到项目
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20"
            >
              <RotateCcw className="h-4 w-4" /> 重新生成（同参数）
            </button>
          </div>

          {/* 次动作 */}
          <div className="flex flex-wrap gap-2">
            {onDistribute && (
              <button
                type="button"
                onClick={onDistribute}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
              >
                <Globe className="h-3.5 w-3.5" /> 立即分发
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
              onClick={() => {
                const a = document.createElement("a");
                a.href = SAMPLE_VIDEO_URL;
                a.download = `${star.name}-${product.name || "video"}.mp4`;
                a.click();
              }}
            >
              <Download className="h-3.5 w-3.5" /> 下载草稿
            </button>
            <button
              type="button"
              onClick={onStartOver}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:border-white/30 hover:text-white",
              )}
            >
              再来一条（换模式 / 模板）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({
  k,
  v,
  accent,
}: {
  k: string;
  v: React.ReactNode;
  accent?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-white/35">{k}</dt>
      <dd
        className="text-sm font-medium text-white/85"
        style={accent ? { color: accent } : undefined}
      >
        {v}
      </dd>
    </div>
  );
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}
