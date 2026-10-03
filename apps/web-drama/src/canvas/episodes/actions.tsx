"use client";

// 逐集制作页与单集编辑器共用的「花钱的动作」：先按规矩确认（批量、会覆盖已有内容、或花费 ≥ confirmThreshold），
// 再走 useCanvasRuns().submit（先存再发、幂等键、轮询合并都在 core）。没发出去 / 被拒时就地 toast 一句人话。
// 生成分镜脚本在两屏都有入口，只写这一份（§8.0.1 ④）。
import * as React from "react";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { toast } from "@/lib/toast";
import {
  findEpisode,
  useCanvasDoc,
  useCanvasPricing,
  useCanvasRuns,
  type CanvasPricingValue,
  type CanvasRunRequest,
  type CanvasRunsValue,
} from "@/canvas/core";
import { storyboardReplaceNote } from "./derive";

/** 要不要先弹确认：覆盖已有内容 / 批量一律确认；否则花费到了门槛才确认。 */
export function needsSpendConfirm(cost: number, threshold: number, always = false): boolean {
  return always || cost >= threshold;
}

export async function confirmSpend(opts: {
  title: string;
  body?: React.ReactNode;
  cost: number;
  threshold: number;
  always?: boolean;
  confirmLabel?: string;
  tone?: "default" | "danger";
  /** 价格读到了没有（useCanvasPricing().ready）。没读到：一律确认，确认框里不报一个回退的数字。 */
  priceKnown?: boolean;
}): Promise<boolean> {
  const known = opts.priceKnown !== false;
  if (known && !needsSpendConfirm(opts.cost, opts.threshold, opts.always)) return true;
  return dramaConfirm({
    title: opts.title,
    body: known ? (
      opts.body
    ) : (
      <>
        {opts.body}
        <span style={{ display: "block", marginTop: 6 }}>价格还没读到，按生成时的实际价格扣积分。</span>
      </>
    ),
    cost: known && opts.cost > 0 ? opts.cost : undefined,
    confirmLabel: opts.confirmLabel ?? (opts.cost > 0 || !known ? "确认生成" : "确定"),
    tone: opts.tone,
  });
}

/** 提交一次生成；没成功就 toast 原因（core 给的 message 已经是人话，且说清了有没有花积分）。 */
export async function submitOrToast(
  submit: CanvasRunsValue["submit"],
  req: CanvasRunRequest,
  failTitle: string,
): Promise<boolean> {
  const res = await submit(req);
  if (!res.ok) {
    toast.error(failTitle, { description: res.message });
    return false;
  }
  return true;
}

export type SequenceResult = Awaited<ReturnType<CanvasRunsValue["submitSequence"]>>[number];

export interface SequenceSummary {
  sent: number;
  /** 被服务端拒了 / 没存上而停下来的那一项（stopOnError 时最多一个）。 */
  failed?: { label: string; message: string };
  /** 没提交的：已经在生成（别处点过）、或前面失败后停下的。 */
  skipped: { label: string; message: string }[];
}

/** 把 submitSequence 的结果按「发出去 / 失败 / 跳过」数清楚（给提示用）。 */
export function summarizeSequence(results: SequenceResult[], labelOf: (index: number) => string): SequenceSummary {
  const out: SequenceSummary = { sent: 0, skipped: [] };
  results.forEach((r, i) => {
    if (r.ok) out.sent += 1;
    else if (r.reason === "skipped") out.skipped.push({ label: labelOf(i), message: r.message });
    else if (!out.failed) out.failed = { label: labelOf(i), message: r.message };
  });
  return out;
}

/** 批量提交完的提示：失败的那项说原因；跳过的说有几个没提交、为什么。 */
export function toastSequence(s: SequenceSummary, unit: "个" | "集", what: string): void {
  // 「片段 02 的视频」「第 2 集的分镜脚本」：名字以数字结尾时和「的」之间留个空格
  const of = (label: string) => `${label}${/\d$/.test(label) ? " " : ""}的${what}`;
  if (s.failed) toast.error(`${of(s.failed.label)}没开始生成`, { description: s.failed.message });
  if (s.skipped.length) {
    toast.info(`${s.sent ? `已开始生成 ${s.sent} ${unit}，` : ""}${s.skipped.length} ${unit}没提交`, {
      description: s.skipped.map((x) => `${x.label}：${x.message}`).join("；"),
    });
  }
}

