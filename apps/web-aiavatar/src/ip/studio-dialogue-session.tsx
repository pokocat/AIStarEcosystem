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
//
// Switching conversations (Codex review 2026-10-20): every request that belongs to the conversation shown captures
// {projectId, threadId, generation} when it starts, and its answer is dropped when that is no longer what is shown
// (`generation` moves on every switch, so A → B → A still drops what the first visit of A asked for). A confirmation
// (「开始制作」 and the like, from saving the canvas to the execution's answer) and a switch exclude each other. Catch-up
// reads (stream rebuilds, polls, refreshes) use the read-only snapshot by id; only the user's own pick opens a conversation.
//
// A confirmation whose answer was lost (Codex review 2026-10-20, P1): the request has ended but whether the server took it
// has not been settled. The guard is not let go on the request ending; the same request (same clientRequestId) is sent again
// with backoff until the server gives a definite answer: the execution (taken then or now, exactly once) or a refusal.
//
// A card confirmed in words (Codex 2026-10-21, P2): typing 「可以」 confirms on the server inside the reply, and the reply ends
// before the execution it started is known here. From the 「approved」 card (event or snapshot) until that execution is read,
// the conversation is held the same way (DialogueStore.awaitingExecutionId; a failed read is retried with the same backoff).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import { messageDeliveryError } from './studio-errors';
import type { StudioDialogueMessage, StudioDialogueState, StudioDialogueThreadSummary, StudioPlanExecution, StudioPlanExecutionCreateRequest } from '@ai-star-eco/types/ip-studio-workflow';
import {
  approvedExecutionIds, canvasRestoring, dialogueCursor, dialogueReducer, emptyDialogueStore, executionActive, isPlaceholderMessage, persistableCanvasCursor, planForApproval,
  type DialogueAction, type DialogueApprovalBlock, type DialogueStore,
} from '@/canvas-bridge/studio-dialogue-store';
import {
  branchStudioDialogue, controlStudioDialogue, createStudioDialogueThread, getStudioConversation, getStudioDialogueThread, listStudioDialogueMessages, listStudioDialogueThreads,
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
/**
 * A reply is streaming, an execution is running / paused / waiting, a message is still on its way, or a card was just
 * confirmed and the execution it started has not been read yet (typed 「可以」: the reply ends before the execution is
 * known here, and leaving in between lost its nodes; Codex 2026-10-21, P2).
 */
export const dialogueThreadBusy = (store: DialogueStore) => !!store.activeTurnId || executionActive(store.execution) || store.outbox.some(o => o.state === 'sending')
  || !!store.awaitingExecutionId;
/** Why a confirmation card waits: the panel is moving to another conversation, and the card belongs to the one it leaves. */
export const DIALOGUE_SWITCHING = '正在切换对话，请稍等';
/** Why the conversation still waits after a confirmation's answer was lost: it is being sent again until the answer is known. */
export const DIALOGUE_VERIFYING = '正在核对确认结果，请稍等';
/** Backoff between resends of a confirmation whose answer was lost: 2s, 4s, 8s… up to 30s. Tests shorten it. */
export const dialogueVerifyTiming = { firstMs: 2000, maxMs: 30000 };
const verifyDelay = (attempt: number) => Math.min(dialogueVerifyTiming.firstMs * 2 ** (attempt - 1), dialogueVerifyTiming.maxMs);
const definitelyRefused = (error: unknown) => error instanceof ApiError && !!error.status && DEFINITE_REJECTION.has(error.status)
  && !['HTTP_ERROR', 'PARSE_ERROR', 'BAD_ENVELOPE'].includes(error.code);
/** Delivery can be uncertain during a brief disconnect/restart. Reuse the exact request, with bounded backoff. */
export const dialogueSendTiming = { firstMs: 2000, maxMs: 16000, attempts: 5 };
/** A read of an execution that can never succeed (none such for this user); anything else is tried again. */
const executionUnreadable = (error: unknown) => error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 404);

