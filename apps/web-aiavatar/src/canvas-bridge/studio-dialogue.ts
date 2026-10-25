// Studio dialogue transport: thread snapshot, messages, control, branches and the
// authenticated event stream (specs/openapi.yaml /v1/ip-studio/projects/{id}/conversation*).
//
// EventSource cannot send the Authorization header, and tokens must never go into a URL,
// so the stream is a fetch() body read through a small SSE parser with the same auth as
// apiFetch. A dropped stream is not a cancellation: it reconnects from the last seq
// (afterSeq + Last-Event-ID), a 410 rebuilds from a fresh snapshot, and repeated failures
// fall back to polling the snapshot (polling never starts inference or spends credits).
import type {
  StudioBranchRequest, StudioCreateThreadRequest, StudioDialogueControlRequest, StudioDialogueEvent, StudioDialogueMessage, StudioDialogueState,
  StudioDialogueThreadSummary, StudioPostMessageRequest, StudioPostMessageResult,
} from '@ai-star-eco/types/ip-studio-workflow';
import type { EnterpriseBillingSelection } from '@ai-star-eco/types/enterprise';
import { sanitizeModelErrorFields } from '@ai-star-eco/api-client';
import { API_BASE_URL, USE_MOCK, apiFetch, getAuthToken } from '@/ip/api/_client';
import { withStudioBilling } from './studio-billing';
import {
  mockDialogueBranch, mockDialogueControl, mockDialogueConversation, mockDialogueCreateThread, mockDialogueMessages, mockDialogueOpenThread, mockDialoguePost,
  mockDialogueSubscribe, mockDialogueThreadSnapshot, mockDialogueThreads,
} from '@/ip/mocks/studio-dialogue';

const APP_CODE = 'aiavatar';

export async function getStudioConversation(projectId: string): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueConversation(projectId);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversation`);
}

// ── Conversations of one canvas (docs/ip-studio-new-canvas-and-threads.md §3) ──────────

/** This canvas's conversations of the signed-in user, newest activity first: the ones with messages plus the current one. */
export async function listStudioDialogueThreads(projectId: string): Promise<StudioDialogueThreadSummary[]> {
  if (USE_MOCK) return mockDialogueThreads(projectId);
  return apiFetch<StudioDialogueThreadSummary[]>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations`);
}

/** A new empty conversation becomes the current one (an unused empty one is reused). Free; the same key returns the same one. */
export async function createStudioDialogueThread(projectId: string, request: StudioCreateThreadRequest): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueCreateThread(projectId, request);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations`, { method: "POST", body: request });
}

/**
 * One conversation's snapshot by id, read only: the server's current conversation stays what it was. For reconnects, polls
 * and catch-up reads, which must never move the user (or another tab) to another conversation. Never a model call.
 */
export async function getStudioDialogueThread(projectId: string, threadId: string): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueThreadSnapshot(projectId, threadId);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}`);
}

/** The user opens one conversation (a row of 「历史对话」): it becomes the current one and its snapshot comes back. Never a model call. */
export async function openStudioDialogueThread(projectId: string, threadId: string): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueOpenThread(projectId, threadId);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/open`, { method: "POST" });
}

export async function listStudioDialogueMessages(projectId: string, threadId: string, opts: { beforeSeq?: number; limit?: number } = {}): Promise<StudioDialogueMessage[]> {
  if (USE_MOCK) return mockDialogueMessages(projectId, threadId, opts);
  return apiFetch<StudioDialogueMessage[]>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/messages`,
    { query: { beforeSeq: opts.beforeSeq, limit: opts.limit } });
}

/** The payer is chosen once per clientMessageId; retries of the same message reuse it. */
async function withMessageBilling(projectId: string, request: StudioPostMessageRequest): Promise<StudioPostMessageRequest> {
  if (request.billing) return request;
  const holder: { clientRequestId: string; operation: string; maxCost?: number; billing?: EnterpriseBillingSelection } =
    { clientRequestId: request.clientMessageId, operation: 'assistant', maxCost: request.maxCost };
  await withStudioBilling(projectId, holder, { operation: 'assistant', textUsage: true, expectedCost: request.maxCost });
  return holder.billing ? { ...request, billing: holder.billing } : request;
}

export async function postStudioDialogueMessage(projectId: string, threadId: string, request: StudioPostMessageRequest): Promise<StudioPostMessageResult> {
  if (USE_MOCK) return mockDialoguePost(projectId, threadId, request);
  const body = await withMessageBilling(projectId, request);
  return apiFetch<StudioPostMessageResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/messages`, { method: "POST", body });
}

export async function controlStudioDialogue(projectId: string, threadId: string, request: StudioDialogueControlRequest): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueControl(projectId, threadId, request);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/control`, { method: "POST", body: request });
}

