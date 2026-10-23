// @vitest-environment jsdom
// 「新对话」「历史对话」（docs/ip-studio-new-canvas-and-threads.md §3）：assistant header buttons, the history list, switching
// the timeline, the busy rule, Escape inside the list, and the demo mode's three endpoints (same semantics as the server).
// The panel and antd's Popover are the real ones here; fixtures follow the server DTOs (AGENTS.md §8.0.1 ⑦).
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StudioDialogueEvent, StudioDialogueMessage, StudioDialogueState, StudioDialogueThreadSummary, StudioSkillSummary } from '@ai-star-eco/types/ip-studio-workflow';
import { ApiError } from '@ai-star-eco/api-client';
import { ConfigProvider } from 'antd';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { DialogueStreamOptions } from '@/canvas-bridge/studio-dialogue';
import { formatDateTime } from '@/lib/datetime';
import { StudioAssistant } from './studio-assistant';
import { DIALOGUE_THREAD_BUSY } from './studio-dialogue-session';
import { DIALOGUE_ALREADY_NEW } from './studio-dialogue-threads';
import {
  mockDialogueControl, mockDialogueConversation, mockDialogueCreateThread, mockDialogueOpenThread, mockDialoguePost, mockDialogueThreadSnapshot, mockDialogueThreads, mockDialogueTiming, resetMockDialogue,
} from './mocks/studio-dialogue';

const api = vi.hoisted(() => ({
  getConversation: vi.fn(), post: vi.fn(), subscribe: vi.fn(), control: vi.fn(), branch: vi.fn(), list: vi.fn(), threads: vi.fn(), createThread: vi.fn(), openThread: vi.fn(),
  getExecution: vi.fn(), save: vi.fn(), getRun: vi.fn(), skills: vi.fn(), success: vi.fn(),
}));
vi.mock('@/canvas-bridge/studio-dialogue', () => ({ getStudioConversation: api.getConversation, postStudioDialogueMessage: api.post, subscribeStudioDialogue: api.subscribe,
  controlStudioDialogue: api.control, branchStudioDialogue: api.branch, listStudioDialogueMessages: api.list,
  listStudioDialogueThreads: api.threads, createStudioDialogueThread: api.createThread, openStudioDialogueThread: api.openThread,
  // Catch-up reads of the conversation shown (read only, by id) answer like the conversation fixture.
  getStudioDialogueThread: (projectId: string) => api.getConversation(projectId) }));
vi.mock('@/canvas-bridge/studio-plan-execution', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-plan-execution')>()), getStudioPlanExecution: api.getExecution }));
vi.mock('@/canvas-bridge/studio-skills', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-skills')>()),
  loadStudioSkills: () => api.skills(), reloadStudioSkills: () => api.skills() }));
