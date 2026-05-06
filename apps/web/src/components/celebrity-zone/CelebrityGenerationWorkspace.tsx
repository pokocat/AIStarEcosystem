"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CelebrityGenerationWorkspace.tsx
//   AI 明星专区 · 生成工作台 v3：模板/盲盒双模式 × 多引擎 × 模板库浏览。
//   设计源：figma 「AI明星专区-生成工作台 v3」 + project README。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { CelebrityModeSelect } from "./CelebrityModeSelect";
import { CelebrityTemplateGallery } from "./CelebrityTemplateGallery";
import { CelebrityTemplateConfig } from "./CelebrityTemplateConfig";
import { CelebrityBlindBox } from "./CelebrityBlindBox";

import {
  ACTIVE_STAR,
  CELEBRITY_TEMPLATES,
  CELEBRITY_PROJECTS,
  TEMPLATE_SHOWCASES,
  BLINDBOX_SHOWCASES,
} from "@/mocks/celebrity-zone";
import type { CelebrityTemplate, GenerationMode } from "@/types/celebrity-zone";

type Step = "mode" | "templateGallery" | "templateConfig" | "blindbox";

const STEP_TITLE: Record<Step, string> = {
  mode: "选择生成模式",
  templateGallery: "选择模板",
  templateConfig: "模板配置",
  blindbox: "AI 自主创作",
};

export function CelebrityGenerationWorkspace() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("mode");
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<CelebrityTemplate | null>(null);

  const star = ACTIVE_STAR;

  const handleSelectMode = (mode: GenerationMode) => {
    if (mode === "template") setStep("templateGallery");
    else setStep("blindbox");
  };

  const handlePickTemplate = (tpl: CelebrityTemplate) => {
    setSelectedTemplate(tpl);
    setStep("templateConfig");
  };

  const handleBack = () => {
    if (step === "templateConfig") setStep("templateGallery");
    else if (step === "templateGallery" || step === "blindbox") setStep("mode");
    else router.push("/producer");
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {/* 顶部标题区 */}
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

        {/* 步骤指示（仅展示） */}
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          <span className={step === "mode" ? "text-cyan-300" : ""}>① 模式</span>
          <span>›</span>
          <span
            className={
              step === "templateGallery" || step === "blindbox" ? "text-cyan-300" : ""
            }
          >
            ② 配置
          </span>
          <span>›</span>
          <span className={step === "templateConfig" ? "text-cyan-300" : ""}>
            ③ 引擎与生成
          </span>
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
            onGenerate={(_payload) => {
              // 生产环境接 CelebrityZoneApi.startGeneration；当前为前端原型，仅切回模式选择
              setStep("mode");
            }}
          />
        )}

        {step === "blindbox" && (
          <CelebrityBlindBox
            star={star}
            projects={CELEBRITY_PROJECTS}
            showcases={BLINDBOX_SHOWCASES}
            onGenerate={(_payload) => {
              setStep("mode");
            }}
          />
        )}
      </div>
    </div>
  );
}
