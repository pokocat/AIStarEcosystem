// @vitest-environment jsdom
// The conversation session across 「新对话」/「历史对话」 switches (docs/ip-studio-new-canvas-and-threads.md §3, Codex review
// 2026-10-20): a confirmation on its way and a switch on its way exclude each other, and every answer that belongs to the
// conversation that was left (an older page, an execution read, a stream snapshot) is dropped instead of landing in the
// one now shown. Catch-up reads use the read-only snapshot by id; only the user's own pick opens a conversation.
// Fixtures follow the server DTOs (AGENTS.md §8.0.1 ⑦).
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StudioDialogueMessage, StudioDialogueState, StudioMessageBlock, StudioPlanExecution } from '@ai-star-eco/types/ip-studio-workflow';
import { ApiError } from '@ai-star-eco/api-client';
import type { DialogueStreamOptions } from '@/canvas-bridge/studio-dialogue';
import type { DialogueApprovalBlock } from '@/canvas-bridge/studio-dialogue-store';
import { DIALOGUE_SWITCHING, DIALOGUE_THREAD_BUSY, dialogueThreadBusy, dialogueVerifyTiming, useStudioDialogueSession } from './studio-dialogue-session';

const api = vi.hoisted(() => ({
  getConversation: vi.fn(), getThread: vi.fn(), openThread: vi.fn(), createThread: vi.fn(), threads: vi.fn(), list: vi.fn(), post: vi.fn(), control: vi.fn(),
  branch: vi.fn(), subscribe: vi.fn(), getExecution: vi.fn(), createExecution: vi.fn(), accept: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
}));
vi.mock('@/canvas-bridge/studio-dialogue', () => ({ getStudioConversation: api.getConversation, getStudioDialogueThread: api.getThread, openStudioDialogueThread: api.openThread,
  createStudioDialogueThread: api.createThread, listStudioDialogueThreads: api.threads, listStudioDialogueMessages: api.list, postStudioDialogueMessage: api.post,
  controlStudioDialogue: api.control, branchStudioDialogue: api.branch, subscribeStudioDialogue: api.subscribe }));
vi.mock('@/canvas-bridge/studio-plan-execution', () => ({ getStudioPlanExecution: api.getExecution, createStudioPlanExecution: api.createExecution,
  acceptStudioPlanExecutionStep: api.accept, pauseStudioPlanExecution: api.pause, resumeStudioPlanExecution: api.resume, cancelStudioPlanExecution: api.cancel }));

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const at = '2026-10-20T02:00:00Z';
const thread = (id: string, extra: Partial<StudioDialogueState['thread']> = {}): StudioDialogueState['thread'] => ({ id, projectId: 'p', lastSeq: 2, createdAt: at, updatedAt: at, ...extra });
const message = (threadId: string, id: string, seq: number, role: 'user' | 'assistant', text: string, blocks: StudioMessageBlock[] = []): StudioDialogueMessage =>
  ({ id, threadId, seq, role, text, blocks, status: 'done', createdAt: at, ...(role === 'assistant' ? { turnId: `turn-${id}` } : {}) });
const plan: StudioMessageBlock = { type: 'plan', planRunId: 'plan-1', revision: 1, fingerprint: 'f1', plan: { summary: '出一张海报', steps: [], questions: [] } } as unknown as StudioMessageBlock;
const approval: DialogueApprovalBlock = { type: 'approval', approvalId: 'ap1', stage: 'production', planFingerprint: 'f1', scope: ['海报'], quotedCost: 8, budgetCap: 12, autoFixCap: 0, status: 'pending' };
const caps = { budgetCap: 12, autoFixCap: 0 };
const execution = (id: string, threadId: string, status: StudioPlanExecution['status'] = 'running'): StudioPlanExecution => ({ id, projectId: 'p', threadId, skillKey: 'image-generation', skillVersion: 1,
  stage: 'production', planRunId: 'plan-1', planRevision: 1, planFingerprint: 'f1', status, steps: [],
  budgets: [{ stage: 'production', approvedCap: 12, autoFixCap: 0, spent: 0, inFlight: 0, remaining: 12 }], startedAt: at, deadlineAt: at, updatedAt: at });

/** A: the poster conversation with a pending card. B: another conversation of the same canvas. */
const stateA: StudioDialogueState = { thread: thread('A'), latestSeq: 2, nextCursor: '1',
  messages: [message('A', 'u1', 1, 'user', '画一张洗衣液海报'), message('A', 'a1', 2, 'assistant', '方案在这里。', [plan, approval])] };
const stateB: StudioDialogueState = { thread: thread('B', { lastSeq: 1 }), latestSeq: 1, messages: [message('B', 'b1', 1, 'user', '写一段口播')] };
const olderOfA = [message('A', 'old-a', 0, 'user', '更早的一句')];

