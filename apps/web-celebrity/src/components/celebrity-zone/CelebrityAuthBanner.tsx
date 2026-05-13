"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import { AUTH_STATUS_META } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
}

const AUTH_ICONS = {
  ShieldCheck,
  Clock,
  ShieldAlert,
  Lock,
} as const;

/**
 * 四态授权横幅。仅在 unauthorized / pending / expired 状态下显示醒目大横幅；
 * authorized 不渲染（详情页其他位置已展示绿色徽章），返回 null。
 */
export function CelebrityAuthBanner({ star }: Props) {
  const { status, expireDate, pendingNote, applyUrl } = star.authorization;
  if (status === "authorized") return null;

  const meta = AUTH_STATUS_META[status];
  const Icon = AUTH_ICONS[meta.icon];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 px-5 py-4 lg:px-6 lg:py-5",
        meta.bannerClass,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              meta.badgeClass,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-zinc-800">{meta.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              {meta.description}
              {status === "expired" && expireDate && (
                <>
                  {" "}
                  授权已于 <span className="text-pink-300">{expireDate}</span> 到期。
                </>
              )}
              {status === "pending" && pendingNote && (
                <>
                  {" "}
                  <span className="text-amber-300">{pendingNote}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0">
          {status === "unauthorized" && (
            <>
              <Link
                href={applyUrl ?? `/console/star/${star.id}/apply`}
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
              >
                申请商务合作 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/console/star/${star.id}?tier=trial`}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/20"
              >
                购买体验版
              </Link>
            </>
          )}
          {status === "expired" && (
            <Link
              href={applyUrl ?? `/console/star/${star.id}/apply`}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-pink-500 to-pink-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(244,63,94,0.25)] transition hover:shadow-[0_0_30px_rgba(244,63,94,0.45)]"
            >
              立即续约 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {status === "pending" && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200">
              审核中…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
