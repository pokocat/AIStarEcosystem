// @vitest-environment jsdom
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client';
import type { StudioDialogueEvent, StudioDialogueMessage, StudioDialogueState, StudioMessageBlock } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { DialogueStreamOptions } from '@/canvas-bridge/studio-dialogue';
import { StudioAssistant } from './studio-assistant';
import { STUDIO_CHECK_COMMAND } from '@/canvas-bridge/studio-plan-execution';

const api = vi.hoisted(() => ({
  getConversation: vi.fn(), post: vi.fn(), subscribe: vi.fn(), control: vi.fn(), branch: vi.fn(), list: vi.fn(),
  createExecution: vi.fn(), getExecution: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), accept: vi.fn(),
  save: vi.fn(), importStudioStory: vi.fn(), importStudioMedia: vi.fn(), submitStudioRun: vi.fn(), readRun: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/canvas-bridge/studio-dialogue', () => ({ getStudioConversation: api.getConversation, postStudioDialogueMessage: api.post, subscribeStudioDialogue: api.subscribe,
  controlStudioDialogue: api.control, branchStudioDialogue: api.branch, listStudioDialogueMessages: api.list }));
vi.mock('@/canvas-bridge/studio-plan-execution', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-plan-execution')>()),
  createStudioPlanExecution: api.createExecution, getStudioPlanExecution: api.getExecution, pauseStudioPlanExecution: api.pause, resumeStudioPlanExecution: api.resume,
  cancelStudioPlanExecution: api.cancel, acceptStudioPlanExecutionStep: api.accept }));
vi.mock('@/canvas-bridge/studio-skills', () => ({ loadStudioSkills: async () => [], studioSkillNotes: () => [] }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: api.save }));
vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioStory: api.importStudioStory, importStudioMedia: api.importStudioMedia, submitStudioRun: api.submitStudioRun }));
vi.mock('@/canvas-bridge/api', () => ({ readRun: api.readRun }));
vi.mock('./studio-floating-panel', () => ({ StudioFloatingPanel: ({ open, title, children, onClose, footer }: any) => open ? <section role="dialog" aria-label={title}><button aria-label={`关闭${title}`} onClick={onClose}>关闭</button>{children}{footer}</section> : null }));
vi.mock('./studio-conversation-share', () => ({ StudioConversationShare: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: ({ locked, reading, onFiles }: any) => <div><button disabled={locked}>{reading ? '正在导入附件' : '添加附件'}</button><input type="file" aria-label="上传创作附件" multiple onChange={e => onFiles(Array.from(e.target.files || []))}/></div> }));
vi.mock('./library-reference-picker', () => ({ LibraryReferencePicker: () => null }));
vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: api.success, error: api.error }, modal: { confirm: ({ onOk }: any) => onOk?.() } }) },
  Button: ({ loading, icon, danger: _danger, size: _size, ...p }: any) => <button {...p} disabled={p.disabled || loading}>{icon}{p.children}</button>,
  Input: { TextArea: forwardRef(({ autoSize: _autoSize, ...p }: any, ref) => { const el = useRef<HTMLTextAreaElement>(null); useImperativeHandle(ref, () => ({ focus: () => el.current?.focus() })); return <textarea ref={el} {...p}/>; }) },
  Select: ({ options, value, onChange, ...p }: any) => <select {...p} value={value || ''} onChange={e => onChange(e.target.value || undefined)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));

const at = '2026-10-18T01:00:00Z';
const thread = { id: 'th', projectId: 'p', lastSeq: 0, createdAt: at, updatedAt: at };
const emptyState: StudioDialogueState = { thread, messages: [], latestSeq: 0 };
const character = { id: 'c', type: 'image', title: '角色 A', position: { x: 20, y: 20 }, width: 320, height: 400, metadata: { prompt: '紫发角色' } } as CanvasNodeData;
const text = { ...character, id: 't', type: 'text', title: '台词 B', metadata: { content: '原台词', studio: { kind: 'text' } } } as CanvasNodeData;
const legacy = { ...text, id: 'h', title: '导演执导', metadata: { studio: { kind: 'assistant', request: { clientRequestId: 'old', nodeId: 'h', operation: 'assistant', prompt: '讨论', contextNodeIds: ['t'] },
  conversation: { mode: 'director', turns: [{ role: 'user', content: '讨论' }, { role: 'assistant', content: '之前的建议' }] } } } } as CanvasNodeData;
