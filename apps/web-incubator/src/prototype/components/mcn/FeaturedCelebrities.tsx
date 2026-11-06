/**
 * 精选明星展示条（4位1排）
 * 陈屿 · 顾然 · 苏枝 · 陆星野
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BadgeCheck, Star, TrendingUp, Users, ChevronRight,
  Zap, Shield, Crown, Play, Heart, ShoppingBag
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURED = [
  {
    id: 'yu-zhen',
    name: { zh: '陈屿', en: 'Chen Yu' },
    title: { zh: '实力派演员', en: 'Drama Actor' },
    tags: { zh: ['古装', '谍战', '正剧'], en: ['Historical', 'Spy', 'Drama'] },
    photo: '/images/star-chen-yu.webp',
    fans: '2,180万',
    fansEn: '21.8M',
    platforms: ['抖音', '微博', '视频号'],
    gmv: '¥ 高潜力',
    gmvEn: 'High GMV',
    score: 92,
    status: 'available' as const,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.25)',
    gradient: 'from-cyan-500/60 via-cyan-500/20 to-transparent',
    badge: 'TRP',
    signed: false,
  },
  {
    id: 'xiao-zhan',
    name: { zh: '顾然', en: 'Gu Ran' },
    title: { zh: '演员 / 歌手', en: 'Actor & Singer' },
    tags: { zh: ['流量', '品牌', '音乐'], en: ['Top Traffic', 'Brand', 'Music'] },
    photo: '/images/star-gu-ran.webp',
    fans: '4,530万',
    fansEn: '45.3M',
    platforms: ['抖音', '微博', '小红书', '视频号'],
    gmv: '¥ 顶级',
    gmvEn: 'Top Tier',
    score: 98,
    status: 'signed' as const,
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.28)',
    gradient: 'from-purple-500/60 via-purple-500/20 to-transparent',
    badge: 'CRN',
    signed: true,
  },
  {
    id: 'yang-mi',
    name: { zh: '苏枝', en: 'Su Zhi' },
    title: { zh: '女演员 / KOL', en: 'Actress & KOL' },
    tags: { zh: ['时尚', '美妆', '古装'], en: ['Fashion', 'Beauty', 'Historical'] },
    photo: '/images/star-su-zhi.webp',
    fans: '3,920万',
    fansEn: '39.2M',
    platforms: ['抖音', '微博', '小红书'],
    gmv: '¥ 美妆TOP',
    gmvEn: 'Beauty TOP',
    score: 95,
    status: 'negotiating' as const,
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.25)',
    gradient: 'from-pink-500/60 via-pink-500/20 to-transparent',
    badge: 'SPK',
    signed: false,
  },
  {
    id: 'wang-yibo',
    name: { zh: '陆星野', en: 'Lu Xingye' },
    title: { zh: '演员 / 赛车手', en: 'Actor & Racer' },
    tags: { zh: ['运动', '潮流', '音乐'], en: ['Sport', 'Streetwear', 'Music'] },
    photo: '/images/star-lu-xingye.webp',
    fans: '5,010万',
    fansEn: '50.1M',
    platforms: ['抖音', '微博', '哔哩哔哩', '视频号'],
    gmv: '¥ 顶级',
    gmvEn: 'Top Tier',
    score: 99,
    status: 'available' as const,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.28)',
    gradient: 'from-amber-500/60 via-amber-500/20 to-transparent',
    badge: 'HOT',
    signed: false,
  },
];

const STATUS_MAP = {
  signed:      { zh: '已签约', en: 'Signed',      cls: 'bg-green-500/15 border-green-500/30 text-green-400' },
  available:   { zh: '可签约', en: 'Available',   cls: 'bg-cyan-500/12 border-cyan-500/25 text-cyan-400' },
  negotiating: { zh: '谈判中', en: 'Negotiating', cls: 'bg-amber-500/12 border-amber-500/25 text-amber-400' },
};

// ─── Single Card ──────────────────────────────────────────────────────────────

const CelebrityCard = ({ celeb, zh, index }: {
  celeb: typeof FEATURED[0]; zh: boolean; index: number;
}) => {
  const [hovered, setHovered] = useState(false);
  const status = STATUS_MAP[celeb.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative flex-1 min-w-0 rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: '#0a0a0f',
        border: `1px solid ${celeb.color}30`,
        boxShadow: hovered ? `0 16px 48px ${celeb.glow}, 0 0 0 1px ${celeb.color}40` : `0 4px 16px rgba(0,0,0,0.4)`,
        transition: 'box-shadow 0.35s ease',
      }}
    >
      {/* Photo */}
      <div className="relative w-full aspect-[3/4] overflow-hidden">
        <motion.img
          src={celeb.photo}
          alt={zh ? celeb.name.zh : celeb.name.en}
          className="w-full h-full object-cover object-top"
          animate={{ scale: hovered ? 1.06 : 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {/* Gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t ${celeb.gradient}`} />

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
          {/* Rank badge */}
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm"
            style={{ background: `${celeb.color}20`, border: `1px solid ${celeb.color}40` }}>
            {celeb.badge}
          </div>
          {/* Status */}
          <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${status.cls}`}>
            {zh ? status.zh : status.en}
          </div>
        </div>

        {/* Score bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-white/60">{zh ? '综合指数' : 'Index'}</span>
            <span className="text-[10px] font-black" style={{ color: celeb.color }}>{celeb.score}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${celeb.score}%` }}
              transition={{ delay: index * 0.08 + 0.3, duration: 0.6 }}
              style={{ background: `linear-gradient(90deg, ${celeb.color}, ${celeb.color}cc)` }}
            />
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="px-3 py-3 space-y-2">
        {/* Name + title */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {zh ? celeb.name.zh : celeb.name.en}
            </span>
            {celeb.signed && <BadgeCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: celeb.color }}>
            {zh ? celeb.title.zh : celeb.title.en}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {(zh ? celeb.tags.zh : celeb.tags.en).map(tag => (
            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-md"
              style={{ background: `${celeb.color}12`, border: `1px solid ${celeb.color}25`, color: celeb.color }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[9px] text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {zh ? celeb.fans : celeb.fansEn}
          </span>
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-2.5 h-2.5" />
            {zh ? celeb.gmv : celeb.gmvEn}
          </span>
        </div>

        {/* Platforms */}
        <div className="flex flex-wrap gap-1">
          {celeb.platforms.map(p => (
            <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-600">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Hover CTA */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 p-3"
            style={{ background: `linear-gradient(to top, ${celeb.color}18, transparent)` }}
          >
            <button
              className="w-full h-8 rounded-xl text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition"
              style={{ background: `linear-gradient(135deg, ${celeb.color}cc, ${celeb.color}88)` }}
            >
              {celeb.signed ? (
                <><Play className="w-3 h-3" />{zh ? '进入工作台' : 'Open Workspace'}</>
              ) : (
                <><Zap className="w-3 h-3" />{zh ? '发起签约' : 'Start Signing'}</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow border on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ boxShadow: `inset 0 0 0 1px ${celeb.color}50` }}
      />
    </motion.div>
  );
};

// ─── Main Strip ───────────────────────────────────────────────────────────────

export const FeaturedCelebrities = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';

  return (
    <div className="mb-4 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
            className="text-base"
          >
            STR
          </motion.div>
          <span className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '精选明星资源' : 'Featured Celebrities'}
          </span>
          <span className="text-[10px] text-gray-600">{zh ? '当前可签约 · 点击查看详情' : 'Available to sign · Click for details'}</span>
        </div>
        <button className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-white transition">
          {zh ? '全部明星市场' : 'All Celebrities'}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* 4-card row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FEATURED.map((celeb, i) => (
          <CelebrityCard key={celeb.id} celeb={celeb} zh={zh} index={i} />
        ))}
      </div>
    </div>
  );
};

export default FeaturedCelebrities;