let streams: DialogueStreamOptions[] = [];
const timing = { ...dialogueVerifyTiming };
beforeEach(() => {
  Object.assign(dialogueVerifyTiming, timing);
  for (const fn of Object.values(api)) fn.mockReset();
  streams = [];
  api.subscribe.mockImplementation((options: DialogueStreamOptions) => { streams.push(options); return () => {}; });
  api.getConversation.mockResolvedValue(stateA);
  localStorage.clear();
});
afterEach(() => cleanup());

async function ready() {
  const hook = renderHook(() => useStudioDialogueSession({ projectId: 'p', open: true }));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  return hook;
}

test('a confirmation on its way (saving the canvas included) blocks 「新对话」 and opening another conversation until it returns', async () => {
  const { result } = await ready();
  const save = deferred<void>(), created = deferred<StudioPlanExecution>();
  api.createExecution.mockReturnValue(created.promise);
  let approving!: Promise<unknown>;
  act(() => { approving = result.current.approve(approval, caps, 'a1', () => save.promise); });
  // The guard starts with the save: the execution reads canvas references from the saved document.
  expect(result.current.confirming).toBe(true);
  await expect(result.current.newThread()).rejects.toThrow(DIALOGUE_THREAD_BUSY);
  await expect(result.current.openThread('B')).rejects.toThrow(DIALOGUE_THREAD_BUSY);

  await act(async () => { save.resolve(); });
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledTimes(1));
  expect(result.current.confirming).toBe(true);
  await expect(result.current.openThread('B')).rejects.toThrow(DIALOGUE_THREAD_BUSY);
  expect(api.createThread).not.toHaveBeenCalled();
  expect(api.openThread).not.toHaveBeenCalled();

  await act(async () => { created.resolve(execution('E1', 'A')); await approving; });
  expect(result.current.confirming).toBe(false);
  expect(result.current.store.thread?.id).toBe('A');
  expect(result.current.store.execution?.id).toBe('E1');
  expect(dialogueThreadBusy(result.current.store)).toBe(true);
});

test('a confirmation that was refused releases the guard', async () => {
  const { result } = await ready();
  api.createExecution.mockRejectedValue(new ApiError({ code: 'STUDIO_PLAN_STALE', message: '方案已更新' }, 409));
  await act(async () => { await expect(result.current.approve(approval, caps, 'a1', async () => {})).rejects.toMatchObject({ code: 'STUDIO_PLAN_STALE' }); });
  expect(result.current.confirming).toBe(false);
  expect(api.getThread).not.toHaveBeenCalled();
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { expect(await result.current.openThread('B')).toBe(true); });
  expect(result.current.store.thread?.id).toBe('B');
});

/**
 * A stand-in for the server's create: idempotent by clientRequestId (StudioPlanExecutionService#create finds the prior row
 * by it), so a resend of a request it took answers with that execution and one it never saw is taken now. `network` decides,
 * per call, whether the request was lost on the way there, the answer was lost on the way back, or both arrive.
 */
function idempotentServer(network: ('lost-request' | 'lost-answer' | 'ok')[]) {
  const taken = new Map<string, StudioPlanExecution>();
  api.createExecution.mockImplementation(async (_project: string, request: { clientRequestId: string }) => {
    const fate = network.shift() ?? 'ok';
    if (fate === 'lost-request') throw new TypeError('Failed to fetch');
    if (!taken.has(request.clientRequestId)) taken.set(request.clientRequestId, execution(`E${taken.size + 1}`, 'A'));
    if (fate === 'lost-answer') throw new TypeError('Failed to fetch');
    return taken.get(request.clientRequestId)!;
  });
  return taken;
}

