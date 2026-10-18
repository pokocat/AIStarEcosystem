'use client';
// One continuous dialogue per canvas: loads the thread, keeps the event stream open while the
// panel is open or work is in flight, and exposes the user's actions (send, stop, branch,
// approve, execution controls). Every action carries its own idempotency key; nothing here
// derives status or cost — those come from the server's events, snapshots and executions.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import type { StudioDialogueMessage, StudioPlanExecution, StudioPlanExecutionCreateRequest } from '@ai-star-eco/types/ip-studio-workflow';
import {
  dialogueCursor, dialogueReducer, emptyDialogueStore, executionActive, isPlaceholderMessage, planForApproval, type DialogueApprovalBlock,
} from '@/canvas-bridge/studio-dialogue-store';
import {
  branchStudioDialogue, controlStudioDialogue, getStudioConversation, listStudioDialogueMessages, postStudioDialogueMessage, subscribeStudioDialogue,
  type DialogueStreamMode,
} from '@/canvas-bridge/studio-dialogue';
import {
  acceptStudioPlanExecutionStep, cancelStudioPlanExecution, createStudioPlanExecution, getStudioPlanExecution, pauseStudioPlanExecution, resumeStudioPlanExecution,
} from '@/canvas-bridge/studio-plan-execution';

const cursorKey = (threadId: string) => `studio-dialogue-canvas-seq:${threadId}`;
/** Per-viewer convenience: how far this browser has projected canvas commands. Absent → start from the snapshot. */
function readCanvasCursor(threadId: string) {
  try { const raw = localStorage.getItem(cursorKey(threadId)); const value = raw === null ? NaN : Number(raw); return Number.isFinite(value) ? value : undefined; }
  catch { return undefined; }
}
function writeCanvasCursor(threadId: string, seq: number) {
  try { localStorage.setItem(cursorKey(threadId), String(seq)); } catch { /* the snapshot cursor is the fallback */ }
}

/** Statuses that prove the message was not accepted; anything else may have reached the server. */
const DEFINITE_REJECTION = new Set([400, 402, 403, 404, 409, 413, 422, 503]);
export type DialogueSendOutcome = { state: 'sent' } | { state: 'rejected' | 'unknown'; error: unknown };
export type DialogueSendInput = { text: string; pinnedNodeIds: string[]; attachmentNodeIds: string[]; maxCost?: number };

