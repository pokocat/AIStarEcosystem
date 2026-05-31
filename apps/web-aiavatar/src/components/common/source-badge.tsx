"use client";

import type { AiAvatarProviderMode } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";

/**
 * 实现来源角标（任务书 §6.4：mock 结果显示 MOCK 角标，真实结果标注引擎 InstantID/TripoSR…）。
 */
export function SourceBadge({
  engine,
  mode,
  className,
}: {
  engine?: string | null;
  mode?: AiAvatarProviderMode | null;
  className?: string;
}) {
  const isMock = mode === "mock" || engine === "MOCK" || engine == null;
  const label = isMock ? "MOCK" : engine ?? "REAL";
  return (
    <span
      data-mock={isMock ? "true" : "false"}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        isMock
          ? "border-amber-500 bg-amber-500/15 text-amber-400"
          : "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
        className,
      )}
      title={isMock ? "演示模式：占位资产（mock provider）" : `真实实现：${engine}`}
    >
      {label}
    </span>
  );
}
