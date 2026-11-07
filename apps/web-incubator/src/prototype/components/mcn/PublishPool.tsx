/**
 * PublishPool — 发布池
 * P0 新增页面：授权+水印+质检三灯前置校验 + 多平台账号矩阵排期 + 发布状态追踪
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, CheckCircle2, XCircle, Clock, AlertTriangle, Play, Plus,
  Search, Shield, Lock, Zap, ChevronDown, Filter, Video, Globe,
  Calendar, Users, BarChart3, Eye, RefreshCw, ArrowDown, X
} from 'lucide-react';
import type { Lang } from '../../translations';
import { POOL_EVENT, readPool } from './publishPoolStore';

type PoolStatus = 'pending_review' | 'approved_pending' | 'scheduled' | 'publishing' | 'published' | 'taken_down';

interface PreCheck {
  auth: boolean | null;
  watermark: boolean | null;
  quality: boolean | null;
}

interface PoolItem {
  id: string; title: string; type: 'clip' | 'digital_person' | 'mix' | 'director';
  partnerName: string; platform: string; account: string;
  status: PoolStatus; scheduledAt: string; publishedAt?: string;
  preCheck: PreCheck; duration: string;
  plays?: number; likes?: number; comments?: number;
  thumbColor: string;
  thumbImage?: string;
}

const MOCK_ITEMS: PoolItem[] = [
  {
    id: 'pp1', title: '沈亦舟618直播切片-极速数码手机开箱', type: 'clip', partnerName: '沈亦舟',
    platform: 'DY', account: '@沈亦舟美妆好物', status: 'published',
    scheduledAt: '2025-06-21 18:00', publishedAt: '2025-06-21 18:00:03',
    preCheck: { auth: true, watermark: true, quality: true }, duration: '1:12',
    plays: 450000, likes: 28600, comments: 3200, thumbColor: '#f59e0b',
  },
  {
    id: 'pp2', title: '林音宝数字人口播-护肤精华评测版', type: 'digital_person', partnerName: '林音宝',
    platform: 'XHS', account: '@林音宝护肤日记', status: 'scheduled',
    scheduledAt: '2025-09-12 12:00',
    preCheck: { auth: true, watermark: true, quality: true }, duration: '0:58', thumbColor: '#a855f7',
  },
  {
    id: 'pp3', title: '清洁卫士夏季清洁混剪-多款产品展示', type: 'mix', partnerName: '清洁卫士品牌方',
    platform: 'KS', account: '@生活妙招分享', status: 'approved_pending',
    scheduledAt: '2025-09-13 09:00',
    preCheck: { auth: true, watermark: true, quality: true }, duration: '0:45', thumbColor: '#06b6d4',
  },
  {
    id: 'pp4', title: '沈亦舟采访切片-年度规划精华', type: 'clip', partnerName: '沈亦舟',
    platform: 'DY', account: '@沈亦舟工作室', status: 'pending_review',
    scheduledAt: '2025-09-15 20:00',
    preCheck: { auth: true, watermark: false, quality: null }, duration: '1:30', thumbColor: '#f59e0b',
  },
  {
    id: 'pp5', title: '林音宝日常Vlog混剪-护肤晨间routine', type: 'mix', partnerName: '林音宝',
    platform: 'VCH', account: '@林音宝生活', status: 'pending_review',
    scheduledAt: '2025-09-14 15:00',
    preCheck: { auth: true, watermark: true, quality: false }, duration: '2:15', thumbColor: '#a855f7',
  },
  {
    id: 'pp6', title: '极速数码旗舰手机-沈亦舟测评合集', type: 'mix', partnerName: '沈亦舟',
    platform: 'DY', account: '@数码好物推荐', status: 'taken_down',
    scheduledAt: '2024-12-25 19:00', publishedAt: '2024-12-25 19:00:11',
    preCheck: { auth: false, watermark: true, quality: true }, duration: '3:48',
    plays: 89000, likes: 4200, comments: 560, thumbColor: '#ef4444',
  },
  {
    id: 'pp7', title: '沈亦舟618直播切片-金句合集', type: 'clip', partnerName: '沈亦舟',
    platform: 'XHS', account: '@沈亦舟粉丝团', status: 'publishing',
    scheduledAt: '2025-06-22 10:00',
    preCheck: { auth: true, watermark: true, quality: true }, duration: '0:36', thumbColor: '#f59e0b',
  },
];

const STATUS_CFG: Record<PoolStatus, { zh: string; en: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  pending_review:  { zh: '待审', en: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: Clock },
  approved_pending:{ zh: '已审待排', en: 'Approved', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', icon: CheckCircle2 },
  scheduled:       { zh: '排期中', en: 'Scheduled', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', icon: Calendar },
  publishing:      { zh: '发布中', en: 'Publishing', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', icon: RefreshCw },
  published:       { zh: '已发布', en: 'Published', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: Globe },
  taken_down:      { zh: '已下架', en: 'Taken Down', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: X },
};

const TYPE_CFG = {
  clip: { zh: '切片', en: 'Clip', color: '#ec4899' },
  digital_person: { zh: '数字人', en: 'Digital', color: '#10b981' },
  mix: { zh: '混剪', en: 'Mix', color: '#f97316' },
  director: { zh: 'AI 导演', en: 'AI Director', color: '#8b5cf6' },
};

const ALL_STATUSES: PoolStatus[] = ['pending_review', 'approved_pending', 'scheduled', 'publishing', 'published', 'taken_down'];

const PreCheckLight = ({ passed, label, zh }: { passed: boolean | null; label: string; zh: boolean }) => (
  <div className="flex items-center gap-1">
    <div className={`w-2 h-2 rounded-full ${passed === true ? 'bg-emerald-400' : passed === false ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}`} />
    <span className={`text-[9px] ${passed === true ? 'text-emerald-400' : passed === false ? 'text-red-400' : 'text-gray-600'}`}>{label}</span>
  </div>
);

interface Props { lang: Lang; }

export const PublishPool = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [statusFilter, setStatusFilter] = useState<PoolStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Works exported from the AI 导演台 come first, ahead of the sample items.
  const [external, setExternal] = useState(readPool);
  useEffect(() => {
    const sync = () => setExternal(readPool());
    window.addEventListener(POOL_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(POOL_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const items: PoolItem[] = [...external, ...MOCK_ITEMS];

  const filtered = items.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.partnerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts: Record<PoolStatus, number> = {} as any;
  ALL_STATUSES.forEach(s => { statusCounts[s] = items.filter(i => i.status === s).length; });

  const stats = [
    { label: zh ? '待审' : 'Pending', value: statusCounts.pending_review, color: 'text-amber-400' },
    { label: zh ? '已审待排' : 'Approved', value: statusCounts.approved_pending + statusCounts.scheduled, color: 'text-blue-400' },
    { label: zh ? '已发布' : 'Published', value: statusCounts.published, color: 'text-emerald-400' },
    { label: zh ? '已下架' : 'Taken Down', value: statusCounts.taken_down, color: 'text-red-400' },
  ];

  const allPassed = (preCheck: PreCheck) => preCheck.auth && preCheck.watermark && preCheck.quality;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '发布池' : 'Publish Pool'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '三灯前置校验 · 账号矩阵排期 · 发布追踪 · 下架管控' : '3-light pre-check · Matrix scheduling · Tracking · Takedown'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition">
          <Plus className="w-3.5 h-3.5" />
          {zh ? '添加至发布池' : 'Add to Pool'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* 3-light system legend */}
      <div className="flex items-center gap-4 p-3 bg-gray-900/40 border border-white/5 rounded-xl text-[10px]">
        <span className="text-gray-600">{zh ? '入池前置校验：' : 'Pre-check:'}</span>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-emerald-400">{zh ? '授权有效' : 'Auth valid'}</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-emerald-400">{zh ? '水印已嵌入' : 'Watermarked'}</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-emerald-400">{zh ? '质检通过' : 'QC passed'}</span></div>
        <span className="text-gray-600 ml-2">{zh ? '三灯全绿才可排期发布' : 'All 3 green required to schedule'}</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['all', ...ALL_STATUSES] as const).map(s => {
          const scfg = s === 'all' ? null : STATUS_CFG[s];
          const count = s === 'all' ? items.length : statusCounts[s];
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${
                statusFilter === s
                  ? s === 'all' ? 'bg-white/10 text-white border-white/20' : `${scfg!.bg} ${scfg!.color} ${scfg!.border}`
                  : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'
              }`}>
              {s === 'all' ? (zh ? '全部' : 'All') : (zh ? scfg!.zh : scfg!.en)}
              <span className="bg-white/10 text-white/60 rounded-full px-1.5 py-0.5 text-[8px]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={zh ? '搜索发布池内容...' : 'Search pool items...'}
          className="w-full bg-gray-900/50 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition" />
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filtered.map((item, i) => {
          const sCfg = STATUS_CFG[item.status];
          const SIcon = sCfg.icon;
          const tCfg = TYPE_CFG[item.type];
          const isExpanded = expandedId === item.id;
          const checkPassed = allPassed(item.preCheck);
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`bg-gray-900/50 border rounded-xl overflow-hidden transition ${
                !checkPassed && item.status === 'pending_review' ? 'border-red-500/20' :
                item.status === 'taken_down' ? 'border-white/5 opacity-60' :
                isExpanded ? 'border-blue-500/25' : 'border-white/5'
              }`}>
              <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                {/* Thumb */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: `${item.thumbColor}12`, border: `1px solid ${item.thumbColor}25` }}>
                  {item.thumbImage ? <img src={item.thumbImage} alt="" className="w-full h-full object-cover" /> : <Video className="w-5 h-5" style={{ color: item.thumbColor }} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* 3-light check */}
                    <div className="flex items-center gap-2">
                      <PreCheckLight passed={item.preCheck.auth} label={zh ? '授权' : 'Auth'} zh={zh} />
                      <PreCheckLight passed={item.preCheck.watermark} label={zh ? '水印' : 'WM'} zh={zh} />
                      <PreCheckLight passed={item.preCheck.quality} label={zh ? '质检' : 'QC'} zh={zh} />
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${tCfg.color}15`, color: tCfg.color }}>{zh ? tCfg.zh : tCfg.en}</span>
                    <span className="text-[10px] text-gray-500">{item.partnerName}</span>
                    <span className="text-[10px] text-gray-600">{item.platform} · {item.account}</span>
                    <span className="text-[10px] text-gray-600">{item.duration}</span>
                  </div>
                </div>

                {/* Status + time */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                    <SIcon className={`w-2.5 h-2.5 ${item.status === 'publishing' ? 'animate-spin' : ''}`} />
                    {zh ? sCfg.zh : sCfg.en}
                  </span>
                  <span className="text-[9px] text-gray-600">{item.scheduledAt}</span>
                </div>
              </div>

              {/* Expanded */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 px-3.5 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Pre-check details */}
                      {!checkPassed && (
                        <div className="flex-1 flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          <div className="text-[10px] text-red-400">
                            {!item.preCheck.watermark && <div>{zh ? '水印未嵌入，请先完成水印嵌入再排期发布' : 'Watermark missing. Please embed watermark before scheduling.'}</div>}
                            {item.preCheck.quality === false && <div>{zh ? '质检未通过，请重新制作或修改后重新质检' : 'QC failed. Please revise and recheck.'}</div>}
                          </div>
                        </div>
                      )}
                      {/* Actions */}
                      <div className="flex gap-2 ml-auto">
                        {item.status === 'published' && (
                          <div className="flex items-center gap-3 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-cyan-400" />{(item.plays || 0).toLocaleString()}</span>
                            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-purple-400" />{(item.likes || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {checkPassed && item.status === 'approved_pending' && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                            <Calendar className="w-3 h-3" />{zh ? '设置排期' : 'Schedule'}
                          </button>
                        )}
                        {item.status === 'published' && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                            <X className="w-3 h-3" />{zh ? '申请下架' : 'Take Down'}
                          </button>
                        )}
                        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                        </button>
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
  );
};
