import { expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioPlanExecution, StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
import { failedVideoReferenceIds, videoTaskProblemNode } from './studio-video-task-node';
import { studioVideoNodeSelection } from './studio-video';
import { CanvasNodeType } from '@/canvas/types/canvas';
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

test('failed video recovery finds the original references in request order and reports a missing one', () => {
  const s = step('video');
  const run = { id: 'IPR-old', kind: 'studio-video', status: 'failed', output: {}, inputs: {
    operation: 'video', durationSec: 15, aspectRatio: '16:9',
    video: { mode: 'universal_reference_video', resolutionTier: '544p', references: [
      { mediaType: 'image', key: 'board.jpg' }, { mediaType: 'image', key: 'product.jpg' },
    ] },
  } } as unknown as IpRun;
  const failed = videoTaskProblemNode(execution(s), s, run);
  const node = { ...failed, metadata: { ...failed.metadata, videoMode: 't2v' as const } };
  const image = (id: string) => ({ ...failed, id, type: CanvasNodeType.Image, metadata: { storageKey: `${id}.jpg` } });
  const nodes = [image('product'), image('board')];
  const ids = failedVideoReferenceIds(node, nodes);
  expect(ids).toEqual(['board', 'product']);
  expect(studioVideoNodeSelection(node, nodes, ids!)).toMatchObject({
    seconds: 15, ratio: '16:9', draft: { mode: 'universal_reference_video', tier: '544p' },
  });
  expect(failedVideoReferenceIds(node, [nodes[0]])).toBeUndefined();
});
