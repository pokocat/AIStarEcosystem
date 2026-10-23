// Pure thread state for the Studio dialogue (docs/ip-studio-conversational-video-recreation-plan.md §对话事件协议).
//
// The server owns messages, blocks, runs and executions. This reducer only folds the
// event stream and thread snapshots into what the panel renders:
// - message.delta appends real streamed text by partId; seq is thread-monotonic, so any
//   event at or below the applied seq is a replay and never appends twice.
// - tool / plan / approval / turn events upsert typed blocks by their stable ids.
// - node.upsert / check.result are queued as canvas operations with their own cursor, so
//   a reconnect from an older seq can replay canvas commands without duplicating text.
// - A viewer with no canvas cursor for this thread (first open on this browser) replays the
//   thread from the start; execution commands up to the snapshot are marked `restore`, which
//   only fills in nodes and edges the canvas is missing (never merges into existing nodes).
//   Old dialogue drafts are not replayed: the canvas may have dropped them on purpose.
import type {
  StudioApprovalRequiredData, StudioBudgetUpdateData, StudioCheckResultData, StudioDialogueEvent, StudioDialogueMessage,
  StudioDialogueState, StudioDialogueThread, StudioMessageBlock, StudioMessageDeltaData, StudioNodeUpsertData,
  StudioPlanExecution, StudioPlanProposedData, StudioPostMessageResult, StudioToolEventData, StudioTurnDoneData,
} from '@ai-star-eco/types/ip-studio-workflow';

export type DialogueToolBlock = Extract<StudioMessageBlock, { type: 'tool_call' }>;
export type DialogueApprovalBlock = Extract<StudioMessageBlock, { type: 'approval' }>;
export type DialoguePlanBlock = Extract<StudioMessageBlock, { type: 'plan' }>;
export type DialogueQuestionBlock = Extract<StudioMessageBlock, { type: 'question' }>;
export type DialogueAdoptionBlock = Extract<StudioMessageBlock, { type: 'adoption' }>;
export type DialogueQueueState = StudioPostMessageResult['queueState'];

/** A user message that has not been accepted yet. Accepted messages become ordinary thread messages. */
export interface DialogueOutboxItem {
  clientMessageId: string; text: string; pinnedNodeIds: string[]; attachmentNodeIds: string[]; maxCost?: number;
  /** The skill the user picked for this message; a retry sends the same choice. Absent = the server routes. */
  skillKey?: string;
  createdAt: string; state: 'sending' | 'failed'; error?: string;
  /** The applied seq when the user pressed send; the accepted message sorts right after it, before any reply. */
  afterSeq?: number;
}
/** `restore`: a historical command replayed for a canvas that has no projection record; only adds what is missing. */
export type DialogueCanvasOp =
  | { seq: number; kind: 'node'; turnId: string; executionId?: string; restore?: boolean; data: StudioNodeUpsertData }
  | { seq: number; kind: 'check'; turnId: string; executionId?: string; restore?: boolean; data: StudioCheckResultData };
/** Arrival order of streamed text parts and blocks inside one live message. */
export interface DialogueLayout { order: string[]; parts: Record<string, string> }

export interface DialogueStore {
  thread?: StudioDialogueThread;
  messages: StudioDialogueMessage[];
  /** Highest seq folded into message state (or the snapshot cursor). */
  latestSeq: number;
  /** Highest seq whose canvas operation was queued; may trail latestSeq to replay canvas commands. */
  canvasSeq: number;
  /** Highest canvas seq actually projected onto the canvas (persisted per viewer). */
  canvasAckSeq: number;
  /**
   * Lowest canvas seq projected onto the canvas but not saved to the server yet. The persisted cursor stays below it:
   * a reopen after a failed save replays those commands instead of skipping nodes the server never got (Codex 2026-10-19).
   */
  canvasUnsavedFrom?: number;
  /** Replaying history for a viewer without a canvas cursor: commands at or below this seq are restores. 0 = none. */
  restoreThroughSeq: number;
  nextCursor?: string;
  hasOlder: boolean;
  layouts: Record<string, DialogueLayout>;
  turnMessages: Record<string, string>;
  activeTurnId?: string;
  doneTurns: string[];
  execution?: StudioPlanExecution;
  /**
   * A card of this thread just turned 「approved」 (typed 「可以」, or seen so in a snapshot) for an execution this store does
   * not hold yet. Until that execution is read the conversation stays put: its nodes arrive on this thread's stream
   * (Codex 2026-10-21, P2). The button path holds it by `confirming` and folds the execution itself.
   */
  awaitingExecutionId?: string;
  /** Bumped by execution-related events so the session can refresh the execution projection. */
  executionTouchedSeq: number;
  budgets: Record<string, StudioBudgetUpdateData>;
  checks: Record<string, StudioCheckResultData>;
  suggestions: Record<string, string[]>;
  shortfalls: Record<string, number>;
  queueStates: Record<string, DialogueQueueState>;
  localMessageIds: string[];
  outbox: DialogueOutboxItem[];
  canvasOps: DialogueCanvasOp[];
}

