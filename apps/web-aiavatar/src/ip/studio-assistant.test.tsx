// @vitest-environment jsdom
import { StrictMode, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioDialogueEvent, StudioDialogueMessage, StudioDialogueState, StudioMessageBlock, StudioPlanExecution, StudioSkillSummary } from '@ai-star-eco/types/ip-studio-workflow';
import { formatDateTime } from '@/lib/datetime';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { DialogueStreamOptions } from '@/canvas-bridge/studio-dialogue';
import { StudioAssistant } from './studio-assistant';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { STUDIO_CHECK_COMMAND } from '@/canvas-bridge/studio-plan-execution';

const api = vi.hoisted(() => ({
  getConversation: vi.fn(), post: vi.fn(), subscribe: vi.fn(), control: vi.fn(), branch: vi.fn(), list: vi.fn(),
  createExecution: vi.fn(), getExecution: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), accept: vi.fn(),
  save: vi.fn(), importStudioStory: vi.fn(), importStudioMedia: vi.fn(), submitStudioRun: vi.fn(), readRun: vi.fn(), getRun: vi.fn(), success: vi.fn(), error: vi.fn(),
  skills: vi.fn(), reloadSkills: vi.fn(), draft: vi.fn(), confirm: vi.fn(), role: null as string | null,
}));
vi.mock('@/canvas-bridge/studio-dialogue', () => ({ getStudioConversation: api.getConversation, postStudioDialogueMessage: api.post, subscribeStudioDialogue: api.subscribe,
  controlStudioDialogue: api.control, branchStudioDialogue: api.branch, listStudioDialogueMessages: api.list }));
vi.mock('@/canvas-bridge/studio-plan-execution', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-plan-execution')>()),
  createStudioPlanExecution: api.createExecution, getStudioPlanExecution: api.getExecution, pauseStudioPlanExecution: api.pause, resumeStudioPlanExecution: api.resume,
  cancelStudioPlanExecution: api.cancel, acceptStudioPlanExecutionStep: api.accept }));
vi.mock('@/canvas-bridge/studio-skills', async original => ({ ...(await original<typeof import('@/canvas-bridge/studio-skills')>()),
  loadStudioSkills: () => api.skills(), reloadStudioSkills: () => api.reloadSkills(), createStudioSkillDraft: api.draft }));
vi.mock('@/proto/api', () => ({ useIdentity: () => ({ operatorRole: api.role }), isOperatorRole: (role?: string | null) => role === 'operator' || role === 'super_admin' }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: api.save }));
vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioStory: api.importStudioStory, importStudioMedia: api.importStudioMedia, submitStudioRun: api.submitStudioRun }));
vi.mock('@/canvas-bridge/api', () => ({ readRun: api.readRun }));
vi.mock('@/ip/api/ip-studio', async original => ({ ...(await original<typeof import('@/ip/api/ip-studio')>()), getRun: api.getRun }));
vi.mock('./studio-floating-panel', () => ({ StudioFloatingPanel: ({ open, title, titleExtra, subheader, children, onClose, footer }: any) => open ? <section role="dialog" aria-label={title}><header>{title}{titleExtra}<button aria-label={`关闭${title}`} onClick={onClose}>关闭</button></header>{subheader}{children}{footer}</section> : null }));
vi.mock('./studio-conversation-share', () => ({ StudioConversationShare: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: ({ locked, reading, onFiles }: any) => <div><button disabled={locked}>{reading ? '正在导入附件' : '添加附件'}</button><input type="file" aria-label="上传创作附件" multiple onChange={e => onFiles(Array.from(e.target.files || []))}/></div> }));
vi.mock('./library-reference-picker', () => ({ LibraryReferencePicker: () => null }));
vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: api.success, error: api.error }, modal: { confirm: (options: any) => { api.confirm(options); return options.onOk?.(); } } }) },
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
  api.getRun.mockRejectedValue(new Error('没有这次运行'));
  api.skills.mockResolvedValue([]); api.reloadSkills.mockResolvedValue([]); api.role = null;
});

test('one continuous thread: no mode tabs, history picker, new-conversation, canvas-sense or visual toggle', async () => {
  await ready();
  expect(screen.getByText('全能创作')).toBeDefined();
  expect(screen.queryByRole('group', { name: '助手模式' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: '对话历史' })).toBeNull();
  expect(screen.queryByRole('button', { name: '新对话' })).toBeNull();
  expect(screen.queryByText('感知画布')).toBeNull();
  expect(screen.queryByRole('checkbox')).toBeNull();
  // The model choice survives as a chip in the composer, only because the account may choose.
  expect(screen.getByRole('combobox', { name: '助手模型' })).toBeDefined();
  expect(screen.queryByRole('button', { name: '对话设置' })).toBeNull();
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
  // Stop covers the bound production too; nothing says it only ends this reply.
  expect(screen.getByRole('button', { name: '停止' }).getAttribute('title')).toContain('进行中的制作');
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
  // The quote is the headline; the two cap fields stay folded until 「调整上限」.
  expect(within(card).getByText('82')).toBeDefined();
  expect(within(card).queryByLabelText('总上限（积分）')).toBeNull();
  fireEvent.click(within(card).getByRole('button', { name: '调整上限' }));
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
  // The record keeps what was confirmed (120 / 30), not what the card proposed (122 / 40).
  expect(within(screen.getByLabelText('确认制作')).getByText('已确认 · 总上限 120 积分 · 重做上限 30 积分')).toBeDefined();
  expect(within(screen.getByLabelText('确认制作')).queryByText(/总上限 122 积分/)).toBeNull();
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
  // Canvas redesign (design Main board): the strip says which step of how many; the step list itself is in the conversation.
  expect(within(strip).getByText('制作中 · 第 2 步，共 2 步')).toBeDefined();
  expect(within(strip).getByText(/已用 40 \/ 120 积分/)).toBeDefined();
  expect(within(screen.getByRole('list', { name: '各步进度' })).getAllByRole('listitem').map(li => li.getAttribute('data-status'))).toEqual(['done', 'running']);
  fireEvent.click(within(strip).getByRole('button', { name: '暂停' }));
  await waitFor(() => expect(api.pause).toHaveBeenCalledWith('p', 'e1', { clientRequestId: expect.any(String), expectedStatus: 'running' }));
  await waitFor(() => expect(within(screen.getByLabelText('制作进度')).getByRole('button', { name: '继续制作' })).toBeDefined());
  fireEvent.click(within(screen.getByLabelText('制作进度')).getByRole('button', { name: '停止' }));
  await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('p', 'e1', { clientRequestId: expect.any(String), expectedStatus: 'paused' }));
  expect(api.pause.mock.calls[0][2].clientRequestId).not.toBe(api.cancel.mock.calls[0][2].clientRequestId);
});

