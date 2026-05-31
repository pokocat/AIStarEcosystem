"use client";

import type { AiAvatarStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { PIPELINE_STEPS, STATUS_META } from "@/constants/aiavatar-ui";

/** 7 步标准链路进度条（任务书 §3 状态机可视化）。 */
export function PipelineStepper({ status, className }: { status: AiAvatarStatus; className?: string }) {
  const current = STATUS_META[status].step;
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {PIPELINE_STEPS.map((s, i) => {
        const stepIdx = STATUS_META[s.status].step;
        const done = stepIdx < current;
        const active = s.status === status;
        return (
          <div key={s.status} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition",
                active ? "bg-amber-500 text-zinc-950"
                  : done ? "bg-amber-500/15 text-amber-400"
                    : "bg-zinc-800 text-zinc-500",
              )}
            >
              <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px]",
                active ? "bg-zinc-950/20" : done ? "bg-amber-500/30" : "bg-zinc-700")}>
                {done ? "✓" : i + 1}
              </span>
              {s.label}
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span className={cn("h-px w-3", done ? "bg-amber-500/40" : "bg-zinc-700")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
