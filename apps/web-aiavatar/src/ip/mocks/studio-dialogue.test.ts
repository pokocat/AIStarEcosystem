// @vitest-environment jsdom
// The demo dialogue runs the whole flow on the same reducer and contract as the real server.
import { beforeEach, expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioDialogueEvent, StudioNodeUpsertData } from '@ai-star-eco/types/ip-studio-workflow';
import { approvedCaps, approvedExecutionIds, dialogueReducer, emptyDialogueStore, planForApproval, type DialogueApprovalBlock, type DialogueStore } from '@/canvas-bridge/studio-dialogue-store';
import { executionRestoreUpserts, missingExecutionNodes, projectCanvasOps, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import { mockReadRun } from './ip-studio';
import {
  mockCreateSkillDraft, mockDialogueConversation, mockDialoguePost, mockDialogueSubscribe, mockDialogueTiming, mockExecutionCreate, mockExecutionGet, mockSeedCompletedExecution, resetMockDialogue,
} from './studio-dialogue';
import { completionExecutionId, skillDraftOutput, skillRequiredChoices } from '@/canvas-bridge/studio-skills';

beforeEach(() => { resetMockDialogue(); mockDialogueTiming.tickMs = 0; });

async function until(events: StudioDialogueEvent[], test: (e: StudioDialogueEvent) => boolean, limit = 4000) {
  for (let i = 0; i < limit; i++) { if (events.some(test)) return; await new Promise(r => setTimeout(r, 2)); }
  throw new Error('mock flow did not reach the expected event');
}

test('message → streamed text, a work record, a plan and a confirmation; approvals run analysis, then production with two segments and a check', async () => {
  const state = await mockDialogueConversation('p');
  let store: DialogueStore = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state, mode: 'replace' });
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe('p', state.thread.id, 0, e => { events.push(e); store = dialogueReducer(store, { type: 'event', event: e }); });
  const first = await mockDialoguePost('p', state.thread.id, { clientMessageId: 'c1', text: '换成我的洗衣液，保留最后的反转' });
  expect(first.queueState).toBe('accepted');
  expect(await mockDialoguePost('p', state.thread.id, { clientMessageId: 'c1', text: '换成我的洗衣液，保留最后的反转' })).toEqual(first);
  await until(events, e => e.type === 'turn.done');
  expect(events.filter(e => e.type === 'message.delta').length).toBeGreaterThan(3);
  expect(events.map(e => e.seq)).toEqual([...events.map(e => e.seq)].sort((a, b) => a - b));
  const reply = store.messages.find(m => m.role === 'assistant')!;
  expect(reply.blocks.map(b => b.type)).toEqual(['tool_call', 'plan', 'approval']);
  const analysis = reply.blocks.find((b): b is DialogueApprovalBlock => b.type === 'approval')!;
  expect(analysis.stage).toBe('analysis');

  const plan = planForApproval(store, analysis)!;
  const execution = await mockExecutionCreate('p', { clientRequestId: 'r1', stage: 'analysis', planRunId: plan.planRunId, planFingerprint: analysis.planFingerprint, budgetCap: analysis.budgetCap, autoFixCap: 0, approvalId: analysis.approvalId });
  expect(execution.stage).toBe('analysis');
  await until(events, e => e.type === 'approval.required' && (e.data as { block: DialogueApprovalBlock }).block.stage === 'production');
  await until(events, e => e.type === 'turn.done' && events.filter(x => x.type === 'turn.done').length >= 2);
  const production = [...store.messages].reverse().flatMap(m => m.blocks).find((b): b is DialogueApprovalBlock => b.type === 'approval' && b.stage === 'production')!;
  const productionPlan = planForApproval(store, production)!;
  expect(productionPlan.plan.approaches?.length).toBe(2);

  await mockExecutionCreate('p', { clientRequestId: 'r2', stage: 'production', planRunId: productionPlan.planRunId, planFingerprint: production.planFingerprint, budgetCap: production.budgetCap,
    autoFixCap: production.autoFixCap, executionId: execution.id, approachId: productionPlan.plan.recommendedApproachId, expectedRevision: productionPlan.revision, approvalId: production.approvalId, confirmationMessageId: 'm' });
  await until(events, e => e.type === 'turn.done' && (e.data as { reason: string }).reason === 'completed');
  stop();
  // Like the executor: one node per finished step under its stable id, with edges from its inputs, marked as demo output.
  const upserts = events.filter(e => e.type === 'node.upsert').map(e => e.data as StudioNodeUpsertData);
  const creates = upserts.filter(u => u.op === 'create');
  expect(creates.map(u => u.nodeId)).toEqual(['s1', 's2', 'v1', 'v2', 'c1'].map(id => `${execution.id}-${id.startsWith('s') ? 'a' : 'p'}-${id}`));
  expect(creates.every(u => (u.node?.metadata as { studio?: { mock?: boolean } })?.studio?.mock === true)).toBe(true);
  expect(upserts.filter(u => u.op === 'connect').map(u => u.connection)).toEqual([{ fromNodeId: `${execution.id}-a-s1`, toNodeId: `${execution.id}-a-s2` }]);
  const check = events.find(e => e.type === 'check.result')!.data as { result: { items: { status: string }[] } };
  expect(check.result.items.map(i => i.status)).toEqual(['pass', 'unknown']);
  // A finished execution is not in the snapshot; its card names it and it reads back by id. Its runs read back too.
  const snapshot = await mockDialogueConversation('p');
  expect(snapshot.execution).toBeUndefined();
  expect(snapshot.latestSeq).toBe(events.at(-1)!.seq);
  const done = await mockExecutionGet('p', execution.id);
  expect(done.status).toBe('done');
  expect(done.steps.filter(s => s.status === 'done').every(s => mockReadRun(s.runIds.at(-1)!).status === 'done')).toBe(true);
  const card = snapshot.messages.flatMap(m => m.blocks).find((b): b is DialogueApprovalBlock => b.type === 'approval' && b.stage === 'production')!;
  expect(card).toMatchObject({ status: 'approved', executionId: execution.id, approvedBudgetCap: production.budgetCap, approvedAutoFixCap: production.autoFixCap });
  // Projecting the live commands and then restoring from the execution adds nothing more.
  const live = projectCanvasOps({ nodes: [], connections: [] }, store.canvasOps);
  const runs = Object.fromEntries(done.steps.flatMap(s => s.runIds).map(id => [id, mockReadRun(id)]));
  const restore = projectCanvasOps(live.doc, executionRestoreUpserts(done, runs).map(data => ({ kind: 'node' as const, data, turnId: done.id, restore: true })));
  expect(live.doc.nodes.filter(n => n.metadata?.studio?.kind === 'check')).toHaveLength(1);
  expect(restore.changed).toBe(false);
  // The plans name the skill the thread was routed to, and the completion summary is keyed by its execution.
  expect(productionPlan.plan).toMatchObject({ skillKey: 'video-recreation', skillVersion: 2 });
  expect(snapshot.thread).toMatchObject({ skillKey: 'video-recreation', skillVersion: 2 });
  const summary = snapshot.messages.at(-1)!;
  expect(completionExecutionId(summary)).toBe(execution.id);
  expect(summary.suggestions?.length).toBeGreaterThan(1);
  // 「整理成技能草稿」: one run per request key, done with the saved draft version.
  const draft = await mockCreateSkillDraft('p', { clientRequestId: 'd1', executionId: execution.id, maxCost: 0 });
  expect((await mockCreateSkillDraft('p', { clientRequestId: 'd1', executionId: execution.id, maxCost: 0 })).id).toBe(draft.id);
  expect(skillDraftOutput(mockReadRun(draft.id))).toMatchObject({ skillKey: 'video-recreation', version: 3, baseVersion: 2 });
}, 20000);

