// @vitest-environment jsdom
// 「视频裂变」弹窗（2026-11-09 用户要求）：多条可以原样、换变量（不调 AI）、AI 改写。2026-11-10 起「自己改」拿出去成了设置区的「重新生成」。
// 弹窗只负责选和看，断言它交给页面的东西：几条、每条换了什么、脚本换成什么。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StudioVideoTask, StudioVideoTaskCreate } from '@ai-star-eco/types/ip-studio-video-task';
import type { CanvasNodeData } from '@/canvas/types/canvas';
vi.mock('@/canvas-bridge/studio-video-tasks', async original => ({ ...await original<any>(), videoTaskPrice: async () => ({ estimated: 1000, cap: 1200, segments: [15], boards: 1 }) }));
vi.mock('@/canvas-bridge/studio-video-price', async original => ({ ...await original<any>(), useStudioVideoPrice: () => ({ status: 'idle' }) }));
import { VideoMoreDialog } from './scene-video-more';

const SCRIPT = '宝妈小林在厨房里试用卸妆膏。小林说：「三秒卸干净。」';
const request = (over: Partial<StudioVideoTaskCreate> = {}): StudioVideoTaskCreate => ({
  clientRequestId: 'orig', kind: 'segmented', sceneId: 'ecom-talking', title: '口播带货 · 卸妆膏', budgetCap: 900,
  configuration: { clientRequestId: 'orig', sceneId: 'ecom-talking', text: SCRIPT, hasScript: true, duration: 30, ratio: '9:16', model: 'ep-h3', tier: '768p', materials: [], budgetCap: 900 },
  input: { nodes: [], sceneVideoState: { text: '', options: {} } }, ...over });
const task = (over: Partial<StudioVideoTaskCreate> = {}) => ({ id: 'PEX-a', projectId: 'IPP-1', sceneId: 'ecom-talking', title: '口播带货 · 卸妆膏', kind: 'segmented',
  createdAt: '2026-11-09T01:00:00Z', request: request(over), input: request(over).input }) as StudioVideoTask;
const node = (id: string, kind: 'variables' | 'rewrite', meta: Record<string, unknown>, take: Record<string, unknown> = {}) =>
  ({ id, type: 'text', title: id, position: { x: 0, y: 0 }, width: 1, height: 1,
    metadata: { status: 'success', content: '', ...meta, studio: { kind: 'text', runId: `run-${id}`, sceneTake: { of: 'PEX-a', kind, batch: 'b1', at: '2026-11-09T02:00:00Z', ...take } } } }) as unknown as CanvasNodeData;
const VARS = node('vars', 'variables', { content: '人物身份｜宝妈｜上班族｜大学生\n场景｜厨房｜阳台｜办公室' });

function show(props: Partial<Parameters<typeof VideoMoreDialog>[0]> = {}) {
  const calls = { onClose: vi.fn(), onFind: vi.fn().mockResolvedValue(undefined), onWrite: vi.fn().mockResolvedValue(undefined),
    onGenerate: vi.fn().mockResolvedValue(true), onConfirm: vi.fn() };
  const all = { task: task(), modelName: 'H3', free: true, busy: false, nodes: [], ...calls, ...props };
  const view = render(<VideoMoreDialog {...all}/>);
  return { ...calls, ...props, view, rerender: (next: Partial<typeof all>) => view.rerender(<VideoMoreDialog {...all} {...next}/>) } as typeof calls & { rerender: (next: Partial<typeof all>) => void };
}
const dialog = () => screen.getByRole('dialog', { name: '视频裂变' });
const vars = () => within(within(dialog()).getByRole('list'));
const way = (name: string) => fireEvent.click(within(dialog()).getByRole('radio', { name: new RegExp(name) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('原样: the chosen number of takes go to the page unchanged, and the dialog closes once they are all in', async () => {
  const s = show();
  expect(within(dialog()).getByRole('radio', { name: /原样/ }).getAttribute('aria-checked')).toBe('true');
  expect(dialog().textContent).toContain('H3');
  fireEvent.click(within(dialog()).getByRole('button', { name: '3 条' }));
  expect(within(dialog()).getAllByRole('tab')).toHaveLength(3);
  await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /生成 3 条/ })); });
  expect(s.onGenerate).toHaveBeenCalledWith([1, 2, 3].map(() => ({ take: { of: 'PEX-a', mode: 'same' } })), undefined);
  await waitFor(() => expect(s.onClose).toHaveBeenCalled());
});