const capabilities = { mock: false, operations: ['assistant'], imageCost: 8, textCost: 2, videoCost: null, textModelMode: 'selectable' as const,
  textModels: [{ endpointId: 'one', name: '模型一', isDefault: true, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 20.4 } },
    { endpointId: 'two', name: '模型二', isDefault: false, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 8 } }] };

let streams: DialogueStreamOptions[] = [];
let seq = 0;
const ev = <T,>(type: StudioDialogueEvent['type'], data: T, extra: Partial<StudioDialogueEvent> = {}): StudioDialogueEvent<T> =>
  ({ eventId: `e${++seq}`, seq, threadId: 'th', turnId: 't1', createdAt: at, type, data, ...extra });
const emit = (...events: StudioDialogueEvent[]) => act(() => { for (const e of events) streams.at(-1)!.onEvent(e); });
const composer = () => screen.getByRole('textbox', { name: '给创作助手的消息' }) as HTMLTextAreaElement;
const sendButton = () => screen.getByRole('button', { name: '发送' }) as HTMLButtonElement;

function Host({ initial = [character, text], conversations: initialConversations = [], onCanvas, expose, ...props }: any) {
  const [nodes, setNodes] = useState<CanvasNodeData[]>(initial), [conversations, setConversations] = useState<CanvasNodeData[]>(initialConversations), [connections, setConnections] = useState<any[]>([]);
  useEffect(() => { onCanvas?.(nodes, connections); }, [nodes, connections, onCanvas]);
  useEffect(() => { expose?.(setNodes); }, [expose]);
  return <StudioAssistant projectId="p" open conversations={conversations} setConversations={setConversations} nodes={nodes} setNodes={setNodes} setConnections={setConnections}
    connections={connections} capabilities={capabilities} onClose={() => {}} selectedIds={[]} onUseStep={() => {}} {...props}/>;
}
async function ready(ui = <Host/>) {
  const view = render(ui);
  await waitFor(() => expect(api.subscribe).toHaveBeenCalled());
  return view;
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); streams = []; seq = 0;
  api.getConversation.mockResolvedValue(emptyState);
  api.subscribe.mockImplementation((options: DialogueStreamOptions) => { streams.push(options); return () => {}; });
  api.save.mockResolvedValue(undefined);
  api.post.mockResolvedValue({ messageId: 'u1', turnId: 't1', runId: 'r1', queueState: 'accepted' });
});

test('one continuous thread: no mode tabs, history picker, new-conversation, canvas-sense or visual toggle', async () => {
  await ready();
  expect(screen.getByText('全能创作')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '对话设置' }));
  expect(screen.queryByRole('group', { name: '助手模式' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: '对话历史' })).toBeNull();
  expect(screen.queryByRole('button', { name: '新对话' })).toBeNull();
  expect(screen.queryByText('感知画布')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  // The model choice survives, folded into settings, only because the account may choose.
  expect(screen.getByRole('combobox', { name: '助手模型' })).toBeDefined();
  expect(api.getConversation).toHaveBeenCalledWith('p');
});

test('the composer stays editable while a reply streams, and a tool event renders a folded work record', async () => {
  await ready();
  emit(ev('message.delta', { messageId: 'm1', partId: 'a', delta: '我先看一下' }), ev('message.delta', { messageId: 'm1', partId: 'a', delta: '素材' }),
    ev('tool.started', { toolCallId: 'x', toolName: 'read_canvas', title: '读取画布素材', safeInputSummary: '画布上 3 个节点' }));
  expect(screen.getByText('我先看一下素材')).toBeDefined();
  const card = screen.getByLabelText('工作记录：读取画布素材') as HTMLDetailsElement;
  expect(card.open).toBe(false);
  expect(within(card).getByText(/进行中/)).toBeDefined();
  expect(within(card).getByText('待结算')).toBeDefined();
  expect(card.textContent).not.toContain('read_canvas');
  expect(composer().disabled).toBe(false);
  fireEvent.change(composer(), { target: { value: '第 3 段换成这张图' } });
  expect(sendButton().disabled).toBe(false);
  expect(screen.getByRole('button', { name: '停止' })).toBeDefined();
  api.post.mockResolvedValueOnce({ messageId: 'u2', turnId: 't1', queueState: 'queued' });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByText('排队中，下一步应用')).toBeDefined());
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '第 3 段换成这张图', maxCost: 21 });
  emit(ev('tool.finished', { toolCallId: 'x', toolName: 'read_canvas', status: 'done', result: { summary: '找到 1 条视频' }, creditsActual: 0, settling: false }));
  expect(within(card).getByText('找到 1 条视频')).toBeDefined();
  expect(within(card).getByText('0 积分')).toBeDefined();
});