// Codex review 2026-10-20 (P1): the server took the confirmation, its answer was lost and the catch-up read failed too; the
// guard let go, the user switched, and the paid execution's nodes went to a conversation no longer shown.
test('a confirmation the server took, whose answer and the next resend were lost, holds the conversation until the answer is known', async () => {
  // Long waits, driven by 「现在再查一次」, so each in-between state can be looked at.
  dialogueVerifyTiming.firstMs = 60_000; dialogueVerifyTiming.maxMs = 60_000;
  const { result } = await ready();
  const taken = idempotentServer(['lost-answer', 'lost-request']);
  let approving!: Promise<unknown>;
  act(() => { approving = result.current.approve(approval, caps, 'a1', async () => {}); });
  await waitFor(() => expect(result.current.verifying).toBe('ap1'));
  expect(taken.size).toBe(1);
  expect(result.current.store.execution).toBeUndefined();
  expect(result.current.confirming).toBe(true);
  await expect(result.current.newThread()).rejects.toThrow(DIALOGUE_THREAD_BUSY);
  await expect(result.current.openThread('B')).rejects.toThrow(DIALOGUE_THREAD_BUSY);
  // The first resend is lost as well: still unknown, still held.
  act(() => result.current.recheck());
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledTimes(2));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.verifying).toBe('ap1');
  await expect(result.current.openThread('B')).rejects.toThrow(DIALOGUE_THREAD_BUSY);
  expect(api.openThread).not.toHaveBeenCalled();
  // The network comes back: the resend gets the execution that was taken the first time.
  act(() => result.current.recheck());
  await act(async () => { expect(await approving).toMatchObject({ id: 'E1' }); });
  expect(api.createExecution).toHaveBeenCalledTimes(3);
  expect(new Set(api.createExecution.mock.calls.map(([, request]) => request.clientRequestId)).size).toBe(1);
  expect(taken.size).toBe(1);
  expect(api.getThread).not.toHaveBeenCalled();
  expect(result.current.verifying).toBeUndefined();
  expect(result.current.confirming).toBe(false);
  expect(result.current.store.execution?.id).toBe('E1');
  expect(result.current.store.messages[1].blocks.find(b => b.type === 'approval')).toMatchObject({ status: 'approved', executionId: 'E1' });
  // Now it is the execution that keeps the conversation (its nodes arrive on this stream).
  expect(dialogueThreadBusy(result.current.store)).toBe(true);
});

test('a confirmation that never reached the server is taken by the resend, once; 「现在再查一次」 skips the wait', async () => {
  dialogueVerifyTiming.firstMs = 60_000; dialogueVerifyTiming.maxMs = 60_000;
  const { result } = await ready();
  const taken = idempotentServer(['lost-request']);
  let approving!: Promise<unknown>;
  act(() => { approving = result.current.approve(approval, caps, 'a1', async () => {}); });
  await waitFor(() => expect(result.current.verifying).toBe('ap1'));
  expect(taken.size).toBe(0);
  expect(api.createExecution).toHaveBeenCalledTimes(1);
  act(() => result.current.recheck());
  await act(async () => { expect(await approving).toMatchObject({ id: 'E1' }); });
  expect(api.createExecution).toHaveBeenCalledTimes(2);
  expect(taken.size).toBe(1);
  expect(result.current.confirming).toBe(false);
  expect(result.current.store.execution?.id).toBe('E1');
});

test('a resend the server refuses lets go with that refusal for the card, and the conversation can be left', async () => {
  dialogueVerifyTiming.firstMs = 5; dialogueVerifyTiming.maxMs = 20;
  const { result } = await ready();
  api.createExecution.mockRejectedValueOnce(new ApiError({ code: 'BAD_GATEWAY', message: '网关超时' }, 504))
    .mockRejectedValueOnce(new ApiError({ code: 'STUDIO_APPROVAL_EXPIRED', message: '报价已过期' }, 409));
  await act(async () => { await expect(result.current.approve(approval, caps, 'a1', async () => {})).rejects.toMatchObject({ code: 'STUDIO_APPROVAL_EXPIRED' }); });
  expect(api.createExecution).toHaveBeenCalledTimes(2);
  expect(result.current.verifying).toBeUndefined();
  expect(result.current.confirming).toBe(false);
  expect(result.current.store.execution).toBeUndefined();
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { expect(await result.current.openThread('B')).toBe(true); });
});

test('closing the panel stops the resends', async () => {
  dialogueVerifyTiming.firstMs = 60_000; dialogueVerifyTiming.maxMs = 60_000;
  const { result, unmount } = await ready();
  api.createExecution.mockRejectedValue(new TypeError('Failed to fetch'));
  let approving!: Promise<unknown>;
  act(() => { approving = result.current.approve(approval, caps, 'a1', async () => {}).catch(e => e); });
  await waitFor(() => expect(result.current.verifying).toBe('ap1'));
  unmount();
  expect(await approving).toBeInstanceOf(Error);
  expect(api.createExecution).toHaveBeenCalledTimes(1);
});

test('while a switch is on its way, a confirmation card cannot start anything', async () => {
  const { result } = await ready();
  const opening = deferred<StudioDialogueState>();
  api.openThread.mockReturnValue(opening.promise);
  let switching!: Promise<boolean>;
  act(() => { switching = result.current.openThread('B'); });
  const save = vi.fn(async () => {});
  await expect(result.current.approve(approval, caps, 'a1', save)).rejects.toThrow(DIALOGUE_SWITCHING);
  expect(save).not.toHaveBeenCalled();
  expect(api.createExecution).not.toHaveBeenCalled();
  await act(async () => { opening.resolve(stateB); await switching; });
  expect(result.current.store.thread?.id).toBe('B');
  expect(result.current.store.execution).toBeUndefined();
});

