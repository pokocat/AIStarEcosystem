/**
 * InfringementPatrol — 侵权巡查中心
 * P1 新增页面：全平台自动巡查 + 疑似侵权识别 + 处置工单 + 下架追踪
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Shield, AlertTriangle, CheckCircle2, XCircle, Clock,
  Globe, Eye, FileText, ChevronRight, RefreshCw, Play, Zap,
  AlertCircle, BarChart3, Plus, Filter, ExternalLink
} from 'lucide-react';
import type { Lang } from '../../translations';

type PatrolStatus = 'scanning' | 'suspected' | 'confirmed' | 'processing' | 'resolved' | 'dismissed';
type Verdict = 'unauthorized' | 'authorized' | 'suspected' | 'unknown';

interface PatrolCase {
  id: string; title: string; platform: string; url: string;
  discoveredAt: string; verdict: Verdict; status: PatrolStatus;
  wmConfidence: number | null; wmId: string | null;
  sourceContent: string; sourcePartner: string;
  plays: number; account: string; accountFans: number;
  ticketId: string | null;
}

interface Ticket {
  id: string; caseId: string; title: string; platform: string;
  status: 'pending' | 'submitted' | 'processing' | 'resolved';
  submittedAt: string; resolvedAt: string | null; result: string | null;
}

const MOCK_CASES: PatrolCase[] = [
  {
    id: 'pc1', title: '搬运：张艺星618直播切片-极速手机', platform: 'KS', url: 'kuaishou.com/v/xxxxx1',
    discoveredAt: '2025-09-10 08:20', verdict: 'unauthorized', status: 'processing',
    wmConfidence: 89, wmId: 'WM-202506-0047', sourceContent: '张艺星618直播切片-极速数码手机开箱',
    sourcePartner: '张艺星', plays: 180000, account: '@草根剪辑工坊', accountFans: 450000,
    ticketId: 'TK-20250910-001',
  },
  {
    id: 'pc2', title: '林音宝护肤视频疑似搬运版', platform: 'DY', url: 'douyin.com/v/xxxxx2',
    discoveredAt: '2025-09-08 14:05', verdict: 'suspected', status: 'suspected',
    wmConfidence: 72, wmId: 'WM-202509-0012', sourceContent: '林音宝数字人口播-护肤精华评测版',
    sourcePartner: '林音宝', plays: 45000, account: '@美妆推荐达人', accountFans: 120000,
    ticketId: null,
  },
  {
    id: 'pc3', title: '极速数码手机测评-无授权剪辑', platform: 'XHS', url: 'xiaohongshu.com/v/xxxxx3',
    discoveredAt: '2025-09-05 22:30', verdict: 'unauthorized', status: 'resolved',
    wmConfidence: 94, wmId: 'WM-202506-0047', sourceContent: '张艺星618直播切片-极速数码手机开箱',
    sourcePartner: '张艺星', plays: 28000, account: '@数码测评控', accountFans: 80000,
    ticketId: 'TK-20250906-002',
  },
  {
    id: 'pc4', title: '清洁产品推荐视频', platform: 'BL', url: 'bilibili.com/v/xxxxx4',
    discoveredAt: '2025-09-09 10:15', verdict: 'authorized', status: 'dismissed',
    wmConfidence: 88, wmId: 'WM-202509-0011', sourceContent: '清洁卫士夏季清洁混剪',
    sourcePartner: '清洁卫士品牌方', plays: 35000, account: '@生活博主小陈', accountFans: 200000,
    ticketId: null,
  },
  {
    id: 'pc5', title: '林音宝同款好物推荐', platform: 'DY', url: 'douyin.com/v/xxxxx5',
    discoveredAt: '2025-09-11 06:45', verdict: 'suspected', status: 'suspected',
    wmConfidence: 61, wmId: null, sourceContent: '-',
    sourcePartner: '-', plays: 92000, account: '@护肤百科', accountFans: 680000,
    ticketId: null,
  },
  {
    id: 'pc6', title: '张艺星年末演唱会高清录制', platform: 'KS', url: 'kuaishou.com/v/xxxxx6',
    discoveredAt: '2025-08-20 20:10', verdict: 'unauthorized', status: 'resolved',
    wmConfidence: 97, wmId: 'WM-202412-0089', sourceContent: '张艺星2024年末演唱会切片素材',
    sourcePartner: '张艺星', plays: 620000, account: '@演唱会精彩集', accountFans: 1200000,
    ticketId: 'TK-20250821-001',
  },
];

const MOCK_TICKETS: Ticket[] = [
  { id: 'TK-20250910-001', caseId: 'pc1', title: '快手无授权搬运举报-张艺星618切片', platform: 'KS', status: 'processing', submittedAt: '2025-09-10 09:00', resolvedAt: null, result: null },
  { id: 'TK-20250906-002', caseId: 'pc3', title: '小红书未授权剪辑申诉', platform: 'XHS', status: 'resolved', submittedAt: '2025-09-06 10:30', resolvedAt: '2025-09-08 14:00', result: '平台已下架，账号警告处理' },
  { id: 'TK-20250821-001', caseId: 'pc6', title: '快手演唱会录制版权申诉', platform: 'KS', status: 'resolved', submittedAt: '2025-08-21 08:00', resolvedAt: '2025-08-24 16:00', result: '视频已删除，侵权账号被封禁' },
];

const VERDICT_CFG: Record<Verdict, { zh: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  unauthorized: { zh: '确认侵权', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: XCircle },
  authorized:   { zh: '已授权', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  suspected:    { zh: '疑似侵权', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: AlertTriangle },
  unknown:      { zh: '无法判定', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/25', icon: AlertCircle },
};

const STATUS_CFG: Record<PatrolStatus, { zh: string; color: string }> = {
  scanning:   { zh: '巡查中', color: 'text-blue-400' },
  suspected:  { zh: '待核实', color: 'text-amber-400' },
  confirmed:  { zh: '已确认', color: 'text-red-400' },
  processing: { zh: '处置中', color: 'text-purple-400' },
  resolved:   { zh: '已解决', color: 'text-emerald-400' },
  dismissed:  { zh: '已忽略', color: 'text-gray-500' },
};

const PLATFORM_COLORS: Record<string, string> = {
  DY: '#000', KS: '#ff6600', XHS: '#ff2442', BL: '#00aeec', VCH: '#07c160',
};

interface Props { lang: Lang; }

export const InfringementPatrol = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'cases' | 'tickets' | 'config'>('cases');
  const [verdictFilter, setVerdictFilter] = useState<Verdict | 'all'>('all');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const filteredCases = MOCK_CASES.filter(c =>
    verdictFilter === 'all' || c.verdict === verdictFilter
  );

  const stats = [
    { label: zh ? '本月巡查' : 'Scanned', value: '12,840', color: 'text-cyan-400', icon: Search },
    { label: zh ? '疑似侵权' : 'Suspected', value: MOCK_CASES.filter(c => c.verdict === 'suspected').length, color: 'text-amber-400', icon: AlertTriangle },
    { label: zh ? '确认侵权' : 'Confirmed', value: MOCK_CASES.filter(c => c.verdict === 'unauthorized').length, color: 'text-red-400', icon: XCircle },
    { label: zh ? '已下架处理' : 'Resolved', value: MOCK_CASES.filter(c => c.status === 'resolved').length, color: 'text-emerald-400', icon: CheckCircle2 },
  ];

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '侵权巡查中心' : 'Infringement Patrol'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '全平台自动巡查 · 水印解析溯源 · 处置工单追踪' : 'Cross-platform patrol · Watermark tracing · Ticket tracking'}</p>
        </div>
        <button onClick={handleScan}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${isScanning ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'}`}>
          {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {isScanning ? (zh ? '巡查中...' : 'Scanning...') : (zh ? '立即巡查' : 'Scan Now')}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([['cases', zh ? '巡查案例' : 'Cases'], ['tickets', zh ? '处置工单' : 'Tickets'], ['config', zh ? '巡查配置' : 'Config']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-red-400 text-red-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Cases tab */}
      {tab === 'cases' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'unauthorized', 'suspected', 'authorized'] as const).map(v => {
              const vcfg = v === 'all' ? null : VERDICT_CFG[v];
              return (
                <button key={v} onClick={() => setVerdictFilter(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${
                    verdictFilter === v
                      ? v === 'all' ? 'bg-white/10 text-white border-white/20' : `${vcfg!.bg} ${vcfg!.color} ${vcfg!.border}`
                      : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'
                  }`}>
                  {v === 'all' ? (zh ? '全部' : 'All') : (zh ? vcfg!.zh : v)}
                  <span className="bg-white/10 rounded-full px-1 text-[8px]">
                    {v === 'all' ? MOCK_CASES.length : MOCK_CASES.filter(c => c.verdict === v).length}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredCases.map((c, i) => {
            const vCfg = VERDICT_CFG[c.verdict];
            const VIcon = vCfg.icon;
            const sCfg = STATUS_CFG[c.status];
            const isExpanded = expandedCase === c.id;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-gray-900/50 border rounded-xl overflow-hidden transition ${
                  c.verdict === 'unauthorized' && c.status !== 'resolved' ? 'border-red-500/20' :
                  c.verdict === 'suspected' ? 'border-amber-500/15' : 'border-white/5'
                }`}>
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedCase(isExpanded ? null : c.id)}>
                  {/* Platform badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/5 border border-white/8">
                    <span className="text-[10px] font-black text-white">{c.platform}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-white truncate">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      <span className={`flex items-center gap-0.5 font-bold ${vCfg.color}`}>
                        <VIcon className="w-3 h-3" />{zh ? vCfg.zh : c.verdict}
                      </span>
                      {c.wmConfidence && (
                        <span className="text-gray-500">{zh ? `水印置信 ${c.wmConfidence}%` : `WM ${c.wmConfidence}%`}</span>
                      )}
                      <span className="text-gray-600">{c.account} · {(c.plays / 10000).toFixed(1)}W{zh ? '播放' : ' views'}</span>
                      <span className="text-gray-700">{c.discoveredAt}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[9px] font-bold ${sCfg.color}`}>{zh ? sCfg.zh : c.status}</span>
                    {c.ticketId && <span className="text-[9px] text-purple-400">{c.ticketId}</span>}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-4">
                      <div className="grid grid-cols-2 gap-3 mb-3 text-[10px]">
                        <div className="bg-black/20 rounded-xl p-3">
                          <div className="text-gray-600 mb-1">{zh ? '来源溯源' : 'Source Trace'}</div>
                          <div className="text-white font-semibold">{c.sourceContent}</div>
                          <div className="text-gray-500 mt-0.5">{zh ? '来源方：' : 'Partner: '}{c.sourcePartner}</div>
                          {c.wmId && <div className="text-cyan-400 font-mono mt-1">{c.wmId}</div>}
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                          <div className="text-gray-600 mb-1">{zh ? '侵权账号' : 'Infringing Account'}</div>
                          <div className="text-white font-semibold">{c.account}</div>
                          <div className="text-gray-500 mt-0.5">{(c.accountFans / 10000).toFixed(0)}W{zh ? '粉丝' : ' fans'}</div>
                          <a href="#" className="text-cyan-400 mt-1 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />{c.url}
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!c.ticketId && c.verdict !== 'authorized' && (
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                            <FileText className="w-3.5 h-3.5" />{zh ? '创建处置工单' : 'Create Ticket'}
                          </button>
                        )}
                        {c.verdict === 'suspected' && (
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition">
                            <Search className="w-3.5 h-3.5" />{zh ? '深度核查' : 'Deep Check'}
                          </button>
                        )}
                        {c.verdict === 'authorized' || c.status === 'resolved' ? (
                          <button className="px-4 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 transition">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{zh ? '已处理' : 'Handled'}
                          </button>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tickets tab */}
      {tab === 'tickets' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
              <Plus className="w-3 h-3" />{zh ? '手动创建工单' : 'Create Manually'}
            </button>
          </div>
          {MOCK_TICKETS.map((ticket, i) => (
            <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                  ticket.status === 'resolved' ? 'bg-emerald-400' :
                  ticket.status === 'processing' ? 'bg-purple-400 animate-pulse' :
                  'bg-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white">{ticket.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                      ticket.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' :
                      ticket.status === 'processing' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {ticket.status === 'resolved' ? (zh ? '已解决' : 'Resolved') :
                       ticket.status === 'processing' ? (zh ? '平台处理中' : 'Processing') :
                       (zh ? '待提交' : 'Pending')}
                    </span>
                    <span className="text-[9px] text-gray-600 ml-auto">{ticket.submittedAt}</span>
                  </div>
                  <div className="text-xs text-gray-300 mb-1">{ticket.title}</div>
                  {ticket.result && (
                    <div className="flex items-start gap-1.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-emerald-400">{ticket.result}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Config tab */}
      {tab === 'config' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Patrol platforms */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{zh ? '监控平台' : 'Monitored Platforms'}</div>
            {['DY', 'KS', 'XHS', 'VCH', 'BL', 'WB'].map(p => (
              <div key={p} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                <span className="text-sm text-white">{p}</span>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{zh ? '监控中' : 'Active'}
                  </div>
                  <div className="w-8 h-4 rounded-full bg-emerald-500/80 relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Patrol keywords */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{zh ? '巡查关键词' : 'Patrol Keywords'}</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {['张艺星', '林音宝', '极速数码手机', '618直播', '护肤精华'].map(kw => (
                <span key={kw} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1">
                  {kw}
                  <XCircle className="w-3 h-3 text-gray-600 cursor-pointer hover:text-red-400" />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder={zh ? '添加关键词...' : 'Add keyword...'}
                className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40 transition" />
              <button className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-4 text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '巡查频率' : 'Patrol Frequency'}</div>
            <div className="flex gap-2">
              {[zh ? '每小时' : 'Hourly', zh ? '每6小时' : '6h', zh ? '每日' : 'Daily'].map((freq, fi) => (
                <button key={freq} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${fi === 0 ? 'bg-red-500/10 text-red-400 border-red-500/25' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/15'}`}>{freq}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
