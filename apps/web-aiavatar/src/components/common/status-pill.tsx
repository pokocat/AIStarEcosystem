"use client";

import type { ReactNode } from "react";
import type { AiAvatarStatus, AiAvatarJobStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { STATUS_META, JOB_STATUS_META, type Tone } from "@/constants/aiavatar-ui";

/** tone → {前景色, 浅填充} CSS 变量。状态色与品牌琥珀解耦。 */
export const TONE_VARS: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--fg-1)", bg: "var(--bg-2)" },
  muted: { fg: "var(--fg-3)", bg: "var(--bg-2)" },
  info: { fg: "var(--info)", bg: "var(--info-soft)" },
  success: { fg: "var(--success)", bg: "var(--success-soft)" },
  warning: { fg: "var(--warning)", bg: "var(--warning-soft)" },
  danger: { fg: "var(--danger)", bg: "var(--danger-soft)" },
  brand: { fg: "var(--brand-strong)", bg: "var(--brand-soft)" },
  violet: { fg: "var(--violet)", bg: "var(--violet-soft)" },
};

/** 通用 tone 徽标：浅填充 + 语义点 + 文字（不靠颜色单一传达 —— 配文字 + 点形）。 */
export function TonePill({ tone, children, dot = true, className }: {
  tone: Tone; children: ReactNode; dot?: boolean; className?: string;
}) {
  const v = TONE_VARS[tone];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={{ color: v.fg, background: v.bg }}
    >
      {dot && <span className="dot" style={{ background: v.fg }} />}
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: AiAvatarStatus; className?: string }) {
  const m = STATUS_META[status];
  return <TonePill tone={m.tone} className={className}>{m.label}</TonePill>;
}

export function JobStatusPill({ status, className }: { status: AiAvatarJobStatus; className?: string }) {
  const m = JOB_STATUS_META[status];
  return <TonePill tone={m.tone} className={className}>{m.label}</TonePill>;
}
