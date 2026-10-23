// @vitest-environment jsdom
import { StrictMode, cloneElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  getConversation: vi.fn(), post: vi.fn(), subscribe: vi.fn(), control: vi.fn(), branch: vi.fn(), list: vi.fn(), threads: vi.fn(), createThread: vi.fn(), openThread: vi.fn(),
  createExecution: vi.fn(), getExecution: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), accept: vi.fn(),
  save: vi.fn(), importStudioStory: vi.fn(), importStudioMedia: vi.fn(), submitStudioRun: vi.fn(), readRun: vi.fn(), getRun: vi.fn(), success: vi.fn(), error: vi.fn(),
  skills: vi.fn(), reloadSkills: vi.fn(), draft: vi.fn(), confirm: vi.fn(), role: null as string | null,
}));
vi.mock('@/canvas-bridge/studio-dialogue', () => ({ getStudioConversation: api.getConversation, postStudioDialogueMessage: api.post, subscribeStudioDialogue: api.subscribe,
  controlStudioDialogue: api.control, branchStudioDialogue: api.branch, listStudioDialogueMessages: api.list,
  listStudioDialogueThreads: api.threads, createStudioDialogueThread: api.createThread, openStudioDialogueThread: api.openThread,
  // Catch-up reads of the conversation shown (read only, by id) answer like the conversation fixture.
  getStudioDialogueThread: (projectId: string) => api.getConversation(projectId) }));
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
vi.mock('./studio-floating-panel', () => ({ StudioFloatingPanel: ({ open, title, titleExtra, actions, subheader, children, onClose, footer }: any) => open ? <section role="dialog" aria-label={title}><header>{title}{titleExtra}{actions}<button aria-label={`关闭${title}`} onClick={onClose}>关闭</button></header>{subheader}{children}{footer}</section> : null }));
vi.mock('./studio-conversation-share', () => ({ StudioConversationShare: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: ({ locked, reading, onFiles }: any) => <div><button disabled={locked}>{reading ? '正在导入附件' : '添加附件'}</button><input type="file" aria-label="上传创作附件" multiple onChange={e => onFiles(Array.from(e.target.files || []))}/></div> }));
vi.mock('./library-reference-picker', () => ({ LibraryReferencePicker: () => null }));
vi.mock('antd', () => ({ App: { useApp: () => ({ message: { success: api.success, error: api.error }, modal: { confirm: (options: any) => { api.confirm(options); return options.onOk?.(); } } }) },
  Button: ({ loading, icon, danger: _danger, size: _size, ...p }: any) => <button {...p} disabled={p.disabled || loading}>{icon}{p.children}</button>,
  Input: { TextArea: forwardRef(({ autoSize: _autoSize, ...p }: any, ref) => { const el = useRef<HTMLTextAreaElement>(null); useImperativeHandle(ref, () => ({ focus: () => el.current?.focus() })); return <textarea ref={el} {...p}/>; }) },
  Select: ({ options, value, onChange, ...p }: any) => <select {...p} value={value || ''} onChange={e => onChange(e.target.value || undefined)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  Popover: ({ open, onOpenChange, content, children }: any) => <>{cloneElement(children, { onClick: () => onOpenChange(!open) })}{open && content}</> }));

const at = '2026-10-18T01:00:00Z';
const thread = { id: 'th', projectId: 'p', lastSeq: 0, createdAt: at, updatedAt: at };
const emptyState: StudioDialogueState = { thread, messages: [], latestSeq: 0 };
const character = { id: 'c', type: 'image', title: '角色 A', position: { x: 20, y: 20 }, width: 320, height: 400, metadata: { prompt: '紫发角色' } } as CanvasNodeData;
const text = { ...character, id: 't', type: 'text', title: '台词 B', metadata: { content: '原台词', studio: { kind: 'text' } } } as CanvasNodeData;
const legacy = { ...text, id: 'h', title: '导演执导', metadata: { studio: { kind: 'assistant', request: { clientRequestId: 'old', nodeId: 'h', operation: 'assistant', prompt: '讨论', contextNodeIds: ['t'] },
  conversation: { mode: 'director', turns: [{ role: 'user', content: '讨论' }, { role: 'assistant', content: '之前的建议' }] } } } } as CanvasNodeData;
const capabilities = { mock: false, operations: ['assistant'], imageCost: 8, textCost: 2, videoCost: null, textModelMode: 'selectable' as const,
  textModels: [{ endpointId: 'one', name: '模型一', isDefault: true, dialogueTokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 1048576, maxOutputTokens: 65536, maxCost: 260 }, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 20.4 } },
    { endpointId: 'two', name: '模型二', isDefault: false, dialogueTokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 524288, maxOutputTokens: 32768, maxCost: 130 }, tokenPricing: { inputCreditsPerK: .18, outputCreditsPerK: 1.08, maxInputTokens: 65536, maxOutputTokens: 8192, maxCost: 8 } }] };

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

test('the composer stays editable while a reply streams, and a tool event renders a folded work record', async () => {
  await ready();
  emit(ev('message.delta', { messageId: 'm1', partId: 'a', delta: '我先看一下' }), ev('message.delta', { messageId: 'm1', partId: 'a', delta: '素材' }),
    ev('tool.started', { toolCallId: 'x', toolName: 'read_canvas', title: '读取画布素材', safeInputSummary: '画布上 3 个节点' }));
  expect(screen.getByText('我先看一下素材')).toBeDefined();
  const card = screen.getByLabelText('工作记录：读取画布素材');
  // A log line, not a button: only the small chevron opens the details, and they start closed.
  const toggle = within(card).getByRole('button', { name: '展开详情：读取画布素材' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(within(card).getAllByRole('button')).toHaveLength(1);
  expect(within(card).getByText(/进行中/)).toBeDefined();
  // A running tool says so on its own line; no second 「正在…」 row repeats it.
  expect(card.getAttribute('data-status')).toBe('running');
  expect(screen.queryByText('正在读取画布素材')).toBeNull();
  fireEvent.click(toggle);
  expect(within(card).getByRole('button', { name: '收起详情：读取画布素材' }).getAttribute('aria-expanded')).toBe('true');
  expect(within(card).getByText('待结算')).toBeDefined();
  expect(card.textContent).not.toContain('read_canvas');
  expect(composer().disabled).toBe(false);
  fireEvent.change(composer(), { target: { value: '第 3 段换成这张图' } });
  expect(sendButton().disabled).toBe(false);
  expect(screen.getByRole('button', { name: '停止' })).toBeDefined();
  api.post.mockResolvedValueOnce({ messageId: 'u2', turnId: 't1', queueState: 'queued' });
  fireEvent.click(sendButton());
  // Queued is a small icon under the bubble, named for screen readers and the hover tip; not a line of text (2026-10-21).
  await waitFor(() => expect(screen.getByRole('img', { name: '排队中，下一步应用' })).toBeDefined());
  expect(screen.queryByText('排队中，下一步应用')).toBeNull();
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '第 3 段换成这张图', maxCost: 260, model: 'one' });
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
  // A failed send needs the user: it stays words with its retry, unlike the delivery icons.
  expect(screen.getByText(/没有确认送达/).classList.contains('is-failed')).toBe(true);
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
  // A message that would not fit the stage budget is the same kind of answer: it says by how much and keeps the draft.
  api.post.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_PLAN_BUDGET_EXCEEDED', message: '预算不够，还差 30 积分。可以追加预算或缩小计划后再继续',
    details: { stage: 'production', spent: 100, inFlight: 10, quotedCost: 20, approvedCap: 100, shortfall: 30 } }, 402));
  fireEvent.change(composer(), { target: { value: '第 2 段换成横屏' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getAllByRole('alert').map(e => e.textContent).join(' ')).toContain('积分超出上限，还差 30 积分'));
  expect(composer().value).toBe('第 2 段换成横屏');
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

const skill = (key: string, name: string, extra: Partial<StudioSkillSummary> = {}): StudioSkillSummary => ({ key, name, version: 1, status: 'active', planning: 'dynamic', summary: `${name}的说明`,
  methodExamples: [], operations: { analysis: ['text'], production: ['text', 'video'] }, limits: { maxSourceSec: 60, maxSegments: 4, maxSegmentSec: 'model', maxSteps: 16, maxAutoFixPerSegment: 1 },
  checks: [], autoFixChecks: [], requiredCapabilities: [], ...extra });
const recreation = skill('video-recreation', '短视频复刻', { version: 2 }), seeding = skill('talking-head-seeding', '口播种草');

const planBlock: Extract<StudioMessageBlock, { type: 'plan' }> = { type: 'plan', planRunId: 'plan-2', revision: 2, fingerprint: 'f2', plan: { summary: '按两段重做', questions: [], stage: 'production', recommendedApproachId: 'keep',
  steps: [{ id: 'v1', operation: 'video', title: '第 1 段视频', prompt: '', referenceNodeIds: [], quotedCost: 40 }, { id: 'v2', operation: 'video', title: '第 2 段视频', prompt: '', referenceNodeIds: [], quotedCost: 42 }],
  approaches: [{ id: 'alt', title: '关键画面重做', summary: '第 2 段重新设计', rationale: '', preserve: [], change: ['第 2 段画面'], tradeoffs: ['报价更高'], requiredCapabilities: [] },
    { id: 'keep', title: '保留动作换商品', summary: '只换商品和台词', rationale: '', preserve: ['动作'], change: ['商品'], tradeoffs: [], requiredCapabilities: [] }], budget: { estimated: 82, autoFixCap: 40 } } };
const approvalBlock: Extract<StudioMessageBlock, { type: 'approval' }> = { type: 'approval', approvalId: 'a2', stage: 'production', planFingerprint: 'f2', scope: ['第 1 段视频', '第 2 段视频'], quotedCost: 82, budgetCap: 122, autoFixCap: 40, status: 'pending', executionId: 'e1' };
const planMessage = (blocks: StudioMessageBlock[]): StudioDialogueMessage => ({ id: 'm2', threadId: 'th', seq: 3, turnId: 't2', role: 'assistant', text: '推荐保留原片动作。', blocks, status: 'done', createdAt: at });

test('a plan without a card shows the recommended approach first, what will be made and nothing about price or skill; choosing another sends that choice', async () => {
  api.skills.mockResolvedValue([recreation, seeding]);
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([{ ...planBlock, plan: { ...planBlock.plan, skillKey: 'video-recreation', skillVersion: 2 } }])] });
  await ready();
  const plan = screen.getByLabelText('制作计划');
  // The skill it was planned with is only a hover detail (the panel's skill chip says it); never visible text.
  await waitFor(() => expect(within(plan).getByRole('heading', { name: '制作计划' }).getAttribute('title')).toBe('按技能：短视频复刻 v2'));
  expect(plan.textContent).not.toContain('按技能');
  expect(within(plan).getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['做法：保留动作换商品', '做法：关键画面重做']);
  expect(within(plan).getByText('推荐')).toBeDefined();
  // No per-step quote, no budget, no revision, no tradeoffs: a plan says what will be made.
  expect(plan.textContent).not.toMatch(/积分|第 2 版|报价更高|取舍|重做额度/);
  expect(within(plan).getByText('第 1 段视频')).toBeDefined();
  fireEvent.change(composer(), { target: { value: '我自己写到一半的话' } });
  fireEvent.click(within(plan).getByRole('button', { name: '改用这个做法' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '改用「关键画面重做」这个做法，重新报价' });
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('pinnedNodeIds');
  expect(composer().value).toBe('我自己写到一半的话');
  // A skill this page does not list (stopped since) still shows its version, never the raw key.
  seq = 3;
  emit(ev('plan.proposed', { messageId: 'm3', block: { ...planBlock, revision: 3, fingerprint: 'f3', plan: { ...planBlock.plan, skillKey: 'retired-skill', skillVersion: 4 } } }, { turnId: 't3' }));
  expect(screen.getAllByRole('heading', { name: '制作计划' }).at(-1)!.getAttribute('title')).toBe('按技能 v4');
  expect(document.body.textContent).not.toContain('retired-skill');
});

