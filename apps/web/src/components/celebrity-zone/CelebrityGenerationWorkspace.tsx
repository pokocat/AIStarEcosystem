"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CelebrityGenerationWorkspace.tsx
//   AI 明星专区 · 生成工作台 v3：模式 → 配置 → 生成中（冻结）→ 结果（预览/采纳/重生成）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { CelebrityModeSelect } from "./CelebrityModeSelect";
import { CelebrityTemplateGallery } from "./CelebrityTemplateGallery";
import { CelebrityTemplateConfig } from "./CelebrityTemplateConfig";
import { CelebrityBlindBox } from "./CelebrityBlindBox";
import { CelebrityGenerationProgress } from "./CelebrityGenerationProgress";
import { CelebrityGenerationResult } from "./CelebrityGenerationResult";

import {
  ACTIVE_STAR,
  CELEBRITY_TEMPLATES,
  CELEBRITY_PROJECTS,
  STAR_DETAIL_MAP,
  TEMPLATE_SHOWCASES,
  BLINDBOX_SHOWCASES,
} from "@/mocks/celebrity-zone";
import { ProductsApi } from "@/api";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityTemplate,
  CelebrityVideoDuration,
  GenerationMode,
} from "@/types/celebrity-zone";

type Step =
  | "mode"
  | "templateGallery"
  | "templateConfig"
  | "blindbox"
  | "result";

const STEP_TITLE: Record<Step, string> = {
  mode: "选择生成模式",
  templateGallery: "选择模板",
  templateConfig: "模板配置",
  blindbox: "AI 自主创作",
  result: "预览生成结果",
};

interface Props {
  /** 关联的明星 ID。未传时回退到默认 ACTIVE_STAR（兼容旧入口）。 */
  starId?: string;
}

interface PendingJob {
  product: CelebrityProductInput;
  engine: CelebrityEngine;
  duration: CelebrityVideoDuration;
  projectId: string;
  /** 触发来源（用于「重新生成」时返回原步骤） */
  source: "templateConfig" | "blindbox";
}