test('an older page of the conversation that was left never lands in the one now shown', async () => {
  const { result } = await ready();
  const older = deferred<StudioDialogueMessage[]>();
  api.list.mockReturnValue(older.promise);
  let loading!: Promise<void>;
  act(() => { loading = result.current.loadOlder(); });
  expect(api.list).toHaveBeenCalledWith('p', 'A', { beforeSeq: 1, limit: 50 });
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { await result.current.openThread('B'); });
  await act(async () => { older.resolve(olderOfA); await loading; });
  expect(result.current.store.thread?.id).toBe('B');
  expect(result.current.store.messages.map(m => m.id)).toEqual(['b1']);
});

test('A → B → A: a page asked for on the first visit of A is dropped on the second (switch generation, not only the id)', async () => {
  const { result } = await ready();
  const older = deferred<StudioDialogueMessage[]>();
  api.list.mockReturnValue(older.promise);
  let loading!: Promise<void>;
  act(() => { loading = result.current.loadOlder(); });
  api.openThread.mockResolvedValueOnce(stateB).mockResolvedValueOnce({ ...stateA, nextCursor: undefined });
  await act(async () => { await result.current.openThread('B'); });
  await act(async () => { await result.current.openThread('A'); });
  await act(async () => { older.resolve(olderOfA); await loading; });
  expect(result.current.store.thread?.id).toBe('A');
  expect(result.current.store.messages.map(m => m.id)).toEqual(['u1', 'a1']);
  expect(result.current.store.hasOlder).toBe(false);
});

test('an execution read for the conversation that was left (its approved card) is not attached to the new one', async () => {
  const approved = { ...approval, status: 'approved' as const, executionId: 'E0' };
  api.getConversation.mockResolvedValue({ ...stateA, messages: [stateA.messages[0], { ...stateA.messages[1], blocks: [plan, approved] }] });
  const linked = deferred<StudioPlanExecution>();
  api.getExecution.mockReturnValue(linked.promise);
  const { result } = await ready();
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledWith('p', 'E0'));
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { await result.current.openThread('B'); });
  await act(async () => { linked.resolve(execution('E0', 'A', 'done')); });
  expect(result.current.store.thread?.id).toBe('B');
  expect(result.current.store.execution).toBeUndefined();
  expect(result.current.executions).toEqual([]);
});

test('a late execution refresh of the conversation that was left does not lock the new one as 「进行中」', async () => {
  // The snapshot names the running execution without carrying it, so the session reads it; the user leaves first.
  api.getConversation.mockResolvedValue({ ...stateA, thread: thread('A', { activeExecutionId: 'E1' }) });
  const running = deferred<StudioPlanExecution>();
  api.getExecution.mockReturnValue(running.promise);
  const { result } = await ready();
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledWith('p', 'E1'));
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { await result.current.openThread('B'); });
  await act(async () => { running.resolve(execution('E1', 'A')); });
  expect(result.current.store.thread?.id).toBe('B');
  expect(result.current.store.execution).toBeUndefined();
  expect(dialogueThreadBusy(result.current.store)).toBe(false);
});

test('catch-up reads use the read-only snapshot of this conversation, never the call that makes it current', async () => {
  await ready();
  await waitFor(() => expect(streams).toHaveLength(1));
  // Another tab opened B meanwhile: GET /conversation would answer with B.
  api.getConversation.mockResolvedValue(stateB);
  api.getThread.mockResolvedValue(stateA);
  const snapshot = await streams[0].getSnapshot!();
  expect(snapshot.thread.id).toBe('A');
  expect(api.getThread).toHaveBeenCalledWith('p', 'A');
  expect(api.openThread).not.toHaveBeenCalled();
});

test('a stream snapshot of an earlier visit of the same conversation is dropped', async () => {
  const { result } = await ready();
  await waitFor(() => expect(streams).toHaveLength(1));
  const first = streams[0];
  api.openThread.mockResolvedValueOnce(stateB).mockResolvedValueOnce(stateA);
  await act(async () => { await result.current.openThread('B'); });
  await act(async () => { await result.current.openThread('A'); });
  // A rebuild the first subscription had on its way: an older snapshot that would replace the timeline.
  act(() => first.onSnapshot({ ...stateA, latestSeq: 1, messages: [stateA.messages[0]] }, 'expired'));
  expect(result.current.store.messages.map(m => m.id)).toEqual(['u1', 'a1']);
});

test('the user picking a conversation is what opens it', async () => {
  const { result } = await ready();
  api.openThread.mockResolvedValue(stateB);
  await act(async () => { expect(await result.current.openThread('B')).toBe(true); });
  expect(api.openThread).toHaveBeenCalledWith('p', 'B');
  expect(api.getThread).not.toHaveBeenCalled();
  expect(result.current.store.thread?.id).toBe('B');
});
