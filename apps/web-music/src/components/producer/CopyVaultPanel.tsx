"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CopyVaultPanel — 文案库（素材中心子 tab）。
// 三阶段审批：ops_review → partner_review → legal_review → approved | rejected。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { motion } from "motion/react";
import {
  Search, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  CornerDownRight, Lock, Edit3,
} from "lucide-react";
import type {
  CopyItem, CopyApprovalStage,
} from "@ai-star-eco/types/copy";
import { COPIES as COPIES_SEED } from "@/mocks/copy";
import {
  COPY_TYPE_CONFIG,
  COPY_STAGE_CONFIG,
  APPROVAL_STEPS,
} from "@/constants/copy-ui";
import { CopyApi } from "@/api";

type StepStatus = "passed" | "rejected" | "current" | "pending";

function getStepStatus(copy: CopyItem, stepKey: string): StepStatus {
  const cfg = COPY_STAGE_CONFIG[copy.stage];
  const step = APPROVAL_STEPS.find(s => s.key === stepKey);
  if (!step) return "pending";
  const comment = copy.comments.find(c => c.stage === step.stageName);
  if (copy.stage === "rejected" && comment && !comment.passed) return "rejected";
  if (comment?.passed) return "passed";
  if (copy.stage === stepKey) return "current";
  const stepIdx = APPROVAL_STEPS.findIndex(s => s.key === stepKey);
  if (cfg.step > stepIdx + 1) return "passed";
  return "pending";
}

export function CopyVaultPanel() {
  const [copies, setCopies] = React.useState<CopyItem[]>(COPIES_SEED);
  const [search, setSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<CopyApprovalStage | "all">("all");
  const [selectedCopy, setSelectedCopy] = React.useState<CopyItem | null>(COPIES_SEED[0] ?? null);

  React.useEffect(() => {
    let cancelled = false;
    CopyApi.listCopies().then(c => {
      if (cancelled) return;
      if (c.length > 0) {
        setCopies(c);
        setSelectedCopy(c[0] ?? null);
      }
    }).catch(() => { /* mock fallback */ });
    return () => { cancelled = true; };
  }, []);

  const filtered = copies.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || c.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const stats = [
    { label: "总文案",  value: copies.length, color: "text-white" },
    { label: "已通过",  value: copies.filter(c => c.stage === "approved").length, color: "text-emerald-400" },
    { label: "审核中",  value: copies.filter(c => ["ops_review", "partner_review", "legal_review"].includes(c.stage)).length, color: "text-amber-400" },
    { label: "已驳回",  value: copies.filter(c => c.stage === "rejected").length, color: "text-red-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>文案库</h1>
          <p className="text-xs text-gray-500 mt-1">文案录入 · 三阶段双审 · 版本锁定 · 禁用词检测</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition">
          <Plus className="w-3.5 h-3.5" />新增文案
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

      {/* Split panel */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-4" style={{ minHeight: 520 }}>
        {/* List */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文案..."
                className="w-full bg-black/30 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "approved", "partner_review", "ops_review", "rejected"] as const).map(s => {
                const scfg = s === "all" ? null : COPY_STAGE_CONFIG[s];
                return (
                  <button key={s} onClick={() => setStageFilter(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition border ${stageFilter === s ? (s === "all" ? "bg-white/10 text-white border-white/20" : `${scfg!.bg} ${scfg!.color} ${scfg!.border}`) : "bg-white/3 text-gray-500 border-white/5 hover:border-white/15"}`}>
                    {s === "all" ? "全部" : scfg!.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.map((c, i) => {
              const tCfg = COPY_TYPE_CONFIG[c.type];
              const sCfg = COPY_STAGE_CONFIG[c.stage];
              const isSelected = selectedCopy?.id === c.id;
              return (
                <motion.button key={c.id} onClick={() => setSelectedCopy(c)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`w-full text-left p-3 rounded-xl transition border ${isSelected ? "bg-amber-500/5 border-amber-500/25" : "bg-black/20 border-white/5 hover:border-white/15"}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${tCfg.bg} ${tCfg.color}`}>{tCfg.label}</span>
                    <span className="text-xs font-semibold text-white truncate">{c.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">{c.partnerScope} · V{c.version}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>{sCfg.label}</span>
                  </div>
                  {c.riskFlags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] text-red-400">含风险词：{c.riskFlags.join("、")}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        {selectedCopy ? (
          <motion.div key={selectedCopy.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-bold text-white">{selectedCopy.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {selectedCopy.partnerScope} · {selectedCopy.productScope} · V{selectedCopy.version} · {selectedCopy.author}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {selectedCopy.stage === "approved" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />已锁定版本
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {selectedCopy.platformScope.map(p => (
                  <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">{p}</span>
                ))}
                <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                  {selectedCopy.validFrom} ~ {selectedCopy.validTo}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Content */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">文案内容</div>
                <div className="bg-black/30 border border-white/8 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                  {selectedCopy.content}
                  {selectedCopy.riskFlags.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-red-400 font-bold mb-1">检测到风险词</div>
                        <div className="flex gap-1 flex-wrap">
                          {selectedCopy.riskFlags.map(f => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">&quot;{f}&quot;</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3-stage tracker */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">三阶段审批流程</div>
                <div className="space-y-2">
                  {APPROVAL_STEPS.map(step => {
                    const StepIcon = step.icon;
                    const stepStatus = getStepStatus(selectedCopy, step.key);
                    const comment = selectedCopy.comments.find(c => c.stage === step.stageName);
                    return (
                      <div key={step.key} className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                        stepStatus === "passed" ? "bg-emerald-500/5 border-emerald-500/20"
                        : stepStatus === "current" ? "bg-amber-500/5 border-amber-500/25"
                        : stepStatus === "rejected" ? "bg-red-500/5 border-red-500/20"
                        : "bg-black/20 border-white/5 opacity-40"
                      }`}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${step.color}15` }}>
                          {stepStatus === "passed" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : stepStatus === "rejected" ? <XCircle className="w-4 h-4 text-red-400" />
                            : stepStatus === "current" ? <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                            : <StepIcon className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{step.label}</span>
                            {stepStatus === "current" && <span className="text-[9px] text-amber-400 font-bold animate-pulse">审核中</span>}
                          </div>
                          {comment && (
                            <div className="mt-1">
                              <div className="text-[10px] text-gray-500">
                                {comment.author} · {comment.time ? new Date(comment.time).toLocaleString("zh-CN") : "处理中..."}
                              </div>
                              {comment.text && (
                                <div className="flex items-start gap-1 mt-0.5">
                                  <CornerDownRight className="w-2.5 h-2.5 text-gray-600 mt-0.5 shrink-0" />
                                  <span className="text-[10px] text-gray-400">{comment.text}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedCopy.stage !== "approved" && selectedCopy.stage !== "rejected" && (
              <div className="p-4 border-t border-white/5 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition">
                  <CheckCircle2 className="w-3.5 h-3.5" />通过
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition">
                  <XCircle className="w-3.5 h-3.5" />驳回
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                  <Edit3 className="w-3.5 h-3.5" />修改
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
            选择文案查看详情
          </div>
        )}
      </div>
    </div>
  );
}

export default CopyVaultPanel;
