"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ClipStudioPanel — 真人切片制作台（制作工坊子 tab）。
// 6 项强制质检：黑屏 / 字幕 / 画幅 / 敏感词 / 品牌露出 / 授权范围。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus, Scissors, Search, Shield, Video, Eye, Zap, CheckCircle2,
  XCircle, Clock,
} from "lucide-react";
import type { ClipTask, ClipTaskStatus } from "@ai-star-eco/types/clip-studio";
import {
  CLIP_TASKS as TASKS_SEED,
  CLIP_STUDIO_KPI,
  deriveQcForTask,
} from "@/mocks/clip-studio";
import {
  CLIP_TASK_STATUS_CONFIG,
  CLIP_SOURCE_TYPE_CONFIG,
  DEMO_CLIP_DURATIONS,
} from "@/constants/clip-studio-ui";
import { ClipStudioApi } from "@/api";

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClipStudioPanel() {
  const [tasks, setTasks] = React.useState<ClipTask[]>(TASKS_SEED);
  const [selectedTask, setSelectedTask] = React.useState<ClipTask | null>(TASKS_SEED[0] ?? null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ClipTaskStatus | "all">("all");

  React.useEffect(() => {
    let cancelled = false;
    ClipStudioApi.listTasks().then(t => {
      if (cancelled) return;
      if (t.length > 0) {
        setTasks(t);
        setSelectedTask(t[0] ?? null);
      }
    }).catch(() => { /* mock fallback */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = tasks.filter(t => {
    const matchSearch = t.sourceTitle.toLowerCase().includes(search.toLowerCase()) || t.partnerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = [
    { label: "进行中任务",   value: tasks.filter(t => t.status === "in_progress" || t.status === "quality_check").length, color: "text-blue-400" },
    { label: "今日完成",     value: CLIP_STUDIO_KPI.todayDone, color: "text-emerald-400" },
    { label: "质检通过率",   value: CLIP_STUDIO_KPI.qcPassRate, color: "text-amber-400" },
    { label: "已入发布池",   value: CLIP_STUDIO_KPI.inPool, color: "text-purple-400" },
  ];

  const qcItems = selectedTask ? deriveQcForTask(selectedTask) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>真人切片制作台</h1>
          <p className="text-xs text-gray-500 mt-1">授权素材切片 · 6 项质检 · 批量出片 · 协作制作</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition">
          <Plus className="w-3.5 h-3.5" />新建制作任务
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Split */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 540 }}>
        {/* List */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索制作任务..."
                className="w-full bg-black/30 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-pink-500/40 transition" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "in_progress", "quality_check", "review", "completed"] as const).map(s => {
                const scfg = s === "all" ? null : CLIP_TASK_STATUS_CONFIG[s];
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition ${statusFilter === s ? (s === "all" ? "bg-white/10 text-white border-white/20" : `${scfg!.bg} ${scfg!.color} ${scfg!.border}`) : "bg-white/3 text-gray-500 border-white/5 hover:border-white/15"}`}>
                    {s === "all" ? "全部" : scfg!.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.map((task, i) => {
              const sCfg = CLIP_TASK_STATUS_CONFIG[task.status];
              const SIcon = sCfg.icon;
              const srcCfg = CLIP_SOURCE_TYPE_CONFIG[task.sourceType];
              const isSelected = selectedTask?.id === task.id;
              const passPct = task.totalClips > 0 ? Math.round((task.passedClips / task.totalClips) * 100) : 0;
              return (
                <motion.button key={task.id} onClick={() => setSelectedTask(task)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`w-full text-left p-3 rounded-xl border transition ${isSelected ? "bg-pink-500/5 border-pink-500/25" : "bg-black/20 border-white/5 hover:border-white/15"}`}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <Scissors className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-white leading-snug truncate">{task.sourceTitle}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${srcCfg.color}15`, color: srcCfg.color }}>{srcCfg.label}</span>
                    <span className="text-[10px] text-gray-500">{task.partnerName}</span>
                    <span className="text-[10px] text-gray-600 ml-auto">{task.assignee}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      <SIcon className="w-2.5 h-2.5" />{sCfg.label}
                    </span>
                    <span className="text-[10px] text-gray-500">{task.passedClips}/{task.totalClips} 通过</span>
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

        {/* Detail */}
        {selectedTask ? (
          <motion.div key={selectedTask.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="text-sm font-bold text-white mb-1">{selectedTask.sourceTitle}</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                <span>{selectedTask.partnerName}</span>
                <span>{selectedTask.productScope}</span>
                <span>截止：{selectedTask.deadline}</span>
                <span>授权合同：{selectedTask.authContract}</span>
                <span>文案版本：{selectedTask.copyVersion}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 6-point QC */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">6 项强制质检</div>
                <div className="grid grid-cols-2 gap-2">
                  {qcItems.map(qc => (
                    <div key={qc.id} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs ${
                      qc.passed === true ? "bg-emerald-500/5 border-emerald-500/20"
                      : qc.passed === false ? "bg-red-500/5 border-red-500/20"
                      : "bg-white/[0.03] border-white/8"
                    }`}>
                      {qc.passed === true ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : qc.passed === false ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        : <Clock className="w-4 h-4 text-gray-600 shrink-0 animate-pulse" />}
                      <span className={qc.passed === true ? "text-gray-300" : qc.passed === false ? "text-red-300" : "text-gray-600"}>
                        {qc.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clip list (demo) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider">切片列表</div>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-pink-500/10 border border-pink-500/25 text-pink-400 hover:bg-pink-500/20 transition">
                    <Plus className="w-3 h-3" />新增切片
                  </button>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: Math.min(selectedTask.totalClips, 5) }, (_, ci) => {
                    const isPass = ci < selectedTask.passedClips;
                    const isFail = ci === selectedTask.passedClips && selectedTask.failedClips > 0;
                    return (
                      <div key={ci} className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isPass ? "bg-emerald-500/[0.03] border-emerald-500/15"
                        : isFail ? "bg-red-500/[0.03] border-red-500/15"
                        : "bg-black/20 border-white/5"
                      }`}>
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <Video className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">Clip-{String(ci + 1).padStart(2, "0")} · {fmtClock(DEMO_CLIP_DURATIONS[ci] ?? 30)}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {isPass ? "质检通过，待入发布池"
                              : isFail ? "敏感词检测未通过，需修改"
                              : "等待质检..."}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {isPass && (
                            <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                              <Zap className="w-2.5 h-2.5" />入池
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
                      另有 {selectedTask.totalClips - 5} 个切片...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedTask.status === "quality_check" && (
              <div className="p-4 border-t border-white/5">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-pink-500/10 border border-pink-500/30 text-pink-400 hover:bg-pink-500/20 transition">
                  <Shield className="w-4 h-4" />提交质检结果
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
            选择任务查看详情
          </div>
        )}
      </div>
    </div>
  );
}

export default ClipStudioPanel;
