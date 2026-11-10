/**
 * IPValuationEngine — 艺人IP价值评估引擎
 * P5 新增：多维度IP估值 · 商业价值分析 · 风险评分 · 市值追踪 · 估值报告导出
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, Star, Shield, Zap, Users, BarChart3,
  Award, Globe, Target, Coins, ChevronRight, RefreshCw,
  Eye, FileText, Download, AlertTriangle, CheckCircle2,
  Layers, Music, ShoppingBag, Heart, TrendingDown, ArrowUpRight
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar
} from 'recharts';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type ArtistId = 'luChengyuan' | 'shenYizhou' | 'linYin';
type DimKey = 'fans' | 'commerce' | 'content' | 'brand' | 'legal' | 'growth';

interface DimensionScore {
  key: DimKey;
  label: { zh: string; en: string };
  score: number;
  weight: number;
  trend: number;
  detail: { zh: string; en: string };
  icon: React.ComponentType<any>;
  color: string;
}

interface ArtistIPProfile {
  id: ArtistId; name: string; nameEn: string;
  level: 'S' | 'A' | 'B';
  totalValue: number; // 万元
  lastValued: string;
  valueTrend: number; // %
  dimensions: DimensionScore[];
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: { zh: string; en: string }[];
  valuationHistory: { month: string; value: number }[];
  revenueBreakdown: { source: (zh: boolean) => string; amount: number; color: string }[];
}

// ─── Mock Data ────────────────────────────────────────────────────
const PROFILES: Record<ArtistId, ArtistIPProfile> = {
  luChengyuan: {
    id: 'luChengyuan', name: '陆承远', nameEn: 'Lu Chengyuan',
    level: 'S', totalValue: 8400, lastValued: '2026-05-10',
    valueTrend: 12.4,
    riskLevel: 'low',
    riskFactors: [
      { zh: '超过2年无重大负面舆情', en: 'No major negative events in 2+ years' },
      { zh: '合同条款齐全，法律风险低', en: 'Full contract coverage, low legal risk' },
    ],
    dimensions: [
      { key: 'fans',    label: { zh: '粉丝价值', en: 'Fan Value' },       score: 92, weight: 0.25, trend: 5.2,  detail: { zh: '4530万全平台粉丝，核心粉丝黏性高', en: '45.3M cross-platform fans, high core loyalty' }, icon: Users,    color: '#06b6d4' },
      { key: 'commerce',label: { zh: '商业变现', en: 'Commerce' },         score: 96, weight: 0.30, trend: 18.6, detail: { zh: '月均GMV ¥280万，转化率4.2%', en: 'Monthly GMV ¥2.8M, 4.2% conversion' },           icon: ShoppingBag, color: '#22c55e' },
      { key: 'content', label: { zh: '内容产能', en: 'Content Output' },   score: 84, weight: 0.15, trend: 3.1,  detail: { zh: '月均发布42条，均播1200万', en: '42 posts/month, avg 12M views' },                   icon: Music,    color: '#a855f7' },
      { key: 'brand',   label: { zh: '品牌调性', en: 'Brand Alignment' }, score: 90, weight: 0.15, trend: 8.0,  detail: { zh: '硬汉形象，适配品类广，代言溢价高', en: 'Tough image, wide category fit, high premium' }, icon: Award,    color: '#f59e0b' },
      { key: 'legal',   label: { zh: '合规安全', en: 'Legal Compliance' }, score: 98, weight: 0.10, trend: 0,    detail: { zh: '全套IP授权，侵权风险极低', en: 'Full IP auth, minimal infringement risk' },           icon: Shield,   color: '#10b981' },
      { key: 'growth',  label: { zh: '成长潜力', en: 'Growth Potential' }, score: 88, weight: 0.05, trend: 12.0, detail: { zh: '粉丝增速持续加速，商业拓展空间大', en: 'Accelerating fan growth, large expansion room' }, icon: TrendingUp, color: '#ec4899' },
    ],
    valuationHistory: [
      { month: '12月', value: 6200 }, { month: '1月', value: 6800 }, { month: '2月', value: 7100 },
      { month: '3月', value: 7600 }, { month: '4月', value: 7900 }, { month: '5月', value: 8400 },
    ],
    revenueBreakdown: [
      { source: (zh: boolean) => zh ? '品牌代言' : 'Brand Endorsements', amount: 3800, color: '#f59e0b' },
      { source: (zh: boolean) => zh ? '直播带货' : 'Live Commerce',      amount: 2800, color: '#22c55e' },
      { source: (zh: boolean) => zh ? '版权授权' : 'IP Licensing',       amount: 1100, color: '#06b6d4' },
      { source: (zh: boolean) => zh ? '平台分成' : 'Platform Revenue',   amount: 700,  color: '#a855f7' },
    ] as any,
  },
  shenYizhou: {
    id: 'shenYizhou', name: '沈亦舟', nameEn: 'Shen Yizhou',
    level: 'A', totalValue: 1280, lastValued: '2026-05-10',
    valueTrend: 24.8,
    riskLevel: 'low',
    riskFactors: [
      { zh: '快速成长期，有部分授权缺口待补全', en: 'Growth phase with some auth gaps to fill' },
      { zh: '单平台依赖度偏高（抖音占72%）', en: 'High single-platform dependency (DY 72%)' },
    ],
    dimensions: [
      { key: 'fans',     label: { zh: '粉丝价值', en: 'Fan Value' },       score: 76, weight: 0.25, trend: 22.4, detail: { zh: '1280万粉丝，增速业内前5%', en: '12.8M fans, growth in top 5%' },                   icon: Users,    color: '#06b6d4' },
      { key: 'commerce', label: { zh: '商业变现', en: 'Commerce' },         score: 80, weight: 0.30, trend: 31.2, detail: { zh: '月均GMV ¥62万，快速增长中', en: 'Monthly GMV ¥620K, rapidly growing' },             icon: ShoppingBag, color: '#22c55e' },
      { key: 'content',  label: { zh: '内容产能', en: 'Content Output' },   score: 88, weight: 0.15, trend: 5.6,  detail: { zh: '音乐内容质量高，短视频爆款率28%', en: 'High music quality, 28% hit rate' },              icon: Music,    color: '#a855f7' },
      { key: 'brand',    label: { zh: '品牌调性', en: 'Brand Alignment' }, score: 82, weight: 0.15, trend: 6.0,  detail: { zh: '音乐人标签鲜明，潮流品牌匹配度高', en: 'Strong musician label, high trendy brand fit' }, icon: Award,    color: '#f59e0b' },
      { key: 'legal',    label: { zh: '合规安全', en: 'Legal Compliance' }, score: 85, weight: 0.10, trend: 0,    detail: { zh: '基础授权完备，AI声音授权待完善', en: 'Basic auth complete, AI voice auth pending' },     icon: Shield,   color: '#10b981' },
      { key: 'growth',   label: { zh: '成长潜力', en: 'Growth Potential' }, score: 96, weight: 0.05, trend: 28.0, detail: { zh: 'A→S晋升评估中，潜力天花板极高', en: 'A→S promotion eval in progress, very high ceiling' }, icon: TrendingUp, color: '#ec4899' },
    ],
    valuationHistory: [
      { month: '12月', value: 620 }, { month: '1月', value: 720 }, { month: '2月', value: 850 },
      { month: '3月', value: 980 }, { month: '4月', value: 1120 }, { month: '5月', value: 1280 },
    ],
    revenueBreakdown: [
      { source: (zh: boolean) => zh ? '品牌合作' : 'Brand Deals', amount: 520, color: '#f59e0b' },
      { source: (zh: boolean) => zh ? '直播带货' : 'Live Commerce', amount: 480, color: '#22c55e' },
      { source: (zh: boolean) => zh ? '音乐版权' : 'Music Rights', amount: 180, color: '#06b6d4' },
      { source: (zh: boolean) => zh ? '粉丝打赏' : 'Fan Tips', amount: 100, color: '#a855f7' },
    ] as any,
  },
  linYin: {
    id: 'linYin', name: '林音宝', nameEn: 'Lin Yin Bao',
    level: 'A', totalValue: 940, lastValued: '2026-05-10',
    valueTrend: 8.2,
    riskLevel: 'medium',
    riskFactors: [
      { zh: 'AI数字人授权处于训练阶段，存在时间窗口风险', en: 'AI digital human auth in training phase, timing risk' },
      { zh: '小红书平台政策变化可能影响种草效率', en: 'XHS policy changes may affect seeding efficiency' },
      { zh: '护肤品类竞争加剧，内容差异化待强化', en: 'Skincare niche competition intensifying' },
    ],
    dimensions: [
      { key: 'fans',     label: { zh: '粉丝价值', en: 'Fan Value' },       score: 74, weight: 0.25, trend: 6.8,  detail: { zh: '920万粉，小红书黏性强', en: '9.2M fans, strong XHS stickiness' },                    icon: Users,    color: '#06b6d4' },
      { key: 'commerce', label: { zh: '商业变现', en: 'Commerce' },         score: 86, weight: 0.30, trend: 15.4, detail: { zh: '护肤爆款率高，GMV ¥38万/月', en: 'High skincare hit rate, GMV ¥380K/mo' },            icon: ShoppingBag, color: '#22c55e' },
      { key: 'content',  label: { zh: '内容产能', en: 'Content Output' },   score: 78, weight: 0.15, trend: 2.4,  detail: { zh: '测评内容质感好，更新频率待提升', en: 'Quality reviews, update frequency needs boost' },   icon: Music,    color: '#a855f7' },
      { key: 'brand',    label: { zh: '品牌调性', en: 'Brand Alignment' }, score: 80, weight: 0.15, trend: 4.0,  detail: { zh: '温柔气质，女性消费品高度契合', en: 'Gentle image, high fit with feminine goods' },       icon: Award,    color: '#f59e0b' },
      { key: 'legal',    label: { zh: '合规安全', en: 'Legal Compliance' }, score: 72, weight: 0.10, trend: -2.0, detail: { zh: 'AI声音授权问题待解决，中等风险', en: 'AI voice auth issue pending, medium risk' },        icon: Shield,   color: '#10b981' },
      { key: 'growth',   label: { zh: '成长潜力', en: 'Growth Potential' }, score: 80, weight: 0.05, trend: 10.0, detail: { zh: '数字人直播开启后预期爆发增长', en: 'Expected exponential growth when DH live launches' }, icon: TrendingUp, color: '#ec4899' },
    ],
    valuationHistory: [
      { month: '12月', value: 740 }, { month: '1月', value: 780 }, { month: '2月', value: 820 },
      { month: '3月', value: 860 }, { month: '4月', value: 900 }, { month: '5月', value: 940 },
    ],
    revenueBreakdown: [
      { source: (zh: boolean) => zh ? '直播带货' : 'Live Commerce', amount: 380, color: '#22c55e' },
      { source: (zh: boolean) => zh ? '品牌合作' : 'Brand Deals', amount: 320, color: '#f59e0b' },
      { source: (zh: boolean) => zh ? '平台分成' : 'Platform Revenue', amount: 140, color: '#06b6d4' },
      { source: (zh: boolean) => zh ? '内容电商' : 'Content Commerce', amount: 100, color: '#a855f7' },
    ] as any,
  },
};

const LEVEL_COLOR = { S: '#f59e0b', A: '#06b6d4', B: '#6b7280' };
const RISK_CFG = {
  low:    { zh: '低风险', en: 'Low Risk',    color: '#22c55e', bg: 'bg-green-500/10 border-green-500/25' },
  medium: { zh: '中等风险', en: 'Medium Risk', color: '#f59e0b', bg: 'bg-amber-500/10 border-amber-500/25' },
  high:   { zh: '高风险', en: 'High Risk',   color: '#ef4444', bg: 'bg-red-500/10 border-red-500/25' },
};

interface Props { lang: Lang; }

export const IPValuationEngine = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selected, setSelected] = useState<ArtistId>('luChengyuan');
  const [tab, setTab] = useState<'overview' | 'breakdown' | 'history' | 'report'>('overview');

  const profile = PROFILES[selected];
  const levelColor = LEVEL_COLOR[profile.level];
  const riskCfg = RISK_CFG[profile.riskLevel];

  // Compute weighted score
  const compositeScore = Math.round(
    profile.dimensions.reduce((s, d) => s + d.score * d.weight, 0)
  );

  const radarData = profile.dimensions.map(d => ({
    subject: zh ? d.label.zh : d.label.en,
    score: d.score,
    fullMark: 100,
  }));

  const revenueData = profile.revenueBreakdown.map(r => ({
    source: r.source(zh),
    amount: r.amount,
    color: r.color,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? 'IP价值评估引擎' : 'IP Valuation Engine'}
            <span className="text-[10px] font-normal text-gray-500 border border-white/10 rounded-full px-2 py-0.5">BETA</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '多维度艺人IP估值 · 商业潜力分析 · 风险预警 · 市值趋势' : 'Multi-dimensional IP valuation · Commercial potential · Risk alerts · Market cap trends'}</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-xs text-gray-400 hover:text-white hover:border-white/20 transition">
          <Download className="w-3.5 h-3.5" />{zh ? '导出报告' : 'Export Report'}
        </button>
      </div>

      {/* Artist Selector */}
      <div className="flex gap-3 flex-wrap">
        {(Object.values(PROFILES) as ArtistIPProfile[]).map(p => {
          const isActive = selected === p.id;
          const lc = LEVEL_COLOR[p.level];
          return (
            <motion.button key={p.id} onClick={() => setSelected(p.id)} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition"
              style={isActive ? { background: `${lc}08`, borderColor: `${lc}30` } : { background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${lc}60, ${lc}30)` }}>
                {p.name.slice(0, 1)}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color: isActive ? '#0f172a' : '#6b7280' }}>{p.name}</span>
                  <span className="text-[8px] font-black px-1 rounded" style={{ background: `${lc}20`, color: lc }}>{p.level}</span>
                </div>
                <div className="text-[9px]" style={{ color: isActive ? lc : '#4b5563' }}>
                  ¥{(p.totalValue / 10000 >= 1 ? (p.totalValue / 10000).toFixed(1) + '亿' : p.totalValue + '万')}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Profile Hero Card */}
      <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${levelColor}80, ${levelColor}30)` }}>
            {profile.name.slice(0, 1)}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xl font-black text-white">{zh ? profile.name : profile.nameEn}</span>
              <span className="text-xs font-black px-2 py-0.5 rounded-lg" style={{ background: `${levelColor}15`, color: levelColor }}>{profile.level}{zh ? '级IP' : '-Class IP'}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${riskCfg.bg}`} style={{ color: riskCfg.color }}>
                {zh ? riskCfg.zh : riskCfg.en}
              </span>
            </div>
            <div className="text-[10px] text-gray-500">{zh ? '最近估值：' : 'Last valued: '}{profile.lastValued}</div>
          </div>
          {/* Total Valuation */}
          <div className="text-right shrink-0">
            <div className="text-3xl font-black" style={{ color: levelColor, fontFamily: 'var(--font-display)' }}>
              ¥{profile.totalValue.toLocaleString()}<span className="text-base font-normal text-gray-500 ml-0.5">{zh ? '万' : 'K'}</span>
            </div>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              {profile.valueTrend > 0 ? (
                <><TrendingUp className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400 font-bold">+{profile.valueTrend}%</span></>
              ) : (
                <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-400 font-bold">{profile.valueTrend}%</span></>
              )}
              <span className="text-[9px] text-gray-600">{zh ? '近6个月' : 'last 6mo'}</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {compositeScore}
              <span className="text-[10px] font-normal text-gray-500 ml-1">{zh ? '综合评分' : 'Composite'}</span>
            </div>
          </div>
        </div>

        {/* Dimension quick bars */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-5">
          {profile.dimensions.map((d, i) => {
            const DimIcon = d.icon;
            return (
              <div key={d.key} className="text-center p-2 bg-black/30 rounded-xl">
                <DimIcon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: d.color }} />
                <div className="text-[9px] text-gray-600 mb-0.5">{zh ? d.label.zh : d.label.en}</div>
                <div className="text-sm font-black" style={{ color: d.color }}>{d.score}</div>
                <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: d.color }} />
                </div>
                <div className={`text-[8px] mt-0.5 ${d.trend > 0 ? 'text-emerald-500' : d.trend < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  {d.trend > 0 ? '+' : ''}{d.trend}%
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {([
          ['overview',   zh ? '能力雷达' : 'Radar',       BarChart3  ],
          ['breakdown',  zh ? '收益构成' : 'Revenue',      Coins      ],
          ['history',    zh ? '估值历史' : 'History',      TrendingUp ],
          ['report',     zh ? '风险报告' : 'Risk Report',  Shield     ],
        ] as const).map(([t, label, Ic]) => {
          const TabIc = Ic as React.ComponentType<any>;
          return (
            <button key={t} onClick={() => setTab(t as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <TabIc className="w-3.5 h-3.5" />{label}
            </button>
          );
        })}
      </div>

      {/* ─── Radar ─── */}
      {tab === 'overview' && (
        <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid md:grid-cols-2 gap-5">
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">{zh ? '六维能力雷达' : '6-Dimension Radar'}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.07)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 8 }} angle={90} domain={[0, 100]} />
                  <Radar name={profile.name} dataKey="score" stroke={levelColor} fill={levelColor} fillOpacity={0.15} strokeWidth={2} dot={{ fill: levelColor, r: 3 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">{zh ? '维度详情' : 'Dimension Details'}</h3>
            <div className="space-y-3">
              {profile.dimensions.map((d, i) => {
                const DIcon = d.icon;
                return (
                  <div key={d.key} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${d.color}15` }}>
                      <DIcon className="w-3 h-3" style={{ color: d.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold text-white">{zh ? d.label.zh : d.label.en}</span>
                        <span className="text-[10px] font-black" style={{ color: d.color }}>{d.score}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${d.score}%` }} transition={{ delay: i * 0.07, duration: 0.5 }}
                          className="h-full rounded-full" style={{ background: d.color }} />
                      </div>
                      <div className="text-[9px] text-gray-600 leading-tight">{zh ? d.detail.zh : d.detail.en}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Revenue Breakdown ─── */}
      {tab === 'breakdown' && (
        <motion.div key="breakdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">{zh ? '年化收益构成（¥万）' : 'Annualized Revenue Breakdown (¥10K)'}</h3>
          <div className="h-52 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="source" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                  formatter={(v: any) => [`¥${v}万`, '']} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill={levelColor} name={zh ? '金额(万)' : 'Amount(K)'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenueData.map((r, i) => (
              <div key={i} className="p-3 bg-black/20 rounded-xl text-center">
                <div className="text-[9px] text-gray-500 mb-1">{r.source}</div>
                <div className="text-base font-black" style={{ color: r.color }}>¥{r.amount}<span className="text-[9px] text-gray-600">万</span></div>
                <div className="text-[9px] text-gray-600 mt-0.5">{((r.amount / profile.totalValue) * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Valuation History ─── */}
      {tab === 'history' && (
        <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{zh ? 'IP估值历史（¥万）' : 'IP Valuation History (¥10K)'}</h3>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {zh ? `6个月涨幅 +${profile.valueTrend}%` : `6-mo gain +${profile.valueTrend}%`}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profile.valuationHistory}>
                <defs>
                  <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={levelColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={levelColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                  formatter={(v: any) => [`¥${v}万`, zh ? '估值' : 'Valuation']} />
                <Area type="monotone" dataKey="value" stroke={levelColor} fill="url(#valGrad)" strokeWidth={2} dot={{ fill: levelColor, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ─── Risk Report ─── */}
      {tab === 'report' && (
        <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className={`flex items-start gap-3 p-4 rounded-xl border ${riskCfg.bg}`}>
            {profile.riskLevel === 'low' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: riskCfg.color }} />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: riskCfg.color }} />
            )}
            <div>
              <div className="text-sm font-bold" style={{ color: riskCfg.color }}>{zh ? riskCfg.zh : riskCfg.en}</div>
              <div className="text-[10px] text-gray-400 mt-1">{zh ? '综合评估当前IP所面临的法律、市场、内容及合规风险' : 'Comprehensive assessment of legal, market, content, and compliance risks'}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{zh ? '风险因素详情' : 'Risk Factor Details'}</div>
            {profile.riskFactors.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 p-3 bg-gray-900/50 border border-white/5 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: riskCfg.color }} />
                <span className="text-[10px] text-gray-300 leading-relaxed">{zh ? r.zh : r.en}</span>
              </motion.div>
            ))}
          </div>

          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h4 className="text-xs font-bold text-white mb-3">{zh ? '合规维度评分' : 'Compliance Dimension Scores'}</h4>
            <div className="space-y-2">
              {[
                { label: { zh: '法律授权完备度', en: 'Legal Authorization' }, score: profile.dimensions.find(d => d.key === 'legal')!.score, threshold: 80 },
                { label: { zh: '内容合规率',     en: 'Content Compliance' }, score: 94,  threshold: 85 },
                { label: { zh: '平台政策符合度', en: 'Platform Policy Fit' }, score: 88,  threshold: 80 },
                { label: { zh: '商业风险敞口',   en: 'Commercial Risk Exposure' }, score: 100 - (profile.riskLevel === 'low' ? 8 : profile.riskLevel === 'medium' ? 28 : 50), threshold: 70 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400 w-24 shrink-0">{zh ? item.label.zh : item.label.en}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.score >= item.threshold ? '#22c55e' : '#f59e0b' }} />
                    {/* Threshold marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: `${item.threshold}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold w-7 text-right ${item.score >= item.threshold ? 'text-emerald-400' : 'text-amber-400'}`}>{item.score}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
