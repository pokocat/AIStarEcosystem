"use client";

import React, { useEffect, useState } from 'react';
import {
  LogOut,
  Globe as GlobeIcon,
  Shield,
  ChevronRight,
  TrendingUp,
  Users,
  Send,
  Menu,
  X,
  Building2,
  Plus,
  Coins,
} from 'lucide-react';
import { AccountApi } from "@/api";
import type { Wallet } from "@/types/wallet";
import { formatCredits } from "@/lib/format";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme, themeConfig } from "./ThemeProvider";
import type { Lang } from "../translations";
import type {
  CoachArtistFilter,
  CoachPage,
} from "@/types/coach";
import {
  CategoryDist,
  CoachRevenueData,
  CopyrightPending,
  DistributionQueue,
  SignedArtists,
} from "@/mocks/coach";
import {
  COACH_ARTIST_FILTERS,
  COACH_ARTIST_FILTER_LABELS,
  COACH_REVENUE_LEGEND,
  COACH_SETTINGS_ROWS,
  COACH_SIDEBAR_ITEMS,
  COPYRIGHT_STATUS_COLORS,
  COPYRIGHT_STATUS_LABELS,
  DISTRIBUTION_STATUS_BORDER_COLORS,
  DISTRIBUTION_STATUS_COLORS,
  DISTRIBUTION_STATUS_LABELS,
  DISTRIBUTION_TYPE_ICONS,
  SIGNED_ARTIST_STATUS_COLORS,
  SIGNED_ARTIST_STATUS_LABELS,
} from "@/constants/coach-ui";
import { usePageParam } from "@/lib/use-page-param";