vi.mock('@/proto/api', () => ({ useIdentity: () => ({ operatorRole: null }), isOperatorRole: () => false }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: api.save }));
vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioStory: vi.fn(), importStudioMedia: vi.fn(), submitStudioRun: vi.fn() }));
vi.mock('@/canvas-bridge/api', () => ({ readRun: vi.fn() }));
vi.mock('@/ip/api/ip-studio', async original => ({ ...(await original<typeof import('@/ip/api/ip-studio')>()), getRun: api.getRun }));
vi.mock('./studio-conversation-share', () => ({ StudioConversationShare: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: () => null }));
vi.mock('./library-reference-picker', () => ({ LibraryReferencePicker: () => null }));
// The real Popover; only the inputs the assistant renders are reduced to plain elements.
vi.mock('antd', async original => ({ ...(await original<typeof import('antd')>()),
  App: { useApp: () => ({ message: { success: api.success, error: vi.fn() }, modal: { confirm: vi.fn() }, notification: {} }) },
  Button: ({ loading, icon, danger: _danger, size: _size, type: _type, autoInsertSpace: _a, ...p }: any) => <button {...p} disabled={p.disabled || loading}>{icon}{p.children}</button>,
  Input: { TextArea: forwardRef(({ autoSize: _autoSize, ...p }: any, ref) => { const el = useRef<HTMLTextAreaElement>(null); useImperativeHandle(ref, () => ({ focus: () => el.current?.focus() })); return <textarea ref={el} {...p}/>; }) },
  Select: ({ options, value, onChange, popupMatchSelectWidth: _p, variant: _v, size: _s, ...p }: any) => <select {...p} value={value || ''} onChange={e => onChange(e.target.value || undefined)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));

const at = '2026-10-20T02:00:00Z';
const thread = (id: string, extra: Partial<StudioDialogueState['thread']> = {}): StudioDialogueState['thread'] => ({ id, projectId: 'p', lastSeq: 2, createdAt: at, updatedAt: at, ...extra });
const message = (threadId: string, id: string, seq: number, role: 'user' | 'assistant', text: string): StudioDialogueMessage =>
  ({ id, threadId, seq, role, text, blocks: [], status: 'done', createdAt: at, ...(role === 'assistant' ? { turnId: `turn-${id}` } : {}) });
const talked: StudioDialogueState = { thread: thread('th'), latestSeq: 2,
  messages: [message('th', 'u1', 1, 'user', '复刻这条视频，换成我的洗衣液'), message('th', 'a1', 2, 'assistant', '好的，我先看一下这条视频。')] };
const poster: StudioDialogueState = { thread: thread('th2', { parentThreadId: 'th', branchFromMessageId: 'u1' }), latestSeq: 2,
  messages: [message('th2', 'u9', 1, 'user', '画一张洗衣液海报'), message('th2', 'a9', 2, 'assistant', '海报方案在这里。')] };
const fresh: StudioDialogueState = { thread: thread('th-new', { lastSeq: 0 }), latestSeq: 0, messages: [] };
// Shaped like StudioDialogueDtos.ThreadSummary: the title is the server's (first user message, at most 24 characters plus 「…」).
const summaries: StudioDialogueThreadSummary[] = [
  { id: 'th', title: '复刻这条视频，换成我的洗衣液', messageCount: 2, lastActivityAt: '2026-10-20T02:10:00Z', createdAt: at, current: true, active: false },
  { id: 'th2', title: '画一张洗衣液海报，蓝色背景，左边放商品，右边写三个卖…', parentThreadId: 'th', messageCount: 4, lastActivityAt: '2026-10-19T12:30:05Z', createdAt: '2026-10-19T12:00:00Z', current: false, active: false },
];
const skill = (key: string, name: string): StudioSkillSummary => ({ key, name, version: 1, status: 'active', planning: 'dynamic', summary: `${name}的说明`, methodExamples: [],
  operations: { analysis: ['text'], production: ['text', 'video'] }, limits: { maxSourceSec: 60, maxSegments: 4, maxSegmentSec: 'model', maxSteps: 16, maxAutoFixPerSegment: 1 },
  checks: [], autoFixChecks: [], requiredCapabilities: [] });
const capabilities = { mock: false, operations: ['assistant'], imageCost: 8, textCost: 2, videoCost: null, textModelMode: 'selectable' as const,
  textModels: [{ endpointId: 'one', name: '模型一', isDefault: true, dialogueTokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 1048576, maxOutputTokens: 65536, maxCost: 260 }, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 20.4 } },
    { endpointId: 'two', name: '模型二', isDefault: false, dialogueTokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 524288, maxOutputTokens: 32768, maxCost: 130 }, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 8 } }] };
const character = { id: 'c', type: 'image', title: '角色 A', position: { x: 20, y: 20 }, width: 320, height: 400, metadata: { prompt: '紫发角色' } } as CanvasNodeData;

let streams: DialogueStreamOptions[] = [];
let seq = 2;
const ev = <T,>(type: StudioDialogueEvent['type'], data: T): StudioDialogueEvent<T> => ({ eventId: `e${++seq}`, seq, threadId: 'th', turnId: 't2', createdAt: at, type, data });
const emit = (...events: StudioDialogueEvent[]) => act(() => { for (const e of events) streams.at(-1)!.onEvent(e); });
const composer = () => screen.getByRole('textbox', { name: '给创作助手的消息' }) as HTMLTextAreaElement;
const headerButton = (name: string) => within(screen.getByRole('dialog', { name: '创作助手' }).querySelector('header')!).getByRole('button', { name }) as HTMLButtonElement;
const historyList = () => screen.findByRole('region', { name: '历史对话' });
const modeLabel = () => within(screen.getByRole('dialog', { name: '创作助手' }).querySelector('header')!).getAllByRole('button').find(b => b.getAttribute('aria-controls') === 'studio-assistant-guide')!;

