'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LocateFixed, Play } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
import { videoTask, videoTaskHref, videoTaskLabel, videoTaskProblemText, videoTaskResumeLabel, videoTaskSegmentRetry } from '@/canvas-bridge/studio-video-tasks';
import { useStudioFailure } from './studio-errors';
import { executionRestoreUpserts, projectCanvasOps, resumeStudioPlanExecution, stepNodeId, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';
import { readRun } from '@/canvas-bridge/api';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { videoTaskProblemNode } from '@/canvas-bridge/studio-video-task-node';

/** 在画布上修好这一步后也能继续（服务端采用修好的结果），所以暂停和停下等用户时按钮都在；名字跟视频页一致。 */
const resumeLabel = (task: StudioVideoTask) => videoTaskResumeLabel(task) ?? '继续生成';

/** A task context on the canvas, including a stable way back. Reading it never resumes paid work. */
export function CanvasVideoTask({ projectId }: { projectId: string }) {
  const id = useSearchParams()?.get('task');
  return id ? <CanvasVideoTaskBar projectId={projectId} id={id}/> : null;
}

function CanvasVideoTaskBar({ projectId, id }: { projectId: string; id: string }) {
  const query = useSearchParams();
  const showFailure = useStudioFailure();
  const [task, setTask] = useState<StudioVideoTask>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const focused = useRef(''), [problemNode, setProblemNode] = useState('');
  const restoredSteps = useRef(new Set<string>()), runCache = useRef<Record<string, IpRun>>({});
  useEffect(() => {
    if (!/^(PEX|IPR)-[A-Za-z0-9_-]+$/.test(id)) return;
    setTask(undefined); focused.current = ''; setProblemNode(''); restoredSteps.current.clear(); runCache.current = {};
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
          const fresh = execution.steps.filter(step => step.status === 'done' && step.id !== 'compile' && step.operation !== 'check' && !restoredSteps.current.has(`${step.stage}:${step.id}:${step.acceptedRunId ?? step.runIds.join()}`));
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
            setProblemNode(nodeId);
            if (focused.current !== nodeId) { focused.current = nodeId; setTimeout(() => dispatchStudioCommand('focus', nodeId), 100); }
          } else {
            // 没有问题要处理：停在成片（或最后做好的视频）上，不让用户在整张画布里找。
            const films = execution.steps.filter(step => step.status === 'done' && (step.operation === 'assemble' || step.operation === 'video'));
            const film = films.find(step => step.operation === 'assemble') ?? films[films.length - 1];
            const nodeId = film ? stepNodeId(execution, film) : '';
            setProblemNode('');
            if (nodeId && focused.current !== nodeId && nodes.some(node => node.id === nodeId)) { focused.current = nodeId; setTimeout(() => dispatchStudioCommand('focus', nodeId), 100); }
          }
          if (nodes !== project.nodes || restored.doc.connections !== project.connections) store.updateProject(projectId, { nodes, connections: restored.doc.connections });
          fresh.forEach(step => restoredSteps.current.add(`${step.stage}:${step.id}:${step.acceptedRunId ?? step.runIds.join()}`));
        }
        setError('');
      } catch { if (alive) setError('任务详情加载失败，正在重试。'); }
      finally { if (alive) timer = setTimeout(read, 10000); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [id, projectId, query]);
  const resume = async () => {
    if (!task?.execution) return;
    const action = resumeLabel(task);
    setBusy(true);
    try {
      await saveStudioDocument(projectId);
      const segmentRetry = videoTaskSegmentRetry(task);
      const execution = await resumeStudioPlanExecution(projectId, task.execution.id, { clientRequestId: nanoid(), expectedStatus: task.execution.status,
        ...(segmentRetry && { retryStepId: segmentRetry.retryStepId, retryAttempt: segmentRetry.retryAttempt }) });
      setTask({ ...task, execution });
    } catch (error) { showFailure({ action, error }); }
    finally { setBusy(false); }
  };
  return <aside className="canvas-video-task-context" aria-label="视频任务">
    {task ? <><Link href={videoTaskHref(task)}><ArrowLeft size={14}/>返回视频页</Link><div><strong>{task.title}</strong><p>{[videoTaskLabel(task), videoTaskProblemText(task)].filter(Boolean).join(' · ')}</p></div>
      {problemNode && <button type="button" onClick={() => dispatchStudioCommand('focus', problemNode)}><LocateFixed size={14}/>定位问题</button>}
      {task.execution && (task.execution.status === 'paused' || task.execution.status === 'needs_user') && <button type="button" className="is-primary" disabled={busy} onClick={() => void resume()}><Play size={13}/>{resumeLabel(task)}</button>}</>
      : <p>{error || '正在加载任务…'}</p>}
    {task && error && <p role="status">{error}</p>}
  </aside>;
}