test('send pins @ references, saves first, and a lost response is retried with the same message key', async () => {
  await ready(<Host selectedIds={['c']}/>);
  expect(screen.getByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  fireEvent.change(composer(), { target: { value: '@台', selectionStart: 2 } });
  fireEvent.keyDown(composer(), { key: 'Enter' });
  expect(composer().value).toBe('@台词 B ');
  api.post.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  fireEvent.change(composer(), { target: { value: '@台词 B 改得口语一点' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByRole('button', { name: '重新发送' })).toBeDefined());
  expect(api.save).toHaveBeenCalled();
  const first = api.post.mock.calls[0];
  expect(first[0]).toBe('p'); expect(first[1]).toBe('th');
  expect(first[2]).toMatchObject({ text: '@台词 B 改得口语一点', pinnedNodeIds: ['c', 't'] });
  fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2].clientMessageId).toBe(first[2].clientMessageId);
  await waitFor(() => expect(screen.queryByRole('button', { name: '重新发送' })).toBeNull());
});

test('a definite rejection gives the draft and references back for editing', async () => {
  await ready(<Host selectedIds={['c']}/>);
  api.post.mockRejectedValueOnce(new ApiError({ code: 'AI_TOKEN_PRICE_NOT_CONFIGURED', message: '回复模型还没有定价' }, 503));
  fireEvent.change(composer(), { target: { value: '讨论这个角色' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getAllByRole('alert').map(e => e.textContent).join(' ')).toContain('还没有定价'));
  expect(composer().value).toBe('讨论这个角色');
  expect(screen.getByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  expect(screen.queryByRole('button', { name: '重新发送' })).toBeNull();
});

test('stop goes through the priority control, not a new message', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '做一条视频' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).toBeDefined());
  api.control.mockResolvedValueOnce({ ...emptyState, latestSeq: 0 });
  fireEvent.click(screen.getByRole('button', { name: '停止' }));
  await waitFor(() => expect(api.control).toHaveBeenCalledOnce());
  expect(api.control.mock.calls[0]).toEqual(['p', 'th', { controlId: expect.any(String), action: 'stop' }]);
  expect(api.post).toHaveBeenCalledOnce();
});

const planBlock: Extract<StudioMessageBlock, { type: 'plan' }> = { type: 'plan', planRunId: 'plan-2', revision: 2, fingerprint: 'f2', plan: { summary: '按两段重做', questions: [], stage: 'production', recommendedApproachId: 'keep',
  steps: [{ id: 'v1', operation: 'video', title: '第 1 段视频', prompt: '', referenceNodeIds: [], quotedCost: 40 }, { id: 'v2', operation: 'video', title: '第 2 段视频', prompt: '', referenceNodeIds: [], quotedCost: 42 }],
  approaches: [{ id: 'alt', title: '关键画面重做', summary: '第 2 段重新设计', rationale: '', preserve: [], change: ['第 2 段画面'], tradeoffs: ['报价更高'], requiredCapabilities: [] },
    { id: 'keep', title: '保留动作换商品', summary: '只换商品和台词', rationale: '', preserve: ['动作'], change: ['商品'], tradeoffs: [], requiredCapabilities: [] }], budget: { estimated: 82, autoFixCap: 40 } } };
const approvalBlock: Extract<StudioMessageBlock, { type: 'approval' }> = { type: 'approval', approvalId: 'a2', stage: 'production', planFingerprint: 'f2', scope: ['第 1 段视频', '第 2 段视频'], quotedCost: 82, budgetCap: 122, autoFixCap: 40, status: 'pending', executionId: 'e1' };
const planMessage = (blocks: StudioMessageBlock[]): StudioDialogueMessage => ({ id: 'm2', threadId: 'th', seq: 3, turnId: 't2', role: 'assistant', text: '推荐保留原片动作。', blocks, status: 'done', createdAt: at });

