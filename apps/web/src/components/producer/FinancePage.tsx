"use client";

import React, { useState } from 'react';
import {
  Wallet, TrendingUp, ArrowDownToLine, ArrowUpRight, CreditCard,
  PieChart as PieChartIcon, FileText, Clock, CheckCircle2, AlertCircle,
  DollarSign, BarChart3, Coins, Banknote, Receipt, Download
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { Lang } from "../../translations";
import { type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS } from './ArtistTypes';
import type { Transaction } from "@/types/finance";
import { REVENUE_MONTHLY, REVENUE_SOURCES, TRANSACTIONS } from "@/mocks/finance";
import { formatCredits, formatSignedCredits } from "@/lib/format";
import { toast } from "@/lib/toast";

export const FinancePage = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'overview' | 'transactions'>('overview');
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];

  const totalBalance = '¥128,500';
  const pendingAmount = '¥5,300';
  const monthlyRevenue = formatCredits(activeArtist.stats.monthlyRevenue);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '商业变现中心' : 'Monetization Center'}</h1>
          <p className="text-gray-400 font-light mt-1">
            {zh ? '多维度收益管理与财务报表' : 'Multi-dimensional revenue management'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => toast.success(zh ? '报表导出中' : 'Exporting report', { description: zh ? '下载链接已发送至邮箱' : 'Download link sent to your email' })}
            className="border-white/10 text-gray-400 gap-1 text-xs"><Download className="w-3.5 h-3.5" /> {zh ? '导出报表' : 'Export'}</Button>
          <Button
            onClick={() => toast.info(zh ? '提现申请已提交' : 'Withdrawal submitted', { description: zh ? `可用余额 ${totalBalance}，3-5 工作日到账` : `Available ${totalBalance}, arrives in 3-5 business days` })}
            className="bg-gradient-to-r from-green-500 to-cyan-500 hover:opacity-90 gap-2"><ArrowDownToLine className="w-4 h-4" /> {zh ? '提现' : 'Withdraw'}</Button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">{zh ? '可用余额' : 'Available Balance'}</div>
          <div className="text-3xl font-extrabold text-white" style={{ fontFamily: "var(--font-display)" }}>{totalBalance}</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-400"><TrendingUp className="w-3 h-3" /> +12.3% {zh ? '较上月' : 'vs last month'}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">{zh ? '待结算' : 'Pending'}</div>
          <div className="text-3xl font-extrabold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>{pendingAmount}</div>
          <div className="text-xs text-gray-500 mt-2">{zh ? '预计3-5工作日到账' : 'Est. 3-5 business days'}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">{zh ? '本月收入' : 'Monthly Revenue'}</div>
          <div className="text-3xl font-extrabold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{monthlyRevenue}</div>
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            {typeConf.icon} {zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en}
          </div>
        </motion.div>
      </div>

      {/* Monetization paths for this type */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <span className="text-lg">{typeConf.icon}</span>
          {zh ? `${ARTIST_TYPE_LABELS[activeArtist.type].zh}变现路径` : `${ARTIST_TYPE_LABELS[activeArtist.type].en} Monetization Paths`}
        </h3>
        <div className="flex flex-wrap gap-2">
          {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map((m, i) => (
            <Badge key={i} className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{m}</Badge>
          ))}
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex border border-white/10 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setTab('overview')} className={`px-5 py-2 text-xs transition ${tab === 'overview' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
          <BarChart3 className="w-3 h-3 inline mr-1" />{zh ? '收益概览' : 'Overview'}
        </button>
        <button onClick={() => setTab('transactions')} className={`px-5 py-2 text-xs transition ${tab === 'transactions' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
          <Receipt className="w-3 h-3 inline mr-1" />{zh ? '交易明细' : 'Transactions'}
        </button>
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue trend */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
            <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '收益趋势' : 'Revenue Trend'}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={REVENUE_MONTHLY}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#555" fontSize={11} />
                <YAxis stroke="#555" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [`¥${value.toLocaleString()}`, zh ? '收入' : 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#gRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue sources pie */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
            <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '收益来源分布' : 'Revenue Sources'}</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={REVENUE_SOURCES} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                    {REVENUE_SOURCES.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} formatter={(value: number, name: string) => [`${value}%`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
              {REVENUE_SOURCES.map((s, i) => (
                <span key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.name} {s.value}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {[zh ? '来源' : 'Source', zh ? '金额' : 'Amount', zh ? '日期' : 'Date', zh ? '状态' : 'Status'].map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSACTIONS.map((tx, i) => (
                <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .04 }}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tx.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5 text-green-400" /> : <ArrowDownToLine className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <span className="text-sm font-medium">{tx.source}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "var(--font-display)" }}>{formatSignedCredits(tx.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{tx.date}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] border-0 ${
                      tx.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      tx.status === 'processing' ? 'bg-cyan-500/10 text-cyan-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {tx.status === 'completed' ? (zh ? '已完成' : 'Done') : tx.status === 'processing' ? (zh ? '处理中' : 'Processing') : (zh ? '待结算' : 'Pending')}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
