"use client";

import * as React from "react";
import { BarChart3, Crown, Globe2, TrendingUp } from "lucide-react";
import type { CelebrityZoneOverview } from "@/types/celebrity-zone";
import { cn } from "@/components/ui/utils";

interface Props {
  overview: CelebrityZoneOverview;
}

const CHANNEL_COLORS: Record<string, string> = {
  抖音: "from-pink-500 to-rose-500",
  快手: "from-amber-500 to-orange-500",
  小红书: "from-rose-500 to-red-500",
  视频号: "from-emerald-500 to-teal-500",
  B站: "from-cyan-500 to-sky-500",
};

/** 数据中心 Tab：大盘 + 明星榜 + 周趋势 + 渠道占比。 */
export function CelebrityDataCenter({ overview }: Props) {
  const maxPlays = Math.max(...overview.weeklyTrend.map((p) => p.plays));
  const maxConversions = Math.max(...overview.weeklyTrend.map((p) => p.conversions));

  return (
    <div className="flex flex-col gap-5">
      {/* Hero 大盘 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HeroStat
          icon={<TrendingUp className="h-5 w-5 text-cyan-300" />}
          label="累计播放"
          value={overview.hero.totalPlays}
          accent="text-cyan-300"
        />
        <HeroStat
          icon={<BarChart3 className="h-5 w-5 text-purple-300" />}
          label="累计转化单数"
          value={overview.hero.totalConversions}
          accent="text-purple-300"
        />
        <HeroStat
          icon={<Crown className="h-5 w-5 text-amber-300" />}
          label="活跃明星"
          value={`${overview.hero.activeStars} 位`}
          accent="text-amber-300"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* 周趋势 */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-white/70">最近 7 天趋势</div>
            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                播放
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                转化
              </span>
            </div>
          </div>
          <div className="flex h-48 items-end gap-2">
            {overview.weeklyTrend.map((d) => {
              const playsPct = (d.plays / maxPlays) * 100;
              const convPct = (d.conversions / maxConversions) * 100;
              const dateLabel = d.date.slice(5);
              return (
                <div
                  key={d.date}
                  className="group flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="relative flex h-full w-full items-end gap-1">
                    <div
                      className="flex-1 rounded-t bg-gradient-to-t from-cyan-500/70 to-cyan-400/40 transition group-hover:from-cyan-400 group-hover:to-cyan-300"
                      style={{ height: `${playsPct}%` }}
                      title={`播放 ${d.plays.toLocaleString()}`}
                    />
                    <div
                      className="flex-1 rounded-t bg-gradient-to-t from-purple-500/70 to-purple-400/40 transition group-hover:from-purple-400 group-hover:to-purple-300"
                      style={{ height: `${convPct}%` }}
                      title={`转化 ${d.conversions}`}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/35">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 渠道占比 */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-white/70">渠道占比</div>
            <Globe2 className="h-4 w-4 text-white/35" />
          </div>
          <ul className="flex flex-col gap-3">
            {overview.channelMix.map((c) => (
              <li key={c.channel}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-white/65">{c.channel}</span>
                  <span className="tabular-nums text-white/45">
                    {(c.share * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      CHANNEL_COLORS[c.channel] ?? "from-cyan-500 to-purple-500",
                    )}
                    style={{ width: `${c.share * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 明星榜 */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-300" />
          <span className="text-sm font-medium text-white/70">明星榜（按生成视频数）</span>
        </div>
        <ul className="flex flex-col gap-2">
          {overview.starLeaderboard.map((row, i) => (
            <li
              key={row.starId}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-white/15 hover:bg-white/[0.04]"
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i === 0
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                    : i === 1
                      ? "bg-gradient-to-br from-zinc-400 to-zinc-500 text-white"
                      : i === 2
                        ? "bg-gradient-to-br from-amber-700 to-amber-800 text-white"
                        : "bg-white/[0.05] text-white/55",
                )}
              >
                {i + 1}
              </span>
              <img
                src={row.avatar}
                alt={row.name}
                className="h-9 w-9 rounded-full border border-white/10 object-cover"
              />
              <span className="flex-1 text-sm font-medium text-white/85">
                {row.name}
              </span>
              <Cell label="视频" value={row.videoCount.toString()} accent="text-white/85" />
              <Cell label="播放" value={row.plays} accent="text-cyan-300" />
              <Cell label="GMV" value={row.gmv} accent="text-pink-300" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
        {icon}
      </div>
      <div>
        <div className={cn("text-2xl font-bold tabular-nums", accent)}>{value}</div>
        <div className="text-xs text-white/45">{label}</div>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="hidden flex-col items-end sm:flex">
      <span className="text-[10px] text-white/35">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent)}>{value}</span>
    </div>
  );
}