test('the plan shows the recommended approach first; choosing another only prepares a message', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock])] });
  await ready();
  const plan = screen.getByLabelText('制作计划');
  expect(within(plan).getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['做法：保留动作换商品', '做法：关键画面重做']);
  expect(within(plan).getByText('推荐')).toBeDefined();
  expect(within(plan).getAllByText('40 积分').length).toBeGreaterThan(0);
  expect(within(plan).getByText('第 1 段视频')).toBeDefined();
  fireEvent.click(within(plan).getByRole('button', { name: '改用这个做法' }));
  expect(composer().value).toBe('改用「关键画面重做」这个做法，重新报价');
  expect(api.post).not.toHaveBeenCalled();
});

test('confirming production posts the execution, approach, plan revision, approval and the confirming message', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock, approvalBlock])] });
  api.createExecution.mockResolvedValue({ id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'plan-2', planRevision: 2, planFingerprint: 'f2', status: 'running', steps: [], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  await ready();
  const card = screen.getByLabelText('确认制作');
  fireEvent.change(within(card).getByLabelText('总上限（积分）'), { target: { value: '80' } });
  expect((within(card).getByRole('button', { name: '开始制作' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(card).getByText(/总上限至少要 82 积分/)).toBeDefined();
  fireEvent.change(within(card).getByLabelText('总上限（积分）'), { target: { value: '120' } });
  fireEvent.change(within(card).getByLabelText('其中重做额度'), { target: { value: '30' } });
  fireEvent.click(within(card).getByRole('button', { name: '开始制作' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.save).toHaveBeenCalled();
  expect(api.createExecution.mock.calls[0]).toEqual(['p', { clientRequestId: expect.any(String), stage: 'production', planRunId: 'plan-2', planFingerprint: 'f2', budgetCap: 120, autoFixCap: 30,
    approvalId: 'a2', confirmationMessageId: 'm2', executionId: 'e1', approachId: 'keep', expectedRevision: 2 }]);
  await waitFor(() => expect(within(screen.getByLabelText('确认制作')).getByText('已确认')).toBeDefined());
  expect(within(screen.getByLabelText('确认制作')).queryByRole('button', { name: '开始制作' })).toBeNull();
  expect(screen.getByLabelText('制作进度')).toBeDefined();
});

test('analysis is created without an execution; replaced and expired cards cannot be approved', async () => {
  const analysisPlan = { ...planBlock, planRunId: 'plan-1', revision: 1, fingerprint: 'f1', plan: { ...planBlock.plan, stage: 'analysis' as const, approaches: [] } };
  const analysis = { ...approvalBlock, approvalId: 'a1', stage: 'analysis' as const, planFingerprint: 'f1', quotedCost: 26, budgetCap: 30, autoFixCap: 0, executionId: undefined };
  const old = { ...approvalBlock, approvalId: 'a0', status: 'superseded' as const }, expired = { ...approvalBlock, approvalId: 'a9', planFingerprint: 'f9', expiresAt: '2026-01-01T00:00:00Z' };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [{ ...planMessage([old, expired]), id: 'm0', seq: 1 }, planMessage([analysisPlan, analysis])] });
  api.createExecution.mockResolvedValue({ id: 'e9', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'analysis', planRunId: 'plan-1', planRevision: 1, planFingerprint: 'f1', status: 'running', steps: [], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  await ready();
  expect(screen.queryAllByRole('button', { name: '开始制作' })).toHaveLength(0);
  expect(screen.getByText('方案已经更新，请看下面最新的报价。')).toBeDefined();
  expect(screen.getByText('这张确认卡已过期，请让我重新报价。')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '开始分析' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  const request = api.createExecution.mock.calls[0][1];
  expect(request).toMatchObject({ stage: 'analysis', planRunId: 'plan-1', planFingerprint: 'f1', budgetCap: 30, autoFixCap: 0, approvalId: 'a1' });
  expect(request).not.toHaveProperty('executionId');
  expect(request).not.toHaveProperty('approachId');
});

test('「先改改」 only focuses the composer', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock, approvalBlock])] });
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '先改改' }));
  expect(document.activeElement).toBe(composer());
  expect(api.createExecution).not.toHaveBeenCalled();
});

test('old four-mode conversations stay readable under a collapsed 之前的对话, opened when entered from that node', async () => {
  const view = await ready(<Host conversations={[legacy]}/>);
  const section = screen.getByText('之前的对话（1 段）').closest('details') as HTMLDetailsElement;
  expect(section.open).toBe(false);
  expect(within(section).getByText('之前的建议')).toBeDefined();
  view.unmount();
  await ready(<Host conversations={[legacy]} initialNodeId="h"/>);
  expect((screen.getByText('之前的对话（1 段）').closest('details') as HTMLDetailsElement).open).toBe(true);
});