export type DialogueAction =
  | { type: 'reset' }
  | { type: 'snapshot'; state: StudioDialogueState; mode: 'replace' | 'merge'; canvasAckSeq?: number;
      /** First open of this thread on this browser (no saved canvas cursor): replay canvas commands from the start. */
      restoreCanvas?: boolean }
  | { type: 'event'; event: StudioDialogueEvent }
  | { type: 'outbox.add'; item: DialogueOutboxItem }
  | { type: 'outbox.sent'; clientMessageId: string; result: StudioPostMessageResult; createdAt?: string }
  | { type: 'outbox.failed'; clientMessageId: string; error: string }
  | { type: 'outbox.retry'; clientMessageId: string }
  | { type: 'outbox.remove'; clientMessageId: string }
  /** An execution of another conversation (a read still on its way when the user switched) is not shown here. */
  | { type: 'execution'; execution: StudioPlanExecution }
  /** The awaited execution cannot be read at all (it does not exist for this user): nothing will arrive for it. */
  | { type: 'execution.unavailable'; executionId: string }
  | { type: 'approval.local'; approvalId: string; status: DialogueApprovalBlock['status']; executionId?: string;
      /** The caps the server accepted (from the execution it returned); a server snapshot of the card wins. */
      approved?: { budgetCap: number; autoFixCap: number } }
  | { type: 'adoption.add'; messageId: string; block: DialogueAdoptionBlock }
  | { type: 'canvas.ack'; seq: number }
  /** The lowest projected-but-unsaved canvas seq, or undefined once everything projected has been saved. */
  | { type: 'canvas.unsaved'; fromSeq?: number }
  /** `threadId`: the conversation the page was read for; a page of another one (the user switched meanwhile) is dropped. */
  | { type: 'older'; messages: StudioDialogueMessage[]; limit: number; threadId?: string };

export const emptyDialogueStore = (): DialogueStore => ({
  messages: [], latestSeq: 0, canvasSeq: 0, canvasAckSeq: 0, restoreThroughSeq: 0, hasOlder: false, layouts: {}, turnMessages: {}, doneTurns: [],
  executionTouchedSeq: 0, budgets: {}, checks: {}, suggestions: {}, shortfalls: {}, queueStates: {}, localMessageIds: [], outbox: [], canvasOps: [],
});

const PLACEHOLDER = 'pending-turn:';
export const isPlaceholderMessage = (id: string) => id.startsWith(PLACEHOLDER);
const sortMessages = (list: StudioDialogueMessage[]) => [...list].sort((a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt));
export const blockKey = (block: StudioMessageBlock): string =>
  block.type === 'tool_call' ? `tool:${block.toolCallId}` : block.type === 'approval' ? `approval:${block.approvalId}` :
    block.type === 'plan' ? 'plan' : block.type === 'question' ? `question:${block.questionId}` : `adoption:${block.nodeId}:${block.field}:${textHash(block.content)}`;
/** Small stable hash so two proposals for the same field keep separate places in a message. */
function textHash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export const layoutText = (layout: DialogueLayout) => layout.order.filter(k => k.startsWith('t:')).map(k => layout.parts[k.slice(2)] || '').join('');

function replaceMessage(store: DialogueStore, id: string, update: (m: StudioDialogueMessage) => StudioDialogueMessage): DialogueStore {
  return { ...store, messages: store.messages.map(m => m.id === id ? update(m) : m) };
}

/** Seed a layout from a message's existing text, so live parts continue after a snapshot. */
function layoutFor(store: DialogueStore, message: StudioDialogueMessage): DialogueLayout {
  const existing = store.layouts[message.id];
  if (existing) return existing;
  const order = message.text ? ['t:__base'] : [];
  return { order: [...order, ...message.blocks.map(b => `b:${blockKey(b)}`)], parts: message.text ? { __base: message.text } : {} };
}

/** The assistant message an event belongs to. Tool events carry no messageId; they attach to the turn's message. */
function ensureAssistantMessage(store: DialogueStore, event: StudioDialogueEvent, messageId?: string): [DialogueStore, string] {
  const turnId = event.turnId;
  if (messageId) {
    if (store.messages.some(m => m.id === messageId)) return [{ ...store, turnMessages: { ...store.turnMessages, [turnId]: messageId } }, messageId];
    const placeholder = store.turnMessages[turnId];
    if (placeholder && isPlaceholderMessage(placeholder) && store.messages.some(m => m.id === placeholder)) {
      const layouts = { ...store.layouts };
      if (layouts[placeholder]) { layouts[messageId] = layouts[placeholder]; delete layouts[placeholder]; }
      return [{ ...replaceMessage(store, placeholder, m => ({ ...m, id: messageId })), layouts, turnMessages: { ...store.turnMessages, [turnId]: messageId } }, messageId];
    }
  } else {
    const known = store.turnMessages[turnId];
    if (known && store.messages.some(m => m.id === known)) return [store, known];
  }
  const id = messageId || `${PLACEHOLDER}${turnId}`;
  const message: StudioDialogueMessage = { id, threadId: event.threadId, seq: event.seq, turnId, runId: event.runId, role: 'assistant', text: '', blocks: [], status: 'streaming', createdAt: event.createdAt };
  return [{ ...store, messages: sortMessages([...store.messages, message]), turnMessages: { ...store.turnMessages, [turnId]: id }, layouts: { ...store.layouts, [id]: { order: [], parts: {} } } }, id];
}

