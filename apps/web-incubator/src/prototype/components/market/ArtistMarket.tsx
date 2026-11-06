import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Crown, Flame, Star, Eye, Heart, TrendingUp, X, Plus,
  Check, Shield, ArrowRight, ChevronRight, Zap, Search,
  Filter, ChevronDown, Handshake, BarChart3, Wallet, Gem,
  CheckCircle2, Gavel, Clock, Trophy, Tag, DollarSign,
  Sparkles, ShoppingBag, SortDesc, RefreshCw, Lock, Timer,
  Users, Award, MessageSquare, Activity, Coins, Package,
  BadgeCheck, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import {
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  STATUS_CONFIG, TALENT_LABELS,
  type ArtistType, type Quality, type ArtistStatus,
} from '../mcn/ArtistTypes';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────────────────

type MarketZone = 'hot' | 'rookie' | 'legendary' | 'flash' | 'co_incubation' | 'mine';
type ContractType = 'full' | 'revenue_share' | 'loan' | 'co_incubation';
type SaleType = 'fixed' | 'auction' | 'negotiation';
type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'popularity';

interface MarketArtist {
  id: string; name: string; type: ArtistType; quality: Quality;
  status: ArtistStatus; level: number; avatar: string;
  popularity: number; growth7d: number; fans: string;
  commercialValue: string; bio: string; domains: string[];
  talents: Record<string, number>;
}

interface MarketListing {
  id: string;
  artist: MarketArtist;
  sellerId: string; sellerName: string; sellerRep: number;
  contractType: ContractType; saleType: SaleType;
  price: number; baseValuation: number;
  revenueSharePct?: number; loanDays?: number;
  auctionEndTime?: number; currentBid?: number; bidCount?: number;
  zone: MarketZone; listedAt: number;
  views: number; wishlistCount: number; exclusive: boolean;
  flashExpiresAt?: number; coInviteDesc?: string;
  tags: string[]; isOwn?: boolean; offerCount?: number;
  listingStatus: 'active' | 'sold' | 'pending';
}

// ─── Config ──────────────────────────────────────────────────────────────────

