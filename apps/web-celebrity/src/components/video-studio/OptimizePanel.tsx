"use client";

// 提示词下面的「智能优化」那一块（docs/video-studio-plan.md §9，照厂商试用页）：
//   正在优化 → 「正在优化提示词…（一般几十秒，长的要几分钟）」
//   成功     → 可编辑的「优化后的提示词」（n / 7000）、可展开的「原提示词」，
//              「用这版生成」「改用原提示词生成」「先不生成」；
//              结果是英文时多一句说明（聚算 H3 目前一律回英文，v0.199.1）
//   失败     → 服务端给的原因，「直接用原提示词生成」「重新优化」

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiErrorNotice } from "@/components/common/ai-error-notice";
import { countPromptChars, isMostlyEnglish } from "@/lib/video-studio";
import type { OptimizationView } from "./use-prompt-optimization";

const primaryBtn =
  "mobile-touch-target inline-flex items-center justify-center gap-1.5 rounded-full border-b border-violet-600 bg-violet-500 px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400";
const secondaryBtn =
  "mobile-touch-target inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "mobile-touch-target inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12.5px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

export function OptimizePanel({
  view,
  promptMaxChars,
  submitting,
  submitError,
  problems,
  blockedReason,
  onDraftChange,
  onToggleOriginal,
  onUseOptimized,
  onUseOriginal,
  onRetry,
  onDismiss,
}: {
  view: OptimizationView;
  promptMaxChars: number;
  submitting: boolean;
  /** 从这一块点了生成、但没提交成功的原因（显示在按钮旁边，不让人去页面底下找）。 */
  submitError: { message: string; topUp: boolean } | null;
  /** 表单里还没填好的地方（点了生成之后才有），同样显示在按钮旁边。 */
  problems: string[];
  /** 生成这一步现在提交不了的原因（模型没加载成功 / 这个规格没定价 / 素材在上传）；null = 可以提交。 */
  blockedReason: string | null;
  onDraftChange: (text: string) => void;
  onToggleOriginal: () => void;
  onUseOptimized: () => void;
  onUseOriginal: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (view.phase === "idle") return null;

  if (view.phase === "starting" || view.phase === "running") {
    const credits = view.phase === "running" ? view.optimization.credits : 0;
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-violet-700">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          正在优化提示词…
        </div>
        <p className="text-[11.5px] leading-relaxed text-violet-700/80">
          一般几十秒，长的要几分钟。切到别的页面会暂停查询，回来马上接着查。
          {credits > 0 ? `这次先冻结 ${formatCredits(credits)} 积分，没成功会退回。` : ""}
        </p>
        {view.phase === "running" && view.pollError ? (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">查结果时出了点问题：{view.pollError}，会接着重试</span>
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className={ghostBtn}
            title="收起这一块；这次优化在后台照常跑完，结果这里就不显示了"
          >
            先不等了
          </button>
        </div>
      </div>
    );
  }

  if (view.phase === "succeeded") {
    const chars = countPromptChars(view.draft);
    const over = chars > promptMaxChars;
    const empty = chars === 0;
    return (
      <div className="flex flex-col gap-2.5 rounded-xl border border-violet-200 bg-white px-3 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex min-w-0 items-center gap-2">
          <Wand2 className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="text-[12.5px] font-semibold text-zinc-800">优化后的提示词</span>
          <span className="ml-auto shrink-0 text-[11px] text-zinc-500">可以先改再用</span>
        </div>
        {/* 按优化给回来的原文判，不按草稿：用户边改边判会一会儿有一会儿没有 */}
        {isMostlyEnglish(view.optimization.optimizedPrompt ?? "") ? (
          <p className="text-[11.5px] leading-relaxed text-zinc-500">
            优化结果是英文的，模型直接读得懂。想改的话用中文写也行。
          </p>
        ) : null}
        <div className="relative">
          <textarea
            value={view.draft}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={7}
            aria-label="优化后的提示词"
            aria-invalid={over || empty}
            className={cn(
              "block min-h-[140px] w-full resize-y rounded-[10px] border bg-white px-3 pb-7 pt-2.5 text-[13px] leading-relaxed text-zinc-900 outline-none",
              "transition-[border-color,box-shadow] focus:shadow-[0_0_0_3px_var(--accent-soft)]",
              over || empty ? "border-rose-400 focus:border-rose-400" : "border-zinc-300 focus:border-violet-500",
            )}
          />
          <span
            className={cn(
              "pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] tabular-nums",
              over ? "text-rose-600" : "text-zinc-400",
            )}
          >
            {chars} / {promptMaxChars}
          </span>
        </div>
        {empty ? <p className="text-[11.5px] text-rose-600">优化后的提示词是空的，写点内容再用，或者改用原提示词</p> : null}
        {over ? <p className="text-[11.5px] text-rose-600">最多 {promptMaxChars} 字，删掉一些再用</p> : null}

        <div className="flex min-w-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={onToggleOriginal}
            aria-expanded={view.showOriginal}
            className="inline-flex items-center gap-1 self-start rounded-md text-[12px] text-zinc-500 hover:text-zinc-800"
          >
            原提示词
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", view.showOriginal && "rotate-180")} />
          </button>
          {view.showOriginal ? (
            <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 px-3 py-2 text-[12px] leading-relaxed text-zinc-600">
              {view.optimization.originalPrompt}
            </p>
          ) : null}
        </div>

        {view.optimization.credits > 0 ? (
          <p className="text-[11px] text-zinc-500">这次优化用了 {formatCredits(view.optimization.credits)} 积分</p>
        ) : null}

        <Blockers problems={problems} blockedReason={blockedReason} />
        {submitError ? <SubmitError error={submitError} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onUseOptimized}
            disabled={submitting || over || empty || !!blockedReason}
            className={primaryBtn}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            用这版生成
          </button>
          <button type="button" onClick={onUseOriginal} disabled={submitting || !!blockedReason} className={secondaryBtn}>
            改用原提示词生成
          </button>
          <button type="button" onClick={onDismiss} disabled={submitting} className={ghostBtn}>
            先不生成
          </button>
        </div>
      </div>
    );
  }

  // failed
  const refunded = view.optimization?.credits ?? 0;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-3">
      <AiErrorNotice title="智能优化没有成功" message={view.message} />
      {view.topUp ? (
        <Link href="/wallet" className="self-start text-[12px] font-medium text-violet-600 hover:text-violet-700">
          去积分钱包充值
        </Link>
      ) : null}
      {refunded > 0 ? <p className="text-[11px] text-zinc-500">这次优化冻结的 {formatCredits(refunded)} 积分已经退回</p> : null}
      <Blockers problems={problems} blockedReason={blockedReason} />
      {submitError ? <SubmitError error={submitError} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onUseOriginal} disabled={submitting || !!blockedReason} className={primaryBtn}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          直接用原提示词生成
        </button>
        <button type="button" onClick={onRetry} disabled={submitting || !!blockedReason} className={secondaryBtn}>
          <Wand2 className="h-3.5 w-3.5" />
          重新优化
        </button>
        <button type="button" onClick={onDismiss} disabled={submitting} className={ghostBtn} title="收起这一块，回去改提示词">
          收起
        </button>
      </div>
    </div>
  );
}

/** 现在还生成不了的原因：表单问题 + 整体卡住的原因（没定价、素材在上传…）。 */
function Blockers({ problems, blockedReason }: { problems: string[]; blockedReason: string | null }) {
  if (problems.length === 0 && !blockedReason) return null;
  return (
    <ul role="alert" className="flex flex-col gap-1 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] leading-relaxed text-rose-600">
      {blockedReason ? <li className="break-words">{blockedReason}</li> : null}
      {problems.map((p, i) => (
        <li key={`${p}-${i}`} className="break-words">
          {p}
        </li>
      ))}
    </ul>
  );
}

function SubmitError({ error }: { error: { message: string; topUp: boolean } }) {
  return (
    <div className="flex flex-col gap-1.5">
      <AiErrorNotice title="没有提交成功" message={error.message} />
      {error.topUp ? (
        <Link href="/wallet" className="self-start text-[12px] font-medium text-violet-600 hover:text-violet-700">
          去积分钱包充值
        </Link>
      ) : null}
    </div>
  );
}
