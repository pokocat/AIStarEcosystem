"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DigitalPersonPanel — AI 数字人中心（制作工坊子 tab）。
// 模型库 + 生成任务双 tab；生成必须绑定已审通过的文案（业务约束在 server 端校验）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cpu, Mic, Shield, Zap, Lock, Eye, Video, RefreshCw, AlertTriangle,
} from "lucide-react";
import type {
  PersonModel,
  DigitalPersonGenTask,
  PersonModelType,
} from "@ai-star-eco/types/digital-person";
import { PERSON_MODELS as MODELS_SEED, GEN_TASKS as TASKS_SEED, DIGITAL_PERSON_KPI } from "@/mocks/digital-person";
import {
  PERSON_MODEL_STATUS_CONFIG,
  GEN_TASK_STATUS_CONFIG,
  qualityClassFor,
} from "@/constants/digital-person-ui";
import { DigitalPersonApi } from "@/api";

function fmtClock(sec: number): string {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DigitalPersonPanel() {
  const [models, setModels] = React.useState<PersonModel[]>(MODELS_SEED);
  const [genTasks, setGenTasks] = React.useState<DigitalPersonGenTask[]>(TASKS_SEED);
  const [tab, setTab] = React.useState<"models" | "tasks">("models");
  const [modelTypeFilter, setModelTypeFilter] = React.useState<PersonModelType | "all">("all");
  const [selectedModel, setSelectedModel] = React.useState<PersonModel | null>(MODELS_SEED[0] ?? null);
  const [showGenModal, setShowGenModal] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      DigitalPersonApi.listModels().catch(() => [] as PersonModel[]),
      DigitalPersonApi.listGenTasks().catch(() => [] as DigitalPersonGenTask[]),
    ]).then(([m, t]) => {
      if (cancelled) return;
      if (m.length > 0) { setModels(m); setSelectedModel(m[0] ?? null); }
      if (t.length > 0) setGenTasks(t);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredModels = models.filter(m => modelTypeFilter === "all" || m.type === modelTypeFilter);

  const stats = [
    { label: "形象模型",   value: models.filter(m => m.type === "appearance").length, color: "text-cyan-400" },
    { label: "声音模型",   value: models.filter(m => m.type === "voice").length, color: "text-purple-400" },
    { label: "今日生成",   value: DIGITAL_PERSON_KPI.todayGen, color: "text-pink-400" },
    { label: "审核中",     value: genTasks.filter(t => t.status === "review").length, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>AI 数字人中心</h1>
          <p className="text-xs text-gray-500 mt-1">形象授权管理 · 声音克隆 · 文案驱动生成 · 质量审核</p>
        </div>
        <button onClick={() => setShowGenModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition">
          <Zap className="w-3.5 h-3.5" />新建生成任务
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
        {(["models", "tasks"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? "border-emerald-400 text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
            {t === "models" ? "模型库" : "生成任务"}
          </button>
        ))}
      </div>

      {/* Models */}
      {tab === "models" && (
        <div>
          <div className="flex gap-2 mb-4">
            {(["all", "appearance", "voice"] as const).map(f => (
              <button key={f} onClick={() => setModelTypeFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${modelTypeFilter === f ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-gray-500 border-white/5 hover:border-white/15"}`}>
                {f === "all" ? "全部" : f === "appearance" ? "形象模型" : "声音模型"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredModels.map((model, i) => {
              const sCfg = PERSON_MODEL_STATUS_CONFIG[model.status];
              const SIcon = sCfg.icon;
              const isSelected = selectedModel?.id === model.id;
              return (
                <motion.div key={model.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedModel(isSelected ? null : model)}
                  className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition ${isSelected ? "border-emerald-500/35 bg-emerald-500/[0.03]" : "border-white/5 hover:border-white/15"} ${model.status === "frozen" ? "opacity-60" : ""}`}>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${model.color}15`, border: `1px solid ${model.color}30` }}>
                      {model.type === "appearance"
                        ? <Cpu className="w-5 h-5" style={{ color: model.color }} />
                        : <Mic className="w-5 h-5" style={{ color: model.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{model.name}</div>
                      <div className="text-[10px] text-gray-500">{model.partnerName} · {model.version}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      <SIcon className="w-2.5 h-2.5" />{sCfg.label}
                    </span>
                    <span className="text-[10px] text-gray-500">质量分：<span className={`font-bold ${qualityClassFor(model.quality)}`}>{model.quality}</span></span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-xs font-bold text-white">{model.usageCount}</div>
                      <div className="text-[9px] text-gray-600">使用次数</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2">
                      <div className="text-xs font-bold text-white">{model.lastUsed}</div>
                      <div className="text-[9px] text-gray-600">最近使用</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {model.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-500">{t}</span>
                    ))}
                  </div>

                  <div className="mt-2 text-[9px] text-gray-600 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-cyan-400" />
                    <span className="truncate">{model.authContract}</span>
                  </div>

                  {model.status === "frozen" && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1.5">
                      <Lock className="w-3 h-3 shrink-0" />授权过期，模型已冻结，不可用于生成
                    </div>
                  )}

                  {model.status === "active" && (
                    <button onClick={e => { e.stopPropagation(); setShowGenModal(true); }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition">
                      <Zap className="w-3 h-3" />用此模型生成
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks */}
      {tab === "tasks" && (
        <div className="space-y-3">
          {genTasks.map((task, i) => {
            const sCfg = GEN_TASK_STATUS_CONFIG[task.status];
            const SIcon = sCfg.icon;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/12 transition">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/8">
                    {task.status === "generating" ? <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" /> : <Video className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-white">{task.modelName}</span>
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                        <SIcon className="w-2.5 h-2.5" />{sCfg.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1">文案：{task.copyTitle}</div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
                      <span>{task.partnerName}</span>
                      <span>{task.platform}</span>
                      {task.duration > 0 && <span>{fmtClock(task.duration)}</span>}
                      <span>{task.createdAt}</span>
                      {task.qualityScore !== null && (
                        <span className="flex items-center gap-0.5">
                          质量分：<span className={`font-bold ${qualityClassFor(task.qualityScore)}`}>{task.qualityScore}</span>
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
                    {task.status === "approved" && (
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
                        <Zap className="w-3 h-3" />入发布池
                      </button>
                    )}
                    {task.status !== "generating" && (
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

      {/* Gen Modal */}
      <AnimatePresence>
        {showGenModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGenModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="text-base font-bold mb-4">新建数字人生成任务</div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">选择形象模型</label>
                  <div className="space-y-1.5">
                    {models.filter(m => m.type === "appearance" && m.status === "active").map(m => (
                      <button key={m.id} className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/8 hover:border-emerald-500/30 transition">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white">{m.name}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{m.partnerName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">选择声音模型</label>
                  <div className="space-y-1.5">
                    {models.filter(m => m.type === "voice" && m.status === "active").map(m => (
                      <button key={m.id} className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/8 hover:border-emerald-500/30 transition">
                        <Mic className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-white">{m.name}</span>
                        <span className="ml-auto text-[10px] text-gray-600">{m.partnerName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">选择已审文案（必选）</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/25">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400">只能使用已通过三阶段审核的文案</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowGenModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:border-white/20 transition">取消</button>
                  <button onClick={() => setShowGenModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition">
                    <Zap className="w-3.5 h-3.5 inline mr-1.5" />开始生成
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DigitalPersonPanel;
