"use client";

import React, { useState } from 'react';
import {
  Globe, Send, CheckCircle2, Clock, AlertCircle, Play, BarChart3,
  TrendingUp, Eye, ArrowUpRight, Filter, ChevronRight, Zap, Rocket,
  Music, Film, Tv, ShoppingBag, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import { type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from './ArtistTypes';
import type { DistributionContentItem as ContentItem, Platform } from "@/types/distribution";
import { PLATFORMS, CONTENT_ITEMS, PLATFORM_DATA } from "@/mocks/distribution";

const STATUS_STYLES = {
  published: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: CheckCircle2, zh: '已发布', en: 'Published' },
  distributing: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: RefreshCw, zh: '分发中', en: 'Distributing' },
  scheduled: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock, zh: '定时发布', en: 'Scheduled' },
  draft: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', icon: AlertCircle, zh: '草稿', en: 'Draft' },
};

export const DistributionPage = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const [platformFilter, setPlatformFilter] = useState<'all' | 'music' | 'video' | 'social' | 'live'>('all');
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];

  const filteredPlatforms = platformFilter === 'all' ? PLATFORMS : PLATFORMS.filter(p => p.category === platformFilter);
  const connectedCount = PLATFORMS.filter(p => p.status === 'connected').length;
  const totalFollowers = '1.36M';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '全网矩阵分发' : 'Distribution Matrix'}</h1>
          <p className="text-gray-400 font-light mt-1">{zh ? '一键分发至全球150+平台' : 'One-click distribution to 150+ platforms'}</p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2">
          <Send className="w-4 h-4" /> {zh ? '一键分发' : 'Quick Distribute'}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: zh ? '已接入平台' : 'Connected', value: `${connectedCount}/${PLATFORMS.length}`, icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: zh ? '全网粉丝' : 'Total Followers', value: totalFollowers, icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: zh ? '总播放量' : 'Total Views', value: '5.8M', icon: Play, color: 'text-pink-400', bg: 'bg-pink-500/10' },
          { label: zh ? '本月增长' : 'Monthly Growth', value: '+18.5%', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div className="text-xs text-gray-500 font-light">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Platform chart + Content List */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '平台播放量分布' : 'Platform Views'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PLATFORM_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#555" fontSize={10} />
              <YAxis stroke="#555" fontSize={10} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [`${(value / 1000).toFixed(0)}K`, 'Views']} />
              <Bar dataKey="views" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '内容分发状态' : 'Content Status'}</h3>
          </div>
          <div className="space-y-2">
            {CONTENT_ITEMS.map((item, i) => {
              const st = STATUS_STYLES[item.status];
              const StIcon = st.icon;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/10 transition cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    <StIcon className={`w-4 h-4 shrink-0 ${st.color} ${item.status === 'distributing' ? 'animate-spin' : ''}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.title}</div>
                      <div className="text-[10px] text-gray-500">{item.date} · {item.platforms} {zh ? '平台' : 'platforms'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.totalViews !== '-' && <span className="text-xs text-gray-400">{item.totalViews}</span>}
                    <Badge className={`text-[10px] ${st.color} ${st.bg} border-0`}>{zh ? st.zh : st.en}</Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platforms Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '平台矩阵' : 'Platform Matrix'}</h3>
          <div className="flex gap-1">
            {(['all', 'music', 'video', 'social', 'live'] as const).map(f => (
              <button key={f} onClick={() => setPlatformFilter(f)}
                className={`px-2.5 py-1 text-[10px] rounded-full border transition ${platformFilter === f ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5'}`}>
                {f === 'all' ? (zh ? '全部' : 'All') : f === 'music' ? (zh ? '音乐' : 'Music') : f === 'video' ? (zh ? '视频' : 'Video') : f === 'social' ? (zh ? '社交' : 'Social') : (zh ? '直播' : 'Live')}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredPlatforms.map((platform, i) => (
            <motion.div key={platform.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .03 }}
              className={`bg-gray-900/50 border rounded-xl p-4 transition cursor-pointer hover:border-white/15 ${
                platform.status === 'connected' ? 'border-green-500/20' : platform.status === 'pending' ? 'border-amber-500/20' : 'border-white/5'
              }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{platform.icon}</span>
                <div className={`w-2 h-2 rounded-full ${platform.status === 'connected' ? 'bg-green-400' : platform.status === 'pending' ? 'bg-amber-400' : 'bg-gray-600'}`} />
              </div>
              <div className="text-sm font-semibold mb-0.5">{platform.name}</div>
              {platform.status === 'connected' ? (
                <>
                  <div className="text-xs text-gray-500">{platform.followers} {zh ? '粉丝' : 'followers'}</div>
                  <div className="text-[10px] text-gray-600 mt-1">{zh ? '同步: ' : 'Sync: '}{platform.lastSync}</div>
                </>
              ) : (
                <Button variant="outline" size="sm" className="mt-2 text-[10px] h-6 border-white/10 text-gray-400 w-full">
                  {platform.status === 'pending' ? (zh ? '审核中' : 'Pending') : (zh ? '接入' : 'Connect')}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