function upsertBlock(store: DialogueStore, messageId: string, block: StudioMessageBlock, matches: (b: StudioMessageBlock) => boolean = b => blockKey(b) === blockKey(block)): DialogueStore {
  const message = store.messages.find(m => m.id === messageId);
  if (!message) return store;
  const exists = message.blocks.some(matches);
  const layout = layoutFor(store, message), key = `b:${blockKey(block)}`;
  const next = replaceMessage(store, messageId, m => ({ ...m, blocks: exists ? m.blocks.map(b => matches(b) ? block : b) : [...m.blocks, block] }));
  return { ...next, layouts: { ...next.layouts, [messageId]: layout.order.includes(key) ? layout : { ...layout, order: [...layout.order, key] } } };
}

function findBlock<T extends StudioMessageBlock>(store: DialogueStore, test: (b: StudioMessageBlock) => b is T): { messageId: string; block: T } | undefined {
  for (const m of store.messages) for (const b of m.blocks) if (test(b)) return { messageId: m.id, block: b };
  return undefined;
}

const isTool = (id: string) => (b: StudioMessageBlock): b is DialogueToolBlock => b.type === 'tool_call' && b.toolCallId === id;
const isApproval = (id: string) => (b: StudioMessageBlock): b is DialogueApprovalBlock => b.type === 'approval' && b.approvalId === id;

function applyTool(store: DialogueStore, event: StudioDialogueEvent<StudioToolEventData>): DialogueStore {
  const d = event.data;
  const found = findBlock(store, isTool(d.toolCallId));
  let s = store, messageId = found?.messageId;
  if (!messageId) [s, messageId] = ensureAssistantMessage(s, event);
  const previous: DialogueToolBlock = found?.block || { type: 'tool_call', toolCallId: d.toolCallId, toolName: d.toolName, title: d.title || '', safeInputSummary: d.safeInputSummary || '', status: 'running', startedAt: event.createdAt };
  let block: DialogueToolBlock = { ...previous, toolName: d.toolName || previous.toolName, title: d.title || previous.title, safeInputSummary: d.safeInputSummary ?? previous.safeInputSummary,
    childRunId: d.childRunId ?? previous.childRunId, progress: d.progress ?? previous.progress };
  if (event.type === 'tool.started') block = { ...block, status: 'running', startedAt: found ? previous.startedAt : event.createdAt };
  if (event.type === 'tool.progress' && d.status) block = { ...block, status: d.status };
  if (event.type === 'tool.finished') {
    const status = d.status && d.status !== 'running' ? d.status : d.errorCode || d.errorMessage ? 'failed' : 'done';
    const elapsed = Date.parse(event.createdAt) - Date.parse(block.startedAt);
    block = { ...block, status, finishedAt: event.createdAt, durationMs: d.durationMs ?? (Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : undefined),
      result: d.result ?? block.result, creditsActual: d.creditsActual ?? block.creditsActual, settling: d.settling ?? (d.creditsActual === undefined ? true : false),
      errorCode: d.errorCode, errorMessage: d.errorMessage };
  }
  return upsertBlock(s, messageId, block);
}

function applyDelta(store: DialogueStore, event: StudioDialogueEvent<StudioMessageDeltaData>): DialogueStore {
  const d = event.data;
  const [s, id] = ensureAssistantMessage(store, event, d.messageId);
  const message = s.messages.find(m => m.id === id)!;
  const layout = layoutFor(s, message), key = `t:${d.partId}`;
  const next: DialogueLayout = { order: layout.order.includes(key) ? layout.order : [...layout.order, key], parts: { ...layout.parts, [d.partId]: (layout.parts[d.partId] || '') + d.delta } };
  const updated = replaceMessage(s, id, m => ({ ...m, text: layoutText(next), status: m.status === 'done' || m.status === 'failed' ? m.status : 'streaming' }));
  return { ...updated, layouts: { ...updated.layouts, [id]: next } };
}

function supersedeApprovals(store: DialogueStore, keep: string): DialogueStore {
  return { ...store, messages: store.messages.map(m => m.blocks.some(b => b.type === 'approval' && b.approvalId !== keep && b.status === 'pending')
    ? { ...m, blocks: m.blocks.map(b => b.type === 'approval' && b.approvalId !== keep && b.status === 'pending' ? { ...b, status: 'superseded' as const } : b) } : m) };
}

/**
 * A newer plan revision replaces every pending card quoted for an older one: it can no longer start
 * anything (the server answers STUDIO_PLAN_STALE), so it must not look actionable. `unknownPlans`: also
 * replace cards whose plan is not in the loaded messages (only safe when a new revision just arrived).
 */
