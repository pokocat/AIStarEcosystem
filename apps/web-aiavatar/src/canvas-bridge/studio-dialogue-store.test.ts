import { describe, expect, test } from 'vitest';
import type { StudioDialogueEvent, StudioDialogueEventType, StudioDialogueMessage, StudioDialogueState, StudioMessageBlock } from '@ai-star-eco/types/ip-studio-workflow';
import { dialogueCursor, dialogueReducer, emptyDialogueStore, executionBudget, messageQueueLabel, planForApproval, type DialogueStore } from './studio-dialogue-store';

const thread = { id: 'th', projectId: 'p', lastSeq: 5, createdAt: '2026-10-18T01:00:00Z', updatedAt: '2026-10-18T01:00:00Z' };
const userMessage: StudioDialogueMessage = { id: 'u1', threadId: 'th', seq: 5, role: 'user', text: '换成我的洗衣液', blocks: [], status: 'done', createdAt: '2026-10-18T01:00:00Z', clientMessageId: 'c1' };
const state = (over: Partial<StudioDialogueState> = {}): StudioDialogueState => ({ thread, messages: [userMessage], latestSeq: 5, ...over });
const loaded = (over: Partial<StudioDialogueState> = {}) => dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state(over), mode: 'replace' });
let at = 0;
const ev = <T,>(seq: number, type: StudioDialogueEventType, data: T, extra: Partial<StudioDialogueEvent> = {}): StudioDialogueEvent<T> =>
  ({ eventId: `e${seq}`, seq, threadId: 'th', turnId: 't1', createdAt: new Date(Date.UTC(2026, 9, 18, 1, 0, at++)).toISOString(), type, data, ...extra });
const fold = (store: DialogueStore, ...events: StudioDialogueEvent[]) => events.reduce((s, event) => dialogueReducer(s, { type: 'event', event }), store);
const delta = (seq: number, text: string, partId = 'a', messageId = 'm1') => ev(seq, 'message.delta', { messageId, partId, delta: text });

describe('message.delta', () => {
  test('appends real streamed text in seq order and ignores replays at or below the applied seq', () => {
    const s = fold(loaded(), delta(6, '我先看'), delta(7, '一下素材'), delta(6, '我先看'), delta(4, '旧的'));
    const m = s.messages.find(x => x.id === 'm1')!;
    expect(m.text).toBe('我先看一下素材');
    expect(m.status).toBe('streaming');
    expect(s.latestSeq).toBe(7);
    expect(s.activeTurnId).toBe('t1');
  });
  test('keeps text parts and blocks in arrival order inside one message', () => {
    const s = fold(loaded(), delta(6, '先读画布。', 'a'),
      ev(7, 'tool.started', { toolCallId: 'x', toolName: 'read_canvas', title: '读取画布素材', safeInputSummary: '3 个节点' }),
      delta(8, '读完了。', 'b'));
    expect(s.layouts.m1.order).toEqual(['t:a', 'b:tool:x', 't:b']);
    expect(s.messages.find(m => m.id === 'm1')!.text).toBe('先读画布。读完了。');
  });
  test('a tool event before any text attaches to a placeholder that takes the real message id later', () => {
    const s = fold(loaded(), ev(6, 'tool.started', { toolCallId: 'x', toolName: 'recreation', title: '拉片' }), delta(7, '开始拉片'));
    expect(s.messages.filter(m => m.role === 'assistant').map(m => m.id)).toEqual(['m1']);
    expect(s.messages.find(m => m.id === 'm1')!.blocks).toHaveLength(1);
    expect(s.turnMessages.t1).toBe('m1');
  });
});