// ── Work finished while the canvas was closed (.studio-e2e/report.md D05) and the confirmed record (D10) ──
const E = 'PEX-1';
const doneExecution: StudioPlanExecution = { id: E, projectId: 'p', threadId: 'th', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'plan-2', planRevision: 2, planFingerprint: 'f2', status: 'done',
  steps: [
    { id: 'facts', title: '整理事实', operation: 'text', stage: 'analysis', dependsOn: [], status: 'done', runIds: ['r-facts'], attempt: 1, quotedCost: 140, nodeId: `${E}-a-facts` },
    { id: 'limits', title: '核对边界', operation: 'text', stage: 'analysis', dependsOn: ['facts'], status: 'done', runIds: ['r-limits'], attempt: 1, quotedCost: 140, nodeId: `${E}-a-limits` },
    { id: 'v1', title: '第 1 段视频', operation: 'video', stage: 'production', dependsOn: [], status: 'done', runIds: ['r-v1'], attempt: 1, quotedCost: 40, nodeId: `${E}-p-v1` },
    { id: 'c1', title: '检查第 1 段', operation: 'check', stage: 'production', dependsOn: ['v1'], status: 'done', runIds: ['r-c1'], attempt: 1, quotedCost: 2, nodeId: `${E}-p-c1` },
  ],
  budgets: [{ stage: 'analysis', approvedCap: 280, autoFixCap: 0, spent: 2, inFlight: 0, remaining: 278 }, { stage: 'production', approvedCap: 260, autoFixCap: 20, spent: 40, inFlight: 0, remaining: 220 }],
  startedAt: at, deadlineAt: at, updatedAt: at, finishedAt: at };
const doneRun = (id: string, nodeId: string, kind: IpRun['kind'], output: IpRun['output']): IpRun =>
  ({ id, projectId: 'p', nodeId, kind, status: 'done', stage: 'done', pct: 100, cost: 1, inputs: { executionId: E } as unknown as IpRun['inputs'], output, createdAt: at, finishedAt: at });
const doneRuns: Record<string, IpRun> = {
  'r-facts': doneRun('r-facts', `${E}-a-facts`, 'studio-text', { textRevision: { content: '整理好的事实', summary: '事实' }, text: '整理好的事实' }),
  'r-limits': doneRun('r-limits', `${E}-a-limits`, 'studio-text', { textRevision: { content: '未知事项', summary: '边界' }, text: '未知事项' }),
  'r-v1': doneRun('r-v1', `${E}-p-v1`, 'studio-video', { videoCandidates: [{ index: 0, jobId: 'j', status: 'done', pct: 100, storageKey: 'k/v1.mp4', durationSec: 5 }] }),
  'r-c1': doneRun('r-c1', `${E}-p-c1`, 'studio-check', { check: { status: 'unknown', targetRunId: 'r-v1', items: [{ id: 'caption', status: 'unknown', evidence: [], reason: '没有字幕' }] } }),
};
const ALL = [`${E}-a-facts`, `${E}-a-limits`, `${E}-p-c1`, `${E}-p-v1`];
const confirmedCard = { ...approvalBlock, status: 'approved' as const, executionId: E, budgetCap: 1000, approvedBudgetCap: 280, approvedAutoFixCap: 30, approvedAt: '2026-10-18T12:01:13Z', approvedPlanRevision: 2 };
/** The thread as the server returns it after the execution finished: no execution in the snapshot, the confirmed card names it. */
const closedState = (card: StudioMessageBlock = confirmedCard): StudioDialogueState => ({ thread: { ...thread, lastSeq: 22 }, latestSeq: 22, messages: [planMessage([planBlock, card])] });
const closedCanvas = (card?: StudioMessageBlock) => {
  api.getConversation.mockResolvedValue(closedState(card));
  api.getExecution.mockResolvedValue(doneExecution);
  api.getRun.mockImplementation(async (id: string) => { if (!doneRuns[id]) throw new Error('没有这次运行'); return doneRuns[id]; });
};
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 30)));

test('(a) a canvas opened after its execution finished gets the produced nodes back and saves them', async () => {
  closedCanvas();
  let canvas: CanvasNodeData[] = [], edges: any[] = [];
  await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[], connections: any[]) => { canvas = nodes; edges = connections; }}/>);
  await waitFor(() => expect(canvas.map(n => n.id).sort()).toEqual(ALL));
  expect(api.getExecution).toHaveBeenCalledWith('p', E);
  expect(canvas.find(n => n.id === `${E}-a-facts`)!.metadata).toMatchObject({ content: '整理好的事实', studio: { kind: 'text', execution: { executionId: E, stepId: 'facts', runId: 'r-facts' } } });
  expect(canvas.find(n => n.id === `${E}-p-v1`)!.metadata?.storageKey).toBe('k/v1.mp4');
  expect(canvas.find(n => n.id === `${E}-p-c1`)!.metadata?.studio).toMatchObject({ kind: 'check', parentNodeId: `${E}-p-v1` });
  // Both kinds of edge: a step's input (facts → limits) and the check beside what it inspected (v1 → c1).
  await waitFor(() => expect(edges.map(e => `${e.fromNodeId}>${e.toNodeId}`).sort()).toEqual([`${E}-a-facts>${E}-a-limits`, `${E}-p-v1>${E}-p-c1`]));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  // The finished execution is shown again, and canvas commands are replayed from the start of the thread.
  expect(within(screen.getByLabelText('制作进度')).getByText(/^制作 · 已完成/)).toBeDefined();
  expect(streams.at(-1)!.cursor()).toBe(0);
  expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]').sort()).toEqual(ALL);
});

