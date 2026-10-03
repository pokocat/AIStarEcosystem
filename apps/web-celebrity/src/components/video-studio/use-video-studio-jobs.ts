"use client";

// 「视频生成」的生成记录：进页面拉一次；有排队中 / 生成中的任务、且页面在前台时每 5 秒刷新一次
// （切到后台就停，切回来马上补一次）。任务从进行中变成完成 / 失败时顺手刷新顶栏的积分余额
// （冻结的积分这时才扣掉或退回）。

import * as React from "react";
import type { VideoStudioJob } from "@ai-star-eco/types/video-studio";
import { VideoStudioApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";
import { isJobActive } from "@/constants/video-studio-ui";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";

export const VIDEO_STUDIO_POLL_MS = 5_000;

export interface VideoStudioJobsState {
  /** null = 首次加载中或首次加载失败。 */
  jobs: VideoStudioJob[] | null;
  /** 首次加载失败的原因（此时没有列表可显示）。 */
  error: string | null;
  /** 列表已有时，后续刷新失败的原因（列表保留，只是可能不是最新）。 */
  refreshError: string | null;
  refreshing: boolean;
  activeCount: number;
  /** 正在按 5 秒一次自动刷新。 */
  polling: boolean;
  reload: () => void;
  /** 刚提交成功的任务放到最前面。 */
  prepend: (job: VideoStudioJob) => void;
  /** 单条重新拉一次（成片 / 素材的签名地址过期时换新地址）。 */
  refreshJob: (id: string) => void;
}

function newestFirst(list: VideoStudioJob[]): VideoStudioJob[] {
  return [...list].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export function useVideoStudioJobs(): VideoStudioJobsState {
  const { refreshWallet } = useCelebrityShell();
  const [jobs, setJobs] = React.useState<VideoStudioJob[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  // 最新列表的同步副本：合并轮询结果、判断「刚完成」都要用最新值，不能等下一次渲染
  const jobsRef = React.useRef<VideoStudioJob[] | null>(null);
  // 本页提交的任务：轮询结果里暂时还没有它（请求比提交先发出）时也要留着
  const submittedIds = React.useRef(new Set<string>());
  const seq = React.useRef(0);
  const inflight = React.useRef(false);
  const walletRef = React.useRef(refreshWallet);
  React.useEffect(() => {
    walletRef.current = refreshWallet;
  }, [refreshWallet]);

  const commit = React.useCallback((next: VideoStudioJob[]) => {
    const prev = jobsRef.current;
    jobsRef.current = next;
    setJobs(next);
    const settled = prev?.some(
      (p) => isJobActive(p.status) && next.some((n) => n.id === p.id && !isJobActive(n.status)),
    );
    if (settled) void walletRef.current();
  }, []);

  const load = React.useCallback(
    async (kind: "initial" | "poll" | "manual") => {
      if (kind === "poll" && inflight.current) return;
      const mine = ++seq.current;
      inflight.current = true;
      if (kind !== "poll") setRefreshing(true);
      try {
        const list = await VideoStudioApi.listJobs();
        if (mine !== seq.current) return;
        const serverIds = new Set(list.map((j) => j.id));
        const pending = (jobsRef.current ?? []).filter((j) => submittedIds.current.has(j.id) && !serverIds.has(j.id));
        commit(newestFirst([...pending, ...list]));
        setError(null);
        setRefreshError(null);
      } catch (e) {
        if (mine !== seq.current) return;
        const msg = errorMessage(e, "生成记录没有加载出来，请稍后重试");
        if (jobsRef.current === null) setError(msg);
        else setRefreshError(msg);
      } finally {
        if (mine === seq.current) {
          inflight.current = false;
          setRefreshing(false);
        }
      }
    },
    [commit],
  );

  React.useEffect(() => {
    void load("initial");
  }, [load]);

  React.useEffect(() => {
    const onVisibility = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v && (jobsRef.current ?? []).some((j) => isJobActive(j.status))) void load("poll");
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  const activeCount = jobs?.filter((j) => isJobActive(j.status)).length ?? 0;
  const polling = activeCount > 0 && visible;

  React.useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void load("poll"), VIDEO_STUDIO_POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, load]);

  const reload = React.useCallback(() => void load("manual"), [load]);

  const prepend = React.useCallback(
    (job: VideoStudioJob) => {
      submittedIds.current.add(job.id);
      commit([job, ...(jobsRef.current ?? []).filter((j) => j.id !== job.id)]);
    },
    [commit],
  );

  const refreshJob = React.useCallback(
    (id: string) => {
      VideoStudioApi.getJob(id)
        .then((fresh) => {
          const current = jobsRef.current;
          if (!current || !current.some((j) => j.id === fresh.id)) return;
          commit(current.map((j) => (j.id === fresh.id ? fresh : j)));
        })
        .catch(() => {
          /* 换不到新地址就先保持原样；用户可以点「刷新」重拉整张列表 */
        });
    },
    [commit],
  );

  return { jobs, error, refreshError, refreshing, activeCount, polling, reload, prepend, refreshJob };
}
