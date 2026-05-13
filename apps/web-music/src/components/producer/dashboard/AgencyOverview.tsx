"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AgencyOverview.tsx — 经纪大盘（公司视角）
//
// 只展示公司层面的信息，不依赖 activeArtist。艺人个体的雷达 / 形象 / 衣橱
// 等迁移到 ArtistOverview（艺人视图，sidebar 'artist'）。
// 图表 hover / 空态 / minHeight 问题统一由 charts/* 处理。
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Crown, TrendingUp, Star, Play, Users, ChevronRight, Music, Trophy,
} from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Song } from "@ai-star-eco/types/music";
import type { MonthlyRevenuePoint, RevenueSource } from "@ai-star-eco/types/finance";
import { FinanceApi } from "@/api";
import { formatCredits, formatCompactNumber } from "@/lib/format";
import { ActivityFeed } from "../ActivityFeed";
import { ARTIST_TYPE_LABELS, DOMAINS_8 } from "../ArtistTypes";
import { TypeDistributionPie } from "./charts/TypeDistributionPie";
import { RevenueAreaChart } from "./charts/RevenueAreaChart";
import { StatusDistribution } from "./charts/StatusDistribution";
import { RevenueSourcePie } from "./charts/RevenueSourcePie";
import { ArtistMatrixGrid } from "./roster/ArtistMatrixGrid";
import { TopPerformersTable } from "./roster/TopPerformersTable";

const SONG_STATUS_LABEL: Record<Song["status"], { label: string; tone: string }> = {
  recording: { label: "录制中", tone: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  mixing:    { label: "混音中", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  released:  { label: "已发行", tone: "bg-green-500/10 text-green-400 border-green-500/20" },
};

/** AI 建议行动：MVP 静态数据，后续接 /api/me/producer/suggestions。 */
const OVERVIEW_TASKS: Array<{ title: string; desc: string; priority: "紧急" | "重要" | "建议" }> = [
  { title: "铸造 '夏日' 勋章", desc: "粉丝正在请求新的收藏品。", priority: "紧急" },
  { title: "回复 Alex 教练",   desc: "关于新歌的反馈待处理。", priority: "重要" },
  { title: "优化元数据",        desc: "Track #03 缺少流派标签。", priority: "建议" },
];

const PRIORITY_TONE: Record<typeof OVERVIEW_TASKS[number]["priority"], string> = {
  "紧急": "text-red-400 bg-red-500/10",
  "重要": "text-amber-400 bg-amber-500/10",
  "建议": "text-cyan-400 bg-cyan-500/10",
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
  const ecoValue    = artists.reduce((sum, a) => sum + (a.commercialValue ?? 0), 0);
  const totalFans   = artists.reduce((sum, a) => sum + (a.stats?.fans ?? 0), 0);
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

  const stats: Array<{ label: string; value: string; icon: any; color: string; bg: string; change?: string }> = [
    { label: "生态估值", value: formatCredits(ecoValue),          icon: Crown,      color: "text-amber-400",  bg: "bg-amber-500/10" },
    {
      label: "预估版税", value: formatCredits(monthRev),           icon: TrendingUp, color: "text-cyan-400",   bg: "bg-cyan-500/10",
      change: monthRevMoM !== null ? `${monthRevMoM >= 0 ? "+" : ""}${monthRevMoM.toFixed(1)}%` : undefined,
    },
    { label: "签约艺人", value: formatCompactNumber(signedCount), icon: Star,       color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "总播放量", value: formatCompactNumber(totalPlays),  icon: Play,       color: "text-pink-400",   bg: "bg-pink-500/10" },
    { label: "全网粉丝", value: formatCompactNumber(totalFans),   icon: Users,      color: "text-green-400",  bg: "bg-green-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>你好，制作人。</h1>
        <p className="text-gray-400 font-light mt-1">这是今天的数据概览。</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              {stat.change && (
                <span className={`text-xs font-medium ${stat.change.startsWith("-") ? "text-red-400" : "text-green-400"}`}>
                  {stat.change}
                </span>
              )}
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{stat.value}</div>
            <div className="text-xs text-gray-500 font-light mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* 运营健康三图：类型分布 / 状态分布 / 收入来源 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>类型分布</h3>
          <TypeDistributionPie data={typeDist} emptyHint="暂无签约艺人" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>状态分布</h3>
          <StatusDistribution artists={artists} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>收入来源</h3>
          <RevenueSourcePie data={revenueSources} />
        </motion.div>
      </div>

      {/* 旗下艺人矩阵 */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>旗下艺人</h3>
            <p className="text-xs text-gray-500 font-light mt-0.5">点击卡片切换聚焦艺人，进入"艺人视图"查看详情</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("artists")} className="text-cyan-400 hover:bg-cyan-500/10 text-xs">
            管理艺人 <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <ArtistMatrixGrid artists={artists} activeArtistId={activeArtistId} onSelect={onSelectArtist} />
      </div>

      {/* 收入趋势 + Top Performers */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>收入与互动趋势</h3>
          <RevenueAreaChart data={monthlyRevenue} />
        </div>

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-300" />
            <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Top 表现</h3>
          </div>
          <p className="text-xs text-gray-500 font-light mb-4">本月营收榜</p>
          <TopPerformersTable artists={artists} topN={3} onSelect={onSelectArtist} />
        </div>
      </div>

      {/* 8 大领域 + 建议行动 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>8 大领域</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DOMAINS_8.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .04 }}
                className={`${d.bg} rounded-lg p-2.5 flex items-center gap-2`}>
                <span className={`text-xs ${d.color}`}>{d.zh}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>建议行动</h3>
          <p className="text-xs text-gray-500 font-light mb-4">AI 增长建议</p>
          <div className="space-y-3">
            {OVERVIEW_TASKS.map((task, i) => (
              <motion.div key={task.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .1 }}
                className="bg-black/30 border border-white/5 rounded-lg p-3 hover:border-cyan-500/20 transition cursor-pointer group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-sm font-semibold text-white">{task.title}</span>
                  </div>
                  <Badge className={`text-[10px] border-0 ${PRIORITY_TONE[task.priority]}`}>{task.priority}</Badge>
                </div>
                <p className="text-xs text-gray-500 font-light pl-3.5">{task.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* 近期作品 */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>近期作品</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate("studio")} className="text-cyan-400 hover:bg-cyan-500/10 text-xs">查看全部 <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </div>
        {recentSongs.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500 font-light">
            暂无作品 — 去「创作工坊」生成第一首歌曲
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["曲名", "状态", "播放量", "收入", "日期"].map((h) => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSongs.map((song, i) => {
                  const meta = SONG_STATUS_LABEL[song.status];
                  const date = (song.releaseDate ?? song.createdAt ?? "").slice(0, 10);
                  return (
                    <motion.tr key={song.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .05 }}
                      onClick={() => onOpenTrack(song.id)}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {song.coverUrl
                            ? <img src={song.coverUrl} alt="" className="w-8 h-8 rounded object-cover" />
                            : <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center"><Music className="w-4 h-4 text-cyan-400" /></div>}
                          <span className="text-sm font-semibold">{song.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={`text-xs font-medium ${meta.tone}`}>{meta.label}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-400 font-light">
                        {song.status === "released" ? formatCompactNumber(song.plays) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-400 font-light">
                        {song.status === "released" ? formatCredits(song.revenue) : "—"}
                      </td>
                      <td className="py-3 text-sm text-gray-500 font-light">{date || "—"}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 公司动态 */}
      <ActivityFeed lang="zh" />
    </div>
  );
}
