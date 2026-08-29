"use client";

// 生成任务的统一查询 hook（生成中心「进行中/最近任务」 + 侧栏「素材运营」角标共用）。
// 合并两条真实生产线：脚本带货视频（/material/videos/jobs）+ 混剪（/mixcut/jobs），
// 来源打标、可见性感知轮询；单个来源失败不吞成空列表，而是回报 sourceErrors 让 UI 显式提示。

import * as React from "react";
import { MaterialOpsApi, MixcutApi } from "@/api";

export interface GenerationJobItem {
  id: string;
  /** 任务来源：脚本带货视频 / 混剪。 */
  source: "material" | "mixcut";
  name: string;
  /** partial = 混剪部分变体失败（既非全成也非全败，需要黄色警示而不是绿色完成）。 */
  status: "running" | "done" | "failed" | "partial";
  /** 0-100；来源没有进度语义时为 null。 */
  progressPct: number | null;
  createdAt: string | null;
  /** 查看详情的落点（脚本视频 → 商品素材库；混剪 → 生成任务页）。 */
  href: string;
}

const RUNNING_MATERIAL = new Set(["rendering", "queued"]);
const RUNNING_MIXCUT = new Set(["pending", "queued", "running"]);

export function useGenerationJobs(opts?: { pollMs?: number; enabled?: boolean }): {
  jobs: GenerationJobItem[];
  runningCount: number;
  loaded: boolean;
  /** 来源级失败提示（如「脚本视频任务加载失败」）；全部成功为空数组。 */
  sourceErrors: string[];
} {
  const pollMs = opts?.pollMs ?? 8000;
  const enabled = opts?.enabled ?? true;
  const [jobs, setJobs] = React.useState<GenerationJobItem[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [sourceErrors, setSourceErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const errors: string[] = [];
      const [material, mixcut] = await Promise.all([
        MaterialOpsApi.listVideoJobs().catch(() => {
          errors.push("脚本视频任务加载失败");
          return null;
        }),
        MixcutApi.listJobs().catch(() => {
          errors.push("混剪任务加载失败");
          return null;
        }),
      ]);
      if (cancelled) return;
      const merged: GenerationJobItem[] = [];
      for (const v of material ?? []) {
        merged.push({
          id: v.id,
          source: "material",
          name: v.name,
          status: RUNNING_MATERIAL.has(v.status) ? "running" : v.status === "failed" ? "failed" : "done",
          progressPct: v.progress_pct ?? null,
          createdAt: v.created_at ?? null,
          href: "/material/assets",
        });
      }
      for (const j of mixcut ?? []) {
        merged.push({
          id: j.id,
          source: "mixcut",
          name: j.template_name ?? "混剪任务",
          status: RUNNING_MIXCUT.has(j.status)
            ? "running"
            : j.status === "failed" ? "failed" : j.status === "partial" ? "partial" : "done",
          progressPct: typeof j.progress === "number" ? j.progress : null,
          createdAt: j.created_at ?? null,
          href: "/mixcut/jobs",
        });
      }
      merged.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setJobs(merged);
      setSourceErrors(errors);
      setLoaded(true);
    };
    tick();
    const timer = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, pollMs]);

  const runningCount = jobs.filter((j) => j.status === "running").length;
  return { jobs, runningCount, loaded, sourceErrors };
}
