// The demo dialogue runs the whole flow on the same reducer and contract as the real server.
import { beforeEach, expect, test } from 'vitest';
import type { StudioDialogueEvent } from '@ai-star-eco/types/ip-studio-workflow';
import { dialogueReducer, emptyDialogueStore, planForApproval, type DialogueApprovalBlock, type DialogueStore } from '@/canvas-bridge/studio-dialogue-store';
import { mockDialogueConversation, mockDialoguePost, mockDialogueSubscribe, mockDialogueTiming, mockExecutionCreate, resetMockDialogue } from './studio-dialogue';

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
  const upserts = events.filter(e => e.type === 'node.upsert').map(e => e.data as { op: string; node?: { metadata?: { studio?: { mock?: boolean } } } });
  expect(upserts.filter(u => u.op === 'create')).toHaveLength(2);
  expect(upserts.every(u => u.node?.metadata?.studio?.mock === true)).toBe(true);
  const check = events.find(e => e.type === 'check.result')!.data as { result: { items: { status: string }[] } };
  expect(check.result.items.map(i => i.status)).toEqual(['pass', 'unknown']);
  const snapshot = await mockDialogueConversation('p');
  expect(snapshot.execution?.status).toBe('done');
  expect(snapshot.latestSeq).toBe(events.at(-1)!.seq);
}, 20000);

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
