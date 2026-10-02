"use client";

// 智能优化的一次完整过程（docs/video-studio-plan.md §9）：发起 → 每 2 秒查一次（页面在后台时暂停、
// 回来马上补查）→ 成功给出可编辑的优化稿 / 失败给出服务端原话。
//
// 厂商那边同步最长要等十分钟，服务端做成了后台任务，这里只负责「查」。收起（先不等了 / 先不生成）
// 只是不再看这一次，服务端那边照常跑完；之后再点「优化并继续」会用新的 clientRequestId 重新来一次。

import * as React from "react";
import type { VideoStudioOptimization, VideoStudioOptimizationRequest } from "@ai-star-eco/types/video-studio";
import { VideoStudioApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";
import { VIDEO_STUDIO_OPTIMIZE_POLL_MS } from "@/constants/video-studio-ui";

export type OptimizationView =
  | { phase: "idle" }
  /** 发起请求在路上。 */
  | { phase: "starting" }
  | { phase: "running"; optimization: VideoStudioOptimization; pollError: string | null }
  | { phase: "succeeded"; optimization: VideoStudioOptimization; draft: string; showOriginal: boolean }
  | {
      phase: "failed";
      message: string;
      /** 余额不够（402），给一个去充值的入口。 */
      topUp: boolean;
      optimization: VideoStudioOptimization | null;
      /**
       * 发起请求本身没拿到明确答复（断网 / 5xx）时，服务端可能已经建了记录：重试要用**同一个**
       * clientRequestId，免得扣两次。明确失败（4xx、或优化跑完了但失败）为 null，重试用新的。
       */
      reuseRequestId: string | null;
    };

export interface PromptOptimization {
  view: OptimizationView;
  start: (request: VideoStudioOptimizationRequest) => void;
  /** 收起这一块，什么都不改。 */
  dismiss: () => void;
  setDraft: (text: string) => void;
  toggleOriginal: () => void;
}

function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : undefined;
}

function isPaymentRequired(e: unknown): boolean {
  const x = e as { status?: unknown; code?: unknown } | null;
  return !!x && (x.status === 402 || x.code === "PAYMENT_REQUIRED");
}

/**
 * @param onCreditsChanged 冻结 / 扣除 / 退回发生时调用（刷新顶栏余额）。
 */
export function usePromptOptimization(onCreditsChanged?: () => void): PromptOptimization {
  const [view, setView] = React.useState<OptimizationView>({ phase: "idle" });
  const [visible, setVisible] = React.useState(true);
  // 每次发起 / 收起都换一个序号：之前还没回来的请求结果作废
  const seq = React.useRef(0);
  const inflight = React.useRef(false);
  const creditsRef = React.useRef(onCreditsChanged);
  React.useEffect(() => {
    creditsRef.current = onCreditsChanged;
  }, [onCreditsChanged]);

  const apply = React.useCallback((optimization: VideoStudioOptimization, mine: number) => {
    if (mine !== seq.current) return;
    if (optimization.status === "succeeded") {
      setView({ phase: "succeeded", optimization, draft: optimization.optimizedPrompt ?? "", showOriginal: false });
      creditsRef.current?.();
    } else if (optimization.status === "failed") {
      setView({
        phase: "failed",
        message: optimization.errorMessage || "智能优化没有成功",
        topUp: false,
        optimization,
        reuseRequestId: null,
      });
      creditsRef.current?.();
    } else {
      setView({ phase: "running", optimization, pollError: null });
    }
  }, []);

  const start = React.useCallback(
    (request: VideoStudioOptimizationRequest) => {
      seq.current += 1;
      const mine = seq.current;
      inflight.current = false;
      setView({ phase: "starting" });
      VideoStudioApi.createOptimization(request)
        .then((optimization) => {
          if (mine !== seq.current) return;
          creditsRef.current?.(); // 收费时这里已经冻结了
          apply(optimization, mine);
        })
        .catch((e) => {
          if (mine !== seq.current) return;
          const status = statusOf(e);
          const definitive = status !== undefined && status >= 400 && status < 500;
          setView({
            phase: "failed",
            message: errorMessage(e, "智能优化没有发起成功，请稍后再试"),
            topUp: isPaymentRequired(e),
            optimization: null,
            reuseRequestId: definitive ? null : request.clientRequestId,
          });
        });
    },
    [apply],
  );

  const poll = React.useCallback(
    async (id: string) => {
      if (inflight.current) return;
      inflight.current = true;
      const mine = seq.current;
      try {
        const optimization = await VideoStudioApi.getOptimization(id);
        apply(optimization, mine);
      } catch (e) {
        if (mine !== seq.current) return;
        if (statusOf(e) === 404) {
          setView({
            phase: "failed",
            message: errorMessage(e, "没找到这次智能优化的记录"),
            topUp: false,
            optimization: null,
            reuseRequestId: null,
          });
          return;
        }
        // 网络抖动等：留在「正在优化」，下一轮接着查
        const message = errorMessage(e, "查结果时出了点问题");
        setView((v) => (v.phase === "running" && v.optimization.id === id ? { ...v, pollError: message } : v));
      } finally {
        if (mine === seq.current) inflight.current = false;
      }
    },
    [apply],
  );

  const runningId = view.phase === "running" ? view.optimization.id : null;
  const runningRef = React.useRef<string | null>(null);
  const pollRef = React.useRef(poll);
  React.useEffect(() => {
    runningRef.current = runningId;
    pollRef.current = poll;
  }, [runningId, poll]);

  // 页面切到后台就停；回来马上补查一次
  React.useEffect(() => {
    const onVisibility = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v && runningRef.current) void pollRef.current(runningRef.current);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  React.useEffect(() => {
    if (!runningId || !visible) return;
    const timer = window.setInterval(() => void poll(runningId), VIDEO_STUDIO_OPTIMIZE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [runningId, visible, poll]);

  const dismiss = React.useCallback(() => {
    seq.current += 1;
    inflight.current = false;
    setView({ phase: "idle" });
  }, []);

  const setDraft = React.useCallback((text: string) => {
    setView((v) => (v.phase === "succeeded" ? { ...v, draft: text } : v));
  }, []);

  const toggleOriginal = React.useCallback(() => {
    setView((v) => (v.phase === "succeeded" ? { ...v, showOriginal: !v.showOriginal } : v));
  }, []);

  return { view, start, dismiss, setDraft, toggleOriginal };
}