/** What a thread-owned request was asked for; its answer only lands while this is still what the panel shows. */
type DialogueScope = { projectId: string; threadId?: string; generation: number };

/** `autoload`: read the thread even while the panel is closed (the canvas is missing work an execution produced). */
export function useStudioDialogueSession({ projectId, open, autoload = false }: { projectId: string; open: boolean; autoload?: boolean }) {
  const [store, dispatch] = useReducer(dialogueReducer, undefined, emptyDialogueStore);
  const ref = useRef(store); ref.current = store;
  const project = useRef(projectId); project.current = projectId;
  /** Moves on every change of the conversation shown (load, 「新对话」, 「历史对话」, 「从这里重新开始」, another canvas). */
  const generation = useRef(0);
  const scope = (): DialogueScope => ({ projectId: project.current, threadId: ref.current.thread?.id, generation: generation.current });
  const stillShown = (at: DialogueScope) => project.current === at.projectId && generation.current === at.generation && ref.current.thread?.id === at.threadId;
  /** A switch applies its snapshot to the ref at once, so a request started before the next render sees the new conversation. */
  const fold = (action: DialogueAction) => { ref.current = dialogueReducer(ref.current, action); dispatch(action); };
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState<unknown>();
  const [stream, setStream] = useState<DialogueStreamMode>('stopped');
  const loaded = useRef<string | undefined>(undefined);
  const approvalKeys = useRef(new Map<string, string>());

  const [linked, setLinked] = useState<Record<string, StudioPlanExecution>>({});
  const linkedRef = useRef(linked); linkedRef.current = linked;
  const linkedRequested = useRef(new Set<string>());
  // 「新对话」 / 「历史对话」 / 「从这里重新开始」: only the newest switch may land; the create key survives a lost response so a
  // retry is the same request. The ref mirrors the state for the checks made inside callbacks.
  const switchSeq = useRef(0), createKey = useRef<string | undefined>(undefined);
  const [switching, setSwitchingState] = useState<'new' | 'open' | 'branch'>();
  const switchingRef = useRef<'new' | 'open' | 'branch' | undefined>(undefined);
  const setSwitching = (kind: 'new' | 'open' | 'branch' | undefined) => { switchingRef.current = kind; setSwitchingState(kind); };
  // A confirmation on its way, counted (a card and a check node may overlap). See `confirmation` below.
  const confirmations = useRef(0);
  const [confirming, setConfirming] = useState(false);
  // The card whose lost answer is being settled (see `settle` in approve), and how to cut its current wait short.
  const [verifying, setVerifying] = useState<string>();
  const wakeVerify = useRef<(() => void) | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; wakeVerify.current?.(); }; }, []);
  useEffect(() => {
    dispatch({ type: 'reset' }); loaded.current = undefined; setStatus('idle'); setLoadError(undefined); setLinked({}); linkedRequested.current = new Set();
    generation.current++; switchSeq.current++; createKey.current = undefined; setSwitching(undefined);
    wakeVerify.current?.(); // a settle of the canvas left ends now instead of after its wait
  }, [projectId]);
  const load = useCallback(async () => {
    const id = projectId, visit = ++generation.current;
    loaded.current = id; setStatus('loading'); setLoadError(undefined);
    try {
      const state = await getStudioConversation(id);
      if (project.current !== id || generation.current !== visit) return;
      const cursor = readCanvasCursor(state.thread.id);
      fold({ type: 'snapshot', state, mode: 'replace', canvasAckSeq: cursor, restoreCanvas: cursor === undefined });
      setStatus('ready');
    } catch (error) {
      if (project.current !== id || generation.current !== visit) return;
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
    // Nothing of this subscription lands after it ended: a rebuild or a poll can still be on its way when the panel moves
    // to another conversation, or away and back to this one (an older snapshot would take the timeline back).
    let subscribed = true;
    const stop = subscribeStudioDialogue({ projectId, threadId, cursor: () => dialogueCursor(ref.current),
      onEvent: event => { if (subscribed) dispatch({ type: 'event', event }); },
      // This conversation's snapshot by its id, read only. GET /conversation answers with the last opened one, which another
      // tab may have changed, and opening this one to read it would move the server's current conversation (Codex review
      // 2026-10-20: the page showed B, a refresh landed in A).
      getSnapshot: () => getStudioDialogueThread(projectId, threadId),
      onSnapshot: (state, reason) => {
        if (!subscribed || state.thread.id !== ref.current.thread?.id) return;
        // The stream reconnects right away with cursor(); fold now so it does not read the pre-snapshot cursor.
        fold({ type: 'snapshot', state, mode: reason === 'expired' ? 'replace' : 'merge' });
      },
      onMode: mode => { if (subscribed) setStream(mode); } });
    return () => { subscribed = false; stop(); setStream('stopped'); };
  }, [live, projectId, threadId]);

  const refresh = useCallback(async () => {
    const at = scope();
    if (!at.threadId) return;
    // The conversation still shown, read by its id (the last opened one may be another: a switch here, another tab).
    try { const state = await getStudioDialogueThread(at.projectId, at.threadId); if (stillShown(at)) dispatch({ type: 'snapshot', state, mode: 'merge' }); }
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
    const at = scope();
    try { const execution = await getStudioPlanExecution(at.projectId, executionId); if (stillShown(at)) dispatch({ type: 'execution', execution }); }
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
  // A card confirmed in words (or seen confirmed in a snapshot) names an execution this conversation does not show yet; the
  // conversation is held (dialogueThreadBusy) until it is read. A failed read is tried again with the confirmation's backoff;
  // leaving the canvas, a switch or unmounting ends it, and only 「no such execution」 lets go without one.
  const awaitingExecutionId = store.awaitingExecutionId;
  useEffect(() => {
    if (!awaitingExecutionId) return;
    const at = scope();
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (attempt: number) => {
      try {
        const execution = await getStudioPlanExecution(at.projectId, awaitingExecutionId);
        if (!stopped && stillShown(at)) dispatch({ type: 'execution', execution });
      } catch (error) {
        if (stopped || !stillShown(at)) return;
        if (executionUnreadable(error)) { dispatch({ type: 'execution.unavailable', executionId: awaitingExecutionId }); return; }
        timer = setTimeout(() => void read(attempt + 1), verifyDelay(attempt));
      }
    };
    void read(1);
    return () => { stopped = true; clearTimeout(timer); };
  }, [awaitingExecutionId, projectId]);
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
    // The executions of the conversation shown now; a read still on its way when the panel moved on belongs to the one it
    // left (it would otherwise show that work here and even lock this conversation as 「进行中」).
    const at = scope(), requested = linkedRequested.current;
    const show = (execution: StudioPlanExecution, index: number) => { if (index === 0 && !ref.current.execution) dispatch({ type: 'execution', execution }); };
    linkedIds.split(',').forEach((executionId, index) => {
      // An execution just confirmed is read (and shown) by the hold above.
      if (ref.current.execution?.id === executionId || ref.current.awaitingExecutionId === executionId) return;
      const known = linkedRef.current[executionId];
      if (known) { show(known, index); return; }
      if (requested.has(executionId)) return;
      requested.add(executionId);
      getStudioPlanExecution(at.projectId, executionId).then(execution => {
        if (!stillShown(at)) return;
        setLinked(current => ({ ...current, [execution.id]: execution }));
        show(execution, index);
      }).catch(() => { requested.delete(executionId); });
    });
  }, [status, linkedIds, projectId, hasExecution]);
  const executions = useMemo(() => {
    const list = Object.values(linked).filter(e => e.id !== store.execution?.id);
    return store.execution ? [...list, store.execution] : list;
  }, [linked, store.execution]);

  const post = useCallback(async (clientMessageId: string, input: DialogueSendInput): Promise<DialogueSendOutcome> => {
    const s = ref.current, at = scope();
    if (!s.thread) return { state: 'rejected', error: new Error('对话还没准备好，请稍后再发') };
    const revision = [...s.messages].reverse().flatMap(m => m.blocks).find(b => b.type === 'plan');
    // The outcome is still reported; the store is only touched while this conversation is the one shown.
    const apply = (action: DialogueAction) => { if (stillShown(at)) dispatch(action); };
    // Keep the complete body fixed across retries (including its approved price, model and plan revision).
    const request = { clientMessageId, text: input.text,
      ...(input.pinnedNodeIds.length ? { pinnedNodeIds: input.pinnedNodeIds } : {}), ...(input.attachmentNodeIds.length ? { attachmentNodeIds: input.attachmentNodeIds } : {}),
      ...(revision?.type === 'plan' ? { expectedPlanRevision: revision.revision } : {}), ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}),
      ...(input.skillKey ? { skillKey: input.skillKey } : {}), ...(input.model ? { model: input.model } : {}) };
    let lastError: unknown;
    for (let attempt = 0; attempt < dialogueSendTiming.attempts; attempt++) {
      try {
        const result = await postStudioDialogueMessage(at.projectId, s.thread.id, request);
        apply({ type: 'outbox.sent', clientMessageId, result, createdAt: new Date().toISOString() });
        return { state: 'sent' };
      } catch (error) {
        if (definitelyRefused(error)) { apply({ type: 'outbox.remove', clientMessageId }); return { state: 'rejected', error }; }
        lastError = error;
        // An answer can be lost after acceptance. Read first; a matching persisted message proves delivery without
        // resending or opening another conversation. Never infer acceptance from the text alone.
        try {
          const state = await getStudioDialogueThread(at.projectId, s.thread.id);
          if (state?.thread.id === s.thread.id && state.messages.some(m => m.clientMessageId === clientMessageId)) {
            if (stillShown(at)) fold({ type: 'snapshot', state, mode: 'merge' });
            return { state: 'sent' };
          }
        } catch { /* retry the original key if reading is unavailable too */ }
        if (!alive.current || !stillShown(at) || attempt + 1 >= dialogueSendTiming.attempts) break;
        await new Promise(resolve => setTimeout(resolve, Math.min(dialogueSendTiming.firstMs * 2 ** attempt, dialogueSendTiming.maxMs)));
        if (!alive.current || !stillShown(at)) break;
      }
    }
    const error = messageDeliveryError(lastError, clientMessageId);
    apply({ type: 'outbox.failed', clientMessageId, error: error.message });
    return { state: 'unknown', error };

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
    const s = ref.current, at = scope();
    if (!s.thread) return;
    const state = await controlStudioDialogue(at.projectId, s.thread.id, { controlId: nanoid(), action: 'stop', ...(executionActive(s.execution) ? { executionId: s.execution!.id } : {}) });
    if (stillShown(at) && state.thread.id === at.threadId) dispatch({ type: 'snapshot', state, mode: 'merge' });
  }, [projectId]);

  /** 「从这里重新开始」 moves the panel to the new branch: a switch like the two below (one at a time, never during a confirmation). */
  const branch = useCallback(async (fromMessageId: string) => {
    const s = ref.current;
    if (!s.thread) return;
    if (confirmations.current) throw new Error(DIALOGUE_THREAD_BUSY);
    if (switchingRef.current) throw new Error(DIALOGUE_SWITCHING);
    const id = projectId, seq = ++switchSeq.current;
    setSwitching('branch');
    try {
      const state = await branchStudioDialogue(id, s.thread.id, { clientRequestId: nanoid(), fromMessageId });
      if (project.current !== id || switchSeq.current !== seq) return;
      // Unlike a switch, a branch starts its canvas cursor at the snapshot (no replay of the history it copied).
      generation.current++;
      fold({ type: 'snapshot', state, mode: 'replace' });
    } finally { if (switchSeq.current === seq) setSwitching(undefined); }
  }, [projectId]);

  // ── Several conversations per canvas (docs/ip-studio-new-canvas-and-threads.md §3) ─────────
  // Switching works like 「从这里重新开始」 above: the returned snapshot replaces the timeline (another thread starts from a
  // clean store), and the stream follows the new thread id. Like the first open, the canvas cursor is read for that
  // thread (absent → its execution output is restored, never re-run). Executions read back for the previous thread
  // belong to it and are dropped. Nothing here calls a model or spends credits.
  const enter = useCallback((state: StudioDialogueState) => {
    generation.current++;
    const cursor = readCanvasCursor(state.thread.id);
    fold({ type: 'snapshot', state, mode: 'replace', canvasAckSeq: cursor, restoreCanvas: cursor === undefined });
    setLinked({}); linkedRequested.current = new Set();
    createKey.current = undefined;
    loaded.current = project.current; setStatus('ready'); setLoadError(undefined);
  }, []);
  /** Resolves true once the new conversation is shown, false when a later switch (or another canvas) took over. */
  const newThread = useCallback(async (): Promise<boolean> => {
    if (dialogueThreadBusy(ref.current) || confirmations.current) throw new Error(DIALOGUE_THREAD_BUSY);
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
    if (dialogueThreadBusy(ref.current) || confirmations.current) throw new Error(DIALOGUE_THREAD_BUSY);
    const id = projectId, seq = ++switchSeq.current;
    setSwitching('open');
    try {
      // The user's own pick: the one call that makes a conversation the server's current one.
      const state = await openStudioDialogueThread(id, threadId);
      if (project.current !== id || switchSeq.current !== seq) return false;
      enter(state);
      return true;
    } finally { if (switchSeq.current === seq) setSwitching(undefined); }
  }, [projectId, enter]);
  const listThreads = useCallback((): Promise<StudioDialogueThreadSummary[]> => listStudioDialogueThreads(projectId), [projectId]);

  /**
   * A confirmation and a switch exclude each other (Codex review 2026-10-20). From saving the canvas to the execution's answer
   * (or its refusal) the conversation shown cannot change: the execution's nodes arrive on this conversation's event stream,
   * and its answer belongs here. While a switch is on its way, a card of the conversation being left starts nothing.
   */
  const confirmation = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    if (switchingRef.current) throw new Error(DIALOGUE_SWITCHING);
    confirmations.current++; setConfirming(true);
    try { return await run(); }
    finally { if (--confirmations.current === 0) setConfirming(false); }
  }, []);

  /** Waits `ms`, or less when 「现在再查一次」, leaving the canvas or unmounting cuts it short. */
  const pause = (ms: number) => new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); if (wakeVerify.current === done) wakeVerify.current = undefined; resolve(); };
    const timer = setTimeout(done, ms);
    wakeVerify.current = done;
  });
  /**
   * Settles a confirmation whose answer was lost by sending the same request again (same clientRequestId) with backoff. The
   * server answers a request it already took with that execution and takes one it never saw, so the outcome is known, and
   * exactly one execution exists, either way; a definite refusal ends it with that error for the card. A catch-up read could
   * not tell 「not taken」 from 「still being taken」 (a 504 whose request is still running), and letting go on 「not taken」
   * left that execution running behind another conversation. Stops when the canvas is left or the panel unmounts.
   */
  const settle = async (at: DialogueScope, approvalId: string, request: StudioPlanExecutionCreateRequest): Promise<StudioPlanExecution> => {
    setVerifying(approvalId);
    try {
      for (let attempt = 1; ; attempt++) {
        await pause(verifyDelay(attempt));
        if (!alive.current || project.current !== at.projectId || generation.current !== at.generation) throw new Error('已离开这段对话，确认结果没有核对完');
        try { return await createStudioPlanExecution(at.projectId, request); }
        catch (error) { if (definitelyRefused(error)) throw error; }
      }
    } finally { if (alive.current) setVerifying(undefined); }
  };
  /** 「现在再查一次」: the next resend goes now instead of after its wait. */
  const recheck = useCallback(() => { wakeVerify.current?.(); }, []);

  /** `prepare`: work that must finish first and is already guarded, such as saving the canvas the execution reads. */
  const approve = useCallback((block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string,
    prepare?: () => Promise<unknown>): Promise<StudioPlanExecution> => confirmation(async () => {
    const at = scope();
    if (prepare) await prepare();
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
    let execution: StudioPlanExecution;
    try { execution = await createStudioPlanExecution(at.projectId, request); }
    catch (error) {
      if (definitelyRefused(error)) throw error;
      // Not a definite refusal: the execution may have started, and its nodes arrive on this conversation's stream. The guard
      // holds until the answer is known (one failed catch-up read used to let it go, Codex review 2026-10-20 P1).
      execution = await settle(at, block.approvalId, request);
    }
    if (!stillShown(at)) return execution;
    dispatch({ type: 'execution', execution });
    // The execution's stage budget is what the server accepted; the request caps only if it does not say.
    const budget = execution.budgets.find(b => b.stage === block.stage);
    dispatch({ type: 'approval.local', approvalId: block.approvalId, status: 'approved', executionId: execution.id,
      approved: budget ? { budgetCap: budget.approvedCap, autoFixCap: budget.autoFixCap } : caps });
    return execution;
  }), [projectId, confirmation]);

  const controlExecution = useCallback((action: 'pause' | 'resume' | 'cancel') => confirmation(async () => {
    const execution = ref.current.execution, at = scope();
    if (!execution) return;
    const request = { clientRequestId: nanoid(), expectedStatus: execution.status };
    const next = action === 'pause' ? await pauseStudioPlanExecution(at.projectId, execution.id, request)
      : action === 'resume' ? await resumeStudioPlanExecution(at.projectId, execution.id, request) : await cancelStudioPlanExecution(at.projectId, execution.id, request);
    if (stillShown(at)) dispatch({ type: 'execution', execution: next });
  }), [projectId, confirmation]);

  /** Reads one execution (a check node's 「就用这版」); it is shown here only while it belongs to this conversation. */
  const ensureExecution = useCallback(async (id: string) => {
    if (ref.current.execution?.id === id) return ref.current.execution;
    const at = scope();
    const execution = await getStudioPlanExecution(at.projectId, id);
    if (stillShown(at)) dispatch({ type: 'execution', execution });
    return execution;
  }, [projectId]);
  const acceptStep = useCallback((executionId: string, stepId: string, runId: string) => confirmation(async () => {
    const at = scope();
    const next = await acceptStudioPlanExecutionStep(at.projectId, executionId, stepId, { clientRequestId: nanoid(), runId });
    if (stillShown(at)) dispatch({ type: 'execution', execution: next });
  }), [projectId, confirmation]);

  const loadOlder = useCallback(async () => {
    const s = ref.current, at = scope();
    const first = s.messages.find(m => !m.legacyNodeId && !isPlaceholderMessage(m.id));
    if (!s.thread || !first) return;
    const messages = await listStudioDialogueMessages(at.projectId, s.thread.id, { beforeSeq: Math.floor(first.seq), limit: 50 });
    // A page of the conversation the panel has left (or of an earlier visit of this one) is dropped.
    if (stillShown(at)) dispatch({ type: 'older', threadId: s.thread.id, messages, limit: 50 });
  }, [projectId]);
  /** The parent of a branch, for its read-only preview. Reading never changes the server's current conversation. */
  const readThread = useCallback((id: string): Promise<StudioDialogueMessage[]> => listStudioDialogueMessages(projectId, id, { limit: 200 }), [projectId]);

  return { store, dispatch, status, loadError, reload: load, stream, send, retry, stop, branch, newThread, openThread, listThreads, switching,
    /** A confirmation is on its way: no new conversation, no switch (same reason as a conversation still going). */
    confirming,
    /** The card whose confirmation's answer was lost and is being settled (still `confirming`); see DIALOGUE_VERIFYING. */
    verifying, recheck,
    approve, controlExecution, ensureExecution, acceptStep, loadOlder, readThread, executions };
}
export type StudioDialogueSession = ReturnType<typeof useStudioDialogueSession>;