// jsdom never ends a CSS transition, so antd's leave motion would keep a closed popup in the page; switch motion off.
function Host({ onClose = () => {}, ...props }: any) {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([character]), [conversations, setConversations] = useState<CanvasNodeData[]>([]);
  return <ConfigProvider theme={{ token: { motion: false } }}>
    <StudioAssistant projectId="p" open conversations={conversations} setConversations={setConversations} nodes={nodes} setNodes={setNodes} setConnections={() => {}}
      connections={[]} capabilities={capabilities} onClose={onClose} selectedIds={[]} onUseStep={() => {}} {...props}/>
  </ConfigProvider>;
}
async function ready(ui = <Host/>) {
  const view = render(ui);
  await waitFor(() => expect(api.subscribe).toHaveBeenCalled());
  return view;
}

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); streams = []; seq = 2;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const stage = document.createElement('div'); stage.dataset.studioFloatingRoot = ''; document.body.append(stage);
  api.getConversation.mockResolvedValue(talked);
  api.subscribe.mockImplementation((options: DialogueStreamOptions) => { streams.push(options); return () => {}; });
  api.save.mockResolvedValue(undefined);
  api.threads.mockResolvedValue(summaries);
  api.getRun.mockRejectedValue(new Error('没有这次运行'));
  api.skills.mockResolvedValue([]);
});
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals(); });

test('the history list shows every conversation with its time and size, marks the current one, and a row opens that conversation', async () => {
  api.openThread.mockResolvedValue(poster);
  await ready();
  expect(screen.getByText('好的，我先看一下这条视频。')).toBeDefined();
  fireEvent.click(headerButton('历史对话'));
  const list = await historyList();
  expect(api.threads).toHaveBeenCalledWith('p');
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  const current = within(rows[0]).getByRole('button');
  expect(current.getAttribute('aria-current')).toBe('true');
  expect(within(current).getByText('当前')).toBeDefined();
  expect(within(current).getByText(`${formatDateTime('2026-10-20T02:10:00Z')} · 2 条消息`)).toBeDefined();
  // One line with an ellipsis on screen; the whole name is in the tooltip. Times are absolute, never 「N 小时前」.
  const name = within(rows[1]).getByText(summaries[1].title);
  expect(name.getAttribute('title')).toBe(summaries[1].title);
  expect(name.className).toBe('studio-dialogue-thread-title');
  expect(within(rows[1]).getByText('重新开始')).toBeDefined();
  expect(within(rows[1]).getByText(`${formatDateTime('2026-10-19T12:30:05Z')} · 4 条消息`)).toBeDefined();
  expect(list.textContent).not.toMatch(/(分钟|小时|天)前/);
  expect(within(list).queryByText('还没有别的对话')).toBeNull();

  fireEvent.click(within(rows[1]).getByRole('button'));
  await waitFor(() => expect(api.openThread).toHaveBeenCalledWith('p', 'th2'));
  // Same switch as 「从这里重新开始」: the snapshot replaces the timeline and the stream follows the new conversation.
  expect(await screen.findByText('海报方案在这里。')).toBeDefined();
  expect(screen.queryByText('好的，我先看一下这条视频。')).toBeNull();
  await waitFor(() => expect(streams.at(-1)!.threadId).toBe('th2'));
  await waitFor(() => expect(screen.queryByRole('region', { name: '历史对话' })).toBeNull());
  expect(api.createThread).not.toHaveBeenCalled();
});

test('with only the current conversation the list says so, and a failed read can be retried', async () => {
  api.threads.mockRejectedValueOnce(new ApiError({ code: 'NETWORK', message: '网络断了' }, 0)).mockResolvedValueOnce([summaries[0]]);
  await ready();
  fireEvent.click(headerButton('历史对话'));
  const list = await historyList();
  expect(await within(list).findByText('对话列表没有读取成功。')).toBeDefined();
  fireEvent.click(within(list).getByRole('button', { name: '重试' }));
  expect(await within(list).findByText('还没有别的对话')).toBeDefined();
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
});