test('(b) opening it again adds nothing and reads no runs; a node deleted here is not rebuilt', async () => {
  closedCanvas();
  let canvas: CanvasNodeData[] = [];
  const first = await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  await waitFor(() => expect(canvas).toHaveLength(4));
  first.unmount();
  const reads = api.getRun.mock.calls.length, saves = api.save.mock.calls.length;
  let again: CanvasNodeData[] = [];
  const second = await ready(<Host initial={canvas} onCanvas={(nodes: CanvasNodeData[]) => { again = nodes; }}/>);
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledTimes(2));
  await settle();
  expect(again.map(n => n.id)).toEqual(canvas.map(n => n.id));
  expect(api.getRun.mock.calls.length).toBe(reads);
  expect(api.save.mock.calls.length).toBe(saves);
  second.unmount();
  let third: CanvasNodeData[] = [];
  await ready(<Host initial={canvas.filter(n => n.id !== `${E}-p-v1`)} onCanvas={(nodes: CanvasNodeData[]) => { third = nodes; }}/>);
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledTimes(3));
  await settle();
  expect(third.map(n => n.id).sort()).toEqual(ALL.filter(id => id !== `${E}-p-v1`));
});

test('(c) text the user already rewrote on a produced node survives the restore, with no proposal', async () => {
  closedCanvas();
  const mine = { ...text, id: `${E}-a-facts`, title: '我的事实', metadata: { content: '我手改过的事实', status: 'success' as const, studio: { kind: 'text' as const, execution: { executionId: E, stepId: 'facts', runId: 'r-facts' } } } } as CanvasNodeData;
  let canvas: CanvasNodeData[] = [], edges: any[] = [];
  await ready(<Host initial={[mine]} onCanvas={(nodes: CanvasNodeData[], connections: any[]) => { canvas = nodes; edges = connections; }}/>);
  await waitFor(() => expect(canvas).toHaveLength(4));
  expect(canvas.find(n => n.id === `${E}-a-facts`)).toEqual(mine);
  // The restored step still links to the node it came from.
  await waitFor(() => expect(edges.map(e => `${e.fromNodeId}>${e.toNodeId}`)).toContain(`${E}-a-facts>${E}-a-limits`));
  expect(api.getRun).not.toHaveBeenCalledWith('r-facts');
  expect(screen.queryByLabelText('修改建议')).toBeNull();
});

test('the canvas restores on open even with the panel closed when it is missing execution output', async () => {
  closedCanvas();
  const closed = render(<Host initial={[]} open={false}/>);
  await settle();
  expect(api.getConversation).not.toHaveBeenCalled();
  closed.unmount();
  let canvas: CanvasNodeData[] = [];
  render(<Host initial={[]} open={false} restorePending onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  await waitFor(() => expect(canvas).toHaveLength(4));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a confirmed card shows the authorized caps and when; without the server snapshot, the execution budget, never the proposal', async () => {
  closedCanvas();
  const view = await ready(<Host initial={[]}/>);
  const card = screen.getByLabelText('确认制作');
  expect(within(card).getByText('已确认 · 总上限 280 积分 · 重做上限 30 积分')).toBeDefined();
  expect(within(card).getByText(`确认于 ${formatDateTime('2026-10-18T12:01:13Z')} · 第 2 版方案`)).toBeDefined();
  expect(within(card).getByText('报价 82 积分。')).toBeDefined();
  expect(card.textContent).not.toContain('1,000');
  view.unmount();
  const { approvedBudgetCap: _cap, approvedAutoFixCap: _fix, approvedAt: _at, approvedPlanRevision: _rev, ...legacy } = confirmedCard;
  closedCanvas(legacy);
  await ready(<Host initial={[]}/>);
  await waitFor(() => expect(within(screen.getByLabelText('确认制作')).getByText('已确认 · 总上限 260 积分 · 重做上限 20 积分')).toBeDefined());
  expect(screen.getByLabelText('确认制作').textContent).not.toContain('1,000');
});

test('first open on this browser replays execution commands from the start: missing nodes only, then live again', async () => {
  closedCanvas();
  api.getExecution.mockRejectedValue(new Error('读取失败'));
  const mine = { ...text, id: `${E}-a-facts`, metadata: { content: '我手改过的事实', status: 'success' as const, studio: { kind: 'text' as const } } } as CanvasNodeData;
  let canvas: CanvasNodeData[] = [];
  await ready(<Host initial={[mine]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  expect(streams.at(-1)!.cursor()).toBe(0);
  const upsert = (eventSeq: number, nodeId: string, content: string) => ({ eventId: `h${eventSeq}`, seq: eventSeq, threadId: 'th', turnId: E, executionId: E, createdAt: at, type: 'node.upsert' as const,
    data: { nodeId, op: 'create' as const, executionId: E, stepId: nodeId.split('-').at(-1), runId: `r-${nodeId}`,
      node: { id: nodeId, type: 'text' as const, title: '整理事实', position: { x: 0, y: 0 }, width: 380, height: 320, metadata: { status: 'success', content, studio: { kind: 'text' } } } } });
  emit(upsert(5, `${E}-a-facts`, '服务端的事实'), upsert(6, `${E}-a-limits`, '未知事项'), ev('turn.done', { reason: 'completed', messageId: 'm2' }, { seq: 22, eventId: 'h22' }));
  await waitFor(() => expect(canvas.map(n => n.id)).toEqual([`${E}-a-facts`, `${E}-a-limits`]));
  expect(canvas[0]).toEqual(mine);
  expect(screen.queryByLabelText('修改建议')).toBeNull();
  await waitFor(() => expect(localStorage.getItem('studio-dialogue-canvas-seq:th')).toBe('22'));
  // After the snapshot point the same command is an ordinary one: differing server text becomes a proposal, never an overwrite.
  emit(upsert(23, `${E}-a-facts`, '服务端的新事实'));
  await waitFor(() => expect(screen.getByLabelText('修改建议')).toBeDefined());
  expect(canvas.find(n => n.id === `${E}-a-facts`)!.metadata?.content).toBe('我手改过的事实');
});

// ── Server follow-ups: stage budget on send, dialogue share, saved follow-ups, card details, synthetic turns ──
test('a message that would not fit the stage budget says by how much and keeps the draft', async () => {
  await ready();
  api.post.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_PLAN_BUDGET_EXCEEDED', message: '预算不够，还差 30 积分。可以追加预算或缩小计划后再继续',
    details: { stage: 'production', spent: 100, inFlight: 10, quotedCost: 20, approvedCap: 100, shortfall: 30 } }, 402));
  fireEvent.change(composer(), { target: { value: '第 2 段换成横屏' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getAllByRole('alert').map(e => e.textContent).join(' ')).toContain('本阶段预算还差 30 积分，提高上限后再发'));
  expect(composer().value).toBe('第 2 段换成横屏');
  expect(screen.queryByRole('button', { name: '重新发送' })).toBeNull();
});

test('a message queued during an execution without a turn waits as queued and does not look like a reply', async () => {
  await ready();
  api.post.mockResolvedValueOnce({ messageId: 'u7', queueState: 'queued' });
  fireEvent.change(composer(), { target: { value: '第 2 段换成横屏' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByText('排队中，下一步应用')).toBeDefined());
  expect(screen.queryByRole('button', { name: '停止' })).toBeNull();
  expect(screen.queryByText('正在准备回复')).toBeNull();
});

test('the progress strip breaks out the dialogue share of the stage budget', async () => {
  const execution = { ...doneExecution, status: 'running' as const, budgets: [{ stage: 'production' as const, approvedCap: 260, autoFixCap: 20, spent: 43, inFlight: 20, remaining: 197, dialogueSpent: 3, dialogueInFlight: 20 }] };
  api.getConversation.mockResolvedValue({ ...emptyState, thread: { ...thread, activeExecutionId: E }, execution });
  await ready();
  const strip = screen.getByLabelText('制作进度');
  // The strip shows only 「已用 / 上限」 (design Main board); the in-flight and dialogue breakdown rides on its tooltip.
  expect(within(strip).getByText(/已用 43 \/ 260 积分/).getAttribute('title')).toContain('其中对话 3 积分，对话进行中占用 20 积分');
  emit(ev('budget.update', { executionId: E, stage: 'production', approvedCap: 260, spent: 45, inFlight: 0, remaining: 215, source: 'actual', dialogueSpent: 5, dialogueInFlight: 0 }, { executionId: E }));
  expect(within(screen.getByLabelText('制作进度')).getByText(/已用 45 \/ 260 积分/).getAttribute('title')).toBe('其中对话 5 积分');
});

test('follow-ups saved on the completion summary show after a reload, and once when turn.done repeats them', async () => {
  const summary: StudioDialogueMessage = { id: 'm-sum', threadId: 'th', seq: 4, turnId: 'EXS-1', role: 'assistant', text: '两段都做好了，一共用了 82 积分。', blocks: [], status: 'done', createdAt: at, suggestions: ['改成横屏', '保存成模板'] };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [summary] });
  await ready();
  const group = () => screen.getByRole('group', { name: '接下来可以' });
  expect(within(group()).getAllByRole('button').map(b => b.textContent)).toEqual(['改成横屏', '保存成模板']);
  seq = 4;
  emit(ev('turn.done', { reason: 'completed', messageId: 'm-sum', suggestions: ['改成横屏', '保存成模板'] }, { turnId: 'EXS-1' }));
  expect(screen.getAllByRole('group', { name: '接下来可以' })).toHaveLength(1);
  expect(within(group()).getAllByRole('button')).toHaveLength(2);
  fireEvent.click(within(group()).getByRole('button', { name: /保存成模板/ }));
  expect(composer().value).toBe('保存成模板');
});

