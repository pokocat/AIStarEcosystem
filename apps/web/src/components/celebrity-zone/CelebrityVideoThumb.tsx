"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface Props {
  /** 缩略图 URL */
  src: string;
  alt?: string;
  /** 时长秒数 */
  durationSec?: number;
  /** 右上角小标签 */
  badge?: React.ReactNode;
  className?: string;
  /** 中央覆盖层文字 */
  overlay?: React.ReactNode;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** 9:16 视频缩略卡片（不带水印，正式数据用）。 */
export function CelebrityVideoThumb({
  src,
  alt,
  durationSec,
  badge,
  className,
  overlay,
}: Props) {
  return (
    <div
      className={cn(
        "group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]",
        className,
      )}
    >
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur">
          <Play className="ml-0.5 h-4 w-4 text-white" />
        </div>
      </div>
      {durationSec ? (
        <div className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white/80 tabular-nums backdrop-blur">
          {`${pad2(Math.floor(durationSec / 60))}:${pad2(durationSec % 60)}`}
        </div>
      ) : null}
      {badge ? <div className="absolute right-1.5 top-1.5">{badge}</div> : null}
      {overlay}
    </div>
  );
}
