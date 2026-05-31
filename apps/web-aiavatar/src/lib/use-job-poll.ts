"use client";

import * as React from "react";
import type { AiAvatarJob } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi } from "@/api";

/**
 * 轮询单个任务进度直到终态（mock 模式由 store 定时器推进；live 模式轮询后端）。
 * 任务书 §7：任务中心实时进度。SSE 是更优解，这里用 1.2s 轮询兼容 mock + live 两条路径。
 */
export function useJobPoll(jobId: string | null | undefined, onDone?: (job: AiAvatarJob) => void) {
  const [job, setJob] = React.useState<AiAvatarJob | null>(null);
  const onDoneRef = React.useRef(onDone);
  onDoneRef.current = onDone;

  React.useEffect(() => {
    if (!jobId) { setJob(null); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const j = await AiAvatarApi.getJob(jobId);
        if (!alive) return;
        setJob(j);
        if (j.status === "succeeded" || j.status === "failed" || j.status === "cancelled") {
          onDoneRef.current?.(j);
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (alive) timer = setTimeout(tick, 1200);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId]);

  return job;
}

/** 轮询任务列表（任务中心 / 全局进行中徽标）。轮询失败不抛错（保留上次数据 + 软错误），不打断 UI。 */
export function useJobList(intervalMs = 2500) {
  const [jobs, setJobs] = React.useState<AiAvatarJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await AiAvatarApi.listJobs();
      setJobs(list);
      setError(null);
    } catch (e) {
      // 轮询失败（后端未起 / 401 / 404 / 网络）—— 保留旧数据，记软错误，绝不向上抛（避免 dev 错误浮层）。
      setError(e instanceof Error ? e.message : "任务列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval>;
    void refresh();
    timer = setInterval(() => { if (alive) void refresh(); }, intervalMs);
    return () => { alive = false; clearInterval(timer); };
  }, [refresh, intervalMs]);

  return { jobs, loading, error, refresh };
}
