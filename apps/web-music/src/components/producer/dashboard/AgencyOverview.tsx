"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AgencyOverview.tsx — 经纪大盘（公司视角）
//
// 只展示公司层面的信息，不依赖 activeArtist。艺人个体的雷达 / 形象 / 衣橱
// 等迁移到 ArtistOverview（艺人视图，sidebar 'artist'）。
// 图表 hover / 空态 / minHeight 问题统一由 charts/* 处理。
//
// IA 设计（v2，2026-05）：从 9 段卡片堆叠改为「行动优先」结构：
//   1) 待办建议 —— 一上来就告诉用户「现在最该做什么」
//   2) 状态条 —— 三个最有决策价值的数（版税/签约/播放量）
//   3) 艺人矩阵 + Top 营收 —— 谁在赚钱、谁需要关注
//   4) 走势图 —— 一张主图，下面挂类型/收入来源细分
//   5) 近期作品 + 公司动态 —— 滚动可达的次要信息
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  TrendingUp, Star, Play, ChevronRight, Music, Trophy, ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Song } from "@ai-star-eco/types/music";
import type { MonthlyRevenuePoint, RevenueSource } from "@ai-star-eco/types/finance";
import { FinanceApi } from "@/api";
import { formatCredits, formatCompactNumber } from "@/lib/format";
import { ActivityFeed } from "../ActivityFeed";
import { ARTIST_TYPE_LABELS } from "../ArtistTypes";
import { TypeDistributionPie } from "./charts/TypeDistributionPie";
import { RevenueAreaChart } from "./charts/RevenueAreaChart";
import { RevenueSourcePie } from "./charts/RevenueSourcePie";
import { ArtistMatrixGrid } from "./roster/ArtistMatrixGrid";
import { TopPerformersTable } from "./roster/TopPerformersTable";

