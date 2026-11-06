/**
 * 投流管理中心 · P1升级：加入授权约束
 * 投流前必须校验视频的授权状态，无效授权内容禁止投流
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, TrendingUp, BarChart3, Plus, Play, Pause, Eye,
  ShoppingBag, Users, Target, Coins, ArrowUpRight, Clock,
  CheckCircle2, AlertCircle, ChevronRight, Flame, Crown, Building2,
  Shield, AlertTriangle, XCircle, Lock, FileCheck, Info
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { Lang } from '../../translations';

type BoostType   = 'brand' | 'self' | 'platform';
type BoostStatus = 'active' | 'completed' | 'paused' | 'pending';
type LicenseStatus = 'valid' | 'expiring' | 'expired' | 'none';

interface BoostTask {
  id: string; type: BoostType; videoTitle: string; platform: string; account: string;
  budget: number; spent: number; status: BoostStatus; goal: 'gmv' | 'views' | 'fans';
  views: number; gmvIncrease: number; roi: number; startAt: string; endAt?: string;
  brand?: string;
  licenseId: string | null;
  licenseStatus: LicenseStatus;
  partner: string;
}

interface VideoOption {
  id: string; title: string; platform: string; partner: string;
  licenseId: string | null; licenseStatus: LicenseStatus;
  licenseExpiry?: string;
}

const TYPE_CFG: Record<BoostType, { zh: string; en: string; icon: React.ComponentType<any>; color: string; bg: string; desc: { zh: string; en: string } }> = {
  brand:    { zh: '品牌方定向投流', en: 'Brand-Initiated', icon: Building2, color: '#f59e0b', bg: 'bg-amber-500/10',  desc: { zh: '品牌方看到好视频主动为你的内容投流', en: 'Brand sponsors traffic for your high-performing content' } },
  self:     { zh: '自主投流',      en: 'Self-Initiated',  icon: Zap,       color: '#a855f7', bg: 'bg-purple-500/10', desc: { zh: '自己花费星币为视频购买流量加速', en: 'Use star coins to boost your own video traffic' } },
  platform: { zh: '平台扶持投流',  en: 'Platform Grant',  icon: Crown,     color: '#22c55e', bg: 'bg-green-500/10',  desc: { zh: '平台AI识别优质内容主动给予流量扶持', en: 'Platform AI identifies quality content and grants free boost' } },
};

const STATUS_CFG: Record<BoostStatus, { zh: string; en: string; color: string; bg: string }> = {
  active:    { zh: '投放中', en: 'Active',    color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25' },
  completed: { zh: '已完成', en: 'Completed', color: 'text-gray-400',   bg: 'bg-white/5 border-white/10' },
  paused:    { zh: '已暂停', en: 'Paused',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25' },
  pending:   { zh: '待确认', en: 'Pending',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25' },
};

const LICENSE_STATUS_CFG: Record<LicenseStatus, { zh: string; en: string; color: string; icon: React.ComponentType<any>; canBoost: boolean }> = {
  valid:    { zh: '授权有效', en: 'Licensed', color: 'text-emerald-400', icon: CheckCircle2, canBoost: true  },
  expiring: { zh: '授权即将到期', en: 'Expiring', color: 'text-amber-400',  icon: Clock,        canBoost: true  },
  expired:  { zh: '授权已过期', en: 'Expired',  color: 'text-red-400',    icon: XCircle,      canBoost: false },
  none:     { zh: '无授权', en: 'No License', color: 'text-red-500',    icon: AlertTriangle, canBoost: false },
};

const MOCK_BOOSTS: BoostTask[] = [
  { id: 'b1', type: 'brand', videoTitle: '于震古装剧切片·战术刀具', platform: 'DY', account: '@neon_v_official',
    budget: 5000, spent: 3280, status: 'active', goal: 'gmv', views: 128000, gmvIncrease: 18400, roi: 5.6,
    startAt: '2026-05-01', brand: '某刀具品牌', licenseId: 'LIC-2025-0047', licenseStatus: 'valid', partner: '于震' },
  { id: 'b2', type: 'self', videoTitle: '肖战同款护肤·AI口播版', platform: 'KS', account: '@luna_soft_ks',
    budget: 2000, spent: 2000, status: 'completed', goal: 'gmv', views: 56000, gmvIncrease: 8200, roi: 4.1,
    startAt: '2026-04-25', endAt: '2026-04-28', licenseId: 'LIC-2025-0051', licenseStatus: 'valid', partner: '肖战' },
  { id: 'b3', type: 'platform', videoTitle: '杨幂美妆推荐·爆款切片', platform: 'XHS', account: '@project_zero_xhs',
    budget: 1500, spent: 1500, status: 'completed', goal: 'views', views: 312000, gmvIncrease: 11500, roi: 7.7,
    startAt: '2026-04-20', endAt: '2026-04-22', licenseId: 'LIC-2025-0052', licenseStatus: 'valid', partner: '杨幂' },
  { id: 'b4', type: 'brand', videoTitle: '王一博联名球鞋·矩阵版', platform: 'VCH', account: '@neonv_channel',
    budget: 8000, spent: 0, status: 'pending', goal: 'gmv', views: 0, gmvIncrease: 0, roi: 0,
    startAt: '2026-05-10', brand: '某运动品牌', licenseId: 'LIC-2025-0055', licenseStatus: 'expiring', partner: '王一博' },
  { id: 'b5', type: 'self', videoTitle: '于震切片·茶叶品牌（授权过期）', platform: 'DY', account: '@neon_v_official',
    budget: 1000, spent: 620, status: 'paused', goal: 'fans', views: 28000, gmvIncrease: 3200, roi: 5.2,
    startAt: '2026-05-03', licenseId: 'LIC-2025-0039', licenseStatus: 'expired', partner: '于震' },
];

const MOCK_VIDEOS: VideoOption[] = [
  { id: 'v1', title: '于震古装剧切片-战术刀具', platform: 'DY', partner: '于震', licenseId: 'LIC-2025-0047', licenseStatus: 'valid', licenseExpiry: '2026-12-31' },
  { id: 'v2', title: '林音宝护肤精华-口播版', platform: 'XHS', partner: '林音宝', licenseId: 'LIC-2025-0048', licenseStatus: 'valid', licenseExpiry: '2026-10-15' },
  { id: 'v3', title: '王一博联名球鞋-矩阵版', platform: 'VCH', partner: '王一博', licenseId: 'LIC-2025-0055', licenseStatus: 'expiring', licenseExpiry: '2025-09-20' },
  { id: 'v4', title: '肖战美妆系列-过期授权版', platform: 'KS', partner: '肖战', licenseId: 'LIC-2025-0039', licenseStatus: 'expired', licenseExpiry: '2025-08-31' },
  { id: 'v5', title: '疑似搬运-无授权素材', platform: 'KS', partner: '未知', licenseId: null, licenseStatus: 'none' },
];

const ROI_DATA = [
  { name: '4/1',  brand: 0,   self: 3.2, platform: 0   },
  { name: '4/8',  brand: 4.8, self: 3.8, platform: 6.2 },
  { name: '4/15', brand: 5.1, self: 4.2, platform: 7.7 },
  { name: '4/22', brand: 5.6, self: 3.9, platform: 0   },
  { name: '4/29', brand: 6.0, self: 4.5, platform: 8.1 },
  { name: '5/6',  brand: 5.6, self: 4.1, platform: 0   },
];

export const TrafficBoostCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeType, setActiveType] = useState<BoostType | 'all'>('all');
  const [newBoostOpen, setNewBoostOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoOption | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<'gmv' | 'views' | 'fans'>('gmv');
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [showLicenseWarning, setShowLicenseWarning] = useState(false);

  const filtered = MOCK_BOOSTS.filter(b => activeType === 'all' || b.type === activeType);
  const totalBudget = MOCK_BOOSTS.reduce((s, b) => s + b.spent, 0);
  const totalGmv = MOCK_BOOSTS.reduce((s, b) => s + b.gmvIncrease, 0);
  const avgRoi = (MOCK_BOOSTS.filter(b => b.roi > 0).reduce((s, b) => s + b.roi, 0) / MOCK_BOOSTS.filter(b => b.roi > 0).length).toFixed(1);

  const blockedBoosts = MOCK_BOOSTS.filter(b => !LICENSE_STATUS_CFG[b.licenseStatus].canBoost);

  const canBoostSelected = selectedVideo ? LICENSE_STATUS_CFG[selectedVideo.licenseStatus].canBoost : false;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '投流管理中心' : 'Traffic Boost Center'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '品牌定向 · 自主投流 · 平台扶持 · 授权约束保障合规' : 'Brand-directed · Self-boost · Platform grant · License-gated compliance'}</p>
        </div>
        <button onClick={() => setNewBoostOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <Zap className="w-4 h-4" />{zh ? '发起自投流' : 'Self Boost'}
        </button>
      </div>

      {/* License Alert Banner */}
      {blockedBoosts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
          <Shield className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs font-bold text-red-400 mb-1">
              {zh ? `授权约束：${blockedBoosts.length}个投流任务因授权问题被暂停` : `License Gate: ${blockedBoosts.length} boost task(s) suspended due to license issues`}
            </div>
            <div className="text-[10px] text-red-400/70">
              {zh ? '已过期或无授权的内容不可投流，请前往授权台账续签后再操作。' : 'Content with expired or missing licenses cannot be boosted. Renew licenses in License Vault first.'}
            </div>
          </div>
          <button className="text-[10px] text-red-400 border border-red-500/25 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition shrink-0">
            {zh ? '去续签' : 'Renew'}
          </button>
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: { zh: '本月投流消耗', en: 'Monthly Spend' }, value: `¥${totalBudget.toLocaleString()}`, color: '#f59e0b', icon: Coins },
          { label: { zh: '带来增量GMV', en: 'Incremental GMV' }, value: `¥${(totalGmv / 10000).toFixed(1)}万`, color: '#22c55e', icon: ShoppingBag },
          { label: { zh: '平均ROI', en: 'Average ROI' }, value: `${avgRoi}x`, color: '#a855f7', icon: TrendingUp },
          { label: { zh: '授权阻断任务', en: 'License-Blocked' }, value: blockedBoosts.length, color: '#ef4444', icon: Lock },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <KIcon className="w-4 h-4" style={{ color: k.color }} />
                <span className="text-[10px] text-gray-500">{zh ? k.label.zh : k.label.en}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* 3 Types */}
      <div className="grid md:grid-cols-3 gap-3">
        {(Object.entries(TYPE_CFG) as [BoostType, typeof TYPE_CFG[BoostType]][]).map(([key, cfg]) => {
          const CfgIcon = cfg.icon;
          return (
            <button key={key} onClick={() => setActiveType(activeType === key ? 'all' : key)}
              className="p-4 rounded-xl border text-left transition"
              style={activeType === key ? { borderColor: `${cfg.color}40`, background: `${cfg.color}08` } : { borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(17,24,39,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
                  <CfgIcon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <span className="text-sm font-bold text-white">{zh ? cfg.zh : cfg.en}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{zh ? cfg.desc.zh : cfg.desc.en}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                  {MOCK_BOOSTS.filter(b => b.type === key && b.roi > 0).length > 0
                    ? `ROI ${(MOCK_BOOSTS.filter(b => b.type === key && b.roi > 0).reduce((s, b) => s + b.roi, 0) / MOCK_BOOSTS.filter(b => b.type === key && b.roi > 0).length).toFixed(1)}x`
                    : '-'}
                </span>
                <span className="text-[9px] text-gray-600">{MOCK_BOOSTS.filter(b => b.type === key).length}{zh ? '条记录' : ' records'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ROI Trend */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">{zh ? '三类投流ROI趋势对比' : 'ROI Trend Comparison'}</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ROI_DATA}>
              <defs key="defs-1">
                {[['brand', '#f59e0b'], ['self', '#a855f7'], ['platform', '#22c55e']].map(([key, color]) => (
                  <linearGradient key={key} id={`grad_${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid key="cartesiangrid-2" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xaxis-3" dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis key="yaxis-4" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} unit="x" width={30} />
              <Tooltip key="tooltip-5" contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
              <Area key="area-6" type="monotone" dataKey="brand" stroke="#f59e0b" fill="url(#grad_brand)" strokeWidth={2} dot={false} name={zh ? '品牌投流' : 'Brand'} />
              <Area key="area-7" type="monotone" dataKey="self" stroke="#a855f7" fill="url(#grad_self)" strokeWidth={2} dot={false} name={zh ? '自投流' : 'Self'} />
              <Area key="area-8" type="monotone" dataKey="platform" stroke="#22c55e" fill="url(#grad_platform)" strokeWidth={2} dot={false} name={zh ? '平台扶持' : 'Platform'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[['#f59e0b', zh ? '品牌定向' : 'Brand'], ['#a855f7', zh ? '自主投流' : 'Self'], ['#22c55e', zh ? '平台扶持' : 'Platform']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <div className="w-2.5 h-0.5 rounded-full" style={{ background: color }} />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{zh ? '投流任务' : 'Boost Tasks'}</span>
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <Shield className="w-3 h-3" />
            {zh ? '橙色=授权即将到期 · 红色=授权无效' : 'Orange=expiring · Red=invalid license'}
          </div>
        </div>
        {filtered.map((boost, i) => {
          const tCfg = TYPE_CFG[boost.type];
          const TIcon = tCfg.icon;
          const sCfg = STATUS_CFG[boost.status];
          const lCfg = LICENSE_STATUS_CFG[boost.licenseStatus];
          const LIcon = lCfg.icon;
          const isBlocked = !lCfg.canBoost;
          const progress = boost.budget > 0 ? (boost.spent / boost.budget) * 100 : 0;
          return (
            <motion.div key={boost.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-gray-900/50 border rounded-xl p-4 transition ${
                isBlocked ? 'border-red-500/20 opacity-80' :
                boost.licenseStatus === 'expiring' ? 'border-amber-500/15' :
                'border-white/5 hover:border-white/10'
              }`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tCfg.color}15` }}>
                  {isBlocked ? <Lock className="w-4 h-4 text-red-400" /> : <TIcon className="w-4 h-4" style={{ color: tCfg.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{boost.videoTitle}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${sCfg.bg} ${sCfg.color}`}>{zh ? sCfg.zh : sCfg.en}</span>
                    <span className="text-[9px] font-bold" style={{ color: tCfg.color }}>{zh ? tCfg.zh : tCfg.en}</span>
                  </div>

                  {/* License status badge */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                    <div className={`flex items-center gap-1 ${lCfg.color}`}>
                      <LIcon className="w-3 h-3" />
                      <span className="font-semibold">{zh ? lCfg.zh : lCfg.en}</span>
                      {boost.licenseId && <span className="text-gray-600 font-mono">{boost.licenseId}</span>}
                    </div>
                    <span className="text-gray-500">{boost.platform} · {boost.account}</span>
                    {boost.brand && <span className="text-amber-400">{zh ? '品牌：' : 'Brand: '}{boost.brand}</span>}
                    {boost.roi > 0 && <span className="text-green-400 flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />ROI {boost.roi}x</span>}
                  </div>

                  {/* License block warning */}
                  {isBlocked && (
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-red-500/5 border border-red-500/15 rounded-lg">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-[10px] text-red-400">
                        {boost.licenseStatus === 'expired'
                          ? (zh ? '授权已过期，请续签后才能继续投流' : 'License expired — renew to resume boosting')
                          : (zh ? '无授权内容禁止投流，请先完成授权' : 'No license — complete authorization before boosting')}
                      </span>
                    </div>
                  )}

                  {/* Expiring warning */}
                  {boost.licenseStatus === 'expiring' && !isBlocked && (
                    <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-[10px] text-amber-400">{zh ? '授权即将到期，请及时续签避免中断' : 'License expiring soon — renew to avoid interruption'}</span>
                    </div>
                  )}

                  {/* Budget progress */}
                  {!isBlocked && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-600">{zh ? '预算消耗' : 'Budget'}: ¥{boost.spent.toLocaleString()} / ¥{boost.budget.toLocaleString()}</span>
                        {boost.gmvIncrease > 0 && <span className="text-green-400">+GMV ¥{boost.gmvIncrease.toLocaleString()}</span>}
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: tCfg.color }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {boost.status === 'pending' && !isBlocked && (
                    <button className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      style={{ background: `${tCfg.color}30`, border: `1px solid ${tCfg.color}40`, color: tCfg.color }}>
                      {zh ? '确认接受' : 'Accept'}
                    </button>
                  )}
                  {isBlocked && (
                    <button className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/25 text-red-400 hover:bg-red-500/10 transition">
                      {zh ? '去续签' : 'Renew'}
                    </button>
                  )}
                  {boost.status === 'active' && !isBlocked && (
                    <button className="shrink-0 p-2 rounded-lg border border-white/8 text-gray-500 hover:text-amber-400 hover:border-amber-500/25 transition">
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* New Boost Modal — License-Gated */}
      <AnimatePresence>
        {newBoostOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setNewBoostOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{zh ? '发起自主投流' : 'Create Self Boost'}</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-purple-400" />
                    {zh ? '仅授权有效的内容可发起投流' : 'Only licensed content can be boosted'}
                  </p>
                </div>
                <button onClick={() => setNewBoostOpen(false)} className="text-gray-500 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Video selector with license status */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '选择要投流的视频' : 'Select Video'}</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {MOCK_VIDEOS.map(v => {
                    const lCfg = LICENSE_STATUS_CFG[v.licenseStatus];
                    const LIcon = lCfg.icon;
                    const isDisabled = !lCfg.canBoost;
                    return (
                      <button key={v.id} onClick={() => !isDisabled && setSelectedVideo(v)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                          selectedVideo?.id === v.id ? 'bg-purple-500/10 border-purple-500/30' :
                          isDisabled ? 'bg-white/2 border-white/5 opacity-50 cursor-not-allowed' :
                          'bg-white/3 border-white/8 hover:border-white/20'
                        }`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{v.title}</div>
                          <div className="flex items-center gap-2 text-[10px] mt-0.5">
                            <span className="text-gray-500">{v.platform} · {v.partner}</span>
                            <span className={`flex items-center gap-0.5 font-semibold ${lCfg.color}`}>
                              <LIcon className="w-2.5 h-2.5" />{zh ? lCfg.zh : lCfg.en}
                            </span>
                          </div>
                        </div>
                        {isDisabled && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        {!isDisabled && selectedVideo?.id === v.id && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* License detail */}
              {selectedVideo && (
                <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${
                  selectedVideo.licenseStatus === 'expiring' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
                }`}>
                  {selectedVideo.licenseStatus === 'expiring'
                    ? <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    : <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  <div>
                    <div className={`text-[10px] font-bold ${selectedVideo.licenseStatus === 'expiring' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {selectedVideo.licenseId} · {zh ? (selectedVideo.licenseStatus === 'expiring' ? '即将到期' : '授权有效') : (selectedVideo.licenseStatus === 'expiring' ? 'Expiring Soon' : 'License Valid')}
                    </div>
                    {selectedVideo.licenseExpiry && (
                      <div className="text-[9px] text-gray-500 mt-0.5">{zh ? '到期日：' : 'Expiry: '}{selectedVideo.licenseExpiry}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Goal */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '投流目标' : 'Boost Goal'}</div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ g: 'gmv' as const, label: zh ? '带货GMV' : 'GMV' }, { g: 'views' as const, label: zh ? '播放量' : 'Views' }, { g: 'fans' as const, label: zh ? '涨粉' : 'Fans' }].map(({ g, label }) => (
                    <button key={g} onClick={() => setSelectedGoal(g)}
                      className={`p-2.5 rounded-xl border text-xs transition ${selectedGoal === g ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'border-white/8 text-gray-400 hover:border-white/20'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '投流预算' : 'Budget'}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[500, 1000, 2000, 5000].map(amt => (
                    <button key={amt} onClick={() => setSelectedBudget(amt)}
                      className={`p-2 rounded-xl border text-xs text-center transition ${selectedBudget === amt ? 'bg-amber-500/10 border-amber-500/30' : 'border-white/8 hover:border-white/20'}`}>
                      <div className="font-bold text-amber-400">SC{amt}</div>
                      <div className="text-[9px] text-gray-600">¥{amt / 10}{zh ? '额度' : ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setNewBoostOpen(false)} className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">{zh ? '取消' : 'Cancel'}</button>
                <button
                  onClick={() => canBoostSelected && selectedBudget && setNewBoostOpen(false)}
                  disabled={!canBoostSelected || !selectedVideo || !selectedBudget}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 transition ${
                    canBoostSelected && selectedVideo && selectedBudget ? 'opacity-100 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                  }`}
                  style={{ background: canBoostSelected && selectedVideo && selectedBudget ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : '#374151' }}>
                  {!selectedVideo ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  {!selectedVideo ? (zh ? '请选择视频' : 'Select video') :
                   !canBoostSelected ? (zh ? '授权无效，无法投流' : 'Invalid license') :
                   !selectedBudget ? (zh ? '请选择预算' : 'Select budget') :
                   (zh ? '立即投流' : 'Boost Now')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrafficBoostCenter;