test('a card shows its own shortfall and dialogue reserve; a replaced card says so and cannot start anything', async () => {
  const raise = { ...approvalBlock, approvalId: 'a3', budgetCap: 150, quotedCost: 50, autoFixCap: 0, shortfall: 30, dialogueReserve: 20 };
  const replaced = { ...approvalBlock, approvalId: 'a1', planFingerprint: 'f1', status: 'superseded' as const, supersededAt: at };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [{ ...planMessage([replaced]), id: 'm1', seq: 2 }, planMessage([planBlock, raise])] });
  await ready();
  const [old, current] = screen.getAllByLabelText('确认制作');
  expect(within(old).getByText('已被新方案替代')).toBeDefined();
  expect(within(old).queryByRole('button', { name: '开始制作' })).toBeNull();
  expect(within(current).getByText('50')).toBeDefined();
  expect(within(current).getByText(/最多花到 150 积分，含一轮对话预留 20 积分。超过会停下来问你/)).toBeDefined();
  // A shortfall card opens the cap fields by itself: raising the cap is what it is for.
  expect(within(current).getByLabelText('总上限（积分）')).toBeDefined();
  expect(within(current).getByText('本阶段预算还差 30 积分，确认新的上限后继续。')).toBeDefined();
});

test('confirming a card, then the server closing its synthetic turn, leaves nothing running in the timeline', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock, approvalBlock])] });
  api.createExecution.mockResolvedValue({ ...doneExecution, status: 'running', budgets: [{ stage: 'production', approvedCap: 122, autoFixCap: 40, spent: 0, inFlight: 0, remaining: 122 }] });
  await ready();
  fireEvent.click(within(screen.getByLabelText('确认制作')).getByRole('button', { name: '开始制作' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  seq = 3;
  emit(ev('approval.required', { messageId: 'm2', block: { ...approvalBlock, status: 'approved', executionId: E, approvedBudgetCap: 122, approvedAutoFixCap: 40, approvedAt: at } }, { turnId: 'APR-1', executionId: E }),
    ev('turn.done', { reason: 'completed', messageId: 'm2', settling: false }, { turnId: 'APR-1', executionId: E }));
  await waitFor(() => expect(within(screen.getByLabelText('确认制作')).getByText('已确认 · 总上限 122 积分 · 重做上限 40 积分')).toBeDefined());
  // The production strip keeps its own 停止; the composer's (a reply in progress) is gone.
  expect(screen.getAllByRole('button', { name: '停止' }).filter(b => !b.closest('[aria-label="制作进度"]'))).toHaveLength(0);
  expect(screen.queryByText('正在准备回复')).toBeNull();
  expect(screen.getAllByLabelText('Studio 的回复')).toHaveLength(1);
});

// ── Skills (S3): the per-message choice, the plan badge, the "pick one" rejection and the operator draft ──

const skill = (key: string, name: string, extra: Partial<StudioSkillSummary> = {}): StudioSkillSummary => ({ key, name, version: 1, status: 'active', planning: 'dynamic', summary: `${name}的说明`,
  methodExamples: [], operations: { analysis: ['text'], production: ['text', 'video'] }, limits: { maxSourceSec: 60, maxSegments: 4, maxSegmentSec: 'model', maxSteps: 16, maxAutoFixPerSegment: 1 },
  checks: [], autoFixChecks: [], requiredCapabilities: [], ...extra });
const recreation = skill('video-recreation', '短视频复刻', { version: 2 }), seeding = skill('talking-head-seeding', '口播种草');
// The guide opens from the skill chip in the header (the design has no separate 「?」).
const openGuide = () => fireEvent.click(screen.getAllByRole('button').find(b => b.getAttribute('aria-controls') === 'studio-assistant-guide')!);

test('with several active skills the settings offer 「技能」 (default 自动 = no skillKey); a chosen one rides on the message and its retry', async () => {
  api.skills.mockResolvedValue([recreation, seeding, skill('old', '旧技能', { status: 'withdrawn' })]);
  await ready();
  openGuide();
  const picker = await screen.findByRole('combobox', { name: '技能' }) as HTMLSelectElement;
  expect([...picker.options].map(o => o.textContent)).toEqual(['自动', '短视频复刻', '口播种草']);
  expect(screen.getByText(/自动：按你的消息和素材挑一个合适的技能/)).toBeDefined();
  fireEvent.change(composer(), { target: { value: '做一条种草视频' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('skillKey');

  fireEvent.change(screen.getByRole('combobox', { name: '技能' }), { target: { value: 'talking-head-seeding' } });
  expect(screen.getByText('口播种草的说明')).toBeDefined();
  api.post.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  fireEvent.change(composer(), { target: { value: '换成口播' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByRole('button', { name: '重新发送' })).toBeDefined());
  expect(api.post.mock.calls[1][2]).toMatchObject({ text: '换成口播', skillKey: 'talking-head-seeding' });
  fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  expect(api.post.mock.calls[2][2]).toMatchObject({ clientMessageId: api.post.mock.calls[1][2].clientMessageId, skillKey: 'talking-head-seeding' });
});

test('one active skill, or a thread already bound to a skill, shows no choice', async () => {
  api.skills.mockResolvedValue([recreation]);
  const view = await ready();
  openGuide();
  await waitFor(() => expect(api.skills).toHaveBeenCalled());
  expect(screen.queryByRole('combobox', { name: '技能' })).toBeNull();
  view.unmount();

  api.skills.mockResolvedValue([recreation, seeding]);
  api.getConversation.mockResolvedValue({ ...emptyState, thread: { ...thread, skillKey: 'video-recreation', skillVersion: 2 } });
  await ready();
  openGuide();
  await screen.findByText('这段对话在按「短视频复刻」做。要换技能，在某条消息上点「从这里重新开始」。');
  expect(screen.queryByRole('combobox', { name: '技能' })).toBeNull();
  fireEvent.change(composer(), { target: { value: '继续' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('skillKey');
});

test('a plan card names the skill version it was planned with', async () => {
  api.skills.mockResolvedValue([recreation, seeding]);
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([{ ...planBlock, plan: { ...planBlock.plan, skillKey: 'video-recreation', skillVersion: 2 } }])] });
  await ready();
  const plan = screen.getByLabelText('制作计划');
  await waitFor(() => expect(within(plan).getByText('按技能：短视频复刻 v2')).toBeDefined());
  // A skill this page does not list (stopped since) still shows its version, never the raw key.
  seq = 3;
  emit(ev('plan.proposed', { messageId: 'm3', block: { ...planBlock, revision: 3, fingerprint: 'f3', plan: { ...planBlock.plan, skillKey: 'retired-skill', skillVersion: 4 } } }, { turnId: 't3' }));
  expect(screen.getByText('按技能 v4')).toBeDefined();
  expect(document.body.textContent).not.toContain('retired-skill');
});

test('400 STUDIO_SKILL_REQUIRED names the skills that fit, keeps the draft and opens the choice', async () => {
  api.skills.mockResolvedValue([recreation]);
  api.reloadSkills.mockResolvedValue([recreation, seeding]);
  await ready();
  api.post.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_SKILL_REQUIRED', message: '有几种做法', details: { skills: [
    { key: 'video-recreation', name: '短视频复刻', summary: '照着原片做' }, { key: 'talking-head-seeding', name: '口播种草', summary: '写口播配画面' }] } }, 400));
  fireEvent.change(composer(), { target: { value: '照着这条复刻一条口播' } });
  fireEvent.click(sendButton());
  // A question, not a failure: shown inline, never as an error notification.
  await screen.findByText('这条消息用「短视频复刻」或「口播种草」都能做，选一个技能再发，消息已经放回输入框');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(composer().value).toBe('照着这条复刻一条口播');
  expect(api.reloadSkills).toHaveBeenCalled();
  const picker = await screen.findByRole('combobox', { name: '技能' }) as HTMLSelectElement;
  expect([...picker.options].map(o => o.textContent)).toEqual(['自动', '短视频复刻', '口播种草']);
  fireEvent.change(picker, { target: { value: 'talking-head-seeding' } });
  expect(screen.queryByText(/这条消息用「短视频复刻」或「口播种草」都能做/)).toBeNull();
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2]).toMatchObject({ text: '照着这条复刻一条口播', skillKey: 'talking-head-seeding' });
});