describe('tool cards', () => {
  test('upsert by toolCallId: one card from started to finished, with actual credits and duration', () => {
    const s = fold(loaded(), delta(6, '拉片'),
      ev(7, 'tool.started', { toolCallId: 'x', toolName: 'recreation', title: '拉片', safeInputSummary: '原片', childRunId: 'run-1' }),
      ev(8, 'tool.progress', { toolCallId: 'x', toolName: 'recreation', progress: '已切成 5 段' }),
      ev(9, 'tool.finished', { toolCallId: 'x', toolName: 'recreation', status: 'done', result: { summary: '5 段' }, creditsActual: 18, settling: false }));
    const blocks = s.messages.find(m => m.id === 'm1')!.blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'tool_call', status: 'done', progress: '已切成 5 段', creditsActual: 18, settling: false, childRunId: 'run-1', result: { summary: '5 段' } });
    expect((blocks[0] as Extract<StudioMessageBlock, { type: 'tool_call' }>).durationMs).toBeGreaterThan(0);
  });
  test('a finished tool without actual credits stays pending settlement, and failures keep their message', () => {
    const s = fold(loaded(), delta(6, 'x'), ev(7, 'tool.started', { toolCallId: 'y', toolName: 'video' }),
      ev(8, 'tool.finished', { toolCallId: 'y', toolName: 'video', errorCode: 'VIDEO_FAILED', errorMessage: '厂商没有返回画面' }));
    expect(s.messages.find(m => m.id === 'm1')!.blocks[0]).toMatchObject({ status: 'failed', settling: true, errorMessage: '厂商没有返回画面' });
  });
});

describe('plans and approvals', () => {
  const approval = (id: string, fingerprint: string, status: 'pending' | 'approved' = 'pending') =>
    ({ type: 'approval' as const, approvalId: id, stage: 'production' as const, planFingerprint: fingerprint, scope: ['第 1 段'], quotedCost: 80, budgetCap: 120, autoFixCap: 40, status });
  const plan = (revision: number, fingerprint: string) => ({ type: 'plan' as const, planRunId: `plan-${revision}`, revision, fingerprint, plan: { summary: `第 ${revision} 版`, steps: [], questions: [] } });
  test('a new pending approval supersedes older pending cards and records its shortfall', () => {
    const s = fold(loaded(), delta(6, '方案'), ev(7, 'plan.proposed', { messageId: 'm1', block: plan(1, 'f1') }), ev(8, 'approval.required', { messageId: 'm1', block: approval('a1', 'f1') }),
      delta(9, '改好了', 'a', 'm2'), ev(10, 'plan.proposed', { messageId: 'm2', block: plan(2, 'f2') }), ev(11, 'approval.required', { messageId: 'm2', block: approval('a2', 'f2'), shortfall: 30 }));
    const blocks = s.messages.flatMap(m => m.blocks).filter(b => b.type === 'approval');
    expect(blocks.map(b => b.type === 'approval' && [b.approvalId, b.status])).toEqual([['a1', 'superseded'], ['a2', 'pending']]);
    expect(s.shortfalls.a2).toBe(30);
    expect(planForApproval(s, approval('a2', 'f2'))?.planRunId).toBe('plan-2');
    expect(planForApproval(s, approval('a3', 'nope'))).toBeUndefined();
  });
  test('a newer plan revision replaces the plan block of the same message', () => {
    const s = fold(loaded(), delta(6, '方案'), ev(7, 'plan.proposed', { messageId: 'm1', block: plan(1, 'f1') }), ev(8, 'plan.proposed', { messageId: 'm1', block: plan(2, 'f2') }));
    expect(s.messages.find(m => m.id === 'm1')!.blocks.filter(b => b.type === 'plan')).toHaveLength(1);
    expect(s.messages.find(m => m.id === 'm1')!.blocks[0]).toMatchObject({ revision: 2 });
  });
  test('local approval marks the card approved with its execution', () => {
    const s = dialogueReducer(fold(loaded(), delta(6, 'x'), ev(7, 'approval.required', { messageId: 'm1', block: approval('a1', 'f1') })), { type: 'approval.local', approvalId: 'a1', status: 'approved', executionId: 'e1' });
    expect(s.messages.find(m => m.id === 'm1')!.blocks[0]).toMatchObject({ status: 'approved', executionId: 'e1' });
  });
});

