"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Film, Lightbulb, Wallet } from "lucide-react";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { CelebrityProductForm } from "./CelebrityProductForm";
import { CelebrityEngineSelect } from "./CelebrityEngineSelect";
import { DURATION_OPTIONS, ENGINE_META, CTA_PRIMARY_LG } from "@/constants/celebrity-zone-ui";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { useProducerShell } from "@/lib/celebrity-shell-context";
import type {
  CelebrityEngine,
  CelebrityProductInput,
  CelebrityShowcase,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityVideoDuration,
  CelebrityProject,
  TemplateConfigStep,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";

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
                  ? "border-emerald-500 text-emerald-600"
                  : isActive
                    ? "border-violet-500 text-violet-600"
                    : "border-zinc-200 text-zinc-400",
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
          <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
            <div className="w-[64px] shrink-0">
              <CelebrityVideoPlayer
                src={template.previews?.[0]?.videoUrl ?? ""}
                poster={template.previews?.[0]?.thumb}
                aspect="9/16"
              />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="text-sm font-semibold text-zinc-800">{template.name}模板</div>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-600 line-clamp-2">
                {template.description}
              </p>
              <button
                onClick={onBackToGallery}
                className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
              >
                <ArrowLeftRight className="h-3 w-3" /> 更换模板
              </button>
            </div>
          </div>

          <CelebrityProductForm value={product} onChange={setProduct} />

          <CelebrityEngineSelect value={engine} onChange={setEngine} />

          {/* 视频时长 */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">视频时长</div>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "rounded-md border px-4 py-1.5 text-sm transition",
                    duration === d
                      ? "border-violet-400/60 bg-violet-500/10 text-violet-600"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
                  )}
                >
                  {d}秒
                </button>
              ))}
            </div>
          </div>

          {/* 归属项目 */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-2 text-sm font-medium text-zinc-700">归属项目</div>
            <div className="flex gap-2">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 flex-1 rounded-md border-zinc-200 bg-zinc-50 text-sm text-zinc-900 focus:border-violet-500 focus:ring-0">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
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
            className={`${CTA_PRIMARY_LG} w-full`}
          >
            <Film className="h-4 w-4" /> 生成视频
          </button>
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between text-zinc-500 tabular-nums">
              <span>
                消耗 <span className="text-violet-600 font-medium">✦{formatCredits(creditPrice)}</span> 积分
                <span className="text-zinc-400"> · 占套餐 {cost} 条额度</span>
              </span>
              <span className="text-zinc-500">
                套餐余量 {quotaUsed}/{quotaTotal} · 钱包 ✦{formatCredits(walletBalance)}
              </span>
            </div>
            {insufficientCredits && (
              <Link
                href="/producer/finance"
                className="inline-flex items-center gap-1 self-start rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-amber-600 transition hover:border-amber-500"
              >
                <Wallet className="h-3 w-3" /> 积分不足（需 ✦{formatCredits(creditPrice)}）→ 立即充值
              </Link>
            )}
            {!insufficientCredits && insufficientQuota && (
              <span className="inline-flex items-center gap-1 self-start rounded-md border border-pink-400/40 bg-pink-500/10 px-2 py-1 text-pink-600">
                ⚠ 套餐额度不足，将自动改用积分扣费
              </span>
            )}
          </div>
        </div>

        {/* 右：预览 + 案例 + 引擎对比 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">模板效果预览</div>
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

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">往期生成案例</span>
              <button className="text-xs text-violet-600 hover:text-violet-700">
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
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="line-clamp-1">{s.caption}</span>
                    <span>▶ {s.plays}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-400">
              以上案例均为 AI 生成效果，实际效果因商品不同可能有差异
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-amber-400/25 bg-amber-500/[0.06] p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-600">
              <Lightbulb className="h-4 w-4" /> 引擎对比提示
            </div>
            <p className="text-[12px] leading-relaxed text-amber-700/85">
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
