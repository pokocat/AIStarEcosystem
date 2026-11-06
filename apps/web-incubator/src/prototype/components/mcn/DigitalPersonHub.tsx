/**
 * DigitalPersonHub — AI数字人中心
 * P0 新增页面：形象/声音模型管理 + 文案驱动生成 + 质量审核
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cpu, Mic, Star, Shield, CheckCircle2, XCircle, Clock, Plus,
  Search, Play, Eye, Zap, AlertTriangle, Lock, Users, Video,
  ChevronRight, BarChart3, RefreshCw, FileText, Settings
} from 'lucide-react';
import type { Lang } from '../../translations';

type ModelStatus = 'active' | 'training' | 'frozen' | 'review';
type GenStatus = 'generating' | 'review' | 'approved' | 'failed' | 'in_pool';

interface PersonModel {
  id: string; name: string; partnerName: string; type: 'appearance' | 'voice';
  status: ModelStatus; version: string; quality: number;
  authContract: string; usageCount: number; lastUsed: string; color: string;
  tags: string[];
}

interface GenTask {
  id: string; modelId: string; modelName: string; partnerName: string;
  copyTitle: string; platform: string; status: GenStatus;
  duration: string; createdAt: string; assignee: string;
  qualityScore: number | null; issues: string[];
}

const MOCK_MODELS: PersonModel[] = [
  {
    id: 'm1', name: '张艺星标准形象-V3', partnerName: '张艺星', type: 'appearance',
    status: 'active', version: 'V3.2', quality: 94, authContract: '张艺星数字人形象授权协议',
    usageCount: 124, lastUsed: '2025-09-10', color: '#f59e0b', tags: ['日常', '商务', '年轻化'],
  },
  {
    id: 'm2', name: '林音宝标准音色-普通话', partnerName: '林音宝', type: 'voice',
    status: 'active', version: 'V2.1', quality: 97, authContract: '林音宝AI数字人音色授权协议',
    usageCount: 67, lastUsed: '2025-09-08', color: '#a855f7', tags: ['甜美', '亲切', '普通话'],
  },
  {
    id: 'm3', name: '张艺星专业讲解形象-V1', partnerName: '张艺星', type: 'appearance',
    status: 'review', version: 'V1.0', quality: 78, authContract: '张艺星数字人形象授权协议',
    usageCount: 0, lastUsed: '-', color: '#f59e0b', tags: ['专业', '讲解', '测试中'],
  },
  {
    id: 'm4', name: '林音宝活力风格形象-V2', partnerName: '林音宝', type: 'appearance',
    status: 'active', version: 'V2.0', quality: 91, authContract: '林音宝数字人形象授权协议',
    usageCount: 28, lastUsed: '2025-09-05', color: '#a855f7', tags: ['活力', '时尚', '年轻'],
  },
  {
    id: 'm5', name: '张艺星音色克隆-综艺风', partnerName: '张艺星', type: 'voice',
    status: 'frozen', version: 'V1.5', quality: 82, authContract: '待续签',
    usageCount: 45, lastUsed: '2024-12-20', color: '#ef4444', tags: ['综艺', '活泼', '暂停使用'],
  },
];

const MOCK_TASKS: GenTask[] = [
  {
    id: 'g1', modelId: 'm1', modelName: '张艺星标准形象-V3', partnerName: '张艺星',
    copyTitle: '张艺星×极速数码618主推文案-V3', platform: 'DY', status: 'approved',
    duration: '1:24', createdAt: '2025-06-21', assignee: '制作小王',
    qualityScore: 92, issues: [],
  },
  {
    id: 'g2', modelId: 'm4', modelName: '林音宝活力风格形象-V2', partnerName: '林音宝',
    copyTitle: '林音宝短视频标题库-日常系列', platform: 'XHS', status: 'review',
    duration: '0:58', createdAt: '2025-09-09', assignee: '制作小李',
    qualityScore: 85, issues: ['口型同步度偏低'],
  },
  {
    id: 'g3', modelId: 'm1', modelName: '张艺星标准形象-V3', partnerName: '张艺星',
    copyTitle: '张艺星商品卖点文案-数码周', platform: 'KS', status: 'failed',
    duration: '-', createdAt: '2025-06-10', assignee: '制作小王',
    qualityScore: 52, issues: ['文案含风险词，生成已阻断', '文案未通过法务终审'],
  },
  {
    id: 'g4', modelId: 'm2', modelName: '林音宝标准音色-普通话', partnerName: '林音宝',
    copyTitle: '林音宝护肤产品口播稿-效果版', platform: 'DY', status: 'generating',
    duration: '-', createdAt: '2025-09-11', assignee: '制作小李',
    qualityScore: null, issues: [],
  },
];

const MODEL_STATUS_CFG: Record<ModelStatus, { zh: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  active:   { zh: '可用', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  training: { zh: '训练中', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', icon: RefreshCw },
  frozen:   { zh: '已冻结', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: Lock },
  review:   { zh: '审核中', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: Clock },
};

const GEN_STATUS_CFG: Record<GenStatus, { zh: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  generating: { zh: '生成中', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', icon: RefreshCw },
  review:     { zh: '质量审核', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: Eye },
  approved:   { zh: '已通过', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  failed:     { zh: '生成失败', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: XCircle },
  in_pool:    { zh: '已入发布池', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', icon: Zap },
};

interface Props { lang: Lang; }

export const DigitalPersonHub = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'models' | 'tasks'>('models');
  const [modelTypeFilter, setModelTypeFilter] = useState<'all' | 'appearance' | 'voice'>('all');
  const [selectedModel, setSelectedModel] = useState<PersonModel | null>(MOCK_MODELS[0]);
  const [showGenModal, setShowGenModal] = useState(false);

  const filteredModels = MOCK_MODELS.filter(m => modelTypeFilter === 'all' || m.type === modelTypeFilter);

  const stats = [
    { label: zh ? '形象模型' : 'Appearance', value: MOCK_MODELS.filter(m => m.type === 'appearance').length, color: 'text-cyan-400' },
    { label: zh ? '声音模型' : 'Voice Models', value: MOCK_MODELS.filter(m => m.type === 'voice').length, color: 'text-purple-400' },
    { label: zh ? '今日生成' : "Today's Gen", value: 4, color: 'text-pink-400' },
    { label: zh ? '审核中' : 'In Review', value: MOCK_TASKS.filter(t => t.status === 'review').length, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? 'AI数字人中心' : 'Digital Person Hub'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '形象授权管理 · 声音克隆 · 文案驱动生成 · 质量审核' : 'Model licensing · Voice cloning · Copy-driven gen · Quality review'}</p>
        </div>
        <button onClick={() => setShowGenModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition">
          <Zap className="w-3.5 h-3.5" />
          {zh ? '新建生成任务' : 'New Generation'}
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
      <div className="flex gap-2 border-b border-white/5 pb-0">
        {(['models', 'tasks'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t === 'models' ? (zh ? '模型库' : 'Model Library') : (zh ? '生成任务' : 'Generation Tasks')}
          </button>
        ))}
      </div>

      {tab === 'models' && (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'appearance', 'voice'] as const).map(f => (
              <button key={f} onClick={() => setModelTypeFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${modelTypeFilter === f ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/15'}`}>
                {f === 'all' ? (zh ? '全部' : 'All') : f === 'appearance' ? (zh ? '形象模型' : 'Appearance') : (zh ? '声音模型' : 'Voice')}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredModels.map((model, i) => {
              const sCfg = MODEL_STATUS_CFG[model.status];
              const SIcon = sCfg.icon;
              return (
                <motion.div key={model.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}
                  className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${selectedModel?.id === model.id ? 'border-emerald-500/35 bg-emerald-500/3' : 'border-white/5 hover:border-white/15'} ${model.status === 'frozen' ? 'opacity-60' : ''}`}>

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${model.color}15`, border: `1px solid ${model.color}30` }}>
                      {model.type === 'appearance' ? <Cpu className="w-5 h-5" style={{ color: model.color }} /> : <Mic className="w-5 h-5" style={{ color: model.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{model.name}</div>
                      <div className="text-[10px] text-gray-500">{model.partnerName} · {model.version}</div>
                    </div>
                  </div>

                  {/* Status + quality */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      <SIcon className="w-2.5 h-2.5" />{zh ? sCfg.zh : model.status}
                    </span>
                    <span className="text-[10px] text-gray-500">{zh ? '质量分：' : 'Quality: '}<span className={`font-bold ${model.quality >= 90 ? 'text-emerald-400' : model.quality >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{model.quality}</span></span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-xs font-bold text-white">{model.usageCount}</div>
                      <div className="text-[9px] text-gray-600">{zh ? '使用次数' : 'Usage'}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-xs font-bold text-white">{model.lastUsed}</div>
                      <div className="text-[9px] text-gray-600">{zh ? '最近使用' : 'Last Used'}</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {model.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-500">{t}</span>
                    ))}
                  </div>

                  {/* Auth notice */}
                  <div className="mt-2 text-[9px] text-gray-600 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-cyan-400" />
                    <span className="truncate">{model.authContract}</span>
                  </div>

                  {/* Frozen warning */}
                  {model.status === 'frozen' && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      {zh ? '授权过期，模型已冻结，不可用于生成' : 'Auth expired. Model frozen.'}
                    </div>
                  )}

                  {model.status === 'active' && (
                    <button onClick={e => { e.stopPropagation(); setShowGenModal(true); }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition">
                      <Zap className="w-3 h-3" />{zh ? '用此模型生成' : 'Generate with this'}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          {MOCK_TASKS.map((task, i) => {
            const sCfg = GEN_STATUS_CFG[task.status];
            const SIcon = sCfg.icon;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/8">
                    {task.status === 'generating' ? <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" /> : <Video className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-white">{task.modelName}</span>
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                        <SIcon className="w-2.5 h-2.5" />{zh ? sCfg.zh : task.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1">{zh ? '文案：' : 'Copy: '}{task.copyTitle}</div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
                      <span>{task.partnerName}</span>
                      <span>{task.platform}</span>
                      <span>{task.duration !== '-' ? task.duration : ''}</span>
                      <span>{task.createdAt}</span>
                      {task.qualityScore !== null && (
                        <span className="flex items-center gap-0.5">
                          {zh ? '质量分：' : 'Score: '}
                          <span className={`font-bold ${task.qualityScore >= 90 ? 'text-emerald-400' : task.qualityScore >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{task.qualityScore}</span>
                        </span>
                      )}
                    </div>
                    {task.issues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.issues.map(issue => (
                          <span key={issue} className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                            <AlertTriangle className="w-2.5 h-2.5" />{issue}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {task.status === 'approved' && (
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                        <Zap className="w-3 h-3" />{zh ? '入发布池' : 'To Pool'}
                      </button>
                    )}
                    {task.status !== 'generating' && (
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Generation Modal */}
      <AnimatePresence>
        {showGenModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGenModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="text-base font-bold mb-4">{zh ? '新建数字人生成任务' : 'New Generation Task'}</div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">{zh ? '选择形象模型' : 'Appearance Model'}</label>
                  <div className="space-y-1.5">
                    {MOCK_MODELS.filter(m => m.type === 'appearance' && m.status === 'active').map(m => (
                      <button key={m.id} className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/8 hover:border-emerald-500/30 transition">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white">{m.name}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{m.partnerName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">{zh ? '选择声音模型' : 'Voice Model'}</label>
                  <div className="space-y-1.5">
                    {MOCK_MODELS.filter(m => m.type === 'voice' && m.status === 'active').map(m => (
                      <button key={m.id} className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/8 hover:border-emerald-500/30 transition">
                        <Mic className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-white">{m.name}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{m.partnerName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">{zh ? '选择已审文案（必选）' : 'Select Approved Copy (Required)'}</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/25">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400">{zh ? '只能使用已通过三阶段审核的文案' : 'Only 3-stage approved copies allowed'}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowGenModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:border-white/20 transition">
                    {zh ? '取消' : 'Cancel'}
                  </button>
                  <button onClick={() => setShowGenModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition">
                    <Zap className="w-3.5 h-3.5 inline mr-1.5" />{zh ? '开始生成' : 'Start Generation'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