function supersedeOlderApprovals(messages: StudioDialogueMessage[], latest: { fingerprint: string; revision: number }, unknownPlans: boolean): StudioDialogueMessage[] {
  const revisions = new Map<string, number>();
  for (const m of messages) for (const b of m.blocks) if (b.type === 'plan') revisions.set(b.fingerprint, Math.max(b.revision, revisions.get(b.fingerprint) ?? -Infinity));
  const stale = (b: StudioMessageBlock): b is DialogueApprovalBlock => b.type === 'approval' && b.status === 'pending' && b.planFingerprint !== latest.fingerprint
    && (revisions.has(b.planFingerprint) ? revisions.get(b.planFingerprint)! < latest.revision : unknownPlans);
  if (!messages.some(m => m.blocks.some(stale))) return messages;
  return messages.map(m => m.blocks.some(stale) ? { ...m, blocks: m.blocks.map(b => stale(b) ? { ...b, status: 'superseded' as const } : b) } : m);
}
function latestPlan(messages: StudioDialogueMessage[]) {
  let found: DialoguePlanBlock | undefined;
  for (const m of messages) for (const b of m.blocks) if (b.type === 'plan' && (!found || b.revision > found.revision)) found = b;
  return found;
}

function turnDoneStatus(reason: StudioTurnDoneData['reason']): StudioDialogueMessage['status'] {
  return reason === 'failed' ? 'failed' : reason === 'interrupted' ? 'interrupted' : 'done';
}

const ACTIVATING = new Set(['message.delta', 'tool.started', 'tool.progress', 'tool.finished', 'plan.proposed', 'approval.required']);

function applyEvent(store: DialogueStore, event: StudioDialogueEvent): DialogueStore {
  if (store.thread && event.threadId !== store.thread.id) return store;
  let s = store;
  if (event.seq > s.canvasSeq) {
    // The stream sends every event after the cursor once, in seq order: having seen this one, every canvas
    // command up to it is queued, and when nothing is waiting to be projected, it is projected as well.
    const restore = event.seq <= s.restoreThroughSeq;
    if ((event.type === 'node.upsert' || event.type === 'check.result') && (!restore || event.executionId)) {
      const base = { seq: event.seq, turnId: event.turnId, executionId: event.executionId, ...(restore ? { restore: true } : {}) };
      const op: DialogueCanvasOp = event.type === 'node.upsert' ? { ...base, kind: 'node', data: event.data as StudioNodeUpsertData } : { ...base, kind: 'check', data: event.data as StudioCheckResultData };
      s = { ...s, canvasSeq: event.seq, canvasOps: [...s.canvasOps, op] };
    } else s = { ...s, canvasSeq: event.seq, canvasAckSeq: s.canvasOps.length ? s.canvasAckSeq : Math.max(s.canvasAckSeq, event.seq) };
  }
  if (event.type === 'check.result') {
    const d = event.data as StudioCheckResultData;
    s = { ...s, checks: { ...s.checks, [d.runId]: d } };
  }
  if (event.seq <= s.latestSeq) return s;
  s = { ...s, latestSeq: event.seq };
  if (event.executionId && ['budget.update', 'node.upsert', 'check.result', 'tool.finished'].includes(event.type)) s = { ...s, executionTouchedSeq: event.seq };
  if (ACTIVATING.has(event.type) && !s.doneTurns.includes(event.turnId)) s = { ...s, activeTurnId: event.turnId };
  switch (event.type) {
    case 'message.delta': return applyDelta(s, event as StudioDialogueEvent<StudioMessageDeltaData>);
    case 'tool.started': case 'tool.progress': case 'tool.finished': return applyTool(s, event as StudioDialogueEvent<StudioToolEventData>);
    case 'plan.proposed': {
      const d = event.data as StudioPlanProposedData;
      const [next, id] = ensureAssistantMessage(s, event, d.messageId);
      const upserted = upsertBlock(next, id, d.block, b => b.type === 'plan');
      return { ...upserted, messages: supersedeOlderApprovals(upserted.messages, d.block, true) };
    }
    case 'approval.required': {
      const d = event.data as StudioApprovalRequiredData;
      const found = findBlock(s, isApproval(d.block.approvalId));
      let next = s, id = found?.messageId;
      if (!id) [next, id] = ensureAssistantMessage(next, event, d.messageId);
      next = upsertBlock(next, id, d.block);
      if (d.block.status === 'pending') next = supersedeApprovals(next, d.block.approvalId);
      // Confirmed just now (in words, or by a button whose answer has not come back yet): hold the conversation until
      // the execution it started is read.
      if (d.block.status === 'approved' && d.block.executionId && found?.block.status !== 'approved' && next.execution?.id !== d.block.executionId)
        next = { ...next, awaitingExecutionId: d.block.executionId };
      return d.shortfall === undefined ? next : { ...next, shortfalls: { ...next.shortfalls, [d.block.approvalId]: d.shortfall } };
    }
    case 'budget.update': {
      const d = event.data as StudioBudgetUpdateData;
      // dialogueSpent / dialogueInFlight are the dialogue's share already inside spent / inFlight, never added again.
      const live = { approvedCap: d.approvedCap, spent: d.spent, inFlight: d.inFlight, remaining: d.remaining, shortfall: d.shortfall, dialogueSpent: d.dialogueSpent, dialogueInFlight: d.dialogueInFlight };
      const execution = s.execution?.id === d.executionId ? { ...s.execution, budgets: s.execution.budgets.some(b => b.stage === d.stage)
        ? s.execution.budgets.map(b => b.stage === d.stage ? { ...b, ...live } : b)
        : [...s.execution.budgets, { stage: d.stage, autoFixCap: 0, ...live }] } : s.execution;
      return { ...s, execution, budgets: { ...s.budgets, [`${d.executionId}:${d.stage}`]: d } };
    }
    case 'turn.done': {
      const d = event.data as StudioTurnDoneData;
      const [next, id] = ensureAssistantMessage(s, event, d.messageId);
      const updated = replaceMessage(next, id, m => ({ ...m, status: turnDoneStatus(d.reason), billing: d.billing ?? m.billing, settling: d.settling ?? m.settling }));
      // A chained task hands the same request to the next task (docs/ip-studio-dialogue-no-continue.md §3): the
      // conversation goes straight on with that turn, never idle in between.
      const handedTo = d.nextTurnId && !updated.doneTurns.includes(d.nextTurnId) ? d.nextTurnId : undefined;
      return { ...updated, doneTurns: [...updated.doneTurns.filter(t => t !== event.turnId), event.turnId].slice(-200),
        activeTurnId: updated.activeTurnId === event.turnId || (handedTo && !updated.activeTurnId) ? handedTo : updated.activeTurnId,
        suggestions: d.suggestions?.length ? { ...updated.suggestions, [id]: d.suggestions.slice(0, 3) } : updated.suggestions };
    }
    default: return s;
  }
}

