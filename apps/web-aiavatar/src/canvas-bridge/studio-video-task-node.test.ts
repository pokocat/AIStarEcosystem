import { expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioPlanExecution, StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
import { videoTaskProblemNode } from './studio-video-task-node';
const step = (operation: string) => ({ id: 'problem', title: '问题步骤', operation, stage: 'production', status: 'failed', attempt: 3, runIds: [], dependsOn: [] }) as StudioPlanExecutionStep;
const execution = (s: StudioPlanExecutionStep) => ({ id: 'PEX-task', steps: [s] }) as StudioPlanExecution;
test.each(['image', 'video'] as const)('%s opens a repairable media node, preserving the native input', operation => {
  const s = step(operation), run = { id: 'IPR-old', kind: `studio-${operation}`, status: 'failed', inputs: { operation, prompt: '原始要求', model: 'chosen', clientRequestId: 'old-attempt', executionId: 'PEX-task' }, output: {} } as unknown as IpRun;
  const node = videoTaskProblemNode(execution(s), s, run);
  expect(node.type).toBe(operation); expect(node.metadata?.studio?.kind).toBe('shot');
  expect(node.metadata?.studio?.request).toMatchObject({ operation, model: 'chosen', prompt: '原始要求' });
  expect(node.metadata?.studio?.request?.executionId).toBeUndefined();
  expect(node.metadata?.studio?.request?.clientRequestId).toBeUndefined();
});
test('only an assembly problem opens the film editor', () => {
  const s = step('assemble'); expect(videoTaskProblemNode(execution(s), s).metadata?.studio?.kind).toBe('work');
});
