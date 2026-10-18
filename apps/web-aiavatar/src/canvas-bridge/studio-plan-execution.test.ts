import { describe, expect, test } from 'vitest';
import type { StudioCheckResultData, StudioNodeUpsertData, StudioPlanExecution } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { checkSubject, checkedStep, projectCanvasOps, projectStudioCheckResult, projectStudioExecution, projectStudioNodeUpsert, type ProjectionDoc } from './studio-plan-execution';

const source: CanvasNodeData = { id: 'src', type: 'video', title: '原片', position: { x: 0, y: 0 }, width: 360, height: 640, metadata: { storageKey: 'k/src', status: 'success' } };
const empty: ProjectionDoc = { nodes: [source], connections: [] };
const segment = (over: Partial<StudioNodeUpsertData> = {}, meta: Record<string, unknown> = {}): StudioNodeUpsertData => ({
  nodeId: 'e1-seg-1', op: 'create', executionId: 'e1', stepId: 'v1', runId: 'run-v1', connection: { fromNodeId: 'src', toNodeId: 'e1-seg-1' },
  node: { id: 'e1-seg-1', type: 'video', title: '第 1 段', position: { x: 0, y: 0 }, width: 360, height: 640, metadata: { status: 'success', storageKey: 'k/v1', content: 'https://cdn/v1', prompt: '换成洗衣液', ...meta } },
  ...over,
});

describe('node.upsert projection', () => {
  test('creates one bound node and edge; replaying the same event changes nothing', () => {
    const first = projectStudioNodeUpsert(empty, segment());
    expect(first.outcome).toBe('applied');
    const node = first.nodes.find(n => n.id === 'e1-seg-1')!;
    expect(node.metadata?.studio?.execution).toEqual({ executionId: 'e1', stepId: 'v1', runId: 'run-v1' });
    // Placed beside the source instead of on top of it.
    expect(node.position.x).toBeGreaterThanOrEqual(source.width);
    expect(first.connections).toEqual([{ id: 'exec-edge-src-e1-seg-1', fromNodeId: 'src', toNodeId: 'e1-seg-1' }]);
    const again = projectStudioNodeUpsert(first, segment());
    expect(again.outcome).toBe('unchanged');
    expect(again.nodes).toHaveLength(2);
    expect(again.connections).toHaveLength(1);
  });

  test('updates server-owned media but keeps the user position, title and prompt edits (as a proposal)', () => {
    const created = projectStudioNodeUpsert(empty, segment());
    const moved = { ...created, nodes: created.nodes.map(n => n.id === 'e1-seg-1' ? { ...n, title: '我改的名字', position: { x: 900, y: 40 }, metadata: { ...n.metadata, prompt: '我自己写的提示词' } } : n) };
    const update = projectStudioNodeUpsert(moved, segment({ op: 'update', runId: 'run-v1b' }, { storageKey: 'k/v1b', content: 'https://cdn/v1b', prompt: '服务端的新提示词' }));
    const node = update.nodes.find(n => n.id === 'e1-seg-1')!;
    expect(update.outcome).toBe('applied');
    expect(node.metadata).toMatchObject({ storageKey: 'k/v1b', content: 'https://cdn/v1b', prompt: '我自己写的提示词' });
    expect(node.metadata?.studio?.execution?.runId).toBe('run-v1b');
    expect(node.title).toBe('我改的名字');
    expect(node.position).toEqual({ x: 900, y: 40 });
    expect(update.proposals).toEqual([{ nodeId: 'e1-seg-1', field: 'prompt', content: '服务端的新提示词', snapshot: '我自己写的提示词' }]);
  });

  test('never overwrites text the user wrote; empty text is filled', () => {
    const textNode = (content: string): CanvasNodeData => ({ id: 'e1-script', type: 'text', title: '脚本', position: { x: 0, y: 900 }, width: 300, height: 200, metadata: { content, studio: { kind: 'text' } } });
    const upsert: StudioNodeUpsertData = { nodeId: 'e1-script', op: 'update', node: { id: 'e1-script', type: 'text', title: '脚本', position: { x: 0, y: 0 }, width: 300, height: 200, metadata: { content: '服务端的脚本' } } };
    const kept = projectStudioNodeUpsert({ nodes: [textNode('我手改过的脚本')], connections: [] }, upsert);
    expect(kept.nodes[0].metadata?.content).toBe('我手改过的脚本');
    expect(kept.proposals[0]).toMatchObject({ field: 'content', content: '服务端的脚本', snapshot: '我手改过的脚本' });
    const filled = projectStudioNodeUpsert({ nodes: [textNode('')], connections: [] }, upsert);
    expect(filled.nodes[0].metadata?.content).toBe('服务端的脚本');
    expect(filled.proposals).toEqual([]);
  });

  test('an expected document version the client cannot confirm is skipped as a conflict', () => {
    const r = projectStudioNodeUpsert(empty, segment({ expectedDocVersion: 'v2' }), { docVersion: 'v1' });
    expect(r.outcome).toBe('conflict');
    expect(r.nodes).toBe(empty.nodes);
    expect(projectStudioNodeUpsert(empty, segment({ expectedDocVersion: 'v2' }), { docVersion: 'v2' }).outcome).toBe('applied');
  });

  test('a propose op only returns an adoption proposal with the current value as snapshot', () => {
    const text: CanvasNodeData = { id: 't', type: 'text', title: '台词', position: { x: 0, y: 0 }, width: 10, height: 10, metadata: { content: '原台词', studio: { kind: 'text' } } };
    const r = projectStudioNodeUpsert({ nodes: [text], connections: [] }, { nodeId: 't', op: 'propose', proposal: { field: 'content', content: '新台词' } });
    expect(r.nodes).toEqual([text]);
    expect(r.proposals).toEqual([{ nodeId: 't', field: 'content', content: '新台词', snapshot: '原台词' }]);
  });

  test('a batch retries a connection that names a node created later in the same batch', () => {
    const connect = { kind: 'node' as const, turnId: 't', data: { nodeId: 'e1-seg-1', op: 'connect' as const, connection: { fromNodeId: 'e1-seg-1', toNodeId: 'e1-seg-2' } } };
    const create = (no: number) => ({ kind: 'node' as const, turnId: 't', data: segment({ nodeId: `e1-seg-${no}`, connection: undefined, node: { ...segment().node!, id: `e1-seg-${no}` } }) });
    const r = projectCanvasOps(empty, [create(1), connect, create(2)]);
    expect(r.changed).toBe(true);
    expect(r.doc.connections).toEqual([{ id: 'exec-edge-e1-seg-1-e1-seg-2', fromNodeId: 'e1-seg-1', toNodeId: 'e1-seg-2' }]);
    const replay = projectCanvasOps(r.doc, [create(1), connect, create(2)]);
    expect(replay.changed).toBe(false);
    expect(replay.doc).toEqual(r.doc);
  });
});