describe('turn.done and execution events', () => {
  test('finishes the message, keeps up to three suggestions and does not reactivate on later execution events', () => {
    const s = fold(loaded(), delta(6, '好了'),
      ev(7, 'turn.done', { reason: 'completed', messageId: 'm1', billing: { inputTokens: 10, outputTokens: 5, credits: 2, inputCreditsPerK: 1, outputCreditsPerK: 1 }, suggestions: ['改画幅', '存模板', '只改第 3 段', '多余的'] }),
      ev(8, 'node.upsert', { nodeId: 'n1', op: 'create', node: { id: 'n1', type: 'video', title: '第 1 段', position: { x: 0, y: 0 }, width: 10, height: 10 } }, { executionId: 'e1' }));
    expect(s.messages.find(m => m.id === 'm1')).toMatchObject({ status: 'done', billing: { credits: 2 } });
    expect(s.suggestions.m1).toEqual(['改画幅', '存模板', '只改第 3 段']);
    expect(s.activeTurnId).toBeUndefined();
    expect(s.canvasOps).toHaveLength(1);
    expect(s.executionTouchedSeq).toBe(8);
  });
  test('interrupted and failed turns are visible as such', () => {
    expect(fold(loaded(), delta(6, 'x'), ev(7, 'turn.done', { reason: 'interrupted', messageId: 'm1' })).messages.find(m => m.id === 'm1')!.status).toBe('interrupted');
    expect(fold(loaded(), delta(6, 'x'), ev(7, 'turn.done', { reason: 'failed', messageId: 'm1' })).messages.find(m => m.id === 'm1')!.status).toBe('failed');
  });
  test('budget updates patch the live execution budget for its stage', () => {
    const execution = { id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production' as const, planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'running' as const, steps: [],
      budgets: [{ stage: 'production' as const, approvedCap: 120, autoFixCap: 40, spent: 0, inFlight: 0, remaining: 120 }], startedAt: thread.createdAt, deadlineAt: thread.createdAt, updatedAt: thread.createdAt };
    const s = fold(loaded({ execution }), ev(6, 'budget.update', { executionId: 'e1', stage: 'production', approvedCap: 120, spent: 40, inFlight: 40, remaining: 40, source: 'actual' }, { executionId: 'e1' }));
    expect(executionBudget(s)).toMatchObject({ spent: 40, inFlight: 40, remaining: 40, autoFixCap: 40 });
  });
});

describe('canvas cursor', () => {
  test('replays canvas commands above the projected cursor without re-appending text', () => {
    const s0 = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state({ latestSeq: 9, messages: [userMessage, { ...userMessage, id: 'm1', role: 'assistant', seq: 6, text: '做好了', clientMessageId: undefined }] }), mode: 'replace', canvasAckSeq: 6 });
    expect(dialogueCursor(s0)).toBe(6);
    const upsert = ev(8, 'node.upsert', { nodeId: 'n1', op: 'create' });
    const s1 = fold(s0, delta(7, '做好了'), upsert, upsert);
    expect(s1.messages.find(m => m.id === 'm1')!.text).toBe('做好了');
    expect(s1.canvasOps.map(op => op.seq)).toEqual([8]);
    const s2 = dialogueReducer(s1, { type: 'canvas.ack', seq: 8 });
    expect(s2.canvasOps).toEqual([]);
    expect(s2.canvasAckSeq).toBe(8);
    expect(dialogueCursor(s2)).toBe(8);
  });
  test('an expired cursor on the same thread jumps to the snapshot instead of replaying forever', () => {
    const s = dialogueReducer(loaded(), { type: 'snapshot', state: state({ latestSeq: 40 }), mode: 'replace' });
    expect(dialogueCursor(s)).toBe(40);
  });
});

