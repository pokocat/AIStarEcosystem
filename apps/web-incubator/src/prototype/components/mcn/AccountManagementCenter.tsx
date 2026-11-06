/**
 * 账号管理中心 v2 — P5 emoji修复 + 成员表达式JSX修复
 * 账号绑定 · 报白申请 · 状态追踪 · 冷启动服务
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Link2, Shield, CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronRight, Zap, Search,
  Globe, Users, TrendingUp, Copy, Trash2, Bell,
  BadgeCheck, Lock, Eye, MoreHorizontal,
  Hash, BookOpen, X, AlertTriangle, Trophy,
  MessageSquare, QrCode
} from 'lucide-react';
import type { Lang } from '../../translations';

type PlatformId = 'douyin' | 'kuaishou' | 'wechat' | 'xiaohongshu' | 'bilibili' | 'weibo';
type WhitelistStatus = 'approved' | 'pending' | 'rejected' | 'supplementing' | 'unsubmitted';

interface Account {
  id: string;
  platform: PlatformId;
  handle: string;
  fans: string;
  healthScore: number;
  boundArtist: string;
  whitelist: { celebrity: string; status: WhitelistStatus; submittedAt?: string; approvedAt?: string; reason?: string }[];
  isActive: boolean;
  lastPublished?: string;
  monthlyGmv?: string;
}

// ─── Platform config (no emoji — abbr text only) ──────────────────
const PLATFORMS: Record<PlatformId, { name: string; color: string; bg: string; abbr: string }> = {
  douyin:      { name: '抖音',   color: '#ff2d55', bg: 'bg-red-500/10',    abbr: 'DY'  },
  kuaishou:    { name: '快手',   color: '#ff6600', bg: 'bg-orange-500/10', abbr: 'KS'  },
  wechat:      { name: '视频号', color: '#07c160', bg: 'bg-green-500/10',  abbr: 'VCH' },
  xiaohongshu: { name: '小红书', color: '#ff2442', bg: 'bg-red-400/10',    abbr: 'XHS' },
  bilibili:    { name: 'B站',    color: '#00a1d6', bg: 'bg-blue-500/10',   abbr: 'BL'  },
  weibo:       { name: '微博',   color: '#e6162d', bg: 'bg-red-600/10',    abbr: 'WB'  },
};

const WL_STATUS: Record<WhitelistStatus, { zh: string; en: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  approved:      { zh: '已通过', en: 'Approved',     color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  pending:       { zh: '审核中', en: 'Pending',       color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',  icon: Clock },
  rejected:      { zh: '已驳回', en: 'Rejected',      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25',      icon: XCircle },
  supplementing: { zh: '补材料', en: 'Supplementing', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25', icon: AlertCircle },
  unsubmitted:   { zh: '未提交', en: 'Unsubmitted',   color: 'text-gray-500',   bg: 'bg-white/5 border-white/10',           icon: Lock },
};

const MOCK_ACCOUNTS: Account[] = [
  {
    id: 'acc1', platform: 'douyin', handle: '@neon_v_official', fans: '128.4万',
    healthScore: 92, boundArtist: 'Neon V', isActive: true, lastPublished: '2小时前', monthlyGmv: '¥48,200',
    whitelist: [
      { celebrity: '于震', status: 'approved', approvedAt: '2026-04-15' },
      { celebrity: '肖战', status: 'pending', submittedAt: '2026-04-28' },
    ]
  },
  {
    id: 'acc2', platform: 'kuaishou', handle: '@luna_soft_ks', fans: '56.2万',
    healthScore: 78, boundArtist: 'Luna Soft', isActive: true, lastPublished: '1天前', monthlyGmv: '¥22,800',
    whitelist: [
      { celebrity: '杨幂', status: 'pending', submittedAt: '2026-04-30' },
    ]
  },
  {
    id: 'acc3', platform: 'xiaohongshu', handle: '@project_zero_xhs', fans: '23.7万',
    healthScore: 85, boundArtist: 'Project Zero', isActive: true, lastPublished: '3天前', monthlyGmv: '¥11,500',
    whitelist: [
      { celebrity: '王一博', status: 'rejected', submittedAt: '2026-04-10', reason: '账号粉丝量不足要求（需>50万）' },
      { celebrity: '于震', status: 'unsubmitted' },
    ]
  },
  {
    id: 'acc4', platform: 'wechat', handle: '@neonv_channel', fans: '18.9万',
    healthScore: 67, boundArtist: 'Neon V', isActive: false,
    whitelist: [
      { celebrity: '肖战', status: 'supplementing', submittedAt: '2026-04-20', reason: '需补充：MCN机构授权证明' },
    ]
  },
  {
    id: 'acc5', platform: 'bilibili', handle: '@luna_soft_bili', fans: '8.3万',
    healthScore: 71, boundArtist: 'Luna Soft', isActive: true, lastPublished: '5天前',
    whitelist: []
  },
];

// ─── Cold-start cards (Lucide icons, no emoji) ────────────────────
interface ColdCard {
  title: { zh: string; en: string };
  icon: React.ComponentType<any>;
  color: string;
  tag: { zh: string; en: string };
  items: { zh: string[]; en: string[] };
}
const COLD_CARDS: ColdCard[] = [
  {
    title: { zh: '官方渠道加速', en: 'Official Channel Boost' },
    icon: Trophy, color: '#22c55e', tag: { zh: '完全合规', en: 'Fully Compliant' },
    items: { zh: ['申报新号扶持计划', 'DOU+付费推广（¥50起）', '达人互推合作（免费）', '直播挂车白名单申请'], en: ['Apply new account support', 'DOU+ paid promotion (¥50+)', 'Creator cross-promotion (free)', 'Live cart whitelist application'] }
  },
  {
    title: { zh: '平台官方工具', en: 'Platform Official Tools' },
    icon: Zap, color: '#06b6d4', tag: { zh: '推荐使用', en: 'Recommended' },
    items: { zh: ['星币购买SC500投流包', 'AI推荐最优发布时间', '热门话题标签助手', '账号健康度优化建议'], en: ['Star coins SC500 boost pack', 'AI optimal publish time', 'Trending hashtag assistant', 'Account health optimizer'] }
  },
  {
    title: { zh: '专属顾问私域', en: 'Private Advisor Channel' },
    icon: MessageSquare, color: '#a855f7', tag: { zh: '个性方案', en: 'Custom Solution' },
    items: { zh: ['扫码联系专属运营顾问', '提供个性化冷启动策略', '私域内1对1方案规划', '风险由用户自行评估'], en: ['Scan QR to contact advisor', 'Personalized cold-start strategy', 'Private 1-on-1 planning', 'User assumes own risk assessment'] }
  }
];

const HealthBar = ({ score }: { score: number }) => {
  const color = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 0.6 }} style={{ background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
};

export const AccountManagementCenter = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'accounts' | 'whitelist' | 'coldstart'>('accounts');
  const [searchQ, setSearchQ] = useState('');
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [whitelistModalAccount, setWhitelistModalAccount] = useState<Account | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const filtered = MOCK_ACCOUNTS.filter(a =>
    a.handle.toLowerCase().includes(searchQ.toLowerCase()) || a.boundArtist.toLowerCase().includes(searchQ.toLowerCase())
  );
  const totalPending = MOCK_ACCOUNTS.flatMap(a => a.whitelist).filter(w => w.status === 'pending').length;
  const totalApproved = MOCK_ACCOUNTS.flatMap(a => a.whitelist).filter(w => w.status === 'approved').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '账号管理中心' : 'Account Management'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{zh ? '账号绑定 · 报白申请 · 授权状态追踪' : 'Account binding · Whitelist · Authorization tracking'}</p>
        </div>
        <button onClick={() => setBindModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
          <Plus className="w-4 h-4" />{zh ? '绑定新账号' : 'Bind Account'}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: { zh: '已绑定账号', en: 'Bound Accounts' }, value: MOCK_ACCOUNTS.length, color: '#06b6d4', icon: Link2 },
          { label: { zh: '活跃账号', en: 'Active Accounts' }, value: MOCK_ACCOUNTS.filter(a => a.isActive).length, color: '#22c55e', icon: CheckCircle2 },
          { label: { zh: '报白通过', en: 'Whitelist OK' }, value: totalApproved, color: '#a855f7', icon: BadgeCheck },
          { label: { zh: '待审核', en: 'Pending Review' }, value: totalPending, color: '#f59e0b', icon: Clock },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <KIcon className="w-4 h-4" style={{ color: k.color }} />
                <span className="text-[10px] text-gray-500">{zh ? k.label.zh : k.label.en}</span>
              </div>
              <div className="text-2xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1 w-fit">
        {[
          { id: 'accounts', zh: '账号列表', en: 'Accounts' },
          { id: 'whitelist', zh: '报白状态', en: 'Whitelist Status' },
          { id: 'coldstart', zh: '冷启动服务', en: 'Cold Start' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${tab === t.id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
            {zh ? t.zh : t.en}
          </button>
        ))}
      </div>

      {/* Tab: Accounts */}
      {tab === 'accounts' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder={zh ? '搜索账号或艺人...' : 'Search account or artist...'}
              className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-4 text-sm text-white placeholder-gray-600 focus:border-purple-500/30 focus:outline-none transition" />
          </div>

          <div className="space-y-2">
            {filtered.map((acc, i) => {
              const plat = PLATFORMS[acc.platform];
              const isExpanded = expandedAccount === acc.id;
              return (
                <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition">
                  <button onClick={() => setExpandedAccount(isExpanded ? null : acc.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    {/* Platform abbr badge (no emoji) */}
                    <div className={`w-10 h-10 rounded-xl ${plat.bg} border border-white/5 flex items-center justify-center shrink-0`}>
                      <span className="text-[10px] font-black" style={{ color: plat.color }}>{plat.abbr}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{acc.handle}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${plat.color}20`, color: plat.color }}>{plat.name}</span>
                        {!acc.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-500">休眠</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{acc.fans}</span>
                        <span>{zh ? '绑定：' : 'Artist: '}{acc.boundArtist}</span>
                        {acc.monthlyGmv && <span className="text-green-400">GMV {acc.monthlyGmv}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 space-y-1.5 w-28">
                      <HealthBar score={acc.healthScore} />
                      <div className="flex flex-wrap gap-1 justify-end">
                        {acc.whitelist.slice(0, 2).map((w, j) => {
                          const cfg = WL_STATUS[w.status];
                          return (
                            <span key={j} className={`text-[8px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                              {w.celebrity} {zh ? cfg.zh : cfg.en}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5">
                        <div className="p-4 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-400">{zh ? '报白状态' : 'Whitelist Status'}</span>
                              <button onClick={() => setWhitelistModalAccount(acc)}
                                className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition">
                                <Plus className="w-3 h-3" />{zh ? '申请新报白' : 'Apply Whitelist'}
                              </button>
                            </div>
                            {acc.whitelist.length === 0 ? (
                              <div className="text-[10px] text-gray-600">{zh ? '暂无报白记录' : 'No whitelist records'}</div>
                            ) : (
                              <div className="space-y-2">
                                {acc.whitelist.map((w, j) => {
                                  const cfg = WL_STATUS[w.status];
                                  const CfgIcon = cfg.icon;
                                  return (
                                    <div key={j} className={`flex items-start gap-3 p-2.5 rounded-xl border ${cfg.bg}`}>
                                      <CfgIcon className={`w-3.5 h-3.5 ${cfg.color} shrink-0 mt-0.5`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold text-white">{w.celebrity}</span>
                                          <span className={`text-[9px] font-bold ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</span>
                                        </div>
                                        {w.reason && <div className="text-[9px] text-amber-400 mt-0.5">{w.reason}</div>}
                                        {w.approvedAt && <div className="text-[9px] text-gray-600">通过：{w.approvedAt}</div>}
                                        {w.submittedAt && !w.approvedAt && <div className="text-[9px] text-gray-600">提交：{w.submittedAt}</div>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                            <div className="p-2 bg-black/20 rounded-lg">
                              <div className="text-gray-600 mb-0.5">{zh ? '最近发布' : 'Last Post'}</div>
                              <div className="text-white">{acc.lastPublished ?? zh ? '无记录' : 'No record'}</div>
                            </div>
                            <div className="p-2 bg-black/20 rounded-lg">
                              <div className="text-gray-600 mb-0.5">{zh ? '健康度' : 'Health'}</div>
                              <div className="text-white font-bold">{acc.healthScore}</div>
                            </div>
                            <div className="p-2 bg-black/20 rounded-lg">
                              <div className="text-gray-600 mb-0.5">{zh ? '状态' : 'Status'}</div>
                              <div className={acc.isActive ? 'text-green-400' : 'text-gray-500'}>{acc.isActive ? (zh ? '活跃' : 'Active') : (zh ? '休眠' : 'Dormant')}</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Whitelist Overview */}
      {tab === 'whitelist' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(WL_STATUS) as [WhitelistStatus, typeof WL_STATUS[WhitelistStatus]][]).map(([key, cfg]) => {
              const count = MOCK_ACCOUNTS.flatMap(a => a.whitelist).filter(w => w.status === key).length;
              const CfgIcon = cfg.icon;
              return (
                <div key={key} className={`flex flex-col gap-1 p-3 rounded-xl border ${cfg.bg}`}>
                  <CfgIcon className={`w-4 h-4 ${cfg.color}`} />
                  <div className={`text-xl font-black ${cfg.color}`}>{count}</div>
                  <div className="text-[9px] text-gray-600">{zh ? cfg.zh : cfg.en}</div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{zh ? '待处理事项' : 'Action Required'}</div>
            {MOCK_ACCOUNTS.flatMap(acc => acc.whitelist.filter(w => ['pending', 'rejected', 'supplementing'].includes(w.status)).map(w => ({ acc, w }))).map(({ acc, w }, i) => {
              const cfg = WL_STATUS[w.status];
              const plat = PLATFORMS[acc.platform];
              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
                  <div className={`${plat.bg} w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/5`}>
                    <span className="text-[9px] font-black" style={{ color: plat.color }}>{plat.abbr}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{acc.handle}</div>
                    <div className="text-[10px] text-gray-500">{zh ? '申请明星：' : 'Celebrity: '}<span className="text-white">{w.celebrity}</span></div>
                    {w.reason && <div className="text-[9px] text-amber-400 mt-0.5">{w.reason}</div>}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</span>
                  {w.status === 'pending' && (
                    <button className="text-[10px] text-amber-400 px-2.5 py-1.5 rounded-lg border border-amber-500/25 hover:bg-amber-500/10 transition whitespace-nowrap">
                      {zh ? '加急（¥299）' : 'Rush ¥299'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Cold Start */}
      {tab === 'coldstart' && (
        <div className="space-y-5">
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-400">{zh ? '带货挂链粉丝要求提示' : 'Commerce Link Follower Requirement'}</div>
                <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {zh ? '抖音/快手/小红书需粉丝≥1000才可挂商品链接，视频号无硬性要求。以下提供合规冷启动加速方案。' : 'Douyin/Kuaishou/XHS require ≥1000 followers to add product links. WeChat Video has no hard requirement. Compliant cold-start solutions below.'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {COLD_CARDS.map((card, i) => {
              const CardIcon = card.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="p-5 rounded-2xl border border-white/8 bg-gray-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${card.color}15` }}>
                        <CardIcon className="w-4 h-4" style={{ color: card.color }} />
                      </div>
                      <span className="text-sm font-bold text-white">{zh ? card.title.zh : card.title.en}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${card.color}20`, color: card.color }}>
                      {zh ? card.tag.zh : card.tag.en}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {(zh ? card.items.zh : card.items.en).map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-400">
                        <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: card.color }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full h-9 rounded-xl text-xs font-semibold transition border"
                    style={{ borderColor: `${card.color}30`, color: card.color, background: `${card.color}08` }}>
                    {zh ? '了解详情' : 'Learn More'}
                  </button>
                </motion.div>
              );
            })}
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-start gap-3 text-[10px] text-gray-600 leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
            <span>
              {zh
                ? '平台立场：本平台不直接提供任何违规增粉服务。第三方服务由用户自行联系，本平台不对其服务质量及法律风险负责。建议优先使用官方渠道合规增长。'
                : 'Platform Disclaimer: This platform does not provide any follower manipulation services. Third-party services are user-initiated and we bear no responsibility for their quality or legal risks. We recommend official compliant growth channels first.'}
            </span>
          </div>
        </div>
      )}

      {/* Bind Modal */}
      <AnimatePresence>
        {bindModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setBindModalOpen(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{zh ? '绑定新账号' : 'Bind New Account'}</h3>
                <button onClick={() => setBindModalOpen(false)} className="text-gray-500 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-gray-500 mb-2">{zh ? '选择平台' : 'Select Platform'}</div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(PLATFORMS) as [PlatformId, typeof PLATFORMS[PlatformId]][]).map(([id, p]) => (
                    <button key={id} className="p-3 rounded-xl border border-white/8 hover:border-white/20 transition flex flex-col items-center gap-1.5">
                      <span className="text-xs font-black" style={{ color: p.color }}>{p.abbr}</span>
                      <span className="text-[10px] text-gray-400">{p.name}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-2 space-y-2">
                  <input placeholder={zh ? '账号Handle（如：@username）' : 'Account handle (e.g., @username)'}
                    className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:border-purple-500/30 focus:outline-none transition" />
                  <select className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option value="">{zh ? '绑定到哪位AI艺人？' : 'Bind to which AI artist?'}</option>
                    <option>Neon V</option><option>Luna Soft</option><option>Project Zero</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setBindModalOpen(false)}
                  className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button onClick={() => setBindModalOpen(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                  <QrCode className="w-4 h-4" />{zh ? '扫码绑定' : 'Bind via QR'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountManagementCenter;
