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
            i < count ? "fill-amber-500 text-amber-500" : "text-zinc-300",
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
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 text-sm font-medium text-zinc-700">生成引擎</div>
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
                    ? "border-zinc-300 bg-zinc-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2",
                  )}
                  style={{
                    borderColor: selected ? meta.color : "var(--line-2)",
                    background: selected ? meta.color : "transparent",
                  }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: selected ? meta.color : "var(--fg-1)" }}
                >
                  {meta.name}
                </span>
                <span className="text-[11px] text-zinc-500 tabular-nums">
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 text-sm font-medium text-zinc-700">生成引擎</div>
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
                selected ? "" : "border-zinc-200 hover:border-zinc-300",
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
                      borderColor: selected ? meta.color : "var(--line-2)",
                      background: selected ? meta.color : "transparent",
                    }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selected ? meta.color : "var(--fg-0)" }}
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
                <span className="text-[11px] tabular-nums text-zinc-600">
                  消耗 <span className="text-violet-600 font-medium">✦{formatCredits(meta.creditPrice)}</span> 积分
                  <span className="text-zinc-500"> · 占套餐额度 {meta.cost} 条</span>
                </span>
              </div>
              <p className="mt-2 ml-5 text-[12px] leading-relaxed text-zinc-600">{meta.desc}</p>
              <div className="mt-2 ml-5 flex items-center gap-4 text-[11px] text-zinc-500">
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