export async function branchStudioDialogue(projectId: string, threadId: string, request: StudioBranchRequest): Promise<StudioDialogueState> {
  if (USE_MOCK) return mockDialogueBranch(projectId, threadId, request);
  return apiFetch<StudioDialogueState>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/branches`, { method: "POST", body: request });
}

// ── Server-sent events ─────────────────────────────────────────────────────

export interface SseMessage { id?: string; event?: string; data: string }

/** Incremental text/event-stream parser. Comment lines (": heartbeat") are ignored, never surfaced as progress. */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = '', data: string[] = [], id: string | undefined, event: string | undefined;
  const dispatch = () => {
    if (data.length) onMessage({ id, event, data: data.join('\n') });
    data = []; id = undefined; event = undefined;
  };
  const line = (text: string) => {
    if (text === '') { dispatch(); return; }
    if (text.startsWith(':')) return;
    const colon = text.indexOf(':');
    const field = colon < 0 ? text : text.slice(0, colon);
    let value = colon < 0 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'id') id = value;
    else if (field === 'event') event = value;
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      for (;;) {
        const index = buffer.search(/\r\n|\r|\n/);
        if (index < 0) return;
        // A trailing CR may be the first half of CRLF split across chunks.
        if (buffer[index] === '\r' && index === buffer.length - 1) return;
        const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
        const text = buffer.slice(0, index);
        buffer = buffer.slice(index + width);
        line(text);
      }
    },
  };
}

export type DialogueStreamMode = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'stopped';
export interface DialogueStreamOptions {
  projectId: string;
  threadId: string;
  /** Read on every (re)connect: the seq the client has already applied. */
  cursor: () => number;
  onEvent: (event: StudioDialogueEvent) => void;
  /** A fresh snapshot after a cursor expiry (rebuild) or while polling (merge by seq). Never called after unsubscribing. */
  onSnapshot: (state: StudioDialogueState, reason: 'expired' | 'poll') => void;
  onMode?: (mode: DialogueStreamMode) => void;
  fetchImpl?: typeof fetch;
  /** This thread's snapshot, read only (default: by its id). It must never make the thread the server's current one. */
  getSnapshot?: () => Promise<StudioDialogueState>;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  maxFailures?: number;
  pollIntervalMs?: number;
  /** While polling, try the stream again every N polls. */
  retryStreamEvery?: number;
}

const abortableSleep = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) { resolve(); return; }
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

type ConnectResult = 'aborted' | 'expired' | 'failed' | 'idle' | 'received';

/** Subscribe to one thread. Returns an unsubscribe function; unsubscribing never cancels server work. */
export function subscribeStudioDialogue(options: DialogueStreamOptions): () => void {
  if (USE_MOCK) {
    options.onMode?.('live');
    let stop = () => {};
    let open = true;
    const connect = () => {
      stop = mockDialogueSubscribe(options.projectId, options.threadId, options.cursor(), options.onEvent, () => {
        // Same as a 410: rebuild from a fresh snapshot, then follow from its cursor.
        void (options.getSnapshot?.() ?? mockDialogueThreadSnapshot(options.projectId, options.threadId)).then(state => { if (!open) return; options.onSnapshot(state, 'expired'); connect(); });
      });
    };
    connect();
    return () => { open = false; stop(); options.onMode?.('stopped'); };
  }
  const controller = new AbortController();
  void runDialogueStream(options, controller.signal);
  return () => controller.abort();
}

export async function runDialogueStream(options: DialogueStreamOptions, signal: AbortSignal): Promise<void> {
  const {
    projectId, threadId, cursor, onEvent, onSnapshot, onMode = () => {}, fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    getSnapshot = () => getStudioDialogueThread(projectId, threadId), sleep = abortableSleep, maxFailures = 3, pollIntervalMs = 4000, retryStreamEvery = 5,
  } = options;
  let failures = 0, polls = 0, idle = 0;
  const connect = async (): Promise<ConnectResult> => {
    const after = cursor();
    const token = getAuthToken();
    let res: Response;
    try {
      res = await fetchImpl(`${API_BASE_URL}/v1/ip-studio/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(threadId)}/events?afterSeq=${after}`, {
        method: 'GET', cache: 'no-store', credentials: 'include', signal,
        headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(after), 'X-App-Code': APP_CODE, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch { return signal.aborted ? 'aborted' : 'failed'; }
    if (res.status === 410) return 'expired';
    if (res.status === 401) {
      // apiFetch owns token refresh and the login redirect; the next connect reads the new token.
      await getSnapshot().catch(() => undefined);
      return 'failed';
    }
    if (!res.ok || !res.body) return 'failed';
    onMode('live');
    let received = 0;
    const parser = createSseParser(message => {
      if (!message.data) return;
      let event: StudioDialogueEvent;
      try { event = sanitizeModelErrorFields(JSON.parse(message.data)) as StudioDialogueEvent; } catch { return; }
      if (!event || typeof event.seq !== 'number' || typeof event.type !== 'string') return;
      received++;
      onEvent(event);
    });
    const reader = res.body.getReader(), decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      if (signal.aborted) return 'aborted';
      return received ? 'received' : 'failed';
    }
    return received ? 'received' : 'idle';
  };
  while (!signal.aborted) {
    const polling = failures >= maxFailures;
    if (polling) {
      onMode('polling');
      // Unsubscribing does not cancel a read already on its way; its answer belongs to a stream nobody follows any more.
      try { const state = await getSnapshot(); if (signal.aborted) return; onSnapshot(state, 'poll'); } catch { /* keep polling; the stream retry below may recover */ }
      await sleep(pollIntervalMs, signal);
      if (signal.aborted) return;
      polls++;
      if (polls % retryStreamEvery !== 0) continue;
    } else onMode(failures ? 'reconnecting' : 'connecting');
    const result = await connect();
    if (result === 'aborted' || signal.aborted) return;
    if (result === 'expired') {
      try { const state = await getSnapshot(); if (signal.aborted) return; onSnapshot(state, 'expired'); failures = 0; polls = 0; }
      catch { failures++; await sleep(Math.min(8000, 500 * 2 ** failures), signal); }
      continue;
    }
    if (result === 'received') { failures = 0; polls = 0; idle = 0; await sleep(250, signal); continue; }
    if (result === 'idle') {
      // The server closed an idle stream cleanly; back off without treating it as a failure.
      failures = 0; idle++; await sleep(Math.min(15000, 1000 * 2 ** Math.min(idle, 4)), signal); continue;
    }
    if (!polling) { failures++; if (failures < maxFailures) await sleep(Math.min(8000, 500 * 2 ** failures), signal); }
  }
}
