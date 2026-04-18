import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type StatusTone } from "@/constants/status";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: TONE_CLASS.neutral,
        info: TONE_CLASS.info,
        success: TONE_CLASS.success,
        warning: TONE_CLASS.warning,
        danger: TONE_CLASS.danger,
        primary: TONE_CLASS.primary,
      } satisfies Record<StatusTone, string>,
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
