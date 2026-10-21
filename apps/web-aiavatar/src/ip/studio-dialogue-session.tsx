'use client';
// The canvas's current conversation: loads it, keeps the event stream open while the panel is open
// or work is in flight, and exposes the user's actions (send, stop, branch, new conversation, open an
// earlier one, approve, execution controls). A canvas can hold several conversations; the server
// remembers which one was opened last (docs/ip-studio-new-canvas-and-threads.md §3). Every action
// carries its own idempotency key; nothing here derives status or cost — those come from the
// server's events, snapshots and executions.
//
// It also reads the executions this thread started (from their approval cards), so a canvas
// that was closed while one ran can rebuild that work's nodes on the next open.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import type { StudioDialogueMessage, StudioDialogueState, StudioDialogueThreadSummary, StudioPlanExecution, StudioPlanExecutionCreateRequest } from '@ai-star-eco/types/ip-studio-workflow';
import {
  approvedExecutionIds, canvasRestoring, dialogueCursor, dialogueReducer, emptyDialogueStore, executionActive, isPlaceholderMessage, persistableCanvasCursor, planForApproval,
  type DialogueApprovalBlock, type DialogueStore,
} from '@/canvas-bridge/studio-dialogue-store';
import {
  branchStudioDialogue, controlStudioDialogue, createStudioDialogueThread, getStudioConversation, listStudioDialogueMessages, listStudioDialogueThreads,
  openStudioDialogueThread, postStudioDialogueMessage, subscribeStudioDialogue, type DialogueStreamMode,
} from '@/canvas-bridge/studio-dialogue';
import {
  acceptStudioPlanExecutionStep, cancelStudioPlanExecution, createStudioPlanExecution, getStudioPlanExecution, pauseStudioPlanExecution, resumeStudioPlanExecution,
} from '@/canvas-bridge/studio-plan-execution';

const cursorKey = (threadId: string) => `studio-dialogue-canvas-seq:${threadId}`;
/**
 * Per-viewer convenience: how far this browser has projected canvas commands. Absent (first open here, cleared
 * storage) → replay the thread in restore mode; the executions themselves are the reliable fallback.
 */
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
export type DialogueSendInput = { text: string; pinnedNodeIds: string[]; attachmentNodeIds: string[]; maxCost?: number;
  /** Skill chosen in the settings; omitted = 「自动」 (the server routes by intent). */
  skillKey?: string;
  /** Text endpoint the user picked where the scene allows a choice; omitted = the scene default. Must match maxCost's model. */
  model?: string };

/** How many earlier executions of this thread are read back for restoring their canvas nodes. */
const LINKED_EXECUTIONS = 5;
/**
 * Why 「新对话」 and 「历史对话」 wait: the canvas gets its nodes from the current conversation's event stream, so leaving
 * while a reply or an execution is still going would drop nodes that have not arrived yet.
 */
export const DIALOGUE_THREAD_BUSY = '这段对话还在进行，等它做完或先停止';
/** A reply is streaming, an execution is running / paused / waiting, or a message is still on its way. */
export const dialogueThreadBusy = (store: DialogueStore) => !!store.activeTurnId || executionActive(store.execution) || store.outbox.some(o => o.state === 'sending');

