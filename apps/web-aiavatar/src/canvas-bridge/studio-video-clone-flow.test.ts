import { expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioPlanExecution } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { executionRestoreUpserts, projectCanvasOps, stepNodeId } from './studio-plan-execution';
import { studioClipIncluded, studioSourceClipIds } from './studio-work-clips';

test('刷新恢复原片→深度视频→成片与替换图连线，原片和深度视频均不自动加入剪辑', () => {
  const execution = { id: 'PEX-clone', projectId: 'p', stage: 'production', status: 'done', steps: [
    { id: 'depth', title: '提取动作与空间结构', operation: 'video-control', stage: 'production', status: 'done', dependsOn: [], runIds: ['depth-run'], attempt: 1 },
    { id: 'video', title: '生成视频', operation: 'video', stage: 'production', status: 'done', dependsOn: ['depth'], runIds: ['video-run'], attempt: 1 },
  ] } as StudioPlanExecution;
  const run = (id: string, key: string, inputs: string[]) => ({ id, status: 'done', inputs: { canvasInputNodeIds: inputs }, output: { storageKey: key, durationSec: 12 } }) as IpRun;
  const runs = { 'depth-run': run('depth-run', 'depth.mp4', ['source']), 'video-run': run('video-run', 'result.mp4', ['new-subject']) };
  const node = (id: string, type: CanvasNodeType) => ({ id, type, title: id, position: { x: 0, y: 0 }, width: 320, height: 400, metadata: { storageKey: `${id}.mp4` } }) as CanvasNodeData;
  const original = { nodes: [node('source', CanvasNodeType.Video), node('new-subject', CanvasNodeType.Image)], connections: [] };
  const ops = executionRestoreUpserts(execution, runs).map(data => ({ kind: 'node' as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
  const result = projectCanvasOps(original, ops);
  const depthId = stepNodeId(execution, execution.steps[0]), videoId = stepNodeId(execution, execution.steps[1]);
  expect(result.doc.connections).toEqual(expect.arrayContaining([
    expect.objectContaining({ fromNodeId: 'source', toNodeId: depthId }),
    expect.objectContaining({ fromNodeId: depthId, toNodeId: videoId }),
    expect.objectContaining({ fromNodeId: 'new-subject', toNodeId: videoId }),
  ]));
  expect(result.doc.nodes.find(n => n.id === depthId)?.metadata?.storageKey).toBe('depth.mp4');
  const sources = studioSourceClipIds(result.doc.nodes, result.doc.connections);
  expect(studioClipIncluded(result.doc.nodes.find(n => n.id === depthId)!, sources)).toBe(false);
  expect(studioClipIncluded(result.doc.nodes.find(n => n.id === 'source')!, sources)).toBe(false);
  expect(studioClipIncluded(result.doc.nodes.find(n => n.id === videoId)!, sources)).toBe(true);
  expect(projectCanvasOps(result.doc, ops).changed).toBe(false);
});