export const CoachDashboardFull = ({ onLogout, lang, setLang }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const zh = lang === 'zh';
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const [activePage, setActivePage] = usePageParam<CoachPage>('overview');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [artistFilter, setArtistFilter] = useState<CoachArtistFilter>('all');
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => { if (!cancelled) setWallet(w); })
      .catch(() => { /* 钱包未开通 */ });
    return () => { cancelled = true; };
  }, []);

  const filteredArtists = artistFilter === 'all' ? SignedArtists : SignedArtists.filter(a => a.status === artistFilter);

  const sidebarContent = (isMobile = false) => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <Building2 className="w-6 h-6 text-purple-400 shrink-0" />
        <span className="text-base font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>发行机构</span>
        {isMobile && <button onClick={() => setMobileSidebar(false)} className="ml-auto"><X className="w-5 h-5 text-gray-400" /></button>}
      </div>
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center text-sm">🏢</div>
          <div>
            <div className="text-sm font-semibold">星际娱乐</div>
            <div className="text-[10px] text-gray-500">白金发行商</div>
          </div>
        </div>
      </div>
      <div className="flex-1 px-3 py-3 space-y-0.5">
        {COACH_SIDEBAR_ITEMS.map(item => (
          <button key={item.id} onClick={() => { setActivePage(item.id); if (isMobile) setMobileSidebar(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activePage === item.id ? themeStyles.itemActive : themeStyles.itemBase
            }`}>
            <item.icon className="w-[18px] h-[18px]" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="px-3 py-3 border-t border-white/5">
        <button onClick={onLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut className="w-[18px] h-[18px]" />
          <span className="font-medium">返回首页</span>
        </button>
      </div>
    </>
  );

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return renderOverview();
      case 'artists': return renderArtists();
      case 'distribution': return renderDistribution();
      case 'finance': return renderFinance();
      case 'copyright': return renderCopyright();
      case 'settings': return renderSettings();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>发行总览</h1>
        <p className="text-gray-400 font-light mt-1">全局业务数据一览</p>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '签约艺人', value: SignedArtists.length, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10', change: '+2' },
          { label: '月总营收', value: '¥755K', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', change: '+15.2%' },
          { label: '发行内容', value: '190', icon: Send, color: 'text-pink-400', bg: 'bg-pink-500/10', change: '+23' },
          { label: '版权资产', value: '86', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10', change: '+8' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <span className="text-xs text-green-400 font-medium">{s.change}</span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div className="text-xs text-gray-500 font-light mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>
      {/* Revenue chart + top artists */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>营收趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={CoachRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#555" fontSize={11} />
              <YAxis stroke="#555" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              {COACH_REVENUE_LEGEND.map(l => (
                <Bar key={l.dataKey} dataKey={l.dataKey} fill={l.color} radius={[2, 2, 0, 0]} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-[10px]">
            {COACH_REVENUE_LEGEND.map((x, i) => (
              <span key={i} className="flex items-center gap-1 text-gray-400"><div className="w-2 h-2 rounded-full" style={{ background: x.color }} />{x.label}</span>
            ))}
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>TOP 艺人</h3>
          <div className="space-y-3">
            {SignedArtists.slice(0, 4).sort((a, b) => parseInt(b.totalRevenue.replace(/[¥,]/g, '')) - parseInt(a.totalRevenue.replace(/[¥,]/g, ''))).map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .08 }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition">
                <span className={`text-xs font-extrabold w-5 ${i < 3 ? 'text-amber-400' : 'text-gray-500'}`}>{i + 1}</span>
                <img src={a.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{a.name}</div>
                  <div className="text-[10px] text-gray-500">{a.typeIcon} {a.monthlyRevenue}/mo</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {/* Distribution queue preview */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>发行队列</h3>
          <Button variant="ghost" size="sm" onClick={() => setActivePage('distribution')} className="text-purple-400 hover:bg-purple-500/10 text-xs">查看全部 <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </div>
        <div className="space-y-2">
          {DistributionQueue.slice(0, 3).map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .05 }}
              className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/10 transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center text-xs">{DISTRIBUTION_TYPE_ICONS[item.type]}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{item.title}</div>
                  <div className="text-[10px] text-gray-500">{item.artist} · {item.platforms} 平台</div>
                </div>
              </div>
              <Badge className={`text-[10px] border-0 ${DISTRIBUTION_STATUS_COLORS[item.status]}`}>{DISTRIBUTION_STATUS_LABELS[item.status]}</Badge>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderArtists = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>签约艺人管理</h1>
          <p className="text-gray-400 font-light mt-1">管理所有签约AI艺人的合同与收益</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90 gap-2"><Plus className="w-4 h-4" /> 签约新艺人</Button>
      </div>
      <div className="flex gap-2">
        {COACH_ARTIST_FILTERS.map(f => (
          <button key={f} onClick={() => setArtistFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition ${artistFilter === f ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5'}`}>
            {COACH_ARTIST_FILTER_LABELS[f]}
          </button>
        ))}
      </div>
      <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['艺人', '类型', 'MCN', '状态', '月营收', '分成率', '合同到期'].map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredArtists.map((a, i) => (
                <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .04 }}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={a.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                      <div>
                        <div className="text-sm font-semibold">{a.name}</div>
                        <div className="text-[10px] text-gray-500">{a.fans} 粉丝</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm"><span className="mr-1">{a.typeIcon}</span>{a.type}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{a.mcn}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] border-0 ${SIGNED_ARTIST_STATUS_COLORS[a.status]}`}>
                      {SIGNED_ARTIST_STATUS_LABELS[a.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{a.monthlyRevenue}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{a.royaltyRate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.contractEnd}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDistribution = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>发行队列</h1>
          <p className="text-gray-400 font-light mt-1">审核、批准并分发内容至全球平台</p>
        </div>
      </div>
      <div className="space-y-3">
        {DistributionQueue.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-lg">{DISTRIBUTION_TYPE_ICONS[item.type]}</div>
                <div>
                  <div className="text-sm font-bold">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.artist} · {item.date}</div>
                </div>
              </div>
              <Badge className={`text-xs border ${DISTRIBUTION_STATUS_BORDER_COLORS[item.status]}`}>{DISTRIBUTION_STATUS_LABELS[item.status]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">{item.platforms} 个目标平台</div>
              <div className="flex gap-2">
                {item.status === 'reviewing' && (
                  <>
                    <Button size="sm" className="bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs h-7 px-3">批准</Button>
                    <Button size="sm" variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs h-7 px-3">驳回</Button>
                  </>
                )}
                {item.status === 'approved' && (
                  <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-600 text-xs h-7 px-3 gap-1"><Send className="w-3 h-3" /> 开始分发</Button>
                )}
                {item.status === 'distributing' && (
                  <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-cyan-400">75%</span></div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>财务中心</h1>
        <p className="text-gray-400 font-light mt-1">全平台收益汇总与分成管理</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">本月总营收</div>
          <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>¥755,000</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-400"><TrendingUp className="w-3 h-3" /> +15.2%</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">分成收入 (15%)</div>
          <div className="text-3xl font-extrabold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>¥113,250</div>
          <div className="text-xs text-gray-500 mt-2">平均分成率: 15%</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <div className="text-xs text-gray-400 mb-1">待结算</div>
          <div className="text-3xl font-extrabold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>¥28,500</div>
          <div className="text-xs text-gray-500 mt-2">预计下周结算</div>
        </motion.div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>收益来源</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CategoryDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {CategoryDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {CategoryDist.map((s, i) => (
              <span key={i} className="text-[10px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.name} {s.value}%</span>
            ))}
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>艺人营收排行</h3>
          <div className="space-y-3">
            {[...SignedArtists].sort((a, b) => parseInt(b.totalRevenue.replace(/[¥,]/g, '')) - parseInt(a.totalRevenue.replace(/[¥,]/g, ''))).map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className={`text-xs font-extrabold w-5 ${i < 3 ? 'text-amber-400' : 'text-gray-500'}`}>{i + 1}</span>
                <img src={a.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{a.name}</div>
                  <Progress value={parseInt(a.totalRevenue.replace(/[¥,]/g, '')) / 10000} className="h-1 mt-1" />
                </div>
                <span className="text-xs text-cyan-400 font-semibold" style={{ fontFamily: "var(--font-display)" }}>{a.totalRevenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCopyright = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>版权审核</h1>
        <p className="text-gray-400 font-light mt-1">审核并管理所有签约艺人的版权申请</p>
      </div>
      <div className="space-y-3">
        {CopyrightPending.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-green-400" /></div>
                <div>
                  <div className="text-sm font-bold">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.artist} · {item.type} · 提交: {item.submitted}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`text-xs border-0 ${COPYRIGHT_STATUS_COLORS[item.status]}`}>
                  {COPYRIGHT_STATUS_LABELS[item.status]}
                </Badge>
                {item.status === 'pending' && (
                  <Button size="sm" className="bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs h-7 px-3">审核</Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>机构设置</h1>
      </div>
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 space-y-5">
        {COACH_SETTINGS_ROWS.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-white/5">
            <div><div className="text-sm font-semibold">{item.label}</div><div className="text-xs text-gray-500 mt-0.5">{item.value}</div></div>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400 text-xs">修改</Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex bg-black text-white overflow-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      {/* Sidebar desktop */}
      <aside className={`hidden md:flex flex-col w-[240px] ${themeStyles.bg} border-r ${themeStyles.border} shrink-0`}>{sidebarContent()}</aside>
      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileSidebar(false)} className="md:hidden fixed inset-0 bg-black/60 z-40" />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: "spring", damping: 25 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 w-[240px] ${themeStyles.bg} border-r ${themeStyles.border} z-50 flex flex-col`}>{sidebarContent(true)}</motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/5 bg-black/50 backdrop-blur-lg shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)}><Menu className="w-5 h-5 text-gray-400" /></button>
            <div className="text-sm text-gray-500 font-light">{COACH_SIDEBAR_ITEMS.find(i => i.id === activePage)?.label}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300 tabular-nums">
                {wallet ? formatCredits(wallet.totalBalance) : '—'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLang(zh ? 'en' : 'zh')} className="hover:bg-white/10 text-gray-400"><GlobeIcon className="w-4 h-4 mr-1" /> {zh ? 'EN' : '中'}</Button>
            <div className="flex items-center gap-2 bg-white/[0.03] rounded-full px-3 py-1"><Building2 className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400">星际娱乐</span></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
