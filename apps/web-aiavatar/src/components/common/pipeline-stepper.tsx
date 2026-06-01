"use client";

import { Check } from "lucide-react";
import type { AiAvatarStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { PIPELINE_STEPS, STATUS_META } from "@/constants/aiavatar-ui";

/**
 * 7 步标准链路进度（状态机可视化）。
 * 唯一的琥珀高亮 = 当前步；已完成走中性已读态，未到走幽灵态 —— 不再满屏琥珀。
 */
export function PipelineStepper({
  status, className, showLabels = true, size = "md",
}: {
  status: AiAvatarStatus; className?: string; showLabels?: boolean; size?: "sm" | "md";
}) {
  const current = STATUS_META[status].step;
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]";

  return (
    <ol className={cn("flex items-center gap-0 overflow-x-auto", className)}>
      {PIPELINE_STEPS.map((s, i) => {
        const idx = STATUS_META[s.status].step;
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={s.status} className="flex shrink-0 items-center">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center justify-center rounded-full font-semibold transition", dim,
                  active
                    ? "bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_0_0_3px_var(--brand-soft)]"
                    : done
                      ? "bg-[var(--bg-3)] text-[var(--fg-2)]"
                      : "border border-[var(--line)] text-[var(--fg-3)]",
                )}
              >
                {done ? <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> : i + 1}
              </span>
              {showLabels && (
                <span className={cn("whitespace-nowrap text-xs",
                  active ? "font-medium text-[var(--fg-0)]" : done ? "text-[var(--fg-2)]" : "text-[var(--fg-3)]")}>
                  {s.label}
                </span>
              )}
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className={cn("mx-1.5 h-px", showLabels ? "w-4" : "w-3",
                done ? "bg-[var(--line-strong)]" : "bg-[var(--line)]")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
