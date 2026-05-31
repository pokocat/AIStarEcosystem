"use client";

import type { AiAvatarStatus, AiAvatarJobStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { STATUS_META, JOB_STATUS_META } from "@/constants/aiavatar-ui";

export function StatusPill({ status, className }: { status: AiAvatarStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", m.cls, className)}>
      {m.label}
    </span>
  );
}

export function JobStatusPill({ status, className }: { status: AiAvatarJobStatus; className?: string }) {
  const m = JOB_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", m.cls, className)}>
      {m.label}
    </span>
  );
}