test('skill routing: a tie asks the user, an explicit choice binds the thread, and a bound thread cannot switch', async () => {
  const state = await mockDialogueConversation('route');
  const tie = await mockDialoguePost('route', state.thread.id, { clientMessageId: 'x1', text: '照着这条复刻一条口播' }).catch(e => e);
  expect(skillRequiredChoices(tie)?.map(s => s.name)).toEqual(['短视频复刻', '口播种草']);
  expect(tie.status).toBe(400);
  expect((await mockDialoguePost('route', state.thread.id, { clientMessageId: 'x2', text: '照着这条复刻一条口播', skillKey: 'talking-head-seeding' })).queueState).toBe('accepted');
  expect((await mockDialogueConversation('route')).thread).toMatchObject({ skillKey: 'talking-head-seeding', skillVersion: 1 });
  const switched = await mockDialoguePost('route', state.thread.id, { clientMessageId: 'x3', text: '换成复刻', skillKey: 'video-recreation' }).catch(e => e);
  expect(switched).toMatchObject({ code: 'STUDIO_INPUT_INVALID', status: 400 });
});

test('a canvas whose recreation finished while it was closed: nodes come back from the execution, not from pruned events', async () => {
  const seeded = mockSeedCompletedExecution('closed');
  const state = await mockDialogueConversation('closed');
  expect(state.execution).toBeUndefined();
  let store: DialogueStore = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state, mode: 'replace', restoreCanvas: true });
  // The history is gone: subscribing from the start is refused like a 410.
  let expired = false;
  const stop = mockDialogueSubscribe('closed', state.thread.id, 0, () => {}, () => { expired = true; });
  await new Promise(r => setTimeout(r, 5)); stop();
  expect(expired).toBe(true);
  store = dialogueReducer(store, { type: 'snapshot', state, mode: 'replace' });
  expect(approvedExecutionIds(store)).toEqual([seeded.id]);
  const execution = await mockExecutionGet('closed', seeded.id);
  const card = store.messages.flatMap(m => m.blocks).find((b): b is DialogueApprovalBlock => b.type === 'approval' && b.stage === 'production')!;
  expect(approvedCaps(card, [execution])).toMatchObject({ budgetCap: 100, autoFixCap: 20 });
  const steps = missingExecutionNodes(execution, [], new Set());
  const runs: Record<string, IpRun> = Object.fromEntries(steps.flatMap(stepRunCandidates).map(id => [id, mockReadRun(id)]));
  const r = projectCanvasOps({ nodes: [], connections: [] }, executionRestoreUpserts(execution, runs).map(data => ({ kind: 'node' as const, data, turnId: execution.id, restore: true })));
  expect(r.doc.nodes.map(n => n.title)).toEqual(['拉片：切成 2 段', '整理每段的画面和节奏', '第 1 段视频', '第 2 段视频', '第 1 段视频 · 检查']);
  expect(r.doc.nodes.every(n => n.metadata?.studio?.mock === true)).toBe(true);
  expect(r.doc.connections).toHaveLength(2);
});

test('a message sent while a turn runs is queued and later marked applied', async () => {
  mockDialogueTiming.tickMs = 15;
  const state = await mockDialogueConversation('q');
  await mockDialoguePost('q', state.thread.id, { clientMessageId: 'a', text: '先做一个' });
  const queued = await mockDialoguePost('q', state.thread.id, { clientMessageId: 'b', text: '预算提高到 2000' });
  expect(queued.queueState).toBe('queued');
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe('q', state.thread.id, 0, e => events.push(e));
  await until(events, e => e.type === 'turn.done' && events.filter(x => x.type === 'turn.done').length >= 2);
  stop();
  const snapshot = await mockDialogueConversation('q');
  expect(snapshot.messages.find(m => m.clientMessageId === 'b')?.status).toBe('applied');
}, 20000);
