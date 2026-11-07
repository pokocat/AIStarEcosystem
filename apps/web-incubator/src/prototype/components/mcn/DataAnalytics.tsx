/**
 * DataAnalytics — 数据看板 · P1三维升级
 * 维度一：内容效能  维度二：授权链健康度  维度三：收益溯源
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Eye, Heart,
  ShoppingBag, Zap, ArrowUpRight, ArrowDownRight, RefreshCw,
  Target, Coins, Play, Star, Shield, FileCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Layers, Package, Link2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import type { Lang } from '../../translations';

// ─── Mock Data ───────────────────────────────────────────────────
const GMV_DATA = [
  { date: '4/1',  gmv: 12400, views: 89000,  fans: 320  },
  { date: '4/7',  gmv: 18600, views: 134000, fans: 580  },
  { date: '4/14', gmv: 15200, views: 112000, fans: 420  },
  { date: '4/21', gmv: 28900, views: 198000, fans: 890  },
  { date: '4/28', gmv: 34100, views: 245000, fans: 1120 },
  { date: '5/1',  gmv: 22800, views: 168000, fans: 650  },
  { date: '5/7',  gmv: 41200, views: 312000, fans: 1480 },
];

const ACCOUNT_PERF = [
  { name: '@neon_v',     platform: 'DY', gmv: 48200, views: '312万', fans: '128.4万', conversion: '3.8%', healthScore: 92, trend: 12.4 },
  { name: '@luna_soft',  platform: 'KS', gmv: 22800, views: '148万', fans: '56.2万',  conversion: '2.9%', healthScore: 78, trend: -3.1 },
  { name: '@project_z',  platform: 'XHS',gmv: 11500, views: '89万',  fans: '23.7万',  conversion: '4.2%', healthScore: 85, trend: 8.7  },
  { name: '@neonv_ch',   platform: 'VCH',gmv: 6200,  views: '45万',  fans: '18.9万',  conversion: '1.8%', healthScore: 67, trend: -1.2 },
  { name: '@luna_bili',  platform: 'BL', gmv: 3800,  views: '28万',  fans: '8.3万',   conversion: '2.1%', healthScore: 71, trend: 5.3  },
];

const PLATFORM_DIST = [
  { name: 'DY',  value: 48200, color: '#ff2d55' },
  { name: 'KS',  value: 22800, color: '#ff6600' },
  { name: 'XHS', value: 11500, color: '#ff2442' },
  { name: 'VCH', value: 6200,  color: '#07c160' },
  { name: 'BL',  value: 3800,  color: '#00a1d6' },
];

const CELEBRITY_PERF = [
  { name: '陆承远', gmv: 28400, videos: 12, conversion: '4.1%', color: '#06b6d4' },
  { name: '顾星辰', gmv: 34200, videos: 8,  conversion: '5.2%', color: '#a855f7' },
  { name: '苏念', gmv: 19600, videos: 15, conversion: '3.8%', color: '#ec4899' },
  { name: '江野',gmv: 11300, videos: 6,  conversion: '3.2%', color: '#f59e0b' },
];

const CONTENT_FUNNEL = [
  { stage: '内容曝光', en: 'Exposure',     value: 3120000, pct: 100  },
  { stage: '视频播放', en: 'Video Views',  value: 2184000, pct: 70   },
  { stage: '商品点击', en: 'Product Click',value: 124000,  pct: 4    },
  { stage: '下单购买', en: 'Purchase',     value: 5890,    pct: 0.19 },
];

// ─── 维度二：授权链健康度 ───
const LICENSE_HEALTH = {
  total: 48, active: 32, expiring: 7, expired: 6, unauthorized: 3,
  score: 78,
  radarData: [
    { subject: '有效授权', value: 90, fullMark: 100 },
    { subject: '到期管控', value: 72, fullMark: 100 },
    { subject: '平台覆盖', value: 85, fullMark: 100 },
    { subject: '授权完整性', value: 68, fullMark: 100 },
    { subject: '溯源准确', value: 88, fullMark: 100 },
  ],
  byPartner: [
    { name: '沈亦舟',  active: 12, expiring: 2, expired: 1, pct: 80 },
    { name: '林音宝',  active: 8,  expiring: 3, expired: 0, pct: 85 },
    { name: '顾星辰',    active: 6,  expiring: 1, expired: 2, pct: 70 },
    { name: '苏念',    active: 4,  expiring: 1, expired: 2, pct: 60 },
    { name: '品牌方A', active: 2,  expiring: 0, expired: 1, pct: 67 },
  ],
  alerts: [
    { id: 'la1', type: 'expiring', msg: '沈亦舟618切片授权将于7天后到期', partner: '沈亦舟', date: '2025-09-18' },
    { id: 'la2', type: 'expiring', msg: '林音宝护肤口播授权将于3天后到期', partner: '林音宝', date: '2025-09-14' },
    { id: 'la3', type: 'unauthorized', msg: '发现3个视频使用未授权水印素材', partner: '-', date: '2025-09-11' },
    { id: 'la4', type: 'expired', msg: '顾星辰某场景授权已过期，相关视频暂停发布', partner: '顾星辰', date: '2025-08-20' },
  ],
};

// ─── 维度三：收益溯源 ───
const REVENUE_TRACE = [
  { licenseId: 'LIC-2025-0047', partner: '沈亦舟', content: '618主播切片', platform: 'DY/KS', videos: 23, gmv: 82400, authorized: true,  color: '#06b6d4' },
  { licenseId: 'LIC-2025-0048', partner: '林音宝', content: '护肤精华系列', platform: 'XHS/DY', videos: 15, gmv: 44800, authorized: true,  color: '#a855f7' },
  { licenseId: 'LIC-2025-0051', partner: '顾星辰',   content: '护肤联名', platform: 'KS', videos: 8,  gmv: 28300, authorized: true,  color: '#ec4899' },
  { licenseId: 'LIC-2025-0052', partner: '苏念',   content: '美妆系列', platform: 'XHS', videos: 11, gmv: 19600, authorized: true,  color: '#f59e0b' },
  { licenseId: 'UNKNOWN',       partner: '未知来源', content: '疑似搬运', platform: 'KS/XHS', videos: 3,  gmv: 6800,  authorized: false, color: '#ef4444' },
];

const REVENUE_BY_LICENSE_TYPE = [
  { month: '4月', authorized: 82400, unauthorized: 3200 },
  { month: '5月', authorized: 114800, unauthorized: 4100 },
  { month: '6月', authorized: 98600, unauthorized: 5800 },
  { month: '7月', authorized: 132000, unauthorized: 3900 },
  { month: '8月', authorized: 158400, unauthorized: 6800 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-950 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ color: p.color }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold">{typeof p.value === 'number' && p.value > 1000 ? `¥${p.value.toLocaleString()}` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

type Dim = 'content' | 'license' | 'revenue';

export const DataAnalytics = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [dim, setDim] = useState<Dim>('content');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [metricTab, setMetricTab] = useState<'gmv' | 'views' | 'fans'>('gmv');

  const totalGmv = ACCOUNT_PERF.reduce((s, a) => s + a.gmv, 0);
  const totalViews = 622;
  const avgConversion = (ACCOUNT_PERF.reduce((s, a) => s + parseFloat(a.conversion), 0) / ACCOUNT_PERF.length).toFixed(1);

  const DIM_TABS: { id: Dim; zh: string; en: string; icon: React.ComponentType<any>; color: string }[] = [
    { id: 'content', zh: '内容效能', en: 'Content Performance', icon: BarChart3, color: '#06b6d4' },
    { id: 'license', zh: '授权链健康', en: 'License Health', icon: Shield, color: '#a855f7' },
    { id: 'revenue', zh: '收益溯源', en: 'Revenue Attribution', icon: Link2, color: '#22c55e' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '数据看板' : 'Analytics Dashboard'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {zh ? '内容效能 · 授权链健康 · 收益溯源 — 三维数据中枢' : 'Content · License Health · Revenue Attribution — 3-Dimension Hub'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.03] border border-white/5 rounded-xl p-1">
            {(['7d', '30d', '90d'] as const).map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${dateRange === r ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                {r}
              </button>
            ))}
          </div>
          <button className="p-2 rounded-xl border border-white/8 text-gray-500 hover:text-white hover:border-white/15 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dimension Tabs */}
      <div className="flex gap-2">
        {DIM_TABS.map(d => {
          const DIcon = d.icon;
          return (
            <button key={d.id} onClick={() => setDim(d.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition ${
                dim === d.id
                  ? 'text-white border-white/20'
                  : 'text-gray-500 border-white/5 hover:border-white/15 hover:text-gray-300'
              }`}
              style={dim === d.id ? { background: `${d.color}15`, borderColor: `${d.color}35`, color: d.color } : {}}>
              <DIcon className="w-3.5 h-3.5" />
              {zh ? d.zh : d.en}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ═══ 维度一：内容效能 ═══ */}
        {dim === 'content' && (
          <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: { zh: '本月GMV', en: 'Monthly GMV' }, value: `¥${(totalGmv / 10000).toFixed(1)}万`, change: '+18.4%', up: true, color: '#22c55e', icon: ShoppingBag },
                { label: { zh: '总播放量', en: 'Total Views' }, value: `${totalViews}万`, change: '+23.1%', up: true, color: '#06b6d4', icon: Eye },
                { label: { zh: '综合转化率', en: 'Avg Conversion' }, value: `${avgConversion}%`, change: '+0.3%', up: true, color: '#a855f7', icon: Target },
                { label: { zh: '平台服务费', en: 'Platform Fee' }, value: `¥${Math.round(totalGmv * 0.012)}`, change: '1.2%', up: false, color: '#f59e0b', icon: Coins },
              ].map((k, i) => {
                const KIcon = k.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${k.color}15` }}>
                        <KIcon className="w-4 h-4" style={{ color: k.color }} />
                      </div>
                      <span className={`text-xs flex items-center gap-0.5 ${k.up ? 'text-green-400' : 'text-gray-500'}`}>
                        {k.up ? <ArrowUpRight className="w-3 h-3" /> : ''}{k.change}
                      </span>
                    </div>
                    <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{k.value}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{zh ? k.label.zh : k.label.en}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* GMV Trend Chart */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white">{zh ? 'GMV趋势 & 内容表现' : 'GMV Trend & Content Performance'}</h3>
                <div className="flex bg-white/[0.03] border border-white/5 rounded-lg p-0.5">
                  {[['gmv', 'GMV'], ['views', zh ? '播放量' : 'Views'], ['fans', zh ? '涨粉' : 'Fans']].map(([key, label]) => (
                    <button key={key} onClick={() => setMetricTab(key as any)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${metricTab === key ? 'bg-white/10 text-white' : 'text-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={GMV_DATA}>
                    <defs key="defs-1">
                      <linearGradient id="gradGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradFans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid key="cartesiangrid-2" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis key="xaxis-3" dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis key="yaxis-4" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip key="tooltip-5" content={<CustomTooltip />} />
                    <Area key="area-6" type="monotone"
                      dataKey={metricTab === 'gmv' ? 'gmv' : metricTab === 'views' ? 'views' : 'fans'}
                      stroke={metricTab === 'gmv' ? '#a855f7' : metricTab === 'views' ? '#06b6d4' : '#22c55e'}
                      fill={`url(#grad${metricTab.charAt(0).toUpperCase() + metricTab.slice(1)})`}
                      strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom row */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Account ranking */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">{zh ? '账号GMV排行' : 'Account GMV Ranking'}</h3>
                <div className="space-y-3">
                  {[...ACCOUNT_PERF].sort((a, b) => b.gmv - a.gmv).map((acc, i) => {
                    const maxGmv = Math.max(...ACCOUNT_PERF.map(a => a.gmv));
                    const pct = (acc.gmv / maxGmv) * 100;
                    return (
                      <div key={acc.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 w-4">#{i + 1}</span>
                            <span className="text-white font-medium">{acc.name}</span>
                            <span className="text-gray-600 text-[10px]">{acc.platform}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] flex items-center gap-0.5 ${acc.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {acc.trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                              {Math.abs(acc.trend)}%
                            </span>
                            <span className="font-bold text-white">¥{acc.gmv.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.08 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {/* Celebrity GMV */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3">{zh ? '明星带货效果' : 'Celebrity Commerce'}</h3>
                  <div className="space-y-2">
                    {CELEBRITY_PERF.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                          style={{ background: `${c.color}20`, color: c.color }}>
                          <Star className="w-3 h-3" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-white font-medium">{c.name}</span>
                            <span className="text-gray-500">{c.videos}{zh ? '个视频' : ' videos'} · {c.conversion}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                              animate={{ width: `${(c.gmv / 34200) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.6 }}
                              style={{ background: c.color }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold w-16 text-right" style={{ color: c.color }}>¥{(c.gmv / 10000).toFixed(1)}万</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Funnel */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3">{zh ? '带货转化漏斗' : 'Commerce Funnel'}</h3>
                  <div className="space-y-2">
                    {CONTENT_FUNNEL.map((stage, i) => (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <div className="text-[10px] text-gray-500 w-16 shrink-0 text-right">{zh ? stage.stage : stage.en}</div>
                        <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                          <motion.div className="h-full rounded-lg" initial={{ width: 0 }}
                            animate={{ width: `${stage.pct}%` }} transition={{ delay: i * 0.1, duration: 0.7 }}
                            style={{ background: `rgba(168,85,247,${1 - i * 0.2})` }} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white font-bold">
                            {stage.value > 10000 ? `${(stage.value / 10000).toFixed(0)}万` : stage.value.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-600 w-10 shrink-0">{stage.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Platform dist */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '平台GMV分布' : 'Platform GMV Distribution'}</h3>
              <div className="flex items-center gap-6">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={PLATFORM_DIST} dataKey="value" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>
                        {PLATFORM_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {PLATFORM_DIST.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="text-xs text-gray-400 w-10">{p.name}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: p.color }}
                          initial={{ width: 0 }} animate={{ width: `${(p.value / totalGmv) * 100}%` }} transition={{ delay: i * 0.07 }} />
                      </div>
                      <span className="text-xs text-white font-bold w-16 text-right">¥{(p.value / 10000).toFixed(1)}万</span>
                      <span className="text-[10px] text-gray-600 w-10 text-right">{((p.value / totalGmv) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ 维度二：授权链健康度 ═══ */}
        {dim === 'license' && (
          <motion.div key="license" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            {/* Overview KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: zh ? '授权总数' : 'Total Licenses', value: LICENSE_HEALTH.total, color: '#6b7280', icon: FileCheck },
                { label: zh ? '有效授权' : 'Active', value: LICENSE_HEALTH.active, color: '#22c55e', icon: CheckCircle2 },
                { label: zh ? '即将到期' : 'Expiring', value: LICENSE_HEALTH.expiring, color: '#f59e0b', icon: Clock },
                { label: zh ? '已过期' : 'Expired', value: LICENSE_HEALTH.expired, color: '#ef4444', icon: XCircle },
                { label: zh ? '无授权内容' : 'Unauthorized', value: LICENSE_HEALTH.unauthorized, color: '#ec4899', icon: AlertTriangle },
              ].map((k, i) => {
                const KIcon = k.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                      <span className="text-[10px] text-gray-500">{k.label}</span>
                    </div>
                    <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: k.color }}>{k.value}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Health Score + Radar */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Score Card */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">{zh ? '授权链健康评分' : 'License Chain Health Score'}</h3>
                <div className="flex items-center gap-6 mb-5">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                      <motion.circle cx="50" cy="50" r="40" fill="none" stroke="#a855f7" strokeWidth="10"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: '0 251.2' }}
                        animate={{ strokeDasharray: `${LICENSE_HEALTH.score / 100 * 251.2} 251.2` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{LICENSE_HEALTH.score}</span>
                      <span className="text-[9px] text-gray-500">{zh ? '综合评分' : 'Score'}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: zh ? '有效率' : 'Active Rate', pct: Math.round(LICENSE_HEALTH.active / LICENSE_HEALTH.total * 100), color: '#22c55e' },
                      { label: zh ? '到期风险' : 'Expiry Risk', pct: Math.round(LICENSE_HEALTH.expiring / LICENSE_HEALTH.total * 100), color: '#f59e0b' },
                      { label: zh ? '违规风险' : 'Violation Risk', pct: Math.round(LICENSE_HEALTH.unauthorized / LICENSE_HEALTH.total * 100), color: '#ef4444' },
                    ].map((row, i) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">{row.label}</span>
                          <span style={{ color: row.color }}>{row.pct}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: row.color }}
                            initial={{ width: 0 }} animate={{ width: `${row.pct}%` }} transition={{ delay: 0.3 + i * 0.1 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Alerts */}
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '待处理告警' : 'Alerts'}</div>
                  {LICENSE_HEALTH.alerts.map(alert => (
                    <div key={alert.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                      alert.type === 'unauthorized' ? 'bg-red-500/5 border border-red-500/15' :
                      alert.type === 'expired' ? 'bg-red-500/5 border border-red-500/10' :
                      'bg-amber-500/5 border border-amber-500/15'
                    }`}>
                      {alert.type === 'expiring' ? <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> :
                       alert.type === 'unauthorized' ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> :
                       <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-white leading-snug">{alert.msg}</div>
                        <div className="text-[9px] text-gray-600 mt-0.5">{alert.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">{zh ? '五维健康雷达' : '5D Health Radar'}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={LICENSE_HEALTH.radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Radar name="health" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Partner Health Table */}
                <div className="mt-2 space-y-2">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '按合作方分布' : 'By Partner'}</div>
                  {LICENSE_HEALTH.byPartner.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-14 shrink-0">{p.name}</span>
                      <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div className="h-full rounded-full" style={{ background: `rgba(168,85,247,${p.pct / 100})` }}
                          initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} transition={{ delay: i * 0.08 }} />
                        <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px]">
                          <span className="text-emerald-400">{p.active}有效</span>
                          {p.expiring > 0 && <span className="text-amber-400">{p.expiring}到期</span>}
                          {p.expired > 0 && <span className="text-red-400">{p.expired}过期</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: p.pct >= 80 ? '#22c55e' : p.pct >= 60 ? '#f59e0b' : '#ef4444' }}>{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ 维度三：收益溯源 ═══ */}
        {dim === 'revenue' && (
          <motion.div key="revenue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: zh ? '授权收益总额' : 'Licensed Revenue', value: '¥17.5万', color: '#22c55e', icon: CheckCircle2 },
                { label: zh ? '无授权收益' : 'Unauthorized Rev.', value: '¥6,800', color: '#ef4444', icon: AlertTriangle },
                { label: zh ? '授权溯源率' : 'Attribution Rate', value: '96.2%', color: '#06b6d4', icon: Link2 },
                { label: zh ? '违规内容损失' : 'Risk Exposure', value: '¥6,800', color: '#f59e0b', icon: Shield },
              ].map((k, i) => {
                const KIcon = k.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <KIcon className="w-4 h-4" style={{ color: k.color }} />
                      <span className="text-[10px] text-gray-500">{k.label}</span>
                    </div>
                    <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: k.color }}>{k.value}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Authorized vs Unauthorized over time */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '授权 vs 无授权收益趋势' : 'Licensed vs Unauthorized Revenue Trend'}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE_BY_LICENSE_TYPE} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="authorized" name={zh ? '授权收益' : 'Licensed'} fill="#22c55e" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="unauthorized" name={zh ? '无授权收益' : 'Unauthorized'} fill="#ef4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 justify-center mt-2">
                {[['#22c55e', zh ? '授权收益' : 'Licensed'], ['#ef4444', zh ? '无授权收益（风险）' : 'Unauthorized (Risk)']].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: color }} />{label}
                  </div>
                ))}
              </div>
            </div>

            {/* License-Revenue Trace Table */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '授权链收益明细' : 'License-Revenue Attribution Detail'}</h3>
              <div className="space-y-2">
                {REVENUE_TRACE.map((row, i) => (
                  <motion.div key={row.licenseId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition hover:border-white/15 ${
                      row.authorized ? 'bg-black/20 border-white/5' : 'bg-red-500/3 border-red-500/15'
                    }`}>
                    <div className="flex items-center gap-2 shrink-0">
                      {row.authorized
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <AlertTriangle className="w-4 h-4 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-gray-500">{row.licenseId}</span>
                        <span className="text-xs font-semibold text-white">{row.partner}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">{row.content} · {row.platform} · {row.videos}{zh ? '个视频' : ' videos'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black" style={{ color: row.color, fontFamily: 'var(--font-display)' }}>¥{row.gmv.toLocaleString()}</div>
                      <div className="text-[9px] text-gray-600">{row.authorized ? (zh ? '已授权' : 'Authorized') : (zh ? '无授权-风险' : 'Unauthorized-Risk')}</div>
                    </div>
                    <div className="w-20 shrink-0">
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ background: row.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(row.gmv / 82400) * 100}%` }}
                          transition={{ delay: i * 0.08, duration: 0.6 }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataAnalytics;