test('a long video shows what the takes cost in total', async () => {
  show({ free: false });
  await waitFor(() => expect(within(dialog()).getByRole('button', { name: /生成 2 条/ }).textContent).toContain('约 2,000 积分'));
});

test('换变量: find variables first; each take swaps one value per variable and the preview marks what changed', async () => {
  const s = show();
  way('换变量');
  const go = within(dialog()).getByRole('button', { name: /生成 2 条/ }) as HTMLButtonElement;
  expect(go.disabled).toBe(true);
  expect(dialog().textContent).toContain('请先找变量');
  fireEvent.click(within(dialog()).getByRole('button', { name: '找变量' }));
  expect(s.onFind).toHaveBeenCalledOnce();

  s.rerender({ nodes: [VARS] });
  expect(vars().getByText('人物身份')).toBeTruthy();
  expect(vars().getByText('上班族')).toBeTruthy();
  const marks = [...dialog().querySelectorAll('.video-more-script mark')].map(m => m.textContent);
  expect(marks).toHaveLength(2);
  expect(marks.every(m => ['上班族', '大学生', '阳台', '办公室'].includes(m!))).toBe(true);

  // 关掉「场景」：每条只换人物身份。
  fireEvent.click(within(dialog()).getByRole('checkbox', { name: /场景/ }));
  await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /生成 2 条/ })); });
  const takes = s.onGenerate.mock.calls[0][0];
  expect(takes).toHaveLength(2);
  for (const t of takes) {
    expect(t.take).toMatchObject({ of: 'PEX-a', mode: 'variables' });
    expect(t.take.changes.map((c: { name: string }) => c.name)).toEqual(['人物身份']);
    expect(t.text).toContain('在厨房里');
    expect(t.text).not.toContain('宝妈');
  }
  expect(new Set(takes.map((t: { text: string }) => t.text)).size).toBe(2);
});

test('换变量: values can be removed and added, and switching every variable off blocks generating', () => {
  show({ nodes: [VARS] });
  way('换变量');
  fireEvent.click(within(dialog()).getByRole('button', { name: '删除「上班族」' }));
  expect(vars().queryByText('上班族')).toBeNull();
  fireEvent.click(within(dialog()).getAllByRole('button', { name: '添加' })[0]);
  const input = within(dialog()).getByRole('textbox', { name: '给「人物身份」添加一个替换' });
  fireEvent.change(input, { target: { value: '护士' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(vars().getByText('护士')).toBeTruthy();
  for (const box of within(dialog()).getAllByRole('checkbox')) fireEvent.click(box);
  expect((within(dialog()).getByRole('button', { name: /生成 2 条/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(dialog().textContent).toContain('请至少保留一处变量');
});

test('AI 改写: first writes one script per take with its changes, then generates the scripts that were written', async () => {
  const s = show({ nodes: [VARS] });
  way('AI 改写');
  await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /写 2 版脚本/ })); });
  // 还没写：原脚本里要改的地方先标出来。
  expect([...dialog().querySelectorAll('.video-more-script.is-original mark')].map(m => m.textContent)).toEqual(expect.arrayContaining(['宝妈', '厨房']));
  const changes = s.onWrite.mock.calls[0][0];
  expect(changes).toHaveLength(2);
  expect(changes[0].map((c: { name: string }) => c.name)).toEqual(['人物身份', '场景']);

  const written = [node('r1', 'rewrite', { content: '第一版脚本' }, { index: 1, total: 2, changes: changes[0] }),
    node('r2', 'rewrite', { status: 'loading' }, { index: 2, total: 2, changes: changes[1] })];
  s.rerender({ nodes: [VARS, ...written] });
  expect((within(dialog()).getByRole('button', { name: /正在写脚本/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(dialog()).getByText('第一版脚本')).toBeTruthy();

  // 第二版没写成：只生成写好的那条，并说清楚。
  s.rerender({ nodes: [VARS, written[0], node('r2', 'rewrite', { status: 'error', errorDetails: '模型没有返回内容' }, { index: 2, total: 2 })] });
  expect(dialog().textContent).toContain('1 版没写成');
  fireEvent.click(within(dialog()).getByRole('tab', { name: /第 2 条/ }));
  expect(dialog().textContent).toContain('模型没有返回内容');
  await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /生成 1 条/ })); });
  expect(s.onGenerate).toHaveBeenCalledWith([{ take: { of: 'PEX-a', mode: 'rewrite', changes: changes[0] }, text: '第一版脚本' }], undefined);
  // 想换一批：重新写。
  fireEvent.click(within(dialog()).getByRole('button', { name: '重新写' }));
  expect(s.onWrite).toHaveBeenCalledTimes(2);
});