const summaryMessage: StudioDialogueMessage = { id: 'm-sum', threadId: 'th', seq: 4, turnId: 'EXS-1', role: 'assistant', text: '两段都做好了。', blocks: [], status: 'done', createdAt: at,
  clientMessageId: 'exec-summary-X1', suggestions: ['改成横屏'] };
const draftRun = (over: Partial<IpRun> = {}): IpRun => ({ id: 'IPR-d', projectId: 'p', nodeId: 'X1', kind: 'studio-text', status: 'running', stage: 'queued', pct: 0, cost: 0, inputs: {}, output: {}, createdAt: at, ...over });

test('operators get 「把这次制作整理成技能草稿」 under a completion summary: cost confirmed, one request key, the draft waits for an admin', async () => {
  const { SKILL_DRAFT_POLL_MS } = await import('./studio-dialogue-skill-draft');
  SKILL_DRAFT_POLL_MS.value = 5;
  api.role = 'operator';
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [summaryMessage] });
  api.draft.mockResolvedValue(draftRun());
  api.getRun.mockImplementation(async (id: string) => id === 'IPR-d'
    ? draftRun({ status: 'done', stage: 'done', pct: 100, cost: 6, output: { skillDraft: { skillKey: 'video-recreation', version: 3, baseVersion: 2, changeNote: '口播段只换商品', strippedReferences: 2 } } as IpRun['output'] })
    : Promise.reject(new Error('没有这次运行')));
  await ready();
  const action = within(screen.getByRole('group', { name: '整理成技能草稿' }));
  fireEvent.click(action.getByRole('button', { name: '把这次制作整理成技能草稿' }));
  expect(api.confirm.mock.calls[0][0].content).toContain('最多 21 积分');
  expect(api.confirm.mock.calls[0][0].content).toContain('管理员在后台审阅');
  await waitFor(() => expect(api.draft).toHaveBeenCalledOnce());
  expect(api.draft.mock.calls[0][0]).toBe('p');
  expect(api.draft.mock.calls[0][1]).toMatchObject({ executionId: 'X1', maxCost: 21 });
  expect(api.draft.mock.calls[0][1].clientRequestId).toEqual(expect.any(String));
  await waitFor(() => expect(screen.getByText(/已存成技能草稿 v3，去掉了 2 处素材引用/)).toBeDefined());
  expect(screen.getByText(/要管理员在后台审阅、发布后才会生效/)).toBeDefined();
  expect(screen.queryByRole('button', { name: '把这次制作整理成技能草稿' })).toBeNull();
  SKILL_DRAFT_POLL_MS.value = 1500;
});

