"use client";

import * as React from "react";
import { cn } from "@ai-star-eco/ui/ui/utils";

/**
 * 9:16 视频缩略占位框 + 旋转半透明水印（"AI Star Eco · 样片水印"）。
 * 沿用 figma 原稿 .vid + .watermark 的组合，但用 tailwind 重写以贴近站点风格。
 */
export interface CelebrityWatermarkVideoProps {
  label?: React.ReactNode;
  caption?: React.ReactNode;
  /** 9:16 默认；传入时强制覆盖 */
  className?: string;
  watermarkText?: string;
}

export function CelebrityWatermarkVideo({
  label,
  caption,
  className,
  watermarkText = "AI Star Eco · 样片水印",
}: CelebrityWatermarkVideoProps) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] flex items-center justify-center overflow-hidden",
        "rounded-lg border border-dashed border-zinc-200",
        "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        className,
      )}
    >
      <div className="text-center px-2">
        {label && (
          <div className="text-xs font-medium text-zinc-500">{label}</div>
        )}
        {caption && (
          <div className="mt-1 text-[10px] text-zinc-400">{caption}</div>
        )}
      </div>
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap text-xs font-light text-zinc-300 tracking-wide"
        aria-hidden
      >
        {watermarkText}
      </span>
    </div>
  );
}
