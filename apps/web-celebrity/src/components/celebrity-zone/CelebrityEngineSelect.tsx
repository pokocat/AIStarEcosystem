"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { ENGINE_META, ENGINE_ORDER } from "@/constants/celebrity-zone-ui";
import type { CelebrityEngine } from "@ai-star-eco/types/celebrity-zone";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  value: CelebrityEngine;
  onChange: (engine: CelebrityEngine) => void;
  /** 紧凑展示（盲盒模式下使用，仅 radio + 标签） */
  compact?: boolean;
}

function QualityStars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < count ? "fill-amber-300 text-amber-300" : "text-white/15",
          )}
        />
      ))}
    </span>
  );
}

/** 引擎选择器（KeLing 经济 / HiGen 标准 / MiniMax 高级）。 */
export function CelebrityEngineSelect({ value, onChange, compact }: Props) {
  if (compact) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="mb-3 text-sm font-medium text-white/70">生成引擎</div>
        <div className="flex flex-col gap-2.5">
          {ENGINE_ORDER.map((id) => {
            const meta = ENGINE_META[id];
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                  selected
                    ? "border-white/15 bg-white/[0.05]"
                    : "border-white/[0.06] bg-transparent hover:border-white/10",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2",
                  )}
                  style={{
                    borderColor: selected ? meta.color : "rgba(255,255,255,0.18)",
                    background: selected ? meta.color : "transparent",
                  }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: selected ? meta.color : "rgba(255,255,255,0.7)" }}
                >
                  {meta.name}
                </span>
                <span className="text-[11px] text-white/40 tabular-nums">
                  {meta.level} · ✦{formatCredits(meta.creditPrice)}/条
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 text-sm font-medium text-white/70">生成引擎</div>
      <div className="flex flex-col gap-2.5">
        {ENGINE_ORDER.map((id) => {
          const meta = ENGINE_META[id];
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "rounded-lg border-2 border-dashed px-4 py-3 text-left transition",
                selected ? "" : "border-white/8 hover:border-white/15",
              )}
              style={
                selected
                  ? {
                      borderColor: `${meta.color}66`,
                      background: `${meta.color}10`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: selected ? meta.color : "rgba(255,255,255,0.2)",
                      background: selected ? meta.color : "transparent",
                    }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selected ? meta.color : "rgba(255,255,255,0.75)" }}
                  >
                    {meta.name}
                  </span>
                  <span
                    className="rounded-md border px-1.5 py-0.5 text-[10px]"
                    style={{
                      borderColor: `${meta.color}55`,
                      color: meta.color,
                      background: `${meta.color}10`,
                    }}
                  >
                    {meta.level}
                  </span>
                </div>
                <span className="text-[11px] tabular-nums text-white/55">
                  消耗 <span className="text-cyan-200">✦{formatCredits(meta.creditPrice)}</span> 积分
                  <span className="text-white/35"> · 占套餐额度 {meta.cost} 条</span>
                </span>
              </div>
              <p className="mt-2 ml-5 text-[12px] leading-relaxed text-white/45">{meta.desc}</p>
              <div className="mt-2 ml-5 flex items-center gap-4 text-[11px] text-white/35">
                <span className="inline-flex items-center gap-1">
                  画质 <QualityStars count={meta.quality} />
                </span>
                <span>耗时 {meta.speed}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
