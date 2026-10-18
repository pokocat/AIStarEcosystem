// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioCheckResultData, StudioNodeUpsertData, StudioPlanExecution } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import {
  checkSubject, checkedStep, executionOutputMissing, executionRestoreUpserts, missingExecutionNodes, projectCanvasOps, projectStudioCheckResult, projectStudioExecution,
  projectStudioNodeUpsert, readProjectedNodes, rememberProjectedNodes, runOutputKey, type ProjectionDoc,
} from './studio-plan-execution';

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

// ── Restore after the canvas was closed (.studio-e2e/report.md D05) ─────────
// Fixtures follow the server: the execution is StudioPlanExecutionService.toDto (step.nodeId = <id>-<a|p>-<stepId>),
// the runs are IpRunDto as GET /v1/ip-studio/runs/{id} returns them (the e2e evidence for IPP-c1278d9f).
describe('restore from execution state', () => {
  const at = '2026-10-18T20:01:13Z';
  const E = 'PEX-0c594b91f4f544d8a2b1';
  const run = (id: string, nodeId: string, kind: IpRun['kind'], output: IpRun['output'], status: IpRun['status'] = 'done'): IpRun =>
    ({ id, projectId: 'IPP-c1278d9f', nodeId, kind, status, stage: status, pct: 100, cost: 1, inputs: { executionId: E, stage: 'production' } as unknown as IpRun['inputs'], output, createdAt: at, finishedAt: at });
  const textOutput = (content: string) => ({ mock: false, textRevision: { summary: '验收文字已整理', content }, text: content });
  const execution: StudioPlanExecution = { id: E, projectId: 'IPP-c1278d9f', threadId: 'IPT-IPP-c1278d9f', skillKey: 'reference-video-recreation', skillVersion: 1, stage: 'production',
    planRunId: 'IPR-plan', planRevision: 2, planFingerprint: 'f2', status: 'done', budgets: [], startedAt: at, deadlineAt: at, updatedAt: at, finishedAt: at, steps: [
      { id: 'facts', title: '整理事实', operation: 'text', stage: 'analysis', dependsOn: [], status: 'done', runIds: ['IPR-a-facts'], attempt: 1, quotedCost: 140, maxCost: 140, nodeId: `${E}-a-facts` },
      { id: 'limits', title: '核对边界', operation: 'text', stage: 'analysis', dependsOn: ['facts'], status: 'done', runIds: ['IPR-a-limits'], attempt: 1, quotedCost: 140, nodeId: `${E}-a-limits` },
      { id: 'cut', title: '拉片', operation: 'recreation', stage: 'production', dependsOn: [], status: 'done', runIds: ['IPR-cut'], attempt: 1, quotedCost: 20, nodeId: `${E}-p-cut` },
      { id: 'v1', title: '第 1 段视频', operation: 'video', stage: 'production', dependsOn: ['cut'], status: 'done', runIds: ['IPR-v1-old', 'IPR-v1'], attempt: 2, quotedCost: 40, nodeId: `${E}-p-v1` },
      { id: 'c1', title: '检查第 1 段', operation: 'check', stage: 'production', dependsOn: ['v1'], status: 'done', runIds: ['IPR-c1'], attempt: 1, quotedCost: 2, nodeId: `${E}-p-c1` },
      { id: 'v2', title: '第 2 段视频', operation: 'video', stage: 'production', dependsOn: [], status: 'running', runIds: ['IPR-v2'], attempt: 1, quotedCost: 40, nodeId: `${E}-p-v2` },
    ] };
  const check = { status: 'unknown' as const, targetRunId: 'IPR-v1', targetStorageKey: 'ipstudio/v1.mp4', items: [{ id: 'dialogue-and-subtitles', status: 'unknown' as const, evidence: [], reason: '没有字幕' }] };
  const runs: Record<string, IpRun> = {
    'IPR-a-facts': run('IPR-a-facts', `${E}-a-facts`, 'studio-text', textOutput('本地验收的完整文字产物')),
    'IPR-a-limits': run('IPR-a-limits', `${E}-a-limits`, 'studio-text', textOutput('未知事项')),
    'IPR-cut': run('IPR-cut', `${E}-p-cut`, 'studio-recreation', { text: '两段', filmStudy: { source: undefined as never, strategy: 'model', segments: [
      { no: 1, title: '出场', startSec: 0, endSec: 4, storageKey: 'ipstudio/seg1.mp4', status: 'done' }, { no: 2, title: '反转', startSec: 4, endSec: 9, status: 'pending' }] } }),
    'IPR-v1-old': run('IPR-v1-old', `${E}-p-v1`, 'studio-video', { videoCandidates: [{ index: 0, jobId: 'j0', status: 'done', pct: 100, storageKey: 'ipstudio/v1-old.mp4', durationSec: 5 }] }),
    'IPR-v1': run('IPR-v1', `${E}-p-v1`, 'studio-video', { videoCandidates: [{ index: 0, jobId: 'j1', status: 'failed', pct: 100, durationSec: 5 }, { index: 1, jobId: 'j2', status: 'done', pct: 100, storageKey: 'ipstudio/v1.mp4', durationSec: 5 }] }),
    'IPR-c1': run('IPR-c1', `${E}-p-c1`, 'studio-check', { check }),
    'IPR-v2': run('IPR-v2', `${E}-p-v2`, 'studio-video', {}, 'running'),
  };
  const restore = (doc: ProjectionDoc, list = executionRestoreUpserts(execution, runs)) => projectCanvasOps(doc, list.map(data => ({ kind: 'node' as const, data, executionId: E, turnId: E, restore: true })));
  beforeEach(() => localStorage.clear());

  test('rebuilds exactly the commands the executor sends for a finished text step', () => {
    const facts = executionRestoreUpserts(execution, runs).find(d => d.nodeId === `${E}-a-facts`);
    // StudioPlanExecutor.nodeData + the text branch of nodeEvents.
    expect(facts).toEqual({ nodeId: `${E}-a-facts`, op: 'create', executionId: E, stepId: 'facts', runId: 'IPR-a-facts',
      node: { id: `${E}-a-facts`, type: 'text', title: '整理事实', width: 380, height: 320, position: { x: 0, y: 0 },
        metadata: { status: 'success', content: '本地验收的完整文字产物', studio: { runId: 'IPR-a-facts', execution: { executionId: E, stepId: 'facts', runId: 'IPR-a-facts' }, kind: 'text' } } } });
  });

  test('(a) an empty canvas gets every finished step, its edges, the check beside its subject and the film-study clips', () => {
    const r = restore({ nodes: [], connections: [] });
    expect(r.changed).toBe(true);
    expect(r.doc.nodes.map(n => n.id).sort()).toEqual([`${E}-a-facts`, `${E}-a-limits`, `${E}-p-c1`, `${E}-p-cut`, `${E}-p-cut-s1`, `${E}-p-v1`].sort());
    const v1 = r.doc.nodes.find(n => n.id === `${E}-p-v1`)!;
    // The latest successful run, its first finished candidate; a step still running is left alone.
    expect(v1.metadata).toMatchObject({ status: 'success', storageKey: 'ipstudio/v1.mp4', studio: { kind: 'shot', execution: { executionId: E, stepId: 'v1', runId: 'IPR-v1' } } });
    const c1 = r.doc.nodes.find(n => n.id === `${E}-p-c1`)!;
    expect(c1.title).toBe('第 1 段视频 · 检查');
    expect(c1.metadata?.studio).toMatchObject({ kind: 'check', check, parentNodeId: `${E}-p-v1` });
    expect(r.doc.nodes.find(n => n.id === `${E}-p-cut-s1`)!.metadata).toMatchObject({ storageKey: 'ipstudio/seg1.mp4', studio: { sourceRange: { startSec: 0, endSec: 4, storageKey: 'ipstudio/seg1.mp4' } } });
    expect(r.doc.connections.map(c => `${c.fromNodeId}>${c.toNodeId}`).sort()).toEqual([
      `${E}-a-facts>${E}-a-limits`, `${E}-p-cut>${E}-p-cut-s1`, `${E}-p-cut>${E}-p-v1`, `${E}-p-v1>${E}-p-c1`].sort());
    // Nodes are laid out, not stacked at the origin.
    expect(new Set(r.doc.nodes.map(n => `${n.position.x},${n.position.y}`)).size).toBe(r.doc.nodes.length);
    expect(r.projected.sort()).toEqual(r.doc.nodes.map(n => n.id).sort());
  });

  test('(b) restoring again, or replaying the live events afterwards, never duplicates', () => {
    const first = restore({ nodes: [], connections: [] }).doc;
    const again = restore(first);
    expect(again.changed).toBe(false);
    expect(again.doc).toEqual(first);
    const live = projectCanvasOps(first, executionRestoreUpserts(execution, runs).map(data => ({ kind: 'node' as const, data, executionId: E, turnId: E })));
    expect(live.doc.nodes).toHaveLength(first.nodes.length);
    expect(live.doc.connections).toHaveLength(first.connections.length);
    expect(live.proposals).toEqual([]);
  });

  test('(c) a node the user already edited is left exactly as it is, with no adoption proposal', () => {
    const edited = restore({ nodes: [], connections: [] }).doc;
    const mine = { ...edited, nodes: edited.nodes.map(n => n.id === `${E}-a-facts` ? { ...n, title: '我的标题', metadata: { ...n.metadata, content: '我改过的事实' } } : n),
      connections: edited.connections.filter(c => c.toNodeId !== `${E}-a-limits`) };
    const r = restore(mine);
    expect(r.doc.nodes.find(n => n.id === `${E}-a-facts`)).toEqual(mine.nodes.find(n => n.id === `${E}-a-facts`));
    expect(r.proposals).toEqual([]);
    // An edge the user removed between two nodes that both exist stays removed.
    expect(r.doc.connections).toEqual(mine.connections);
    expect(r.changed).toBe(false);
  });

  test('a check node a check.result already made is the check step; the executor command merges into it instead of adding a second', () => {
    const withVideo = restore({ nodes: [], connections: [] }, executionRestoreUpserts(execution, runs, new Set([`${E}-p-v1`]))).doc;
    const fromResult = projectStudioCheckResult(withVideo, { stepId: 'c1', runId: 'IPR-c1', result: check }, E);
    expect(fromResult.nodes.some(n => n.id === `${E}-c1-check`)).toBe(true);
    const upsert = executionRestoreUpserts(execution, runs).find(d => d.nodeId === `${E}-p-c1`)!;
    const live = projectStudioNodeUpsert(fromResult, upsert);
    expect(live.nodes.filter(n => n.metadata?.studio?.kind === 'check')).toHaveLength(1);
    expect(live.connections.filter(c => c.toNodeId === `${E}-c1-check`)).toHaveLength(1);
    expect(missingExecutionNodes(execution, fromResult.nodes, new Set()).map(s => s.id)).not.toContain('c1');
    expect(restore(fromResult, [upsert]).changed).toBe(false);
  });

  test('missing steps: only finished ones the canvas lacks and this viewer never projected', () => {
    const doc = restore({ nodes: [], connections: [] }, executionRestoreUpserts(execution, runs, new Set([`${E}-a-facts`]))).doc;
    rememberProjectedNodes('IPP-c1278d9f', [`${E}-p-cut`]);
    expect(missingExecutionNodes(execution, doc.nodes, readProjectedNodes('IPP-c1278d9f')).map(s => s.id)).toEqual(['limits', 'v1', 'c1']);
    expect(runOutputKey(runs['IPR-v1'].output, 0)).toBeUndefined();
    expect(runOutputKey({ candidates: [{ key: 'img/0.png', url: 'u' }, { key: 'img/1.png', url: 'u' }] }, 1)).toBe('img/1.png');
  });

  test('the canvas-open signal: a finished execution run that no node stands for and was never projected here', () => {
    const list = Object.values(runs);
    expect(executionOutputMissing(list, [], new Set())).toBe(true);
    const doc = restore({ nodes: [], connections: [] }).doc;
    // v2 is still running; the rest is on the canvas (the check under the id a check.result would have used is fine too).
    expect(executionOutputMissing(list, doc.nodes, new Set())).toBe(false);
    expect(executionOutputMissing(list, doc.nodes.filter(n => n.id !== `${E}-p-v1`), new Set())).toBe(true);
    expect(executionOutputMissing(list, doc.nodes.filter(n => n.id !== `${E}-p-v1`), new Set([`${E}-p-v1`]))).toBe(false);
    expect(executionOutputMissing([{ ...runs['IPR-a-facts'], inputs: {} }], [], new Set())).toBe(false);
  });
});