test('server canvas commands create nodes once, even when replayed, and save the canvas', async () => {
  let canvas: CanvasNodeData[] = [];
  await ready(<Host onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  const upsert = ev('node.upsert', { nodeId: 'e1-seg-1', op: 'create', executionId: 'e1', stepId: 'v1', runId: 'run-v1',
    node: { id: 'e1-seg-1', type: 'video', title: '第 1 段', position: { x: 0, y: 0 }, width: 360, height: 640, metadata: { status: 'success', storageKey: 'k/v1' } } }, { executionId: 'e1' });
  emit(upsert);
  emit(upsert);
  await waitFor(() => expect(canvas.filter(n => n.id === 'e1-seg-1')).toHaveLength(1));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(Number(localStorage.getItem('studio-dialogue-canvas-seq:th'))).toBe(upsert.seq);
});

test('a text proposal is adopted only while the node still holds the text it was written against', async () => {
  let canvas: CanvasNodeData[] = [], setCanvas!: (update: (list: CanvasNodeData[]) => CanvasNodeData[]) => void;
  await ready(<Host onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }} expose={(set: typeof setCanvas) => { setCanvas = set; }}/>);
  emit(ev('message.delta', { messageId: 'm1', partId: 'a', delta: '改好了' }), ev('node.upsert', { nodeId: 't', op: 'propose', proposal: { field: 'content', content: '新台词' } }));
  const first = await screen.findByLabelText('修改建议');
  fireEvent.click(within(first).getByRole('button', { name: '采用' }));
  await waitFor(() => expect(canvas.find(n => n.id === 't')?.metadata?.content).toBe('新台词'));
  expect(within(first).getByRole('button', { name: '已采用' })).toBeDefined();
  emit(ev('node.upsert', { nodeId: 't', op: 'propose', proposal: { field: 'content', content: '更口语的台词' } }));
  await waitFor(() => expect(screen.getAllByLabelText('修改建议')).toHaveLength(2));
  act(() => setCanvas(list => list.map(n => n.id === 't' ? { ...n, metadata: { ...n.metadata, content: '我刚手改的台词' } } : n)));
  const second = screen.getAllByLabelText('修改建议')[1];
  expect(within(second).getByText(/为了不覆盖你的改动/)).toBeDefined();
  expect((within(second).getByRole('button', { name: '采用' }) as HTMLButtonElement).disabled).toBe(true);
  expect(canvas.find(n => n.id === 't')?.metadata?.content).toBe('我刚手改的台词');
});

test('question options and follow-up suggestions only fill the composer', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 2, messages: [{ ...planMessage([{ type: 'question', questionId: 'q', text: '新商品是哪一款？', options: ['洗衣液', '护手霜'] }]), seq: 2 }] });
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '洗衣液' }));
  expect(composer().value).toBe('洗衣液');
  seq = 2;
  emit(ev('message.delta', { messageId: 'm3', partId: 'a', delta: '做好了' }), ev('turn.done', { reason: 'completed', messageId: 'm3', suggestions: ['改成横屏', '保存成模板'] }));
  const suggestions = screen.getByRole('group', { name: '接下来可以' });
  fireEvent.click(within(suggestions).getByRole('button', { name: /保存成模板/ }));
  expect(composer().value).toBe('洗衣液\n保存成模板');
  expect(api.post).not.toHaveBeenCalled();
});

test('「从这里重新开始」 branches from that message and shows the new thread', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([])] });
  api.branch.mockResolvedValue({ thread: { ...thread, id: 'th2', parentThreadId: 'th', branchFromMessageId: 'm2', lastSeq: 3 }, messages: [{ ...planMessage([]), id: 'm2b', threadId: 'th2', text: '分支里的回复' }], latestSeq: 3 });
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '从这里重新开始' }));
  await waitFor(() => expect(screen.getByText('分支里的回复')).toBeDefined());
  expect(api.branch.mock.calls[0]).toEqual(['p', 'th', { clientRequestId: expect.any(String), fromMessageId: 'm2' }]);
  expect(screen.getByText(/这是从一条消息新开的对话/)).toBeDefined();
  await waitFor(() => expect(streams.at(-1)!.threadId).toBe('th2'));
});

