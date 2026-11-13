"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, Loader2, Pause, Play, RotateCcw, Square } from "lucide-react";
import { nanoid } from "nanoid";
import type { IpProjectDoc, IpRun } from "@ai-star-eco/types";
import type { StudioPlanExecution } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { readRun, signKeys } from "@/canvas-bridge/api";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { videoTaskBudgetShortfall, videoTaskHref } from "@/canvas-bridge/studio-video-tasks";
import { segmentedActive, segmentedPhases, segmentedResultStep, type SegmentedRecord } from "@/canvas-bridge/studio-segmented";
import { cancelStudioPlanExecution, executionRestoreUpserts, getStudioPlanExecution, missingExecutionNodes, pauseStudioPlanExecution, projectCanvasOps, readProjectedNodes,
  rememberProjectedNodes, resumeStudioPlanExecution, stepNodeId, stepRunCandidates } from "@/canvas-bridge/studio-plan-execution";

const POLL_MS = 5000, RETRY_MS = 15000;

/**
 * 一条长视频的进度和结果（docs/studio-segmented-video.md）。做的事在服务端，这里只读执行记录：
 * 做好一步就把结果放进草稿画布（和画布打开时恢复是同一套投影，重复放不会多出节点）。
 */
export function SegmentedRow({ record, projectId, doc, persist, busy, onConfirm, onFailure }: {
  record: SegmentedRecord; projectId: string; doc: IpProjectDoc;
  persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<unknown>;
  busy: boolean; onConfirm: () => void; onFailure: (action: string, error: unknown) => void;
}) {
  const [execution, setExecution] = useState<StudioPlanExecution>();
  const [acting, setActing] = useState(false);
  const [url, setUrl] = useState<string>();
  const docRef = useRef(doc); docRef.current = doc;
  const executionId = record.executionId;

  useEffect(() => {
    if (!executionId) return;
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await getStudioPlanExecution(projectId, executionId);
        if (!alive) return;
        setExecution(next);
        // 暂停时已交出去的任务还在做，也接着读；结束了就不读了。
        if (segmentedActive(next)) timer = setTimeout(() => void read(), POLL_MS);
      } catch { if (alive) timer = setTimeout(() => void read(), RETRY_MS); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [projectId, executionId, acting]);

  const updatedAt = execution?.updatedAt;
  useEffect(() => {
    if (!execution) return;
    let alive = true;
    void (async () => {
      const steps = missingExecutionNodes(execution, docRef.current.nodes as CanvasNodeData[], readProjectedNodes(projectId));
      if (!steps.length) return;
      const runs: Record<string, IpRun> = {};
      for (const step of steps) for (const id of stepRunCandidates(step)) {
        const run = await readRun(id).catch(() => undefined);
        if (!alive) return;
        if (run) runs[id] = run;
        if (run?.status === "done") break;
      }
      const ops = executionRestoreUpserts(execution, runs, new Set(steps.map(step => stepNodeId(execution, step))))
        .map(data => ({ kind: "node" as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
      if (!ops.length) return;
      await persist(current => {
        const result = projectCanvasOps({ nodes: current.nodes as CanvasNodeData[], connections: current.connections as never }, ops);
        rememberProjectedNodes(projectId, result.projected);
        return { ...current, nodes: result.doc.nodes as never, connections: result.doc.connections as never };
      }, projectId);
    })().catch(() => undefined); // 下一次读到新状态再放；任务本身不受影响
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt, projectId]);

  const result = execution ? segmentedResultStep(execution) : undefined;
  const resultNode = execution && result?.status === "done" ? (doc.nodes as CanvasNodeData[]).find(n => n.id === stepNodeId(execution, result)) : undefined;
  const resultKey = resultNode?.metadata?.storageKey;
  useEffect(() => {
    if (!resultKey) return;
    let alive = true;
    void signKeys([resultKey]).then(signed => { if (alive) setUrl(signed[resultKey]); }).catch(() => undefined);
    return () => { alive = false; };
  }, [resultKey]);

  const act = async (label: string, run: () => Promise<StudioPlanExecution>) => {
    setActing(true);
    try { setExecution(await run()); }
    catch (e) { onFailure(label, e); }
    finally { setActing(false); }
  };
  const control = { clientRequestId: nanoid() };

  if (!executionId) return <li className="scene-row scene-video-row is-loading">
    <div className="scene-row-meta"><strong>{record.title}</strong><span className="scene-row-state" role="status">结果待确认</span></div>
    <p className="scene-row-prompt">点击「确认原任务」查询，不会重复开始。</p>
    <div className="scene-row-actions"><button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button></div>
  </li>;

  const phases = execution ? segmentedPhases(execution) : [];
  const spent = execution?.budgets.find(b => b.stage === "production")?.spent ?? 0;
  const status = execution?.status;
  const shortfall = videoTaskBudgetShortfall(execution);
  const text = !execution ? "正在加载进度…"
    : status === "running" ? "可离开此页面，制作将在后台继续。"
    : status === "paused" ? "已暂停，已提交的步骤会继续完成。"
    : status === "needs_user" ? execution.needsUserReason || "需要你处理，请在画布上查看。"
    : status === "done" ? "已完成"
    : status === "canceled" ? "已停止，已完成的部分保留在画布上。"
    : execution.needsUserReason || "未全部完成，已完成的部分保留在画布上。";
  return <li className={`scene-row scene-video-row scene-segmented-row is-${status || "loading"}`}>
    <div className="scene-row-meta"><strong>{record.title}</strong>
      <span>{(record.request?.ratio ?? record.ratio) === "16:9" ? "横屏" : "竖屏"}{record.request?.tier ? ` · ${record.request.tier.toUpperCase()}` : ""}</span>
      <span className="scene-row-state" role={status === "running" ? "status" : undefined}>{(status === "running" || !execution) && <Loader2 size={14} className="studio-gallery-spinner"/>}{status === "done" ? "已完成" : status === "running" ? "制作中" : !execution ? "加载中" : status === "paused" ? "已暂停" : status === "canceled" ? "已停止" : "未完成"}</span></div>
    {url ? <SignedVideo className="scene-video-player" src={url} storageKey={resultKey} controls playsInline preload="metadata" aria-label={record.title}/> : null}
    {status !== "done" && <p className={`scene-segmented-note${status === "needs_user" ? " is-waiting" : ""}`} role={status === "needs_user" ? "status" : undefined}>{text}</p>}
    {phases.length > 0 && status !== "done" && <ol className="scene-segmented-phases">{phases.map(p => <li key={p.key} className={`is-${p.state}`}>
      <span aria-hidden="true">{p.state === "done" ? <Check size={12} strokeWidth={2}/> : p.state === "running" ? <Loader2 size={12} className="studio-gallery-spinner"/> : <i/>}</span>
      <span>{p.label}{p.total > 1 ? ` ${p.done}/${p.total}` : ""}</span></li>)}</ol>}
    {execution && spent > 0 && <p className="scene-segmented-spent">已用 {spent.toLocaleString("zh-CN")} 积分</p>}
    <div className="scene-row-actions">
      {status === "running" && <button type="button" disabled={acting} onClick={() => void act("暂停", () => pauseStudioPlanExecution(projectId, executionId, control))}><Pause size={13}/>暂停</button>}
      {shortfall ? <Link className="scene-text-button" href={videoTaskHref({ id: executionId, projectId, sceneId: record.request?.sceneId ?? "ecom-talking" })}>调整预算</Link>
        : (status === "paused" || status === "needs_user") && <button type="button" className="is-primary" disabled={acting} onClick={() => void act("继续制作", () => resumeStudioPlanExecution(projectId, executionId, control))}><Play size={13}/>继续</button>}
      {segmentedActive(execution) && <button type="button" disabled={acting} onClick={() => void act("停止制作", () => cancelStudioPlanExecution(projectId, executionId, control))}><Square size={13}/>停止</button>}
      {url && <button type="button" onClick={() => void downloadMedia(url, record.title, "video/mp4", resultKey).catch(error => onFailure("下载视频", error))}><Download size={13}/>下载</button>}
    </div>
  </li>;
}
