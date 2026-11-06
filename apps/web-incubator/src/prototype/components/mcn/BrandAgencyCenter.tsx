/**
 * 品牌代理中心
 * 品牌授权申请 · 样品管理 · 佣金设置 · 代理等级（铜/银/金/钻）
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Package, Coins, TrendingUp, Star, Plus,
  ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle,
  Crown, ShoppingBag, ArrowUpRight, Search, Filter,
  Truck, BarChart3, FileText, Handshake, BadgeCheck,
  Image, Edit3, Trash2, Eye, Zap, Target, Sparkles
} from 'lucide-react';
import type { Lang } from '../../translations';

type AgencyLevel = 'bronze' | 'silver' | 'gold' | 'diamond';
type AuthStatus = 'authorized' | 'pending' | 'rejected' | 'expired';
type SampleStatus = 'requested' | 'shipping' | 'delivered' | 'reviewed' | 'returned';

interface BrandAuth {
  id: string;
  brandName: string;
  brandLogo: string;
  category: string;
  celebrity: string;
  status: AuthStatus;
  level: AgencyLevel;
  gmvTarget: number;
  gmvActual: number;
  commissionPct: number;
  startAt: string;
  endAt: string;
  products: number;
  monthlySales: string;
}

interface SampleItem {
  id: string;
  productName: string;
  brandName: string;
  celebrity: string;
  status: SampleStatus;
  requestedAt: string;
  deliveredAt?: string;
  trackingNo?: string;
  quantity: number;
  estimatedValue: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

const LEVEL_CFG: Record<AgencyLevel, { zh: string; en: string; color: string; bg: string; border: string; icon: string; minGmv: string; commission: string }> = {
  bronze:  { zh: '铜牌代理', en: 'Bronze',  color: '#92400e', bg: 'bg-amber-900/20', border: 'border-amber-900/30', icon: 'BRZ', minGmv: '¥5万/月',   commission: '3-5%' },
  silver:  { zh: '银牌代理', en: 'Silver',  color: '#9ca3af', bg: 'bg-gray-400/10',  border: 'border-gray-400/20',  icon: 'SLV', minGmv: '¥20万/月',  commission: '5-8%' },
  gold:    { zh: '金牌代理', en: 'Gold',    color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'GLD', minGmv: '¥80万/月',  commission: '8-12%' },
  diamond: { zh: '钻石代理', en: 'Diamond', color: '#06b6d4', bg: 'bg-cyan-500/10',  border: 'border-cyan-500/20',  icon: 'DMD', minGmv: '¥300万/月', commission: '12-18%' },
};

const AUTH_STATUS: Record<AuthStatus, { zh: string; en: string; color: string; bg: string; icon: any }> = {
  authorized: { zh: '已授权', en: 'Authorized', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  pending:    { zh: '审核中', en: 'Pending',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',  icon: Clock },
  rejected:   { zh: '已驳回', en: 'Rejected',   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25',      icon: XCircle },
  expired:    { zh: '已到期', en: 'Expired',    color: 'text-gray-500',   bg: 'bg-white/5 border-white/10',           icon: AlertCircle },
};

const SAMPLE_STATUS: Record<SampleStatus, { zh: string; en: string; color: string }> = {
  requested:  { zh: '已申请', en: 'Requested',  color: 'text-blue-400' },
  shipping:   { zh: '配送中', en: 'Shipping',   color: 'text-amber-400' },
  delivered:  { zh: '已到货', en: 'Delivered',  color: 'text-cyan-400' },
  reviewed:   { zh: '已测评', en: 'Reviewed',   color: 'text-green-400' },
  returned:   { zh: '已退回', en: 'Returned',   color: 'text-gray-500' },
};

const MOCK_BRANDS: BrandAuth[] = [
  { id: 'b1', brandName: '某战术刀具品牌', brandLogo: 'KNF', category: '户外运动', celebrity: '陈屿', status: 'authorized', level: 'gold', gmvTarget: 800000, gmvActual: 512400, commissionPct: 10, startAt: '2026-03-01', endAt: '2026-08-31', products: 12, monthlySales: '¥128,000' },
  { id: 'b2', brandName: '某护肤品集团', brandLogo: 'CSM', category: '美妆护肤', celebrity: '顾然', status: 'authorized', level: 'diamond', gmvTarget: 3000000, gmvActual: 1842000, commissionPct: 15, startAt: '2026-01-01', endAt: '2026-12-31', products: 28, monthlySales: '¥368,000' },
  { id: 'b3', brandName: '某运动品牌', brandLogo: 'SPT', category: '运动服饰', celebrity: '陆星野', status: 'pending', level: 'silver', gmvTarget: 200000, gmvActual: 0, commissionPct: 7, startAt: '2026-05-15', endAt: '2026-11-15', products: 8, monthlySales: '-' },
  { id: 'b4', brandName: '某茶叶品牌', brandLogo: 'TEA', category: '食品饮料', celebrity: '陈屿', status: 'authorized', level: 'bronze', gmvTarget: 50000, gmvActual: 38200, commissionPct: 4, startAt: '2026-04-01', endAt: '2026-06-30', products: 5, monthlySales: '¥12,800' },
  { id: 'b5', brandName: '某时尚集团', brandLogo: 'FSH', category: '时装配饰', celebrity: '苏枝', status: 'rejected', level: 'gold', gmvTarget: 500000, gmvActual: 0, commissionPct: 9, startAt: '2026-05-01', endAt: '2026-10-31', products: 0, monthlySales: '-' },
];

const MOCK_SAMPLES: SampleItem[] = [
  { id: 's1', productName: '战术折叠刀 · 限定版', brandName: '某战术刀具品牌', celebrity: '陈屿', status: 'delivered', requestedAt: '2026-04-25', deliveredAt: '2026-04-28', trackingNo: 'SF1234567890', quantity: 3, estimatedValue: '¥1,680', reviewStatus: 'pending' },
  { id: 's2', productName: '明星同款精华液套装', brandName: '某护肤品集团', celebrity: '顾然', status: 'reviewed', requestedAt: '2026-04-10', deliveredAt: '2026-04-13', trackingNo: 'JT9876543210', quantity: 5, estimatedValue: '¥3,200', reviewStatus: 'approved' },
  { id: 's3', productName: '联名球鞋 · 限量款', brandName: '某运动品牌', celebrity: '陆星野', status: 'shipping', requestedAt: '2026-05-05', trackingNo: 'YT5551234567', quantity: 2, estimatedValue: '¥4,800' },
  { id: 's4', productName: '高山绿茶礼盒套装', brandName: '某茶叶品牌', celebrity: '陈屿', status: 'requested', requestedAt: '2026-05-07', quantity: 10, estimatedValue: '¥980' },
];

const CommissionBar = ({ pct, max = 20, color }: { pct: number; max?: number; color: string }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(pct / max) * 100}%` }}
        transition={{ duration: 0.6 }} style={{ background: color }} />
    </div>
    <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
  </div>
);

export const BrandAgencyCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'brands' | 'samples' | 'apply' | 'levels'>('brands');
  const [applyOpen, setApplyOpen] = useState(false);

  const totalGmv = MOCK_BRANDS.filter(b => b.status === 'authorized').reduce((s, b) => s + b.gmvActual, 0);
  const totalCommission = MOCK_BRANDS.filter(b => b.status === 'authorized').reduce((s, b) => s + b.gmvActual * b.commissionPct / 100, 0);
  const authorizedCount = MOCK_BRANDS.filter(b => b.status === 'authorized').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '品牌代理中心' : 'Brand Agency Center'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{zh ? '品牌授权 · 样品管理 · 佣金分成 · 代理等级' : 'Brand auth · Sample mgmt · Commission · Agency level'}</p>
        </div>
        <button onClick={() => setApplyOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #a855f7)' }}>
          <Plus className="w-4 h-4" />{zh ? '申请品牌授权' : 'Apply Brand Auth'}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: { zh: '已授权品牌', en: 'Auth Brands' },      value: authorizedCount,                      color: '#22c55e', icon: BadgeCheck },
          { label: { zh: '累计GMV',   en: 'Total GMV' },          value: `¥${(totalGmv / 10000).toFixed(0)}万`, color: '#06b6d4', icon: TrendingUp },
          { label: { zh: '佣金收益',  en: 'Commission' },          value: `¥${(totalCommission / 10000).toFixed(1)}万`, color: '#a855f7', icon: Coins },
          { label: { zh: '代理等级',  en: 'Agency Level' },        value: 'GLD 金牌',                            color: '#f59e0b', icon: Crown },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
              <span className="text-[10px] text-gray-500">{zh ? k.label.zh : k.label.en}</span>
            </div>
            <div className="text-xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'brands', zh: '品牌合作', en: 'Brands' },
          { id: 'samples', zh: '样品管理', en: 'Samples' },
          { id: 'levels', zh: '代理等级', en: 'Levels' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${tab === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
            {zh ? t.zh : t.en}
          </button>
        ))}
      </div>

      {/* Tab: Brands */}
      {tab === 'brands' && (
        <div className="space-y-3">
          {MOCK_BRANDS.map((brand, i) => {
            const aCfg = AUTH_STATUS[brand.status];
            const lCfg = LEVEL_CFG[brand.level];
            const gmvPct = brand.gmvActual > 0 ? Math.min((brand.gmvActual / brand.gmvTarget) * 100, 100) : 0;
            return (
              <motion.div key={brand.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
                <div className="flex items-start gap-3">
                  {/* Brand logo */}
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-2xl shrink-0">
                    {brand.brandLogo}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{brand.brandName}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{brand.category}</span>
                      <span className="text-[9px] font-bold" style={{ color: lCfg.color }}>{lCfg.icon} {zh ? lCfg.zh : lCfg.en}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                      <span>STR {brand.celebrity}</span>
                      <span>{brand.startAt} ~ {brand.endAt}</span>
                      <span>{brand.products}{zh ? '款商品' : ' products'}</span>
                      {brand.monthlySales !== '-' && <span className="text-green-400">月销 {brand.monthlySales}</span>}
                    </div>
                    {/* GMV progress */}
                    {brand.status === 'authorized' && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-gray-600">{zh ? 'GMV目标进度' : 'GMV Progress'}</span>
                          <span className="text-white">¥{(brand.gmvActual / 10000).toFixed(1)}万 / ¥{(brand.gmvTarget / 10000).toFixed(0)}万</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${gmvPct}%` }}
                            transition={{ duration: 0.7, delay: i * 0.05 }}
                            style={{ background: gmvPct >= 80 ? '#22c55e' : gmvPct >= 50 ? '#f59e0b' : '#06b6d4' }} />
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <CommissionBar pct={brand.commissionPct} color={lCfg.color} />
                    </div>
                  </div>
                  {/* Status */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${aCfg.bg} ${aCfg.color}`}>
                      <aCfg.icon className="w-3 h-3" />{zh ? aCfg.zh : aCfg.en}
                    </span>
                    {brand.status === 'authorized' && (
                      <button className="text-[9px] text-cyan-400 border border-cyan-500/25 rounded-lg px-2 py-1 hover:bg-cyan-500/10 transition">
                        {zh ? '管理商品' : 'Manage Products'}
                      </button>
                    )}
                    {brand.status === 'rejected' && (
                      <button className="text-[9px] text-purple-400 border border-purple-500/25 rounded-lg px-2 py-1 hover:bg-purple-500/10 transition">
                        {zh ? '重新申请' : 'Re-apply'}
                      </button>
                    )}
                    {brand.status === 'expired' && (
                      <button className="text-[9px] text-amber-400 border border-amber-500/25 rounded-lg px-2 py-1 hover:bg-amber-500/10 transition">
                        {zh ? '续期合作' : 'Renew'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tab: Samples */}
      {tab === 'samples' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{zh ? '样品申请记录' : 'Sample Requests'}</span>
            <button className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition border border-purple-500/25 rounded-lg px-3 py-1.5">
              <Plus className="w-3 h-3" />{zh ? '申请样品' : 'Request Sample'}
            </button>
          </div>
          {MOCK_SAMPLES.map((sample, i) => {
            const sCfg = SAMPLE_STATUS[sample.status];
            return (
              <motion.div key={sample.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{sample.productName}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                    <span>{sample.brandName}</span>
                    <span>STR {sample.celebrity}</span>
                    <span>x{sample.quantity}</span>
                    <span className="text-amber-400">{sample.estimatedValue}</span>
                  </div>
                  {sample.trackingNo && (
                    <div className="text-[9px] text-cyan-400 mt-1 flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" />{zh ? '快递单号：' : 'Tracking: '}{sample.trackingNo}
                    </div>
                  )}
                  <div className="text-[9px] text-gray-600 mt-0.5">{zh ? '申请时间：' : 'Requested: '}{sample.requestedAt}</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-[10px] font-bold ${sCfg.color}`}>{zh ? sCfg.zh : sCfg.en}</span>
                  {sample.reviewStatus === 'pending' && (
                    <button className="text-[9px] text-green-400 border border-green-500/25 rounded-lg px-2 py-1 hover:bg-green-500/10 transition whitespace-nowrap">
                      {zh ? '上传测评' : 'Upload Review'}
                    </button>
                  )}
                  {sample.reviewStatus === 'approved' && <span className="text-[9px] text-green-400">✓ {zh ? '测评通过' : 'Review OK'}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tab: Agency Levels */}
      {tab === 'levels' && (
        <div className="space-y-4">
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">GLD</span>
              <div>
                <div className="text-sm font-bold text-amber-400">{zh ? '当前等级：金牌代理' : 'Current: Gold Agency'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{zh ? '本月累计GMV ¥51.2万，距钻石级还需 ¥248.8万' : 'Monthly GMV ¥512K, need ¥2.49M more for Diamond'}</div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {(Object.entries(LEVEL_CFG) as [AgencyLevel, typeof LEVEL_CFG[AgencyLevel]][]).map(([level, cfg]) => (
              <div key={level} className={`p-5 rounded-2xl border ${cfg.bg} ${cfg.border} relative overflow-hidden`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{cfg.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{zh ? cfg.zh : cfg.en}</div>
                      <div className="text-[10px] text-gray-500">{zh ? `起步GMV：${cfg.minGmv}` : `Min GMV: ${cfg.minGmv}`}</div>
                    </div>
                  </div>
                  {level === 'gold' && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${cfg.color}25`, color: cfg.color }}>
                      {zh ? '当前' : 'CURRENT'}
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>{zh ? '佣金比例' : 'Commission'}</span>
                    <span className="font-bold" style={{ color: cfg.color }}>{cfg.commission}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{zh ? '样品配额' : 'Sample Quota'}</span>
                    <span className="font-bold text-white">{level === 'bronze' ? '2件/月' : level === 'silver' ? '5件/月' : level === 'gold' ? '15件/月' : '不限'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{zh ? '专属支持' : 'Support'}</span>
                    <span className="font-bold text-white">{level === 'bronze' ? '社群' : level === 'silver' ? '在线客服' : level === 'gold' ? '专属顾问' : 'VIP一对一'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{zh ? '明星合作数' : 'Celebrity Slots'}</span>
                    <span className="font-bold text-white">{level === 'bronze' ? '1位' : level === 'silver' ? '3位' : level === 'gold' ? '8位' : '无限'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply Modal */}
      <AnimatePresence>
        {applyOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setApplyOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{zh ? '申请品牌授权合作' : 'Apply for Brand Authorization'}</h3>
                <button onClick={() => setApplyOpen(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                <input placeholder={zh ? '品牌名称' : 'Brand name'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/30 transition" />
                <select className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                  <option>{zh ? '选择合作明星' : 'Select celebrity'}</option>
                  <option>陈屿</option><option>顾然</option><option>苏枝</option><option>陆星野</option>
                </select>
                <select className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                  <option>{zh ? '选择品牌类目' : 'Select category'}</option>
                  <option>{zh ? '美妆护肤' : 'Beauty & Skincare'}</option>
                  <option>{zh ? '户外运动' : 'Outdoor Sports'}</option>
                  <option>{zh ? '时装配饰' : 'Fashion'}</option>
                  <option>{zh ? '食品饮料' : 'Food & Beverage'}</option>
                </select>
                <input placeholder={zh ? '月度GMV目标（如：¥100,000）' : 'Monthly GMV target'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none transition" />
                <textarea placeholder={zh ? '品牌简介与合作方案（200字内）' : 'Brand intro & cooperation plan (max 200 chars)'}
                  rows={3} className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none resize-none transition" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setApplyOpen(false)} className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">{zh ? '取消' : 'Cancel'}</button>
                <button onClick={() => setApplyOpen(false)} className="flex-1 h-10 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #a855f7)' }}>
                  {zh ? '提交申请' : 'Submit Application'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BrandAgencyCenter;