test('confirming production posts the execution, approach, plan revision, approval and the confirming message', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock, approvalBlock])] });
  api.createExecution.mockResolvedValue({ id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'plan-2', planRevision: 2, planFingerprint: 'f2', status: 'running', steps: [], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  await ready();
  // 「先改改」 only focuses the composer.
  fireEvent.click(screen.getByRole('button', { name: '先改改' }));
  expect(document.activeElement).toBe(composer());
  expect(api.createExecution).not.toHaveBeenCalled();
  // The plan quoted with the card rides on it: one card, no separate 「制作计划」.
  expect(screen.queryByLabelText('制作计划')).toBeNull();
  const card = screen.getByLabelText('确认制作');
  expect(within(card).getByText('第 1 段视频')).toBeDefined();
  // The quote is the one number on it; caps, reserve, expiry and how to confirm by typing are not explained.
  expect(within(card).getByText('82')).toBeDefined();
  expect(within(card).queryByRole('spinbutton')).toBeNull();
  expect(card.textContent).not.toMatch(/上限|预留|过期|直接回复|按实际用量|等你确认/);
  fireEvent.click(within(card).getByRole('button', { name: '开始制作' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.save).toHaveBeenCalled();
  // The caps the server proposed go with the confirmation unchanged.
  expect(api.createExecution.mock.calls[0]).toEqual(['p', { clientRequestId: expect.any(String), stage: 'production', planRunId: 'plan-2', planFingerprint: 'f2', budgetCap: 122, autoFixCap: 40,
    approvalId: 'a2', confirmationMessageId: 'm2', executionId: 'e1', approachId: 'keep', expectedRevision: 2 }]);
  await waitFor(() => expect(within(screen.getByLabelText('确认制作')).getByText('已确认 · 82 积分')).toBeDefined());
  expect(within(screen.getByLabelText('确认制作')).queryByRole('button', { name: '开始制作' })).toBeNull();
  expect(screen.getByLabelText('制作进度')).toBeDefined();
  // The server then closes the synthetic turn of the confirmation: nothing is left running in the timeline.
  seq = 3;
  emit(ev('approval.required', { messageId: 'm2', block: { ...approvalBlock, status: 'approved', executionId: 'e1', approvedBudgetCap: 122, approvedAutoFixCap: 40, approvedAt: at } }, { turnId: 'APR-1', executionId: 'e1' }),
    ev('turn.done', { reason: 'completed', messageId: 'm2', settling: false }, { turnId: 'APR-1', executionId: 'e1' }));
  await waitFor(() => expect(within(screen.getByLabelText('确认制作')).getByText('已确认 · 82 积分')).toBeDefined());
  // The production strip keeps its own 停止; the composer's (a reply in progress) is gone.
  expect(screen.getAllByRole('button', { name: '停止' }).filter(b => !b.closest('[aria-label="制作进度"]'))).toHaveLength(0);
  expect(screen.queryByText('正在准备回复')).toBeNull();
  expect(screen.getAllByLabelText('Studio 的回复')).toHaveLength(1);
});

test('analysis is created without an execution; replaced and expired cards cannot be approved', async () => {
  const analysisPlan = { ...planBlock, planRunId: 'plan-1', revision: 1, fingerprint: 'f1', plan: { ...planBlock.plan, stage: 'analysis' as const, approaches: [] } };
  const analysis = { ...approvalBlock, approvalId: 'a1', stage: 'analysis' as const, planFingerprint: 'f1', quotedCost: 26, budgetCap: 30, autoFixCap: 0, executionId: undefined };
  const old = { ...approvalBlock, approvalId: 'a0', status: 'superseded' as const }, expired = { ...approvalBlock, approvalId: 'a9', planFingerprint: 'f9', expiresAt: '2026-01-01T00:00:00Z' };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [{ ...planMessage([old, expired]), id: 'm0', seq: 1 }, planMessage([analysisPlan, analysis])] });
  api.createExecution.mockResolvedValue({ id: 'e9', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'analysis', planRunId: 'plan-1', planRevision: 1, planFingerprint: 'f1', status: 'running', steps: [], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  await ready();
  expect(screen.queryAllByRole('button', { name: '开始制作' })).toHaveLength(0);
  expect(screen.getByText('已有新的报价，见下方')).toBeDefined();
  expect(screen.getByText('报价已过期')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '开始分析' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  const request = api.createExecution.mock.calls[0][1];
  expect(request).toMatchObject({ stage: 'analysis', planRunId: 'plan-1', planFingerprint: 'f1', budgetCap: 30, autoFixCap: 0, approvalId: 'a1' });
  expect(request).not.toHaveProperty('executionId');
  expect(request).not.toHaveProperty('approachId');
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
  await waitFor(() => expect(Number(localStorage.getItem('studio-dialogue-canvas-seq:th'))).toBe(upsert.seq));
});

// Codex 2026-10-19 (P1): the node was recorded as projected and the event acknowledged before the canvas was saved. When
// that save failed, reopening on the same browser skipped the node for good (a recorded node reads as one the user
// deleted) while its video task kept running. Both records now wait for the save.
test('a canvas command whose save failed is neither recorded as projected nor skipped on the next open', async () => {
  let canvas: CanvasNodeData[] = [];
  api.save.mockRejectedValue(new Error('画布保存失败，请先重试保存'));
  await ready(<Host onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  emit(ev('message.delta', { messageId: 'm1', partId: 'a', delta: '好的' }));
  const seen = seq;
  const upsert = ev('node.upsert', { nodeId: 'e1-seg-1', op: 'create', executionId: 'e1', stepId: 'v1', runId: 'run-v1',
    node: { id: 'e1-seg-1', type: 'video', title: '第 1 段', position: { x: 0, y: 0 }, width: 360, height: 640, metadata: { status: 'success', storageKey: 'k/v1' } } }, { executionId: 'e1' });
  emit(upsert);
  await waitFor(() => expect(canvas.some(n => n.id === 'e1-seg-1')).toBe(true));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  await settle();
  expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]')).not.toContain('e1-seg-1');
  expect(Number(localStorage.getItem('studio-dialogue-canvas-seq:th') || 0)).toBeLessThan(upsert.seq);
  expect(Number(localStorage.getItem('studio-dialogue-canvas-seq:th') || 0)).toBeLessThanOrEqual(seen);
  // The next successful save records it and moves the cursor past it.
  api.save.mockResolvedValue(undefined);
  emit(ev('node.upsert', { nodeId: 'new-2', op: 'create', node: { id: 'new-2', type: 'text', title: '口播稿', position: { x: 0, y: 0 }, width: 320, height: 200, metadata: { content: '第一版' } } }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]')).toEqual(expect.arrayContaining(['e1-seg-1', 'new-2'])));
  await waitFor(() => expect(Number(localStorage.getItem('studio-dialogue-canvas-seq:th'))).toBe(seq));
});

// Codex retest 2026-10-19 (R2): the assistant made a node, the save answered 500, the tab was closed and reopened —
// the conversation was back but the node was not. Brand-new thread, events exactly as a create_nodes turn sends them.
test.each([['after some prose', true], ['as the first event of a new thread', false]])('an assistant node whose save failed comes back when the canvas is closed and opened again (%s)', async (_label, prose) => {
  let canvas: CanvasNodeData[] = [];
  api.save.mockRejectedValue(new Error('画布保存失败，请先重试保存'));
  const view = await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  const turn = [
    ...(prose ? [ev('message.delta', { messageId: 'm1', partId: 'a', delta: '开始搭建。' }), ev('tool.started', { toolCallId: 'x', toolName: 'create_nodes', title: '搭建画布' })] : []),
    ev('node.upsert', { nodeId: 'dlg-1', op: 'create', node: { id: 'dlg-1', type: 'text', title: '测试节点', position: { x: 0, y: 0 }, width: 320, height: 200, metadata: { content: '正文' } } }),
    ev('tool.finished', { toolCallId: 'x', toolName: 'create_nodes', status: 'done', result: { summary: '建了 1 个' }, creditsActual: 0, settling: false }),
    ev('message.delta', { messageId: 'm1', partId: 'b', delta: '放进画布了。' }),
    ev('turn.done', { reason: 'completed', messageId: 'm1' }),
  ];
  emit(...turn);
  await waitFor(() => expect(canvas.some(n => n.id === 'dlg-1')).toBe(true), { timeout: 5000 });
  await waitFor(() => expect(api.save).toHaveBeenCalled(), { timeout: 5000 });
  // Wait for the failed save itself to settle (its handler keeps the cursor below the batch), then for the cursor write.
  await act(async () => { await Promise.allSettled(api.save.mock.results.map(r => r.value)); });
  await waitFor(() => expect(localStorage.getItem('studio-dialogue-canvas-seq:th')).not.toBeNull());
  await settle();
  const upsert = turn.find(e => e.type === 'node.upsert')!;
  const stored = localStorage.getItem('studio-dialogue-canvas-seq:th');
  expect(stored).not.toBeNull();
  expect(Number(stored)).toBeLessThan(upsert.seq);
  view.unmount();
  // Reopen: the server has the conversation (latestSeq = the whole turn) and a document without the node.
  api.save.mockResolvedValue(undefined); streams = []; api.subscribe.mockClear();
  api.getConversation.mockResolvedValue({ thread: { ...thread, lastSeq: seq }, latestSeq: seq, messages: [
    { id: 'u1', threadId: 'th', seq: 1, role: 'user', status: 'done', text: '建一个测试节点', blocks: [], createdAt: at },
    { id: 'm1', threadId: 'th', seq: 2, role: 'assistant', turnId: 't1', status: 'done', text: '开始搭建。放进画布了。', blocks: [], createdAt: at },
  ] } as StudioDialogueState);
  canvas = [];
  await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  const after = streams.at(-1)!.cursor();
  expect(after).toBeLessThan(upsert.seq);
  act(() => { for (const e of turn) if (e.seq > after) streams.at(-1)!.onEvent(e); });
  await waitFor(() => expect(canvas.some(n => n.id === 'dlg-1')).toBe(true), { timeout: 5000 });
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
  expect(within(second).getByText('你改过这段内容，这份修改稿不再适用')).toBeDefined();
  expect((within(second).getByRole('button', { name: '采用' }) as HTMLButtonElement).disabled).toBe(true);
  expect(canvas.find(n => n.id === 't')?.metadata?.content).toBe('我刚手改的台词');
});

// User feedback 2026-10-20: chips only filled the composer, so two clicks stacked two answers there. A click now sends.
test('a question option and a follow-up suggestion each send at once, keep the draft and its pins, and cannot answer twice', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 2, messages: [{ ...planMessage([{ type: 'question', questionId: 'q', text: '新商品是哪一款？', options: ['洗衣液', '护手霜'] }]), seq: 2 }] });
  await ready(<Host selectedIds={['c']}/>);
  fireEvent.change(composer(), { target: { value: '草稿还没写完' } });
  let accept!: (value: unknown) => void;
  api.post.mockImplementationOnce(() => new Promise(resolve => { accept = resolve; }));
  const question = screen.getByRole('group', { name: '问题：新商品是哪一款？' });
  fireEvent.click(within(question).getByRole('button', { name: '洗衣液' }));
  // A second click (the same option or the other one) while the first is on its way sends nothing more.
  fireEvent.click(within(question).getByRole('button', { name: '洗衣液' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: '护手霜' })).toBeNull();
  expect(within(question).getByText(/已回答/)).toBeDefined();
  // The draft's pin (角色 A) stays with the draft: the quick reply carries no references.
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '洗衣液' });
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('pinnedNodeIds');
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('attachmentNodeIds');
  expect(composer().value).toBe('草稿还没写完');
  expect(screen.getByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  await act(async () => { accept({ messageId: 'u3', turnId: 't3', queueState: 'accepted' }); });
  // Accepted, nothing back yet: the turn says it is thinking.
  expect(screen.getByText('正在思考')).toBeDefined();
  seq = 2;
  emit(ev('message.delta', { messageId: 'm3', partId: 'a', delta: '做好了' }, { turnId: 't3' }));
  expect(screen.queryByText('正在思考')).toBeNull();
  expect(screen.getByText('正在回复')).toBeDefined();
  emit(ev('turn.done', { reason: 'completed', messageId: 'm3', suggestions: ['改成横屏', '保存成模板'] }, { turnId: 't3' }));
  expect(screen.queryByText('正在回复')).toBeNull();
  const suggestions = screen.getByRole('group', { name: '接下来可以' });
  fireEvent.click(within(suggestions).getByRole('button', { name: /保存成模板/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2]).toMatchObject({ text: '保存成模板' });
  expect(api.post.mock.calls[1][2]).not.toHaveProperty('pinnedNodeIds');
  expect(api.post.mock.calls[1][2].clientMessageId).not.toBe(api.post.mock.calls[0][2].clientMessageId);
  expect(composer().value).toBe('草稿还没写完');
  // Accepted: the follow-ups are closed, so a second click after the first one returned cannot send it again.
  await waitFor(() => expect(screen.queryByRole('group', { name: '接下来可以' })).toBeNull());
  expect(api.post).toHaveBeenCalledTimes(2);
});

// Codex review 2026-10-20: a second click on 「改用这个做法」 after the first was accepted got a new message key.
test('the same quick reply is not sent again while nothing has come back for it', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([planBlock])] });
  await ready();
  const choose = () => fireEvent.click(within(screen.getByLabelText('制作计划')).getByRole('button', { name: '改用这个做法' }));
  choose();
  await waitFor(() => expect(screen.getByText('改用「关键画面重做」这个做法，重新报价')).toBeDefined());
  choose();
  await act(async () => { await Promise.resolve(); });
  expect(api.post).toHaveBeenCalledOnce();
});