export function useStudioDialogueSession({ projectId, open }: { projectId: string; open: boolean }) {
  const [store, dispatch] = useReducer(dialogueReducer, undefined, emptyDialogueStore);
  const ref = useRef(store); ref.current = store;
  const project = useRef(projectId); project.current = projectId;
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState<unknown>();
  const [stream, setStream] = useState<DialogueStreamMode>('stopped');
  const loaded = useRef<string | undefined>(undefined);
  const approvalKeys = useRef(new Map<string, string>());

  useEffect(() => { dispatch({ type: 'reset' }); loaded.current = undefined; setStatus('idle'); setLoadError(undefined); }, [projectId]);
  const load = useCallback(async () => {
    const id = projectId;
    loaded.current = id; setStatus('loading'); setLoadError(undefined);
    try {
      const state = await getStudioConversation(id);
      if (project.current !== id) return;
      dispatch({ type: 'snapshot', state, mode: 'replace', canvasAckSeq: readCanvasCursor(state.thread.id) });
      setStatus('ready');
    } catch (error) {
      if (project.current !== id) return;
      loaded.current = undefined; setLoadError(error); setStatus('error');
    }
  }, [projectId]);
  useEffect(() => { if (open && loaded.current !== projectId) void load(); }, [open, projectId, load]);

  const threadId = store.thread?.id;
  useEffect(() => { if (threadId && store.canvasAckSeq) writeCanvasCursor(threadId, store.canvasAckSeq); }, [threadId, store.canvasAckSeq]);

  const working = !!store.activeTurnId || executionActive(store.execution) || store.outbox.some(o => o.state === 'sending');
  const live = status === 'ready' && !!threadId && (open || working);
  useEffect(() => {
    if (!live || !threadId) return;
    const stop = subscribeStudioDialogue({ projectId, threadId, cursor: () => dialogueCursor(ref.current),
      onEvent: event => dispatch({ type: 'event', event }),
      onSnapshot: (state, reason) => dispatch({ type: 'snapshot', state, mode: reason === 'expired' ? 'replace' : 'merge' }),
      onMode: setStream });
    return () => { stop(); setStream('stopped'); };
  }, [live, projectId, threadId]);

  const refresh = useCallback(async () => {
    const id = projectId;
    try { const state = await getStudioConversation(id); if (project.current === id) dispatch({ type: 'snapshot', state, mode: 'merge' }); }
    catch { /* the stream remains the source of updates */ }
  }, [projectId]);
  // A finished turn may have settled queued messages and structured blocks; read them once.
  const doneCount = store.doneTurns.length;
  useEffect(() => {
    if (status !== 'ready' || !doneCount) return;
    const timer = setTimeout(() => void refresh(), 400);
    return () => clearTimeout(timer);
  }, [doneCount, status, refresh]);

  const refreshExecution = useCallback(async (executionId: string) => {
    const id = projectId;
    try { const execution = await getStudioPlanExecution(id, executionId); if (project.current === id) dispatch({ type: 'execution', execution }); }
    catch { /* keep the last known projection */ }
  }, [projectId]);
  const executionId = store.execution?.id || store.thread?.activeExecutionId;
  useEffect(() => {
    if (!executionId || !store.executionTouchedSeq) return;
    const timer = setTimeout(() => void refreshExecution(executionId), 800);
    return () => clearTimeout(timer);
  }, [executionId, store.executionTouchedSeq, refreshExecution]);
  useEffect(() => { if (status === 'ready' && store.thread?.activeExecutionId && !store.execution) void refreshExecution(store.thread.activeExecutionId); },
    [status, store.thread?.activeExecutionId, !!store.execution, refreshExecution]);
  const executionStatus = store.execution?.status;
  useEffect(() => {
    if (!open || !executionId || executionStatus !== 'running') return;
    const timer = setInterval(() => void refreshExecution(executionId), 10000);
    return () => clearInterval(timer);
  }, [open, executionId, executionStatus, refreshExecution]);

  const post = useCallback(async (clientMessageId: string, input: DialogueSendInput): Promise<DialogueSendOutcome> => {
    const s = ref.current;
    if (!s.thread) return { state: 'rejected', error: new Error('对话还没准备好，请稍后再发') };
    const revision = [...s.messages].reverse().flatMap(m => m.blocks).find(b => b.type === 'plan');
    try {
      const result = await postStudioDialogueMessage(projectId, s.thread.id, { clientMessageId, text: input.text,
        ...(input.pinnedNodeIds.length ? { pinnedNodeIds: input.pinnedNodeIds } : {}), ...(input.attachmentNodeIds.length ? { attachmentNodeIds: input.attachmentNodeIds } : {}),
        ...(revision?.type === 'plan' ? { expectedPlanRevision: revision.revision } : {}), ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}) });
      dispatch({ type: 'outbox.sent', clientMessageId, result, createdAt: new Date().toISOString() });
      return { state: 'sent' };
    } catch (error) {
      if (error instanceof ApiError && error.status && DEFINITE_REJECTION.has(error.status)) { dispatch({ type: 'outbox.remove', clientMessageId }); return { state: 'rejected', error }; }
      dispatch({ type: 'outbox.failed', clientMessageId, error: error instanceof Error ? error.message : '消息没有送达' });
      return { state: 'unknown', error };
    }
  }, [projectId]);
  const send = useCallback((input: DialogueSendInput) => {
    const clientMessageId = nanoid();
    dispatch({ type: 'outbox.add', item: { clientMessageId, ...input, createdAt: new Date().toISOString(), state: 'sending' } });
    return post(clientMessageId, input);
  }, [post]);
  /** Resends with the same clientMessageId, so a message that did arrive is never handled twice. */
  const retry = useCallback((clientMessageId: string) => {
    const item = ref.current.outbox.find(o => o.clientMessageId === clientMessageId);
    if (!item) return Promise.resolve<DialogueSendOutcome>({ state: 'sent' });
    dispatch({ type: 'outbox.retry', clientMessageId });
    return post(clientMessageId, item);
  }, [post]);

  const stop = useCallback(async () => {
    const s = ref.current;
    if (!s.thread) return;
    const state = await controlStudioDialogue(projectId, s.thread.id, { controlId: nanoid(), action: 'stop', ...(executionActive(s.execution) ? { executionId: s.execution!.id } : {}) });
    dispatch({ type: 'snapshot', state, mode: 'merge' });
  }, [projectId]);

  const branch = useCallback(async (fromMessageId: string) => {
    const s = ref.current;
    if (!s.thread) return;
    const state = await branchStudioDialogue(projectId, s.thread.id, { clientRequestId: nanoid(), fromMessageId });
    dispatch({ type: 'snapshot', state, mode: 'replace' });
  }, [projectId]);

  const approve = useCallback(async (block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string): Promise<StudioPlanExecution> => {
    const s = ref.current;
    const plan = planForApproval(s, block);
    if (!plan) throw new Error('找不到这次报价对应的方案，请刷新后重试');
    // Same card and same caps → same request key, so a retry after a lost response is idempotent.
    const key = `${block.approvalId}:${caps.budgetCap}:${caps.autoFixCap}`;
    const clientRequestId = approvalKeys.current.get(key) || nanoid();
    approvalKeys.current.set(key, clientRequestId);
    const request: StudioPlanExecutionCreateRequest = { clientRequestId, stage: block.stage, planRunId: plan.planRunId, planFingerprint: block.planFingerprint,
      budgetCap: caps.budgetCap, autoFixCap: caps.autoFixCap, approvalId: block.approvalId, confirmationMessageId: messageId,
      ...(block.billingSelection ? { billing: block.billingSelection } : {}),
      ...(block.stage === 'production' ? { executionId: block.executionId || s.execution?.id, approachId: plan.plan.confirmedApproachId || plan.plan.recommendedApproachId, expectedRevision: plan.revision } : {}) };
    const execution = await createStudioPlanExecution(projectId, request);
    dispatch({ type: 'execution', execution });
    dispatch({ type: 'approval.local', approvalId: block.approvalId, status: 'approved', executionId: execution.id });
    return execution;
  }, [projectId]);

  const controlExecution = useCallback(async (action: 'pause' | 'resume' | 'cancel') => {
    const execution = ref.current.execution;
    if (!execution) return;
    const request = { clientRequestId: nanoid(), expectedStatus: execution.status };
    const next = action === 'pause' ? await pauseStudioPlanExecution(projectId, execution.id, request)
      : action === 'resume' ? await resumeStudioPlanExecution(projectId, execution.id, request) : await cancelStudioPlanExecution(projectId, execution.id, request);
    dispatch({ type: 'execution', execution: next });
  }, [projectId]);

  const ensureExecution = useCallback(async (id: string) => {
    if (ref.current.execution?.id === id) return ref.current.execution;
    const execution = await getStudioPlanExecution(projectId, id);
    dispatch({ type: 'execution', execution });
    return execution;
  }, [projectId]);
  const acceptStep = useCallback(async (executionId: string, stepId: string, runId: string) => {
    const next = await acceptStudioPlanExecutionStep(projectId, executionId, stepId, { clientRequestId: nanoid(), runId });
    dispatch({ type: 'execution', execution: next });
  }, [projectId]);

  const loadOlder = useCallback(async () => {
    const s = ref.current;
    const first = s.messages.find(m => !m.legacyNodeId && !isPlaceholderMessage(m.id));
    if (!s.thread || !first) return;
    const messages = await listStudioDialogueMessages(projectId, s.thread.id, { beforeSeq: Math.floor(first.seq), limit: 50 });
    dispatch({ type: 'older', messages, limit: 50 });
  }, [projectId]);
  const readThread = useCallback((id: string): Promise<StudioDialogueMessage[]> => listStudioDialogueMessages(projectId, id, { limit: 200 }), [projectId]);

  return { store, dispatch, status, loadError, reload: load, stream, send, retry, stop, branch, approve, controlExecution, ensureExecution, acceptStep, loadOlder, readThread };
}
export type StudioDialogueSession = ReturnType<typeof useStudioDialogueSession>;