function applySnapshot(store: DialogueStore, action: Extract<DialogueAction, { type: 'snapshot' }>): DialogueStore {
  const state = action.state;
  const sameThread = store.thread?.id === state.thread.id;
  const replace = action.mode === 'replace' || !sameThread;
  if (!replace && state.latestSeq < store.latestSeq) {
    // An older poll must not roll streamed text back; it may still carry a newer execution.
    const execution = newerExecution(store.execution, state.execution);
    return { ...store, thread: { ...state.thread, lastSeq: Math.max(state.thread.lastSeq, store.thread?.lastSeq || 0) }, execution,
      awaitingExecutionId: execution && execution.id === store.awaitingExecutionId ? undefined : store.awaitingExecutionId };
  }
  const incoming = new Map(state.messages.map(m => [m.id, m]));
  const confirmedClientIds = new Set(state.messages.map(m => m.clientMessageId).filter(Boolean));
  const kept = (sameThread ? store.messages : []).filter(m => !incoming.has(m.id) &&
    !(m.clientMessageId && confirmedClientIds.has(m.clientMessageId)) &&
    !(isPlaceholderMessage(m.id) && state.messages.some(x => x.turnId === m.turnId)) &&
    (!replace || store.localMessageIds.includes(m.id) || isPlaceholderMessage(m.id)));
  const merged = sortMessages([...kept, ...state.messages]);
  // A server that has not marked an outdated card yet must not make it actionable again.
  const newest = latestPlan(merged);
  const messages = newest ? supersedeOlderApprovals(merged, newest, false) : merged;
  const layouts: Record<string, DialogueLayout> = {};
  if (sameThread) for (const [id, layout] of Object.entries(store.layouts)) {
    const fresh = incoming.get(id);
    // Keep the live arrangement only when the saved text is exactly what was streamed.
    if (!fresh ? messages.some(m => m.id === id) : layoutText(layout) === fresh.text) layouts[id] = layout;
  }
  const turnMessages: Record<string, string> = {};
  for (const m of messages) if (m.role === 'assistant' && m.turnId) turnMessages[m.turnId] = m.id;
  const doneTurns = sameThread ? store.doneTurns : [];
  // Only reached when the snapshot is at least as new as what was streamed, so its view of the active turn wins.
  const active = state.thread.activeTurnId && !doneTurns.includes(state.thread.activeTurnId) ? state.thread.activeTurnId : undefined;
  const latestSeq = replace ? state.latestSeq : Math.max(store.latestSeq, state.latestSeq);
  // A new thread starts its canvas cursor at the viewer's last projected seq; without one (first open on this
  // browser) it replays from the start in restore mode, so work finished while the canvas was closed still lands.
  // Anything else (a branch, a caller that passes no cursor) starts at the snapshot.
  // An expired cursor on the same thread jumps to the snapshot: replaying from it would only 410 again.
  const restore = !sameThread && !!action.restoreCanvas && state.latestSeq > 0;
  const canvasAckSeq = !sameThread ? (restore ? 0 : action.canvasAckSeq ?? state.latestSeq) : replace ? Math.max(store.canvasAckSeq, state.latestSeq) : store.canvasAckSeq;
  const canvasSeq = !sameThread ? canvasAckSeq : replace ? Math.max(store.canvasSeq, state.latestSeq) : store.canvasSeq;
  const restoreThroughSeq = !sameThread ? (restore ? state.latestSeq : 0) : store.restoreThroughSeq;
  const execution = replace ? state.execution : newerExecution(store.execution, state.execution);
  // A card this thread showed as pending that the snapshot reports confirmed (the event may never have reached this tab):
  // the same hold as for the event. A first read of a thread holds nothing, its cards were confirmed long ago.
  const before = new Map<string, string>();
  if (sameThread) for (const m of store.messages) for (const b of m.blocks) if (b.type === 'approval') before.set(b.approvalId, b.status);
  let confirmed: string | undefined;
  for (const m of messages) for (const b of m.blocks)
    if (b.type === 'approval' && b.status === 'approved' && b.executionId && before.get(b.approvalId) === 'pending') confirmed = b.executionId;
  const awaiting = !sameThread ? undefined : confirmed && confirmed !== execution?.id ? confirmed : store.awaitingExecutionId;
  return {
    // Seqs are per thread: a branch starts from a clean slate, including its canvas cursor.
    ...(sameThread ? store : emptyDialogueStore()),
    thread: state.thread, messages, layouts, turnMessages, doneTurns, activeTurnId: active,
    latestSeq, canvasSeq, canvasAckSeq, restoreThroughSeq,
    nextCursor: state.nextCursor, hasOlder: sameThread && !replace ? store.hasOlder || !!state.nextCursor : !!state.nextCursor,
    execution, awaitingExecutionId: awaiting && awaiting !== execution?.id ? awaiting : undefined,
    outbox: (sameThread ? store.outbox : []).filter(o => !confirmedClientIds.has(o.clientMessageId)),
    localMessageIds: (sameThread ? store.localMessageIds : []).filter(id => messages.some(m => m.id === id) && !incoming.has(id)),
  };
}