test('a tool the turn never closed stops spinning when the turn fails', async () => {
  await ready();
  emit(ev('tool.started', { toolCallId: 'x', toolName: 'read_canvas', title: '查看画布' }), ev('turn.done', { reason: 'failed', messageId: 'm1' }));
  const card = screen.getByLabelText('工作记录：查看画布');
  expect(card.getAttribute('data-status')).toBe('failed');
  expect(within(card).getByText('没有完成')).toBeDefined();
  expect(within(card).queryByText(/进行中/)).toBeNull();
  expect(screen.queryByText('正在思考')).toBeNull();
});

test('a quick reply the server refuses lands in an empty composer to edit, and never overwrites a draft', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 2, messages: [{ ...planMessage([{ type: 'question', questionId: 'q', text: '新商品是哪一款？', options: ['洗衣液'] }]), seq: 2 }] });
  api.post.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_DIALOGUE_BUSY', message: '上一条还在处理' }, 409));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '洗衣液' }));
  await waitFor(() => expect(screen.getAllByRole('alert').map(e => e.textContent).join(' ')).toContain('上一条还在处理'));
  expect(composer().value).toBe('洗衣液');
  // Not answered after all: the option is offered again.
  expect(screen.getByRole('button', { name: '洗衣液' })).toBeDefined();
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
    budgets: [{ stage: 'production' as const, approvedCap: 120, autoFixCap: 40, spent: 40, inFlight: 40, remaining: 40, dialogueSpent: 3, dialogueInFlight: 20 }], startedAt: at, deadlineAt: at, updatedAt: at };
  api.getConversation.mockResolvedValue({ ...emptyState, thread: { ...thread, activeExecutionId: 'e1' }, execution });
  api.pause.mockResolvedValue({ ...execution, status: 'paused', updatedAt: '2026-10-18T01:00:05Z' });
  api.cancel.mockResolvedValue({ ...execution, status: 'canceled', updatedAt: '2026-10-18T01:00:09Z' });
  await ready();
  const strip = screen.getByLabelText('制作进度');
  // Canvas redesign (design Main board): the strip says which step of how many; the step list itself is in the conversation.
  expect(within(strip).getByText('制作中 · 第 2 步，共 2 步')).toBeDefined();
  // The strip says what has been spent, nothing about the cap or the dialogue's share (§4.3).
  expect(within(strip).getByText('已用 40 积分').getAttribute('title')).toBeNull();
  expect(strip.textContent).not.toMatch(/120|其中对话/);
  expect(within(screen.getByRole('list', { name: '各步进度' })).getAllByRole('listitem').map(li => li.getAttribute('data-status'))).toEqual(['done', 'running']);
  emit(ev('budget.update', { executionId: 'e1', stage: 'production', approvedCap: 120, spent: 45, inFlight: 0, remaining: 75, source: 'actual', dialogueSpent: 5, dialogueInFlight: 0 }, { executionId: 'e1' }));
  expect(within(screen.getByLabelText('制作进度')).getByText('已用 45 积分')).toBeDefined();
  fireEvent.click(within(screen.getByLabelText('制作进度')).getByRole('button', { name: '暂停' }));
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

// (c) is folded in: the user already rewrote the text of one produced node; it survives the restore, with no proposal.
test('(a)(c) a canvas opened after its execution finished gets the produced nodes back and saves them; text the user rewrote survives', async () => {
  closedCanvas();
  const mine = { ...text, id: `${E}-a-facts`, title: '我的事实', metadata: { content: '我手改过的事实', status: 'success' as const, studio: { kind: 'text' as const, execution: { executionId: E, stepId: 'facts', runId: 'r-facts' } } } } as CanvasNodeData;
  let canvas: CanvasNodeData[] = [], edges: any[] = [];
  await ready(<Host initial={[mine]} onCanvas={(nodes: CanvasNodeData[], connections: any[]) => { canvas = nodes; edges = connections; }}/>);
  await waitFor(() => expect(canvas.map(n => n.id).sort()).toEqual(ALL));
  expect(api.getExecution).toHaveBeenCalledWith('p', E);
  expect(canvas.find(n => n.id === `${E}-a-facts`)).toEqual(mine);
  expect(api.getRun).not.toHaveBeenCalledWith('r-facts');
  expect(screen.queryByLabelText('修改建议')).toBeNull();
  expect(canvas.find(n => n.id === `${E}-a-limits`)!.metadata).toMatchObject({ content: '未知事项', studio: { kind: 'text', execution: { executionId: E, stepId: 'limits', runId: 'r-limits' } } });
  expect(canvas.find(n => n.id === `${E}-p-v1`)!.metadata?.storageKey).toBe('k/v1.mp4');
  expect(canvas.find(n => n.id === `${E}-p-c1`)!.metadata?.studio).toMatchObject({ kind: 'check', parentNodeId: `${E}-p-v1` });
  // Both kinds of edge: a step's input (facts → limits) and the check beside what it inspected (v1 → c1).
  await waitFor(() => expect(edges.map(e => `${e.fromNodeId}>${e.toNodeId}`).sort()).toEqual([`${E}-a-facts>${E}-a-limits`, `${E}-p-v1>${E}-p-c1`]));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  // The finished execution is shown again, and canvas commands are replayed from the start of the thread.
  expect(within(screen.getByLabelText('制作进度')).getByText(/^制作 · 已完成/)).toBeDefined();
  expect(streams.at(-1)!.cursor()).toBe(0);
  // Every node the restore put back is recorded once the save landed (the user's own node was not restored).
  await waitFor(() => expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]')).toEqual(expect.arrayContaining(ALL.filter(id => id !== `${E}-a-facts`))));
});

