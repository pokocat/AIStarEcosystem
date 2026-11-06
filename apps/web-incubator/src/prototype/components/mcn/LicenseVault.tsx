/**
 * LicenseVault — 授权台账
 * P0 新增页面：合作主体档案 + 授权合同台账 + 授权范围配置
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Users, Building2, Star, Clock, CheckCircle2, AlertCircle,
  XCircle, Plus, Search, Shield, Globe, Calendar, ChevronRight,
  RefreshCw, Eye, Lock, Zap, AlertTriangle, Award, Layers
} from 'lucide-react';
import type { Lang } from '../../translations';

type PartnerType = 'celebrity' | 'brand' | 'mcn' | 'agent';
type ContractStatus = 'active' | 'expiring' | 'expired' | 'frozen' | 'draft';

interface Partner {
  id: string; name: string; type: PartnerType;
  abbr: string; contracts: number; active: number; color: string;
  contactPerson: string; contactEmail: string;
}

interface Contract {
  id: string; partnerId: string; partnerName: string;
  title: string; status: ContractStatus;
  signDate: string; startDate: string; endDate: string;
  platforms: string[]; contentTypes: string[]; accounts: number;
  usageCount: number; limit: number;
  regions: string[];
}

const MOCK_PARTNERS: Partner[] = [
  { id: 'p1', name: '宋一鸣', type: 'celebrity', abbr: 'SY', contracts: 3, active: 2, color: '#f59e0b', contactPerson: '张助理', contactEmail: 'zyx@example.com' },
  { id: 'p2', name: '林音宝', type: 'celebrity', abbr: 'LY', contracts: 2, active: 2, color: '#a855f7', contactPerson: '林经纪', contactEmail: 'lyb@example.com' },
  { id: 'p3', name: '清洁卫士品牌方', type: 'brand', abbr: 'QJ', contracts: 2, active: 1, color: '#06b6d4', contactPerson: '王总监', contactEmail: 'wj@qlean.com' },
  { id: 'p4', name: '极速数码品牌', type: 'brand', abbr: 'JS', contracts: 1, active: 1, color: '#3b82f6', contactPerson: '李市场', contactEmail: 'li@jsdigital.com' },
  { id: 'p5', name: '星联文化MCN', type: 'mcn', abbr: 'XL', contracts: 4, active: 3, color: '#10b981', contactPerson: '陈总', contactEmail: 'chen@xinglian.com' },
  { id: 'p6', name: '鑫达娱乐代理', type: 'agent', abbr: 'XD', contracts: 2, active: 1, color: '#ec4899', contactPerson: '赵负责人', contactEmail: 'zhao@xinda.com' },
];

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1', partnerId: 'p1', partnerName: '宋一鸣', title: '宋一鸣 × 清洁卫士 短视频授权协议',
    status: 'active', signDate: '2025-10-01', startDate: '2025-10-01', endDate: '2026-09-30',
    platforms: ['DY', 'KS', 'XHS'], contentTypes: ['切片', '数字人', '混剪'], accounts: 8, usageCount: 124, limit: 500, regions: ['中国大陆'],
  },
  {
    id: 'c2', partnerId: 'p1', partnerName: '宋一鸣', title: '宋一鸣 肖像直播回放切片授权',
    status: 'expiring', signDate: '2024-12-01', startDate: '2024-12-01', endDate: '2025-11-30',
    platforms: ['DY'], contentTypes: ['切片'], accounts: 3, usageCount: 312, limit: 400, regions: ['中国大陆'],
  },
  {
    id: 'c3', partnerId: 'p2', partnerName: '林音宝', title: '林音宝 AI数字人音色授权协议',
    status: 'active', signDate: '2025-08-15', startDate: '2025-09-01', endDate: '2026-08-31',
    platforms: ['DY', 'XHS', 'VCH'], contentTypes: ['数字人', '口播'], accounts: 5, usageCount: 67, limit: 300, regions: ['中国大陆', '港澳台'],
  },
  {
    id: 'c4', partnerId: 'p3', partnerName: '清洁卫士品牌方', title: '品牌内容投放授权',
    status: 'active', signDate: '2025-07-01', startDate: '2025-07-01', endDate: '2026-06-30',
    platforms: ['DY', 'KS'], contentTypes: ['混剪', '切片', '数字人'], accounts: 12, usageCount: 89, limit: 600, regions: ['中国大陆'],
  },
  {
    id: 'c5', partnerId: 'p5', partnerName: '星联文化MCN', title: '星联 MCN矩阵分发授权框架协议',
    status: 'active', signDate: '2025-01-01', startDate: '2025-01-01', endDate: '2027-12-31',
    platforms: ['DY', 'KS', 'XHS', 'VCH', 'BL'], contentTypes: ['切片', '混剪', '数字人', '直播'], accounts: 50, usageCount: 1245, limit: 5000, regions: ['中国大陆'],
  },
  {
    id: 'c6', partnerId: 'p6', partnerName: '鑫达娱乐代理', title: '鑫达代理分销内容授权',
    status: 'expired', signDate: '2024-01-01', startDate: '2024-01-01', endDate: '2024-12-31',
    platforms: ['DY'], contentTypes: ['切片'], accounts: 4, usageCount: 230, limit: 300, regions: ['中国大陆'],
  },
];

const PARTNER_TYPE_CFG: Record<PartnerType, { zh: string; en: string; icon: React.ComponentType<any>; color: string }> = {
  celebrity: { zh: '明星/大V', en: 'Celebrity', icon: Star, color: '#f59e0b' },
  brand:     { zh: '品牌方', en: 'Brand', icon: Building2, color: '#06b6d4' },
  mcn:       { zh: 'MCN机构', en: 'MCN', icon: Layers, color: '#10b981' },
  agent:     { zh: '代理方', en: 'Agent', icon: Users, color: '#ec4899' },
};

const STATUS_CFG: Record<ContractStatus, { zh: string; en: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  active:   { zh: '有效', en: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  expiring: { zh: '临期', en: 'Expiring', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle },
  expired:  { zh: '已过期', en: 'Expired', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle },
  frozen:   { zh: '已冻结', en: 'Frozen', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: Lock },
  draft:    { zh: '草稿', en: 'Draft', color: 'text-gray-500', bg: 'bg-gray-800/60', border: 'border-white/10', icon: FileText },
};

const getDaysLeft = (endDate: string) => {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

interface Props { lang: Lang; }

export const LicenseVault = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(MOCK_PARTNERS[0]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PartnerType | 'all'>('all');
  const [showNewPartner, setShowNewPartner] = useState(false);

  const filteredPartners = MOCK_PARTNERS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    return matchSearch && matchType;
  });

  const partnerContracts = MOCK_CONTRACTS.filter(c => c.partnerId === selectedPartner?.id);

  const stats = [
    { label: zh ? '合作主体' : 'Partners', value: MOCK_PARTNERS.length, color: 'text-cyan-400', icon: Users },
    { label: zh ? '有效授权' : 'Active', value: MOCK_CONTRACTS.filter(c => c.status === 'active').length, color: 'text-emerald-400', icon: CheckCircle2 },
    { label: zh ? '临期预警' : 'Expiring', value: MOCK_CONTRACTS.filter(c => c.status === 'expiring').length, color: 'text-amber-400', icon: AlertTriangle },
    { label: zh ? '已过期' : 'Expired', value: MOCK_CONTRACTS.filter(c => c.status === 'expired').length, color: 'text-red-400', icon: XCircle },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '授权台账' : 'License Vault'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '合作主体档案 · 授权合同管理 · 授权范围配置' : 'Partner profiles · Contract management · Scope config'}</p>
        </div>
        <button
          onClick={() => setShowNewPartner(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {zh ? '录入合作主体' : 'Add Partner'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const SIcon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <SIcon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-gray-500">{s.label}</span>
              </div>
              <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Main panel */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-4" style={{ minHeight: 520 }}>
        {/* Left: Partner list */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
          {/* Search + filter */}
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={zh ? '搜索合作主体...' : 'Search partners...'}
                className="w-full bg-black/30 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'celebrity', 'brand', 'mcn', 'agent'] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${typeFilter === t ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/15'}`}>
                  {t === 'all' ? (zh ? '全部' : 'All') : (zh ? PARTNER_TYPE_CFG[t].zh : PARTNER_TYPE_CFG[t].en)}
                </button>
              ))}
            </div>
          </div>

          {/* Partner list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPartners.map(p => {
              const cfg = PARTNER_TYPE_CFG[p.type];
              const PIcon = cfg.icon;
              const isSelected = selectedPartner?.id === p.id;
              return (
                <motion.button key={p.id} onClick={() => { setSelectedPartner(p); setSelectedContract(null); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${isSelected ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-black/20 border border-white/5 hover:border-white/15'}`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black"
                    style={{ background: `${p.color}20`, border: `1px solid ${p.color}40`, color: p.color }}>
                    {p.abbr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PIcon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
                      <span className="text-[10px]" style={{ color: cfg.color }}>{zh ? cfg.zh : cfg.en}</span>
                      <span className="text-[10px] text-gray-600">{p.active}/{p.contracts} {zh ? '有效' : 'active'}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Contracts */}
        <div className="flex flex-col gap-4">
          {selectedPartner ? (
            <>
              {/* Partner info bar */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                      style={{ background: `${selectedPartner.color}20`, border: `1px solid ${selectedPartner.color}40`, color: selectedPartner.color }}>
                      {selectedPartner.abbr}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{selectedPartner.name}</div>
                      <div className="text-xs text-gray-500">{zh ? '联系人：' : 'Contact: '}{selectedPartner.contactPerson} · {selectedPartner.contactEmail}</div>
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/8 text-gray-300 hover:border-white/20 transition">
                    <Plus className="w-3 h-3" />
                    {zh ? '新增合同' : 'New Contract'}
                  </button>
                </div>
              </div>

              {/* Contract list */}
              <div className="flex-1 space-y-3">
                {partnerContracts.length === 0 ? (
                  <div className="bg-gray-900/50 border border-white/5 rounded-xl p-8 text-center text-gray-600 text-sm">
                    {zh ? '暂无合同' : 'No contracts'}
                  </div>
                ) : (
                  partnerContracts.map((c, i) => {
                    const sCfg = STATUS_CFG[c.status];
                    const SIcon = sCfg.icon;
                    const daysLeft = getDaysLeft(c.endDate);
                    const usagePct = Math.round((c.usageCount / c.limit) * 100);
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition hover:border-white/15 ${selectedContract?.id === c.id ? 'border-cyan-500/30 bg-cyan-500/3' : 'border-white/5'}`}
                        onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{c.title}</div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                              <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{c.startDate} ~ {c.endDate}</span>
                              {c.status === 'expiring' && <span className="text-amber-400 font-bold">{zh ? `${daysLeft}天后到期` : `${daysLeft}d left`}</span>}
                              {c.status === 'expired' && <span className="text-red-400 font-bold">{zh ? '已过期' : 'Expired'}</span>}
                            </div>
                          </div>
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                            <SIcon className="w-3 h-3" />
                            {zh ? sCfg.zh : sCfg.en}
                          </span>
                        </div>

                        {/* Scope tags */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {c.platforms.map(p => (
                            <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">{p}</span>
                          ))}
                          {c.contentTypes.map(ct => (
                            <span key={ct} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{ct}</span>
                          ))}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">{c.accounts} {zh ? '账号' : 'accts'}</span>
                        </div>

                        {/* Usage bar */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                            <span>{zh ? '授权消耗' : 'Usage'}</span>
                            <span className={usagePct > 80 ? 'text-amber-400 font-bold' : ''}>{c.usageCount}/{c.limit} ({usagePct}%)</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-amber-400' : 'bg-cyan-500'}`}
                              style={{ width: `${Math.min(usagePct, 100)}%` }} />
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {selectedContract?.id === c.id && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">{zh ? '授权平台' : 'Platforms'}</div>
                                <div className="flex flex-wrap gap-1">
                                  {c.platforms.map(p => (
                                    <span key={p} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1">
                                      <Globe className="w-2.5 h-2.5 text-cyan-400" />{p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">{zh ? '内容形态' : 'Content Types'}</div>
                                <div className="flex flex-wrap gap-1">
                                  {c.contentTypes.map(ct => (
                                    <span key={ct} className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{ct}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">{zh ? '授权地域' : 'Regions'}</div>
                                <div className="flex flex-wrap gap-1">
                                  {c.regions.map(r => (
                                    <span key={r} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{r}</span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">{zh ? '可用账号数' : 'Accounts'}</div>
                                <div className="text-sm font-bold text-white">{c.accounts} {zh ? '个账号' : 'accounts'}</div>
                              </div>
                              <div className="col-span-2 flex gap-2">
                                {c.status === 'expiring' && (
                                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition">
                                    <RefreshCw className="w-3.5 h-3.5" />{zh ? '发起续签' : 'Renew'}
                                  </button>
                                )}
                                {c.status === 'expired' && (
                                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition">
                                    <AlertCircle className="w-3.5 h-3.5" />{zh ? '申请重新授权' : 'Re-authorize'}
                                  </button>
                                )}
                                <button className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                                  <Eye className="w-3.5 h-3.5" />{zh ? '查看合同' : 'View Contract'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 bg-gray-900/50 border border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
              {zh ? '选择合作主体查看合同' : 'Select a partner to view contracts'}
            </div>
          )}
        </div>
      </div>

      {/* Expiration alerts */}
      {MOCK_CONTRACTS.filter(c => c.status === 'expiring').length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">{zh ? '到期提醒' : 'Expiration Alerts'}</span>
          </div>
          <div className="space-y-2">
            {MOCK_CONTRACTS.filter(c => c.status === 'expiring').map(c => {
              const daysLeft = getDaysLeft(c.endDate);
              return (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{c.title}</span>
                  <span className="text-amber-400 font-bold">{zh ? `${daysLeft} 天后到期` : `${daysLeft} days left`}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};