test('while a reply is still coming neither a new conversation nor a switch is possible, and the reason is said', async () => {
  await ready();
  fireEvent.click(headerButton('历史对话'));
  const list = await historyList();
  await within(list).findAllByRole('listitem');
  const other = () => within(list).getAllByRole('button').find(b => b.textContent?.includes('画一张洗衣液海报'))! as HTMLButtonElement;
  expect(other().disabled).toBe(false);
  emit(ev('message.delta', { messageId: 'a2', partId: 'p', delta: '我再想想' }));
  expect(other().disabled).toBe(true);
  expect(other().title).toBe(DIALOGUE_THREAD_BUSY);
  expect(within(list).getByText(DIALOGUE_THREAD_BUSY)).toBeDefined();
  expect((within(list).getByRole('button', { name: '新对话' }) as HTMLButtonElement).disabled).toBe(true);
  expect(headerButton('新对话').disabled).toBe(true);
  expect(headerButton('新对话').title).toBe(DIALOGUE_THREAD_BUSY);
  fireEvent.click(other());
  expect(api.openThread).not.toHaveBeenCalled();
  emit(ev('turn.done', { reason: 'completed', messageId: 'a2' }));
  expect(other().disabled).toBe(false);
  expect(headerButton('新对话').disabled).toBe(false);
});

test('an execution that is paused keeps both buttons closed too', async () => {
  const execution = { id: 'e1', projectId: 'p', threadId: 'th', skillKey: 'k', skillVersion: 1, stage: 'production' as const, planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'paused' as const,
    steps: [{ id: 'v1', title: '第 1 段', operation: 'video' as const, stage: 'production' as const, dependsOn: [], status: 'pending' as const, runIds: [], attempt: 0, quotedCost: 40 }],
    budgets: [{ stage: 'production' as const, approvedCap: 60, autoFixCap: 0, spent: 0, inFlight: 0, remaining: 60 }], startedAt: at, deadlineAt: at, updatedAt: at };
  api.getConversation.mockResolvedValue({ ...talked, thread: thread('th', { activeExecutionId: 'e1' }), execution });
  await ready();
  for (const name of ['新对话', '历史对话']) {
    expect(headerButton(name).disabled).toBe(true);
    expect(headerButton(name).title).toBe(DIALOGUE_THREAD_BUSY);
  }
});

test('an empty conversation is already new: 新对话 is off and says why', async () => {
  api.getConversation.mockResolvedValue(fresh);
  await ready();
  expect(screen.getByText('想做点什么？')).toBeDefined();
  expect(headerButton('新对话').disabled).toBe(true);
  expect(headerButton('新对话').title).toBe(DIALOGUE_ALREADY_NEW);
  expect(headerButton('历史对话').disabled).toBe(false);
});

// 2026-10-21: nothing under the composer shows or changes the skill or the model. The model this browser remembered for
// the canvas stays across the switch; the method shows in the header label and follows the conversation shown.
test('新对话 empties the timeline and brings the opening cards back; the draft and the model stay, the method label returns to 全能创作, a lost answer retries the same key', async () => {
  api.skills.mockResolvedValue([skill('video-recreation', '短视频复刻'), skill('talking-head-seeding', '口播种草')]);
  api.getConversation.mockResolvedValue({ ...talked, thread: thread('th', { skillKey: 'video-recreation', skillVersion: 1 }) });
  api.post.mockResolvedValueOnce({ messageId: 'u3', turnId: 't3', queueState: 'accepted' });
  localStorage.setItem('studio-assistant:model:p', 'two');
  await ready();
  await waitFor(() => expect(modeLabel().textContent).toBe('短视频复刻'));
  expect(screen.queryByLabelText('技能')).toBeNull();
  expect(screen.queryByLabelText('助手模型')).toBeNull();
  fireEvent.change(composer(), { target: { value: '下一条想说的' } });
  expect(screen.queryByText('想做点什么？')).toBeNull();

  api.createThread.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(fresh);
  fireEvent.click(headerButton('新对话'));
  await waitFor(() => expect(api.createThread).toHaveBeenCalledTimes(1));
  // Not switched: the old conversation is still there.
  await waitFor(() => expect(headerButton('新对话').disabled).toBe(false));
  expect(screen.getByText('好的，我先看一下这条视频。')).toBeDefined();
  fireEvent.click(headerButton('新对话'));
  await waitFor(() => expect(api.createThread).toHaveBeenCalledTimes(2));
  const [first, second] = api.createThread.mock.calls;
  expect(first[0]).toBe('p');
  expect(first[1]).toEqual({ clientRequestId: expect.stringMatching(/^[A-Za-z0-9_.:-]{1,64}$/) });
  expect(second[1].clientRequestId).toBe(first[1].clientRequestId);

  expect(await screen.findByText('想做点什么？')).toBeDefined();
  expect(screen.queryByText('好的，我先看一下这条视频。')).toBeNull();
  await waitFor(() => expect(streams.at(-1)!.threadId).toBe('th-new'));
  expect(composer().value).toBe('下一条想说的');
  expect(modeLabel().textContent).toBe('全能创作');
  expect(headerButton('新对话').disabled).toBe(true);
  expect(headerButton('新对话').title).toBe(DIALOGUE_ALREADY_NEW);
  // The remembered model goes with its own ceiling into the new conversation; no skill rides along.
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '下一条想说的', model: 'two', maxCost: 130 });
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('skillKey');
});

