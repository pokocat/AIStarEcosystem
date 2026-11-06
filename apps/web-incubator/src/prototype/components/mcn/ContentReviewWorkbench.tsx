/**
 * 内容审核工作台 · 4级状态机
 * GRN 绿区 · YLW 黄区 · ORG 橙区 · RED 红区
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, Clock,
  Play, Eye, ThumbsUp, ThumbsDown, RotateCcw, Search,
  Filter, ChevronDown, Video, Image, Mic2, FileText,
  ArrowRight, Info, Zap, Users, BarChart3, Download,
  Edit3, MessageSquare, AlertCircle, Lock, Unlock, RefreshCw
} from 'lucide-react';
import type { Lang } from '../../translations';

type ReviewZone = 'green' | 'yellow' | 'orange' | 'red';
type ContentType = 'clip' | 'live_clip' | 'graphic' | 'voiceover' | 'avatar';
type ReviewStatus = 'approved' | 'pending' | 'rejected' | 'flagged' | 'appealing';

interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  zone: ReviewZone;
  status: ReviewStatus;
  celebrity?: string;
  platform: string;
  account: string;
  duration?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  reason?: string;
  views?: number;
  riskTags: string[];
  thumbnail: string;
}

const ZONE_CFG: Record<ReviewZone, {
  zh: string; en: string; icon: string; color: string; bg: string;
  border: string; textColor: string; desc: { zh: string; en: string };
}> = {
  green:  { zh: '绿区', en: 'Green', icon: 'GRN', color: '#22c55e', bg: 'bg-green-500/8',  border: 'border-green-500/20',  textColor: 'text-green-400',  desc: { zh: '官方授权切片，可直接发布使用', en: 'Official authorized clips, publish directly' } },
  yellow: { zh: '黄区', en: 'Yellow',icon: 'YLW', color: '#eab308', bg: 'bg-yellow-500/8', border: 'border-yellow-500/20', textColor: 'text-yellow-400', desc: { zh: '剪辑重组/AI字幕，需确认合规性声明', en: 'Edited/AI subtitles, compliance declaration required' } },
  orange: { zh: '橙区', en: 'Orange',icon: 'ORG', color: '#f97316', bg: 'bg-orange-500/8', border: 'border-orange-500/20', textColor: 'text-orange-400', desc: { zh: 'AI配音合成，需平台人工审核通过', en: 'AI voice synthesis, manual platform review required' } },
  red:    { zh: '红区', en: 'Red',   icon: 'RED', color: '#ef4444', bg: 'bg-red-500/8',    border: 'border-red-500/20',    textColor: 'text-red-400',    desc: { zh: 'AI形象/声音创作，需专属授权包，强合规风险', en: 'AI avatar/voice creation, exclusive authorization required, high risk' } },
};

const STATUS_CFG: Record<ReviewStatus, { zh: string; en: string; color: string; bg: string; icon: any }> = {
  approved:  { zh: '已通过', en: 'Approved',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  icon: CheckCircle2 },
  pending:   { zh: '审核中', en: 'Pending',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',  icon: Clock },
  rejected:  { zh: '已驳回', en: 'Rejected',  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25',      icon: XCircle },
  flagged:   { zh: '已标记', en: 'Flagged',   color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25',icon: AlertTriangle },
  appealing: { zh: '申诉中', en: 'Appealing', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25',   icon: RotateCcw },
};

const TYPE_CFG: Record<ContentType, { zh: string; en: string; icon: any; color: string }> = {
  clip:       { zh: '切片视频', en: 'Clip',       icon: Video,    color: '#a855f7' },
  live_clip:  { zh: '直播切片', en: 'Live Clip',  icon: Play,     color: '#ef4444' },
  graphic:    { zh: '图文',    en: 'Graphic',    icon: Image,    color: '#06b6d4' },
  voiceover:  { zh: 'AI配音',  en: 'Voiceover',  icon: Mic2,     color: '#f59e0b' },
  avatar:     { zh: 'AI形象',  en: 'AI Avatar',  icon: Users,    color: '#ec4899' },
};

const MOCK_ITEMS: ContentItem[] = [
  {
    id: 'c1', title: '于震《亮剑》高光切片·战术刀具带货', type: 'clip', zone: 'green', status: 'approved',
    celebrity: '于震', platform: '抖音', account: '@neon_v_official', duration: '1:32',
    submittedAt: '2026-05-06 14:30', reviewedAt: '2026-05-06 15:10', reviewer: '系统自动',
    views: 128000, riskTags: [],
    thumbnail: 'https://images.unsplash.com/photo-1533001104778-31cb0f7ebe2e?w=200&q=60',
  },
  {
    id: 'c2', title: '肖战同款护肤·AI字幕重剪版', type: 'clip', zone: 'yellow', status: 'pending',
    celebrity: '肖战', platform: '快手', account: '@luna_soft_ks', duration: '0:58',
    submittedAt: '2026-05-07 09:15', riskTags: ['AI字幕', '剪辑重组'],
    thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&q=60',
  },
  {
    id: 'c3', title: '杨幂AI声音·护肤品口播版', type: 'voiceover', zone: 'orange', status: 'pending',
    celebrity: '杨幂', platform: '小红书', account: '@project_zero_xhs', duration: '2:10',
    submittedAt: '2026-05-07 08:00', riskTags: ['AI语音合成', '需平台审核'],
    thumbnail: 'https://images.unsplash.com/photo-1596029658179-ddca27260f25?w=200&q=60',
  },
  {
    id: 'c4', title: '王一博AI虚拟形象·球鞋宣传', type: 'avatar', zone: 'red', status: 'rejected',
    celebrity: '王一博', platform: '视频号', account: '@neonv_channel', duration: '0:30',
    submittedAt: '2026-05-05 22:00', reviewedAt: '2026-05-06 10:30', reviewer: '合规团队',
    reason: '未持有AI形象授权包，禁止使用AI虚拟形象商用',
    riskTags: ['AI形象', '无授权包', '高风险'],
    thumbnail: 'https://images.unsplash.com/photo-1616693629937-fa0aba64d094?w=200&q=60',
  },
  {
    id: 'c5', title: '于震古装剧直播切片·茶叶推荐', type: 'live_clip', zone: 'green', status: 'approved',
    celebrity: '于震', platform: '抖音', account: '@neon_v_official', duration: '3:45',
    submittedAt: '2026-05-04 16:00', reviewedAt: '2026-05-04 16:45', reviewer: '系统自动',
    views: 89000, riskTags: [],
    thumbnail: 'https://images.unsplash.com/photo-1627484986786-f4d2c04e3f08?w=200&q=60',
  },
  {
    id: 'c6', title: '肖战同款腕表·AI配音脚本', type: 'voiceover', zone: 'orange', status: 'flagged',
    celebrity: '肖战', platform: '微博', account: '@neon_official', duration: '1:18',
    submittedAt: '2026-05-03 11:00', reviewedAt: '2026-05-03 14:20', reviewer: '人工审核',
    reason: '配音音色相似度超过85%，需补充明星方声音授权证明',
    riskTags: ['AI配音', '高相似度', '待补材料'],
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=60',
  },
  {
    id: 'c7', title: '杨幂时尚穿搭·图文种草版', type: 'graphic', zone: 'yellow', status: 'approved',
    celebrity: '杨幂', platform: '小红书', account: '@project_zero_xhs',
    submittedAt: '2026-05-02 10:00', reviewedAt: '2026-05-02 10:30', reviewer: '系统自动',
    views: 34000, riskTags: ['品牌植入声明'],
    thumbnail: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=200&q=60',
  },
];

const RISK_RULES = [
  { zone: 'green' as ReviewZone,  rules: { zh: ['直接使用官方授权的切片素材', '不修改原始音轨', '不替换明星声音', '挂商品链接合规'], en: ['Use official authorized clip materials', 'Do not modify original audio', 'No voice replacement', 'Compliant product links'] } },
  { zone: 'yellow' as ReviewZone, rules: { zh: ['允许剪辑拼接授权素材', 'AI字幕须标注为AI生成', '不合成明星声音', '需在发布页声明AI辅助'], en: ['Can splice authorized clips', 'AI subtitles must be labeled', 'No voice synthesis', 'Declare AI assistance on publish'] } },
  { zone: 'orange' as ReviewZone, rules: { zh: ['AI声音须符合授权协议音色限制', '需平台合规团队审核', '声音相似度<80%', '需明星方授权额外证明'], en: ['AI voice must comply with agreement limits', 'Requires compliance team review', 'Voice similarity <80%', 'Celebrity additional proof required'] } },
  { zone: 'red' as ReviewZone,    rules: { zh: ['必须持有AI形象/声音授权包', '需平台+明星双审核', '商用场景需独立授权协议', '违规触发违约金条款'], en: ['Must hold AI avatar/voice authorization pack', 'Platform + celebrity dual review required', 'Commercial use needs independent agreement', 'Violation triggers penalty clause'] } },
];

export const ContentReviewWorkbench = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [activeZone, setActiveZone] = useState<ReviewZone | 'all'>('all');
  const [activeStatus, setActiveStatus] = useState<ReviewStatus | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const filtered = MOCK_ITEMS.filter(item => {
    if (activeZone !== 'all' && item.zone !== activeZone) return false;
    if (activeStatus !== 'all' && item.status !== activeStatus) return false;
    if (searchQ && !item.title.includes(searchQ) && !item.celebrity?.includes(searchQ)) return false;
    return true;
  });

  const zoneCounts = (Object.keys(ZONE_CFG) as ReviewZone[]).reduce((acc, z) => {
    acc[z] = MOCK_ITEMS.filter(i => i.zone === z).length;
    return acc;
  }, {} as Record<ReviewZone, number>);

  const pendingCount = MOCK_ITEMS.filter(i => i.status === 'pending').length;
  const rejectedCount = MOCK_ITEMS.filter(i => i.status === 'rejected').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '内容审核工作台' : 'Content Review Workbench'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{zh ? '4级合规状态机 · 内容风险管控 · 审核追踪' : '4-Level compliance state machine · Risk control · Review tracking'}</p>
        </div>
        <button onClick={() => setRulesOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/8 text-sm text-gray-400 hover:border-white/20 hover:text-white transition">
          <Shield className="w-4 h-4" />{zh ? '查看合规规则' : 'Compliance Rules'}
        </button>
      </div>

      {/* Alert strip */}
      {(pendingCount > 0 || rejectedCount > 0) && (
        <div className="flex items-center gap-3 p-3.5 bg-amber-500/8 border border-amber-500/20 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-400 font-semibold">
            {zh
              ? `${pendingCount}条内容待审核，${rejectedCount}条已驳回需处理`
              : `${pendingCount} items pending review, ${rejectedCount} rejected items need action`}
          </span>
        </div>
      )}

      {/* 4-Zone overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(ZONE_CFG) as [ReviewZone, typeof ZONE_CFG[ReviewZone]][]).map(([zone, cfg]) => (
          <button key={zone} onClick={() => setActiveZone(activeZone === zone ? 'all' : zone)}
            className={`p-4 rounded-2xl border text-left transition ${activeZone === zone ? `${cfg.bg} ${cfg.border}` : 'border-white/5 hover:border-white/10 bg-gray-900/30'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{cfg.icon}</span>
              <span className="text-[9px] text-gray-600">{zh ? '内容数' : 'Items'}</span>
            </div>
            <div className={`text-2xl font-black ${cfg.textColor}`}>{zoneCounts[zone]}</div>
            <div className={`text-xs font-bold mt-0.5 ${cfg.textColor}`}>{zh ? cfg.zh : cfg.en}</div>
            <div className="text-[9px] text-gray-600 mt-1 leading-tight">{zh ? cfg.desc.zh : cfg.desc.en}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder={zh ? '搜索内容/明星...' : 'Search content/celebrity...'}
            className="h-9 w-44 bg-white/[0.03] border border-white/8 rounded-xl pl-8 pr-3 text-xs text-white placeholder-gray-600 focus:border-purple-500/30 focus:outline-none transition" />
        </div>
        <div className="flex gap-1">
          {(Object.entries(STATUS_CFG) as [ReviewStatus, any][]).map(([status, cfg]) => {
            const count = MOCK_ITEMS.filter(i => i.status === status).length;
            return (
              <button key={status} onClick={() => setActiveStatus(activeStatus === status ? 'all' : status)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition ${activeStatus === status ? `${cfg.bg} ${cfg.color}` : 'border-white/8 text-gray-500 hover:border-white/15'}`}>
                <cfg.icon className="w-3 h-3" />{zh ? cfg.zh : cfg.en} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content list */}
      <div className="space-y-2">
        {filtered.map((item, i) => {
          const zCfg = ZONE_CFG[item.zone];
          const sCfg = STATUS_CFG[item.status];
          const tCfg = TYPE_CFG[item.type];
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 p-3.5 rounded-xl border ${item.status === 'pending' ? 'border-amber-500/15 bg-amber-500/3' : 'border-white/5 bg-gray-900/40'} hover:border-white/10 transition cursor-pointer group`}
              onClick={() => setDetailItem(item)}>
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                <div className={`absolute top-0.5 left-0.5 text-[8px] font-black px-1 py-0.5 rounded-sm`}
                  style={{ background: `${zCfg.color}25`, color: zCfg.color }}>{zh ? zCfg.zh : zCfg.en}</div>
                {item.duration && <div className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 rounded px-1">{item.duration}</div>}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{item.title}</span>
                  {item.celebrity && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 shrink-0">STR {item.celebrity}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-0.5" style={{ color: tCfg.color }}><tCfg.icon className="w-2.5 h-2.5" />{zh ? tCfg.zh : tCfg.en}</span>
                  <span>{item.platform} · {item.account}</span>
                  <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{item.submittedAt}</span>
                  {item.views && <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5 text-cyan-400" />{(item.views / 10000).toFixed(1)}万</span>}
                </div>
                {item.riskTags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {item.riskTags.map(tag => (
                      <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15">{tag}</span>
                    ))}
                  </div>
                )}
                {item.reason && <div className="text-[9px] text-red-400 mt-1">WRN {item.reason}</div>}
              </div>
              {/* Status + actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${sCfg.bg} ${sCfg.color}`}>
                  <sCfg.icon className="w-3 h-3" />{zh ? sCfg.zh : sCfg.en}
                </span>
                {item.status === 'rejected' && (
                  <button className="text-[9px] text-purple-400 border border-purple-500/25 rounded-lg px-2 py-1 hover:bg-purple-500/10 transition">
                    {zh ? '申诉' : 'Appeal'}
                  </button>
                )}
                {item.status === 'pending' && (
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"><ThumbsUp className="w-3 h-3" /></button>
                    <button className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"><ThumbsDown className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {detailItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setDetailItem(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
              <div className="p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{detailItem.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                      <span>{detailItem.platform} · {detailItem.account}</span>
                      {detailItem.celebrity && <span className="text-purple-400">STR {detailItem.celebrity}</span>}
                    </div>
                  </div>
                  <button onClick={() => setDetailItem(null)} className="text-gray-500 hover:text-white p-1.5">✕</button>
                </div>

                {/* Zone & Status badges */}
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const zCfg = ZONE_CFG[detailItem.zone];
                    const sCfg = STATUS_CFG[detailItem.status];
                    return (
                      <>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${zCfg.bg} ${zCfg.border} border ${zCfg.textColor}`}>
                          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: zCfg.color }} />{zh ? zCfg.zh : zCfg.en}
                        </span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1 ${sCfg.bg} ${sCfg.color}`}>
                          <sCfg.icon className="w-3.5 h-3.5" />{zh ? sCfg.zh : sCfg.en}
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Zone rules */}
                {(() => {
                  const rule = RISK_RULES.find(r => r.zone === detailItem.zone);
                  const zCfg = ZONE_CFG[detailItem.zone];
                  if (!rule) return null;
                  return (
                    <div className={`p-4 rounded-xl ${zCfg.bg} border ${zCfg.border}`}>
                      <div className={`text-xs font-bold ${zCfg.textColor} mb-2`}>{zh ? `${zCfg.zh}合规要求` : `${zCfg.en} Zone Rules`}</div>
                      <ul className="space-y-1.5">
                        {(zh ? rule.rules.zh : rule.rules.en).map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: zCfg.color }} />{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Risk tags */}
                {detailItem.riskTags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 mb-2">{zh ? '风险标记' : 'Risk Tags'}</div>
                    <div className="flex flex-wrap gap-2">
                      {detailItem.riskTags.map(t => (
                        <span key={t} className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {detailItem.reason && (
                  <div className="p-3.5 bg-red-500/8 border border-red-500/20 rounded-xl text-xs text-red-400 leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />{detailItem.reason}
                  </div>
                )}

                {/* Review timeline */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-400">{zh ? '审核记录' : 'Review Timeline'}</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-white">{zh ? '内容提交' : 'Content Submitted'}</span>
                      <span className="ml-auto">{detailItem.submittedAt}</span>
                    </div>
                    {detailItem.reviewedAt && (
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className={`w-2 h-2 rounded-full ${detailItem.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-white">{detailItem.reviewer} {zh ? '完成审核' : 'Review Completed'}</span>
                        <span className="ml-auto">{detailItem.reviewedAt}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {detailItem.status === 'rejected' && (
                    <button className="flex-1 h-10 rounded-xl text-sm font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition">
                      {zh ? '提交申诉' : 'Submit Appeal'}
                    </button>
                  )}
                  {detailItem.status === 'pending' && (
                    <>
                      <button className="flex-1 h-10 rounded-xl text-sm font-bold bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition">
                        {zh ? '通过审核' : 'Approve'}
                      </button>
                      <button className="flex-1 h-10 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">
                        {zh ? '驳回' : 'Reject'}
                      </button>
                    </>
                  )}
                  <button onClick={() => setDetailItem(null)} className="flex-1 h-10 rounded-xl text-sm border border-white/8 text-gray-400 hover:text-white transition">
                    {zh ? '关闭' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compliance Rules Modal */}
      <AnimatePresence>
        {rulesOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setRulesOpen(false)}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  {zh ? '4级内容合规规则体系' : '4-Level Content Compliance Rules'}
                </h3>
                <button onClick={() => setRulesOpen(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                {RISK_RULES.map(({ zone, rules }) => {
                  const cfg = ZONE_CFG[zone];
                  return (
                    <div key={zone} className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{cfg.icon}</span>
                        <div>
                          <div className={`text-sm font-bold ${cfg.textColor}`}>{zh ? cfg.zh : cfg.en}</div>
                          <div className="text-[10px] text-gray-500">{zh ? cfg.desc.zh : cfg.desc.en}</div>
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {(zh ? rules.zh : rules.en).map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: cfg.color }} />{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-gray-600 leading-relaxed border-t border-white/5 pt-4">
                {zh ? '本规则体系依据平台与明星方授权协议制定，如有疑问请联系合规团队或查阅用户协议第7章节。' : 'Rules based on platform & celebrity authorization agreements. For questions, contact the compliance team or refer to User Agreement Chapter 7.'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContentReviewWorkbench;