/**
 * 分镜请求里的片段时长范围 = 所选视频模型的上下限（服务端写进提示词；切出来太短的并进相邻片段）。
 * 下限只在模型**写明了**最短时长时才带：不知道时不带，服务端按它的缺省（4 秒）—— 带个 1 上去等于让 AI 切 1 秒的镜头。
 * 单集、批量都走它，不各拼一份（§8.0.1 ④）。
 */
export function storyboardBody(no: number, p: Pick<CanvasPricingValue, "maxSegmentSec" | "minSegmentSec" | "videoModels" | "videoModelId">) {
  const known = p.videoModels.find((m) => m.endpointId === p.videoModelId)?.minDurationSec;
  return { episodeNo: no, maxSegmentSec: p.maxSegmentSec(), ...(known != null ? { minSegmentSec: p.minSegmentSec() } : {}) };
}

/** 生成分镜脚本（单集 / 批量）。 */
export function useStoryboardAction() {
  const { getDoc } = useCanvasDoc();
  const { submit, submitSequence } = useCanvasRuns();
  const pricing = useCanvasPricing();
  const pricingRef = React.useRef(pricing);
  pricingRef.current = pricing;

  const submitOne = React.useCallback(
    (no: number) =>
      submitOrToast(
        submit,
        { kind: "storyboard", body: storyboardBody(no, pricingRef.current) },
        `第 ${no} 集的分镜脚本没开始生成`,
      ),
    [submit],
  );

  const generate = React.useCallback(
    async (no: number): Promise<boolean> => {
      const p = pricingRef.current;
      const cost = p.storyboardPrice();
      const replace = storyboardReplaceNote(no, findEpisode(getDoc(), no)?.segments ?? []);
      const ok = await confirmSpend({
        title: replace ? `重新生成第 ${no} 集的分镜脚本？` : `生成第 ${no} 集的分镜脚本？`,
        body: replace ?? "AI 会把这一集剧本切成几个片段，每个片段一次生成一条视频。",
        cost,
        threshold: p.confirmThreshold,
        always: !!replace,
        priceKnown: p.ready,
        confirmLabel: replace ? "替换并生成" : undefined,
      });
      if (!ok) return false;
      return submitOne(no);
    },
    [getDoc, submitOne],
  );

  const generateMany = React.useCallback(
    async (nos: number[]): Promise<number> => {
      if (!nos.length) return 0;
      const p = pricingRef.current;
      const cost = p.storyboardPrice() * nos.length;
      const doc = getDoc();
      const notes = nos.map((no) => storyboardReplaceNote(no, findEpisode(doc, no)?.segments ?? [])).filter((x): x is string => !!x);
      const ok = await confirmSpend({
        title: `为选中的 ${nos.length} 集生成分镜脚本？`,
        body: (
          <>
            {`AI 会把每一集剧本切成几个片段，按集依次开始生成。`}
            {notes.map((n) => (
              <span key={n} style={{ display: "block", marginTop: 6 }}>
                {n}
              </span>
            ))}
          </>
        ),
        cost,
        threshold: p.confirmThreshold,
        always: true,
        priceKnown: p.ready,
        confirmLabel: notes.length ? "替换并生成" : undefined,
      });
      if (!ok) return 0;
      // 整批交给 core 按顺序提交（一进来整批都算「提交中」，每项发前再核对一次），不在这里自己循环（Codex 复审 N3）
      const results = await submitSequence(
        nos.map((no) => ({ kind: "storyboard" as const, body: storyboardBody(no, pricingRef.current) })),
        { stopOnError: true },
      );
      const summary = summarizeSequence(results, (i) => `第 ${nos[i]} 集`);
      toastSequence(summary, "集", "分镜脚本");
      return summary.sent;
    },
    [getDoc, submitSequence],
  );

  /** 价格还没读到时是 null（按钮上显示「…」）。 */
  return { generate, generateMany, price: pricing.ready ? pricing.storyboardPrice() : null };
}