test('the draft entry is only for operators, only under a summary of finished work, and a 403 says why', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [summaryMessage] });
  const view = await ready();
  expect(screen.getByRole('group', { name: '接下来可以' })).toBeDefined();
  expect(screen.queryByRole('button', { name: '把这次制作整理成技能草稿' })).toBeNull();
  view.unmount();

  api.role = 'super_admin';
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [{ ...summaryMessage, clientMessageId: 'c-1' }] });
  const plain = await ready();
  expect(screen.queryByRole('button', { name: '把这次制作整理成技能草稿' })).toBeNull();
  plain.unmount();

  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [summaryMessage] });
  api.draft.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_SKILL_DRAFT_FORBIDDEN', message: '没有权限' }, 403));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '把这次制作整理成技能草稿' }));
  await waitFor(() => expect(screen.getByText('只有运营账号可以把制作整理成技能草稿。')).toBeDefined());
});

// ── Opening guidance: inventory chips, task cards and the recreation checklist ──────────────────────────────
const clip = { ...character, id: 'clip', type: 'video', title: '带货样片', metadata: { storageKey: 'k/clip' } } as CanvasNodeData;

test('an empty canvas opens on task cards and what the canvas holds; a chip pins every node of that type', async () => {
  await ready(<Host initial={[character, text, clip]}/>);
  expect(screen.getByRole('heading', { name: '想做点什么？' })).toBeDefined();
  expect(screen.getByText('画布上现在有')).toBeDefined();
  for (const title of ['复刻一条短视频', '做一张图', '写一段文字', '搭一套创作流程']) expect(screen.getByRole('button', { name: new RegExp(`^${title}`) })).toBeDefined();
  expect(screen.getByRole('button', { name: /^复刻一条短视频/ }).textContent).toContain('要准备：一条参考视频');
  fireEvent.click(screen.getByRole('button', { name: '1 张图片' }));
  expect(screen.getByLabelText('本次引用').textContent).toContain('角色 A');
  expect((screen.getByRole('button', { name: '1 张图片' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  // The guide is one click away and holds the notes that used to hide behind a settings icon.
  fireEvent.click(screen.getByRole('button', { name: '第一次用？花 30 秒看它怎么工作' }));
  expect(within(screen.getByRole('region', { name: '使用说明' })).getByText(/整张画布都会作为参考/)).toBeDefined();
  // Each step is a two-column grid (number + text). A bare text node beside <strong> becomes a third grid item and
  // drops into the 24px number column, one character per line; title and text must share one element.
  for (const li of screen.getByRole('region', { name: '使用说明' }).querySelectorAll('ol > li')) {
    expect(li.children.length).toBe(1);
    expect([...li.childNodes].every(n => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
  }
});

test('「复刻一条短视频」 pins the only video, drafts the request with blanks and holds the send until the pieces are there', async () => {
  api.skills.mockResolvedValue([skill('reference-video-recreation', '短视频复刻'), seeding]);
  await ready(<Host initial={[character, text, clip]}/>);
  await screen.findByRole('combobox', { name: '技能' });
  fireEvent.click(screen.getByRole('button', { name: /^复刻一条短视频/ }));
  const list = screen.getByLabelText('复刻需要的素材');
  expect(within(list).getByText('带货样片 · 画布上已有')).toBeDefined();
  expect(composer().value).toContain('@带货样片');
  expect((screen.getByRole('combobox', { name: '技能' }) as HTMLSelectElement).value).toBe('reference-video-recreation');
  // Blanks and a missing replacement keep the button off, with the reason beside it.
  expect(sendButton().disabled).toBe(true);
  expect(screen.getByText('先补上替换素材')).toBeDefined();
  expect(screen.queryByRole('heading', { name: '想做点什么？' })).toBeNull();
  fireEvent.click(within(list).getByRole('button', { name: '从画布选' }));
  fireEvent.click(screen.getByRole('option', { name: /角色 A/ }));
  expect(within(list).getByText('角色 A')).toBeDefined();
  expect(screen.getByText('把输入框里的空位补上')).toBeDefined();
  fireEvent.change(composer(), { target: { value: '照 @带货样片 的拍法，把里面的商品换成 @角色 A，保留节奏。' } });
  expect(sendButton().disabled).toBe(false);
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ skillKey: 'reference-video-recreation', pinnedNodeIds: ['clip', 'c'] });
  // Once sent, the checklist is gone.
  await waitFor(() => expect(screen.queryByLabelText('复刻需要的素材')).toBeNull());
});

test('the checklist can be dismissed and the plain composer rules take over', async () => {
  await ready(<Host initial={[character, clip]}/>);
  fireEvent.click(screen.getByRole('button', { name: /^复刻一条短视频/ }));
  expect(sendButton().disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '不用清单，直接说' }));
  expect(screen.queryByLabelText('复刻需要的素材')).toBeNull();
  expect(sendButton().disabled).toBe(false);
});

test('a dialogue-first start sends the prefilled brief once the thread is ready, exactly once, and never into a thread that already talked', async () => {
  const onAutoSent = vi.fn();
  await ready(<Host initial={[character]} initialPrompt="给星桥保温杯写三句广告语" autoSend onAutoSent={onAutoSent}/>);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '给星桥保温杯写三句广告语' });
  expect(onAutoSent).toHaveBeenCalled();
  expect(composer().value).toBe('');
  cleanup(); vi.clearAllMocks();
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 1, messages: [{ id: 'm0', threadId: 'th', seq: 1, role: 'assistant', turnId: 't0', status: 'done', text: '之前聊过', blocks: [], createdAt: at }] });
  api.subscribe.mockImplementation((options: DialogueStreamOptions) => { streams.push(options); return () => {}; });
  await ready(<Host initial={[character]} initialPrompt="再来一次" autoSend onAutoSent={onAutoSent}/>);
  await screen.findByText('之前聊过');
  expect(api.post).not.toHaveBeenCalled();
});

