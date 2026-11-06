'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LocateFixed, Play } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
import { videoTask, videoTaskHref, videoTaskLabel } from '@/canvas-bridge/studio-video-tasks';
import { executionRestoreUpserts, projectCanvasOps, resumeStudioPlanExecution, stepNodeId, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';
import { readRun } from '@/canvas-bridge/api';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { videoTaskProblemNode } from '@/canvas-bridge/studio-video-task-node';

/** A task context on the canvas, including a stable way back. Reading it never resumes paid work. */
export function CanvasVideoTask({ projectId }: { projectId: string }) {
  const query = useSearchParams(), id = query?.get('task');
  const [task, setTask] = useState<StudioVideoTask>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const focused = useRef('');
  const restoredSteps = useRef(new Set<string>()), runCache = useRef<Record<string, IpRun>>({});
  useEffect(() => {
    if (!id || !/^(PEX|IPR)-[A-Za-z0-9_-]+$/.test(id)) return;
    setTask(undefined); focused.current = ''; restoredSteps.current.clear(); runCache.current = {};
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await videoTask(id);
        if (!alive || next.projectId !== projectId) return;
        setTask(next);
        const execution = next.execution;
        if (execution) {
          const runs = { ...runCache.current };
          for (const step of execution.steps) for (const runId of stepRunCandidates(step)) if (runs[runId]?.status !== 'done') runs[runId] = await readRun(runId);
          if (!alive) return;
          runCache.current = runs;
          const store = useCanvasStore.getState(), project = store.projects.find(p => p.id === projectId);
          if (!project) return;
          const fresh = execution.steps.filter(step => step.status === 'done' && !restoredSteps.current.has(`${step.stage}:${step.id}:${step.acceptedRunId ?? step.runIds.join()}`));
          const ops = executionRestoreUpserts(execution, runs, new Set(fresh.map(step => stepNodeId(execution, step)))).map(data => ({ kind: 'node' as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
          const restored = projectCanvasOps({ nodes: project.nodes, connections: project.connections }, ops);
          let nodes = restored.doc.nodes;
          const problem = execution.steps.find(s => s.id === query?.get('step') && s.stage === query?.get('stage'))
            ?? execution.steps.find(s => s.status === 'failed' || s.status === 'needs_user');
          if (problem) {
            const nodeId = stepNodeId(execution, problem);
            const existing = nodes.find(node => node.id === nodeId);
            if (!existing || existing.metadata?.studio?.execution?.executionId === execution.id && !existing.metadata.studio.request) {
              const run = stepRunCandidates(problem).map(key => runs[key]).find(Boolean);
              const node = videoTaskProblemNode(execution, problem, run);
              nodes = existing ? nodes.map(current => current.id === nodeId ? { ...node, ...current, metadata: { ...node.metadata, ...current.metadata,
                studio: { ...node.metadata.studio, ...current.metadata?.studio, kind: node.metadata.studio.kind, request: node.metadata.studio.request } } } : current) : [...nodes, node];
            }
            if (focused.current !== nodeId) { focused.current = nodeId; setTimeout(() => dispatchStudioCommand('focus', nodeId), 100); }
          }
          if (nodes !== project.nodes || restored.doc.connections !== project.connections) store.updateProject(projectId, { nodes, connections: restored.doc.connections });
          fresh.forEach(step => restoredSteps.current.add(`${step.stage}:${step.id}:${step.acceptedRunId ?? step.runIds.join()}`));
        }
        setError('');
      } catch { if (alive) setError('任务详情暂时没读出来，稍后会重新读取。'); }
      finally { if (alive) timer = setTimeout(read, 10000); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [id, projectId, query]);
  const resume = async () => {
    if (!task?.execution) return;
    setBusy(true); setError('');
    try {
      await saveStudioDocument(projectId);
      const execution = await resumeStudioPlanExecution(projectId, task.execution.id, { clientRequestId: nanoid(), expectedStatus: task.execution.status });
      setTask({ ...task, execution });
    } catch (e) { setError(e instanceof Error ? e.message : '暂时不能继续，请检查问题步骤。'); }
    finally { setBusy(false); }
  };
  if (!id) return null;
  return <aside className="canvas-video-task-context" aria-label="视频任务">
    {task ? <><Link href={videoTaskHref(task)}><ArrowLeft size={14}/>返回视频页</Link><div><strong>{task.title}</strong><p>{videoTaskLabel(task)}{task.execution?.steps.some(step => step.attempt >= 3 && step.status === 'failed') ? ' · 已尝试 3 次，请先处理问题节点，再继续制作。' : task.execution?.needsUserReason ? ` · ${task.execution.needsUserReason}` : ''}</p></div>
      {focused.current && <button type="button" onClick={() => dispatchStudioCommand('focus', focused.current)}><LocateFixed size={14}/>定位问题</button>}
      {task.execution && (task.execution.status === 'paused' || task.execution.status === 'needs_user') && <button type="button" disabled={busy} onClick={() => void resume()}><Play size={13}/>继续制作</button>}</>
      : <p>{error || '正在读取这条视频任务'}</p>}
    {task && error && <p role="status">{error}</p>}
  </aside>;
}
