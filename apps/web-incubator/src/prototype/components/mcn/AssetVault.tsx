/**
 * AssetVault — 数字资产库
 * P0 新增页面：统一素材管理 + 版本控制 + 权限控制 + 授权校验
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Video, Image, Music, Layers, Search, Filter, Plus, Upload,
  Tag, Shield, CheckCircle2, Lock, AlertTriangle, Clock,
  Eye, Download, GitBranch, ChevronRight, Star, Cpu,
  Hash, FileText, Sparkles, Clapperboard
} from 'lucide-react';
import type { Lang } from '../../translations';
import { useQuickGen } from './quickgen/quickgenStore';

type AssetType = 'video' | 'image' | 'audio' | 'model_3d' | 'material';
type AssetStatus = 'available' | 'reviewing' | 'frozen' | 'disputed';
type AuthStatus = 'authorized' | 'expiring' | 'expired' | 'none';

interface Asset {
  id: string; title: string; type: AssetType; status: AssetStatus;
  authStatus: AuthStatus; partnerName: string; duration?: string;
  versions: number; usageCount: number; thumbColor: string;
  tags: string[]; uploadDate: string; fileSize: string; resolution?: string;
}

const MOCK_ASSETS: Asset[] = [
  { id: 'a1', title: '沈亦舟618直播回放-完整版', type: 'video', status: 'available', authStatus: 'authorized', partnerName: '沈亦舟', duration: '3:42:18', versions: 4, usageCount: 67, thumbColor: '#f59e0b', tags: ['直播', '618', '数码'], uploadDate: '2025-06-19', fileSize: '8.4 GB', resolution: '1080p' },
  { id: 'a2', title: '林音宝产品讲解视频-护肤系列', type: 'video', status: 'available', authStatus: 'authorized', partnerName: '林音宝', duration: '28:45', versions: 3, usageCount: 34, thumbColor: '#a855f7', tags: ['护肤', '开箱', '测评'], uploadDate: '2025-05-12', fileSize: '2.1 GB', resolution: '4K' },
  { id: 'a3', title: '沈亦舟形象精修-白底系列', type: 'image', status: 'available', authStatus: 'authorized', partnerName: '沈亦舟', versions: 2, usageCount: 145, thumbColor: '#06b6d4', tags: ['棚拍', '白底', '正装'], uploadDate: '2025-04-08', fileSize: '420 MB' },
  { id: 'a4', title: '林音宝标准音色训练素材-V2', type: 'audio', status: 'reviewing', authStatus: 'authorized', partnerName: '林音宝', duration: '45:00', versions: 1, usageCount: 0, thumbColor: '#ec4899', tags: ['音色', '口播', '训练集'], uploadDate: '2025-09-01', fileSize: '380 MB' },
  { id: 'a5', title: '极速数码 × 沈亦舟 品牌素材包', type: 'material', status: 'available', authStatus: 'authorized', partnerName: '极速数码品牌', versions: 5, usageCount: 213, thumbColor: '#3b82f6', tags: ['品牌', '素材包', '贴片'], uploadDate: '2025-07-20', fileSize: '1.2 GB' },
  { id: 'a6', title: '沈亦舟2024年末演唱会切片素材', type: 'video', status: 'frozen', authStatus: 'expired', partnerName: '沈亦舟', duration: '1:56:00', versions: 2, usageCount: 89, thumbColor: '#ef4444', tags: ['演唱会', '切片', '禁用'], uploadDate: '2024-12-28', fileSize: '5.8 GB', resolution: '1080p' },
  { id: 'a7', title: '林音宝3D数字人形象模型-V3', type: 'model_3d', status: 'available', authStatus: 'authorized', partnerName: '林音宝', versions: 3, usageCount: 28, thumbColor: '#10b981', tags: ['数字人', '3D', '模型'], uploadDate: '2025-08-15', fileSize: '2.3 GB' },
  { id: 'a8', title: '清洁卫士背景音乐授权包', type: 'audio', status: 'available', authStatus: 'expiring', partnerName: '清洁卫士品牌方', duration: '3:28', versions: 1, usageCount: 56, thumbColor: '#f97316', tags: ['BGM', '授权', '品牌'], uploadDate: '2025-01-10', fileSize: '48 MB' },
];

const TYPE_CFG: Record<AssetType, { zh: string; en: string; icon: React.ComponentType<any>; color: string }> = {
  video:    { zh: '视频', en: 'Video', icon: Video, color: '#06b6d4' },
  image:    { zh: '图片', en: 'Image', icon: Image, color: '#a855f7' },
  audio:    { zh: '音频', en: 'Audio', icon: Music, color: '#ec4899' },
  model_3d: { zh: '3D模型', en: '3D Model', icon: Cpu, color: '#10b981' },
  material: { zh: '素材包', en: 'Material', icon: Layers, color: '#f97316' },
};

const STATUS_CFG: Record<AssetStatus, { zh: string; en: string; color: string; bg: string; border: string }> = {
  available: { zh: '可用', en: 'Available', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  reviewing: { zh: '审核中', en: 'Reviewing', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  frozen:    { zh: '已冻结', en: 'Frozen', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
  disputed:  { zh: '争议中', en: 'Disputed', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
};

const AUTH_CFG: Record<AuthStatus, { zh: string; color: string; icon: React.ComponentType<any> }> = {
  authorized: { zh: '授权有效', color: 'text-emerald-400', icon: Shield },
  expiring:   { zh: '临期', color: 'text-amber-400', icon: AlertTriangle },
  expired:    { zh: '授权过期', color: 'text-red-400', icon: Lock },
  none:       { zh: '无授权', color: 'text-gray-500', icon: Lock },
};

interface Props { lang: Lang; }

export const AssetVault = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Everything made in 制作工坊 › AI 视频 / AI 图片 and the AI 导演台's 快速生成 lands here too.
  const { gens } = useQuickGen();
  const generated = gens.filter(g => g.status === 'done'
    && (typeFilter === 'all' || typeFilter === g.kind)
    && (statusFilter === 'all' || statusFilter === 'available')
    && g.title.toLowerCase().includes(search.toLowerCase()));
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit' });

  const filtered = MOCK_ASSETS.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.partnerName.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const stats = [
    { label: zh ? '总资产' : 'Total', value: MOCK_ASSETS.length, color: 'text-cyan-400' },
    { label: zh ? '可用' : 'Available', value: MOCK_ASSETS.filter(a => a.status === 'available').length, color: 'text-emerald-400' },
    { label: zh ? '审核中' : 'Reviewing', value: MOCK_ASSETS.filter(a => a.status === 'reviewing').length, color: 'text-amber-400' },
    { label: zh ? '已冻结' : 'Frozen', value: MOCK_ASSETS.filter(a => a.status === 'frozen').length, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '数字资产库' : 'Asset Vault'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '素材入库 · 版本管理 · 权限控制 · 授权校验' : 'Ingestion · Versioning · Access control · Auth check'}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
            <Upload className="w-3.5 h-3.5" />
            {zh ? '批量入库' : 'Batch Import'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition">
            <Plus className="w-3.5 h-3.5" />
            {zh ? '新增素材' : 'Add Asset'}
          </button>
        </div>
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

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={zh ? '搜索素材名称...' : 'Search assets...'}
            className="bg-gray-900/50 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition w-52" />
        </div>
        <div className="flex gap-1">
          {(['all', 'video', 'image', 'audio', 'model_3d', 'material'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${typeFilter === t ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/15'}`}>
              {t === 'all' ? (zh ? '全部' : 'All') : (zh ? TYPE_CFG[t].zh : TYPE_CFG[t].en)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'available', 'reviewing', 'frozen'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${statusFilter === s ? 'bg-white/10 text-white border border-white/20' : 'bg-white/3 text-gray-500 border border-white/5 hover:border-white/15'}`}>
              {s === 'all' ? (zh ? '全部状态' : 'All') : (zh ? STATUS_CFG[s].zh : STATUS_CFG[s].en)}
            </button>
          ))}
        </div>
      </div>

      {/* AI-generated, shared with the workshop and the AI Director */}
      <section className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">{zh ? 'AI 生成' : 'AI generated'}</h2>
            <span className="text-[11px] text-gray-500">{generated.length}</span>
          </div>
          <p className="text-[11px] text-gray-500">{zh ? '制作工坊 AI 视频 / AI 图片和导演台快速生成的结果自动入库，在导演台快速生成的「素材库」里可直接复用' : 'Results from AI Video / AI Image and the AI Director are filed here automatically'}</p>
        </div>
        {generated.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-gray-500">
            {gens.length ? (zh ? '没有符合筛选条件的 AI 生成素材' : 'No AI results match the filters') : (zh ? '还没有 AI 生成素材。到 制作工坊 › AI 视频 / AI 图片 生成后会出现在这里。' : 'Nothing yet — generate in Workshop › AI Video / AI Image.')}
          </div>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {generated.map(g => (
              <figure key={g.id} className="w-36 shrink-0">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black/20">
                  <img src={g.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(15,23,42,.72)', color: '#ffffff' }}>
                    {g.kind === 'video' ? <Video className="w-2.5 h-2.5" /> : <Image className="w-2.5 h-2.5" />}
                    {g.kind === 'video' ? `${zh ? '视频' : 'Video'} · ${g.duration ?? 0}s` : `${zh ? '图片' : 'Image'}${g.images.length > 1 ? ` ×${g.images.length}` : ''}`}
                  </span>
                </div>
                <figcaption className="mt-1.5 min-w-0">
                  <div className="truncate text-[11px] font-semibold text-white" title={g.title}>{g.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-gray-500">
                    {g.usedIn ? <><Clapperboard className="w-2.5 h-2.5 shrink-0" /><span className="truncate">{zh ? '已用于' : 'Used in'} {g.usedIn}</span></>
                      : <span>{fmtDate(g.createdAt)} · {g.target ? (zh ? '导演台生成' : 'AI Director') : g.kind === 'video' ? 'AI 视频' : 'AI 图片'}</span>}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((asset, i) => {
          const tCfg = TYPE_CFG[asset.type];
          const sCfg = STATUS_CFG[asset.status];
          const aCfg = AUTH_CFG[asset.authStatus];
          const TypeIcon = tCfg.icon;
          const AuthIcon = aCfg.icon;
          const isSelected = selectedAsset?.id === asset.id;
          return (
            <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedAsset(isSelected ? null : asset)}
              className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${isSelected ? 'border-purple-500/40 bg-purple-500/3' : 'border-white/5 hover:border-white/15'} ${asset.status === 'frozen' ? 'opacity-60' : ''}`}>

              {/* Thumb */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${asset.thumbColor}15`, border: `1px solid ${asset.thumbColor}30` }}>
                  <TypeIcon className="w-6 h-6" style={{ color: asset.thumbColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{asset.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{asset.partnerName}</div>
                </div>
                {asset.status === 'frozen' && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>{zh ? sCfg.zh : sCfg.en}</span>
                <span className={`text-[9px] flex items-center gap-0.5 ${aCfg.color}`}>
                  <AuthIcon className="w-2.5 h-2.5" />{aCfg.zh}
                </span>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.versions}</div>
                  <div className="text-[9px] text-gray-600">{zh ? '版本' : 'Vers.'}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.usageCount}</div>
                  <div className="text-[9px] text-gray-600">{zh ? '使用' : 'Used'}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-1.5">
                  <div className="text-[10px] font-bold text-white">{asset.fileSize}</div>
                  <div className="text-[9px] text-gray-600">{zh ? '大小' : 'Size'}</div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-500">{t}</span>
                ))}
              </div>

              {/* Expanded */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '版本记录' : 'Version History'}</div>
                    {['加水印版', '字幕版', '剪辑版', '原始版'].slice(0, asset.versions).map((v, vi) => (
                      <div key={vi} className="flex items-center justify-between text-[10px] text-gray-400 bg-black/20 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1.5"><GitBranch className="w-2.5 h-2.5" />V{asset.versions - vi} - {v}</span>
                        <div className="flex gap-2">
                          <button className="text-cyan-400 hover:text-cyan-300"><Eye className="w-3 h-3" /></button>
                          {vi === 0 && asset.status !== 'frozen' && <button className="text-purple-400 hover:text-purple-300"><Download className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    ))}
                    {asset.status === 'frozen' && (
                      <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                        <Lock className="w-3 h-3" />
                        {zh ? '该资产已冻结，请联系授权方处理后再使用' : 'Asset frozen. Contact licensor before use.'}
                      </div>
                    )}
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
