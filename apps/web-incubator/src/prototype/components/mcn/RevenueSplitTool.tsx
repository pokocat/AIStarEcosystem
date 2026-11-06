/**
 * RevenueSplitTool — 收益分成结算台
 * P2 新增：三方（MCN/艺人/品牌方）分成计算 · 合同比例管理 · 月度结算 · 支付记录
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins, CheckCircle2, Clock, AlertTriangle, Download,
  Users, Building2, Layers, ChevronRight, Plus, Settings,
  BarChart3, FileText, ArrowUpRight, Star, Wallet, TrendingUp,
  RefreshCw, Shield
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type SplitStatus = 'settled' | 'pending' | 'processing' | 'dispute';
type PartyType = 'mcn' | 'artist' | 'brand';

interface SplitContract {
  id: string; name: string; artistName: string; brandName?: string;
  type: 'tripartite' | 'bipartite';
  mcnPct: number; artistPct: number; brandPct: number;
  baseRevenue: number; status: SplitStatus;
  period: string; settledAt?: string;
}

interface PaymentRecord {
  id: string; contractId: string; party: PartyType; partyName: string;
  amount: number; status: 'paid' | 'pending' | 'failed';
  date: string; method: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const MOCK_CONTRACTS: SplitContract[] = [
  { id: 'sc1', name: '张艺星×极速数码618分成协议', artistName: '张艺星', brandName: '极速数码',
    type: 'tripartite', mcnPct: 30, artistPct: 55, brandPct: 15,
    baseRevenue: 182400, status: 'settled', period: '2025-08', settledAt: '2025-09-05' },
  { id: 'sc2', name: '林音宝护肤精华9月分成', artistName: '林音宝', brandName: '护肤品牌A',
    type: 'tripartite', mcnPct: 25, artistPct: 60, brandPct: 15,
    baseRevenue: 98600, status: 'processing', period: '2025-09' },
  { id: 'sc3', name: '肖战演技系列纯MCN协议', artistName: '肖战', brandName: undefined,
    type: 'bipartite', mcnPct: 40, artistPct: 60, brandPct: 0,
    baseRevenue: 64200, status: 'pending', period: '2025-09' },
  { id: 'sc4', name: '杨幂美妆联名分成协议', artistName: '杨幂', brandName: '美妆品牌B',
    type: 'tripartite', mcnPct: 28, artistPct: 52, brandPct: 20,
    baseRevenue: 44800, status: 'dispute', period: '2025-08' },
];

const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: 'p1', contractId: 'sc1', party: 'artist', partyName: '张艺星',   amount: 100320, status: 'paid',    date: '2025-09-05', method: '银行转账' },
  { id: 'p2', contractId: 'sc1', party: 'mcn',    partyName: 'MCN掌门人', amount: 54720,  status: 'paid',    date: '2025-09-05', method: '内部结算' },
  { id: 'p3', contractId: 'sc1', party: 'brand',  partyName: '极速数码',  amount: 27360,  status: 'paid',    date: '2025-09-05', method: '平台扣除' },
  { id: 'p4', contractId: 'sc2', party: 'artist', partyName: '林音宝',    amount: 59160,  status: 'pending', date: '2025-10-05', method: '待确认' },
  { id: 'p5', contractId: 'sc2', party: 'mcn',    partyName: 'MCN掌门人', amount: 24650,  status: 'pending', date: '2025-10-05', method: '待确认' },
];

const MONTHLY_CHART = [
  { month: '4月', mcn: 48000, artist: 92000, brand: 18000 },
  { month: '5月', mcn: 62000, artist: 118000, brand: 22000 },
  { month: '6月', mcn: 55000, artist: 105000, brand: 19000 },
  { month: '7月', mcn: 78000, artist: 148000, brand: 28000 },
  { month: '8月', mcn: 54720, artist: 100320, brand: 27360 },
  { month: '9月', mcn: 24650, artist: 59160, brand: 14790 },
];

const STATUS_CFG: Record<SplitStatus, { zh: string; en: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  settled:    { zh: '已结算', en: 'Settled',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  pending:    { zh: '待结算', en: 'Pending',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   icon: Clock },
  processing: { zh: '结算中', en: 'Processing', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    icon: RefreshCw },
  dispute:    { zh: '争议中', en: 'Dispute',    color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: AlertTriangle },
};

const PARTY_CFG: Record<PartyType, { zh: string; en: string; color: string; icon: React.ComponentType<any> }> = {
  mcn:    { zh: 'MCN平台', en: 'MCN', color: '#06b6d4', icon: Layers },
  artist: { zh: '艺人',    en: 'Artist', color: '#f59e0b', icon: Star },
  brand:  { zh: '品牌方',  en: 'Brand', color: '#a855f7', icon: Building2 },
};

interface Props { lang: Lang; }

export const RevenueSplitTool = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'contracts' | 'payments' | 'analytics'>('contracts');
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  const totalRevenue = MOCK_CONTRACTS.reduce((s, c) => s + c.baseRevenue, 0);
  const settledRevenue = MOCK_CONTRACTS.filter(c => c.status === 'settled').reduce((s, c) => s + c.baseRevenue, 0);
  const pendingRevenue = MOCK_CONTRACTS.filter(c => c.status !== 'settled').reduce((s, c) => s + c.baseRevenue, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '收益分成结算台' : 'Revenue Split & Settlement'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? 'MCN · 艺人 · 品牌方三方分成 · 合同比例管理 · 月度结算' : 'MCN · Artist · Brand 3-party split · Contract ratio · Monthly settlement'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition">
          <Plus className="w-3.5 h-3.5" />{zh ? '新建分成协议' : 'New Contract'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? '总收益池' : 'Total Revenue', value: `¥${(totalRevenue / 10000).toFixed(1)}万`, color: '#06b6d4', icon: Coins },
          { label: zh ? '已结算' : 'Settled', value: `¥${(settledRevenue / 10000).toFixed(1)}万`, color: '#22c55e', icon: CheckCircle2 },
          { label: zh ? '待结算' : 'Pending', value: `¥${(pendingRevenue / 10000).toFixed(1)}万`, color: '#f59e0b', icon: Clock },
          { label: zh ? '活跃协议' : 'Active Contracts', value: MOCK_CONTRACTS.length, color: '#a855f7', icon: FileText },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                <span className="text-[10px] text-gray-500">{k.label}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([['contracts', zh ? '分成协议' : 'Contracts'], ['payments', zh ? '支付记录' : 'Payments'], ['analytics', zh ? '分成分析' : 'Analytics']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Contracts Tab ─── */}
      {tab === 'contracts' && (
        <div className="space-y-3">
          {MOCK_CONTRACTS.map((contract, i) => {
            const sCfg = STATUS_CFG[contract.status];
            const SIcon = sCfg.icon;
            const isExpanded = expandedContract === contract.id;
            const mcnAmt = Math.round(contract.baseRevenue * contract.mcnPct / 100);
            const artistAmt = Math.round(contract.baseRevenue * contract.artistPct / 100);
            const brandAmt = Math.round(contract.baseRevenue * contract.brandPct / 100);
            return (
              <motion.div key={contract.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-gray-900/50 border rounded-xl overflow-hidden transition ${
                  contract.status === 'dispute' ? 'border-red-500/20' :
                  contract.status === 'settled' ? 'border-white/5' : 'border-amber-500/15'
                }`}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedContract(isExpanded ? null : contract.id)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sCfg.bg} border ${sCfg.border}`}>
                    <SIcon className={`w-5 h-5 ${sCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-white truncate">{contract.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                        {zh ? sCfg.zh : sCfg.en}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>{contract.period}</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-cyan-400" />{contract.mcnPct}%
                        <Star className="w-2.5 h-2.5 text-amber-400 ml-1" />{contract.artistPct}%
                        {contract.brandPct > 0 && <><Building2 className="w-2.5 h-2.5 text-purple-400 ml-1" />{contract.brandPct}%</>}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>¥{contract.baseRevenue.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-600">{zh ? '总收益池' : 'Revenue Pool'}</div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-4">
                      {/* Split breakdown */}
                      <div className="grid md:grid-cols-3 gap-3 mb-4">
                        {[
                          { party: 'mcn' as const, pct: contract.mcnPct, amount: mcnAmt },
                          { party: 'artist' as const, pct: contract.artistPct, amount: artistAmt, name: contract.artistName },
                          ...(contract.brandPct > 0 ? [{ party: 'brand' as const, pct: contract.brandPct, amount: brandAmt, name: contract.brandName }] : []),
                        ].map(({ party, pct, amount, name }) => {
                          const pCfg = PARTY_CFG[party];
                          const PIcon = pCfg.icon;
                          return (
                            <div key={party} className="bg-black/30 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <PIcon className="w-4 h-4" style={{ color: pCfg.color }} />
                                <span className="text-[10px] font-bold" style={{ color: pCfg.color }}>{zh ? pCfg.zh : pCfg.en}</span>
                                {name && <span className="text-[10px] text-gray-500">({name})</span>}
                              </div>
                              <div className="text-lg font-black" style={{ color: pCfg.color, fontFamily: 'var(--font-display)' }}>¥{amount.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-500">{pct}% {zh ? '分成' : 'split'}</div>
                              {/* Bar */}
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pCfg.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Split bar visualization */}
                      <div className="h-3 rounded-full overflow-hidden flex mb-4">
                        <div className="h-full" style={{ width: `${contract.mcnPct}%`, background: '#06b6d4' }} />
                        <div className="h-full" style={{ width: `${contract.artistPct}%`, background: '#f59e0b' }} />
                        {contract.brandPct > 0 && <div className="h-full" style={{ width: `${contract.brandPct}%`, background: '#a855f7' }} />}
                      </div>

                      <div className="flex gap-2">
                        {contract.status === 'pending' && (
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition">
                            <Coins className="w-3.5 h-3.5" />{zh ? '发起结算' : 'Initiate Settlement'}
                          </button>
                        )}
                        {contract.status === 'dispute' && (
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                            <Shield className="w-3.5 h-3.5" />{zh ? '申请仲裁' : 'Request Arbitration'}
                          </button>
                        )}
                        <button className="px-4 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 transition">
                          <Download className="w-3.5 h-3.5" />{zh ? '导出结算单' : 'Export'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Payments Tab ─── */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {MOCK_PAYMENTS.map((payment, i) => {
            const pCfg = PARTY_CFG[payment.party];
            const PIcon = pCfg.icon;
            return (
              <motion.div key={payment.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/12 transition">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pCfg.color}15` }}>
                  <PIcon className="w-4 h-4" style={{ color: pCfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white">{payment.partyName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      payment.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                      payment.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {payment.status === 'paid' ? (zh ? '已打款' : 'Paid') : payment.status === 'failed' ? (zh ? '失败' : 'Failed') : (zh ? '待打款' : 'Pending')}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">{payment.date} · {payment.method}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-black ${payment.status === 'paid' ? 'text-emerald-400' : 'text-white'}`} style={{ fontFamily: 'var(--font-display)' }}>
                    ¥{payment.amount.toLocaleString()}
                  </div>
                  {payment.status === 'paid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto mt-1" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Analytics Tab ─── */}
      {tab === 'analytics' && (
        <div className="space-y-5">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">{zh ? '三方分成月度趋势' : '3-Party Split Monthly Trend'}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_CHART} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="mcn"    name={zh ? 'MCN' : 'MCN'}        fill="#06b6d4" fillOpacity={0.8} radius={[3,3,0,0]} />
                  <Bar dataKey="artist" name={zh ? '艺人' : 'Artist'}     fill="#f59e0b" fillOpacity={0.8} radius={[3,3,0,0]} />
                  <Bar dataKey="brand"  name={zh ? '品牌方' : 'Brand'}    fill="#a855f7" fillOpacity={0.8} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 justify-center mt-2">
              {[['#06b6d4', zh ? 'MCN' : 'MCN'], ['#f59e0b', zh ? '艺人' : 'Artist'], ['#a855f7', zh ? '品牌方' : 'Brand']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-3 h-1.5 rounded-full" style={{ background: color }} />{label}
                </div>
              ))}
            </div>
          </div>

          {/* Per-artist summary */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">{zh ? '艺人收益汇总' : 'Artist Revenue Summary'}</h3>
            <div className="space-y-3">
              {MOCK_CONTRACTS.map((c, i) => {
                const artistAmt = Math.round(c.baseRevenue * c.artistPct / 100);
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Star className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white font-semibold">{c.artistName}</span>
                        <span className="text-amber-400 font-bold">¥{artistAmt.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-amber-500"
                          initial={{ width: 0 }} animate={{ width: `${(artistAmt / 120000) * 100}%` }} transition={{ delay: i * 0.1, duration: 0.8 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