function newerExecution(current: StudioPlanExecution | undefined, incoming: StudioPlanExecution | undefined) {
  if (!incoming) return current;
  if (!current || current.id !== incoming.id) return incoming;
  return incoming.updatedAt >= current.updatedAt ? incoming : current;
}

export function dialogueReducer(store: DialogueStore, action: DialogueAction): DialogueStore {
  switch (action.type) {
    case 'reset': return emptyDialogueStore();
    case 'snapshot': return applySnapshot(store, action);
    case 'event': return applyEvent(store, action.event);
    case 'outbox.add': return store.outbox.some(o => o.clientMessageId === action.item.clientMessageId) ? store : { ...store, outbox: [...store.outbox, { ...action.item, afterSeq: action.item.afterSeq ?? store.latestSeq }] };
    case 'outbox.failed': return { ...store, outbox: store.outbox.map(o => o.clientMessageId === action.clientMessageId ? { ...o, state: 'failed', error: action.error } : o) };
    case 'outbox.retry': return { ...store, outbox: store.outbox.map(o => o.clientMessageId === action.clientMessageId ? { ...o, state: 'sending', error: undefined } : o) };
    case 'outbox.remove': return { ...store, outbox: store.outbox.filter(o => o.clientMessageId !== action.clientMessageId) };
    case 'outbox.sent': {
      const item = store.outbox.find(o => o.clientMessageId === action.clientMessageId);
      const outbox = store.outbox.filter(o => o.clientMessageId !== action.clientMessageId);
      const { result } = action;
      const queueStates = { ...store.queueStates, [result.messageId]: result.queueState };
      const activeTurnId = result.turnId && !store.doneTurns.includes(result.turnId) && result.queueState === 'accepted' ? result.turnId : store.activeTurnId;
      if (!item || store.messages.some(m => m.id === result.messageId)) return { ...store, outbox, queueStates, activeTurnId };
      // The reply may stream in before the POST returns; the message still belongs where it was sent.
      const message: StudioDialogueMessage = { id: result.messageId, threadId: store.thread?.id || '', seq: (item.afterSeq ?? store.latestSeq) + .5, turnId: result.turnId, runId: result.runId, role: 'user',
        text: item.text, blocks: [], pinnedNodeIds: item.pinnedNodeIds, attachmentNodeIds: item.attachmentNodeIds, clientMessageId: item.clientMessageId,
        status: result.queueState === 'queued' ? 'queued' : result.queueState === 'applied' ? 'applied' : 'done', createdAt: action.createdAt || item.createdAt };
      return { ...store, outbox, queueStates, activeTurnId, messages: sortMessages([...store.messages, message]), localMessageIds: [...store.localMessageIds, message.id] };
    }
    case 'execution': {
      // Read: whatever it says, the conversation no longer waits for it.
      const settled = store.awaitingExecutionId === action.execution.id ? { ...store, awaitingExecutionId: undefined } : store;
      // The session drops answers of a conversation it left; this is the second check, on the data itself (Codex review
      // 2026-10-20: a late read put the old conversation's execution into the new one and locked it as 「进行中」).
      // An execution without a thread (older records) has nothing to compare and is kept.
      if (store.thread && action.execution.threadId && action.execution.threadId !== store.thread.id) return settled;
      return { ...settled, execution: newerExecution(settled.execution, action.execution) };
    }
    case 'execution.unavailable':
      return store.awaitingExecutionId === action.executionId ? { ...store, awaitingExecutionId: undefined } : store;
    case 'approval.local': {
      const found = findBlock(store, isApproval(action.approvalId));
      if (!found) return store;
      return replaceMessage(store, found.messageId, m => ({ ...m, blocks: m.blocks.map(b => b.type === 'approval' && b.approvalId === action.approvalId
        ? { ...b, status: action.status, executionId: action.executionId ?? b.executionId,
            ...(action.approved && b.approvedBudgetCap === undefined ? { approvedBudgetCap: action.approved.budgetCap, approvedAutoFixCap: action.approved.autoFixCap } : {}) } : b) }));
    }
    case 'adoption.add': {
      const message = store.messages.find(m => m.id === action.messageId);
      if (!message || message.blocks.some(b => b.type === 'adoption' && b.nodeId === action.block.nodeId && b.field === action.block.field && b.content === action.block.content)) return store;
      return upsertBlock(store, action.messageId, action.block, () => false);
    }
    case 'canvas.ack': {
      const canvasOps = store.canvasOps.filter(op => op.seq > action.seq);
      // Nothing left to project: everything seen so far is on the canvas.
      return { ...store, canvasOps, canvasAckSeq: Math.max(store.canvasAckSeq, action.seq, canvasOps.length ? 0 : store.canvasSeq) };
    }
    case 'canvas.unsaved':
      return store.canvasUnsavedFrom === action.fromSeq ? store : { ...store, canvasUnsavedFrom: action.fromSeq };
    case 'older': {
      if (action.threadId && action.threadId !== store.thread?.id) return store;
      const ids = new Set(store.messages.map(m => m.id));
      const fresh = action.messages.filter(m => !ids.has(m.id) && (!store.thread || m.threadId === store.thread.id));
      return { ...store, messages: sortMessages([...fresh, ...store.messages]), hasOlder: action.messages.length >= action.limit };
    }
  }
}

