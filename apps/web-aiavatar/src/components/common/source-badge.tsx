"use client";

import type { AiAvatarProviderMode } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";

/**
 * 实现来源角标：mock 结果显示安静的 MOCK（中性灰），真实结果标注引擎（轻绿 + 点）。
 * 重设计：MOCK 不再用满饱和琥珀——它只是"占位"信息，应安静；真实方案才用语义绿提示。
 */
export function SourceBadge({
  engine, mode, className,
}: {
  engine?: string | null; mode?: AiAvatarProviderMode | null; className?: string;
}) {
  const isMock = mode === "mock" || engine === "MOCK" || engine == null;
  const label = isMock ? "MOCK" : engine ?? "REAL";
  return (
    <span
      data-mock={isMock ? "true" : "false"}
      className={cn("src-badge", className)}
      title={isMock ? "演示模式：占位资产（mock provider）" : `真实实现：${engine}`}
    >
      {!isMock && <span className="dot" style={{ background: "var(--success)" }} />}
      {label}
    </span>
  );
}