// Local e2e 2026-10-19: the assistant opens by default, so the home page brief arrives at a panel that is already open.
// The panel used to stash its (empty) composer for that canvas and restore it at once, and the brief never got in.
test('the homepage brief still goes out when it reaches a panel that was already open', async () => {
  const brief = { id: 'p-brief', type: 'text', title: '创作想法', position: { x: 0, y: 0 }, width: 480, height: 260,
    metadata: { content: '做一张 9:16 宣传图', prompt: '做一张 9:16 宣传图', studioStart: 'assistant', studio: { kind: 'assistant', conversation: { mode: 'general', turns: [] } } } } as CanvasNodeData;
  const onAutoSent = vi.fn();
  const view = await ready(<Host initial={[character]} conversations={[brief]}/>);
  expect(composer().value).toBe('');
  view.rerender(<Host initial={[character]} conversations={[brief]} initialNodeId="p-brief" initialPrompt="做一张 9:16 宣传图" autoSend onAutoSent={onAutoSent}/>);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '做一张 9:16 宣传图' });
  expect(onAutoSent).toHaveBeenCalled();
});

// Codex real-environment retest 2026-10-19: the server had imported the brief record as an old-conversation message, the
// thread did not look empty, and the brief was neither filled in nor sent.
test('history imported from the old assistant does not stop the homepage brief from going out', async () => {
  api.getConversation.mockResolvedValue({ thread, latestSeq: 1, messages: [
    { id: 'legacy-1', threadId: 'th', seq: 1, role: 'system', status: 'done', text: '之前的对话「创作想法」', blocks: [], createdAt: at, legacyNodeId: 'p-brief' },
  ] } as StudioDialogueState);
  const onAutoSent = vi.fn();
  const view = await ready(<Host initial={[character]}/>);
  view.rerender(<Host initial={[character]} initialNodeId="p-brief" initialPrompt="给星桥保温杯写三句广告语" autoSend onAutoSent={onAutoSent}/>);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '给星桥保温杯写三句广告语' });
  expect(onAutoSent).toHaveBeenCalled();
});

test('without auto-send the brief fills the composer of an empty thread and leaves a typed draft alone', async () => {
  const view = await ready(<Host/>);
  view.rerender(<Host initialNodeId="p-brief" initialPrompt="首页写的那句"/>);
  await waitFor(() => expect(composer().value).toBe('首页写的那句'));
  expect(api.post).not.toHaveBeenCalled();
  cleanup();
  localStorage.setItem('studio-assistant:draft:p', JSON.stringify({ text: '我自己改过的', pinnedIds: [], attachmentIds: [] }));
  await ready(<Host initialNodeId="p-brief" initialPrompt="首页写的那句"/>);
  await waitFor(() => expect(composer().value).toBe('我自己改过的'));
});

test('an unsent draft and its references survive a refresh, and a sent message does not come back', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '写到一半的话' } });
  act(() => { window.dispatchEvent(new CustomEvent('studio-command', { detail: { action: 'assistant', nodeId: 't' } })); });
  await screen.findByRole('button', { name: '移除引用 台词 B' });
  cleanup();
  await ready();
  await waitFor(() => expect(composer().value).toBe('写到一半的话'));
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '写到一半的话', pinnedNodeIds: ['t'] });
  cleanup();
  await ready();
  expect(composer().value).toBe('');
});

// Browser walkthrough 2026-10-19 (dev runs StrictMode): the panel wrote its draft from an unmount, the double-run unmount
// saw the composer before the restored draft reached state, and wiped the draft it had just restored.
test('under StrictMode a saved draft is restored and stays saved', async () => {
  localStorage.setItem('studio-assistant:draft:p', JSON.stringify({ text: '刷新前写的', pinnedIds: ['t'], attachmentIds: [] }));
  await ready(<StrictMode><Host/></StrictMode>);
  await waitFor(() => expect(composer().value).toBe('刷新前写的'));
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(JSON.parse(localStorage.getItem('studio-assistant:draft:p')!)).toMatchObject({ text: '刷新前写的', pinnedIds: ['t'] });
  fireEvent.change(composer(), { target: { value: '刷新前写的，又补了一句' } });
  expect(JSON.parse(localStorage.getItem('studio-assistant:draft:p')!).text).toBe('刷新前写的，又补了一句');
});

test('a restored draft drops references to nodes that left the canvas', async () => {
  localStorage.setItem('studio-assistant:draft:p', JSON.stringify({ text: '继续', pinnedIds: ['gone', 't'], attachmentIds: ['gone-too'] }));
  await ready();
  await waitFor(() => expect(composer().value).toBe('继续'));
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(sendButton().disabled).toBe(false);
});

