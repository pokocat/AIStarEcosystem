import type { IpRun } from '@ai-star-eco/types';
import type { StudioPlanExecution, StudioPlanExecutionStep, StudioRunRequest } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { makeStudioNode, applyStudioRun } from './studio-nodes';
import { stepNodeId } from './studio-plan-execution';

/** A failed video is a generatable shot. Only an assembly result opens the film editor. */
export function videoTaskProblemNode(execution: StudioPlanExecution, step: StudioPlanExecutionStep, run?: IpRun) {
  const operation = step.operation === 'check' ? 'text' : step.operation;
  const base = makeStudioNode(operation);
  const request = run?.inputs ? { ...run.inputs, executionId: undefined, executionStage: undefined, clientRequestId: undefined } as unknown as StudioRunRequest : undefined;
  const node: CanvasNodeData = { ...base, id: stepNodeId(execution, step), title: step.title,
    position: { x: 720, y: 140 + execution.steps.indexOf(step) * 300 },
    metadata: { ...base.metadata, status: 'error', prompt: run?.inputs?.prompt ?? '', errorDetails: step.reason ?? execution.needsUserReason,
      studio: { ...base.metadata!.studio!, runId: run?.id, request, execution: { executionId: execution.id, stepId: step.id } } } };
  return run ? applyStudioRun(node, run) : node;
}
