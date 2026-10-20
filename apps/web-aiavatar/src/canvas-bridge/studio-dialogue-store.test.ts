import { describe, expect, test } from 'vitest';
import type { StudioDialogueEvent, StudioDialogueEventType, StudioDialogueMessage, StudioDialogueState, StudioMessageBlock } from '@ai-star-eco/types/ip-studio-workflow';
import {
  answeredAfter, approvedCaps, approvedExecutionIds, canvasRestoring, dialogueActivity, dialogueCursor, dialogueReducer, emptyDialogueStore, executionBudget, messageQueueLabel, messageSuggestions, persistableCanvasCursor, planForApproval,
  type DialogueApprovalBlock, type DialogueStore,
} from './studio-dialogue-store';

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
  test('a new plan revision replaces older pending cards as soon as it is proposed, before its own card arrives', () => {
    const s = fold(loaded(), delta(6, '方案'), ev(7, 'plan.proposed', { messageId: 'm1', block: plan(1, 'f1') }), ev(8, 'approval.required', { messageId: 'm1', block: approval('a1', 'f1') }),
      // A card whose plan is not loaded (older page) is replaced too; an approved card is history and stays.
      ev(9, 'approval.required', { messageId: 'm1', block: approval('a0', 'f0') }), ev(10, 'approval.required', { messageId: 'm1', block: approval('ax', 'fx', 'approved') }));
    const proposed = fold(s, ev(11, 'plan.proposed', { messageId: 'm2', block: plan(2, 'f2') }));
    const status = (store: DialogueStore) => Object.fromEntries(store.messages.flatMap(m => m.blocks).filter((b): b is DialogueApprovalBlock => b.type === 'approval').map(b => [b.approvalId, b.status]));
    expect(status(s)).toEqual({ a1: 'superseded', a0: 'pending', ax: 'approved' });
    expect(status(proposed)).toEqual({ a1: 'superseded', a0: 'superseded', ax: 'approved' });
    // The new card can even arrive before its plan: it is quoted for the newest fingerprint and stays usable.
    const early = fold(loaded(), delta(6, '方案'), ev(7, 'plan.proposed', { messageId: 'm1', block: plan(1, 'f1') }), ev(8, 'approval.required', { messageId: 'm1', block: approval('a1', 'f1') }),
      ev(9, 'approval.required', { messageId: 'm2', block: approval('a2', 'f2') }), ev(10, 'plan.proposed', { messageId: 'm2', block: plan(2, 'f2') }));
    expect(status(early)).toEqual({ a1: 'superseded', a2: 'pending' });
  });
  test('a snapshot re-reads the cards the server superseded, and never makes an outdated card actionable again', () => {
    const live = fold(loaded(), delta(6, '方案'), ev(7, 'plan.proposed', { messageId: 'm1', block: plan(1, 'f1') }), ev(8, 'approval.required', { messageId: 'm1', block: approval('a1', 'f1') }));
    const m1 = live.messages.find(m => m.id === 'm1')!;
    const server = (block: StudioMessageBlock) => ({ ...m1, status: 'done' as const, blocks: [plan(1, 'f1'), block] });
    // The server marked it superseded: the snapshot shows that.
    const marked = dialogueReducer(live, { type: 'snapshot', state: state({ latestSeq: 8, messages: [userMessage, server({ ...approval('a1', 'f1'), status: 'superseded' })] }), mode: 'merge' });
    expect(marked.messages.find(m => m.id === 'm1')!.blocks[1]).toMatchObject({ status: 'superseded' });
    // A server that still says pending while a newer revision exists does not resurrect it.
    const newer = { ...m1, id: 'm2', seq: 7, status: 'done' as const, blocks: [plan(2, 'f2'), approval('a2', 'f2')] };
    const stale = dialogueReducer(live, { type: 'snapshot', state: state({ latestSeq: 9, messages: [userMessage, server(approval('a1', 'f1')), newer] }), mode: 'merge' });
    expect(stale.messages.flatMap(m => m.blocks).filter(b => b.type === 'approval').map(b => b.type === 'approval' && [b.approvalId, b.status])).toEqual([['a1', 'superseded'], ['a2', 'pending']]);
    // Without a newer revision a pending card stays pending (its plan may simply not be loaded yet).
    const alone = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state({ latestSeq: 9, messages: [server(approval('a9', 'f9'))] }), mode: 'replace' });
    expect(alone.messages[0].blocks[1]).toMatchObject({ status: 'pending' });
  });
  test('a confirmed card reports what was actually authorized, never the proposal', () => {
    const execution = { id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production' as const, planRunId: 'pr', planRevision: 2, planFingerprint: 'f1', status: 'done' as const, steps: [],
      budgets: [{ stage: 'production' as const, approvedCap: 280, autoFixCap: 0, spent: 2, inFlight: 0, remaining: 278 }], startedAt: thread.createdAt, deadlineAt: thread.createdAt, updatedAt: thread.createdAt };
    const proposed = { ...approval('a1', 'f1'), budgetCap: 1000, autoFixCap: 40 };
    expect(approvedCaps(proposed, [execution])).toBeUndefined();
    const approved = { ...proposed, status: 'approved' as const, executionId: 'e1' };
    // Server snapshot of the authorization wins.
    expect(approvedCaps({ ...approved, approvedBudgetCap: 300, approvedAutoFixCap: 20, approvedAt: '2026-10-18T12:01:13Z', approvedPlanRevision: 2 }, [execution]))
      .toEqual({ budgetCap: 300, autoFixCap: 20, approvedAt: '2026-10-18T12:01:13Z', planRevision: 2 });
    // Else the execution's stage budget; else nothing (not the 1000 it proposed).
    expect(approvedCaps(approved, [undefined, execution])).toEqual({ budgetCap: 280, autoFixCap: 0, approvedAt: undefined, planRevision: undefined });
    expect(approvedCaps(approved, [])).toEqual({ approvedAt: undefined, planRevision: undefined });
    // A local approval records the accepted caps until the server's snapshot of the card arrives.
    const s = dialogueReducer(fold(loaded(), delta(6, 'x'), ev(7, 'approval.required', { messageId: 'm1', block: proposed })),
      { type: 'approval.local', approvalId: 'a1', status: 'approved', executionId: 'e1', approved: { budgetCap: 280, autoFixCap: 0 } });
    expect(s.messages.find(m => m.id === 'm1')!.blocks[0]).toMatchObject({ status: 'approved', budgetCap: 1000, approvedBudgetCap: 280, approvedAutoFixCap: 0 });
    expect(approvedExecutionIds(s)).toEqual(['e1']);
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
  test('first open without a canvas cursor replays from the start; commands up to the snapshot only restore', () => {
    const saved = { ...userMessage, id: 'm1', role: 'assistant' as const, seq: 6, text: '做好了', clientMessageId: undefined };
    const s0 = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state({ latestSeq: 9, messages: [userMessage, saved] }), mode: 'replace', restoreCanvas: true });
    expect(dialogueCursor(s0)).toBe(0);
    expect(canvasRestoring(s0)).toBe(true);
    expect(persistableCanvasCursor(s0)).toBeUndefined();
    const s1 = fold(s0, ev(3, 'node.upsert', { nodeId: 'n1', op: 'create' }, { executionId: 'e1' }), ev(4, 'node.upsert', { nodeId: 'draft', op: 'create' }), delta(6, '做好了'),
      ev(8, 'check.result', { runId: 'c', result: { status: 'pass', targetRunId: 'v', items: [] } }, { executionId: 'e1' }));
    // Text already in the snapshot is not appended again; execution commands are queued as restores, an old draft is not.
    expect(s1.messages.find(m => m.id === 'm1')!.text).toBe('做好了');
    expect(s1.canvasOps.map(op => [op.seq, op.restore])).toEqual([[3, true], [8, true]]);
    const s2 = fold(dialogueReducer(s1, { type: 'canvas.ack', seq: 8 }), delta(9, '。', 'z', 'm9'));
    expect(canvasRestoring(s2)).toBe(false);
    expect(persistableCanvasCursor(s2)).toBe(9);
    // After the snapshot, commands are live again.
    expect(fold(s2, ev(10, 'node.upsert', { nodeId: 'n2', op: 'create' })).canvasOps.map(op => [op.seq, op.restore])).toEqual([[10, undefined]]);
  });
  test('a pruned history (410) rebuilds from the snapshot and ends the restore replay', () => {
    const s0 = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state({ latestSeq: 40 }), mode: 'replace', restoreCanvas: true });
    const s1 = dialogueReducer(s0, { type: 'snapshot', state: state({ latestSeq: 40 }), mode: 'replace' });
    expect(dialogueCursor(s1)).toBe(40);
    expect(canvasRestoring(s1)).toBe(false);
    expect(persistableCanvasCursor(s1)).toBe(40);
  });
  test('the canvas cursor follows events that carry no canvas command, so it is never stuck behind the thread', () => {
    const s0 = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state(), mode: 'replace', canvasAckSeq: 5 });
    const s1 = fold(s0, delta(6, '好的'), ev(7, 'turn.done', { reason: 'completed', messageId: 'm1' }));
    expect(s1.canvasAckSeq).toBe(7);
    expect(dialogueCursor(s1)).toBe(7);
    // While a command waits to be projected, the projected cursor does not pass it.
    const s2 = fold(s1, ev(8, 'node.upsert', { nodeId: 'n1', op: 'create' }), delta(9, '还有', 'a', 'm2'));
    expect(s2.canvasAckSeq).toBe(7);
    expect(dialogueReducer(s2, { type: 'canvas.ack', seq: 8 }).canvasAckSeq).toBe(9);
  });
  test('commands projected but not saved keep the persisted cursor below them until the save lands', () => {
    const s0 = dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state(), mode: 'replace', canvasAckSeq: 5 });
    const s1 = dialogueReducer(fold(s0, ev(6, 'node.upsert', { nodeId: 'n1', op: 'create' }), ev(7, 'node.upsert', { nodeId: 'n2', op: 'create' })), { type: 'canvas.ack', seq: 7 });
    expect(persistableCanvasCursor(s1)).toBe(7);
    const unsaved = dialogueReducer(s1, { type: 'canvas.unsaved', fromSeq: 6 });
    expect(unsaved.canvasAckSeq).toBe(7);
    expect(persistableCanvasCursor(unsaved)).toBe(5);
    expect(persistableCanvasCursor(dialogueReducer(unsaved, { type: 'canvas.unsaved', fromSeq: undefined }))).toBe(7);
    // Nothing below the first unsaved command: cursor 0, so the next open replays everything as live commands. "No
    // cursor" would mean a first open on this browser, whose restore replay skips the assistant's own nodes (R2).
    expect(persistableCanvasCursor(dialogueReducer(unsaved, { type: 'canvas.unsaved', fromSeq: 1 }))).toBe(0);
    // Before anything was acknowledged there is still nothing worth saving.
    expect(persistableCanvasCursor(dialogueReducer(emptyDialogueStore(), { type: 'snapshot', state: state({ latestSeq: 0, messages: [] }), mode: 'replace' }))).toBeUndefined();
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
    // 「已收到」 only until the reply starts: once it has, the bubble is just the message (canvas redesign).
    expect(messageQueueLabel(s, s.messages.find(m => m.id === 'u3')!)).toBeUndefined();
  });
  test('an accepted message says 「已收到」 while no reply has started yet', () => {
    let s = dialogueReducer(loaded(), { type: 'outbox.add', item: { clientMessageId: 'c4', text: '加字幕', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: '2026-10-18T01:01:00Z', state: 'sending' } });
    s = dialogueReducer(s, { type: 'outbox.sent', clientMessageId: 'c4', result: { messageId: 'u4', turnId: 't2', queueState: 'accepted' } });
    const sent = s.messages.find(m => m.id === 'u4') ?? { ...userMessage, id: 'u4', seq: s.latestSeq + 1 };
    expect(messageQueueLabel(s, sent)).toBe('已收到');
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

// ── Server follow-ups after the acceptance fixes (D06 / D07 / D01 / D10 events) ──
describe('execution messages, dialogue budget share and queued steering', () => {
  const card = (id: string, status: DialogueApprovalBlock['status'], extra: Partial<DialogueApprovalBlock> = {}): DialogueApprovalBlock =>
    ({ type: 'approval', approvalId: id, stage: 'production', planFingerprint: 'f2', scope: ['第 1 段'], quotedCost: 80, budgetCap: 120, autoFixCap: 0, status, ...extra });
  const withCard = (block: DialogueApprovalBlock) => loaded({ latestSeq: 6, messages: [userMessage, { ...userMessage, id: 'm-card', role: 'assistant', seq: 6, turnId: 't-old', text: '请确认', blocks: [block], clientMessageId: undefined }] });

  test('a confirmation outside a running turn closes its own synthetic turn: nothing is left looking like a reply in progress', () => {
    const s = fold(withCard(card('a1', 'pending')),
      ev(7, 'approval.required', { messageId: 'm-card', block: card('a1', 'approved', { executionId: 'e1', approvedBudgetCap: 100, approvedAutoFixCap: 0 }) }, { turnId: 'APR-1', executionId: 'e1' }),
      ev(8, 'turn.done', { reason: 'completed', messageId: 'm-card', settling: false }, { turnId: 'APR-1', executionId: 'e1' }));
    expect(s.activeTurnId).toBeUndefined();
    expect(s.messages.map(m => [m.id, m.status])).toEqual([['u1', 'done'], ['m-card', 'done']]);
    expect(s.messages[1].blocks[0]).toMatchObject({ status: 'approved', approvedBudgetCap: 100 });
  });

  test('a raise-the-cap card posted by the executor: replaces the old card, arrives as a finished message with its follow-ups', () => {
    const s = fold(withCard(card('a1', 'pending')),
      ev(7, 'approval.required', { messageId: 'm-card', block: card('a1', 'superseded', { supersededAt: '2026-10-18T01:02:00Z' }) }, { turnId: 'EXS-1', executionId: 'e1' }),
      ev(8, 'message.delta', { messageId: 'm-raise', partId: 'p1', delta: '本阶段预算还差 30 积分。' }, { turnId: 'EXS-1', executionId: 'e1' }),
      ev(9, 'approval.required', { messageId: 'm-raise', block: card('a2', 'pending', { budgetCap: 150, shortfall: 30, dialogueReserve: 20 }), shortfall: 30 }, { turnId: 'EXS-1', executionId: 'e1' }),
      ev(10, 'turn.done', { reason: 'completed', messageId: 'm-raise', settling: false, suggestions: ['提高到 150 积分', '先停下'] }, { turnId: 'EXS-1', executionId: 'e1' }));
    expect(s.activeTurnId).toBeUndefined();
    const raise = s.messages.find(m => m.id === 'm-raise')!;
    expect(raise).toMatchObject({ status: 'done', text: '本阶段预算还差 30 积分。' });
    expect(s.messages.flatMap(m => m.blocks).map(b => b.type === 'approval' && [b.approvalId, b.status])).toEqual([['a1', 'superseded'], ['a2', 'pending']]);
    expect(s.shortfalls.a2).toBe(30);
    expect(messageSuggestions(s, raise)).toEqual(['提高到 150 积分', '先停下']);
  });

  test('follow-ups saved on the message and those from turn.done show once, at most three', () => {
    const summary = { ...userMessage, id: 'm-sum', role: 'assistant' as const, seq: 6, text: '做完了', clientMessageId: undefined, suggestions: ['改成横屏', '保存成模板'] };
    const reloaded = loaded({ latestSeq: 6, messages: [userMessage, summary] });
    expect(messageSuggestions(reloaded, reloaded.messages[1])).toEqual(['改成横屏', '保存成模板']);
    const live = fold(reloaded, ev(7, 'turn.done', { reason: 'completed', messageId: 'm-sum', suggestions: ['保存成模板', '只改第 3 段', '改成横屏'] }));
    expect(messageSuggestions(live, live.messages.find(m => m.id === 'm-sum')!)).toEqual(['保存成模板', '只改第 3 段', '改成横屏']);
    expect(messageSuggestions(live, userMessage)).toBeUndefined();
  });

  test('the dialogue share of a stage budget is kept as a breakdown, never added to spent again', () => {
    const execution = { id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production' as const, planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'running' as const, steps: [],
      budgets: [{ stage: 'production' as const, approvedCap: 120, autoFixCap: 40, spent: 40, inFlight: 0, remaining: 80, dialogueSpent: 1 }], startedAt: thread.createdAt, deadlineAt: thread.createdAt, updatedAt: thread.createdAt };
    const s = fold(loaded({ execution }), ev(6, 'budget.update', { executionId: 'e1', stage: 'production', approvedCap: 120, spent: 43, inFlight: 20, remaining: 57, source: 'actual', dialogueSpent: 3, dialogueInFlight: 20 }, { executionId: 'e1' }));
    expect(executionBudget(s)).toMatchObject({ spent: 43, inFlight: 20, dialogueSpent: 3, dialogueInFlight: 20, autoFixCap: 40 });
    expect(s.execution!.budgets[0]).toMatchObject({ spent: 43, inFlight: 20, dialogueSpent: 3, dialogueInFlight: 20, autoFixCap: 40 });
  });

  test('a message queued while an execution runs may come back without a turn: it waits as queued, nothing becomes active', () => {
    let s = dialogueReducer(loaded(), { type: 'outbox.add', item: { clientMessageId: 'c5', text: '第 2 段换成横屏', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: '2026-10-18T01:01:00Z', state: 'sending' } });
    s = dialogueReducer(s, { type: 'outbox.sent', clientMessageId: 'c5', result: { messageId: 'u5', queueState: 'queued' } });
    const queued = s.messages.find(m => m.id === 'u5')!;
    expect(queued).toMatchObject({ status: 'queued', turnId: undefined });
    expect(s.activeTurnId).toBeUndefined();
    expect(messageQueueLabel(s, queued)).toBe('排队中，下一步应用');
  });
});

// User feedback 2026-10-20: nothing showed whether the assistant was thinking or doing something.
describe('dialogueActivity', () => {
  const accepted = () => dialogueReducer(loaded(), { type: 'outbox.sent', clientMessageId: 'c9', result: { messageId: 'u9', turnId: 't1', queueState: 'accepted' } });
  test('waiting until something comes back, then the running tool, then continuing, then writing', () => {
    expect(dialogueActivity(loaded())).toBeUndefined();
    let s = accepted();
    expect(dialogueActivity(s)).toEqual({ phase: 'waiting' });
    s = fold(s, ev(6, 'tool.started', { toolCallId: 'x', toolName: 'read_canvas', title: '查看画布' }));
    expect(dialogueActivity(s)).toMatchObject({ phase: 'tool', tool: { toolCallId: 'x', title: '查看画布' } });
    s = fold(s, ev(7, 'tool.finished', { toolCallId: 'x', toolName: 'read_canvas', status: 'done', creditsActual: 0 }));
    expect(dialogueActivity(s)).toMatchObject({ phase: 'continuing' });
    s = fold(s, delta(8, '画布是空的'));
    expect(dialogueActivity(s)).toEqual({ phase: 'writing', messageId: 'm1' });
  });
  test.each(['completed', 'failed', 'interrupted'] as const)('a turn that ends (%s) ends it', reason => {
    const s = fold(accepted(), delta(6, '我先看'), ev(7, 'turn.done', { reason, messageId: 'm1' }));
    expect(dialogueActivity(s)).toBeUndefined();
  });
  test('a card at the end of the turn is the state itself', () => {
    const s = fold(accepted(), delta(6, '有个问题'), ev(7, 'plan.proposed', { messageId: 'm1', block: { type: 'plan', planRunId: 'p1', revision: 1, fingerprint: 'f', plan: { summary: 's', questions: [], steps: [] } } }));
    expect(dialogueActivity(s)).toBeUndefined();
  });
  // Codex review 2026-10-20.
  test('a background production summary ending does not hide the reply the user is waiting for', () => {
    let s = fold(accepted(), delta(6, '我先看'));
    s = fold(s, ev(7, 'message.delta', { messageId: 'sum', partId: 'a', delta: '两段做好了' }, { turnId: 'EXS-1' }),
      ev(8, 'turn.done', { reason: 'completed', messageId: 'sum' }, { turnId: 'EXS-1' }));
    expect(s.activeTurnId).toBeUndefined();
    expect(dialogueActivity(s)).toEqual({ phase: 'writing', messageId: 'm1' });
  });
  test('a reply only seen in a snapshot as 「streaming」 does not spin unless its turn is the active one', () => {
    const stuck: StudioDialogueMessage = { id: 'm0', threadId: 'th', seq: 6, turnId: 't0', role: 'assistant', text: '写到一半', blocks: [], status: 'streaming', createdAt: thread.createdAt };
    expect(dialogueActivity(loaded({ messages: [userMessage, stuck], latestSeq: 6 }))).toBeUndefined();
    expect(dialogueActivity(loaded({ thread: { ...thread, activeTurnId: 't0' }, messages: [userMessage, stuck], latestSeq: 6 }))).toEqual({ phase: 'writing', messageId: 'm0' });
  });
  test('steering sent while the turn ran, or an old unconfirmed message, does not answer a question asked later', () => {
    const question: StudioDialogueMessage = { id: 'm1', threadId: 'th', seq: 6, turnId: 't1', role: 'assistant', text: '哪一款？', status: 'done', createdAt: thread.createdAt,
      blocks: [{ type: 'question', questionId: 'q', text: '哪一款？', options: ['洗衣液'] }] as StudioMessageBlock[] };
    const steering: StudioDialogueMessage = { ...userMessage, id: 'u2', seq: 7, text: '改成竖屏', status: 'applied' };
    expect(answeredAfter(loaded({ messages: [userMessage, question, steering], latestSeq: 9 }), question)).toBeUndefined();
    const failed = dialogueReducer(loaded({ messages: [userMessage, question], latestSeq: 40 }),
      { type: 'outbox.add', item: { clientMessageId: 'c0', text: '早先没送达的', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: thread.createdAt, state: 'failed', afterSeq: 30 } });
    expect(answeredAfter(failed, question)).toBeUndefined();
  });
  test('a question is answered by any later user message, or one still on its way', () => {
    const question: StudioDialogueMessage = { id: 'm1', threadId: 'th', seq: 6, turnId: 't1', role: 'assistant', text: '哪一款？', status: 'done', createdAt: thread.createdAt,
      blocks: [{ type: 'question', questionId: 'q', text: '哪一款？', options: ['洗衣液'] }] as StudioMessageBlock[] };
    const s = loaded({ messages: [userMessage, question], latestSeq: 6 });
    expect(answeredAfter(s, question)).toBeUndefined();
    const sending = dialogueReducer(s, { type: 'outbox.add', item: { clientMessageId: 'c2', text: '洗衣液', pinnedNodeIds: [], attachmentNodeIds: [], createdAt: thread.createdAt, state: 'sending' } });
    expect(answeredAfter(sending, question)).toMatchObject({ text: '洗衣液' });
    expect(answeredAfter(dialogueReducer(sending, { type: 'outbox.remove', clientMessageId: 'c2' }), question)).toBeUndefined();
  });
});
