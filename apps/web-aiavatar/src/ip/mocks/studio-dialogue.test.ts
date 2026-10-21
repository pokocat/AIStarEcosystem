// Runs in node: nothing here renders; the one storage call (mocks/ip-studio.ts, the projected-node reset) is guarded.
// The demo dialogue runs the whole flow on the same reducer and contract as the real server.
import { beforeEach, expect, test } from 'vitest';
import type { IpProject, IpRun } from '@ai-star-eco/types';
import type { StudioDialogueEvent, StudioNodeUpsertData } from '@ai-star-eco/types/ip-studio-workflow';
import { approvedCaps, approvedExecutionIds, dialogueReducer, emptyDialogueStore, planForApproval, type DialogueApprovalBlock, type DialogueStore } from '@/canvas-bridge/studio-dialogue-store';
import { executionRestoreUpserts, missingExecutionNodes, projectCanvasOps, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import { mockReadRun, mockStore } from './ip-studio';
import {
  mockCreateSkillDraft, mockDialogueConversation, mockDialoguePost, mockDialogueSubscribe, mockDialogueTiming, mockExecutionCreate, mockExecutionGet, mockSeedCompletedExecution, resetMockDialogue,
} from './studio-dialogue';
import { completionExecutionId, skillDraftOutput } from '@/canvas-bridge/studio-skills';

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
  // The message names the job (「复刻」): since 2026-10-20 a message that hits no skill no longer falls back to the default
  // skill, it stays unbound like on the server (docs/ip-studio-dialogue-intents.md §4).
  const first = await mockDialoguePost('p', state.thread.id, { clientMessageId: 'c1', text: '复刻这条，换成我的洗衣液，保留最后的反转' });
  expect(first.queueState).toBe('accepted');
  expect(await mockDialoguePost('p', state.thread.id, { clientMessageId: 'c1', text: '复刻这条，换成我的洗衣液，保留最后的反转' })).toEqual(first);
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

// Routing follows StudioSkillRouter since 意图直达 (2026-10-20): keywords ×2, media ×1, a unique best wins, no hit keeps the
// current skill, a tie keeps the current skill or binds none (no more 400 STUDIO_SKILL_REQUIRED), and a thread without an
// active execution is routed again on every message.
async function settled(projectId: string, threadId: string) {
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe(projectId, threadId, 0, e => events.push(e));
  return { events, stop, done: (n: number) => until(events, e => e.type === 'turn.done' && events.filter(x => x.type === 'turn.done').length >= n) };
}
function canvasWith(projectId: string, nodes: { id: string; type: string }[]) {
  mockStore().projects.set(projectId, { id: projectId, name: projectId, status: 'draft', createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', runs: {}, runsById: {},
    doc: { nodes: nodes.map(n => ({ ...n, title: n.id, position: { x: 0, y: 0 }, width: 320, height: 240, metadata: {} })), connections: [], viewport: { x: 0, y: 0, k: 1 } } } as unknown as IpProject);
}

test('skill routing: a tie binds nothing and answers without a 400; an explicit choice binds; switching is refused only during an active execution', async () => {
  const state = await mockDialogueConversation('route'), id = state.thread.id, flow = await settled('route', id);
  // 「照着」 (复刻) and 「做一条」 (出视频) score the same: no skill, no question, a plain answer.
  expect((await mockDialoguePost('route', id, { clientMessageId: 'x1', text: '照着做一条' })).queueState).toBe('accepted');
  expect((await mockDialogueConversation('route')).thread.skillKey).toBeUndefined();
  await flow.done(1);
  expect(await mockDialoguePost('route', id, { clientMessageId: 'x2', text: '照着这条复刻一条口播', skillKey: 'talking-head-seeding' })).toMatchObject({ queueState: 'accepted' });
  expect((await mockDialogueConversation('route')).thread).toMatchObject({ skillKey: 'talking-head-seeding', skillVersion: 1 });
  await flow.done(2);
  // No execution yet (the analysis card is still pending): an explicit switch is allowed and starts that job.
  expect(await mockDialoguePost('route', id, { clientMessageId: 'x3', text: '换成复刻', skillKey: 'video-recreation' })).toMatchObject({ queueState: 'accepted' });
  expect((await mockDialogueConversation('route')).thread).toMatchObject({ skillKey: 'video-recreation', skillVersion: 2 });
  await flow.done(3);
  // Once the analysis runs, the method is fixed: an explicit switch is refused, a routed message keeps it.
  const store = (await mockDialogueConversation('route'));
  const card = store.messages.flatMap(m => m.blocks).filter((b): b is DialogueApprovalBlock => b.type === 'approval' && b.status === 'pending').at(-1)!;
  await mockExecutionCreate('route', { clientRequestId: 'r1', stage: 'analysis', planRunId: 'mock-plan-analysis', planFingerprint: card.planFingerprint, budgetCap: card.budgetCap, autoFixCap: 0, approvalId: card.approvalId });
  await flow.done(4);
  expect(await mockDialoguePost('route', id, { clientMessageId: 'x4', text: '画一张海报', skillKey: 'image-generation' }).catch(e => e)).toMatchObject({ code: 'STUDIO_INPUT_INVALID', status: 400 });
  await mockDialoguePost('route', id, { clientMessageId: 'x5', text: '画一张海报' });
  expect((await mockDialogueConversation('route')).thread.skillKey).toBe('video-recreation');
  flow.stop();
}, 20000);

test('skill routing: words outrank media, and a message without a hit stays on the current job', async () => {
  canvasWith('mixed', [{ id: 'pic', type: 'image' }]);
  // 「写一段文案」 with a product image attached: 写一段 + 文案 (4) beat the image's +1 for 出图 / 出视频 / 口播种草.
  const a = await mockDialogueConversation('mixed');
  await mockDialoguePost('mixed', a.thread.id, { clientMessageId: 'w1', text: '用这张图写一段文案', attachmentNodeIds: ['pic'] });
  expect((await mockDialogueConversation('mixed')).thread.skillKey).toBe('script-writing');
  // Media alone counts too: a pinned video with no keyword picks the one skill whose media is video.
  canvasWith('clip', [{ id: 'ref', type: 'video' }]);
  const c = await mockDialogueConversation('clip');
  await mockDialoguePost('clip', c.thread.id, { clientMessageId: 'v1', text: '照这个来', pinnedNodeIds: ['ref'] });
  expect((await mockDialogueConversation('clip')).thread.skillKey).toBe('video-recreation');
  // An image job, then follow-ups with and without a keyword: both stay 出图.
  const b = await mockDialogueConversation('again'), flow = await settled('again', b.thread.id);
  await mockDialoguePost('again', b.thread.id, { clientMessageId: 'i1', text: '画一张国风少女海报，9:16' });
  expect((await mockDialogueConversation('again')).thread.skillKey).toBe('image-generation');
  await flow.done(1);
  await mockDialoguePost('again', b.thread.id, { clientMessageId: 'i2', text: '背景再亮一点' });
  expect((await mockDialogueConversation('again')).thread.skillKey).toBe('image-generation');
  await flow.done(2);
  await mockDialoguePost('again', b.thread.id, { clientMessageId: 'i3', text: '再来一张，背景亮一点' });
  expect((await mockDialogueConversation('again')).thread.skillKey).toBe('image-generation');
  await flow.done(3);
  // Nothing active: a message naming another job switches the thread (画完图再写文案).
  await mockDialoguePost('again', b.thread.id, { clientMessageId: 'i4', text: '再写一段口播' });
  expect((await mockDialogueConversation('again')).thread.skillKey).toBe('script-writing');
  flow.stop();
}, 20000);

test('a direct skill: plan and production card in one reply, the card names no execution and starting it runs production at once', async () => {
  const state = await mockDialogueConversation('img');
  let store: DialogueStore = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state, mode: 'replace' });
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe('img', state.thread.id, 0, e => { events.push(e); store = dialogueReducer(store, { type: 'event', event: e }); });
  await mockDialoguePost('img', state.thread.id, { clientMessageId: 'c1', text: '画一张国风少女海报，9:16' });
  await until(events, e => e.type === 'turn.done');
  const reply = store.messages.find(m => m.role === 'assistant')!;
  expect(reply.blocks.map(b => b.type)).toEqual(['plan', 'approval']);
  const card = reply.blocks.find((b): b is DialogueApprovalBlock => b.type === 'approval')!;
  expect(card.stage).toBe('production');
  expect(card.executionId).toBeUndefined();
  const plan = planForApproval(store, card)!;
  expect(plan.plan).toMatchObject({ stage: 'production', skillKey: 'image-generation', skillVersion: 1 });
  expect(plan.plan.approaches).toBeUndefined();
  // A plan that is not a direct skill's still needs its analysis first.
  expect(await Promise.resolve().then(() => mockExecutionCreate('img', { clientRequestId: 'bad', stage: 'production', planRunId: 'mock-plan-analysis', planFingerprint: 'x', budgetCap: 10, autoFixCap: 0 })).catch(e => e))
    .toMatchObject({ code: 'STUDIO_INPUT_INVALID', status: 400 });
  // 「可以」 typed back confirms the card like the button: production starts without an executionId.
  await mockDialoguePost('img', state.thread.id, { clientMessageId: 'c2', text: '可以' });
  await until(events, e => e.type === 'turn.done' && (e.data as { reason: string }).reason === 'completed');
  stop();
  const approved = store.messages.flatMap(m => m.blocks).find((b): b is DialogueApprovalBlock => b.type === 'approval' && b.approvalId === card.approvalId)!;
  expect(approved).toMatchObject({ status: 'approved', approvedBudgetCap: card.budgetCap });
  const execution = await mockExecutionGet('img', approved.executionId!);
  expect(execution).toMatchObject({ stage: 'production', status: 'done', skillKey: 'image-generation', planRunId: plan.planRunId });
  expect(execution.budgets.map(b => b.stage)).toEqual(['production']);
  expect(execution.steps.map(s => [s.operation, s.stage, s.status])).toEqual([['image', 'production', 'done']]);
  const creates = events.filter(e => e.type === 'node.upsert').map(e => e.data as StudioNodeUpsertData).filter(u => u.op === 'create');
  expect(creates.map(u => [u.nodeId, u.node?.type])).toEqual([[`${execution.id}-p-d1`, 'image']]);
  expect(mockReadRun(execution.steps[0].runIds.at(-1)!).status).toBe('done');
  // Zero credits in the demo; the summary is keyed by its execution.
  expect(events.filter(e => e.type === 'turn.done').every(e => (e.data as { billing?: { credits: number } }).billing?.credits === 0)).toBe(true);
  expect(completionExecutionId((await mockDialogueConversation('img')).messages.at(-1)!)).toBe(execution.id);
}, 20000);