// ── Selectors ──────────────────────────────────────────────────────────────

/** The cursor for (re)subscribing: the older of message and canvas progress, so replays reach both. */
export const dialogueCursor = (store: DialogueStore) => Math.min(store.latestSeq, store.canvasSeq);

/** Still replaying history onto a canvas that had no projection record on this browser. */
export const canvasRestoring = (store: DialogueStore) => store.restoreThroughSeq > store.canvasAckSeq;

/**
 * The canvas cursor worth saving for this viewer. Nothing while a restore replay is unfinished: a partial cursor
 * would make the next open replay the rest as ordinary commands instead of restores.
 */
export const persistableCanvasCursor = (store: DialogueStore) => {
  if (!store.thread || canvasRestoring(store) || !store.canvasAckSeq) return undefined;
  // Commands projected but not saved yet must replay on the next open: keep the cursor just below the first of them.
  // 0 is a real cursor ("replay everything as live commands"), not "none": "none" means a first open on this browser,
  // which replays in restore mode, and restore mode only rebuilds execution output. An unsaved node from the thread's
  // first events was therefore lost for good once the tab closed (Codex retest 2026-10-19, R2).
  const cursor = store.canvasUnsavedFrom === undefined ? store.canvasAckSeq : Math.min(store.canvasAckSeq, store.canvasUnsavedFrom - 1);
  return cursor >= 0 ? cursor : undefined;
};

/** Executions this thread started, newest first, from the approval cards that started them. */
export function approvedExecutionIds(store: DialogueStore): string[] {
  const ids: string[] = [];
  for (const m of [...store.messages].reverse()) for (const b of m.blocks)
    if (b.type === 'approval' && b.status === 'approved' && b.executionId && !ids.includes(b.executionId)) ids.push(b.executionId);
  return ids;
}

/**
 * What a confirmed card actually authorized: the server's approval snapshot, else that execution's budget for the
 * stage. Never the proposal; undefined when the card is not approved, {} when the numbers are not known here.
 */
export function approvedCaps(block: DialogueApprovalBlock, executions: (StudioPlanExecution | undefined)[]): { budgetCap?: number; autoFixCap?: number; approvedAt?: string; planRevision?: number } | undefined {
  if (block.status !== 'approved') return undefined;
  const when = { approvedAt: block.approvedAt, planRevision: block.approvedPlanRevision };
  if (block.approvedBudgetCap !== undefined) return { budgetCap: block.approvedBudgetCap, autoFixCap: block.approvedAutoFixCap, ...when };
  const budget = executions.find(e => !!e && e.id === block.executionId)?.budgets.find(b => b.stage === block.stage);
  return budget ? { budgetCap: budget.approvedCap, autoFixCap: budget.autoFixCap, ...when } : when;
}

export function dialogueSections(store: DialogueStore) {
  const legacy = store.messages.filter(m => !!m.legacyNodeId);
  const current = store.messages.filter(m => !m.legacyNodeId);
  return { legacy, current };
}

export function lastAssistantMessage(store: DialogueStore) {
  return [...store.messages].reverse().find(m => m.role === 'assistant' && !m.legacyNodeId);
}

/** The plan revision an approval card was quoted for; a newer revision never borrows an older approval. */
export function planForApproval(store: DialogueStore, approval: DialogueApprovalBlock): DialoguePlanBlock | undefined {
  let found: DialoguePlanBlock | undefined;
  for (const m of store.messages) for (const b of m.blocks)
    if (b.type === 'plan' && b.fingerprint === approval.planFingerprint && (!found || b.revision > found.revision)) found = b;
  return found;
}

export const executionActive = (execution?: StudioPlanExecution) => !!execution && ['running', 'paused', 'needs_user'].includes(execution.status);

export function executionBudget(store: DialogueStore) {
  const execution = store.execution;
  if (!execution) return undefined;
  const live = store.budgets[`${execution.id}:${execution.stage}`];
  const saved = execution.budgets.find(b => b.stage === execution.stage);
  return live ? { ...saved, ...live, autoFixCap: saved?.autoFixCap ?? 0 } : saved;
}

