"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Film, Lightbulb, Wallet } from "lucide-react";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { CelebrityProductForm } from "./CelebrityProductForm";
import { CelebrityEngineSelect } from "./CelebrityEngineSelect";
import { DURATION_OPTIONS, ENGINE_META } from "@/constants/celebrity-zone-ui";
import { formatCredits } from "@/lib/format";
import { useProducerShell } from "@/lib/producer-shell-context";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityShowcase,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityVideoDuration,
  CelebrityProject,
  TemplateConfigStep,
} from "@/types/celebrity-zone";
import { cn } from "@/components/ui/utils";

interface Props {
  star: CelebrityStar;
  template: CelebrityTemplate;
  projects: CelebrityProject[];
  showcases: CelebrityShowcase[];
  onBackToGallery: () => void;
  onGenerate: (payload: {
    product: CelebrityProductInput;
    engine: CelebrityEngine;
    duration: CelebrityVideoDuration;
    projectId: string;
  }) => void;
}

const STEP_LABEL: Record<TemplateConfigStep, string> = {
  selectTemplate: "选模板",
  fillProduct: "填商品",
  selectEngine: "选引擎",
  generate: "生成",
};

const STEP_ORDER: TemplateConfigStep[] = ["selectTemplate", "fillProduct", "selectEngine", "generate"];

