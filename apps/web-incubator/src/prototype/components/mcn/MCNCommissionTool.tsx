/**
 * MCN佣金分配配置工具
 * 可视化三方分账 MCN → 艺人 → 平台 · 历史结算记录
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins, Settings, ChevronRight, Users, Building2, Sparkles,
  BarChart3, TrendingUp, Download, Clock, CheckCircle2,
  AlertCircle, ArrowRight, PieChart as PieIcon, Sliders,
  Plus, Trash2, Edit3, Save, RotateCcw, Zap
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Lang } from '../../translations';

interface CommissionRule {
  id: string;
  name: string;
  artistId: string;
  artistName: string;
  celebrity?: string;
  platform: string;
  mcnPct: number;
  artistPct: number;
  platformPct: number;
  minMonthlyGmv?: number;
  isDefault: boolean;
  updatedAt: string;
}

interface Settlement {
  id: string;
  month: string;
  artistName: string;
  platform: string;
  totalGmv: number;
  mcnAmount: number;
  artistAmount: number;
  platformFee: number;
  status: 'paid' | 'pending' | 'processing';
}

const MOCK_RULES: CommissionRule[] = [
  { id: 'r1', name: '标准分成方案', artistId: 'a1', artistName: 'Neon V', platform: '全平台', mcnPct: 30, artistPct: 60, platformPct: 10, isDefault: true, updatedAt: '2026-04-01' },
  { id: 'r2', name: '明星联动特殊方案', artistId: 'a1', artistName: 'Neon V', celebrity: '陆承远', platform: '抖音', mcnPct: 25, artistPct: 55, platformPct: 10, minMonthlyGmv: 50000, isDefault: false, updatedAt: '2026-04-15' },
  { id: 'r3', name: '新人培育期方案', artistId: 'a2', artistName: 'Luna Soft', platform: '快手', mcnPct: 40, artistPct: 50, platformPct: 10, isDefault: false, updatedAt: '2026-03-20' },
  { id: 'r4', name: '全能选手高佣方案', artistId: 'a3', artistName: 'Project Zero', platform: '小红书', mcnPct: 20, artistPct: 70, platformPct: 10, minMonthlyGmv: 100000, isDefault: false, updatedAt: '2026-05-01' },
];

const MOCK_SETTLEMENTS: Settlement[] = [
  { id: 's1', month: '2026-04', artistName: 'Neon V', platform: '抖音', totalGmv: 128400, mcnAmount: 32100, artistAmount: 64200, platformFee: 12840, status: 'paid' },
  { id: 's2', month: '2026-04', artistName: 'Luna Soft', platform: '快手', totalGmv: 58200, mcnAmount: 23280, artistAmount: 29100, platformFee: 5820, status: 'paid' },
  { id: 's3', month: '2026-04', artistName: 'Project Zero', platform: '小红书', totalGmv: 34800, mcnAmount: 6960, artistAmount: 24360, platformFee: 3480, status: 'pending' },
  { id: 's4', month: '2026-05', artistName: 'Neon V', platform: '抖音', totalGmv: 89200, mcnAmount: 22300, artistAmount: 44600, platformFee: 8920, status: 'processing' },
  { id: 's5', month: '2026-05', artistName: 'Luna Soft', platform: '全平台', totalGmv: 42100, mcnAmount: 16840, artistAmount: 21050, platformFee: 4210, status: 'processing' },
];

const STATUS_CFG = {
  paid:       { zh: '已结算', en: 'Paid',       color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  pending:    { zh: '待结算', en: 'Pending',     color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',  icon: Clock },
  processing: { zh: '结算中', en: 'Processing',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25',    icon: Zap },
};

const CommissionPieChart = ({ mcn, artist, platform }: { mcn: number; artist: number; platform: number }) => {
  const data = [
    { name: 'MCN', value: mcn, color: '#a855f7' },
    { name: '艺人', value: artist, color: '#06b6d4' },
    { name: '平台费', value: platform, color: '#6b7280' },
  ];
  return (
    <div className="relative w-32 h-32">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="55%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] text-gray-500 text-center leading-tight">分账<br/>比例</span>
      </div>
    </div>
  );
};

const SliderRow = ({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold" style={{ color }}>{value}%</span>
    </div>
    <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
      style={{ background: `linear-gradient(to right, ${color} ${value}%, rgba(255,255,255,0.1) ${value}%)` }} />
  </div>
);

export const MCNCommissionTool = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'rules' | 'settlements' | 'simulator'>('rules');
  const [editRule, setEditRule] = useState<CommissionRule | null>(null);
  const [simMcn, setSimMcn] = useState(30);
  const [simArtist, setSimArtist] = useState(60);
  const [simGmv, setSimGmv] = useState(100000);
  const [newRuleOpen, setNewRuleOpen] = useState(false);

  const simPlatform = 10; // platform fee fixed
  const simMcnAdj = Math.max(0, Math.min(100 - simPlatform - simArtist, simMcn));

  const handleArtistChange = (v: number) => {
    const remaining = 100 - simPlatform;
    if (v > remaining) v = remaining;
    setSimArtist(v);
    setSimMcn(remaining - v);
  };
  const handleMcnChange = (v: number) => {
    const remaining = 100 - simPlatform;
    if (v > remaining) v = remaining;
    setSimMcn(v);
    setSimArtist(remaining - v);
  };

  const totalSettled = MOCK_SETTLEMENTS.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.totalGmv, 0);
  const totalMcn = MOCK_SETTLEMENTS.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.mcnAmount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? 'MCN佣金分配工具' : 'MCN Commission Tool'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{zh ? '三方分账配置 · 结算记录 · 模拟器' : '3-party split configuration · Settlement history · Simulator'}</p>
        </div>
        <button onClick={() => setNewRuleOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
          <Plus className="w-4 h-4" />{zh ? '新建分成方案' : 'New Commission Rule'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: { zh: '分成规则数', en: 'Commission Rules' }, value: MOCK_RULES.length, color: '#a855f7', icon: Settings },
          { label: { zh: '本期结算GMV', en: 'Settled GMV' }, value: `¥${(totalSettled / 10000).toFixed(0)}万`, color: '#06b6d4', icon: TrendingUp },
          { label: { zh: 'MCN收益', en: 'MCN Revenue' }, value: `¥${(totalMcn / 10000).toFixed(1)}万`, color: '#22c55e', icon: Coins },
          { label: { zh: '待结算数', en: 'Pending Settlement' }, value: MOCK_SETTLEMENTS.filter(s => s.status === 'pending').length, color: '#f59e0b', icon: Clock },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
              <span className="text-[10px] text-gray-500">{zh ? k.label.zh : k.label.en}</span>
            </div>
            <div className="text-xl font-black" style={{ color: k.color }}>{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'rules', zh: '分成规则', en: 'Rules' },
          { id: 'settlements', zh: '结算记录', en: 'Settlements' },
          { id: 'simulator', zh: '分账模拟器', en: 'Simulator' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${tab === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
            {zh ? t.zh : t.en}
          </button>
        ))}
      </div>

      {/* Tab: Rules */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {MOCK_RULES.map((rule, i) => (
            <motion.div key={rule.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`p-5 rounded-xl border ${rule.isDefault ? 'border-purple-500/25 bg-purple-500/5' : 'border-white/5 bg-gray-900/40'} hover:border-white/10 transition`}>
              <div className="flex items-start gap-4">
                {/* Pie chart */}
                <CommissionPieChart mcn={rule.mcnPct} artist={rule.artistPct} platform={rule.platformPct} />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{rule.name}</span>
                    {rule.isDefault && <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">{zh ? '默认' : 'DEFAULT'}</span>}
                    {rule.celebrity && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">⭐ {rule.celebrity}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                    <span>{rule.artistName}</span>
                    <span>{rule.platform}</span>
                    {rule.minMonthlyGmv && <span className="text-green-400">{zh ? '月GMV≥' : 'Min GMV≥'}¥{(rule.minMonthlyGmv / 10000).toFixed(0)}万</span>}
                  </div>
                  {/* Split visualization */}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { label: 'MCN', pct: rule.mcnPct, color: '#a855f7', desc: zh ? '公司分成' : 'Company' },
                      { label: zh ? '艺人' : 'Artist', pct: rule.artistPct, color: '#06b6d4', desc: rule.artistName },
                      { label: zh ? '平台费' : 'Platform', pct: rule.platformPct, color: '#6b7280', desc: zh ? 'GMV服务费' : 'GMV fee' },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <div className="text-lg font-black" style={{ color: item.color }}>{item.pct}%</div>
                        <div className="text-[9px] text-gray-500">{item.label}</div>
                        <div className="text-[8px] text-gray-700">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                  {/* Stacked bar */}
                  <div className="mt-2 h-2 rounded-full overflow-hidden flex">
                    <div style={{ width: `${rule.mcnPct}%`, background: '#a855f7' }} className="transition-all" />
                    <div style={{ width: `${rule.artistPct}%`, background: '#06b6d4' }} className="transition-all" />
                    <div style={{ flex: 1, background: '#374151' }} />
                  </div>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => setEditRule(rule)} className="p-2 rounded-lg border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!rule.isDefault && (
                    <button className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tab: Settlements */}
      {tab === 'settlements' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{zh ? '结算记录' : 'Settlement Records'}</span>
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/8 rounded-lg px-3 py-1.5 hover:border-white/20 transition">
              <Download className="w-3.5 h-3.5" />{zh ? '导出报表' : 'Export'}
            </button>
          </div>
          {MOCK_SETTLEMENTS.map((s, i) => {
            const cfg = STATUS_CFG[s.status];
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{s.month} · {s.artistName}</span>
                      <span className="text-[9px] text-gray-600">{s.platform}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-[9px] text-gray-600">{zh ? '总GMV' : 'Total GMV'}</div>
                        <div className="text-sm font-bold text-white">¥{(s.totalGmv / 10000).toFixed(1)}万</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-600">{zh ? 'MCN收益' : 'MCN Revenue'}</div>
                        <div className="text-sm font-bold text-purple-400">¥{s.mcnAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-600">{zh ? '艺人分成' : 'Artist Share'}</div>
                        <div className="text-sm font-bold text-cyan-400">¥{s.artistAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1 shrink-0 ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon className="w-3 h-3" />{zh ? cfg.zh : cfg.en}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tab: Simulator */}
      {tab === 'simulator' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-5">
            <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-5 space-y-5">
              <h3 className="text-sm font-bold text-white">{zh ? '分账比例模拟' : 'Commission Split Simulator'}</h3>
              <SliderRow label={zh ? 'MCN公司分成' : 'MCN Company'} value={simMcn} onChange={handleMcnChange} color="#a855f7" />
              <SliderRow label={zh ? '艺人分成' : 'Artist Share'} value={simArtist} onChange={handleArtistChange} color="#06b6d4" />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{zh ? '平台GMV服务费（固定）' : 'Platform GMV Fee (fixed)'}</span>
                  <span className="font-bold text-gray-500">{simPlatform}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full" />
              </div>
              {/* Stacked bar */}
              <div className="h-4 rounded-xl overflow-hidden flex">
                <motion.div className="h-full" style={{ background: '#a855f7' }} animate={{ width: `${simMcn}%` }} transition={{ duration: 0.2 }} />
                <motion.div className="h-full" style={{ background: '#06b6d4' }} animate={{ width: `${simArtist}%` }} transition={{ duration: 0.2 }} />
                <div className="flex-1 h-full bg-gray-700" />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-400">{zh ? '月GMV测试值' : 'Test Monthly GMV'}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[50000, 100000, 500000, 1000000].map(v => (
                    <button key={v} onClick={() => setSimGmv(v)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${simGmv === v ? 'border-purple-500/40 bg-purple-500/10 text-purple-400' : 'border-white/8 text-gray-500 hover:border-white/15'}`}>
                      {v >= 10000 ? `¥${v / 10000}万` : `¥${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="space-y-4">
            <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{zh ? '预计分账结果' : 'Estimated Distribution'}</h3>
                <span className="text-[10px] text-gray-500">{zh ? '月GMV：' : 'Monthly GMV: '}¥{simGmv.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-center">
                <CommissionPieChart mcn={simMcn} artist={simArtist} platform={simPlatform} />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'MCN', pct: simMcn, color: '#a855f7', amount: Math.round(simGmv * simMcn / 100) },
                  { label: zh ? '艺人' : 'Artist', pct: simArtist, color: '#06b6d4', amount: Math.round(simGmv * simArtist / 100) },
                  { label: zh ? '平台费' : 'Platform', pct: simPlatform, color: '#6b7280', amount: Math.round(simGmv * simPlatform / 100) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs text-gray-400">{item.label} ({item.pct}%)</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: item.color }}>¥{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-green-400">{zh ? 'MCN年化预估收益' : 'MCN Annual Estimate'}</span>
                <span className="text-lg font-black text-green-400">¥{(Math.round(simGmv * simMcn / 100) * 12).toLocaleString()}</span>
              </div>
            </div>
            <button className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
              <Save className="w-4 h-4" />{zh ? '保存为分成方案' : 'Save as Commission Rule'}
            </button>
          </div>
        </div>
      )}

      {/* New Rule Modal */}
      <AnimatePresence>
        {newRuleOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setNewRuleOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{zh ? '新建分成方案' : 'New Commission Rule'}</h3>
                <button onClick={() => setNewRuleOpen(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                <input placeholder={zh ? '方案名称（如：明星联动方案）' : 'Rule name'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none transition" />
                <div className="grid grid-cols-2 gap-2">
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '选择艺人' : 'Artist'}</option>
                    <option>Neon V</option><option>Luna Soft</option><option>Project Zero</option>
                  </select>
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '选择平台' : 'Platform'}</option>
                    <option>全平台</option><option>抖音</option><option>快手</option><option>小红书</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 mb-1">{zh ? '分成比例（总计须等于100%，平台费固定10%）' : 'Commission split (total must equal 100%, platform fee fixed at 10%)'}</div>
                <SliderRow label={zh ? 'MCN分成' : 'MCN'} value={30} onChange={() => {}} color="#a855f7" />
                <SliderRow label={zh ? '艺人分成' : 'Artist'} value={60} onChange={() => {}} color="#06b6d4" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNewRuleOpen(false)} className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">{zh ? '取消' : 'Cancel'}</button>
                <button onClick={() => setNewRuleOpen(false)} className="flex-1 h-10 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>{zh ? '创建方案' : 'Create Rule'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MCNCommissionTool;
