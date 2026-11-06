/**
 * ClipStudio — 真人切片制作台
 * P0 新增页面：直播/长视频切片 + 质检强制6项 + 批量出片 + 制作协作
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scissors, Video, Play, Plus, Search, CheckCircle2, XCircle,
  Clock, AlertTriangle, Upload, Layers, FileText, Zap, Eye,
  Users, ChevronRight, BarChart3, Hash, Shield, Mic, Type
} from 'lucide-react';
import type { Lang } from '../../translations';

type TaskStatus = 'in_progress' | 'quality_check' | 'review' | 'completed' | 'failed';
type ClipStatus = 'pending_check' | 'check_passed' | 'check_failed' | 'watermarked' | 'in_pool';

interface QualityCheck {
  id: string; zh: string; en: string; passed: boolean | null;
}

interface Clip {
  id: string; taskId: string; title: string; duration: string;
  status: ClipStatus; thumbnail: string; platform: string;
  qualityChecks: QualityCheck[];
}

interface ClipTask {
  id: string; sourceTitle: string; sourceType: 'live' | 'long_video' | 'interview';
  partnerName: string; productScope: string; status: TaskStatus;
  totalClips: number; passedClips: number; failedClips: number;
  assignee: string; createdAt: string; deadline: string;
  authContract: string; copyVersion: string;
}

const QC_ITEMS: QualityCheck[] = [
  { id: 'qc1', zh: '黑屏/静音检测', en: 'Black screen / silence', passed: true },
  { id: 'qc2', zh: '字幕错位检测', en: 'Subtitle misalignment', passed: true },
  { id: 'qc3', zh: '画幅异常检测', en: 'Aspect ratio check', passed: true },
  { id: 'qc4', zh: '敏感词识别', en: 'Sensitive word detection', passed: null },
  { id: 'qc5', zh: '品牌露出校验', en: 'Brand exposure check', passed: true },
  { id: 'qc6', zh: '授权范围核查', en: 'Authorization scope check', passed: null },
];

const MOCK_TASKS: ClipTask[] = [
  {
    id: 't1', sourceTitle: '张艺星618直播回放-完整版（3.7小时）', sourceType: 'live',
    partnerName: '张艺星', productScope: '极速数码旗舰手机X12', status: 'quality_check',
    totalClips: 12, passedClips: 9, failedClips: 1, assignee: '剪辑小朱',
    createdAt: '2025-06-20', deadline: '2025-06-22', authContract: '张艺星×极速数码618短视频授权', copyVersion: 'V3',
  },
  {
    id: 't2', sourceTitle: '林音宝产品讲解视频-护肤系列（28分钟）', sourceType: 'long_video',
    partnerName: '林音宝', productScope: '轻奢护肤精华液', status: 'in_progress',
    totalClips: 6, passedClips: 0, failedClips: 0, assignee: '剪辑小陈',
    createdAt: '2025-09-02', deadline: '2025-09-04', authContract: '林音宝肖像使用授权', copyVersion: 'V1',
  },
  {
    id: 't3', sourceTitle: '清洁卫士品牌采访-夏季产品线（55分钟）', sourceType: 'interview',
    partnerName: '清洁卫士品牌方', productScope: '多效厨房清洁剂', status: 'completed',
    totalClips: 8, passedClips: 8, failedClips: 0, assignee: '剪辑小朱',
    createdAt: '2025-07-10', deadline: '2025-07-12', authContract: '清洁卫士内容投放授权', copyVersion: 'V2',
  },
  {
    id: 't4', sourceTitle: '张艺星专访-年度规划（45分钟）', sourceType: 'interview',
    partnerName: '张艺星', productScope: '个人品牌宣推', status: 'review',
    totalClips: 5, passedClips: 4, failedClips: 1, assignee: '剪辑小陈',
    createdAt: '2025-09-05', deadline: '2025-09-07', authContract: '张艺星肖像直播回放切片授权', copyVersion: 'V2',
  },
];

const STATUS_CFG: Record<TaskStatus, { zh: string; en: string; color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  in_progress:   { zh: '制作中', en: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', icon: Scissors },
  quality_check: { zh: '质检中', en: 'Quality Check', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', icon: Shield },
  review:        { zh: '审核中', en: 'In Review', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', icon: Eye },
  completed:     { zh: '已完成', en: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle2 },
  failed:        { zh: '质检失败', en: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: XCircle },
};

const SRC_TYPE_CFG = {
  live: { zh: '直播回放', en: 'Live Replay', color: '#ef4444' },
  long_video: { zh: '长视频', en: 'Long Video', color: '#3b82f6' },
  interview: { zh: '采访', en: 'Interview', color: '#10b981' },
};

interface Props { lang: Lang; }

export const ClipStudio = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selectedTask, setSelectedTask] = useState<ClipTask | null>(MOCK_TASKS[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const filtered = MOCK_TASKS.filter(t => {
    const matchSearch = t.sourceTitle.toLowerCase().includes(search.toLowerCase()) || t.partnerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = [
    { label: zh ? '进行中任务' : 'Active Tasks', value: MOCK_TASKS.filter(t => t.status === 'in_progress' || t.status === 'quality_check').length, color: 'text-blue-400' },
    { label: zh ? '今日完成' : "Today's Done", value: 8, color: 'text-emerald-400' },
    { label: zh ? '质检通过率' : 'QC Pass Rate', value: '87%', color: 'text-amber-400' },
    { label: zh ? '已入发布池' : 'In Pool', value: 34, color: 'text-purple-400' },
  ];

  const qcItems: QualityCheck[] = selectedTask ? [
    { id: 'qc1', zh: '黑屏/静音检测', en: 'Black screen / silence', passed: true },
    { id: 'qc2', zh: '字幕错位检测', en: 'Subtitle misalignment', passed: selectedTask.status !== 'failed' },
    { id: 'qc3', zh: '画幅异常检测', en: 'Aspect ratio check', passed: true },
    { id: 'qc4', zh: '敏感词识别', en: 'Sensitive word detection', passed: selectedTask.status === 'completed' ? true : selectedTask.failedClips > 0 ? false : null },
    { id: 'qc5', zh: '品牌露出校验', en: 'Brand exposure check', passed: true },
    { id: 'qc6', zh: '授权范围核查', en: 'Authorization scope check', passed: selectedTask.status !== 'failed' },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '真人切片制作台' : 'Clip Studio'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '授权素材切片 · 6项质检 · 批量出片 · 协作制作' : 'Authorized clip editing · 6-point QC · Batch output · Collaboration'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition">
          <Plus className="w-3.5 h-3.5" />
          {zh ? '新建制作任务' : 'New Task'}
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

      {/* Main split */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 540 }}>
        {/* Left: Task list */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={zh ? '搜索制作任务...' : 'Search tasks...'}
                className="w-full bg-black/30 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-pink-500/40 transition" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'in_progress', 'quality_check', 'review', 'completed'] as const).map(s => {
                const scfg = s === 'all' ? null : STATUS_CFG[s];
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition ${statusFilter === s ? (s === 'all' ? 'bg-white/10 text-white border-white/20' : `${scfg!.bg} ${scfg!.color} ${scfg!.border}`) : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'}`}>
                    {s === 'all' ? (zh ? '全部' : 'All') : (zh ? scfg!.zh : scfg!.en)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.map((task, i) => {
              const sCfg = STATUS_CFG[task.status];
              const SIcon = sCfg.icon;
              const srcCfg = SRC_TYPE_CFG[task.sourceType];
              const isSelected = selectedTask?.id === task.id;
              const passPct = task.totalClips > 0 ? Math.round((task.passedClips / task.totalClips) * 100) : 0;
              return (
                <motion.button key={task.id} onClick={() => setSelectedTask(task)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`w-full text-left p-3 rounded-xl border transition ${isSelected ? 'bg-pink-500/5 border-pink-500/25' : 'bg-black/20 border-white/5 hover:border-white/15'}`}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <Scissors className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-white leading-snug truncate">{task.sourceTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${srcCfg.color}15`, color: srcCfg.color }}>{zh ? srcCfg.zh : srcCfg.en}</span>
                    <span className="text-[10px] text-gray-500">{task.partnerName}</span>
                    <span className="text-[10px] text-gray-600 ml-auto">{task.assignee}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      <SIcon className="w-2.5 h-2.5" />{zh ? sCfg.zh : sCfg.en}
                    </span>
                    <span className="text-[10px] text-gray-500">{task.passedClips}/{task.totalClips} {zh ? '通过' : 'passed'}</span>
                  </div>
                  {task.totalClips > 0 && (
                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: `${passPct}%` }} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Task detail */}
        {selectedTask ? (
          <motion.div key={selectedTask.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="text-sm font-bold text-white mb-1">{selectedTask.sourceTitle}</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                <span>{selectedTask.partnerName}</span>
                <span>{selectedTask.productScope}</span>
                <span>{zh ? '截止：' : 'Due: '}{selectedTask.deadline}</span>
                <span>{zh ? '授权合同：' : 'Contract: '}{selectedTask.authContract}</span>
                <span>{zh ? '文案版本：' : 'Copy: '}{selectedTask.copyVersion}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 6-point QC */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{zh ? '6项强制质检' : '6-Point Mandatory QC'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {qcItems.map((qc, qi) => (
                    <div key={qc.id} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs ${
                      qc.passed === true ? 'bg-emerald-500/5 border-emerald-500/20' :
                      qc.passed === false ? 'bg-red-500/5 border-red-500/20' :
                      'bg-white/3 border-white/8'
                    }`}>
                      {qc.passed === true ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
                       qc.passed === false ? <XCircle className="w-4 h-4 text-red-400 shrink-0" /> :
                       <Clock className="w-4 h-4 text-gray-600 shrink-0 animate-pulse" />}
                      <span className={qc.passed === true ? 'text-gray-300' : qc.passed === false ? 'text-red-300' : 'text-gray-600'}>
                        {zh ? qc.zh : qc.en}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clips list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider">{zh ? '切片列表' : 'Clip List'}</div>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-pink-500/10 border border-pink-500/25 text-pink-400 hover:bg-pink-500/20 transition">
                    <Plus className="w-3 h-3" />{zh ? '新增切片' : 'Add Clip'}
                  </button>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: Math.min(selectedTask.totalClips, 5) }, (_, ci) => {
                    const isPass = ci < selectedTask.passedClips;
                    const isFail = ci === selectedTask.passedClips && selectedTask.failedClips > 0;
                    return (
                      <div key={ci} className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isPass ? 'bg-emerald-500/3 border-emerald-500/15' :
                        isFail ? 'bg-red-500/3 border-red-500/15' :
                        'bg-black/20 border-white/5'
                      }`}>
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <Video className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">Clip-{String(ci + 1).padStart(2, '0')} · {['0:45', '1:12', '0:58', '1:30', '0:36'][ci]}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {isPass ? (zh ? '质检通过，待入发布池' : 'QC passed, pending pool') :
                             isFail ? (zh ? '敏感词检测未通过，需修改' : 'Failed: sensitive word detected') :
                             (zh ? '等待质检...' : 'Awaiting QC...')}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {isPass && (
                            <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                              <Zap className="w-2.5 h-2.5" />{zh ? '入池' : 'Pool'}
                            </button>
                          )}
                          <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {selectedTask.totalClips > 5 && (
                    <div className="text-center text-[10px] text-gray-600 py-2">
                      {zh ? `另有 ${selectedTask.totalClips - 5} 个切片...` : `${selectedTask.totalClips - 5} more clips...`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedTask.status === 'quality_check' && (
              <div className="p-4 border-t border-white/5">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition">
                  <Shield className="w-4 h-4" />{zh ? '提交质检结果' : 'Submit QC Result'}
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
            {zh ? '选择任务查看详情' : 'Select a task to view details'}
          </div>
        )}
      </div>
    </div>
  );
};
