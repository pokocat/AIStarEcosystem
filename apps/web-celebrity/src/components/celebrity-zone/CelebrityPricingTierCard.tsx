"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { CelebrityPricingTier } from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  tier: CelebrityPricingTier;
  /** 当前明星是否已授权；未授权时 CTA 文案改为「申请授权后开通」并禁用 */
  authorized: boolean;
  onSelect?: (tier: CelebrityPricingTier) => void;
}

export function CelebrityPricingTierCard({ tier, authorized, onSelect }: Props) {
  const recommended = tier.recommended;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-5 transition",
        recommended
          ? "border-violet-400/50 bg-gradient-to-br from-violet-500/[0.10] to-violet-500/[0.04] shadow-[var(--shadow-lift)]"
          : "border-zinc-200 bg-white shadow-[var(--shadow-soft)] hover:border-zinc-300 hover:shadow-[var(--shadow-lift)]",
      )}
    >
      {recommended && (
        <span className="absolute -top-2 right-4 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-[var(--shadow-soft)]">
          推荐
        </span>
      )}
      <div className="text-base font-semibold text-zinc-800">{tier.name}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          recommended ? "text-violet-600" : "text-zinc-800",
        )}
      >
        {tier.price}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-xs leading-relaxed text-zinc-600"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!authorized}
        onClick={() => authorized && onSelect?.(tier)}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition",
          !authorized
            ? "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400"
            : recommended
              ? "bg-[var(--accent)] text-white shadow-[var(--shadow-soft)] hover:bg-[var(--accent-strong)]"
              : "border border-violet-400/40 bg-violet-500/10 text-violet-600 hover:border-violet-500 hover:bg-violet-500/20",
        )}
      >
        {!authorized
          ? "申请授权后开通"
          : recommended
            ? "立即开通"
            : "选择此套餐"}
      </button>
    </div>
  );
}