export function CelebrityGenerationWorkspace({ starId }: Props = {}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("mode");
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<CelebrityTemplate | null>(null);

  /** 生成中冻结状态：非空表示当前有正在跑的任务，弹出过渡层。 */
  const [pendingJob, setPendingJob] = React.useState<PendingJob | null>(null);
  /** 已完成生成（待预览采纳）的任务参数；与 step === "result" 配套。 */
  const [completedJob, setCompletedJob] = React.useState<PendingJob | null>(null);

  const star = (starId && STAR_DETAIL_MAP[starId]) || ACTIVE_STAR;

  const handleSelectMode = (mode: GenerationMode) => {
    if (mode === "template") setStep("templateGallery");
    else setStep("blindbox");
  };

  const handlePickTemplate = (tpl: CelebrityTemplate) => {
    setSelectedTemplate(tpl);
    setStep("templateConfig");
  };

  const handleBack = () => {
    if (pendingJob) return; // 生成中不允许后退
    if (step === "result") {
      // 从结果页返回 = 放弃当前预览，回到对应配置页
      const src = completedJob?.source ?? "templateConfig";
      setCompletedJob(null);
      setStep(src === "blindbox" ? "blindbox" : "templateConfig");
      return;
    }
    if (step === "templateConfig") setStep("templateGallery");
    else if (step === "templateGallery" || step === "blindbox") setStep("mode");
    else router.push(`/producer/celebrity-zone/star/${star.id}`);
  };

  // ── 生成生命周期 ────────────────────────────────────────────────────────
  const startJob = (job: PendingJob) => {
    setPendingJob(job);
    // 商品自动落库（不阻塞生成）
    if (job.product.name.trim()) {
      void ProductsApi.upsertFromGeneration({
        name: job.product.name,
        link: job.product.link,
        sellingPoints: job.product.sellingPoints,
        images: job.product.images,
      }).catch(() => {
        /* 落库失败不影响生成主流程 */
      });
    }
  };

  const handleProgressComplete = () => {
    if (!pendingJob) return;
    setCompletedJob(pendingJob);
    setPendingJob(null);
    setStep("result");
  };

  const handleProgressCancel = () => {
    setPendingJob(null);
    // 留在原配置页（templateConfig / blindbox），用户继续调整参数
  };

  const handleAdopt = () => {
    // 原型阶段：采纳 = 视为加入项目，回到模式选择并清空状态
    setCompletedJob(null);
    setSelectedTemplate(null);
    setStep("mode");
  };

  const handleRegenerate = () => {
    if (!completedJob) return;
    const job = completedJob;
    setCompletedJob(null);
    // 用同样参数再跑一次
    startJob(job);
  };

  const handleStartOver = () => {
    setCompletedJob(null);
    setSelectedTemplate(null);
    setStep("mode");
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {/* 顶部标题区 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            disabled={!!pendingJob}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 返回
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <h1 className="text-lg font-semibold tracking-tight text-white/90">
                AI 明星专区 · 生成工作台
              </h1>
              <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                v3
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-white/40">
              {STEP_TITLE[step]} · 模板/盲盒双模式 × 多引擎
            </p>
          </div>
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          <span className={step === "mode" ? "text-cyan-300" : ""}>① 模式</span>
          <span>›</span>
          <span
            className={
              step === "templateGallery" ||
              step === "blindbox" ||
              step === "templateConfig"
                ? "text-cyan-300"
                : ""
            }
          >
            ② 配置
          </span>
          <span>›</span>
          <span className={pendingJob ? "text-cyan-300" : ""}>③ 生成</span>
          <span>›</span>
          <span className={step === "result" ? "text-cyan-300" : ""}>④ 预览</span>
        </div>
      </div>

      <div className="flex-1">
        {step === "mode" && (
          <CelebrityModeSelect star={star} onSelectMode={handleSelectMode} />
        )}

        {step === "templateGallery" && (
          <CelebrityTemplateGallery
            star={star}
            templates={CELEBRITY_TEMPLATES}
            onPickTemplate={handlePickTemplate}
            onBack={() => setStep("mode")}
          />
        )}

        {step === "templateConfig" && selectedTemplate && (
          <CelebrityTemplateConfig
            star={star}
            template={selectedTemplate}
            projects={CELEBRITY_PROJECTS}
            showcases={TEMPLATE_SHOWCASES}
            onBackToGallery={() => setStep("templateGallery")}
            onGenerate={(payload) =>
              startJob({ ...payload, source: "templateConfig" })
            }
          />
        )}

        {step === "blindbox" && (
          <CelebrityBlindBox
            star={star}
            projects={CELEBRITY_PROJECTS}
            showcases={BLINDBOX_SHOWCASES}
            onGenerate={(payload) =>
              startJob({
                product: payload.product,
                engine: payload.engine,
                // 盲盒模式不传 duration，固定 30s
                duration: 30,
                projectId: payload.projectId,
                source: "blindbox",
              })
            }
          />
        )}

        {step === "result" && completedJob && (
          <CelebrityGenerationResult
            star={star}
            engine={completedJob.engine}
            product={completedJob.product}
            durationSec={completedJob.duration}
            onAdopt={handleAdopt}
            onRegenerate={handleRegenerate}
            onStartOver={handleStartOver}
            onDistribute={() =>
              router.push(
                `/producer/celebrity-zone/projects/${completedJob.projectId}?action=distribute`,
              )
            }
          />
        )}
      </div>

      {/* 生成中冻结过渡层 */}
      {pendingJob && (
        <CelebrityGenerationProgress
          star={star}
          engine={pendingJob.engine}
          productName={pendingJob.product.name}
          onComplete={handleProgressComplete}
          onCancel={handleProgressCancel}
        />
      )}
    </div>
  );
}