describe('check.result projection', () => {
  const check: StudioCheckResultData = { stepId: 'c1', runId: 'run-c1', result: { status: 'unknown', targetRunId: 'run-v1', items: [
    { id: 'subject', status: 'pass', evidence: [{ kind: 'frame', timeSec: 2.5, observation: '主体是洗衣液' }], reason: '一致' },
    { id: 'caption', status: 'unknown', evidence: [], reason: '没有字幕' }] } };
  test('creates one check node beside the inspected segment, connected to it; replay is a no-op', () => {
    const withSegment = projectStudioNodeUpsert(empty, segment());
    const r = projectStudioCheckResult(withSegment, check, 'e1');
    const node = r.nodes.find(n => n.id === 'e1-c1-check')!;
    expect(node.metadata?.studio).toMatchObject({ kind: 'check', check: check.result, execution: { executionId: 'e1', stepId: 'c1', runId: 'run-c1' }, parentNodeId: 'e1-seg-1' });
    expect(r.connections).toContainEqual({ id: 'exec-edge-e1-seg-1-e1-c1-check', fromNodeId: 'e1-seg-1', toNodeId: 'e1-c1-check' });
    expect(checkSubject(r.nodes, node)?.id).toBe('e1-seg-1');
    const again = projectStudioCheckResult(r, check, 'e1');
    expect(again.outcome).toBe('unchanged');
    expect(again.nodes).toHaveLength(r.nodes.length);
    // Nodes and edges are applied by separate setters: projecting onto nodes that already hold the check node still yields its edge.
    const edgeOnly = projectStudioCheckResult({ nodes: r.nodes, connections: withSegment.connections }, check, 'e1');
    expect(edgeOnly.connections).toEqual(r.connections);
    const rerun = projectStudioCheckResult(r, { ...check, result: { ...check.result, status: 'pass' } }, 'e1');
    expect(rerun.nodes.find(n => n.id === 'e1-c1-check')!.metadata?.studio?.check?.status).toBe('pass');
  });
});

describe('execution projection', () => {
  const execution = (status: 'failed' | 'done'): StudioPlanExecution => ({ id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'running',
    steps: [{ id: 'v1', title: '第 1 段', operation: 'video', stage: 'production', dependsOn: [], status, runIds: ['run-v1'], attempt: 1, quotedCost: 40, reason: status === 'failed' ? '厂商没有返回画面' : undefined }],
    budgets: [], startedAt: '2026-10-18T01:00:00Z', deadlineAt: '2026-10-18T02:30:00Z', updatedAt: '2026-10-18T01:00:00Z' });
  const loading: CanvasNodeData = { ...source, id: 'seg', metadata: { status: 'loading', studio: { kind: 'shot', execution: { executionId: 'e1', stepId: 'v1' } } } };
  test('only resolves terminal states of bound nodes that still look busy', () => {
    expect(projectStudioExecution([loading], execution('failed'))[0].metadata).toMatchObject({ status: 'error', errorDetails: '厂商没有返回画面' });
    // No media yet → a done step does not fake a finished node.
    expect(projectStudioExecution([loading], execution('done'))[0].metadata?.status).toBe('loading');
    const unrelated = [source];
    expect(projectStudioExecution(unrelated, execution('failed'))).toBe(unrelated);
    expect(checkedStep(execution('done'), 'run-v1')?.id).toBe('v1');
  });
});
