"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { CelebrityPricingTier } from "@/types/celebrity-zone";
import { cn } from "@/components/ui/utils";

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
        "relative flex flex-col rounded-2xl border bg-white/[0.025] p-5 transition",
        recommended
          ? "border-cyan-400/40 bg-gradient-to-br from-cyan-500/[0.07] to-purple-500/[0.04] shadow-[0_0_24px_rgba(6,182,212,0.15)]"
          : "border-white/8 hover:border-white/15",
      )}
    >
      {recommended && (
        <span className="absolute -top-2 right-4 rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          推荐
        </span>
      )}
      <div className="text-base font-semibold text-white/90">{tier.name}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          recommended ? "text-cyan-200" : "text-white/85",
        )}
      >
        {tier.price}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-xs leading-relaxed text-white/55"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!authorized}
        onClick={() => authorized && onSelect?.(tier)}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition",
          !authorized
            ? "cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/35"
            : recommended
              ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
              : "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/20",
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
