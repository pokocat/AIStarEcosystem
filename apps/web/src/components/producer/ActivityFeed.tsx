"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Music, Heart, Gem, Users, TrendingUp, Zap, Award, Upload, Star, Eye, ChevronDown } from 'lucide-react';
import type { Lang } from "../../translations";

interface ActivityItem {
  id: number;
  type: 'release' | 'milestone' | 'nft' | 'collab' | 'fan' | 'revenue' | 'award' | 'content';
  artist: string;
  artistIcon: string;
  title_zh: string;
  title_en: string;
  desc_zh: string;
  desc_en: string;
  time_zh: string;
  time_en: string;
  highlight?: boolean;
}

const ACTIVITY_DATA: ActivityItem[] = [
  { id: 1, type: 'release', artist: 'Neon V', artistIcon: '🎤', title_zh: '新单曲发布', title_en: 'New Single Released', desc_zh: '「Neon Tears Remix」已上架全网平台', desc_en: '"Neon Tears Remix" published across all platforms', time_zh: '5分钟前', time_en: '5 min ago', highlight: true },
  { id: 2, type: 'milestone', artist: 'PRISM 7', artistIcon: '💎', title_zh: '粉丝里程碑', title_en: 'Fan Milestone', desc_zh: '粉丝数突破 300K！🎉', desc_en: 'Fans exceeded 300K! 🎉', time_zh: '28分钟前', time_en: '28 min ago', highlight: true },
  { id: 3, type: 'nft', artist: 'Neon V', artistIcon: '🎤', title_zh: 'NFT 铸造完成', title_en: 'NFT Minted', desc_zh: '「Cyber City Artwork」成功铸造，48人持有', desc_en: '"Cyber City Artwork" minted, 48 holders', time_zh: '1小时前', time_en: '1 hour ago' },
  { id: 4, type: 'revenue', artist: 'Luna Soft', artistIcon: '🎤', title_zh: '收入到账', title_en: 'Revenue Received', desc_zh: '本月流媒体收入 ¥12,800 已结算', desc_en: 'Monthly streaming revenue ¥12,800 settled', time_zh: '2小时前', time_en: '2 hours ago' },
  { id: 5, type: 'collab', artist: 'Crystal Flow', artistIcon: '💃', title_zh: '合作邀约', title_en: 'Collaboration Invite', desc_zh: '收到品牌 NEXON 的舞蹈合作邀约', desc_en: 'Dance collaboration invite from brand NEXON', time_zh: '3小时前', time_en: '3 hours ago' },
  { id: 6, type: 'fan', artist: 'Blade Runner', artistIcon: '🎭', title_zh: '社群热度提升', title_en: 'Community Buzz', desc_zh: '粉丝社群活跃度提升 42%', desc_en: 'Fan community engagement up 42%', time_zh: '4小时前', time_en: '4 hours ago' },
  { id: 7, type: 'content', artist: 'MC Thunder', artistIcon: '🎙️', title_zh: '内容上传', title_en: 'Content Upload', desc_zh: '新综艺片段「Thunder Show EP.12」已上传', desc_en: '"Thunder Show EP.12" uploaded', time_zh: '5小时前', time_en: '5 hours ago' },
  { id: 8, type: 'award', artist: 'Neon V', artistIcon: '🎤', title_zh: '获得成就', title_en: 'Achievement Unlocked', desc_zh: '解锁「百万播放」成就徽章', desc_en: 'Unlocked "Million Plays" achievement badge', time_zh: '昨天', time_en: 'Yesterday' },
];

const TYPE_CONFIG: Record<ActivityItem['type'], { icon: any; color: string; bg: string }> = {
  release: { icon: Music, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  milestone: { icon: TrendingUp, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  nft: { icon: Gem, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  collab: { icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  fan: { icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
  revenue: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  award: { icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  content: { icon: Upload, color: 'text-green-400', bg: 'bg-green-500/10' },
};

export const ActivityFeed = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ACTIVITY_DATA : ACTIVITY_DATA.slice(0, 5);

  return (
    <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '实时活动' : 'Activity Feed'}</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400">LIVE</span>
          </div>
        </div>
        <span className="text-xs text-gray-500">{zh ? `${ACTIVITY_DATA.length} 条动态` : `${ACTIVITY_DATA.length} events`}</span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[17px] top-2 bottom-2 w-px bg-white/5" />

        <div className="space-y-1">
          <AnimatePresence>
            {visible.map((item, i) => {
              const config = TYPE_CONFIG[item.type];
              const Icon = config.icon;
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative flex items-start gap-3 p-2.5 rounded-lg transition cursor-pointer group hover:bg-white/[0.02] ${item.highlight ? 'bg-white/[0.02]' : ''}`}
                >
                  {/* Icon dot */}
                  <div className={`relative z-10 w-[34px] h-[34px] rounded-full ${config.bg} flex items-center justify-center shrink-0 ring-2 ring-black`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">{zh ? item.title_zh : item.title_en}</span>
                      {item.highlight && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-light truncate">{zh ? item.desc_zh : item.desc_en}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px]">{item.artistIcon}</span>
                      <span className="text-[10px] text-gray-600">{item.artist}</span>
                      <span className="text-[10px] text-gray-700">·</span>
                      <span className="text-[10px] text-gray-700">{zh ? item.time_zh : item.time_en}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {ACTIVITY_DATA.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition py-2">
          <span>{expanded ? (zh ? '收起' : 'Show Less') : (zh ? `查看全部 ${ACTIVITY_DATA.length} 条` : `View All ${ACTIVITY_DATA.length}`)}</span>
          <ChevronDown className={`w-3 h-3 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};