describe('outbox and snapshots', () => {
  test('an accepted message is ordered before the reply that follows it, with its queue state', () => {
    let s = dialogueReducer(loaded(), { type: 'outbox.add', item: { clientMessageId: 'c2', text: '第 3 段换人', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: '2026-10-18T01:01:00Z', state: 'sending' } });
    s = dialogueReducer(s, { type: 'outbox.sent', clientMessageId: 'c2', result: { messageId: 'u2', turnId: 't1', queueState: 'queued' } });
    s = fold(s, delta(6, '收到'));
    expect(s.outbox).toEqual([]);
    expect(s.messages.map(m => m.id)).toEqual(['u1', 'u2', 'm1']);
    expect(messageQueueLabel(s, s.messages.find(m => m.id === 'u2')!)).toBe('排队中，下一步应用');
  });
  test('a reply that streams in before the POST returns still follows the message that caused it', () => {
    let s = dialogueReducer(loaded(), { type: 'outbox.add', item: { clientMessageId: 'c3', text: '开始吧', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: '2026-10-18T01:01:00Z', state: 'sending' } });
    s = fold(s, delta(6, '好的'), delta(7, '，开始'));
    s = dialogueReducer(s, { type: 'outbox.sent', clientMessageId: 'c3', result: { messageId: 'u3', turnId: 't1', queueState: 'accepted' } });
    expect(s.messages.map(m => m.id)).toEqual(['u1', 'u3', 'm1']);
    expect(s.activeTurnId).toBe('t1');
  });
  test('a failed send stays in the outbox for a same-key retry; a snapshot that contains it clears it', () => {
    let s = dialogueReducer(loaded(), { type: 'outbox.add', item: { clientMessageId: 'c9', text: '加字幕', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: '2026-10-18T01:01:00Z', state: 'sending' } });
    s = dialogueReducer(s, { type: 'outbox.failed', clientMessageId: 'c9', error: '网络中断' });
    expect(s.outbox[0]).toMatchObject({ state: 'failed', error: '网络中断' });
    s = dialogueReducer(s, { type: 'snapshot', state: state({ latestSeq: 6, messages: [userMessage, { ...userMessage, id: 'u9', seq: 6, text: '加字幕', clientMessageId: 'c9', status: 'applied' }] }), mode: 'merge' });
    expect(s.outbox).toEqual([]);
    expect(messageQueueLabel(s, s.messages.find(m => m.id === 'u9')!)).toBe('已应用');
  });
  test('a merge snapshot keeps the live arrangement when the saved text matches what streamed', () => {
    const live = fold(loaded(), delta(6, '先读。', 'a'), ev(7, 'tool.started', { toolCallId: 'x', toolName: 'read_canvas' }), delta(8, '读完。', 'b'), ev(9, 'turn.done', { reason: 'completed', messageId: 'm1' }));
    const saved = live.messages.find(m => m.id === 'm1')!;
    const question: StudioMessageBlock = { type: 'question', questionId: 'q', text: '新商品是哪一款？', options: ['洗衣液'] };
    const s = dialogueReducer(live, { type: 'snapshot', state: state({ latestSeq: 9, messages: [userMessage, { ...saved, status: 'done', blocks: [...saved.blocks, question] }] }), mode: 'merge' });
    expect(s.layouts.m1.order).toEqual(['t:a', 'b:tool:x', 't:b']);
    expect(s.messages.find(m => m.id === 'm1')!.blocks).toHaveLength(2);
    expect(s.latestSeq).toBe(9);
  });
  test('an older poll never rolls streamed text back', () => {
    const live = fold(loaded(), delta(6, '新内容'));
    const s = dialogueReducer(live, { type: 'snapshot', state: state({ latestSeq: 5 }), mode: 'merge' });
    expect(s.messages.find(m => m.id === 'm1')!.text).toBe('新内容');
  });
  test('switching to a branch replaces the thread and drops the old thread state', () => {
    const live = fold(loaded(), delta(6, '旧的'));
    const branch = { ...thread, id: 'th2', parentThreadId: 'th', branchFromMessageId: 'u1', lastSeq: 1 };
    const s = dialogueReducer(live, { type: 'snapshot', state: { thread: branch, messages: [{ ...userMessage, id: 'u1b', threadId: 'th2', seq: 1 }], latestSeq: 1 }, mode: 'replace' });
    expect(s.thread?.id).toBe('th2');
    expect(s.messages.map(m => m.id)).toEqual(['u1b']);
    expect(dialogueCursor(s)).toBe(1);
    // Events of the old thread no longer apply.
    expect(fold(s, delta(7, '串线')).messages).toHaveLength(1);
  });
});
