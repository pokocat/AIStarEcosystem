/**
 * StudioWorkbench — 制作/剪辑端工作台 · P3深化
 * AI脚本生成 · 质检评分 · 任务队列 · 水印预览 · 推送发布池
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scissors, Cpu, Layers, Clock, CheckCircle2, AlertTriangle,
  Play, Upload, FileText, ChevronRight, Zap, Shield, Video,
  BarChart3, ArrowLeft, Search, Eye, Wand2, RefreshCw,
  Plus, Star, TrendingUp, MessageSquare, Download, Sparkles,
  AlignLeft, Music
} from 'lucide-react';
import type { Lang } from '../../translations';

interface Props { lang: Lang; onBack: () => void; }

type TaskType = 'clip' | 'digital' | 'mix' | 'script';
type OutputStatus = 'watermarked' | 'in_pool' | 'review' | 'rejected' | 'draft';

interface Task {
  id: string; title: string; type: TaskType;
  priority: 'urgent' | 'normal' | 'low';
  due: string; dueEn: string;
  clips: number; passed: number;
  artist: string; color: string;
  requiredScript: boolean; scriptReady: boolean;
  licenseCheck: 'valid' | 'warning' | 'none';
}

interface OutputItem {
  id: string; title: string; type: TaskType;
  duration: string; status: OutputStatus; qcScore: number;
  watermarkId: string; artist: string;
}

interface ScriptVariant {
  id: string; style: string; styleEn: string;
  preview: string; previewEn: string;
  duration: string; confidence: number;
}

const TASKS: Task[] = [
  { id: 't1', title: '张艺星618直播回放-切片任务', type: 'clip', priority: 'urgent', due: '今日18:00', dueEn: 'Today 18:00', clips: 12, passed: 9, artist: '张艺星', color: '#ec4899', requiredScript: false, scriptReady: false, licenseCheck: 'valid' },
  { id: 't2', title: '林音宝护肤-AI数字人口播生成', type: 'digital', priority: 'urgent', due: '今日20:00', dueEn: 'Today 20:00', clips: 1, passed: 0, artist: '林音宝', color: '#10b981', requiredScript: true, scriptReady: false, licenseCheck: 'valid' },
  { id: 't3', title: '林音宝护肤产品讲解-切片', type: 'clip', priority: 'normal', due: '明日12:00', dueEn: 'Tomorrow 12:00', clips: 6, passed: 0, artist: '林音宝', color: '#ec4899', requiredScript: false, scriptReady: false, licenseCheck: 'warning' },
  { id: 't4', title: '清洁卫士混剪-夏季产品线', type: 'mix', priority: 'normal', due: '后日09:00', dueEn: 'Day-3 09:00', clips: 5, passed: 5, artist: '清洁卫士', color: '#f97316', requiredScript: false, scriptReady: false, licenseCheck: 'valid' },
  { id: 't5', title: '肖战护肤口播脚本生成', type: 'script', priority: 'low', due: '明日18:00', dueEn: 'Tomorrow 18:00', clips: 0, passed: 0, artist: '肖战', color: '#a855f7', requiredScript: true, scriptReady: false, licenseCheck: 'valid' },
];

const TODAY_OUTPUTS: OutputItem[] = [
  { id: 'o1', title: '张艺星618-Clip-01', type: 'clip', duration: '1:12', status: 'watermarked', qcScore: 94, watermarkId: 'WM-2025-0891', artist: '张艺星' },
  { id: 'o2', title: '张艺星618-Clip-02', type: 'clip', duration: '0:58', status: 'watermarked', qcScore: 91, watermarkId: 'WM-2025-0892', artist: '张艺星' },
  { id: 'o3', title: '张艺星618-Clip-03', type: 'clip', duration: '1:30', status: 'in_pool', qcScore: 88, watermarkId: 'WM-2025-0893', artist: '张艺星' },
  { id: 'o4', title: '林音宝数字人-护肤V1', type: 'digital', duration: '0:55', status: 'review', qcScore: 85, watermarkId: 'WM-2025-0894', artist: '林音宝' },
  { id: 'o5', title: '清洁卫士混剪-01', type: 'mix', duration: '1:45', status: 'rejected', qcScore: 62, watermarkId: 'WM-2025-0895', artist: '清洁卫士' },
];

const SCRIPT_VARIANTS: ScriptVariant[] = [
  { id: 'sv1', style: '专业种草型', styleEn: 'Professional Review', preview: '大家好，今天给大家介绍这款革命性的护肤精华液。经过28天亲身测试，我的皮肤状态有了显著改善……', previewEn: 'Hello everyone, today I\'m introducing this revolutionary skincare serum. After 28 days of personal testing, my skin condition has improved significantly...', duration: '55s', confidence: 92 },
  { id: 'sv2', style: '日常分享型', styleEn: 'Casual Daily Share', preview: '姐妹们！发现一个宝藏护肤品，用了两周真的白了！！今天必须给大家安利一下……', previewEn: 'Girls! Found a treasure skincare product, genuinely brighter after 2 weeks! Must share today...', duration: '48s', confidence: 87 },
  { id: 'sv3', style: '痛点解决型', styleEn: 'Pain Point Solution', preview: '你是不是也在为毛孔粗大、暗沉肌烦恼？我用了三年终于找到了救星……', previewEn: 'Are you struggling with large pores and dull skin? After 3 years I finally found the solution...', duration: '62s', confidence: 85 },
];

const TYPE_ICON: Record<TaskType, React.ComponentType<any>> = {
  clip: Scissors, digital: Cpu, mix: Layers, script: AlignLeft,
};

const TYPE_COLOR: Record<TaskType, string> = {
  clip: '#ec4899', digital: '#10b981', mix: '#f97316', script: '#a855f7',
};

const QC_COLOR = (score: number) => score >= 90 ? '#22c55e' : score >= 80 ? '#f59e0b' : score >= 70 ? '#f97316' : '#ef4444';

const STATUS_CFG: Record<OutputStatus, { zh: string; en: string; color: string; bg: string; border: string }> = {
  watermarked: { zh: '已水印', en: 'WM-Done',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  in_pool:     { zh: '已入池', en: 'In Pool',  color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25' },
  review:      { zh: '审核中', en: 'Review',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25' },
  rejected:    { zh: '已驳回', en: 'Rejected', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25' },
  draft:       { zh: '草稿',   en: 'Draft',    color: 'text-gray-500',    bg: 'bg-gray-500/10',    border: 'border-gray-500/15' },
};

export const StudioWorkbench = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'tasks' | 'outputs' | 'aiscript'>('tasks');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  const filteredTasks = TASKS.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
  const urgentCount = TASKS.filter(t => t.priority === 'urgent').length;
  const passRate = Math.round((TODAY_OUTPUTS.filter(o => o.qcScore >= 80).length / TODAY_OUTPUTS.length) * 100);

  const handleGenerateScript = () => {
    setGeneratingScript(true);
    setTimeout(() => setGeneratingScript(false), 1800);
  };

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold">{zh ? '制作/剪辑工作台' : 'Studio Workbench'}</div>
              <div className="text-[10px] text-emerald-400">{zh ? '制作·剪辑端' : 'Studio Role'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" />{urgentCount} {zh ? '紧急' : 'urgent'}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={zh ? '搜索任务...' : 'Search...'}
                className="bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 w-40" />
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-0">
          {([['tasks', zh ? '制作任务' : 'Tasks', Scissors], ['outputs', zh ? '今日产出' : 'Outputs', Video], ['aiscript', zh ? 'AI脚本生成' : 'AI Script', Wand2]] as const).map(([t, label, Ic]) => {
            const TabIc = Ic;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <TabIc className="w-3.5 h-3.5" />{label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: zh ? '今日紧急' : 'Urgent', value: urgentCount, color: '#ef4444', icon: AlertTriangle },
            { label: zh ? '今日产出' : 'Outputs', value: TODAY_OUTPUTS.length, color: '#22c55e', icon: CheckCircle2 },
            { label: zh ? 'QC通过率' : 'QC Pass', value: `${passRate}%`, color: '#f59e0b', icon: Shield },
            { label: zh ? '已入发布池' : 'In Pool', value: TODAY_OUTPUTS.filter(o => o.status === 'in_pool').length, color: '#a855f7', icon: Zap },
          ].map((s, i) => {
            const SIcon = s.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <SIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Tasks Tab ─── */}
        {tab === 'tasks' && (
          <div className="space-y-2">
            {/* Quick actions */}
            <div className="grid grid-cols-6 gap-2 mb-4">
              {[
                { icon: Scissors, label_zh: '切片制作台', label_en: 'Clip Studio', color: '#ec4899' },
                { icon: Cpu, label_zh: 'AI数字人', label_en: 'Digital Person', color: '#10b981' },
                { icon: Layers, label_zh: '混剪批量台', label_en: 'Batch Mix', color: '#f97316' },
                { icon: AlignLeft, label_zh: 'AI脚本生成', label_en: 'AI Script', color: '#a855f7' },
                { icon: Video, label_zh: '数字资产库', label_en: 'Asset Vault', color: '#3b82f6' },
                { icon: Zap, label_zh: '推送发布池', label_en: 'To Pool', color: '#22c55e' },
              ].map((action, i) => {
                const AIcon = action.icon;
                return (
                  <button key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:scale-105 transition"
                    style={{ background: `${action.color}10`, borderColor: `${action.color}30` }}>
                    <AIcon className="w-5 h-5" style={{ color: action.color }} />
                    <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: action.color }}>
                      {zh ? action.label_zh : action.label_en}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredTasks.map((task, i) => {
              const TIcon = TYPE_ICON[task.type];
              const isExpanded = expandedTask === task.id;
              return (
                <motion.div key={task.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`bg-gray-900/50 border rounded-xl overflow-hidden transition cursor-pointer ${
                    task.priority === 'urgent' ? 'border-red-500/15' :
                    isExpanded ? 'border-emerald-500/25' : 'border-white/5 hover:border-white/15'
                  }`}
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${task.color}15`, border: `1px solid ${task.color}30` }}>
                      <TIcon className="w-4 h-4" style={{ color: task.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate mb-1">{task.title}</div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        <span className="text-gray-500">{task.artist}</span>
                        <span className={`font-bold ${task.priority === 'urgent' ? 'text-red-400' : task.priority === 'normal' ? 'text-gray-500' : 'text-gray-700'}`}>
                          {task.priority === 'urgent' ? (zh ? '紧急' : 'URGENT') : task.priority === 'normal' ? (zh ? '普通' : 'Normal') : (zh ? '低优' : 'Low')}
                        </span>
                        <span className="text-gray-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{zh ? task.due : task.dueEn}</span>
                        {/* License check badge */}
                        {task.licenseCheck === 'warning' && (
                          <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                            <AlertTriangle className="w-2.5 h-2.5" />{zh ? '授权待确认' : 'License?'}
                          </span>
                        )}
                        {task.requiredScript && !task.scriptReady && (
                          <span className="text-purple-400 flex items-center gap-0.5">
                            <Wand2 className="w-2.5 h-2.5" />{zh ? '需先生成脚本' : 'Needs script'}
                          </span>
                        )}
                      </div>
                      {task.clips > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(task.passed / task.clips) * 100}%` }} />
                          </div>
                          <span className="text-[9px] text-gray-600">{task.passed}/{task.clips}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-gray-600 transition mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 flex-wrap">
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition">
                            <Play className="w-3.5 h-3.5" />{zh ? '开始制作' : 'Start'}
                          </button>
                          {task.type === 'digital' && (
                            <button onClick={() => setTab('aiscript')}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                              <Wand2 className="w-3.5 h-3.5" />{zh ? 'AI生成脚本' : 'AI Script'}
                            </button>
                          )}
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                            <Eye className="w-3.5 h-3.5" />{zh ? '查看素材' : 'View Assets'}
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                            <Shield className="w-3.5 h-3.5" />{zh ? '查看授权' : 'Check License'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ─── Outputs Tab ─── */}
        {tab === 'outputs' && (
          <div className="space-y-3">
            {TODAY_OUTPUTS.map((out, i) => {
              const OIcon = TYPE_ICON[out.type];
              const sCfg = STATUS_CFG[out.status];
              return (
                <motion.div key={out.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/12 transition">
                  {/* Thumbnail placeholder */}
                  <div className="w-16 h-12 rounded-lg bg-black border border-white/8 flex items-center justify-center shrink-0">
                    <OIcon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate mb-0.5">{out.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>{out.duration}</span>
                      <span className="font-mono text-[9px] text-gray-700">{out.watermarkId}</span>
                    </div>
                    {/* QC bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="text-[9px] text-gray-600">{zh ? 'QC' : 'QC'}</div>
                      <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${out.qcScore}%`, background: QC_COLOR(out.qcScore) }} />
                      </div>
                      <span className="text-[9px] font-bold" style={{ color: QC_COLOR(out.qcScore) }}>{out.qcScore}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      {zh ? sCfg.zh : sCfg.en}
                    </span>
                    {out.status === 'watermarked' && (
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                        <Zap className="w-3 h-3" />{zh ? '推送' : 'Push'}
                      </button>
                    )}
                    {out.status === 'rejected' && (
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                        <RefreshCw className="w-3 h-3" />{zh ? '重做' : 'Redo'}
                      </button>
                    )}
                    <button className="p-2 rounded-lg border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Upload area */}
            <div className="border border-dashed border-white/10 rounded-xl p-6 text-center hover:border-emerald-500/30 transition cursor-pointer">
              <Upload className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <div className="text-xs text-gray-600">{zh ? '上传原始素材到资产库' : 'Upload source material to Asset Vault'}</div>
            </div>
          </div>
        )}

        {/* ─── AI Script Tab ─── */}
        {tab === 'aiscript' && (
          <div className="space-y-4">
            {/* Config panel */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />{zh ? 'AI口播脚本生成器' : 'AI Voiceover Script Generator'}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1.5 block">{zh ? '选择艺人' : 'Artist'}</label>
                    <select className="w-full h-9 bg-white/5 border border-white/8 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-purple-500/40">
                      <option>林音宝</option><option>张艺星</option><option>肖战</option><option>杨幂</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1.5 block">{zh ? '产品/内容' : 'Product/Content'}</label>
                    <input defaultValue={zh ? '护肤精华液' : 'Skincare Serum'} className="w-full h-9 bg-white/5 border border-white/8 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-purple-500/40" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1.5 block">{zh ? '目标时长' : 'Duration'}</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['30s', '45s', '60s', '90s'].map(d => (
                        <button key={d} className={`h-8 rounded-lg border text-[10px] font-bold transition ${d === '60s' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'border-white/8 text-gray-500 hover:border-white/20'}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1.5 block">{zh ? '脚本风格' : 'Script Style'}</label>
                    <div className="space-y-1.5">
                      {[
                        { id: 's1', zh: '专业种草', en: 'Pro Review' },
                        { id: 's2', zh: '日常分享', en: 'Casual Share' },
                        { id: 's3', zh: '痛点解决', en: 'Pain Point' },
                      ].map(style => (
                        <button key={style.id} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/8 hover:border-purple-500/30 text-xs text-gray-400 hover:text-white transition">
                          {zh ? style.zh : style.en}<ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1.5 block">{zh ? '平台优化' : 'Platform'}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['DY', 'XHS', 'KS'].map(p => (
                        <button key={p} className={`h-8 rounded-lg border text-[10px] font-bold transition ${p === 'DY' ? 'bg-pink-500/15 border-pink-500/30 text-pink-400' : 'border-white/8 text-gray-500 hover:border-white/20'}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleGenerateScript}
                className="w-full mt-4 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>
                {generatingScript ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{zh ? 'AI生成中...' : 'Generating...'}</>
                ) : (
                  <><Sparkles className="w-4 h-4" />{zh ? 'AI生成脚本' : 'Generate Script'}</>
                )}
              </button>
            </div>

            {/* Generated variants */}
            <div className="space-y-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{zh ? 'AI生成方案（3种风格）' : 'AI Generated Variants (3 styles)'}</div>
              {SCRIPT_VARIANTS.map((variant, i) => (
                <motion.div key={variant.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${selectedScript === variant.id ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/5 hover:border-white/15'}`}
                  onClick={() => setSelectedScript(variant.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-bold text-white">{zh ? variant.style : variant.styleEn}</span>
                      <span className="text-[9px] text-gray-500">{variant.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-emerald-400 font-bold">{zh ? `置信度${variant.confidence}%` : `${variant.confidence}%`}</span>
                      {selectedScript === variant.id && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-3">{zh ? variant.preview : variant.previewEn}</p>
                  {selectedScript === variant.id && (
                    <div className="flex gap-2 mt-3">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                        <Cpu className="w-3 h-3" />{zh ? '发送给数字人' : 'Send to Digital Person'}
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                        <Edit3 className="w-3 h-3" />{zh ? '编辑脚本' : 'Edit Script'}
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                        <Download className="w-3 h-3" />{zh ? '下载' : 'Download'}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Missing import
const Edit3 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