test('Escape inside the history list closes the list only; the assistant stays open', async () => {
  const onClose = vi.fn();
  await ready(<Host onClose={onClose}/>);
  fireEvent.click(headerButton('历史对话'));
  const list = await historyList();
  const row = (await within(list).findAllByRole('button')).find(b => b.getAttribute('aria-current') === 'true')!;
  row.focus();
  fireEvent.keyDown(row, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('region', { name: '历史对话' })).toBeNull());
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: '创作助手' })).toBeDefined();
  // Focus went back to 「历史对话」 in the header; the panel's own Escape rule is untouched.
  expect(document.activeElement).toBe(headerButton('历史对话'));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

// ── Demo mode: the three endpoints behave like StudioDialogueController ─────────────────────
test('demo mode: list, create (reusing an unused empty one, same key same thread) and open follow the server', async () => {
  resetMockDialogue(); mockDialogueTiming.tickMs = 0;
  const main = await mockDialogueConversation('demo');
  const empty = await mockDialogueThreads('demo');
  expect(empty).toEqual([expect.objectContaining({ id: main.thread.id, title: '新对话', messageCount: 0, current: true, active: false })]);
  // Nothing said yet: 「新对话」 hands back the same empty conversation.
  expect((await mockDialogueCreateThread('demo', { clientRequestId: 'k0' })).thread.id).toBe(main.thread.id);

  const said = '帮我复刻这条洗衣液广告视频，保留最后那个反转，口播改成介绍新品';
  await mockDialoguePost('demo', main.thread.id, { clientMessageId: 'm1', text: `  ${said}  ` });
  const second = await mockDialogueCreateThread('demo', { clientRequestId: 'k1' });
  expect(second.thread.id).not.toBe(main.thread.id);
  expect(second.messages).toEqual([]);
  expect(second.thread.skillKey).toBeUndefined();
  expect((await mockDialogueCreateThread('demo', { clientRequestId: 'k1' })).thread.id).toBe(second.thread.id);
  expect((await mockDialogueCreateThread('demo', { clientRequestId: 'k2' })).thread.id).toBe(second.thread.id);
  expect((await mockDialogueConversation('demo')).thread.id).toBe(second.thread.id);

  const listed = await mockDialogueThreads('demo');
  expect(listed.map(t => t.id).sort()).toEqual([main.thread.id, second.thread.id].sort());
  const first = listed.find(t => t.id === main.thread.id)!;
  expect(first.title).toBe(`${Array.from(said).slice(0, 24).join('')}…`);
  expect(first.messageCount).toBeGreaterThanOrEqual(1);
  expect(first.current).toBe(false);
  expect(Number.isNaN(Date.parse(first.lastActivityAt))).toBe(false);
  expect(listed.find(t => t.id === second.thread.id)).toMatchObject({ title: '新对话', messageCount: 0, current: true });

  // Reading one conversation by its id (reconnects, polls) leaves the current one where it is; opening it moves it.
  const read = await mockDialogueThreadSnapshot('demo', main.thread.id);
  expect(read.thread.id).toBe(main.thread.id);
  expect((await mockDialogueConversation('demo')).thread.id).toBe(second.thread.id);
  await expect(mockDialogueThreadSnapshot('demo', 'nope')).rejects.toMatchObject({ code: 'STUDIO_THREAD_NOT_FOUND', status: 404 });
  const opened = await mockDialogueOpenThread('demo', main.thread.id);
  expect(opened.messages.some(m => m.role === 'user' && m.text.includes('洗衣液'))).toBe(true);
  expect((await mockDialogueConversation('demo')).thread.id).toBe(main.thread.id);
  // The empty one left behind is not listed any more; only conversations with messages plus the current one are.
  expect((await mockDialogueThreads('demo')).map(t => t.id)).toEqual([main.thread.id]);

  await expect(mockDialogueOpenThread('demo', 'nope')).rejects.toMatchObject({ code: 'STUDIO_THREAD_NOT_FOUND', status: 404 });
  await expect(mockDialogueCreateThread('demo', { clientRequestId: 'not a key!' })).rejects.toMatchObject({ code: 'STUDIO_INPUT_INVALID', status: 400 });
});

