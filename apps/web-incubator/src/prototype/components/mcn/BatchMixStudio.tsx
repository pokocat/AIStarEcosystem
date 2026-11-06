/**
 * BatchMixStudio — 混剪批量生产台
 * P1 新增页面：模板管理 + 素材矩阵组合 + 批量渲染 + 一键入发布池
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, Play, Plus, Search, CheckCircle2, Clock, Zap,
  Video, Image, Music, ChevronRight, BarChart3, Upload,
  RefreshCw, Eye, Copy, Trash2, Settings, FileText,
  Grid3X3, List, ArrowRight
} from 'lucide-react';
import type { Lang } from '../../translations';

type TemplateType = 'product_review' | 'lifestyle' | 'tutorial' | 'highlight' | 'story';
type RenderStatus = 'pending' | 'rendering' | 'done' | 'failed';

interface MixTemplate {
  id: string; name: string; type: TemplateType; duration: string;
  platforms: string[]; slots: number; description: string;
  usageCount: number; successRate: number; color: string;
}

interface BatchTask {
  id: string; name: string; templateId: string; templateName: string;
  totalCount: number; completedCount: number; failedCount: number;
  status: RenderStatus; startedAt: string; estimatedDone: string | null;
  partnerName: string;
}

interface MixSlot {
  id: string; label: string; type: 'video' | 'image' | 'text' | 'audio';
  filled: boolean; content?: string;
}

const MOCK_TEMPLATES: MixTemplate[] = [
  {
    id: 'mt1', name: '产品测评标准模板', type: 'product_review', duration: '0:45-1:20',
    platforms: ['DY', 'KS', 'XHS'], slots: 6, color: '#06b6d4',
    description: '开箱展示 → 功能讲解 → 使用感受 → 购买引导',
    usageCount: 234, successRate: 92,
  },
  {
    id: 'mt2', name: '生活方式情景混剪', type: 'lifestyle', duration: '1:00-2:00',
    platforms: ['XHS', 'DY'], slots: 8, color: '#ec4899',
    description: '日常场景拼接 + 产品自然植入 + BGM节奏感',
    usageCount: 156, successRate: 88,
  },
  {
    id: 'mt3', name: '教程步骤分解', type: 'tutorial', duration: '2:00-4:00',
    platforms: ['DY', 'BL'], slots: 10, color: '#f59e0b',
    description: '步骤拆分 + 字幕引导 + 重点放大 + 成果展示',
    usageCount: 89, successRate: 94,
  },
  {
    id: 'mt4', name: '精彩片段集锦', type: 'highlight', duration: '0:30-0:60',
    platforms: ['DY', 'KS', 'XHS', 'VCH'], slots: 5, color: '#a855f7',
    description: '直播/活动高光 + 节奏剪切 + 动感配乐',
    usageCount: 412, successRate: 90,
  },
  {
    id: 'mt5', name: '故事线条漫', type: 'story', duration: '0:15-0:30',
    platforms: ['DY', 'XHS'], slots: 4, color: '#10b981',
    description: '短故事结构 + 悬念设置 + 情感共鸣',
    usageCount: 67, successRate: 85,
  },
];

const MOCK_TASKS: BatchTask[] = [
  {
    id: 'bt1', name: '张艺星×极速数码-产品测评-9月矩阵', templateId: 'mt1', templateName: '产品测评标准模板',
    totalCount: 20, completedCount: 18, failedCount: 1, status: 'rendering',
    startedAt: '2025-09-11 10:00', estimatedDone: '2025-09-11 12:30', partnerName: '张艺星',
  },
  {
    id: 'bt2', name: '林音宝护肤精华-生活情景-8月批次', templateId: 'mt2', templateName: '生活方式情景混剪',
    totalCount: 15, completedCount: 15, failedCount: 0, status: 'done',
    startedAt: '2025-08-25 14:00', estimatedDone: '2025-08-25 16:00', partnerName: '林音宝',
  },
  {
    id: 'bt3', name: '清洁卫士-精彩集锦-全平台', templateId: 'mt4', templateName: '精彩片段集锦',
    totalCount: 30, completedCount: 0, failedCount: 0, status: 'pending',
    startedAt: '-', estimatedDone: null, partnerName: '清洁卫士品牌方',
  },
];

const TYPE_CFG: Record<TemplateType, { zh: string; en: string }> = {
  product_review: { zh: '产品测评', en: 'Product Review' },
  lifestyle:      { zh: '生活方式', en: 'Lifestyle' },
  tutorial:       { zh: '教程', en: 'Tutorial' },
  highlight:      { zh: '精彩集锦', en: 'Highlights' },
  story:          { zh: '故事线', en: 'Story' },
};

const RENDER_STATUS_CFG: Record<RenderStatus, { zh: string; color: string; bg: string; border: string }> = {
  pending:   { zh: '待渲染', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  rendering: { zh: '渲染中', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
  done:      { zh: '已完成', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  failed:    { zh: '失败', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
};

interface Props { lang: Lang; }

export const BatchMixStudio = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'templates' | 'tasks' | 'new'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<MixTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const stats = [
    { label: zh ? '可用模板' : 'Templates', value: MOCK_TEMPLATES.length, color: 'text-purple-400' },
    { label: zh ? '渲染中' : 'Rendering', value: MOCK_TASKS.filter(t => t.status === 'rendering').length, color: 'text-blue-400' },
    { label: zh ? '今日完成' : "Today's Done", value: 18, color: 'text-emerald-400' },
    { label: zh ? '待入发布池' : 'Pool Ready', value: 15, color: 'text-cyan-400' },
  ];

  // Slots for new task wizard (mock)
  const SLOTS: MixSlot[] = [
    { id: 's1', label: zh ? '开场片段 (0-5s)' : 'Intro (0-5s)', type: 'video', filled: true, content: '张艺星618-Clip-01.mp4' },
    { id: 's2', label: zh ? '产品展示 (5-20s)' : 'Product (5-20s)', type: 'video', filled: true, content: '极速数码X12-产品展示.mp4' },
    { id: 's3', label: zh ? '口播文案' : 'Script Copy', type: 'text', filled: true, content: '张艺星×极速数码618主推文案-V3' },
    { id: 's4', label: zh ? '功能演示 (20-35s)' : 'Demo (20-35s)', type: 'video', filled: false },
    { id: 's5', label: zh ? '背景音乐' : 'BGM', type: 'audio', filled: true, content: '清洁卫士背景音乐授权包' },
    { id: 's6', label: zh ? '结尾引导 (35-45s)' : 'CTA (35-45s)', type: 'image', filled: false },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '混剪批量生产台' : 'Batch Mix Studio'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '模板驱动 · 素材矩阵组合 · 批量渲染 · 一键入发布池' : 'Template-driven · Asset matrix · Batch render · Pool push'}</p>
        </div>
        <button onClick={() => setTab('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition">
          <Plus className="w-3.5 h-3.5" />
          {zh ? '新建批量任务' : 'New Batch Task'}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([['templates', zh ? '模板库' : 'Templates'], ['tasks', zh ? '批量任务' : 'Batch Tasks'], ['new', zh ? '新建任务' : 'New Task']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-orange-400 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><List className="w-3.5 h-3.5" /></button>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
              <Plus className="w-3 h-3" />{zh ? '创建模板' : 'Create Template'}
            </button>
          </div>

          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-3'}>
            {MOCK_TEMPLATES.map((tmpl, i) => (
              <motion.div key={tmpl.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedTemplate(selectedTemplate?.id === tmpl.id ? null : tmpl)}
                className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${selectedTemplate?.id === tmpl.id ? 'border-orange-500/35 bg-orange-500/3' : 'border-white/5 hover:border-white/15'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${tmpl.color}15`, border: `1px solid ${tmpl.color}30` }}>
                    <Layers className="w-5 h-5" style={{ color: tmpl.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white">{tmpl.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{zh ? TYPE_CFG[tmpl.type].zh : TYPE_CFG[tmpl.type].en} · {tmpl.duration}</div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{tmpl.description}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {tmpl.platforms.map(p => (
                    <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-400">{p}</span>
                  ))}
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-400">{tmpl.slots} {zh ? '素材槽' : 'slots'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-black/20 rounded-lg p-2">
                    <div className="text-xs font-bold text-white">{tmpl.usageCount}</div>
                    <div className="text-[9px] text-gray-600">{zh ? '使用次数' : 'Uses'}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <div className={`text-xs font-bold ${tmpl.successRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{tmpl.successRate}%</div>
                    <div className="text-[9px] text-gray-600">{zh ? '成功率' : 'Success'}</div>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedTemplate?.id === tmpl.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => setTab('new')}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition">
                        <Zap className="w-3.5 h-3.5" />{zh ? '使用此模板新建任务' : 'Use Template'}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div className="space-y-3">
          {MOCK_TASKS.map((task, i) => {
            const rCfg = RENDER_STATUS_CFG[task.status];
            const pct = task.totalCount > 0 ? Math.round((task.completedCount / task.totalCount) * 100) : 0;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rCfg.bg} ${rCfg.border} border`}>
                    {task.status === 'rendering' ? <RefreshCw className={`w-5 h-5 ${rCfg.color} animate-spin`} /> :
                     task.status === 'done' ? <CheckCircle2 className={`w-5 h-5 ${rCfg.color}`} /> :
                     <Clock className={`w-5 h-5 ${rCfg.color}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{task.name}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${rCfg.bg} ${rCfg.color} ${rCfg.border}`}>
                        {zh ? rCfg.zh : task.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-2">{task.templateName} · {task.partnerName}</div>
                    {task.status !== 'pending' && (
                      <>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                          <span>{task.completedCount}/{task.totalCount} {zh ? '完成' : 'done'}</span>
                          {task.failedCount > 0 && <span className="text-red-400">{task.failedCount} {zh ? '失败' : 'failed'}</span>}
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${task.status === 'done' ? 'bg-emerald-500' : 'bg-orange-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {task.status === 'done' && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition">
                        <Zap className="w-3 h-3" />{zh ? '批量入池' : 'Push to Pool'}
                      </button>
                    )}
                    {task.status === 'pending' && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition">
                        <Play className="w-3 h-3" />{zh ? '开始渲染' : 'Start Render'}
                      </button>
                    )}
                    <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                      <Eye className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New task tab */}
      {tab === 'new' && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          {/* Left: template selector */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{zh ? '选择模板' : 'Select Template'}</div>
            <div className="space-y-2">
              {MOCK_TEMPLATES.map(tmpl => (
                <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl)}
                  className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition ${selectedTemplate?.id === tmpl.id ? 'bg-orange-500/8 border-orange-500/25' : 'bg-black/20 border-white/5 hover:border-white/15'}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${tmpl.color}20` }}>
                    <Layers className="w-3.5 h-3.5" style={{ color: tmpl.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-white truncate">{tmpl.name}</div>
                    <div className="text-[9px] text-gray-600">{tmpl.duration} · {tmpl.slots}{zh ? '个槽' : ' slots'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: slot filler */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-white">{selectedTemplate?.name || (zh ? '请先选择模板' : 'Select a template')}</div>
                {selectedTemplate && (
                  <span className="text-[10px] text-gray-500">{SLOTS.filter(s => s.filled).length}/{SLOTS.length} {zh ? '槽已填充' : 'slots filled'}</span>
                )}
              </div>
              <div>
                <label className="text-[10px] text-gray-600 uppercase tracking-wider block mb-1">{zh ? '任务名称' : 'Task Name'}</label>
                <input placeholder={zh ? '输入批量任务名称...' : 'Enter batch task name...'}
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 transition" />
              </div>
            </div>

            {selectedTemplate ? (
              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{zh ? '素材槽填充' : 'Slot Configuration'}</div>
                {SLOTS.map((slot, si) => {
                  const SlotIcon = slot.type === 'video' ? Video : slot.type === 'image' ? Image : slot.type === 'audio' ? Music : FileText;
                  return (
                    <div key={slot.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${slot.filled ? 'bg-emerald-500/3 border-emerald-500/15' : 'bg-black/20 border-dashed border-white/15 hover:border-orange-500/30 cursor-pointer'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${slot.filled ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                        <SlotIcon className={`w-4 h-4 ${slot.filled ? 'text-emerald-400' : 'text-gray-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 mb-0.5">{slot.label}</div>
                        {slot.filled ? (
                          <div className="text-xs text-white truncate">{slot.content}</div>
                        ) : (
                          <div className="text-[10px] text-gray-700">{zh ? '点击从资产库选取...' : 'Click to pick from vault...'}</div>
                        )}
                      </div>
                      {slot.filled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                {zh ? '选择模板后配置素材槽' : 'Select a template to configure slots'}
              </div>
            )}

            {selectedTemplate && (
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '批量数量：' : 'Batch Count:'}</label>
                  <div className="flex gap-1">
                    {[10, 20, 50, 100].map(n => (
                      <button key={n} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${n === 20 ? 'bg-orange-500/15 text-orange-400 border-orange-500/25' : 'bg-white/5 text-gray-500 border-white/8 hover:border-white/20'}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition">
                  <Zap className="w-4 h-4" />{zh ? '开始批量渲染 (20个)' : 'Start Batch Render (20)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