/** Step 2a-config：模板配置页（含进度条 + 引擎选择 + 预览）。 */
export function CelebrityTemplateConfig({
  star,
  template,
  projects,
  showcases,
  onBackToGallery,
  onGenerate,
}: Props) {
  const [product, setProduct] = React.useState<CelebrityProductInput>({
    name: "",
    link: "",
    sellingPoints: "",
  });
  const [engine, setEngine] = React.useState<CelebrityEngine>(template.recommendedEngine);
  const [duration, setDuration] = React.useState<CelebrityVideoDuration>(30);
  const [projectId, setProjectId] = React.useState<string>(projects[0]?.id ?? "");

  // 当前步骤推断
  const currentStep: TemplateConfigStep = React.useMemo(() => {
    if (!product.name) return "fillProduct";
    if (!engine) return "selectEngine";
    return "generate";
  }, [product.name, engine]);

  const meta = ENGINE_META[engine];
  const cost = meta.cost;
  const creditPrice = meta.creditPrice;
  const quotaUsed = star.quotaUsed ?? 0;
  const quotaTotal = star.quotaTotal ?? 0;
  const remaining = quotaTotal - quotaUsed;
  const { wallet } = useProducerShell();
  const walletBalance = wallet?.totalBalance ?? 0;
  const insufficientCredits = creditPrice > walletBalance;
  const insufficientQuota = cost > remaining && quotaTotal > 0;
  const cannotGenerate =
    !product.name.trim() || !projectId || insufficientCredits;

  return (
    <div className="flex flex-col gap-5">
      {/* 进度步骤条 */}
      <div className="grid grid-cols-4 gap-2">
        {STEP_ORDER.map((step, i) => {
          const order = STEP_ORDER.indexOf(currentStep);
          const isDone = i < order || step === "selectTemplate";
          const isActive = step === currentStep;
          return (
            <div
              key={step}
              className={cn(
                "flex items-center justify-center gap-1.5 border-b-2 pb-2 text-xs font-medium transition",
                isDone
                  ? "border-emerald-400 text-emerald-300"
                  : isActive
                    ? "border-cyan-400 text-cyan-300"
                    : "border-white/10 text-white/30",
              )}
            >
              {isDone && <Check className="h-3 w-3" />}
              {STEP_LABEL[step]}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,11fr)_minmax(0,14fr)]">
        {/* 左：配置区 */}
        <div className="flex flex-col gap-4">
          {/* 模板信息卡 */}
          <div className="flex gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
            <div className="w-[64px] shrink-0">
              <CelebrityVideoPlayer
                src={template.previews?.[0]?.videoUrl ?? ""}
                poster={template.previews?.[0]?.thumb}
                aspect="9/16"
              />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="text-sm font-semibold text-white/85">{template.name}模板</div>
              <p className="mt-0.5 text-[11px] leading-snug text-white/45 line-clamp-2">
                {template.description}
              </p>
              <button
                onClick={onBackToGallery}
                className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
              >
                <ArrowLeftRight className="h-3 w-3" /> 更换模板
              </button>
            </div>
          </div>

          <CelebrityProductForm value={product} onChange={setProduct} />

          <CelebrityEngineSelect value={engine} onChange={setEngine} />

          {/* 视频时长 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">视频时长</div>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "rounded-md border px-4 py-1.5 text-sm transition",
                    duration === d
                      ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
                      : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70",
                  )}
                >
                  {d}秒
                </button>
              ))}
            </div>
          </div>

          {/* 归属项目 */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-2 text-sm font-medium text-white/70">归属项目</div>
            <div className="flex gap-2">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0a0a14]">
                    {p.name} · {p.status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:border-white/30 hover:text-white"
              >
                + 新建
              </button>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            disabled={cannotGenerate}
            onClick={() =>
              onGenerate({ product, engine, duration, projectId })
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 via-cyan-400 to-purple-500 px-5 py-3 text-base font-semibold text-black shadow-[0_0_30px_rgba(6,182,212,0.35)] transition hover:shadow-[0_0_40px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:text-white/30 disabled:shadow-none"
          >
            <Film className="h-4 w-4" /> 生成视频
          </button>
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between text-white/45 tabular-nums">
              <span>
                消耗 <span className="text-cyan-200">✦{formatCredits(creditPrice)}</span> 积分
                <span className="text-white/30"> · 占套餐 {cost} 条额度</span>
              </span>
              <span className="text-white/35">
                套餐余量 {quotaUsed}/{quotaTotal} · 钱包 ✦{formatCredits(walletBalance)}
              </span>
            </div>
            {insufficientCredits && (
              <Link
                href="/producer/finance"
                className="inline-flex items-center gap-1 self-start rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-200 hover:border-amber-300"
              >
                <Wallet className="h-3 w-3" /> 积分不足（需 ✦{formatCredits(creditPrice)}）→ 立即充值
              </Link>
            )}
            {!insufficientCredits && insufficientQuota && (
              <span className="inline-flex items-center gap-1 self-start rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200">
                ⚠ 套餐额度不足，将自动改用积分扣费
              </span>
            )}
          </div>
        </div>

        {/* 右：预览 + 案例 + 引擎对比 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">模板效果预览</div>
            <div className="grid grid-cols-2 gap-3">
              {(template.previews ?? []).slice(0, 2).map((p, i) => (
                <CelebrityVideoPlayer
                  key={i}
                  src={p.videoUrl ?? ""}
                  poster={p.thumb}
                  aspect="9/16"
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">往期生成案例</span>
              <button className="text-xs text-cyan-300 hover:text-cyan-200">
                查看更多 →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {showcases.map((s) => (
                <div key={s.id}>
                  <CelebrityVideoPlayer
                    src={s.videoUrl ?? ""}
                    poster={s.thumb}
                    aspect="9/16"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/40">
                    <span className="line-clamp-1">{s.caption}</span>
                    <span>▶ {s.plays}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-white/25">
              以上案例均为 AI 生成效果，实际效果因商品不同可能有差异
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-amber-400/25 bg-amber-500/[0.04] p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-200">
              <Lightbulb className="h-4 w-4" /> 引擎对比提示
            </div>
            <p className="text-[12px] leading-relaxed text-amber-100/65">
              此模板使用 {ENGINE_META[template.recommendedEngine].name} 效果最佳
              {template.fitHint ? `（${template.fitHint}）` : ""}。
              MiniMax 画质更高但适配度一般；KeLing 适合快速批量出片。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
