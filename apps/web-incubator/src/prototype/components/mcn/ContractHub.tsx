/**
 * ContractHub — 合同管理中心
 * P3 新增：合同模板库 · 签署状态追踪 · 到期日历 · 条款关键词提取
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, XCircle,
  Plus, Download, Eye, Edit3, Search, Calendar, Shield,
  FileCheck, Users, Building2, Star, ChevronRight, Filter,
  Layers, Lock, ArrowUpRight, Globe2
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type ContractStatus = 'active' | 'pending_sign' | 'expired' | 'terminated' | 'draft';
type ContractType = 'artist_mcn' | 'brand_collab' | 'platform_auth' | 'license' | 'settlement';
type PartyRole = 'mcn' | 'artist' | 'brand' | 'platform';

interface Contract {
  id: string; name: string; type: ContractType;
  parties: { role: PartyRole; name: string }[];
  status: ContractStatus; signedAt?: string;
  startAt: string; endAt: string;
  value: number; autoRenew: boolean;
  keyTerms: string[]; keyTermsEn: string[];
  attachments: number; linkedLicenses: number;
}

interface ContractTemplate {
  id: string; name: string; nameEn: string;
  type: ContractType; desc: string; descEn: string;
  usageCount: number; lastUpdated: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1', name: '张艺星MCN独家签约协议2025版', type: 'artist_mcn',
    parties: [{ role: 'mcn', name: 'MCN公司' }, { role: 'artist', name: '张艺星' }],
    status: 'active', signedAt: '2025-01-15',
    startAt: '2025-01-15', endAt: '2027-01-14',
    value: 2400000, autoRenew: true,
    keyTerms: ['独家代理', '内容版权归MCN', '艺人分成60%', '不竞争条款2年'],
    keyTermsEn: ['Exclusive agency', 'MCN owns content IP', 'Artist split 60%', '2yr non-compete'],
    attachments: 3, linkedLicenses: 12,
  },
  {
    id: 'c2', name: '林音宝护肤品牌×MCN合作协议', type: 'brand_collab',
    parties: [{ role: 'mcn', name: 'MCN公司' }, { role: 'brand', name: '护肤品牌A' }, { role: 'artist', name: '林音宝' }],
    status: 'active', signedAt: '2025-06-01',
    startAt: '2025-06-01', endAt: '2025-12-31',
    value: 480000, autoRenew: false,
    keyTerms: ['林音宝专项推广', '月均10条视频', '带货佣金5%', '授权范围：抖音+小红书'],
    keyTermsEn: ['Lin Yin Bao dedicated promo', '10 videos/month', '5% commission', 'DY+XHS license scope'],
    attachments: 2, linkedLicenses: 6,
  },
  {
    id: 'c3', name: '肖战×极速数码联名合作合同', type: 'brand_collab',
    parties: [{ role: 'artist', name: '肖战' }, { role: 'brand', name: '极速数码' }, { role: 'mcn', name: 'MCN公司' }],
    status: 'pending_sign', signedAt: undefined,
    startAt: '2025-10-01', endAt: '2026-03-31',
    value: 1200000, autoRenew: false,
    keyTerms: ['肖战本人出镜', '授权肖像使用6个月', '月固定费+带货阶梯佣金'],
    keyTermsEn: ['Xiao Zhan personal appearance', '6-month portrait license', 'Fixed fee + tiered commission'],
    attachments: 1, linkedLicenses: 0,
  },
  {
    id: 'c4', name: '平台视频授权协议-2024年度', type: 'platform_auth',
    parties: [{ role: 'mcn', name: 'MCN公司' }, { role: 'platform', name: '抖音平台' }],
    status: 'expired', signedAt: '2024-01-10',
    startAt: '2024-01-10', endAt: '2025-01-09',
    value: 0, autoRenew: false,
    keyTerms: ['内容独家上线权利', '分成比例4%', '次日到账'],
    keyTermsEn: ['Exclusive first-release rights', '4% revenue share', 'Next-day settlement'],
    attachments: 2, linkedLicenses: 38,
  },
  {
    id: 'c5', name: '林音宝短剧版权授权-护肤系列', type: 'license',
    parties: [{ role: 'artist', name: '林音宝' }, { role: 'mcn', name: 'MCN公司' }],
    status: 'active', signedAt: '2025-07-01',
    startAt: '2025-07-01', endAt: '2026-06-30',
    value: 120000, autoRenew: true,
    keyTerms: ['授权使用林音宝护肤IP', '仅限矩阵账号使用', '不可转授权'],
    keyTermsEn: ['License to use Lin Yin Bao skincare IP', 'Matrix accounts only', 'No sub-license'],
    attachments: 1, linkedLicenses: 4,
  },
];

const MOCK_TEMPLATES: ContractTemplate[] = [
  { id: 't1', name: 'MCN独家签约模板', nameEn: 'MCN Exclusive Contract Template', type: 'artist_mcn', desc: '适用于MCN与艺人的独家合作协议，包含分成、授权、不竞争条款', descEn: 'MCN-artist exclusive deal with split, license, and non-compete', usageCount: 28, lastUpdated: '2025-08-15' },
  { id: 't2', name: '品牌短期合作模板', nameEn: 'Brand Short-term Collab Template', type: 'brand_collab', desc: '品牌×艺人×MCN三方短期推广合作标准合同', descEn: '3-party brand collab standard contract', usageCount: 45, lastUpdated: '2025-09-01' },
  { id: 't3', name: '内容授权使用模板', nameEn: 'Content License Template', type: 'license', desc: '艺人内容授权给MCN矩阵账号使用的标准授权协议', descEn: 'Artist content license for MCN matrix accounts', usageCount: 62, lastUpdated: '2025-09-05' },
  { id: 't4', name: '平台入驻合作模板', nameEn: 'Platform Partnership Template', type: 'platform_auth', desc: '与各平台签订的内容入驻合作标准协议', descEn: 'Standard platform content partnership agreement', usageCount: 15, lastUpdated: '2025-07-20' },
];

const STATUS_CFG: Record<ContractStatus, { zh: string; en: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  active:       { zh: '生效中', en: 'Active',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  pending_sign: { zh: '待签署', en: 'Pending Sign', color: 'text-amber-400',  bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   icon: Clock },
  expired:      { zh: '已到期', en: 'Expired',     color: 'text-gray-500',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',    icon: XCircle },
  terminated:   { zh: '已终止', en: 'Terminated',  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: XCircle },
  draft:        { zh: '草稿',   en: 'Draft',       color: 'text-gray-600',    bg: 'bg-gray-500/5',     border: 'border-gray-500/15',    icon: Edit3 },
};

const TYPE_CFG: Record<ContractType, { zh: string; en: string; color: string; icon: React.ComponentType<any> }> = {
  artist_mcn:    { zh: '艺人签约', en: 'Artist-MCN',   color: '#f59e0b', icon: Star },
  brand_collab:  { zh: '品牌合作', en: 'Brand Collab', color: '#a855f7', icon: Building2 },
  platform_auth: { zh: '平台授权', en: 'Platform Auth', color: '#06b6d4', icon: Globe2 },
  license:       { zh: '内容授权', en: 'License',      color: '#22c55e', icon: FileCheck },
  settlement:    { zh: '结算协议', en: 'Settlement',   color: '#ec4899', icon: Layers },
};

const PARTY_CFG: Record<PartyRole, { color: string; icon: React.ComponentType<any> }> = {
  mcn:      { color: '#06b6d4', icon: Layers },
  artist:   { color: '#f59e0b', icon: Star },
  brand:    { color: '#a855f7', icon: Building2 },
  platform: { color: '#22c55e', icon: Shield },
};

interface Props { lang: Lang; }

export const ContractHub = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'contracts' | 'templates' | 'calendar'>('contracts');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = MOCK_CONTRACTS.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const expiringSoon = MOCK_CONTRACTS.filter(c => {
    if (c.status !== 'active') return false;
    const endDate = new Date(c.endAt);
    const days = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 86400));
    return days <= 90;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '合同管理中心' : 'Contract Hub'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '合同模板库 · 签署状态追踪 · 条款提取 · 到期预警' : 'Template library · Sign tracking · Term extraction · Expiry alerts'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 transition">
          <Plus className="w-3.5 h-3.5" />{zh ? '新建合同' : 'New Contract'}
        </button>
      </div>

      {/* Expiring Soon Banner */}
      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-400 flex-1">
            {zh ? `${expiringSoon.length}份合同将在90天内到期：` : `${expiringSoon.length} contracts expiring within 90 days: `}
            {expiringSoon.map(c => c.name.slice(0, 8) + '…').join(' · ')}
          </span>
          <button className="shrink-0 text-[10px] text-amber-400 border border-amber-500/25 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition">
            {zh ? '查看' : 'View'}
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: zh ? '合同总数' : 'Total', value: MOCK_CONTRACTS.length, color: '#6b7280', icon: FileText },
          { label: zh ? '生效中' : 'Active', value: MOCK_CONTRACTS.filter(c => c.status === 'active').length, color: '#22c55e', icon: CheckCircle2 },
          { label: zh ? '待签署' : 'Pending', value: MOCK_CONTRACTS.filter(c => c.status === 'pending_sign').length, color: '#f59e0b', icon: Clock },
          { label: zh ? '已到期' : 'Expired', value: MOCK_CONTRACTS.filter(c => c.status === 'expired').length, color: '#ef4444', icon: XCircle },
          { label: zh ? '关联授权' : 'Linked Licenses', value: MOCK_CONTRACTS.reduce((s, c) => s + c.linkedLicenses, 0), color: '#06b6d4', icon: FileCheck },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
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
        {([['contracts', zh ? '合同列表' : 'Contracts', FileText], ['templates', zh ? '合同模板' : 'Templates', Layers], ['calendar', zh ? '到期日历' : 'Expiry Calendar', Calendar]] as const).map(([t, label, Ic]) => {
          const TabIc = Ic;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <TabIc className="w-3.5 h-3.5" />{label}
            </button>
          );
        })}
      </div>

      {/* ─── Contracts List ─── */}
      {tab === 'contracts' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={zh ? '搜索合同...' : 'Search contracts...'}
                className="bg-white/5 border border-white/8 rounded-lg pl-7 pr-3 py-1.5 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition w-40" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'active', 'pending_sign', 'expired'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition ${statusFilter === s ? 'bg-white/10 text-white border-white/20' : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'}`}>
                  {s === 'all' ? (zh ? '全部' : 'All') : (zh ? STATUS_CFG[s].zh : STATUS_CFG[s].en)}
                </button>
              ))}
            </div>
          </div>

          {filtered.map((contract, i) => {
            const sCfg = STATUS_CFG[contract.status];
            const tCfg = TYPE_CFG[contract.type];
            const SIcon = sCfg.icon;
            const TIcon = tCfg.icon;
            const isExpanded = expandedId === contract.id;

            // Days to expiry
            const endDate = new Date(contract.endAt);
            const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 86400));
            const expiryWarning = contract.status === 'active' && daysLeft <= 90;

            return (
              <motion.div key={contract.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-gray-900/50 border rounded-xl overflow-hidden transition ${
                  expiryWarning ? 'border-amber-500/15' :
                  contract.status === 'pending_sign' ? 'border-amber-500/15' :
                  contract.status === 'expired' ? 'border-gray-500/10 opacity-70' : 'border-white/5'
                }`}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : contract.id)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sCfg.bg} border ${sCfg.border}`}>
                    <SIcon className={`w-5 h-5 ${sCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold text-white truncate">{contract.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                        {zh ? sCfg.zh : sCfg.en}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/8 text-gray-500 shrink-0" style={{ color: tCfg.color, borderColor: `${tCfg.color}25`, background: `${tCfg.color}08` }}>
                        {zh ? tCfg.zh : tCfg.en}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                      <span>{contract.parties.map(p => p.name).join(' × ')}</span>
                      <span>{contract.startAt} → {contract.endAt}</span>
                      {expiryWarning && <span className="text-amber-400 font-bold">{zh ? `还剩${daysLeft}天` : `${daysLeft}d left`}</span>}
                      {contract.linkedLicenses > 0 && (
                        <span className="flex items-center gap-0.5 text-cyan-400">
                          <FileCheck className="w-2.5 h-2.5" />{contract.linkedLicenses}{zh ? '个关联授权' : ' licenses'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {contract.value > 0 && (
                      <div className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>¥{(contract.value / 10000).toFixed(0)}万</div>
                    )}
                    <div className="text-[9px] text-gray-600">{contract.attachments}{zh ? '个附件' : ' docs'}</div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-4">
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        {/* Parties */}
                        <div>
                          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '合同当事方' : 'Parties'}</div>
                          <div className="space-y-1.5">
                            {contract.parties.map((party, pi) => {
                              const pCfg = PARTY_CFG[party.role];
                              const PIcon = pCfg.icon;
                              return (
                                <div key={pi} className="flex items-center gap-2">
                                  <PIcon className="w-3.5 h-3.5 shrink-0" style={{ color: pCfg.color }} />
                                  <span className="text-[10px] text-gray-400">{party.name}</span>
                                  <span className="text-[8px] text-gray-700 ml-auto">{party.role.toUpperCase()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Key Terms */}
                        <div>
                          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? 'AI提取关键条款' : 'AI Key Terms'}</div>
                          <div className="space-y-1">
                            {(zh ? contract.keyTerms : contract.keyTermsEn).map((term, ti) => (
                              <div key={ti} className="flex items-start gap-1.5 text-[10px] text-gray-300">
                                <ChevronRight className="w-3 h-3 text-gray-600 shrink-0 mt-0.5" />
                                {term}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                          <Eye className="w-3.5 h-3.5" />{zh ? '查看全文' : 'View Full'}
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                          <Download className="w-3.5 h-3.5" />{zh ? '下载PDF' : 'Download PDF'}
                        </button>
                        {contract.status === 'pending_sign' && (
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition">
                            <Edit3 className="w-3.5 h-3.5" />{zh ? '发起签署' : 'Send for Sign'}
                          </button>
                        )}
                        {expiryWarning && (
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition">
                            <ArrowUpRight className="w-3.5 h-3.5" />{zh ? '申请续签' : 'Request Renewal'}
                          </button>
                        )}
                        {contract.linkedLicenses > 0 && (
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition">
                            <FileCheck className="w-3.5 h-3.5" />{zh ? `查看${contract.linkedLicenses}个关联授权` : `View ${contract.linkedLicenses} licenses`}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Templates ─── */}
      {tab === 'templates' && (
        <div className="grid md:grid-cols-2 gap-4">
          {MOCK_TEMPLATES.map((tmpl, i) => {
            const tCfg = TYPE_CFG[tmpl.type];
            const TIcon = tCfg.icon;
            return (
              <motion.div key={tmpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-5 hover:border-white/15 transition group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tCfg.color}15`, border: `1px solid ${tCfg.color}25` }}>
                    <TIcon className="w-5 h-5" style={{ color: tCfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white mb-0.5">{zh ? tmpl.name : tmpl.nameEn}</div>
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block" style={{ color: tCfg.color, borderColor: `${tCfg.color}25`, background: `${tCfg.color}10` }}>
                      {zh ? tCfg.zh : tCfg.en}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed mb-4">{zh ? tmpl.desc : tmpl.descEn}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[9px] text-gray-600">
                    <span>{zh ? '使用' : 'Used'} {tmpl.usageCount} {zh ? '次' : 'times'}</span>
                    <span>{zh ? '更新' : 'Updated'} {tmpl.lastUpdated}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 transition">
                      <Eye className="w-3 h-3" />{zh ? '预览' : 'Preview'}
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition" style={{ background: `${tCfg.color}15`, border: `1px solid ${tCfg.color}30` }}>
                      <Plus className="w-3 h-3" style={{ color: tCfg.color }} />
                      <span style={{ color: tCfg.color }}>{zh ? '使用' : 'Use'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Expiry Calendar ─── */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">{zh ? '合同到期时间线' : 'Contract Expiry Timeline'}</h3>
            <div className="space-y-3">
              {[...MOCK_CONTRACTS]
                .filter(c => c.status !== 'expired' && c.status !== 'terminated')
                .sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime())
                .map((contract, i) => {
                  const tCfg = TYPE_CFG[contract.type];
                  const TIcon = tCfg.icon;
                  const sCfg = STATUS_CFG[contract.status];
                  const daysLeft = Math.ceil((new Date(contract.endAt).getTime() - Date.now()) / (1000 * 86400));
                  const urgency = daysLeft <= 30 ? 'critical' : daysLeft <= 90 ? 'warning' : 'ok';
                  return (
                    <div key={contract.id} className={`flex items-center gap-4 p-3 rounded-xl border transition ${
                      urgency === 'critical' ? 'bg-red-500/3 border-red-500/15' :
                      urgency === 'warning' ? 'bg-amber-500/3 border-amber-500/10' :
                      'bg-black/20 border-white/5'
                    }`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tCfg.color}12` }}>
                        <TIcon className="w-4 h-4" style={{ color: tCfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{contract.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{contract.parties.map(p => p.name).join(' × ')}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold" style={{ color: urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#22c55e' }}>
                          {daysLeft > 0 ? `${daysLeft}${zh ? '天' : 'd'}` : (zh ? '已到期' : 'Expired')}
                        </div>
                        <div className="text-[9px] text-gray-600">{contract.endAt}</div>
                      </div>
                      {urgency !== 'ok' && (
                        <button className="shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold border hover:bg-white/5 transition"
                          style={{ color: urgency === 'critical' ? '#ef4444' : '#f59e0b', borderColor: urgency === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)' }}>
                          {zh ? '续签' : 'Renew'}
                        </button>
                      )}
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
