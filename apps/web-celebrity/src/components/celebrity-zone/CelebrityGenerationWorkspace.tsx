"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CelebrityGenerationWorkspace.tsx
//   AI 明星专区 · 生成工作台 v3：模式 → 配置 → 生成中（后台浮卡）→ 结果（预览/采纳/重生成）
//   v3.1：生成任务异步落 localStorage（CelebrityJobs），刷新可恢复，跨 tab 仍可看到进度。
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
import { startGeneration } from "@/api/celebrity-zone";
import { CelebrityJobs, type PendingJobRecord } from "@/lib/celebrity-jobs";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityTemplate,
  CelebrityVideoDuration,
  GenerationMode,
} from "@ai-star-eco/types/celebrity-zone";

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
  /** 深链恢复：`?jobId=` 透传，进入页面时从 localStorage 找回任务并续算进度。 */
  jobId?: string;
}

interface PendingJobInput {
  product: CelebrityProductInput;
  engine: CelebrityEngine;
  duration: CelebrityVideoDuration;
  projectId: string;
  source: "templateConfig" | "blindbox";
  templateId?: string;
}

export function CelebrityGenerationWorkspace({ starId, jobId }: Props = {}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("mode");
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<CelebrityTemplate | null>(null);

  /** 当前正在跑的任务记录（来自 localStorage / 新建）；非空表示有进行中任务。 */
  const [activeJob, setActiveJob] = React.useState<PendingJobRecord | null>(null);
  /** 已完成待预览采纳的任务；与 step === "result" 配套。 */
  const [completedJob, setCompletedJob] = React.useState<PendingJobRecord | null>(null);

  const star = (starId && STAR_DETAIL_MAP[starId]) || ACTIVE_STAR;

  // ── Mount: 深链恢复（?jobId / 当前明星最近一条 running） ────────────────────
  React.useEffect(() => {
    let target: PendingJobRecord | null = null;
    if (jobId) target = CelebrityJobs.get(jobId);
    if (!target) target = CelebrityJobs.findRunningForArtist(star.id);
    // 也找一下"已完成但未采纳"的任务（让用户回到 result 页面查看）
    if (!target) {
      const completed = CelebrityJobs.listCompleted().find((r) => r.artistId === star.id);
      if (completed) {
        setCompletedJob(completed);
        setStep("result");
        return;
      }
    }
    if (!target) return;
    if (target.status === "running") {
      setActiveJob(target);
    } else if (target.status === "completed") {
      setCompletedJob(target);
      setStep("result");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, star.id]);

  // ── 订阅 jobs 变化（其他页面 markCompleted 时本页要响应） ──────────────────
  React.useEffect(() => {
    return CelebrityJobs.subscribe(() => {
      if (!activeJob) return;
      const fresh = CelebrityJobs.get(activeJob.jobId);
      if (!fresh) {
        setActiveJob(null);
        return;
      }
      if (fresh.status === "completed") {
        setActiveJob(null);
        setCompletedJob(fresh);
        setStep("result");
      } else {
        setActiveJob(fresh);
      }
    });
  }, [activeJob]);

  const handleSelectMode = (mode: GenerationMode) => {
    if (mode === "template") setStep("templateGallery");
    else setStep("blindbox");
  };

  const handlePickTemplate = (tpl: CelebrityTemplate) => {
    setSelectedTemplate(tpl);
    setStep("templateConfig");
  };

  const handleBack = () => {
    if (step === "result") {
      const src = completedJob?.source ?? "templateConfig";
      // 不从 localStorage 删除：用户可能改主意回到 result 通过徽章再访问
      setCompletedJob(null);
      setStep(src === "blindbox" ? "blindbox" : "templateConfig");
      return;
    }
    if (step === "templateConfig") setStep("templateGallery");
    else if (step === "templateGallery" || step === "blindbox") setStep("mode");
    else router.push(`/producer/celebrity-zone/star/${star.id}`);
  };

  // ── 生成生命周期 ────────────────────────────────────────────────────────
  const startJob = async (input: PendingJobInput) => {
    // 1) 调后端拿 jobId（mock 也会返回）
    const job = await startGeneration({
      starId: star.id,
      mode: input.source === "blindbox" ? "blindbox" : "template",
      templateId: input.templateId ?? selectedTemplate?.id,
      product: input.product,
      engine: input.engine,
      duration: input.duration,
      projectId: input.projectId,
    }).catch(() => ({
      jobId: `local-${Date.now()}`,
      status: "queued" as const,
      pollUrl: "",
      pollIntervalMs: 3000,
      estimatedSeconds: undefined,
    }));

    const project = CELEBRITY_PROJECTS.find((p) => p.id === input.projectId);
    const meta = ENGINE_META[input.engine];

    const record: PendingJobRecord = {
      jobId: job.jobId,
      artistId: star.id,
      artistName: star.name,
      artistAvatar: star.avatar,
      projectId: input.projectId,
      projectName: project?.name,
      source: input.source,
      templateId: input.templateId ?? selectedTemplate?.id,
      product: input.product,
      engine: input.engine,
      duration: input.duration,
      creditPrice: meta.creditPrice,
      startedAt: CelebrityJobs.nowIso(),
      // 演示用估时：经济 6s / 标准 8s / 高级 10s
      estimatedSeconds: defaultSeconds(input.engine),
      status: "running",
    };
    CelebrityJobs.enqueue(record);
    setActiveJob(record);

    // 商品自动落库（不阻塞）
    if (input.product.name.trim()) {
      void ProductsApi.upsertFromGeneration({
        name: input.product.name,
        link: input.product.link,
        sellingPoints: input.product.sellingPoints,
        images: input.product.images,
      }).catch(() => {
        /* ignore */
      });
    }
  };

  const handleProgressComplete = () => {
    if (!activeJob) return;
    const result = {
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumb: star.cover,
    };
    CelebrityJobs.markCompleted(activeJob.jobId, result);
    const updated = CelebrityJobs.get(activeJob.jobId);
    setActiveJob(null);
    if (updated) {
      setCompletedJob(updated);
      setStep("result");
    }
  };

  const handleAdopt = () => {
    if (completedJob) CelebrityJobs.remove(completedJob.jobId);
    setCompletedJob(null);
    setSelectedTemplate(null);
    setStep("mode");
  };

  const handleRegenerate = () => {
    if (!completedJob) return;
    const job = completedJob;
    CelebrityJobs.remove(job.jobId);
    setCompletedJob(null);
    void startJob({
      product: job.product,
      engine: job.engine,
      duration: job.duration,
      projectId: job.projectId,
      source: job.source,
      templateId: job.templateId,
    });
  };

  const handleStartOver = () => {
    if (completedJob) CelebrityJobs.remove(completedJob.jobId);
    setCompletedJob(null);
    setSelectedTemplate(null);
    setStep("mode");
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {/* 工作台标题区（layout 已渲染顶部 tabs/面包屑，这里只放工作台子标题 + 返回） */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/30 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 返回
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <h1 className="text-lg font-semibold tracking-tight text-white/90">
                生成工作台
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
          <span className={activeJob ? "text-cyan-300" : ""}>③ 生成</span>
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
              void startJob({
                ...payload,
                source: "templateConfig",
                templateId: selectedTemplate.id,
              })
            }
          />
        )}

        {step === "blindbox" && (
          <CelebrityBlindBox
            star={star}
            projects={CELEBRITY_PROJECTS}
            showcases={BLINDBOX_SHOWCASES}
            onGenerate={(payload) =>
              void startJob({
                product: payload.product,
                engine: payload.engine,
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

      {/* 生成中悬浮卡（不阻断页面，可最小化为右下角胶囊） */}
      {activeJob && (
        <CelebrityGenerationProgress
          star={star}
          engine={activeJob.engine}
          productName={activeJob.product.name}
          creditPrice={activeJob.creditPrice}
          startedAtMs={Date.parse(activeJob.startedAt)}
          estimatedSeconds={activeJob.estimatedSeconds}
          onComplete={handleProgressComplete}
        />
      )}
    </div>
  );
}

function defaultSeconds(engine: CelebrityEngine): number {
  switch (engine) {
    case "KeLing":
      return 6;
    case "MiniMax":
      return 10;
    default:
      return 8;
  }
}