test('demo mode: a conversation that is still replying is listed as active and never reused', async () => {
  resetMockDialogue(); mockDialogueTiming.tickMs = 5000;
  const main = await mockDialogueConversation('busy');
  await mockDialoguePost('busy', main.thread.id, { clientMessageId: 'm1', text: '你好' });
  expect((await mockDialogueThreads('busy'))[0]).toMatchObject({ id: main.thread.id, active: true });
  await mockDialogueControl('busy', main.thread.id, { controlId: 'stop-1', action: 'stop' });
  expect((await mockDialogueThreads('busy'))[0]).toMatchObject({ id: main.thread.id, active: false });
  mockDialogueTiming.tickMs = 0;
});

// Codex 2026-10-21 (P2): replying 「可以」 confirmed the card on the server; the reply ended while the execution's detail was
// still on its way, and both buttons opened up in between. They stay closed, with the same reason, until it is read.
test('after a card is confirmed in words both buttons stay closed until the execution is read', async () => {
  const plan = { type: 'plan', planRunId: 'pr', revision: 1, fingerprint: 'f1', plan: { summary: '出一张海报', steps: [], questions: [] } } as unknown as StudioDialogueMessage['blocks'][number];
  const card = { type: 'approval', approvalId: 'ap1', stage: 'production', planFingerprint: 'f1', scope: ['海报'], quotedCost: 8, budgetCap: 12, autoFixCap: 0, status: 'pending' } as const;
  const withCard: StudioDialogueState = { ...talked, messages: [talked.messages[0], { ...talked.messages[1], blocks: [plan, card] }] };
  api.getConversation.mockResolvedValue(withCard);
  let read!: (execution: unknown) => void;
  api.getExecution.mockReturnValue(new Promise(resolve => { read = resolve; }));
  await ready();
  expect(headerButton('新对话').disabled).toBe(false);
  // The reply to 「可以」: the server confirmed the card inside it, then the reply ended.
  emit(ev('message.delta', { messageId: 'a2', partId: 'p', delta: '好的，开始制作。' }),
    { ...ev('approval.required', { messageId: 'a1', block: { ...card, status: 'approved', executionId: 'E1', approvedBudgetCap: 12, approvedAutoFixCap: 0, approvedAt: at } }), executionId: 'E1' },
    ev('turn.done', { reason: 'completed', messageId: 'a2' }));
  for (const name of ['新对话', '历史对话']) {
    expect(headerButton(name).disabled).toBe(true);
    expect(headerButton(name).title).toBe(DIALOGUE_THREAD_BUSY);
  }
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledWith('p', 'E1'));
  // A quick one, already finished when read: the conversation can be left now.
  await act(async () => { read({ id: 'E1', projectId: 'p', threadId: 'th', skillKey: 'image-generation', skillVersion: 1, stage: 'production', planRunId: 'pr', planRevision: 1,
    planFingerprint: 'f1', status: 'done', steps: [], budgets: [{ stage: 'production', approvedCap: 12, autoFixCap: 0, spent: 8, inFlight: 0, remaining: 4 }],
    startedAt: at, deadlineAt: at, updatedAt: at, finishedAt: at }); });
  await waitFor(() => expect(headerButton('新对话').disabled).toBe(false));
  expect(headerButton('历史对话').disabled).toBe(false);
});