test('(a2) a restore whose save failed is restored again on the next open', async () => {
  closedCanvas();
  api.save.mockRejectedValue(new Error('画布保存失败，请先重试保存'));
  let canvas: CanvasNodeData[] = [];
  const first = await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  await waitFor(() => expect(canvas).toHaveLength(4));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  await settle();
  expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]')).toEqual([]);
  first.unmount();
  // The server never got those nodes: the canvas opens without them, and they come back.
  api.save.mockResolvedValue(undefined);
  let again: CanvasNodeData[] = [];
  await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { again = nodes; }}/>);
  await waitFor(() => expect(again.map(n => n.id).sort()).toEqual(ALL));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]').sort()).toEqual(ALL));
});

test('(b) opening it again adds nothing and reads no runs; a node deleted here is not rebuilt', async () => {
  closedCanvas();
  let canvas: CanvasNodeData[] = [];
  const first = await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  await waitFor(() => expect(canvas).toHaveLength(4));
  // Recorded once the restore is saved (a save that never happened leaves them restorable, see (a2)).
  await waitFor(() => expect(JSON.parse(localStorage.getItem('studio-projected-nodes:p') || '[]')).toHaveLength(4));
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

// What a card authorized is still kept (the store test 「a confirmed card reports what was actually authorized」); the
// card itself only says it was confirmed, for how much, and when (docs/ip-studio-new-canvas-and-threads.md §4.2).
test('a confirmed card collapses to one line with its price; opened, it shows the steps and when, never caps or revision', async () => {
  closedCanvas();
  await ready(<Host initial={[]}/>);
  const card = screen.getByLabelText('确认制作');
  const line = within(card).getByText('已确认 · 82 积分');
  expect((line.closest('details') as HTMLDetailsElement).open).toBe(false);
  expect(within(card).getByText(`确认于 ${formatDateTime('2026-10-18T12:01:13Z')}`)).toBeDefined();
  expect(within(card).getByText('第 1 段视频')).toBeDefined();
  expect(card.textContent).not.toMatch(/上限|280|1,000|第 2 版/);
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

// ── Server follow-ups: card details (stage budget on send, dialogue share, saved follow-ups and synthetic turns are folded into earlier tests) ──
test('a shortfall card asks for one number, the new cap (the proposed one by default); a replaced card says so and cannot start anything', async () => {
  const raise = { ...approvalBlock, approvalId: 'a3', budgetCap: 150, quotedCost: 50, autoFixCap: 0, shortfall: 30, dialogueReserve: 20 };
  const replaced = { ...approvalBlock, approvalId: 'a1', planFingerprint: 'f1', status: 'superseded' as const, supersededAt: at };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [{ ...planMessage([replaced]), id: 'm1', seq: 2 }, planMessage([planBlock, raise])] });
  api.createExecution.mockResolvedValue({ id: 'e1', projectId: 'p', skillKey: 'k', skillVersion: 1, stage: 'production', planRunId: 'plan-2', planRevision: 2, planFingerprint: 'f2', status: 'running', steps: [], budgets: [], startedAt: at, deadlineAt: at, updatedAt: at });
  await ready();
  const [old, current] = screen.getAllByLabelText('确认制作');
  expect(within(old).getByText('已更新')).toBeDefined();
  expect(within(old).getByText('已有新的报价，见下方')).toBeDefined();
  expect(within(old).queryByText('第 1 段视频')).toBeNull();
  expect(within(old).queryByRole('button', { name: '开始制作' })).toBeNull();
  expect(within(current).getByText('积分超出上限，还差 30 积分')).toBeDefined();
  // One input (no separate redo allowance), defaulting to the cap the card proposes (the approved cap plus the shortfall).
  expect(within(current).getAllByRole('spinbutton')).toHaveLength(1);
  const cap = within(current).getByLabelText('新的上限') as HTMLInputElement;
  expect(cap.value).toBe('150');
  expect(within(current).queryByText('50')).toBeNull();
  expect(current.textContent).not.toMatch(/预留|超过会停下来|重做额度/);
  fireEvent.change(cap, { target: { value: '120' } });
  expect((within(current).getByRole('button', { name: '提高上限并继续' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(current).getByRole('alert').textContent).toContain('150');
  fireEvent.change(cap, { target: { value: '180' } });
  fireEvent.click(within(current).getByRole('button', { name: '提高上限并继续' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.createExecution.mock.calls[0][1]).toMatchObject({ approvalId: 'a3', budgetCap: 180, autoFixCap: 0 });
});

// Codex 2026-10-19 (P2): an analysis-stage card the running execution posted (a budget raise) was sent without its
// execution, so the server tried to start a second analysis and refused it as busy.
test('a raise card of the running analysis confirms that same execution', async () => {
  const analysisPlan = { ...planBlock, planRunId: 'plan-1', fingerprint: 'f1', plan: { ...planBlock.plan, stage: 'analysis' as const } };
  const raise = { ...approvalBlock, approvalId: 'a9', stage: 'analysis' as const, planFingerprint: 'f1', budgetCap: 45, quotedCost: 40, autoFixCap: 0, shortfall: 5, executionId: 'PEX-9' };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 3, messages: [planMessage([analysisPlan, raise])] });
  api.createExecution.mockResolvedValue({ ...doneExecution, id: 'PEX-9', stage: 'analysis', status: 'running', budgets: [{ stage: 'analysis', approvedCap: 45, autoFixCap: 0, spent: 40, inFlight: 0, remaining: 5 }] });
  await ready();
  fireEvent.click(within(screen.getByLabelText('确认分析')).getByRole('button', { name: '提高上限并继续' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.createExecution.mock.calls[0][1]).toMatchObject({ stage: 'analysis', executionId: 'PEX-9', approvalId: 'a9', budgetCap: 45, expectedRevision: 2 });
});

// 意图直达 (2026-10-20): a direct skill (出图 / 写剧本与文案 / 出视频) has no analysis stage, so its production card names no
// execution and starts one. The panel used to fall back to the execution it was showing, which turned that start into a
// confirmation of a finished job (the server then refused it). A card that does name its execution keeps sending it with
// the plan revision (see 「confirming production posts the execution…」 above).
test('a production card without an execution starts a new one: no executionId, revision or approach, even with a finished execution shown', async () => {
  closedCanvas();
  // The server numbers plans per thread (thread.planRevision), so the new job's plan comes after the finished one's revision 2.
  const directPlan: Extract<StudioMessageBlock, { type: 'plan' }> = { type: 'plan', planRunId: 'plan-img', revision: 3, fingerprint: 'fi', plan: { summary: '出 1 张图', questions: [], stage: 'production',
    skillKey: 'image-generation', skillVersion: 1, steps: [{ id: 'd1', operation: 'image', title: '出图 1 张', prompt: '', referenceNodeIds: [], quotedCost: 8 }], budget: { estimated: 8, autoFixCap: 0 } } };
  const directCard: Extract<StudioMessageBlock, { type: 'approval' }> = { type: 'approval', approvalId: 'a-img', stage: 'production', planFingerprint: 'fi', scope: ['出图 1 张'], quotedCost: 8, budgetCap: 18, autoFixCap: 0, status: 'pending' };
  const direct: StudioDialogueMessage = { id: 'm3', threadId: 'th', seq: 23, turnId: 't3', role: 'assistant', text: '按你说的出 1 张图。', blocks: [directPlan, directCard], status: 'done', createdAt: at };
  api.getConversation.mockResolvedValue({ ...closedState(), latestSeq: 23, messages: [...closedState().messages, direct] });
  api.createExecution.mockResolvedValue({ ...doneExecution, id: 'PEX-2', planRunId: 'plan-img', planRevision: 3, planFingerprint: 'fi', status: 'running', finishedAt: undefined, steps: [],
    budgets: [{ stage: 'production', approvedCap: 18, autoFixCap: 0, spent: 0, inFlight: 0, remaining: 18 }] });
  await ready();
  // The finished execution is what the panel shows: the old fallback would have sent its id.
  await waitFor(() => expect(within(screen.getByLabelText('制作进度')).getByText(/^制作 · 已完成/)).toBeDefined());
  const pending = screen.getAllByLabelText('确认制作').find(card => within(card).queryByRole('button', { name: '开始制作' }))!;
  fireEvent.click(within(pending).getByRole('button', { name: '开始制作' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.createExecution.mock.calls[0]).toEqual(['p', { clientRequestId: expect.any(String), stage: 'production', planRunId: 'plan-img', planFingerprint: 'fi', budgetCap: 18, autoFixCap: 0,
    approvalId: 'a-img', confirmationMessageId: 'm3' }]);
});

// ── Skills (S3): the per-message choice, the plan badge, the "pick one" rejection and the operator draft ──

// The guide opens from the skill label in the header (the design has no separate 「?」). 2026-10-21 (user feedback): that
// label is the only place the method shows; nothing under the composer shows or changes the skill or the reply model.
const modeLabel = () => screen.getAllByRole('button').find(b => b.getAttribute('aria-controls') === 'studio-assistant-guide')!;
const openGuide = () => fireEvent.click(modeLabel());
const AUTO_TITLE = '按你说的话自动选择做法。';
const skillTitle = (name: string) => `现在按「${name}」做。按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。`;

test('nothing under the composer picks the skill or the model: a typed message carries no skillKey, the header label says how the method is chosen', async () => {
  api.skills.mockResolvedValue([recreation, seeding, skill('old', '旧技能', { status: 'withdrawn' })]);
  await ready();
  await waitFor(() => expect(api.skills).toHaveBeenCalled());
  expect(screen.queryByRole('combobox', { name: '技能' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: '助手模型' })).toBeNull();
  expect(document.querySelector('.studio-dialogue-chip')).toBeNull();
  expect(screen.queryByText('模型一')).toBeNull();
  // The button area under the input is @, attachments and send.
  const toolbar = document.querySelector('.studio-assistant-context-actions')!;
  expect(within(toolbar as HTMLElement).getAllByRole('button').map(b => b.getAttribute('aria-label') || b.textContent)).toEqual(['引用节点', '添加附件']);
  expect(modeLabel().textContent).toBe('全能创作');
  expect(modeLabel().title).toBe(AUTO_TITLE);
  openGuide();
  expect(screen.getByText('全能创作：按你说的话和素材自动选择做法。')).toBeDefined();
  fireEvent.change(composer(), { target: { value: '做一条种草视频' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('skillKey');
});

test('a fill-in card\'s skill rides on the message and on its retry; the header label shows it and says how it changes', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready();
  fireEvent.click(card('写剧本'));
  await waitFor(() => expect(modeLabel().textContent).toBe('写剧本与文案'));
  expect(modeLabel().title).toBe(skillTitle('写剧本与文案'));
  expect(modeLabel().className).toContain('is-skill');
  fireEvent.change(within(starterForm('写剧本')).getByLabelText('一句梗概'), { target: { value: '外卖员送错一单' } });
  api.post.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  fireEvent.click(sendButton());
  await waitFor(() => expect(screen.getByRole('button', { name: '重新发送' })).toBeDefined());
  expect(api.post.mock.calls[0][2]).toMatchObject({ skillKey: 'script-writing' });
  fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2]).toMatchObject({ clientMessageId: api.post.mock.calls[0][2].clientMessageId, skillKey: 'script-writing' });
});

test('a thread already bound to a skill shows it only in the header label, and a typed message carries no skillKey', async () => {
  api.skills.mockResolvedValue([recreation, seeding]);
  api.getConversation.mockResolvedValue({ ...emptyState, thread: { ...thread, skillKey: 'video-recreation', skillVersion: 2 } });
  await ready();
  await waitFor(() => expect(modeLabel().textContent).toBe('短视频复刻'));
  expect(modeLabel().title).toBe(skillTitle('短视频复刻'));
  openGuide();
  await screen.findByText('短视频复刻：短视频复刻的说明');
  expect(screen.queryByRole('combobox', { name: '技能' })).toBeNull();
  expect(document.querySelector('.studio-dialogue-chip')).toBeNull();
  fireEvent.change(composer(), { target: { value: '继续' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).not.toHaveProperty('skillKey');
});

test('400 STUDIO_SKILL_REQUIRED names the skills that fit, keeps the draft, and each skill is a quick reply that sends it again with that skill', async () => {
  api.skills.mockResolvedValue([recreation]);
  api.reloadSkills.mockResolvedValue([recreation, seeding]);
  await ready();
  api.post.mockRejectedValueOnce(new ApiError({ code: 'STUDIO_SKILL_REQUIRED', message: '有几种做法', details: { skills: [
    { key: 'video-recreation', name: '短视频复刻', summary: '照着原片做' }, { key: 'talking-head-seeding', name: '口播种草', summary: '写口播配画面' }] } }, 400));
  fireEvent.change(composer(), { target: { value: '照着这条复刻一条口播' } });
  fireEvent.click(sendButton());
  // A question, not a failure: shown inline, never as an error notification.
  await screen.findByText('「短视频复刻」和「口播种草」都能做，选一个就按它发送');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(composer().value).toBe('照着这条复刻一条口播');
  expect(api.reloadSkills).toHaveBeenCalled();
  // No dropdown to go and find: the skills are buttons right there.
  expect(screen.queryByRole('combobox', { name: '技能' })).toBeNull();
  const choice = screen.getByRole('group', { name: '选一种做法' });
  expect(within(choice).getAllByRole('button').map(b => b.textContent)).toEqual(['短视频复刻', '口播种草']);
  fireEvent.click(within(choice).getByRole('button', { name: '口播种草' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2]).toMatchObject({ text: '照着这条复刻一条口播', skillKey: 'talking-head-seeding' });
  expect(screen.queryByRole('group', { name: '选一种做法' })).toBeNull();
  await waitFor(() => expect(composer().value).toBe(''));
  expect(modeLabel().textContent).toBe('口播种草');
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
  // Follow-ups saved on the summary show after a reload, and once when turn.done repeats them.
  expect(within(screen.getByRole('group', { name: '接下来可以' })).getAllByRole('button').map(b => b.textContent)).toEqual(['改成横屏']);
  seq = 4;
  emit(ev('turn.done', { reason: 'completed', messageId: 'm-sum', suggestions: ['改成横屏'] }, { turnId: 'EXS-1' }));
  expect(screen.getAllByRole('group', { name: '接下来可以' })).toHaveLength(1);
  expect(within(screen.getByRole('group', { name: '接下来可以' })).getAllByRole('button')).toHaveLength(1);
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


// 2026-10-21 (user feedback): no model pill under the composer, fixed or selectable. The one dialogue model could not be
// changed and its name read as if videos were made with it too. The model still goes with its ceiling (Codex 2026-10-19,
// P2: without it the server ran the default model); a fixed or single-model scene sends none.
test.each(['fixed', 'selectable'] as const)('no model control with a single %s model; its ceiling goes with the message and no model is sent', async policy => {
  await ready(<Host capabilities={{ ...capabilities, textModelMode: policy, textModels: [capabilities.textModels[0]] }}/>);
  expect(api.getConversation).toHaveBeenCalledWith('p');
  expect(screen.queryByRole('combobox', { name: '助手模型' })).toBeNull();
  expect(screen.queryByText('模型一')).toBeNull();
  expect(screen.queryByRole('button', { name: '对话设置' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(composer(), { target: { value: '写一段口播' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][2]).toMatchObject({ maxCost: 260 });
  expect(api.post.mock.calls[0][2].model).toBeUndefined();
});

// ── Opening guidance: inventory chips, the four cards and their fill-in cards (docs/ip-studio-new-canvas-and-threads.md §5) ──
const clip = { ...character, id: 'clip', type: 'video', title: '带货样片', metadata: { storageKey: 'k/clip' } } as CanvasNodeData;
const starterSkills = () => [skill('image-generation', '出图'), skill('script-writing', '写剧本与文案'), skill('video-generation', '出视频'), skill('reference-video-recreation', '参考视频复刻')];
const card = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });
const starterForm = (title: string) => screen.getByRole('region', { name: title });
const IP_DEFAULT = (photo: string) => `用${photo}做一个我的数字 IP 形象，保留脸型、发型和主要特征，写实风格，出一张多视角设定图（正面、侧面、背面加几个表情）。`;

test('an empty conversation opens on four cards and what the canvas holds; with a node referenced the cards work on it', async () => {
  await ready(<Host initial={[character, text, clip]}/>);
  expect(screen.getByRole('heading', { name: '想做点什么？' })).toBeDefined();
  expect(screen.getByText('画布上有')).toBeDefined();
  // Icon, title, what you get, one small line of what it needs.
  expect(card('制作个人 IP').textContent).toBe('制作个人 IP真人照片变成数字形象，出多角度设定图需要：1–3 张照片');
  expect(card('写剧本').textContent).toBe('写剧本一句梗概写成能拍的分场剧本需要：一句梗概');
  expect(card('做个短视频').textContent).toBe('做个短视频一句描述出视频，也可以从一张图动起来需要：画面描述');
  expect(card('复刻视频').textContent).toBe('复刻视频照爆款的节奏和镜头，换成你的商品或人物需要：参考视频 + 你的素材');
  expect(document.body.textContent).not.toMatch(/要准备|会得到|选一件事开始|第一次用|做一张图|写一段文字/);
  // The guide opens from the skill label: three steps and one line about the current skill, nothing about credits or attachments.
  openGuide();
  const guide = screen.getByRole('region', { name: '使用说明' });
  expect(within(guide).getByText('全能创作：按你说的话和素材自动选择做法。')).toBeDefined();
  expect(guide.textContent).not.toMatch(/附件|上限|整张画布/);
  // Each step is a two-column grid (number + text). A bare text node beside <strong> becomes a third grid item and
  // drops into the 24px number column, one character per line; title and text must share one element.
  for (const li of guide.querySelectorAll('ol > li')) {
    expect(li.children.length).toBe(1);
    expect([...li.childNodes].every(n => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
  }
  // A chip references every node of its type; with a reference the cards are the ones that work on it (unchanged by §5).
  fireEvent.click(screen.getByRole('button', { name: '1 张图片' }));
  expect(screen.getByLabelText('本次引用').textContent).toContain('角色 A');
  expect((screen.getByRole('button', { name: '1 张图片' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  for (const title of ['修改节点内容', '优化节点提示词', '复刻一条短视频', '搭一套创作流程']) expect(card(title)).toBeDefined();
  expect(screen.queryByRole('button', { name: /^制作个人 IP/ })).toBeNull();
});

test('制作个人 IP picks the only photo, writes the default sentence, follows the options and sends with its skill', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready(<Host initial={[character, text, clip]}/>);
  fireEvent.click(card('制作个人 IP'));
  const form = starterForm('制作个人 IP');
  expect(screen.queryByRole('heading', { name: '想做点什么？' })).toBeNull();
  expect(within(form).getByRole('group', { name: '你的照片' }).textContent).toContain('角色 A');
  expect(within(form).getByText('正脸清晰、光线均匀、只有一个人，效果最好。只用本人或已获授权的照片。')).toBeDefined();
  expect(composer().value).toBe(IP_DEFAULT(' @角色 A '));
  expect(within(form).getByRole('button', { name: '写实' }).getAttribute('aria-pressed')).toBe('true');
  expect(within(form).getByRole('button', { name: '多视角设定图' }).getAttribute('aria-pressed')).toBe('true');
  await waitFor(() => expect(modeLabel().textContent).toBe('出图'));
  fireEvent.click(within(form).getByRole('button', { name: 'Q 版' }));
  fireEvent.click(within(form).getByRole('button', { name: '头像' }));
  expect(composer().value).toBe('用 @角色 A 做一个我的数字 IP 形象，保留脸型、发型和主要特征，Q 版风格，出一张头像。');
  expect(within(form).getByRole('button', { name: 'Q 版' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('button', { name: '按选项重写' })).toBeNull();
  expect(sendButton().disabled).toBe(false);
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '用 @角色 A 做一个我的数字 IP 形象，保留脸型、发型和主要特征，Q 版风格，出一张头像。', skillKey: 'image-generation', pinnedNodeIds: ['c'] });
  // Sent: the card is gone and the cleared composer is not filled again.
  await waitFor(() => expect(screen.queryByRole('region', { name: '制作个人 IP' })).toBeNull());
  expect(composer().value).toBe('');
});

test('a card holds the send until its material is there; 「从画布选」 picks through the @ list and the sentence takes it in', async () => {
  const second = { ...character, id: 'c2', title: '角色 B' } as CanvasNodeData;
  await ready(<Host initial={[character, second, text]}/>);
  fireEvent.click(card('制作个人 IP'));
  const form = starterForm('制作个人 IP');
  // Two photos on the canvas: none is picked for the user.
  expect(within(form).getByText('还缺')).toBeDefined();
  expect(composer().value).toBe(IP_DEFAULT('我的照片'));
  expect(sendButton().disabled).toBe(true);
  expect(screen.getByText('还差照片')).toBeDefined();
  fireEvent.click(within(form).getByRole('button', { name: '从画布选' }));
  fireEvent.click(screen.getByRole('option', { name: /角色 B/ }));
  expect(composer().value).toBe(IP_DEFAULT(' @角色 B '));
  expect(sendButton().disabled).toBe(false);
  expect(screen.queryByRole('button', { name: '按选项重写' })).toBeNull();
  // Taking it out of the slot takes it out of the message and the sentence.
  fireEvent.click(within(form).getByRole('button', { name: '去掉 角色 B' }));
  expect(composer().value).toBe(IP_DEFAULT('我的照片'));
  expect(screen.getByLabelText('本次引用').textContent).not.toContain('角色 B');
  expect(sendButton().disabled).toBe(true);
});

test('写剧本: the synopsis feeds the sentence; a hand edit stops the options, 「按选项重写」 brings the sentence back', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready();
  fireEvent.click(card('写剧本'));
  const form = starterForm('写剧本');
  const synopsis = within(form).getByLabelText('一句梗概');
  expect(document.activeElement).toBe(synopsis);
  await waitFor(() => expect(modeLabel().textContent).toBe('写剧本与文案'));
  expect(composer().value).toBe('写一个 60 秒的短剧剧本。有反转，分场写清画面、台词和时长。');
  expect(sendButton().disabled).toBe(true);
  expect(screen.getByText('先写一句梗概')).toBeDefined();
  // The line says it is missing too (on a phone the reason beside the send button has no room).
  expect(within(form).getByText('还缺')).toBeDefined();
  fireEvent.change(synopsis, { target: { value: '外卖员送错一单，意外救了老板的女儿' } });
  expect(within(form).queryByText('还缺')).toBeNull();
  fireEvent.click(within(form).getByRole('button', { name: '3 分钟' }));
  expect(composer().value).toBe('写一个 3 分钟的短剧剧本：外卖员送错一单，意外救了老板的女儿。有反转，分场写清画面、台词和时长。');
  // The user's own words win from here.
  fireEvent.change(composer(), { target: { value: '写一个 3 分钟的短剧剧本，结尾留个悬念' } });
  fireEvent.click(within(form).getByRole('button', { name: '搞笑' }));
  expect(composer().value).toBe('写一个 3 分钟的短剧剧本，结尾留个悬念');
  fireEvent.click(within(form).getByRole('button', { name: '按选项重写' }));
  expect(composer().value).toBe('写一个 3 分钟的短剧剧本：外卖员送错一单，意外救了老板的女儿。搞笑，分场写清画面、台词和时长。');
  expect(within(form).queryByRole('button', { name: '按选项重写' })).toBeNull();
  // A message written by hand no longer needs the synopsis line (only material would still hold it back).
  fireEvent.change(synopsis, { target: { value: '' } });
  expect(sendButton().disabled).toBe(true);
  fireEvent.change(composer(), { target: { value: '写个三分钟的搞笑短剧，主角是外卖员' } });
  expect(sendButton().disabled).toBe(false);
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '写个三分钟的搞笑短剧，主角是外卖员', skillKey: 'script-writing' });
});

test('做个短视频: the first frame is not picked for the user; frame and camera join the sentence only when chosen; Enter in the line sends', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready();
  fireEvent.click(card('做个短视频'));
  const form = starterForm('做个短视频');
  await waitFor(() => expect(modeLabel().textContent).toBe('出视频'));
  // The one image on the canvas would turn this into an image-to-video: an optional slot stays empty until chosen.
  expect(within(form).getByRole('group', { name: '首帧图' }).textContent).toContain('选填');
  expect(screen.getByLabelText('本次引用').textContent).toBe('');
  fireEvent.change(within(form).getByLabelText('画面描述'), { target: { value: '女孩在海边回头微笑' } });
  expect(composer().value).toBe('做一条 5 秒、9:16 的短视频：女孩在海边回头微笑。');
  fireEvent.click(within(form).getByRole('button', { name: '16:9' }));
  fireEvent.click(within(form).getByRole('button', { name: '10 秒' }));
  fireEvent.click(within(form).getByRole('button', { name: '环绕' }));
  fireEvent.click(within(form).getByRole('button', { name: '从画布选' }));
  fireEvent.click(screen.getByRole('option', { name: /角色 A/ }));
  expect(composer().value).toBe('做一条 10 秒、16:9 的短视频：女孩在海边回头微笑。从 @角色 A 开始动起来。镜头环绕。');
  fireEvent.keyDown(within(form).getByLabelText('画面描述'), { key: 'Enter' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '做一条 10 秒、16:9 的短视频：女孩在海边回头微笑。从 @角色 A 开始动起来。镜头环绕。', skillKey: 'video-generation', pinnedNodeIds: ['c'] });
});

test('复刻视频 picks the only video and the only image, and sends them with the recreation skill', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready(<Host initial={[character, text, clip]}/>);
  fireEvent.click(card('复刻视频'));
  const form = starterForm('复刻视频');
  expect(composer().value).toBe('照 @带货样片 的拍法，把里面的商品或人物换成 @角色 A，保留节奏和镜头。');
  await waitFor(() => expect(modeLabel().textContent).toBe('参考视频复刻'));
  fireEvent.click(within(form).getByRole('button', { name: '只保留节奏' }));
  fireEvent.change(within(form).getByLabelText('要讲的卖点'), { target: { value: '保温 12 小时' } });
  expect(composer().value).toBe('照 @带货样片 的拍法，把里面的商品或人物换成 @角色 A，只保留节奏，口播改成介绍：保温 12 小时。');
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ skillKey: 'reference-video-recreation', pinnedNodeIds: ['clip', 'c'] });
  await waitFor(() => expect(screen.queryByRole('region', { name: '复刻视频' })).toBeNull());
});

test('「换一个」 goes back to the four cards as before: the card\'s sentence, skill and picks leave the message', async () => {
  api.skills.mockResolvedValue(starterSkills());
  await ready();
  fireEvent.click(card('制作个人 IP'));
  await waitFor(() => expect(modeLabel().textContent).toBe('出图'));
  expect(composer().value).toBe(IP_DEFAULT(' @角色 A '));
  expect(screen.getByLabelText('本次引用').textContent).toContain('角色 A');
  fireEvent.click(screen.getByRole('button', { name: '换一个' }));
  expect(composer().value).toBe('');
  expect(modeLabel().textContent).toBe('全能创作');
  expect(screen.getByLabelText('本次引用').textContent).toBe('');
  expect(card('写剧本')).toBeDefined();
  // A picture picked for one card does not ride along into another (the canvas still has it to pick again).
  fireEvent.click(card('写剧本'));
  expect(screen.getByLabelText('本次引用').textContent).toBe('');
  expect(composer().value).toBe('写一个 60 秒的短剧剧本。有反转，分场写清画面、台词和时长。');
});

test('a card never writes over words already in the composer', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '我自己想的一句' } });
  fireEvent.click(card('写剧本'));
  expect(composer().value).toBe('我自己想的一句');
  expect(screen.getByRole('button', { name: '按选项重写' })).toBeDefined();
  // Written by hand, only material could still hold the message back, and 写剧本 needs none.
  expect(sendButton().disabled).toBe(false);
  // Going back leaves the user's words where they are.
  fireEvent.click(screen.getByRole('button', { name: '换一个' }));
  expect(composer().value).toBe('我自己想的一句');
});

test('with a node referenced, 「复刻一条短视频」 opens the 复刻视频 card around it', async () => {
  await ready(<Host initial={[character, text, clip]} selectedIds={['clip']}/>);
  for (const title of ['修改节点内容', '优化节点提示词', '复刻一条短视频', '搭一套创作流程']) expect(card(title)).toBeDefined();
  fireEvent.click(card('复刻一条短视频'));
  expect(starterForm('复刻视频')).toBeDefined();
  expect(composer().value).toBe('照 @带货样片 的拍法，把里面的商品或人物换成 @角色 A，保留节奏和镜头。');
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

// 2026-10-19 walkthrough: 「问助手」 did nothing once a draft existed — the assistant opens by default, so a draft always
// existed. It adds the node to this message and keeps what was already typed (and what was already pinned).
test('「问助手」 adds the node to this message and keeps what was typed; an unsent draft and its references survive a refresh, and a sent message does not come back', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '写到一半的话' } });
  act(() => { window.dispatchEvent(new CustomEvent('studio-command', { detail: { action: 'assistant', nodeId: 't' } })); });
  expect(await screen.findByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(composer().value).toBe('写到一半的话');
  act(() => { window.dispatchEvent(new CustomEvent('studio-command', { detail: { action: 'assistant', nodeId: 'c' } })); });
  expect(await screen.findByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(composer().value).toBe('写到一半的话');
  cleanup();
  await ready();
  await waitFor(() => expect(composer().value).toBe('写到一半的话'));
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(screen.getByRole('button', { name: '移除引用 角色 A' })).toBeDefined();
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '写到一半的话', pinnedNodeIds: ['t', 'c'] });
  cleanup();
  await ready();
  expect(composer().value).toBe('');
});

// Browser walkthrough 2026-10-19 (dev runs StrictMode): the panel wrote its draft from an unmount, the double-run unmount
// saw the composer before the restored draft reached state, and wiped the draft it had just restored.
// A restored draft also drops references to nodes that left the canvas, so they cannot hold the send.
test('under StrictMode a saved draft is restored and stays saved; references to nodes that left the canvas are dropped', async () => {
  localStorage.setItem('studio-assistant:draft:p', JSON.stringify({ text: '刷新前写的', pinnedIds: ['gone', 't'], attachmentIds: ['gone-too'] }));
  await ready(<StrictMode><Host/></StrictMode>);
  await waitFor(() => expect(composer().value).toBe('刷新前写的'));
  expect(screen.getByRole('button', { name: '移除引用 台词 B' })).toBeDefined();
  expect(sendButton().disabled).toBe(false);
  expect(JSON.parse(localStorage.getItem('studio-assistant:draft:p')!)).toMatchObject({ text: '刷新前写的' });
  expect(JSON.parse(localStorage.getItem('studio-assistant:draft:p')!).pinnedIds).toContain('t');
  fireEvent.change(composer(), { target: { value: '刷新前写的，又补了一句' } });
  expect(JSON.parse(localStorage.getItem('studio-assistant:draft:p')!)).toMatchObject({ text: '刷新前写的，又补了一句', pinnedIds: ['t'] });
});

// Codex 2026-10-19 (P2): the model goes with its own ceiling. 2026-10-21: there is no picker any more; the default model
// is sent, and a model this browser remembered for the canvas (picked while the picker existed) still applies while offered.
test('with several models the default goes with its ceiling; a remembered model still applies, one no longer offered falls back to the default', async () => {
  await ready();
  expect(screen.queryByRole('combobox', { name: '助手模型' })).toBeNull();
  fireEvent.change(composer(), { target: { value: '写一段口播' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ model: 'one', maxCost: 260 });
  cleanup();
  localStorage.setItem('studio-assistant:model:p', 'two');
  await ready();
  expect(screen.queryByRole('combobox', { name: '助手模型' })).toBeNull();
  fireEvent.change(composer(), { target: { value: '用便宜的那个回答' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][2]).toMatchObject({ model: 'two', maxCost: 130 });
  cleanup();
  localStorage.setItem('studio-assistant:model:p', 'retired');
  await ready();
  fireEvent.change(composer(), { target: { value: '再写一段' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  expect(api.post.mock.calls[2][2]).toMatchObject({ model: 'one', maxCost: 260 });
});

const longReply = '末世英雄·林烬：三十岁出头，左眼有一道旧疤，穿改装过的防化服，背一把自制弩。外冷内热，嘴上不饶人，遇到孩子会先把干粮分出去。末世第三年，他守着城北最后一座净水站，只换药品不换枪。';
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
  // Placed: the action now shows where it is instead of offering to place it again.
  expect(screen.queryByRole('button', { name: '放进画布' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '在画布上查看' }));
  await waitFor(() => expect(api.success).toHaveBeenLastCalledWith('画布上已经有这段文字'));
  expect(latest.filter(n => n.metadata?.content === longReply)).toHaveLength(1);
});

test('older replies show their raw action blocks folded, not as the assistant talking', async () => {
  api.getConversation.mockResolvedValue(replied('我先看看画布。\n<tool_call>{"tool":"read_canvas","args":{}}</tool_call>'));
  await ready();
  const reply = await screen.findByText('我先看看画布。');
  expect(reply.textContent).not.toContain('<tool_call>');
  const raw = screen.getByText('这一轮没有执行的操作原文').closest('details') as HTMLDetailsElement;
  expect(raw.open).toBe(false);
  expect(raw.textContent).toContain('read_canvas');
  expect(screen.queryByRole('button', { name: '放进画布' })).toBeNull();
});

test('a homepage brief that copies a reference video opens 复刻视频 with the user\'s own words and never sends by itself', async () => {
  const onAutoSent = vi.fn();
  const view = await ready(<Host initial={[character]}/>);
  view.rerender(<Host initial={[character]} initialNodeId="p-brief" initialPrompt="照这条视频的拍法，把里面的商品换成我的" autoSend onAutoSent={onAutoSent}/>);
  const form = await screen.findByRole('region', { name: '复刻视频' });
  expect(composer().value).toBe('照这条视频的拍法，把里面的商品换成我的');
  expect(sendButton().disabled).toBe(true);
  expect(screen.getByText('还差参考视频')).toBeDefined();
  expect(within(form).getByRole('button', { name: '按选项重写' })).toBeDefined();
  // The address loses its send flag: the brief waits for the user.
  expect(onAutoSent).toHaveBeenCalled();
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(api.post).not.toHaveBeenCalled();
});

test('a homepage recreation brief stays unsent even when the canvas fills both slots by itself', async () => {
  const view = await ready(<Host initial={[character, clip]}/>);
  view.rerender(<Host initial={[character, clip]} initialNodeId="p-brief" initialPrompt="照这条视频的拍法，把里面的商品换成我的" autoSend/>);
  await screen.findByRole('region', { name: '复刻视频' });
  expect(composer().value).toBe('照这条视频的拍法，把里面的商品换成我的');
  expect(screen.getByLabelText('本次引用').textContent).toContain('带货样片');
  expect(sendButton().disabled).toBe(false);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(api.post).not.toHaveBeenCalled();
});

// The naming rule itself (which titles count as unnamed, so a name the user gave is kept) is studioTitleFromBrief /
// studioCanvasHasDefaultTitle in studio-entry.test.ts; this only proves the panel applies it on the first message.
test('the first message names a canvas nobody named', async () => {
  useCanvasStore.setState({ projects: [{ id: 'p', title: '全能创作 · 新画布', nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } as never] });
  await ready();
  fireEvent.change(composer(), { target: { value: '给星桥保温杯写一句广告语' } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(useCanvasStore.getState().projects[0].title).toBe('给星桥保温杯写一句广告语');
  useCanvasStore.setState({ projects: [] });
});

// §4.3: the one-time 「结果放进画布了…」 hint is gone; the nodes coming into view is the signal.
test('nodes the assistant creates are brought into view, with no hint about the canvas', async () => {
  localStorage.clear();
  const reveal = vi.fn();
  window.addEventListener('studio-command', e => { const d = (e as CustomEvent).detail; if (d.action === 'reveal') reveal(d.nodeId); });
  await ready(<Host initial={[character]}/>);
  emit(ev('node.upsert', { nodeId: 'new-1', op: 'create', node: { id: 'new-1', type: 'text', title: '口播稿', position: { x: 0, y: 0 }, width: 320, height: 200, metadata: { content: '第一版' } } }));
  await waitFor(() => expect(reveal).toHaveBeenCalledWith('new-1'));
  expect(screen.queryByText(/结果放进画布了/)).toBeNull();
  expect(screen.queryByRole('button', { name: '知道了' })).toBeNull();
  expect(localStorage.getItem('studio-assistant:canvas-hint')).toBeNull();
});

// 2026-10-19 walkthrough: Enter only added a line (the home page's box sends on Enter). The 「问助手」 half of that
// walkthrough is in 「「问助手」 adds the node to this message…」 above.
test('Enter sends and Shift+Enter starts a new line', async () => {
  await ready();
  fireEvent.change(composer(), { target: { value: '第一行' } });
  fireEvent.keyDown(composer(), { key: 'Enter', shiftKey: true });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.keyDown(composer(), { key: 'Enter' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '第一行' });
});


// ── The plan and its card as one card (docs/ip-studio-new-canvas-and-threads.md §4.2) ──────────────────────────
const imagePlan: Extract<StudioMessageBlock, { type: 'plan' }> = { type: 'plan', planRunId: 'plan-img', revision: 1, fingerprint: 'fi', plan: {
  summary: '一张 1:1 的末日英雄形象图，写实偏插画的废土风', questions: [], stage: 'production', skillKey: 'image-generation', skillVersion: 1,
  steps: [{ id: 'd1', operation: 'image', title: '末日英雄形象图', referenceNodeIds: [], quotedCost: 30,
    prompt: '三十岁的男性幸存者，左眼有旧疤，穿改装过的防化服，背一把自制弩，站在倒塌的高架桥下，黄昏逆光，写实偏插画，1:1 构图，人物居中，细节清楚，色调偏冷。' }],
  budget: { estimated: 30, autoFixCap: 0 } } };
const imageCard: Extract<StudioMessageBlock, { type: 'approval' }> = { type: 'approval', approvalId: 'a-img', stage: 'production', planFingerprint: 'fi',
  scope: ['范围清单里的一句'], quotedCost: 30, budgetCap: 40, autoFixCap: 0, dialogueReserve: 10, status: 'pending', expiresAt: '2099-01-01T00:00:00Z' };
const reply = (blocks: StudioMessageBlock[], extra: Partial<StudioDialogueMessage> = {}): StudioDialogueMessage =>
  ({ id: 'm-img', threadId: 'th', seq: 2, turnId: 't-img', role: 'assistant', text: '按你的描述出一张。', blocks, status: 'done', createdAt: at, ...extra });

test('a plan and its card in one reply are one card: what will be made, one price, two buttons, and nothing else', async () => {
  api.skills.mockResolvedValue([skill('image-generation', '出图')]);
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 2, messages: [reply([imagePlan, imageCard])] });
  api.createExecution.mockResolvedValue({ ...doneExecution, id: 'PEX-img', status: 'running', finishedAt: undefined, steps: [], budgets: [] });
  await ready();
  expect(screen.queryByLabelText('制作计划')).toBeNull();
  const card = screen.getByLabelText('确认制作');
  expect(within(card).getByText('一张 1:1 的末日英雄形象图，写实偏插画的废土风')).toBeDefined();
  // One step: its title and type, then the description that goes to the model, three lines with 「展开」 for the rest.
  expect(within(card).getByText('末日英雄形象图')).toBeDefined();
  expect(within(card).getByText('图片')).toBeDefined();
  expect(card.textContent).not.toContain('共 1 项');
  const prompt = within(card).getByText(/三十岁的男性幸存者/);
  expect(prompt.hasAttribute('data-clamped')).toBe(true);
  fireEvent.click(within(card).getByRole('button', { name: '展开' }));
  expect(prompt.hasAttribute('data-clamped')).toBe(false);
  // The card's own scope is not repeated next to the steps; the price is one number.
  expect(within(card).queryByText('范围清单里的一句')).toBeNull();
  expect(within(card).getAllByText(/^\d+$/).map(e => e.textContent)).toEqual(['30']);
  expect(card.textContent).not.toMatch(/上限|预留|过期|直接回复|可以也行|第 1 版|按技能|等你确认|按实际用量/);
  await waitFor(() => expect(within(card).getByRole('heading', { name: '确认制作' }).getAttribute('title')).toBe('按技能：出图 v1'));
  expect(within(card).getAllByRole('button').map(b => b.textContent)).toEqual(['收起', '开始制作', '先改改']);
  fireEvent.click(within(card).getByRole('button', { name: '开始制作' }));
  await waitFor(() => expect(api.createExecution).toHaveBeenCalledOnce());
  expect(api.createExecution.mock.calls[0][1]).toMatchObject({ approvalId: 'a-img', budgetCap: 40, autoFixCap: 0 });
});

test('several approaches show title, summary and what is kept or changed, never the reasoning; a card alone shows its scope', async () => {
  const reasoned = { ...planBlock, plan: { ...planBlock.plan, approaches: planBlock.plan.approaches!.map(a => ({ ...a, rationale: `判断过程：${a.title}更稳`, tradeoffs: ['取舍：节奏会变'] })) } };
  const alone = { ...approvalBlock, approvalId: 'a-alone', planFingerprint: 'f-missing', scope: ['只在单独的卡上出现'] };
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 4, messages: [planMessage([reasoned, approvalBlock]), { ...planMessage([alone]), id: 'm4', seq: 4 }] });
  await ready();
  const [merged, single] = screen.getAllByLabelText('确认制作');
  expect(within(merged).getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['做法：保留动作换商品', '做法：关键画面重做']);
  expect(within(merged).getByText('推荐')).toBeDefined();
  expect(within(merged).getByText('第 2 段重新设计')).toBeDefined();
  expect(within(merged).getAllByText('保留：').length).toBeGreaterThan(0);
  expect(merged.textContent).not.toMatch(/判断过程|取舍/);
  expect(within(merged).getByRole('button', { name: '改用这个做法' })).toBeDefined();
  // Several steps: an ordered list, each description folded under 「查看描述」 (empty descriptions have none).
  expect(within(merged).getAllByRole('listitem').map(li => li.querySelector('strong')?.textContent)).toEqual(['第 1 段视频', '第 2 段视频']);
  // A card whose plan is not in this reply lists its own scope; its plan never arrived, so it cannot start yet.
  expect(within(single).getByText('只在单独的卡上出现')).toBeDefined();
  expect(within(single).getByText('方案还没到，稍等一下')).toBeDefined();
  expect((within(single).getByRole('button', { name: '开始制作' }) as HTMLButtonElement).disabled).toBe(true);
});

test('an expired card offers 「重新报价」, sent as the user\'s message', async () => {
  api.getConversation.mockResolvedValue({ ...emptyState, latestSeq: 2, messages: [reply([imagePlan, { ...imageCard, expiresAt: '2026-01-01T00:00:00Z' }])] });
  await ready();
  const card = screen.getByLabelText('确认制作');
  expect(within(card).getByText('已过期')).toBeDefined();
  expect(within(card).getByText('报价已过期')).toBeDefined();
  expect(within(card).queryByRole('button', { name: '开始制作' })).toBeNull();
  expect(within(card).queryByText('30')).toBeNull();
  fireEvent.change(composer(), { target: { value: '写到一半' } });
  fireEvent.click(within(card).getByRole('button', { name: '重新报价' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  expect(api.post.mock.calls[0][2]).toMatchObject({ text: '重新报价' });
  expect(composer().value).toBe('写到一半');
});

// User feedback 2026-10-20: 「放进画布」 under an execution's closing summary only copied the summary onto the canvas.
test('「放进画布」 is not offered under a closing summary or a reply whose tools already put nodes on the canvas; a reply ends in one credit line', async () => {
  const tool = (id: string, toolName: string, nodeIds?: string[], creditsActual = 0): StudioMessageBlock => ({ type: 'tool_call', toolCallId: id, toolName, title: toolName, safeInputSummary: '', status: 'done',
    startedAt: at, finishedAt: at, creditsActual, settling: false, ...(nodeIds ? { result: { summary: '好了', nodeIds } } : {}) });
  const long = (head: string) => `${head}${longReply}`;
  const billing = { inputTokens: 1, outputTokens: 1, credits: 3, inputCreditsPerK: 0, outputCreditsPerK: 0 };
  api.getConversation.mockResolvedValue({ thread: { ...thread, lastSeq: 4 }, latestSeq: 4, messages: [
    { id: 's1', threadId: 'th', seq: 1, role: 'assistant', turnId: 'EXS-1', status: 'done', text: long('做好了，花了 30 积分。'), blocks: [], clientMessageId: 'exec-summary-PEX-1', createdAt: at },
    { id: 's2', threadId: 'th', seq: 2, role: 'assistant', turnId: 't2', status: 'done', text: long('放好了。'), blocks: [tool('x', 'create_nodes', ['n1'])], createdAt: at },
    { id: 's3', threadId: 'th', seq: 3, role: 'assistant', turnId: 't3', status: 'done', text: long('改好了。'), blocks: [tool('y', 'update_nodes')], createdAt: at },
    { id: 's4', threadId: 'th', seq: 4, role: 'assistant', turnId: 't4', status: 'done', text: long('初稿：'), blocks: [tool('z', 'view_images', undefined, 2)], billing, createdAt: at },
  ] } as StudioDialogueState);
  await ready();
  const replies = screen.getAllByLabelText('Studio 的回复');
  for (const r of replies.slice(0, 3)) expect(within(r).queryByRole('button', { name: '放进画布' })).toBeNull();
  const last = replies[3];
  expect(within(last).getByRole('button', { name: '放进画布' })).toBeDefined();
  // The reply and its work records as one number (3 + 2), no per-record breakdown.
  expect(within(last).getByText('5 积分')).toBeDefined();
  expect(last.textContent).not.toMatch(/本轮回复|工作记录，共/);
});

test('a short reply is not offered as a canvas text: 「放进画布」 needs 80 characters', async () => {
  api.getConversation.mockResolvedValue(replied('末世英雄·林烬：三十岁出头，左眼有一道旧疤，穿改装过的防化服，背一把自制弩。外冷内热，嘴上不饶人。'));
  await ready();
  await screen.findByText(/末世英雄·林烬/);
  expect(screen.queryByRole('button', { name: '放进画布' })).toBeNull();
});

// Codex 2026-10-21 (P1): closed during the execution, opened on another device. The assistant had prepared the video object
// (§6.1) and the step was bound to it; the restore only asked whether that node exists, so the paid result never landed.
const PE = 'PEX-prep';
const preparedVideo = { id: 'dlg-vid', type: 'video', title: '让她转身', position: { x: 400, y: 0 }, width: 360, height: 240,
  metadata: { prompt: '她缓慢转身', studio: { kind: 'shot', spec: { aspectRatio: '9:16', durationSec: 5, source: 'assistant', updatedAt: at } } } } as CanvasNodeData;
const preparedExecution: StudioPlanExecution = { ...doneExecution, id: PE,
  steps: [{ id: 's1', title: '一段 5 秒竖屏视频', operation: 'video', stage: 'production', dependsOn: [], status: 'done', runIds: ['r-prep'], attempt: 1, quotedCost: 40, nodeId: 'dlg-vid' }] };
const preparedRun: IpRun = { ...doneRun('r-prep', 'dlg-vid', 'studio-video', { videoCandidates: [{ index: 0, jobId: 'j', status: 'done', pct: 100, storageKey: 'material-videos/j/video.mp4', durationSec: 5 }] }),
  inputs: { executionId: PE, prompt: '她缓慢转身，看向镜头' } as unknown as IpRun['inputs'] };
/** No canvas cursor on this browser (another device); the projection record names the object (a restore replay records it). */
const preparedCanvas = () => {
  api.getConversation.mockResolvedValue(closedState({ ...confirmedCard, executionId: PE }));
  api.getExecution.mockResolvedValue(preparedExecution);
  api.getRun.mockImplementation(async (id: string) => { if (id !== 'r-prep') throw new Error('没有这次运行'); return preparedRun; });
  localStorage.setItem('studio-projected-nodes:p', JSON.stringify(['dlg-vid']));
};

test('closed during the execution, opened on another device: the result lands in the object prepared for it, once; one deleted here stays deleted', async () => {
  preparedCanvas();
  let canvas: CanvasNodeData[] = [];
  const first = await ready(<Host initial={[preparedVideo]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  await waitFor(() => expect(canvas.find(n => n.id === 'dlg-vid')?.metadata?.storageKey).toBe('material-videos/j/video.mp4'));
  expect(canvas).toHaveLength(1);
  expect(canvas[0].title).toBe('让她转身');
  // The user's prompt stays, and no adoption is offered for a restore.
  expect(canvas[0].metadata).toMatchObject({ prompt: '她缓慢转身', status: 'success', studio: { spec: { aspectRatio: '9:16' }, execution: { executionId: PE, stepId: 's1', runId: 'r-prep' } } });
  expect(screen.queryByLabelText('修改建议')).toBeNull();
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  first.unmount();
  // Opened again: the result is there, nothing is read or written.
  const reads = api.getRun.mock.calls.length, saves = api.save.mock.calls.length;
  let again: CanvasNodeData[] = [];
  const second = await ready(<Host initial={canvas} onCanvas={(nodes: CanvasNodeData[]) => { again = nodes; }}/>);
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledTimes(2));
  await settle();
  expect(again).toEqual(canvas);
  expect(api.getRun.mock.calls.length).toBe(reads);
  expect(api.save.mock.calls.length).toBe(saves);
  second.unmount();
  // Deleted on this browser: not rebuilt.
  let third: CanvasNodeData[] = [canvas[0]];
  await ready(<Host initial={[]} onCanvas={(nodes: CanvasNodeData[]) => { third = nodes; }}/>);
  await waitFor(() => expect(api.getExecution).toHaveBeenCalledTimes(3));
  await settle();
  expect(third).toEqual([]);
});

test('the replayed result event fills the prepared object too, when the execution cannot be read', async () => {
  preparedCanvas();
  api.getExecution.mockRejectedValue(new Error('暂时读不到'));
  let canvas: CanvasNodeData[] = [];
  await ready(<Host initial={[preparedVideo]} onCanvas={(nodes: CanvasNodeData[]) => { canvas = nodes; }}/>);
  // No cursor here: the thread replays from the start, and the executor's command is a restore.
  expect(streams.at(-1)!.cursor()).toBe(0);
  emit(ev('node.upsert', { nodeId: 'dlg-vid', op: 'update', executionId: PE, stepId: 's1', runId: 'r-prep',
    node: { id: 'dlg-vid', type: 'video', title: '一段 5 秒竖屏视频', width: 320, height: 240, position: { x: 0, y: 0 },
      metadata: { status: 'success', storageKey: 'material-videos/j/video.mp4', prompt: '她缓慢转身，看向镜头', studio: { runId: 'r-prep', execution: { executionId: PE, stepId: 's1', runId: 'r-prep' } } } } },
    { executionId: PE, turnId: 'APR-1' }));
  await waitFor(() => expect(canvas.find(n => n.id === 'dlg-vid')?.metadata?.storageKey).toBe('material-videos/j/video.mp4'));
  expect(canvas).toHaveLength(1);
  expect(canvas[0].title).toBe('让她转身');
  expect(canvas[0].metadata?.prompt).toBe('她缓慢转身');
  await waitFor(() => expect(api.save).toHaveBeenCalled());
});