/** `autoload`: read the thread even while the panel is closed (the canvas is missing work an execution produced). */
export function useStudioDialogueSession({ projectId, open, autoload = false }: { projectId: string; open: boolean; autoload?: boolean }) {
  const [store, dispatch] = useReducer(dialogueReducer, undefined, emptyDialogueStore);
  const ref = useRef(store); ref.current = store;
  const project = useRef(projectId); project.current = projectId;
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState<unknown>();
  const [stream, setStream] = useState<DialogueStreamMode>('stopped');
  const loaded = useRef<string | undefined>(undefined);
  const approvalKeys = useRef(new Map<string, string>());

  const [linked, setLinked] = useState<Record<string, StudioPlanExecution>>({});
  const linkedRef = useRef(linked); linkedRef.current = linked;
  const linkedRequested = useRef(new Set<string>());
  // 「新对话」 / 「历史对话」: only the newest switch may land; the create key survives a lost response so a retry is the same request.
  const switchSeq = useRef(0), createKey = useRef<string | undefined>(undefined);
  const [switching, setSwitching] = useState<'new' | 'open'>();
  useEffect(() => {
    dispatch({ type: 'reset' }); loaded.current = undefined; setStatus('idle'); setLoadError(undefined); setLinked({}); linkedRequested.current = new Set();
    switchSeq.current++; createKey.current = undefined; setSwitching(undefined);
  }, [projectId]);
  const load = useCallback(async () => {
    const id = projectId;
    loaded.current = id; setStatus('loading'); setLoadError(undefined);
    try {
      const state = await getStudioConversation(id);
      if (project.current !== id) return;
      const cursor = readCanvasCursor(state.thread.id);
      dispatch({ type: 'snapshot', state, mode: 'replace', canvasAckSeq: cursor, restoreCanvas: cursor === undefined });
      setStatus('ready');
    } catch (error) {
      if (project.current !== id) return;
      loaded.current = undefined; setLoadError(error); setStatus('error');
    }
  }, [projectId]);
  useEffect(() => { if ((open || autoload) && loaded.current !== projectId) void load(); }, [open, autoload, projectId, load]);

  const threadId = store.thread?.id;
  const savedCursor = persistableCanvasCursor(store);
  useEffect(() => { if (threadId && savedCursor !== undefined) writeCanvasCursor(threadId, savedCursor); }, [threadId, savedCursor]);

  const working = dialogueThreadBusy(store);
  // A history replay onto a canvas that had no record here runs to the end even with the panel closed.
  const live = status === 'ready' && !!threadId && (open || working || canvasRestoring(store));
  useEffect(() => {
    if (!live || !threadId) return;
    const stop = subscribeStudioDialogue({ projectId, threadId, cursor: () => dialogueCursor(ref.current),
      onEvent: event => dispatch({ type: 'event', event }),
      // A snapshot of this conversation. GET /conversation answers with the last opened one, which another tab may have
      // changed; then this one is read by its id (dropping a snapshot of another thread would 410 again at once).
      getSnapshot: async () => {
        const state = await getStudioConversation(projectId);
        return state.thread.id === threadId ? state : openStudioDialogueThread(projectId, threadId);
      },
      onSnapshot: (state, reason) => {
        // A poll that was already on its way when the panel moved to another conversation must not take the timeline back.
        if (state.thread.id !== ref.current.thread?.id) return;
        const action = { type: 'snapshot' as const, state, mode: reason === 'expired' ? 'replace' as const : 'merge' as const };
        // The stream reconnects right away with cursor(); fold now so it does not read the pre-snapshot cursor.
        ref.current = dialogueReducer(ref.current, action);
        dispatch(action);
      },
      onMode: setStream });
    return () => { stop(); setStream('stopped'); };
  }, [live, projectId, threadId]);

  const refresh = useCallback(async () => {
    const id = projectId;
    // Only for the conversation still shown: the last opened one may be another (a switch here, another tab).
    try { const state = await getStudioConversation(id); if (project.current === id && state.thread.id === ref.current.thread?.id) dispatch({ type: 'snapshot', state, mode: 'merge' }); }
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

  // A finished execution drops out of the snapshot; its approval card still names it. The newest becomes the
  // shown execution when nothing else is, and all of them can restore the nodes they produced.
  const linkedIds = approvedExecutionIds(store).slice(0, LINKED_EXECUTIONS).join(',');
  const hasExecution = !!store.execution;
  useEffect(() => {
    if (status !== 'ready' || !linkedIds) return;
    const id = projectId;
    const show = (execution: StudioPlanExecution, index: number) => { if (index === 0 && !ref.current.execution) dispatch({ type: 'execution', execution }); };
    linkedIds.split(',').forEach((executionId, index) => {
      if (ref.current.execution?.id === executionId) return;
      const known = linkedRef.current[executionId];
      if (known) { show(known, index); return; }
      if (linkedRequested.current.has(executionId)) return;
      linkedRequested.current.add(executionId);
      getStudioPlanExecution(id, executionId).then(execution => {
        if (project.current !== id) return;
        setLinked(current => ({ ...current, [execution.id]: execution }));
        show(execution, index);
      }).catch(() => { linkedRequested.current.delete(executionId); });
    });
  }, [status, linkedIds, projectId, hasExecution]);
  const executions = useMemo(() => {
    const list = Object.values(linked).filter(e => e.id !== store.execution?.id);
    return store.execution ? [...list, store.execution] : list;
  }, [linked, store.execution]);

  const post = useCallback(async (clientMessageId: string, input: DialogueSendInput): Promise<DialogueSendOutcome> => {
    const s = ref.current;
    if (!s.thread) return { state: 'rejected', error: new Error('对话还没准备好，请稍后再发') };
    const revision = [...s.messages].reverse().flatMap(m => m.blocks).find(b => b.type === 'plan');
    try {
      const result = await postStudioDialogueMessage(projectId, s.thread.id, { clientMessageId, text: input.text,
        ...(input.pinnedNodeIds.length ? { pinnedNodeIds: input.pinnedNodeIds } : {}), ...(input.attachmentNodeIds.length ? { attachmentNodeIds: input.attachmentNodeIds } : {}),
        ...(revision?.type === 'plan' ? { expectedPlanRevision: revision.revision } : {}), ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}),
        ...(input.skillKey ? { skillKey: input.skillKey } : {}), ...(input.model ? { model: input.model } : {}) });
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
    if (state.thread.id === ref.current.thread?.id) dispatch({ type: 'snapshot', state, mode: 'merge' });
  }, [projectId]);

  const branch = useCallback(async (fromMessageId: string) => {
    const s = ref.current;
    if (!s.thread) return;
    const state = await branchStudioDialogue(projectId, s.thread.id, { clientRequestId: nanoid(), fromMessageId });
    dispatch({ type: 'snapshot', state, mode: 'replace' });
  }, [projectId]);

  // ── Several conversations per canvas (docs/ip-studio-new-canvas-and-threads.md §3) ─────────
  // Switching works like 「从这里重新开始」 above: the returned snapshot replaces the timeline (another thread starts from a
  // clean store), and the stream follows the new thread id. Like the first open, the canvas cursor is read for that
  // thread (absent → its execution output is restored, never re-run). Executions read back for the previous thread
  // belong to it and are dropped. Nothing here calls a model or spends credits.
  const enter = useCallback((state: StudioDialogueState) => {
    const cursor = readCanvasCursor(state.thread.id);
    dispatch({ type: 'snapshot', state, mode: 'replace', canvasAckSeq: cursor, restoreCanvas: cursor === undefined });
    setLinked({}); linkedRequested.current = new Set();
    createKey.current = undefined;
    loaded.current = project.current; setStatus('ready'); setLoadError(undefined);
  }, []);
  /** Resolves true once the new conversation is shown, false when a later switch (or another canvas) took over. */
  const newThread = useCallback(async (): Promise<boolean> => {
    if (dialogueThreadBusy(ref.current)) throw new Error(DIALOGUE_THREAD_BUSY);
    const id = projectId, seq = ++switchSeq.current;
    // A new key per click; one whose answer was lost is sent again, so the server hands back the same conversation.
    const clientRequestId = createKey.current || nanoid();
    createKey.current = clientRequestId;
    setSwitching('new');
    try {
      const state = await createStudioDialogueThread(id, { clientRequestId });
      if (project.current !== id || switchSeq.current !== seq) return false;
      enter(state);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status && DEFINITE_REJECTION.has(error.status) && createKey.current === clientRequestId) createKey.current = undefined;
      throw error;
    } finally { if (switchSeq.current === seq) setSwitching(undefined); }
  }, [projectId, enter]);
  const openThread = useCallback(async (threadId: string): Promise<boolean> => {
    if (ref.current.thread?.id === threadId) return true;
    if (dialogueThreadBusy(ref.current)) throw new Error(DIALOGUE_THREAD_BUSY);
    const id = projectId, seq = ++switchSeq.current;
    setSwitching('open');
    try {
      const state = await openStudioDialogueThread(id, threadId);
      if (project.current !== id || switchSeq.current !== seq) return false;
      enter(state);
      return true;
    } finally { if (switchSeq.current === seq) setSwitching(undefined); }
  }, [projectId, enter]);
  const listThreads = useCallback((): Promise<StudioDialogueThreadSummary[]> => listStudioDialogueThreads(projectId), [projectId]);

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
      // The card names the execution it confirms (a stage of the running one, a raise, a revised plan); without one only a
      // running execution is reused. Otherwise a production card starts a new execution: a direct skill (出图 / 写剧本 /
      // 出视频) has no analysis stage, so its only card is the start. A finished execution left in the panel is never reused.
      ...(block.stage === 'production' ? { ...((block.executionId || executionActive(s.execution)) ? { executionId: block.executionId || s.execution!.id, expectedRevision: plan.revision } : {}),
          ...(plan.plan.confirmedApproachId || plan.plan.recommendedApproachId ? { approachId: plan.plan.confirmedApproachId || plan.plan.recommendedApproachId } : {}) }
        // A card the running analysis posted (a budget raise, a revised plan) confirms that same execution, not a new one.
        : block.executionId ? { executionId: block.executionId, expectedRevision: plan.revision } : {}) };
    const execution = await createStudioPlanExecution(projectId, request);
    dispatch({ type: 'execution', execution });
    // The execution's stage budget is what the server accepted; the request caps only if it does not say.
    const budget = execution.budgets.find(b => b.stage === block.stage);
    dispatch({ type: 'approval.local', approvalId: block.approvalId, status: 'approved', executionId: execution.id,
      approved: budget ? { budgetCap: budget.approvedCap, autoFixCap: budget.autoFixCap } : caps });
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

  return { store, dispatch, status, loadError, reload: load, stream, send, retry, stop, branch, newThread, openThread, listThreads, switching, approve, controlExecution, ensureExecution, acceptStep,
    loadOlder, readThread, executions };
}
export type StudioDialogueSession = ReturnType<typeof useStudioDialogueSession>;