/**
 * Follow-ups under a message: the turn.done ones and those saved on the message (an execution's completion summary keeps
 * them across reloads). The same suggestion from both sources shows once; at most three.
 */
export function messageSuggestions(store: DialogueStore, message: StudioDialogueMessage): string[] | undefined {
  const list = [...new Set([...(store.suggestions[message.id] || []), ...(message.suggestions || [])].map(s => s.trim()).filter(Boolean))].slice(0, 3);
  return list.length ? list : undefined;
}

/** Where a sent message stands; the bubble shows it as a small icon (the words live in StudioDialogueQueueMark only). */
export function messageQueueState(store: DialogueStore, message: StudioDialogueMessage): DialogueQueueState | undefined {
  if (message.role !== 'user') return undefined;
  const local = store.queueStates[message.id];
  const state = message.status === 'queued' ? 'queued' : message.status === 'applied' ? 'applied' : local;
  // 「已收到」只在回复开始之前有意义；回复一出来气泡就恢复干净（画布页改版设计稿：你的话只是一个气泡）。
  const answered = state === 'accepted' && store.messages.some(m => m.role !== 'user' && m.seq > message.seq);
  return state === 'queued' || state === 'applied' ? state : state === 'accepted' && !answered ? 'accepted' : undefined;
}

/**
 * What the assistant is doing right now, read only from the stream (never invented):
 * - `waiting`: the turn is accepted but nothing has come back yet;
 * - `tool`: a reported tool call is running (`tool` is that block);
 * - `writing`: reply text is streaming in;
 * - `continuing`: a tool finished and the turn is still open, so the model is working on what comes next.
 * Undefined when no turn is active, or when the turn's last item is a card (plan / confirmation / question): the card
 * itself is the state then. A finished, failed or stopped message ends it.
 */
export type DialogueActivity =
  | { phase: 'waiting'; messageId?: string }
  | { phase: 'tool'; messageId: string; tool: DialogueToolBlock }
  | { phase: 'writing' | 'continuing'; messageId: string };

export function dialogueActivity(store: DialogueStore): DialogueActivity | undefined {
  // Every reply still open, newest first. Not only the active turn's: a background production summary (EXS-) takes over
  // activeTurnId while it streams and clears it when it ends, which would hide the reply the user is waiting for (Codex
  // review 2026-10-20). A reply only seen in a snapshot counts when its turn is the thread's active one, so a message the
  // server left 「streaming」 after a crash does not spin forever.
  const open = store.messages.filter(m => m.role === 'assistant' && !m.legacyNodeId && m.status === 'streaming'
    && !(m.turnId && store.doneTurns.includes(m.turnId)) && (m.turnId === store.activeTurnId || !!store.layouts[m.id]));
  for (const message of [...open].reverse()) {
    const activity = messageActivity(store, message);
    if (activity) return activity;
  }
  // Accepted, and nothing of that turn has come back yet.
  const waiting = (turnId?: string) => !!turnId && !store.doneTurns.includes(turnId) && !store.turnMessages[turnId];
  if (waiting(store.activeTurnId) || store.messages.some(m => m.role === 'user' && store.queueStates[m.id] === 'accepted' && waiting(m.turnId))) return { phase: 'waiting' };
  return undefined;
}

function messageActivity(store: DialogueStore, message: StudioDialogueMessage): DialogueActivity | undefined {
  const running = [...message.blocks].reverse().find((b): b is DialogueToolBlock => b.type === 'tool_call' && b.status === 'running');
  if (running) return { phase: 'tool', messageId: message.id, tool: running };
  // A message read from a snapshot has no live layout yet: its text comes first, then its blocks.
  const order = store.layouts[message.id]?.order ?? [...(message.text ? ['t:__base'] : []), ...message.blocks.map(b => `b:${blockKey(b)}`)];
  const lastKey = order[order.length - 1];
  if (!lastKey) return { phase: 'waiting', messageId: message.id };
  if (lastKey.startsWith('t:')) return { phase: 'writing', messageId: message.id };
  const block = message.blocks.find(b => `b:${blockKey(b)}` === lastKey);
  return block?.type === 'tool_call' ? { phase: 'continuing', messageId: message.id } : undefined;
}

/**
 * A question (and the follow-ups under a reply) is closed once the user said something after it: a later message in the
 * thread, or one on its way now. The server does not mark questions itself, and a chip must not answer twice.
 * - A message sent while that turn was still running is queued / applied into the turn; it is steering, not an answer
 *   to a question the turn only asks later.
 * - Outbox entries carry an event cursor, not a message number, so they are not compared with `seq` (Codex review
 *   2026-10-20): only a message being sent now, after this reply finished, counts.
 */
export function answeredAfter(store: DialogueStore, message: StudioDialogueMessage): StudioDialogueMessage | DialogueOutboxItem | undefined {
  return store.messages.find(m => m.role === 'user' && !m.legacyNodeId && m.seq > message.seq && m.status !== 'queued' && m.status !== 'applied')
    || (message.status === 'streaming' ? undefined : store.outbox.find(o => o.state === 'sending'));
}