test('one finished clip is already the whole video: no 「合成一条成片」 follow-up (StudioExecutionSummary offers it from two clips)', async () => {
  const state = await mockDialogueConversation('clip');
  let store: DialogueStore = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state, mode: 'replace' });
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe('clip', state.thread.id, 0, e => { events.push(e); store = dialogueReducer(store, { type: 'event', event: e }); });
  await mockDialoguePost('clip', state.thread.id, { clientMessageId: 'c1', text: '做一条 5 秒的产品短片' });
  await until(events, e => e.type === 'turn.done');
  expect(store.messages.find(m => m.role === 'assistant')!.blocks.map(b => b.type)).toEqual(['plan', 'approval']);
  await mockDialoguePost('clip', state.thread.id, { clientMessageId: 'c2', text: '可以' });
  await until(events, e => e.type === 'turn.done' && (e.data as { reason: string }).reason === 'completed');
  stop();
  const summary = (await mockDialogueConversation('clip')).messages.at(-1)!;
  expect(completionExecutionId(summary)).toBeTruthy();
  expect(summary.suggestions).toEqual(['把这张画布存为模板']);
}, 20000);

test('写剧本与文案 writes a short draft straight onto the canvas: one text node, no plan, no card', async () => {
  const state = await mockDialogueConversation('copy');
  const events: StudioDialogueEvent[] = [];
  const stop = mockDialogueSubscribe('copy', state.thread.id, 0, e => events.push(e));
  await mockDialoguePost('copy', state.thread.id, { clientMessageId: 'c1', text: '写一段保温杯的口播' });
  await until(events, e => e.type === 'turn.done');
  stop();
  expect(events.some(e => e.type === 'plan.proposed' || e.type === 'approval.required')).toBe(false);
  const created = events.filter(e => e.type === 'node.upsert').map(e => e.data as StudioNodeUpsertData);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ op: 'create', node: { type: 'text', metadata: { studio: { mock: true } } } });
  expect(created[0].executionId).toBeUndefined();
  expect((await mockDialogueConversation('copy')).thread.skillKey).toBe('script-writing');
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