test('AI 改写 also works without variables: the director changes things itself', async () => {
  const s = show();
  way('AI 改写');
  expect(dialog().textContent).toContain('AI 编导自己换开场、人物和台词');
  await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: /写 2 版脚本/ })); });
  expect(s.onWrite).toHaveBeenCalledWith([[], []]);
});

// 2026-11-10 用户：裂变里不再有「自己改」，放回编辑页是设置区单独的「再次生成」。
test('the dialog offers only ways that make new takes', () => {
  show();
  expect(within(dialog()).getAllByRole('radio').map(r => r.textContent)).toEqual([expect.stringContaining('原样'), expect.stringContaining('换变量'), expect.stringContaining('AI 改写')]);
});

test('a copy of a reference video can only be made again as is, and an old task without a record cannot make takes', () => {
  show({ task: task({ kind: 'recreation' }) });
  way('换变量');
  expect((within(dialog()).getByRole('button', { name: /生成 2 条/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(dialog()).queryByRole('button', { name: '找变量' })).toBeNull();
  cleanup();
  const old = { ...task(), request: undefined } as StudioVideoTask;
  show({ task: old });
  expect((within(dialog()).getByRole('button', { name: /生成 2 条/ }) as HTMLButtonElement).disabled).toBe(true);
});

test('a script that has no AI-director version cannot be rewritten by AI', () => {
  show({ task: task({ configuration: { ...request().configuration!, hasScript: false } }) });
  way('AI 改写');
  expect((within(dialog()).getByRole('button', { name: /写 2 版脚本|生成 2 条/ }) as HTMLButtonElement).disabled).toBe(true);
});

test('arrow keys move between the ways and between the takes', () => {
  show();
  fireEvent.keyDown(within(dialog()).getByRole('radiogroup'), { key: 'ArrowDown' });
  expect(within(dialog()).getByRole('radio', { name: /换变量/ }).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(within(dialog()).getByRole('radiogroup'), { key: 'ArrowUp' });
  fireEvent.keyDown(within(dialog()).getByRole('radiogroup'), { key: 'ArrowUp' });
  expect(within(dialog()).getByRole('radio', { name: /AI 改写/ }).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(within(dialog()).getByRole('radiogroup'), { key: 'ArrowDown' });
  fireEvent.keyDown(within(dialog()).getByRole('tablist'), { key: 'ArrowRight' });
  expect(within(dialog()).getByRole('tab', { name: /第 2 条/ }).getAttribute('aria-selected')).toBe('true');
});

test('changing the count after the AI wrote its versions says how to use them', () => {
  const written = [1, 2].map(i => node(`r${i}`, 'rewrite', { content: `第 ${i} 版` }, { index: i, total: 2 }));
  show({ nodes: written });
  way('AI 改写');
  fireEvent.click(within(dialog()).getByRole('button', { name: '3 条' }));
  expect(within(dialog()).getByRole('button', { name: /写 3 版脚本/ })).toBeTruthy();
  expect(dialog().textContent).toContain('已写好 2 版，选 2 条可直接生成');
});

test('Esc and the close button close the dialog', () => {
  const s = show();
  fireEvent.keyDown(dialog(), { key: 'Escape' });
  fireEvent.click(within(dialog()).getByRole('button', { name: '关闭' }));
  expect(s.onClose).toHaveBeenCalledTimes(2);
});
