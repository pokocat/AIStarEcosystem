import type { IpRun } from '@ai-star-eco/types';
import type { StudioPlanExecution, StudioPlanExecutionStep, StudioRunRequest } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { makeStudioNode, applyStudioRun } from './studio-nodes';
import { stepNodeId } from './studio-plan-execution';

export function isFailedStudioVideo(node?: CanvasNodeData) {
  const studio = node?.metadata?.studio;
  return node?.type === CanvasNodeType.Video && node.metadata?.status === 'error'
    && (studio?.request?.operation === 'video' || !!studio?.execution && studio.kind === 'shot');
}

/** Reopen a failed video with the saved input order even if the canvas lost its edges. */
export function failedVideoReferenceIds(node: CanvasNodeData, nodes: CanvasNodeData[]): string[] | undefined {
  const request = node.metadata?.studio?.request;
  if (request?.operation !== 'video') return undefined;
  const video = request.video;
  const keys = [video?.firstFrameKey, video?.lastFrameKey, ...(video?.references ?? []).map(ref => ref.key),
    ...(request.references ?? []).map(ref => ref.storageKey)].filter(Boolean);
  const ids: string[] = [];
  for (const key of keys) {
    const source = nodes.find(candidate => candidate.id !== node.id && candidate.metadata?.storageKey === key
      && [CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio].some(type => type === candidate.type));
    if (!source) return undefined;
    ids.push(source.id);
  }
  return ids;
}

/** A failed video is a generatable shot. Only an assembly result opens the film editor. */
export function videoTaskProblemNode(execution: StudioPlanExecution, step: StudioPlanExecutionStep, run?: IpRun) {
  const operation = step.operation === 'check' ? 'text' : step.operation;
  const base = makeStudioNode(operation);
  const request = run?.inputs ? { ...run.inputs, executionId: undefined, stage: undefined, clientRequestId: undefined } as unknown as StudioRunRequest : undefined;
  const node: CanvasNodeData = { ...base, id: stepNodeId(execution, step), title: step.title,
    position: { x: 720, y: 140 + execution.steps.indexOf(step) * 300 },
    metadata: { ...base.metadata, status: 'error', prompt: run?.inputs?.prompt ?? '', errorDetails: step.reason ?? execution.needsUserReason,
      studio: { ...base.metadata!.studio!, runId: run?.id, request, execution: { executionId: execution.id, stepId: step.id } } } };
  return run ? applyStudioRun(node, run) : node;
}
