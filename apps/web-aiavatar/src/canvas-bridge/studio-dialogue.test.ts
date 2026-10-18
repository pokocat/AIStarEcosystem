import { describe, expect, test, vi } from 'vitest';
import type { StudioDialogueEvent, StudioDialogueState } from '@ai-star-eco/types/ip-studio-workflow';

vi.mock('@/ip/api/_client', async original => ({ ...(await original<typeof import('@/ip/api/_client')>()), USE_MOCK: false, API_BASE_URL: '/api', getAuthToken: () => 'token-1' }));
const { createSseParser, runDialogueStream } = await import('./studio-dialogue');

const event = (seq: number, type: StudioDialogueEvent['type'] = 'message.delta'): StudioDialogueEvent =>
  ({ eventId: `e${seq}`, seq, threadId: 'th', turnId: 't', createdAt: '2026-10-18T01:00:00Z', type, data: { messageId: 'm', partId: 'a', delta: String(seq) } });
const frame = (e: StudioDialogueEvent) => `id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
const snapshot: StudioDialogueState = { thread: { id: 'th', projectId: 'p', lastSeq: 9, createdAt: '2026-10-18T01:00:00Z', updatedAt: '2026-10-18T01:00:00Z' }, messages: [], latestSeq: 9 };

/** A fetch Response whose body yields the given chunks, then ends (or errors). */
function streamResponse(chunks: string[], { status = 200, breakAfter = false } = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  // Pull-based so a simulated drop happens after the chunks were read (error() discards a queue).
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++])); else if (breakAfter) controller.error(new TypeError('network')); else controller.close(); },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('createSseParser', () => {
  test('parses events split across chunks, CRLF across a boundary and multi-line data; ignores heartbeats', () => {
    const got: { id?: string; event?: string; data: string }[] = [];
    const parser = createSseParser(m => got.push(m));
    parser.push(': heartbeat\n\nid: 7\nevent: message.del');
    parser.push('ta\ndata: {"a":\r');
    parser.push('\ndata: 1}\r\n\r\n: ping\n\n');
    parser.push('data: tail');
    expect(got).toEqual([{ id: '7', event: 'message.delta', data: '{"a":\n1}' }]);
    parser.push('\n\n');
    expect(got[1]).toEqual({ id: undefined, event: undefined, data: 'tail' });
  });
});

describe('runDialogueStream', () => {
  const setup = (responses: (Response | Error)[], over: Partial<Parameters<typeof runDialogueStream>[0]> = {}) => {
    const controller = new AbortController();
    const calls: { url: string; init?: RequestInit }[] = [];
    let cursor = 0;
    const events: StudioDialogueEvent[] = [], snapshots: [StudioDialogueState, string][] = [], modes: string[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      if (!next) { controller.abort(); throw new DOMException('aborted', 'AbortError'); }
      if (next instanceof Error) throw next;
      return next;
    });
    const getSnapshot = vi.fn(async () => snapshot);
    const run = runDialogueStream({ projectId: 'p 1', threadId: 'th', cursor: () => cursor,
      onEvent: e => { events.push(e); cursor = e.seq; }, onSnapshot: (s, reason) => { snapshots.push([s, reason]); cursor = s.latestSeq; },
      onMode: m => modes.push(m), fetchImpl, getSnapshot, sleep: async () => {}, retryStreamEvery: 2, ...over }, controller.signal);
    return { run, calls, events, snapshots, modes, getSnapshot, controller };
  };

  test('sends auth and the cursor, and reconnects after a drop from the last applied seq', async () => {
    const t = setup([streamResponse([frame(event(1)), frame(event(2))], { breakAfter: true }), streamResponse([frame(event(3))])]);
    await t.run;
    expect(t.events.map(e => e.seq)).toEqual([1, 2, 3]);
    expect(t.calls[0].url).toBe('/api/v1/ip-studio/projects/p%201/conversations/th/events?afterSeq=0');
    const headers = t.calls[0].init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers.Accept).toBe('text/event-stream');
    expect(t.calls[1].url).toContain('afterSeq=2');
    expect((t.calls[1].init!.headers as Record<string, string>)['Last-Event-ID']).toBe('2');
    expect(t.calls[0].url).not.toContain('token');
    expect(t.modes).toContain('live');
  });

  test('a 410 rebuilds from a fresh snapshot and resubscribes from its cursor', async () => {
    const t = setup([new Response('{}', { status: 410 }), streamResponse([frame(event(10))])]);
    await t.run;
    expect(t.snapshots).toEqual([[snapshot, 'expired']]);
    expect(t.calls[1].url).toContain('afterSeq=9');
    expect(t.events.map(e => e.seq)).toEqual([10]);
  });

  test('after three failures it polls the snapshot, then returns to the stream', async () => {
    const t = setup([new TypeError('offline'), new Response('', { status: 502 }), new TypeError('offline'), streamResponse([frame(event(11))])]);
    await t.run;
    expect(t.modes).toContain('reconnecting');
    expect(t.modes).toContain('polling');
    // retryStreamEvery=2 → two polls, then one stream attempt.
    expect(t.getSnapshot).toHaveBeenCalledTimes(2);
    expect(t.snapshots.every(([, reason]) => reason === 'poll')).toBe(true);
    expect(t.calls[3].url).toContain('afterSeq=9');
    expect(t.events.map(e => e.seq)).toEqual([11]);
  });

  test('malformed frames and heartbeats are not events', async () => {
    const t = setup([streamResponse([': keep-alive\n\n', 'data: not json\n\n', `data: ${JSON.stringify({ hello: 1 })}\n\n`, frame(event(4))])]);
    await t.run;
    expect(t.events.map(e => e.seq)).toEqual([4]);
  });

  test('an unauthorized stream lets the API layer refresh the session before retrying', async () => {
    const t = setup([new Response('', { status: 401 }), streamResponse([frame(event(1))])]);
    await t.run;
    expect(t.getSnapshot).toHaveBeenCalledTimes(1);
    expect(t.events.map(e => e.seq)).toEqual([1]);
  });
});
