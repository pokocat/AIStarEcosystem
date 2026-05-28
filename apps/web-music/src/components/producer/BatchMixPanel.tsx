"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BatchMixPanel — 混剪批量生产台（制作工坊子 tab）。
// 模板库 + 批量任务 + 新建任务 三 tab；新建任务用模板槽位填充。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Layers, Plus, Play, Zap, CheckCircle2, Clock, RefreshCw, Eye,
  Grid3X3, List, ArrowRight,
} from "lucide-react";
import type { MixTemplate, BatchTask } from "@ai-star-eco/types/batch-mix";
import {
  MIX_TEMPLATES as TEMPLATES_SEED,
  BATCH_TASKS as TASKS_SEED,
  SLOTS_DEMO,
  BATCH_COUNT_TIERS,
  BATCH_MIX_KPI,
} from "@/mocks/batch-mix";
import {
  MIX_TEMPLATE_TYPE_CONFIG,
  RENDER_STATUS_CONFIG,
  MIX_SLOT_KIND_ICON,
} from "@/constants/batch-mix-ui";
import { BatchMixApi } from "@/api";

export function BatchMixPanel() {
  const [templates, setTemplates] = React.useState<MixTemplate[]>(TEMPLATES_SEED);
  const [tasks, setTasks] = React.useState<BatchTask[]>(TASKS_SEED);
  const [tab, setTab] = React.useState<"templates" | "tasks" | "new">("templates");
  const [selectedTemplate, setSelectedTemplate] = React.useState<MixTemplate | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [selectedCount, setSelectedCount] = React.useState<number>(20);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      BatchMixApi.listTemplates().catch(() => [] as MixTemplate[]),
      BatchMixApi.listTasks().catch(() => [] as BatchTask[]),
    ]).then(([tpl, tk]) => {
      if (cancelled) return;
      if (tpl.length > 0) setTemplates(tpl);
      if (tk.length > 0) setTasks(tk);
    });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { label: "可用模板",     value: templates.length, color: "text-purple-400" },
    { label: "渲染中",       value: tasks.filter(t => t.status === "rendering").length, color: "text-blue-400" },
    { label: "今日完成",     value: BATCH_MIX_KPI.todayDone, color: "text-emerald-400" },
    { label: "待入发布池",   value: BATCH_MIX_KPI.poolReady, color: "text-cyan-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>混剪批量生产台</h1>
          <p className="text-xs text-gray-500 mt-1">模板驱动 · 素材矩阵组合 · 批量渲染 · 一键入发布池</p>
        </div>
        <button onClick={() => setTab("new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition">
          <Plus className="w-3.5 h-3.5" />新建批量任务
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([
          ["templates", "模板库"] as const,
          ["tasks", "批量任务"] as const,
          ["new", "新建任务"] as const,
        ]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? "border-orange-400 text-orange-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Templates */}
      {tab === "templates" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg transition ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg transition ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
              <Plus className="w-3 h-3" />创建模板
            </button>
          </div>

          <div className={viewMode === "grid" ? "grid md:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-3"}>
            {templates.map((tmpl, i) => {
              const isSelected = selectedTemplate?.id === tmpl.id;
              return (
                <motion.div key={tmpl.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedTemplate(isSelected ? null : tmpl)}
                  className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${isSelected ? "border-orange-500/35 bg-orange-500/[0.03]" : "border-white/5 hover:border-white/15"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${tmpl.color}15`, border: `1px solid ${tmpl.color}30` }}>
                      <Layers className="w-5 h-5" style={{ color: tmpl.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">{tmpl.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{MIX_TEMPLATE_TYPE_CONFIG[tmpl.type].label} · {tmpl.duration}</div>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{tmpl.description}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {tmpl.platforms.map(p => (
                      <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-400">{p}</span>
                    ))}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-400">{tmpl.slots} 素材槽</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-xs font-bold text-white">{tmpl.usageCount}</div>
                      <div className="text-[9px] text-gray-600">使用次数</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className={`text-xs font-bold ${tmpl.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}`}>{tmpl.successRate}%</div>
                      <div className="text-[9px] text-gray-600">成功率</div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="mt-3 pt-3 border-t border-white/5">
                        <button onClick={() => setTab("new")}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition">
                          <Zap className="w-3.5 h-3.5" />使用此模板新建任务
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {tasks.map((task, i) => {
            const rCfg = RENDER_STATUS_CONFIG[task.status];
            const pct = task.totalCount > 0 ? Math.round((task.completedCount / task.totalCount) * 100) : 0;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rCfg.bg} ${rCfg.border} border`}>
                    {task.status === "rendering" ? <RefreshCw className={`w-5 h-5 ${rCfg.color} animate-spin`} />
                      : task.status === "done" ? <CheckCircle2 className={`w-5 h-5 ${rCfg.color}`} />
                      : <Clock className={`w-5 h-5 ${rCfg.color}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{task.name}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${rCfg.bg} ${rCfg.color} ${rCfg.border}`}>
                        {rCfg.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-2">{task.templateName} · {task.partnerName}</div>
                    {task.status !== "pending" && (
                      <>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                          <span>{task.completedCount}/{task.totalCount} 完成</span>
                          {task.failedCount > 0 && <span className="text-red-400">{task.failedCount} 失败</span>}
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${task.status === "done" ? "bg-emerald-500" : "bg-orange-500"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {task.status === "done" && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 transition">
                        <Zap className="w-3 h-3" />批量入池
                      </button>
                    )}
                    {task.status === "pending" && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition">
                        <Play className="w-3 h-3" />开始渲染
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

      {/* New task */}
      {tab === "new" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          {/* Template selector */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">选择模板</div>
            <div className="space-y-2">
              {templates.map(tmpl => (
                <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl)}
                  className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition ${selectedTemplate?.id === tmpl.id ? "bg-orange-500/[0.08] border-orange-500/25" : "bg-black/20 border-white/5 hover:border-white/15"}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tmpl.color}20` }}>
                    <Layers className="w-3.5 h-3.5" style={{ color: tmpl.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-white truncate">{tmpl.name}</div>
                    <div className="text-[9px] text-gray-600">{tmpl.duration} · {tmpl.slots} 个槽</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Slot filler */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-white">{selectedTemplate?.name || "请先选择模板"}</div>
                {selectedTemplate && (
                  <span className="text-[10px] text-gray-500">{SLOTS_DEMO.filter(s => s.filled).length}/{SLOTS_DEMO.length} 槽已填充</span>
                )}
              </div>
              <div>
                <label className="text-[10px] text-gray-600 uppercase tracking-wider block mb-1">任务名称</label>
                <input placeholder="输入批量任务名称..."
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 transition" />
              </div>
            </div>

            {selectedTemplate ? (
              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">素材槽填充</div>
                {SLOTS_DEMO.map(slot => {
                  const SlotIcon = MIX_SLOT_KIND_ICON[slot.kind];
                  return (
                    <div key={slot.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${slot.filled ? "bg-emerald-500/[0.03] border-emerald-500/15" : "bg-black/20 border-dashed border-white/15 hover:border-orange-500/30 cursor-pointer"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${slot.filled ? "bg-emerald-500/10" : "bg-white/5"}`}>
                        <SlotIcon className={`w-4 h-4 ${slot.filled ? "text-emerald-400" : "text-gray-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 mb-0.5">{slot.label}</div>
                        {slot.filled ? (
                          <div className="text-xs text-white truncate">{slot.content}</div>
                        ) : (
                          <div className="text-[10px] text-gray-700">点击从资产库选取...</div>
                        )}
                      </div>
                      {slot.filled
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <Plus className="w-4 h-4 text-gray-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                选择模板后配置素材槽
              </div>
            )}

            {selectedTemplate && (
              <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider">批量数量：</label>
                  <div className="flex gap-1">
                    {BATCH_COUNT_TIERS.map(n => (
                      <button key={n} onClick={() => setSelectedCount(n)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${selectedCount === n ? "bg-orange-500/15 text-orange-400 border-orange-500/25" : "bg-white/5 text-gray-500 border-white/8 hover:border-white/20"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition">
                  <Zap className="w-4 h-4" />开始批量渲染 ({selectedCount} 个)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchMixPanel;