const SONG_STATUS_LABEL: Record<Song["status"], { label: string; tone: string }> = {
  recording: { label: "录制中", tone: "bg-muted text-muted-foreground border-border" },
  mixing:    { label: "混音中", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  released:  { label: "已发行", tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

/** AI 建议行动：MVP 静态数据，后续接 /api/me/producer/suggestions。
    Priority 用文本权重 + 中性 badge 表达，不再用 hue（红/橙/青三色与系统状态色冲突）。 */
type TaskPriority = "紧急" | "重要" | "建议";
const OVERVIEW_TASKS: Array<{ title: string; desc: string; priority: TaskPriority; action: string }> = [
  { title: "审批待发版税 ¥38,420", desc: "本周到期，涉及 4 位艺人。", priority: "紧急", action: "去财务" },
  { title: "回复 Alex 教练的新歌反馈", desc: "等待 2 天。",            priority: "重要", action: "查看" },
  { title: "为 Track #03 补齐流派标签", desc: "缺失元数据影响分发匹配。", priority: "建议", action: "去修复" },
];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  "紧急": "bg-destructive/15 text-destructive border-destructive/25",
  "重要": "bg-amber-500/12 text-amber-400 border-amber-500/25",
  "建议": "bg-secondary text-muted-foreground border-border",
};

export interface AgencyOverviewProps {
  artists: Artist[];
  songs: Song[];
  monthlyRevenue: MonthlyRevenuePoint[];
  activeArtistId?: string;
  onNavigate: (page: string) => void;
  onOpenTrack: (songId: string) => void;
  /** 从矩阵卡片 / Top 表切换当前关注的艺人。PR 3 会改为跳转到艺人视图。 */
  onSelectArtist: (artist: Artist) => void;
}

export function AgencyOverview({
  artists, songs, monthlyRevenue, activeArtistId,
  onNavigate, onOpenTrack, onSelectArtist,
}: AgencyOverviewProps) {
  // 收入来源（饼图）独立拉取 —— 只有经纪大盘用到，不进入 use-producer-dashboard。
  const [revenueSources, setRevenueSources] = useState<RevenueSource[]>([]);
  useEffect(() => {
    let cancelled = false;
    FinanceApi.getRevenueSources()
      .then(list => { if (!cancelled) setRevenueSources(list); })
      .catch(() => { /* 静默失败 */ });
    return () => { cancelled = true; };
  }, []);

  // ── 聚合指标 ────────────────────────────────────────────────────────────────
  const totalPlays  = songs.reduce((sum, s) => sum + (s.plays ?? 0), 0);
  const signedCount = artists.length;

  const latestMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const prevMonth   = monthlyRevenue[monthlyRevenue.length - 2];
  const monthRev    = latestMonth?.revenue ?? 0;
  const monthRevMoM = latestMonth && prevMonth && prevMonth.revenue > 0
    ? ((latestMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
    : null;

  const typeDist = (() => {
    const counts: Record<string, number> = {};
    artists.forEach(a => {
      const label = ARTIST_TYPE_LABELS[a.type].zh;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const recentSongs = [...songs]
    .filter(s => artists.some(a => a.id === s.artistId))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 5);

  /** 三个最有决策价值的数。颜色统一用 muted icon，不为每张卡指派不同 hue。 */
  const stats: Array<{ label: string; value: string; icon: LucideIcon; change?: string }> = [
    {
      label: "预估版税（本月）",
      value: formatCredits(monthRev),
      icon: TrendingUp,
      change: monthRevMoM !== null ? `${monthRevMoM >= 0 ? "+" : ""}${monthRevMoM.toFixed(1)}%` : undefined,
    },
    { label: "签约艺人", value: formatCompactNumber(signedCount), icon: Star },
    { label: "总播放量", value: formatCompactNumber(totalPlays),  icon: Play },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">经纪大盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          今天有 <span className="text-foreground font-medium">{OVERVIEW_TASKS.length}</span> 项建议处理 · 本月营收同比{" "}
          <span className={monthRevMoM !== null && monthRevMoM >= 0 ? "text-emerald-400" : "text-destructive"}>
            {monthRevMoM !== null ? `${monthRevMoM >= 0 ? "+" : ""}${monthRevMoM.toFixed(1)}%` : "—"}
          </span>
        </p>
      </header>

      {/* 1) 建议行动 —— 提到首屏第一位 */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">需要我处理</h2>
            <p className="text-xs text-muted-foreground mt-0.5">AI 推荐与系统提醒（{OVERVIEW_TASKS.length}）</p>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {OVERVIEW_TASKS.map((task) => (
            <li key={task.title} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/60 transition">
              <Badge className={`text-[10px] font-medium border ${PRIORITY_STYLE[task.priority]}`}>
                {task.priority}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{task.title}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{task.desc}</div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-foreground/80 hover:text-foreground">
                {task.action}
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {/* 2) 状态条 —— 3 个数，单一色调 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
              {stat.change && (
                <span className={`text-xs font-medium ${stat.change.startsWith("-") ? "text-destructive" : "text-emerald-400"}`}>
                  {stat.change}
                </span>
              )}
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 3) 旗下艺人 + Top 表现 —— 一行内合并，去掉单独 "Top 表现" 卡 */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">旗下艺人</h2>
            <p className="text-xs text-muted-foreground mt-0.5">点击卡片切换聚焦艺人，进入"艺人视图"查看详情</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("artists")} className="text-xs">
            管理艺人 <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="p-5 grid lg:grid-cols-[1fr_280px] gap-6">
          <ArtistMatrixGrid artists={artists} activeArtistId={activeArtistId} onSelect={onSelectArtist} />
          <aside className="lg:border-l lg:border-border lg:pl-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold tracking-tight">本月营收榜</h3>
            </div>
            <TopPerformersTable artists={artists} topN={3} onSelect={onSelectArtist} />
          </aside>
        </div>
      </section>

      {/* 4) 走势 + 类型/来源细分 */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold tracking-tight">收入与互动趋势</h2>
        </div>
        <div className="p-5">
          <RevenueAreaChart data={monthlyRevenue} />
        </div>
        <div className="grid md:grid-cols-2 gap-0 border-t border-border">
          <div className="p-5 md:border-r md:border-border">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">艺人类型分布</h3>
            <TypeDistributionPie data={typeDist} emptyHint="暂无签约艺人" />
          </div>
          <div className="p-5">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">收入来源</h3>
            <RevenueSourcePie data={revenueSources} />
          </div>
        </div>
      </section>

      {/* 5) 近期作品 */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold tracking-tight">近期作品</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("studio")} className="text-xs">
            查看全部 <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {recentSongs.length === 0 ? (
          <div className="text-center py-10 px-5 text-sm text-muted-foreground">
            暂无作品 — 去「创作工坊」生成第一首歌曲
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["曲名", "状态", "播放量", "收入", "日期"].map((h) => (
                    <th key={h} className="text-left text-[11px] text-muted-foreground font-medium uppercase tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSongs.map((song) => {
                  const meta = SONG_STATUS_LABEL[song.status];
                  const date = (song.releaseDate ?? song.createdAt ?? "").slice(0, 10);
                  return (
                    <tr
                      key={song.id}
                      onClick={() => onOpenTrack(song.id)}
                      className="border-b border-border last:border-b-0 hover:bg-secondary/60 transition cursor-pointer"
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {song.coverUrl
                            ? <img src={song.coverUrl} alt="" className="w-8 h-8 rounded object-cover" />
                            : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground" /></div>}
                          <span className="text-sm font-medium">{song.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <Badge className={`text-[11px] font-medium border ${meta.tone}`}>{meta.label}</Badge>
                      </td>
                      <td className="py-3 px-5 text-sm text-muted-foreground tabular-nums">
                        {song.status === "released" ? formatCompactNumber(song.plays) : "—"}
                      </td>
                      <td className="py-3 px-5 text-sm text-muted-foreground tabular-nums">
                        {song.status === "released" ? formatCredits(song.revenue) : "—"}
                      </td>
                      <td className="py-3 px-5 text-sm text-muted-foreground tabular-nums">{date || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6) 公司动态 */}
      <ActivityFeed lang="zh" />
    </div>
  );
}