test('「就用这版」 on a check node records the inspected run on its own step; 「重做这一段」 opens the regenerate composer', async () => {
  const segment = { ...character, id: 'seg', type: 'video', title: '第 1 段', metadata: { storageKey: 'k/v1', studio: { kind: 'shot', execution: { executionId: 'e1', stepId: 'v1', runId: 'run-v1' } } } } as CanvasNodeData;
  const check = { ...text, id: 'chk', title: '第 1 段 · 检查', metadata: { status: 'success', studio: { kind: 'check', parentNodeId: 'seg', execution: { executionId: 'e1', stepId: 'c1', runId: 'run-c1' },
    check: { status: 'unknown', targetRunId: 'run-v1', items: [] } } } } as CanvasNodeData;
  api.getExecution.mockResolvedValue({ id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'done',
    steps: [{ id: 'v1', title: '第 1 段', operation: 'video', stage: 'production', dependsOn: [], status: 'done', runIds: ['run-v1'], attempt: 1, quotedCost: 40 }], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  api.accept.mockImplementation(async () => api.getExecution.mock.results[0].value);
  await ready(<Host initial={[segment, check]}/>);
  act(() => { window.dispatchEvent(new CustomEvent(STUDIO_CHECK_COMMAND, { detail: { action: 'accept', nodeId: 'chk' } })); });
  await waitFor(() => expect(api.accept).toHaveBeenCalledOnce());
  expect(api.accept.mock.calls[0]).toEqual(['p', 'e1', 'v1', { clientRequestId: expect.any(String), runId: 'run-v1' }]);
  const commands: unknown[] = [];
  const listener = (e: Event) => commands.push((e as CustomEvent).detail);
  window.addEventListener('studio-command', listener);
  act(() => { window.dispatchEvent(new CustomEvent(STUDIO_CHECK_COMMAND, { detail: { action: 'redo', nodeId: 'chk' } })); });
  window.removeEventListener('studio-command', listener);
  expect(commands).toEqual([{ action: 'video', nodeId: 'seg' }]);
});

test('the production strip pauses or stops through the execution endpoints, each with its own request key', async () => {
  const execution = { id: 'e1', projectId: 'p', threadId: 'th', skillKey: 'k', skillVersion: 1, stage: 'production' as const, planRunId: 'pr', planRevision: 2, planFingerprint: 'f', status: 'running' as const,
    steps: [{ id: 'v1', title: '第 1 段', operation: 'video' as const, stage: 'production' as const, dependsOn: [], status: 'done' as const, runIds: ['run-v1'], attempt: 1, quotedCost: 40 },
      { id: 'v2', title: '第 2 段', operation: 'video' as const, stage: 'production' as const, dependsOn: [], status: 'running' as const, runIds: ['run-v2'], attempt: 1, quotedCost: 40 }],
    budgets: [{ stage: 'production' as const, approvedCap: 120, autoFixCap: 40, spent: 40, inFlight: 40, remaining: 40 }], startedAt: at, deadlineAt: at, updatedAt: at };
  api.getConversation.mockResolvedValue({ ...emptyState, thread: { ...thread, activeExecutionId: 'e1' }, execution });
  api.pause.mockResolvedValue({ ...execution, status: 'paused', updatedAt: '2026-10-18T01:00:05Z' });
  api.cancel.mockResolvedValue({ ...execution, status: 'canceled', updatedAt: '2026-10-18T01:00:09Z' });
  await ready();
  const strip = screen.getByLabelText('制作进度');
  expect(within(strip).getByText('已完成 1/2 项')).toBeDefined();
  expect(within(strip).getByText(/已用 40 \/ 120 积分/)).toBeDefined();
  fireEvent.click(within(strip).getByRole('button', { name: '暂停后续' }));
  await waitFor(() => expect(api.pause).toHaveBeenCalledWith('p', 'e1', { clientRequestId: expect.any(String), expectedStatus: 'running' }));
  await waitFor(() => expect(within(screen.getByLabelText('制作进度')).getByRole('button', { name: '继续制作' })).toBeDefined());
  fireEvent.click(within(screen.getByLabelText('制作进度')).getByRole('button', { name: '停止' }));
  await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('p', 'e1', { clientRequestId: expect.any(String), expectedStatus: 'paused' }));
  expect(api.pause.mock.calls[0][2].clientRequestId).not.toBe(api.cancel.mock.calls[0][2].clientRequestId);
});