const QUALITY_CFG: Record<Quality, { zh: string; en: string; color: string; bg: string; border: string; glow: string }> = {
  common:    { zh: '普通', en: 'Common',    color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   glow: '' },
  rare:      { zh: '稀有', en: 'Rare',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   glow: '0 0 20px rgba(59,130,246,0.12)' },
  epic:      { zh: '史诗', en: 'Epic',      color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', glow: '0 0 24px rgba(168,85,247,0.18)' },
  legendary: { zh: '传奇', en: 'Legendary', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  glow: '0 0 32px rgba(245,158,11,0.22)' },
};

const CONTRACT_CFG: Record<ContractType, { zh: string; en: string; color: string; bg: string; border: string; Icon: any }> = {
  full:          { zh: '全权签约', en: 'Full Sign',     color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',    Icon: Crown },
  revenue_share: { zh: '分成签约', en: 'Rev. Share',    color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/25',   Icon: DollarSign },
  loan:          { zh: '借调合同', en: 'Loan',          color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  Icon: Clock },
  co_incubation: { zh: '联合孵化', en: 'Co-Incubate',  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', Icon: Handshake },
};

const ZONE_CFG: Record<MarketZone, { zh: string; en: string; icon: string; accent: string }> = {
  hot:           { zh: '热门签约',  en: 'Hot',           icon: 'HOT', accent: '#f97316' },
  rookie:        { zh: '新人特卖',  en: 'Rookie',        icon: 'NEW', accent: '#3b82f6' },
  legendary:     { zh: '传奇拍场',  en: 'Legendary',     icon: 'GEM', accent: '#f59e0b' },
  flash:         { zh: '限时闪签',  en: 'Flash',         icon: 'ZAP', accent: '#ef4444' },
  co_incubation: { zh: '联合孵化',  en: 'Co-Incubate',   icon: 'HSK', accent: '#a855f7' },
  mine:          { zh: '我的委托',  en: 'My Listings',   icon: 'DOC', accent: '#6b7280' },
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const NOW = Date.now();

const MARKET_LISTINGS: MarketListing[] = [
  // ── Hot Zone ──
  {
    id: 'ml1', sellerId: 's1', sellerName: 'StarMaker Corp', sellerRep: 94,
    contractType: 'full', saleType: 'fixed', price: 52000, baseValuation: 48600,
    zone: 'hot', listedAt: NOW - 1000 * 3600 * 2, views: 842, wishlistCount: 67, exclusive: true,
    tags: ['电子音乐', '赛博风', '高人气'], listingStatus: 'active',
    artist: {
      id: 'ma1', name: 'Cyber Aria', type: 'singer', quality: 'epic', status: 'active', level: 38,
      avatar: 'https://images.unsplash.com/photo-1745532665626-09f20c9408dd?w=200&q=80',
      popularity: 84, growth7d: 7.2, fans: '112K', commercialValue: '¥1.1M',
      bio: '赛博朋克风格AI歌手，电子合成嗓音，霓虹舞台主宰者。',
      domains: ['音乐', '舞台表演'],
      talents: { singing: 86, acting: 28, dancing: 60, hosting: 15, comedy: 20, variety: 42 },
    },
  },
  {
    id: 'ml2', sellerId: 's2', sellerName: 'DarkRoom MCN', sellerRep: 88,
    contractType: 'revenue_share', saleType: 'fixed', price: 28000, baseValuation: 31200,
    revenueSharePct: 45, zone: 'hot', listedAt: NOW - 1000 * 3600 * 5, views: 621, wishlistCount: 48, exclusive: false,
    tags: ['悬疑短剧', '演技派', '商业价值'], listingStatus: 'active',
    artist: {
      id: 'ma2', name: 'Phantom', type: 'actor', quality: 'rare', status: 'active', level: 33,
      avatar: 'https://images.unsplash.com/photo-1760564704843-07b22892b0bf?w=200&q=80',
      popularity: 70, growth7d: 4.8, fans: '76K', commercialValue: '¥1.8M',
      bio: '实力派悬疑演员，黑暗美学代言人，短剧票房保障。',
      domains: ['影视', '商业代言'],
      talents: { singing: 18, acting: 84, dancing: 15, hosting: 32, comedy: 52, variety: 38 },
    },
  },
  {
    id: 'ml3', sellerId: 's3', sellerName: 'HypeFactory', sellerRep: 91,
    contractType: 'full', saleType: 'negotiation', price: 68000, baseValuation: 72400,
    zone: 'hot', listedAt: NOW - 1000 * 3600 * 8, views: 1203, wishlistCount: 92, exclusive: true,
    tags: ['综艺爆款', '互动王者', '弹幕热榜'], listingStatus: 'active',
    artist: {
      id: 'ma3', name: 'Neon Joker', type: 'entertainer', quality: 'epic', status: 'active', level: 40,
      avatar: 'https://images.unsplash.com/photo-1611956425642-d5a8169abd63?w=200&q=80',
      popularity: 90, growth7d: 11.3, fans: '234K', commercialValue: '¥3.5M',
      bio: '顶级综艺咖，笑点密集，弹幕霸榜，带货转化超强。',
      domains: ['综艺', '曲艺表演', '游戏娱乐'],
      talents: { singing: 22, acting: 40, dancing: 28, hosting: 60, comedy: 92, variety: 88 },
    },
  },
  {
    id: 'ml4', sellerId: 's4', sellerName: 'OmniStar Studio', sellerRep: 96,
    contractType: 'full', saleType: 'fixed', price: 82000, baseValuation: 78000,
    zone: 'hot', listedAt: NOW - 1000 * 3600 * 3, views: 1568, wishlistCount: 134, exclusive: true,
    tags: ['全能选手', '六边形战士', '跨界王者'], listingStatus: 'active',
    artist: {
      id: 'ma4', name: 'Echo All', type: 'all_rounder', quality: 'epic', status: 'active', level: 44,
      avatar: 'https://images.unsplash.com/photo-1767755255170-c79c863f1849?w=200&q=80',
      popularity: 88, growth7d: 6.9, fans: '198K', commercialValue: '¥4.1M',
      bio: '无短板全能艺人，跨域联动爆发力极强，商业开发空间巨大。',
      domains: ['音乐', '影视', '综艺', '商业代言'],
      talents: { singing: 72, acting: 70, dancing: 68, hosting: 65, comedy: 62, variety: 74 },
    },
  },
  // ── Rookie Zone ──
  {
    id: 'ml5', sellerId: 's5', sellerName: 'FlexLab MCN', sellerRep: 82,
    contractType: 'full', saleType: 'fixed', price: 14800, baseValuation: 13200,
    zone: 'rookie', listedAt: NOW - 1000 * 3600 * 12, views: 234, wishlistCount: 28, exclusive: false,
    tags: ['街舞', '潜力新星', '爆炸增速'], listingStatus: 'active',
    artist: {
      id: 'ma5', name: 'Flow Step', type: 'dancer', quality: 'rare', status: 'trainee', level: 20,
      avatar: 'https://images.unsplash.com/photo-1761882619891-6529ff92df0a?w=200&q=80',
      popularity: 58, growth7d: 22.4, fans: '38K', commercialValue: '¥380K',
      bio: '街舞系新星，增速惊人，近30天粉丝增长22%，潜力炸裂。',
      domains: ['舞台表演', '音乐'],
      talents: { singing: 28, acting: 15, dancing: 80, hosting: 12, comedy: 22, variety: 38 },
    },
  },
  {
    id: 'ml6', sellerId: 's6', sellerName: 'TalkBox MCN', sellerRep: 76,
    contractType: 'full', saleType: 'fixed', price: 5800, baseValuation: 5200,
    zone: 'rookie', listedAt: NOW - 1000 * 3600 * 24, views: 89, wishlistCount: 12, exclusive: false,
    tags: ['主持新人', '声线好', '成长空间大'], listingStatus: 'active',
    artist: {
      id: 'ma6', name: 'Byte Voice', type: 'host', quality: 'common', status: 'debut', level: 12,
      avatar: 'https://images.unsplash.com/photo-1610414302351-ded0a0a2664a?w=200&q=80',
      popularity: 42, growth7d: 18.6, fans: '14K', commercialValue: '¥98K',
      bio: '新生代AI主持，声线辨识度极高，成本低，培育空间大。',
      domains: ['综艺', '教育培训'],
      talents: { singing: 15, acting: 25, dancing: 10, hosting: 70, comedy: 35, variety: 52 },
    },
  },
  {
    id: 'ml7', sellerId: 's7', sellerName: 'NeonLabel', sellerRep: 79,
    contractType: 'revenue_share', saleType: 'fixed', price: 8500, baseValuation: 9800,
    revenueSharePct: 40, zone: 'rookie', listedAt: NOW - 1000 * 3600 * 18, views: 156, wishlistCount: 22, exclusive: false,
    tags: ['古风偶像', '治愈系', '高互动'], listingStatus: 'active',
    artist: {
      id: 'ma7', name: 'Mist Hana', type: 'idol', quality: 'rare', status: 'debut', level: 18,
      avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
      popularity: 55, growth7d: 15.8, fans: '52K', commercialValue: '¥420K',
      bio: '国风治愈系偶像，评论区暖心女神，粉丝粘性极高。',
      domains: ['音乐', '舞台表演'],
      talents: { singing: 62, acting: 32, dancing: 55, hosting: 25, comedy: 18, variety: 44 },
    },
  },
  // ── Legendary Zone ──
  {
    id: 'ml8', sellerId: 's8', sellerName: 'NeonLabel', sellerRep: 97,
    contractType: 'full', saleType: 'auction', price: 150000, baseValuation: 298000,
    currentBid: 168000, bidCount: 14,
    auctionEndTime: NOW + 1000 * 3600 * 22,
    zone: 'legendary', listedAt: NOW - 1000 * 3600 * 26, views: 4821, wishlistCount: 386, exclusive: true,
    tags: ['顶级偶像', '传奇品质', '粉丝经济', '应援文化'], listingStatus: 'active',
    artist: {
      id: 'ma8', name: 'Star Bloom', type: 'idol', quality: 'legendary', status: 'active', level: 56,
      avatar: 'https://images.unsplash.com/photo-1645457979199-709c96b14526?w=200&q=80',
      popularity: 94, growth7d: 11.2, fans: '318K', commercialValue: '¥5.6M',
      bio: '传奇级偶像，粉丝经济体系完备，IP衍生价值无上限。',
      domains: ['音乐', '综艺', '商业代言', '舞台表演'],
      talents: { singing: 80, acting: 48, dancing: 85, hosting: 40, comedy: 30, variety: 76 },
    },
  },
  {
    id: 'ml9', sellerId: 's9', sellerName: 'GlobalStar', sellerRep: 98,
    contractType: 'full', saleType: 'auction', price: 200000, baseValuation: 418000,
    currentBid: 244000, bidCount: 22,
    auctionEndTime: NOW + 1000 * 3600 * 11,
    zone: 'legendary', listedAt: NOW - 1000 * 3600 * 48, views: 8934, wishlistCount: 621, exclusive: true,
    tags: ['传奇全能', '六边形战士', 'IP矩阵', '顶流商业'], listingStatus: 'active',
    artist: {
      id: 'ma9', name: 'Omni Star', type: 'all_rounder', quality: 'legendary', status: 'active', level: 63,
      avatar: 'https://images.unsplash.com/photo-1622278802459-7ffa72354cb9?w=200&q=80',
      popularity: 93, growth7d: 8.1, fans: '276K', commercialValue: '¥6.2M',
      bio: '传说级全能艺人，跨圈联动天花板，商业价值持续爆发中。',
      domains: ['音乐', '影视', '综艺', '舞台表演', '商业代言'],
      talents: { singing: 74, acting: 70, dancing: 72, hosting: 68, comedy: 63, variety: 78 },
    },
  },
  // ── Flash Zone ──
  {
    id: 'ml10', sellerId: 's10', sellerName: 'DreamCo', sellerRep: 85,
    contractType: 'loan', saleType: 'fixed', price: 8800, baseValuation: 26000,
    loanDays: 30, zone: 'flash', listedAt: NOW - 1000 * 1800,
    flashExpiresAt: NOW + 1000 * 3600 * 2.8,
    views: 443, wishlistCount: 58, exclusive: false,
    tags: ['治愈偶像', '借调特惠', '30天'], listingStatus: 'active',
    artist: {
      id: 'ma10', name: 'Dream Light', type: 'idol', quality: 'rare', status: 'active', level: 26,
      avatar: 'https://images.unsplash.com/photo-1596395463910-3ac2899a5bea?w=200&q=80',
      popularity: 68, growth7d: 16.4, fans: '84K', commercialValue: '¥760K',
      bio: '治愈系偶像，限时借调特惠，适合短期项目合作。',
      domains: ['音乐', '舞台表演'],
      talents: { singing: 64, acting: 38, dancing: 58, hosting: 28, comedy: 24, variety: 50 },
    },
  },
  {
    id: 'ml11', sellerId: 's11', sellerName: 'HypeFactory', sellerRep: 91,
    contractType: 'full', saleType: 'fixed', price: 19500, baseValuation: 24800,
    zone: 'flash', listedAt: NOW - 1000 * 900,
    flashExpiresAt: NOW + 1000 * 3600 * 1.4,
    views: 892, wishlistCount: 104, exclusive: false,
    tags: ['电流舞者', '限时特价', '超低折扣'], listingStatus: 'active',
    artist: {
      id: 'ma11', name: 'Volt Dance', type: 'dancer', quality: 'rare', status: 'active', level: 30,
      avatar: 'https://images.unsplash.com/photo-1745532665626-09f20c9408dd?w=200&q=80',
      popularity: 72, growth7d: 20.1, fans: '78K', commercialValue: '¥720K',
      bio: '机械舞+霓虹特效，爆款短视频制造机，限时特惠折扣21%。',
      domains: ['舞台表演', '音乐'],
      talents: { singing: 28, acting: 18, dancing: 88, hosting: 16, comedy: 32, variety: 46 },
    },
  },
  {
    id: 'ml12', sellerId: 's4', sellerName: 'OmniStar Studio', sellerRep: 96,
    contractType: 'loan', saleType: 'fixed', price: 12000, baseValuation: 48600,
    loanDays: 7, zone: 'flash', listedAt: NOW - 1000 * 600,
    flashExpiresAt: NOW + 1000 * 3600 * 0.8,
    views: 1234, wishlistCount: 178, exclusive: false,
    tags: ['顶流史诗', '7天借调', '超低成本'], listingStatus: 'active',
    artist: {
      id: 'ma12', name: 'Neon Surge', type: 'singer', quality: 'epic', status: 'active', level: 36,
      avatar: 'https://images.unsplash.com/photo-1694877286935-0e7decac9bb1?w=200&q=80',
      popularity: 82, growth7d: 9.5, fans: '104K', commercialValue: '¥1.0M',
      bio: '史诗级歌手限时7天借调，适合单曲项目或活动宣传。',
      domains: ['音乐', '舞台表演'],
      talents: { singing: 88, acting: 30, dancing: 55, hosting: 18, comedy: 20, variety: 40 },
    },
  },
  // ── Co-Incubation Zone ──
  {
    id: 'ml13', sellerId: 's2', sellerName: 'DarkRoom MCN', sellerRep: 88,
    contractType: 'co_incubation', saleType: 'fixed', price: 0, baseValuation: 72000,
    zone: 'co_incubation', listedAt: NOW - 1000 * 3600 * 6,
    views: 312, wishlistCount: 44, exclusive: false,
    coInviteDesc: '寻找具备短视频运营经验的制作人，共同孵化影视演员赛道，预期半年内完成10部微短剧，五五分成。',
    tags: ['悬疑演员', '五五分成', '微短剧'], listingStatus: 'active',
    artist: {
      id: 'ma13', name: 'Void Shade', type: 'actor', quality: 'rare', status: 'active', level: 28,
      avatar: 'https://images.unsplash.com/photo-1760564704843-07b22892b0bf?w=200&q=80',
      popularity: 64, growth7d: 5.6, fans: '62K', commercialValue: '¥1.2M',
      bio: '暗黑风格演员，适合悬疑惊悚赛道，需要专业团队联合运营。',
      domains: ['影视', '商业代言'],
      talents: { singing: 20, acting: 80, dancing: 15, hosting: 28, comedy: 48, variety: 35 },
    },
  },
  {
    id: 'ml14', sellerId: 's12', sellerName: 'SignalBase', sellerRep: 83,
    contractType: 'co_incubation', saleType: 'fixed', price: 0, baseValuation: 54000,
    zone: 'co_incubation', listedAt: NOW - 1000 * 3600 * 9,
    views: 198, wishlistCount: 31, exclusive: false,
    coInviteDesc: '寻找粉丝私域运营专家，联合开发主持人IP周边和知识付费体系，三七分成（制作人七）。',
    tags: ['主持人', '三七分成', '知识付费'], listingStatus: 'active',
    artist: {
      id: 'ma14', name: 'Signal MC', type: 'host', quality: 'epic', status: 'active', level: 32,
      avatar: 'https://images.unsplash.com/photo-1610414302351-ded0a0a2664a?w=200&q=80',
      popularity: 76, growth7d: 8.8, fans: '142K', commercialValue: '¥2.2M',
      bio: '知识型AI主持人，专业知识付费赛道，需要私域运营合伙人。',
      domains: ['综艺', '教育培训'],
      talents: { singing: 20, acting: 30, dancing: 12, hosting: 85, comedy: 40, variety: 60 },
    },
  },
  // ── My Listings (isOwn) ──
  {
    id: 'ml15', sellerId: 'current_user', sellerName: '我', sellerRep: 88,
    contractType: 'revenue_share', saleType: 'fixed', price: 38000, baseValuation: 48600,
    revenueSharePct: 40, zone: 'mine', listedAt: NOW - 1000 * 3600 * 14,
    views: 234, wishlistCount: 28, exclusive: false, isOwn: true, offerCount: 3,
    tags: ['电子音乐', '赛博风'], listingStatus: 'active',
    artist: { ...MOCK_ARTISTS[0] as any,
      popularity: MOCK_ARTISTS[0].stats.popularity, growth7d: MOCK_ARTISTS[0].stats.growth7d,
      fans: MOCK_ARTISTS[0].stats.fans, commercialValue: MOCK_ARTISTS[0].commercialValue,
    },
  },
  {
    id: 'ml16', sellerId: 'current_user', sellerName: '我', sellerRep: 88,
    contractType: 'loan', saleType: 'fixed', price: 6800, baseValuation: 13200,
    loanDays: 14, zone: 'mine', listedAt: NOW - 1000 * 3600 * 36,
    views: 67, wishlistCount: 8, exclusive: false, isOwn: true, offerCount: 1,
    tags: ['街舞', '短期借调'], listingStatus: 'active',
    artist: { ...MOCK_ARTISTS[4] as any,
      popularity: MOCK_ARTISTS[4].stats.popularity, growth7d: MOCK_ARTISTS[4].stats.growth7d,
      fans: MOCK_ARTISTS[4].stats.fans, commercialValue: MOCK_ARTISTS[4].commercialValue,
    },
  },
];

// ─── Countdown Timer Hook ─────────────────────────────────────────────────────

function useCountdown(endTime: number | undefined) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!endTime) return;
    const update = () => setRemaining(Math.max(0, endTime - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, expired: remaining === 0 };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const QualityBadge = ({ quality, zh }: { quality: Quality; zh: boolean }) => {
  const cfg = QUALITY_CFG[quality];
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.bg} border ${cfg.border} ${cfg.color} font-mono`}>
      {zh ? cfg.zh : cfg.en}
    </span>
  );
};

const ContractBadge = ({ type, zh }: { type: ContractType; zh: boolean }) => {
  const cfg = CONTRACT_CFG[type];
  return (
    <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${cfg.bg} border ${cfg.border} ${cfg.color}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {zh ? cfg.zh : cfg.en}
    </span>
  );
};

const FlashTimer = ({ expiresAt, zh }: { expiresAt: number; zh: boolean }) => {
  const { h, m, s, expired } = useCountdown(expiresAt);
  if (expired) return <span className="text-[9px] text-red-500 font-mono">{zh ? '已过期' : 'Expired'}</span>;
  return (
    <span className="flex items-center gap-1 text-[9px] text-red-400 font-mono">
      <Timer className="w-3 h-3" />
      {h > 0 && `${h}h `}{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
};

// ─── Market Card ──────────────────────────────────────────────────────────────

const MarketCard = ({
  listing, zh, isWishlisted, onWishlist, onSelect,
}: {
  listing: MarketListing; zh: boolean;
  isWishlisted: boolean; onWishlist: () => void; onSelect: () => void;
}) => {
  const { artist, contractType, saleType, price, currentBid, zone } = listing;
  const qCfg = QUALITY_CFG[artist.quality];
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const statusConf = STATUS_CONFIG[artist.status];

  const displayPrice = () => {
    if (saleType === 'auction') return { label: zh ? '当前出价' : 'Current Bid', val: `¥${((currentBid || price) / 1000).toFixed(0)}K` };
    if (contractType === 'loan') return { label: `${listing.loanDays}${zh ? '天借调' : 'd Loan'}`, val: `¥${(price / 1000).toFixed(1)}K` };
    if (saleType === 'negotiation') return { label: zh ? '议价起步' : 'Starting', val: `¥${(price / 1000).toFixed(0)}K` };
    return { label: zh ? '买断价' : 'Price', val: `¥${(price / 1000).toFixed(0)}K` };
  };
  const priceInfo = displayPrice();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onSelect}
      className="relative bg-gray-900/60 border rounded-xl overflow-hidden cursor-pointer group transition-all"
      style={{
        borderColor: qCfg.glow ? undefined : 'rgba(255,255,255,0.06)',
        boxShadow: qCfg.glow || undefined,
        border: qCfg.glow ? `1px solid ${artist.quality === 'legendary' ? 'rgba(245,158,11,0.25)' : artist.quality === 'epic' ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.15)'}` : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Portrait */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <QualityBadge quality={artist.quality} zh={zh} />
          <div className="flex flex-col items-end gap-1">
            {zone === 'flash' && listing.flashExpiresAt && (
              <FlashTimer expiresAt={listing.flashExpiresAt} zh={zh} />
            )}
            {saleType === 'auction' && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-mono flex items-center gap-1">
                <Gavel className="w-2.5 h-2.5" /> {zh ? '竞拍中' : 'Live Bid'}
              </span>
            )}
            {listing.exclusive && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-mono">
                {zh ? '独家' : 'Excl.'}
              </span>
            )}
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="flex items-end justify-between gap-1">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight truncate">{artist.name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px]">{typeConf.icon}</span>
                <span className="text-[10px] text-gray-400">{zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}</span>
                <span className="text-[9px] text-cyan-400 font-mono">Lv.{artist.level}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] text-gray-500">{priceInfo.label}</div>
              <div className={`text-sm font-bold ${artist.quality === 'legendary' ? 'text-amber-400' : artist.quality === 'epic' ? 'text-purple-400' : 'text-white'}`}>
                {priceInfo.val}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <ContractBadge type={contractType} zh={zh} />
          <div className="flex items-center gap-2 text-[9px] text-gray-600">
            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{listing.views > 999 ? `${(listing.views / 1000).toFixed(1)}K` : listing.views}</span>
            <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{listing.wishlistCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            size="sm"
            className="flex-1 h-7 text-[11px] bg-gradient-to-r from-red-600/80 to-amber-600/80 hover:from-red-500 hover:to-amber-500 text-white border-0"
          >
            {listing.isOwn ? (zh ? '管理' : 'Manage') :
              saleType === 'auction' ? (zh ? '参与竞拍' : 'Bid') :
              saleType === 'negotiation' ? (zh ? '发起议价' : 'Negotiate') :
              contractType === 'co_incubation' ? (zh ? '申请合作' : 'Apply') :
              (zh ? '立即签约' : 'Sign Now')}
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); onWishlist(); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition border ${
              isWishlisted ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/[0.03] border-white/8 text-gray-600 hover:text-gray-400'
            }`}
          >
            <Heart className="w-3 h-3" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const DetailDrawer = ({
  listing, zh, balance, onClose, onBuy, onBid, isWishlisted, onWishlist,
}: {
  listing: MarketListing; zh: boolean; balance: number;
  onClose: () => void;
  onBuy: (listing: MarketListing) => void;
  onBid: (listing: MarketListing, amount: number) => void;
  isWishlisted: boolean; onWishlist: () => void;
}) => {
  const { artist } = listing;
  const qCfg = QUALITY_CFG[artist.quality];
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const cCfg = CONTRACT_CFG[listing.contractType];
  const { h, m, s } = useCountdown(listing.auctionEndTime);

  const [bidInput, setBidInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [txState, setTxState] = useState<'idle' | 'confirm' | 'processing' | 'success'>('idle');
  const [negState, setNegState] = useState<'idle' | 'sent' | 'countered'>('idle');

  const handleBuy = () => {
    if (txState === 'idle') { setTxState('confirm'); return; }
    if (txState === 'confirm') {
      setTxState('processing');
      setTimeout(() => { setTxState('success'); onBuy(listing); }, 1800);
    }
  };

  const handleBid = () => {
    const amt = parseInt(bidInput);
    if (!amt || amt <= (listing.currentBid || listing.price)) return;
    setTxState('processing');
    setTimeout(() => { setTxState('success'); onBid(listing, amt); }, 1400);
  };

  const handleNegotiate = () => {
    if (!offerInput) return;
    setNegState('sent');
    setTimeout(() => setNegState('countered'), 2000);
  };

  const maxTalent = Math.max(...Object.values(artist.talents));

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed right-0 top-0 bottom-0 w-full md:w-[420px] bg-gray-950 border-l border-white/8 z-50 flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest text-gray-600 uppercase font-mono">{zh ? '艺人详情' : 'Artist Detail'}</span>
          <QualityBadge quality={artist.quality} zh={zh} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onWishlist} className={`w-7 h-7 rounded-lg flex items-center justify-center transition border ${isWishlisted ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/[0.03] border-white/8 text-gray-500 hover:text-white'}`}>
            <Heart className="w-3.5 h-3.5" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/8 text-gray-500 hover:text-white transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Portrait banner */}
        <div className="relative h-56 overflow-hidden">
          <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{artist.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">{typeConf.icon}</span>
                <span className="text-sm text-gray-300">{zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}</span>
                <span className={`text-xs font-mono ${STATUS_CONFIG[artist.status].color}`}>
                  {zh ? STATUS_CONFIG[artist.status].zh : STATUS_CONFIG[artist.status].en}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500">{zh ? '等级' : 'Level'}</div>
              <div className="text-2xl font-black text-cyan-400 font-mono">Lv.{artist.level}</div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Bio */}
          <p className="text-xs text-gray-400 leading-relaxed">{artist.bio}</p>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: zh ? '人气' : 'Popularity', val: `${artist.popularity}%`, icon: Star, color: 'text-amber-400' },
              { label: zh ? '粉丝' : 'Fans', val: artist.fans, icon: Users, color: 'text-cyan-400' },
              { label: zh ? '7天涨幅' : '7d Growth', val: `+${artist.growth7d}%`, icon: TrendingUp, color: 'text-green-400' },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
                <s.icon className={`w-3.5 h-3.5 ${s.color} mx-auto mb-1`} />
                <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[9px] text-gray-600">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Talent bars */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">{zh ? '才能分布' : 'Talent'}</div>
            <div className="space-y-1.5">
              {Object.entries(artist.talents).map(([key, val]) => {
                const tlbl = TALENT_LABELS[key as keyof typeof TALENT_LABELS];
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-10 text-[9px] text-gray-500 text-right shrink-0">{zh ? tlbl.zh : tlbl.en}</div>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${val}%` }}
                        transition={{ delay: 0.1, duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ background: tlbl.color }}
                      />
                    </div>
                    <div className="w-6 text-[9px] text-gray-500 font-mono shrink-0">{val}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Domains */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">{zh ? '擅长领域' : 'Domains'}</div>
            <div className="flex flex-wrap gap-1">
              {artist.domains.map(d => (
                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/8 text-gray-400">{d}</span>
              ))}
            </div>
          </div>

          {/* Seller info */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">{zh ? '卖方信息' : 'Seller'}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-[11px]">
                  {listing.sellerName.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-medium text-white">{listing.sellerName}</div>
                  <div className="text-[9px] text-gray-500">{zh ? '信誉分' : 'Rep'}: <span className="text-green-400">{listing.sellerRep}</span></div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-gray-500">{zh ? '估值' : 'Valuation'}</div>
                <div className="text-sm font-bold text-gray-300">¥{(listing.baseValuation / 1000).toFixed(0)}K</div>
              </div>
            </div>
          </div>

          {/* Contract details */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 space-y-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-mono">{zh ? '合约详情' : 'Contract'}</div>
            <div className="flex items-center justify-between">
              <ContractBadge type={listing.contractType} zh={zh} />
              {listing.exclusive && <span className="text-[9px] text-red-400 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />{zh ? '独家合约' : 'Exclusive'}</span>}
            </div>
            {listing.contractType === 'revenue_share' && (
              <div className="text-xs text-gray-400">
                {zh ? `卖方保留 ${listing.revenueSharePct}% 分成，您获得 ${100 - (listing.revenueSharePct || 0)}%` : `Seller retains ${listing.revenueSharePct}% revenue`}
              </div>
            )}
            {listing.contractType === 'loan' && (
              <div className="text-xs text-gray-400">
                {zh ? `借调期限 ${listing.loanDays} 天，到期自动归还` : `${listing.loanDays}-day loan, auto-return`}
              </div>
            )}
            {listing.contractType === 'co_incubation' && listing.coInviteDesc && (
              <div className="text-xs text-gray-400 leading-relaxed">{listing.coInviteDesc}</div>
            )}
          </div>

          {/* ── Transaction Panel ── */}
          <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-mono">{zh ? '交易区' : 'Transaction'}</div>

            <AnimatePresence mode="wait">
              {txState === 'success' ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-sm font-semibold text-green-400">{zh ? '交易成功！' : 'Success!'}</div>
                  <div className="text-[10px] text-gray-500">{zh ? `${artist.name} 已加入你的艺人库` : `${artist.name} added to your roster`}</div>
                </motion.div>
              ) : txState === 'processing' ? (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-4">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                  <div className="text-xs text-gray-400">{zh ? '处理中...' : 'Processing...'}</div>
                </motion.div>
              ) : listing.saleType === 'fixed' ? (
                <motion.div key="fixed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{listing.contractType === 'loan' ? (zh ? '借调费用' : 'Loan Fee') : (zh ? '签约价格' : 'Price')}</span>
                    <span className="text-lg font-black text-white">¥{listing.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <span>{zh ? '当前余额' : 'Balance'}</span>
                    <span className={balance < listing.price ? 'text-red-400' : 'text-green-400'}>
                      ⬡ {balance.toLocaleString()} SC
                    </span>
                  </div>
                  {txState === 'confirm' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-400">
                      {zh ? '⚠️ 确认签约后不可撤销，请确认条款无误' : '⚠️ Signing is irreversible. Confirm terms.'}
                    </motion.div>
                  )}
                  <Button onClick={handleBuy} disabled={balance < listing.price}
                    className={`w-full h-9 text-xs border-0 text-white ${
                      txState === 'confirm'
                        ? 'bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500'
                        : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500'
                    }`}>
                    {txState === 'confirm' ? (zh ? '确认签约' : 'Confirm Sign') : (listing.contractType === 'co_incubation' ? (zh ? '申请联合孵化' : 'Apply Co-Incubation') : listing.contractType === 'loan' ? (zh ? '立即借调' : 'Loan Now') : (zh ? '立即签约' : 'Sign Now'))}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </motion.div>
              ) : listing.saleType === 'auction' ? (
                <motion.div key="auction" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-gray-500">{zh ? '当前最高出价' : 'Current Bid'}</div>
                      <div className="text-xl font-black text-amber-400">¥{((listing.currentBid || listing.price) / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-gray-500">{zh ? '剩余时间' : 'Ends In'}</div>
                      <div className="text-sm font-mono text-red-400">{h}h {m.toString().padStart(2,'0')}m {s.toString().padStart(2,'0')}s</div>
                      <div className="text-[9px] text-gray-600">{listing.bidCount} {zh ? '次出价' : 'bids'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={bidInput}
                      onChange={e => setBidInput(e.target.value)}
                      placeholder={`≥ ¥${(((listing.currentBid || listing.price) + 5000) / 1000).toFixed(0)}K`}
                      className="flex-1 h-8 text-xs bg-white/[0.03] border-white/10 text-white"
                    />
                    <Button onClick={handleBid} size="sm"
                      className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-500 text-white border-0">
                      <Gavel className="w-3 h-3 mr-1" />{zh ? '出价' : 'Bid'}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="negotiate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="text-xs text-gray-400">{zh ? '卖方参考价' : 'Reference Price'}: <span className="text-white font-bold">¥{(listing.price / 1000).toFixed(0)}K</span></div>
                  {negState === 'idle' && (
                    <div className="flex gap-2">
                      <Input value={offerInput} onChange={e => setOfferInput(e.target.value)}
                        placeholder={zh ? '输入你的出价 ¥' : 'Enter your offer ¥'}
                        className="flex-1 h-8 text-xs bg-white/[0.03] border-white/10 text-white" />
                      <Button onClick={handleNegotiate} size="sm"
                        className="h-8 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-0">
                        {zh ? '发报价' : 'Offer'}
                      </Button>
                    </div>
                  )}
                  {negState === 'sent' && (
                    <div className="flex items-center gap-2 text-xs text-cyan-400 py-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {zh ? '报价已发出，等待卖家回复...' : 'Offer sent, awaiting response...'}
                    </div>
                  )}
                  {negState === 'countered' && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5 space-y-2">
                      <div className="text-[10px] text-purple-300">{zh ? '卖家回复：报价偏低，最终接受价' : 'Seller: offer low, final price'}</div>
                      <div className="text-lg font-black text-purple-400">¥{Math.round(listing.price * 0.88).toLocaleString()}</div>
                      <Button onClick={handleBuy} size="sm"
                        className="w-full h-7 text-[11px] bg-purple-600 hover:bg-purple-500 text-white border-0">
                        {zh ? '接受成交' : 'Accept Deal'}
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Listing Wizard ───────────────────────────────────────────────────────────

const ListingWizard = ({ zh, onClose, onPublish }: { zh: boolean; onClose: () => void; onPublish: () => void }) => {
  const [step, setStep] = useState(0);
  const [selectedArtist, setSelectedArtist] = useState<typeof MOCK_ARTISTS[0] | null>(null);
  const [contractType, setContractType] = useState<ContractType>('full');
  const [saleType, setSaleType] = useState<SaleType>('fixed');
  const [price, setPrice] = useState('');
  const [sharePct, setSharePct] = useState(50);
  const [loanDays, setLoanDays] = useState(30);
  const [exclusive, setExclusive] = useState(false);
  const [published, setPublished] = useState(false);

  const handlePublish = () => {
    setPublished(true);
    setTimeout(() => { onPublish(); }, 1800);
  };

  const STEPS = [zh ? '选择艺人' : 'Select Artist', zh ? '设置方案' : 'Set Terms', zh ? '确认上架' : 'Publish'];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-sm font-bold">{zh ? '上架艺人' : 'List Artist'}</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{zh ? `步骤 ${step + 1} / 3` : `Step ${step + 1} / 3`} · {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/8 flex items-center justify-center text-gray-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-5 pt-4 gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-0.5 rounded-full transition-all ${i <= step ? 'bg-cyan-400' : 'bg-white/10'}`} />
              <div className={`text-[9px] mt-1 ${i === step ? 'text-cyan-400' : 'text-gray-600'}`}>{s}</div>
            </div>
          ))}
        </div>

        <div className="p-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {/* Step 0: Select artist */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <p className="text-xs text-gray-400 mb-3">{zh ? '从你的艺人库中选择要上架的艺人' : 'Choose an artist from your roster to list'}</p>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {MOCK_ARTISTS.map(a => {
                    const tc = ARTIST_TYPE_CONFIG[a.type];
                    const qc = QUALITY_CFG[a.quality];
                    const sel = selectedArtist?.id === a.id;
                    return (
                      <button key={a.id} onClick={() => setSelectedArtist(a)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition text-left ${sel ? 'border-cyan-500/40 bg-cyan-500/8' : 'border-white/8 bg-white/[0.02] hover:border-white/15'}`}>
                        <img src={a.avatar} alt={a.name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{a.name}</span>
                            <QualityBadge quality={a.quality} zh={zh} />
                          </div>
                          <div className="text-[10px] text-gray-500">{tc.icon} Lv.{a.level} · {a.stats.fans} {zh ? '粉丝' : 'fans'}</div>
                        </div>
                        {sel && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 1: Set terms */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                {/* Contract type */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">{zh ? '合约类型' : 'Contract Type'}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CONTRACT_CFG) as ContractType[]).map(ct => {
                      const cc = CONTRACT_CFG[ct];
                      const sel = contractType === ct;
                      return (
                        <button key={ct} onClick={() => setContractType(ct)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border transition text-left ${sel ? `${cc.bg} ${cc.border}` : 'bg-white/[0.02] border-white/8 hover:border-white/15'}`}>
                          <cc.Icon className={`w-4 h-4 ${sel ? cc.color : 'text-gray-600'}`} />
                          <div>
                            <div className={`text-[11px] font-medium ${sel ? cc.color : 'text-gray-400'}`}>{zh ? cc.zh : cc.en}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sale type */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">{zh ? '出售方式' : 'Sale Type'}</div>
                  <div className="flex gap-2">
                    {[
                      { id: 'fixed' as SaleType, zh: '一口价', en: 'Fixed', icon: Tag },
                      { id: 'auction' as SaleType, zh: '竞拍', en: 'Auction', icon: Gavel },
                      { id: 'negotiation' as SaleType, zh: '议价', en: 'Negotiate', icon: MessageSquare },
                    ].map(st => {
                      const sel = saleType === st.id;
                      return (
                        <button key={st.id} onClick={() => setSaleType(st.id)}
                          className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border transition ${sel ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.02] border-white/8 hover:border-white/15'}`}>
                          <st.icon className={`w-4 h-4 ${sel ? 'text-cyan-400' : 'text-gray-600'}`} />
                          <span className={`text-[10px] ${sel ? 'text-cyan-400' : 'text-gray-500'}`}>{zh ? st.zh : st.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <div className="text-xs text-gray-400 mb-1.5">{saleType === 'auction' ? (zh ? '起拍价 ¥' : 'Starting Bid ¥') : contractType === 'loan' ? (zh ? '借调费用 ¥' : 'Loan Fee ¥') : (zh ? '挂牌价格 ¥' : 'Listing Price ¥')}</div>
                  <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                    className="h-8 text-xs bg-white/[0.03] border-white/10 text-white" />
                </div>

                {/* Conditional options */}
                {contractType === 'revenue_share' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs text-gray-400">{zh ? `我保留分成 ${sharePct}%` : `I retain ${sharePct}%`}</div>
                      <div className="text-xs text-cyan-400">{zh ? `买方获得 ${100 - sharePct}%` : `Buyer gets ${100 - sharePct}%`}</div>
                    </div>
                    <input type="range" min="20" max="80" value={sharePct} onChange={e => setSharePct(Number(e.target.value))} className="w-full accent-cyan-500" />
                  </div>
                )}
                {contractType === 'loan' && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1.5">{zh ? '借调期限' : 'Loan Duration'}</div>
                    <div className="flex gap-2">
                      {[7, 14, 30, 90].map(d => (
                        <button key={d} onClick={() => setLoanDays(d)}
                          className={`flex-1 py-1.5 rounded-lg border text-[11px] transition ${loanDays === d ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/[0.02] border-white/8 text-gray-500 hover:border-white/15'}`}>
                          {d}{zh ? '天' : 'd'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">{zh ? '独家合约' : 'Exclusive'}</div>
                  <button onClick={() => setExclusive(!exclusive)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${exclusive ? 'bg-cyan-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${exclusive ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Review */}
            {step === 2 && !published && (
              <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                {selectedArtist && (
                  <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/8 rounded-xl">
                    <img src={selectedArtist.avatar} alt={selectedArtist.name} className="w-12 h-12 rounded-xl object-cover" />
                    <div>
                      <div className="font-semibold">{selectedArtist.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <QualityBadge quality={selectedArtist.quality} zh={zh} />
                        <span className="text-[10px] text-gray-500">Lv.{selectedArtist.level}</span>
                      </div>
                    </div>
                  </div>
                )}
                {[
                  { label: zh ? '合约类型' : 'Contract', val: zh ? CONTRACT_CFG[contractType].zh : CONTRACT_CFG[contractType].en },
                  { label: zh ? '出售方式' : 'Sale Type', val: saleType === 'fixed' ? (zh ? '一口价' : 'Fixed') : saleType === 'auction' ? (zh ? '竞拍' : 'Auction') : (zh ? '议价' : 'Negotiate') },
                  { label: zh ? '挂牌价格' : 'Price', val: price ? `¥${parseInt(price).toLocaleString()}` : '-' },
                  ...(contractType === 'revenue_share' ? [{ label: zh ? '我的分成' : 'My Share', val: `${sharePct}%` }] : []),
                  ...(contractType === 'loan' ? [{ label: zh ? '借调天数' : 'Loan Days', val: `${loanDays} ${zh ? '天' : 'days'}` }] : []),
                  { label: zh ? '独家合约' : 'Exclusive', val: exclusive ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No') },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className="text-xs font-medium text-white">{row.val}</span>
                  </div>
                ))}
                <div className="text-[10px] text-gray-600 mt-2">{zh ? '上架后48小时内可撤回，成交后不可反悔。' : 'Can withdraw within 48h of listing. No reversal after deal.'}</div>
              </motion.div>
            )}

            {published && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-8">
                <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div className="text-base font-bold text-green-400">{zh ? '上架成功！' : 'Listed!'}</div>
                <div className="text-xs text-gray-500">{zh ? '艺人已进入市场，等待买家' : 'Your artist is now on market'}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {!published && (
          <div className="flex items-center gap-2 px-5 pb-5">
            {step > 0 && (
              <Button onClick={() => setStep(s => s - 1)} variant="ghost" size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/10 border border-white/8 h-9">
                {zh ? '上一步' : 'Back'}
              </Button>
            )}
            <Button
              onClick={step < 2 ? () => setStep(s => s + 1) : handlePublish}
              disabled={(step === 0 && !selectedArtist) || (step === 2 && !price && contractType !== 'co_incubation')}
              className="flex-1 h-9 text-xs bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-0"
            >
              {step < 2 ? (zh ? '下一步' : 'Next') : (zh ? '确认上架' : 'Publish')}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Celebrity Resource Library (Tab 2) ────────────────────────────────────────

const CELEBRITY_GRADES = [
  { grade: 'S', color: '#f59e0b', price: '¥9,999', count: 12, desc: { zh: '全平台总粉丝>1亿', en: '>100M total followers' } },
  { grade: 'A', color: '#a855f7', price: '¥4,999', count: 38, desc: { zh: '3000万~1亿粉丝', en: '30M~100M followers' } },
  { grade: 'B', color: '#06b6d4', price: '¥1,999', count: 86, desc: { zh: '500万~3000万粉丝', en: '5M~30M followers' } },
  { grade: 'C', color: '#22c55e', price: '¥599',   count: 50, desc: { zh: '<500万/新兴艺人', en: '<5M / Rising stars' } },
];

const CELEBRITY_LIST = [
  { name: '于震', grade: 'A', tags: ['古装','谍战','正剧'], fans: '2,180万', gmv: '高潜力', score: 92, color: '#06b6d4', img: 'https://images.unsplash.com/photo-1681097561932-36d0df02b379?w=200&q=80', signed: false },
  { name: '肖战',  grade: 'S', tags: ['流量','品牌','音乐'], fans: '4,530万', gmv: '顶级',   score: 98, color: '#a855f7', img: 'https://images.unsplash.com/photo-1767607746719-38c73b45cd8b?w=200&q=80', signed: true },
  { name: '杨幂',  grade: 'A', tags: ['时尚','美妆','古装'], fans: '3,920万', gmv: '美妆TOP', score: 95, color: '#ec4899', img: 'https://images.unsplash.com/photo-1596029658179-ddca27260f25?w=200&q=80', signed: false },
  { name: '王一博', grade: 'S', tags: ['运动','潮流','音乐'], fans: '5,010万', gmv: '顶级',   score: 99, color: '#f59e0b', img: 'https://images.unsplash.com/photo-1616693629937-fa0aba64d094?w=200&q=80', signed: false },
];

const CelebrityResourceLibrary = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [selectedGrade, setSelectedGrade] = useState<string | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');

  const filtered = CELEBRITY_LIST.filter(c =>
    (selectedGrade === 'all' || c.grade === selectedGrade) &&
    (c.name.includes(searchQ) || c.tags.some(t => t.includes(searchQ)))
  );

  return (
    <div className="space-y-5">
      {/* Grade filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CELEBRITY_GRADES.map(g => (
          <button key={g.grade} onClick={() => setSelectedGrade(selectedGrade === g.grade ? 'all' : g.grade)}
            className={`p-4 rounded-2xl border text-left transition ${selectedGrade === g.grade ? 'border-current' : 'border-white/8 hover:border-white/15'}`}
            style={selectedGrade === g.grade ? { borderColor: `${g.color}50`, background: `${g.color}08` } : {}}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-black" style={{ color: g.color }}>{g.grade}</span>
              <span className="text-[10px] text-gray-600">{g.count}{zh ? '位' : ''}</span>
            </div>
            <div className="text-sm font-bold" style={{ color: g.color }}>{g.price}<span className="text-gray-600 text-xs">/月</span></div>
            <div className="text-[10px] text-gray-500 mt-1">{zh ? g.desc.zh : g.desc.en}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder={zh ? '搜索明星名称或标签...' : 'Search celebrity or tags...'}
          className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-4 text-sm text-white placeholder-gray-600 focus:border-purple-500/30 focus:outline-none transition" />
      </div>

      {/* Celebrity grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            style={{ border: `1px solid ${c.color}25`, background: '#0a0a0f' }}>
            <div className="relative aspect-[3/4] overflow-hidden">
              <img src={c.img} alt={c.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.color}60 0%, transparent 50%)` }} />
              <div className="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded font-black text-xs" style={{ background: `${c.color}30`, color: c.color, border: `1px solid ${c.color}40` }}>{c.grade}</div>
              {c.signed && <div className="absolute top-2.5 right-2.5"><BadgeCheck className="w-4 h-4 text-green-400" /></div>}
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-white/60">{zh ? '综合指数' : 'Score'}</span>
                  <span className="text-[10px] font-black" style={{ color: c.color }}>{c.score}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: c.color }} />
                </div>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div className="text-sm font-extrabold text-white">{c.name}</div>
              <div className="flex flex-wrap gap-1">
                {c.tags.map(t => (
                  <span key={t} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${c.color}12`, border: `1px solid ${c.color}25`, color: c.color }}>{t}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span><Users className="w-2.5 h-2.5 inline mr-0.5" />{c.fans}</span>
                <span className="text-green-400">{zh ? c.gmv : c.gmv}</span>
              </div>
              <button className="w-full h-8 rounded-xl text-[11px] font-bold text-white transition opacity-0 group-hover:opacity-100"
                style={{ background: `linear-gradient(135deg, ${c.color}cc, ${c.color}88)` }}>
                {c.signed ? (zh ? '查看详情' : 'View Details') : (zh ? '发起签约' : 'Start Signing')}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* More celebrities hint */}
      <div className="flex flex-col items-center gap-3 py-8 border border-white/5 rounded-2xl bg-white/[0.01]">
        <div className="text-4xl">⭐</div>
        <div className="text-sm font-semibold text-white">{zh ? '还有 182+ 位明星资源' : '182+ more celebrity resources'}</div>
        <div className="text-xs text-gray-500">{zh ? '前往"明星签约中心"查看完整明星资源库与签约流程' : 'Visit Celebrity Signing Center for full library & signing flow'}</div>
        <button className="px-5 py-2 rounded-xl text-sm font-bold text-white mt-1" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
          {zh ? '进入明星签约中心 →' : 'Go to Celebrity Signing Center →'}
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface ArtistMarketProps {
  lang: Lang;
  balance?: number;
  setBalance?: React.Dispatch<React.SetStateAction<number>>;
  showWizard?: boolean;
  setShowWizard?: (show: boolean) => void;
}

export const ArtistMarket = ({ lang, balance: externalBalance, setBalance: externalSetBalance, showWizard: externalShowWizard, setShowWizard: externalSetShowWizard }: ArtistMarketProps) => {
  const zh = lang === 'zh';
  const [marketTab, setMarketTab] = useState<'ai' | 'celebrity'>('ai');
  const [activeZone, setActiveZone] = useState<MarketZone>('hot');
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [internalShowWizard, setInternalShowWizard] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [internalBalance, setInternalBalance] = useState(100000);

  // Use external state if provided, otherwise use internal state
  const balance = externalBalance !== undefined ? externalBalance : internalBalance;
  const setBalance = externalSetBalance || setInternalBalance;
  const showWizard = externalShowWizard !== undefined ? externalShowWizard : internalShowWizard;
  const setShowWizard = externalSetShowWizard || setInternalShowWizard;
  const [acquiredIds, setAcquiredIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ArtistType | 'all'>('all');
  const [filterQuality, setFilterQuality] = useState<Quality | 'all'>('all');
  const [filterContract, setFilterContract] = useState<ContractType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>(MARKET_LISTINGS);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleBuy = useCallback((listing: MarketListing) => {
    setBalance(b => b - listing.price);
    setAcquiredIds(prev => new Set([...prev, listing.id]));
  }, []);

  const handleBid = useCallback((listing: MarketListing, amount: number) => {
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, currentBid: amount, bidCount: (l.bidCount || 0) + 1 } : l));
  }, []);

  const handlePublish = useCallback(() => {
    setTimeout(() => setShowWizard(false), 400);
  }, []);

  // Filtered + sorted listings
  const filteredListings = listings.filter(l => {
    if (activeZone === 'mine') return l.isOwn;
    if (l.zone !== activeZone) return false;
    if (search && !l.artist.name.toLowerCase().includes(search.toLowerCase()) && !l.tags.some(t => t.includes(search))) return false;
    if (filterType !== 'all' && l.artist.type !== filterType) return false;
    if (filterQuality !== 'all' && l.artist.quality !== filterQuality) return false;
    if (filterContract !== 'all' && l.contractType !== filterContract) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'popularity') return b.artist.popularity - a.artist.popularity;
    return b.listedAt - a.listedAt;
  });

  // Zone counts
  const zoneCounts = Object.fromEntries(
    (Object.keys(ZONE_CFG) as MarketZone[]).map(z => [z, listings.filter(l => z === 'mine' ? l.isOwn : l.zone === z).length])
  ) as Record<MarketZone, number>;

  return (
    <div className="space-y-4 relative">
      {/* ── Dual Tab Switch ── */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-2xl p-1.5 w-fit">
        <button
          onClick={() => setMarketTab('ai')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${marketTab === 'ai' ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/15 border border-cyan-500/25 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          <Cpu className="w-4 h-4 text-cyan-400" />
          {zh ? 'AI艺人池' : 'AI Artist Pool'}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold">{listings.length}</span>
        </button>
        <button
          onClick={() => setMarketTab('celebrity')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${marketTab === 'celebrity' ? 'bg-gradient-to-r from-purple-500/15 to-amber-500/15 border border-purple-500/25 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          <Star className="w-4 h-4 text-amber-400" />
          {zh ? '明星资源库' : 'Celebrity Resources'}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">186+</span>
        </button>
      </div>

      {/* ── Tab 2: Celebrity Resource Library ── */}
      {marketTab === 'celebrity' && <CelebrityResourceLibrary lang={lang} />}

      {/* ── Tab 1: AI Artist Pool ── */}
      {marketTab === 'ai' && <>
      {/* Market Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? '在售艺人' : 'Listed', val: listings.filter(l => !l.isOwn).length, icon: Package, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: zh ? '传奇拍场' : 'Auctions', val: listings.filter(l => l.saleType === 'auction').length, icon: Gavel, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: zh ? '限时闪签' : 'Flash Deals', val: listings.filter(l => l.zone === 'flash').length, icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: zh ? '我的委托' : 'My Listings', val: listings.filter(l => l.isOwn).length, icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
              <s.icon className={`w-4.5 h-4.5 ${s.color}`} />
            </div>
            <div>
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-500">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Zone Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-white/[0.05]">
        {(Object.keys(ZONE_CFG) as MarketZone[]).map(zone => {
          const zc = ZONE_CFG[zone];
          const active = activeZone === zone;
          const count = zoneCounts[zone];
          return (
            <button key={zone} onClick={() => setActiveZone(zone)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                active ? 'bg-white/[0.08] text-white border border-white/15' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
              }`}>
              <span>{zc.icon}</span>
              <span>{zh ? zc.zh : zc.en}</span>
              {count > 0 && (
                <span className={`text-[9px] px-1.5 rounded-full font-mono ${active ? 'bg-white/15 text-white' : 'bg-white/[0.05] text-gray-600'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={zh ? '搜索艺人名、标签...' : 'Search name, tags...'}
            className="h-8 pl-8 text-xs bg-white/[0.03] border-white/10 text-white" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition ${showFilters ? 'bg-white/[0.08] border-white/15 text-white' : 'bg-white/[0.03] border-white/8 text-gray-400 hover:text-white'}`}>
          <Filter className="w-3 h-3" />{zh ? '筛选' : 'Filter'}
        </button>
        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          className="h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/8 text-xs text-gray-400 hover:text-white cursor-pointer outline-none">
          <option value="newest">{zh ? '最新上架' : 'Newest'}</option>
          <option value="price_asc">{zh ? '价格低→高' : 'Price Asc'}</option>
          <option value="price_desc">{zh ? '价格高→低' : 'Price Desc'}</option>
          <option value="popularity">{zh ? '最受欢迎' : 'Popular'}</option>
        </select>
        {(filterType !== 'all' || filterQuality !== 'all' || filterContract !== 'all') && (
          <button onClick={() => { setFilterType('all'); setFilterQuality('all'); setFilterContract('all'); }}
            className="h-8 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1">
            <X className="w-3 h-3" />{zh ? '清除' : 'Clear'}
          </button>
        )}
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-gray-900/40 border border-white/[0.06] rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Type filter */}
              <div>
                <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">{zh ? '艺人类型' : 'Type'}</div>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'singer', 'actor', 'dancer', 'host', 'entertainer', 'all_rounder', 'idol'] as const).map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition ${filterType === t ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' : 'bg-white/[0.02] border-white/8 text-gray-500 hover:border-white/15'}`}>
                      {t === 'all' ? (zh ? '全部' : 'All') : (zh ? ARTIST_TYPE_LABELS[t].zh : ARTIST_TYPE_LABELS[t].en)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Quality filter */}
              <div>
                <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">{zh ? '艺人品质' : 'Quality'}</div>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'common', 'rare', 'epic', 'legendary'] as const).map(q => {
                    const qc = q !== 'all' ? QUALITY_CFG[q] : null;
                    return (
                      <button key={q} onClick={() => setFilterQuality(q)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${filterQuality === q ? (qc ? `${qc.bg} ${qc.border} ${qc.color}` : 'bg-white/10 border-white/20 text-white') : 'bg-white/[0.02] border-white/8 text-gray-500 hover:border-white/15'}`}>
                        {q === 'all' ? (zh ? '全部' : 'All') : (zh ? qc!.zh : qc!.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Contract filter */}
              <div>
                <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">{zh ? '合约类型' : 'Contract'}</div>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'full', 'revenue_share', 'loan', 'co_incubation'] as const).map(c => {
                    const cc = c !== 'all' ? CONTRACT_CFG[c] : null;
                    return (
                      <button key={c} onClick={() => setFilterContract(c)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${filterContract === c ? (cc ? `${cc.bg} ${cc.border} ${cc.color}` : 'bg-white/10 border-white/20 text-white') : 'bg-white/[0.02] border-white/8 text-gray-500 hover:border-white/15'}`}>
                        {c === 'all' ? (zh ? '全部' : 'All') : (zh ? cc!.zh : cc!.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone description */}
      {activeZone === 'flash' && (
        <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2">
          <Zap className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300/80">{zh ? '限时闪签：每日精选折扣艺人，错过即失效，抢先签约！' : 'Flash Sign: Daily discounted artists, expires today — act fast!'}</p>
        </div>
      )}
      {activeZone === 'co_incubation' && (
        <div className="flex items-center gap-2 bg-purple-500/8 border border-purple-500/20 rounded-xl px-3 py-2">
          <Handshake className="w-4 h-4 text-purple-400 shrink-0" />
          <p className="text-xs text-purple-300/80">{zh ? '联合孵化：寻找合伙人共同运营艺人，分担成本与收益。申请后双方确认条款即可开启合作。' : 'Co-Incubation: Find a partner to co-operate artists, sharing costs and revenue.'}</p>
        </div>
      )}

      {/* My Listings zone */}
      {activeZone === 'mine' && (
        <div className="bg-gray-900/30 border border-white/[0.06] rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              {zh ? '我的委托管理' : 'My Listings'}
            </h3>
            <Button onClick={() => setShowWizard(true)} size="sm"
              className="h-7 text-[11px] bg-gradient-to-r from-red-600/80 to-amber-600/80 text-white border-0">
              <Plus className="w-3 h-3 mr-1" />{zh ? '新增上架' : 'New Listing'}
            </Button>
          </div>
          {/* Offers received summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: zh ? '在售中' : 'Active', val: listings.filter(l => l.isOwn && l.listingStatus === 'active').length, color: 'text-green-400' },
              { label: zh ? '收到报价' : 'Offers', val: listings.filter(l => l.isOwn).reduce((s, l) => s + (l.offerCount || 0), 0), color: 'text-amber-400' },
              { label: zh ? '总浏览' : 'Total Views', val: listings.filter(l => l.isOwn).reduce((s, l) => s + l.views, 0), color: 'text-cyan-400' },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[9px] text-gray-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards grid */}
      {filteredListings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Package className="w-10 h-10 text-gray-700" />
          <p className="text-sm text-gray-500">{zh ? '当前区域暂无符合条件的艺人' : 'No artists match your filters in this zone'}</p>
          <button onClick={() => { setSearch(''); setFilterType('all'); setFilterQuality('all'); setFilterContract('all'); }}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition">
            {zh ? '清除筛选条件' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <AnimatePresence>
            {filteredListings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <MarketCard
                  listing={listing}
                  zh={zh}
                  isWishlisted={wishlist.has(listing.id)}
                  onWishlist={() => toggleWishlist(listing.id)}
                  onSelect={() => setSelectedListing(listing)}
                />
                {acquiredIds.has(listing.id) && (
                  <div className="mt-1 text-[10px] text-center text-green-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />{zh ? '已签约' : 'Acquired'}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedListing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedListing(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
            <DetailDrawer
              listing={selectedListing}
              zh={zh}
              balance={balance}
              onClose={() => setSelectedListing(null)}
              onBuy={handleBuy}
              onBid={handleBid}
              isWishlisted={wishlist.has(selectedListing.id)}
              onWishlist={() => toggleWishlist(selectedListing.id)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Listing Wizard */}
      <AnimatePresence>
        {showWizard && (
          <ListingWizard zh={zh} onClose={() => setShowWizard(false)} onPublish={handlePublish} />
        )}
      </AnimatePresence>
      </>}
    </div>
  );
};

export default ArtistMarket;