test('the chosen reply model is remembered for this canvas after a refresh', async () => {
  await ready();
  fireEvent.change(screen.getByRole('combobox', { name: '助手模型' }), { target: { value: 'two' } });
  cleanup();
  await ready();
  expect((screen.getByRole('combobox', { name: '助手模型' }) as HTMLSelectElement).value).toBe('two');
  fireEvent.change(composer(), { target: { value: '用便宜的那个回答' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  // Release line: the turn ceiling is the remembered model's (8, not model one's 21). Sending the model itself
  // comes from main's b7861a4b, which is not on this release line, so it is not asserted here.
  expect(api.post.mock.calls[0][2]).toMatchObject({ maxCost: 8 });
});

const longReply = '末世英雄·林烬：三十岁出头，左眼有一道旧疤，穿改装过的防化服，背一把自制弩。外冷内热，嘴上不饶人，遇到孩子会先把干粮分出去。';
const replied = (text: string): StudioDialogueState => ({ thread: { ...thread, lastSeq: 2 }, latestSeq: 2, messages: [
  { id: 'u0', threadId: 'th', seq: 1, role: 'user', status: 'done', text: '写一个末世英雄的角色描述', blocks: [], createdAt: at },
  { id: 'a0', threadId: 'th', seq: 2, role: 'assistant', turnId: 't0', status: 'done', text, blocks: [], createdAt: at },
] } as StudioDialogueState);

// Production 2026-10-19: 「写一段文字」 promises the draft lands on the canvas; a paid character description stayed in the chat.
test('「放进画布」 turns a finished reply into a text node once, and shows the existing one after that', async () => {
  api.getConversation.mockResolvedValue(replied(longReply));
  let latest: CanvasNodeData[] = [];
  await ready(<Host initial={[character]} onCanvas={(nodes: CanvasNodeData[]) => { latest = nodes; }}/>);
  fireEvent.click(await screen.findByRole('button', { name: '放进画布' }));
  await waitFor(() => expect(latest.some(n => n.type === 'text' && n.metadata?.content === longReply)).toBe(true));
  expect(api.save).toHaveBeenCalled();
  expect(latest.find(n => n.metadata?.content === longReply)?.title).toBe('末世英雄·林烬');
  fireEvent.click(screen.getByRole('button', { name: '放进画布' }));
  await waitFor(() => expect(api.success).toHaveBeenLastCalledWith('画布上已经有这段文字'));
  expect(latest.filter(n => n.metadata?.content === longReply)).toHaveLength(1);
});

test('older replies show their raw action blocks folded, not as the assistant talking', async () => {
  api.getConversation.mockResolvedValue(replied('我先看看画布。\n<tool_call>{"tool":"read_canvas","args":{}}</tool_call>'));
  await ready();
  const reply = await screen.findByText('我先看看画布。');
  expect(reply.textContent).not.toContain('<tool_call>');
  const raw = screen.getByText('这一轮的操作原文').closest('details') as HTMLDetailsElement;
  expect(raw.open).toBe(false);
  expect(raw.textContent).toContain('read_canvas');
  expect(screen.queryByRole('button', { name: '放进画布' })).toBeNull();
});

test('a homepage brief that copies a reference video opens the checklist and waits instead of sending', async () => {
  const view = await ready(<Host initial={[character]}/>);
  view.rerender(<Host initial={[character]} initialNodeId="p-brief" initialPrompt="照这条视频的拍法，把里面的商品换成我的" autoSend/>);
  expect(await screen.findByLabelText('复刻需要的素材')).toBeDefined();
  expect(composer().value).toBe('照这条视频的拍法，把里面的商品换成我的');
  expect(sendButton().disabled).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(api.post).not.toHaveBeenCalled();
});

test('the first message names a canvas nobody named; a name the user gave is kept', async () => {
  useCanvasStore.setState({ projects: [{ id: 'p', title: '全能创作 · 新画布', nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } as never] });
  await ready();
  fireEvent.change(composer(), { target: { value: '给星桥保温杯写一句广告语' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(useCanvasStore.getState().projects[0].title).toBe('给星桥保温杯写一句广告语');
  cleanup(); vi.clearAllMocks(); streams = [];
  api.getConversation.mockResolvedValue(emptyState); api.save.mockResolvedValue(undefined);
  api.subscribe.mockImplementation((options: DialogueStreamOptions) => { streams.push(options); return () => {}; });
  api.post.mockResolvedValue({ messageId: 'u1', turnId: 't1', runId: 'r1', queueState: 'accepted' });
  api.skills.mockResolvedValue([]);
  useCanvasStore.setState({ projects: [{ id: 'p', title: '我的保温杯广告', nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } as never] });
  await ready();
  fireEvent.change(composer(), { target: { value: '再来一句' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(useCanvasStore.getState().projects[0].title).toBe('我的保温杯广告');
  useCanvasStore.setState({ projects: [] });
});

test('nodes the assistant creates are brought into view and the first time shows a one-time hint about the canvas', async () => {
  localStorage.clear();
  const reveal = vi.fn();
  window.addEventListener('studio-command', e => { const d = (e as CustomEvent).detail; if (d.action === 'reveal') reveal(d.nodeId); });
  await ready(<Host initial={[character]}/>);
  emit(ev('node.upsert', { nodeId: 'new-1', op: 'create', node: { id: 'new-1', type: 'text', title: '口播稿', position: { x: 0, y: 0 }, width: 320, height: 200, metadata: { content: '第一版' } } }));
  await waitFor(() => expect(reveal).toHaveBeenCalledWith('new-1'));
  expect(screen.getByText(/结果放进画布了/)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(screen.queryByText(/结果放进画布了/)).toBeNull();
  expect(localStorage.getItem('studio-assistant:canvas-hint')).toBe('1');
});

// 2026-10-19 walkthrough: Enter only added a line (the home page's box sends on Enter), and 「问助手」 did nothing once a
// draft existed — the assistant opens by default, so a draft always existed.
test('Enter sends and Shift+Enter starts a new line', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '第一行' } });
  fireEvent.keyDown(composer(), { key: 'Enter', shiftKey: true });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.keyDown(composer(), { key: 'Enter' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '第一行' });
});

test('「问助手」 adds the node to this message and keeps what was already typed', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '写到一半' } });
  act(() => { window.dispatchEvent(new CustomEvent('studio-command', { detail: { action: 'assistant', nodeId: 't' } })); });
  expect(await screen.findByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(composer().value).toBe('写到一半');
  act(() => { window.dispatchEvent(new CustomEvent('studio-command', { detail: { action: 'assistant', nodeId: 'c' } })); });
  expect(await screen.findByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
});
