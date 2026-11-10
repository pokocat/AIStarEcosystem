import { expect, test } from 'vitest';
import type { StudioVideoTask, StudioVideoTaskCreate } from '@ai-star-eco/types/ip-studio-video-task';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { applyChanges, changeSegments, groupTakes, latestRewrites, latestVariables, parseTakeVariables, sameTakes, sampleTakes, takeModes, takePriceQuery,
  takeRequest, takeTag } from './scene-video-takes';

const SCRIPT = '宝妈小林在厨房里试用卸妆膏。小林说：「三秒卸干净。」结尾：点下方链接。';
const base = (): StudioVideoTaskCreate => ({
  clientRequestId: 'orig', kind: 'direct', sceneId: 'ecom-talking', title: '口播带货 · 卸妆膏', budgetCap: 900, billing: { mode: 'personal' },
  configuration: { clientRequestId: 'orig', sceneId: 'ecom-talking', text: SCRIPT, hasScript: true, duration: 15, ratio: '9:16', model: 'ep-h3', tier: '768p', optimize: true,
    materials: [{ nodeId: 'n1', title: '商品图 1', slot: 'image' }, { nodeId: 'n2', title: '出镜人物', slot: 'character' }], budgetCap: 900, billing: { mode: 'personal' } },
  video: { clientRequestId: 'v-orig', nodeId: 'row-1', operation: 'video', prompt: SCRIPT, model: 'ep-h3', durationSec: 15, aspectRatio: '9:16', maxCost: 300,
    billing: { mode: 'personal' }, modelBilling: { walletId: 'w' } as never, video: { mode: 'universal_reference_video', resolutionTier: '768p', references: [] } as never },
  input: { nodes: [], sceneVideoState: { text: '', options: {}, edit: { scriptId: 'script-1', prompt: SCRIPT } } },
});
const task = (id: string, createdAt: string, projectId = 'IPP-1', request: StudioVideoTaskCreate = base()) =>
  ({ id, projectId, sceneId: request.sceneId, title: request.title, kind: request.kind, createdAt, request, input: request.input }) as StudioVideoTask;

test('a take keeps the settings, replaces request ids, cap and payer approvals, and records where it came from', () => {
  const next = takeRequest(base(), 'take-1', 1200, 'v-take-1', { take: { of: 'PEX-a', mode: 'same' } });
  expect(next.clientRequestId).toBe('take-1');
  expect(next.budgetCap).toBe(1200);
  expect(next.billing).toBeUndefined();
  expect(next.configuration).toMatchObject({ clientRequestId: 'take-1', budgetCap: 1200, text: SCRIPT, model: 'ep-h3' });
  expect(next.configuration).not.toHaveProperty('billing');
  expect(next.video).toMatchObject({ clientRequestId: 'v-take-1', prompt: SCRIPT, nodeId: 'row-1' });
  expect(next.video).not.toHaveProperty('billing');
  expect(next.video).not.toHaveProperty('modelBilling');
  expect(next.input.take).toEqual({ of: 'PEX-a', mode: 'same' });
  // 原请求不被改动：它是已受理任务的快照。
  expect(base().configuration!.clientRequestId).toBe('orig');
});

test('a changed take sends the new script to the model and puts it back in the editor', () => {
  const change = [{ name: '场景', from: '厨房', to: '阳台' }];
  const text = applyChanges(SCRIPT, change);
  const next = takeRequest(base(), 'take-2', 900, 'v-take-2', { take: { of: 'PEX-a', mode: 'variables', changes: change }, text });
  expect(next.configuration!.text).toContain('在阳台里试用');
  expect(next.video!.prompt).toBe(next.configuration!.text);
  // 编导的六段脚本：发给模型的是挑过段落的（scene-script-layers.ts），configuration.text 留完整的，下次改写在它上面改。
  const six = '一、剧情概述：宝妈试用。\n五、镜头时间轴：\n第1镜（0–4 秒）这一镜的作用：截停\n宝妈说：「三秒卸干净。」';
  const layered = takeRequest(base(), 'take-4', 900, 'v-take-4', { take: { of: 'PEX-a', mode: 'rewrite' }, text: six });
  expect(layered.configuration!.text).toBe(six);
  expect(layered.video!.prompt).toBe('第1镜（0–4 秒）\n宝妈说：「三秒卸干净。」');
  expect(next.input.sceneVideoState!.edit).toEqual({ scriptId: 'script-1', prompt: text });
  // AI 改写的脚本没有编导版本：给新的编号，放回时补一版脚本。
  const rewritten = takeRequest(base(), 'take-3', 900, 'v-take-3', { take: { of: 'PEX-a', mode: 'rewrite' }, text: '新脚本', scriptId: 'fresh' });
  expect(rewritten.input.sceneVideoState!.edit).toEqual({ scriptId: 'fresh', prompt: '新脚本' });
  // 没采用过编导脚本的（自己写的要求）换的是要求那一栏。
  const typed = { ...base(), input: { nodes: [], sceneVideoState: { text: SCRIPT, options: {} } } };
  expect(takeRequest(typed, 'x', 1, 'y', { take: { of: 'a', mode: 'variables' }, text: '换过的' }).input.sceneVideoState).toMatchObject({ text: '换过的' });
});

test('the price query uses the submitted spec', () => {
  expect(takePriceQuery(base())).toEqual({ kind: 'direct', model: 'ep-h3', mode: 'universal_reference_video', tier: '768p', duration: 15, ratio: '9:16',
    images: 1, character: true, voice: false, optimize: true });
});

test('variables are read one per line; lines whose original text is not in the script are dropped', () => {
  const content = ['人物身份｜宝妈｜上班族｜大学生｜宝妈', '1. 场景|厨房|阳台|办公室', '- 开场一句｜「三秒卸干净。」｜一抹就化开。', '名称｜原文｜替换1',
    '商品｜不存在的说法｜别的', '只有两段｜宝妈', '场景｜厨房｜重复的那行'].join('\n');
  const vars = parseTakeVariables(content, SCRIPT);
  expect(vars.map(v => [v.name, v.from, v.values])).toEqual([
    ['人物身份', '宝妈', ['上班族', '大学生']],
    ['场景', '厨房', ['阳台', '办公室']],
    ['开场一句', '三秒卸干净。', ['一抹就化开。']],
  ]);
  expect(parseTakeVariables('无', SCRIPT)).toEqual([]);
});

test('each take gets one value per switched-on variable, takes differ while values last, and the same seed gives the same set', () => {
  const vars = parseTakeVariables('人物身份｜宝妈｜上班族｜大学生｜护士\n场景｜厨房｜阳台｜办公室', SCRIPT);
  const takes = sampleTakes(vars, 3, 1);
  expect(takes).toHaveLength(3);
  expect(takes.every(t => t.length === 2)).toBe(true);
  expect(new Set(takes.map(t => t[0].to)).size).toBe(3);
  expect(sampleTakes(vars, 3, 1)).toEqual(takes);
  expect(takes.flat().every(c => c.to !== c.from)).toBe(true);
  expect(sampleTakes([{ ...vars[0], on: false }, vars[1]], 2, 1).every(t => t.length === 1 && t[0].name === '场景')).toBe(true);
  expect(sampleTakes(vars.map(v => ({ ...v, on: false })), 2, 1)).toEqual([[], []]);
});

test('replacing marks every place the words appear, longer phrases first', () => {
  const text = '宝妈在厨房。宝妈说厨房真乱。';
  const parts = changeSegments(text, [{ name: '人物', from: '宝妈', to: '上班族' }, { name: '场景', from: '厨房真乱', to: '桌上真乱' }]);
  expect(parts.map(p => p.text).join('')).toBe('上班族在厨房。上班族说桌上真乱。');
  expect(parts.filter(p => p.change).map(p => p.change!.name)).toEqual(['人物', '人物', '场景']);
});

test('what kind of takes a task allows', () => {
  expect(takeModes(base()).every(m => !m.reason)).toBe(true);
  const typed = { ...base(), configuration: { ...base().configuration!, hasScript: false } };
  expect(takeModes(typed).find(m => m.mode === 'rewrite')!.reason).toBeTruthy();
  const recreation = { ...base(), kind: 'recreation' as const };
  expect(takeModes(recreation).filter(m => m.reason).map(m => m.mode)).toEqual(['variables', 'rewrite']);
  // 没有提交快照的旧任务只能自己改。
  expect(takeModes(undefined).every(m => m.reason)).toBe(true);
});

test('everything made in one draft is one group, whatever its content', () => {
  const original = task('PEX-a', '2026-11-09T01:00:00Z');
  const edited = task('PEX-b', '2026-11-09T02:00:00Z', 'IPP-1', { ...base(), configuration: { ...base().configuration!, text: '改过的脚本' } });
  const elsewhere = task('PEX-c', '2026-11-09T03:00:00Z', 'IPP-2');
  const all = [elsewhere, edited, original];
  expect(sameTakes(all, original).map(t => t.id)).toEqual(['PEX-a', 'PEX-b']);
  expect(groupTakes(all).map(g => [g.latest.id, g.tasks.length])).toEqual([['PEX-c', 1], ['PEX-b', 2]]);
});

test('a take says how it was made', () => {
  const t = task('PEX-a', '2026-11-09T01:00:00Z');
  expect(takeTag(t)).toEqual({});
  t.input = { ...t.input!, take: { of: 'x', mode: 'variables', changes: [{ name: '场景', from: '厨房', to: '阳台' }] } };
  expect(takeTag(t)).toEqual({ label: '换变量', detail: '场景：阳台' });
  t.input = { ...t.input!, take: { of: 'x', mode: 'same' } };
  expect(takeTag(t).label).toBe('裂变');
  t.input = { ...t.input!, take: { of: 'x', mode: 'rewrite' } };
  expect(takeTag(t).label).toBe('AI 改写');
});

const takeNode = (id: string, kind: 'variables' | 'rewrite', at: string, extra: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) =>
  ({ id, type: 'text', title: id, position: { x: 0, y: 0 }, width: 1, height: 1,
    metadata: { status: 'success', content: '', ...meta, studio: { kind: 'text', sceneTake: { of: 'PEX-a', kind, batch: 'b1', at, ...extra } } } }) as unknown as CanvasNodeData;

test('the latest variables and the latest batch of rewrites are read from the draft', () => {
  const nodes = [
    takeNode('v-old', 'variables', '2026-11-09T01:00:00Z', {}, { content: '场景｜厨房｜阳台' }),
    takeNode('v-new', 'variables', '2026-11-09T02:00:00Z', {}, { content: '人物身份｜宝妈｜上班族' }),
    takeNode('r1-old', 'rewrite', '2026-11-09T01:00:00Z', { batch: 'old', index: 1, total: 1 }),
    takeNode('r2', 'rewrite', '2026-11-09T03:00:00Z', { batch: 'new', index: 2, total: 2 }),
    takeNode('r1', 'rewrite', '2026-11-09T03:00:00Z', { batch: 'new', index: 1, total: 2 }),
    { ...takeNode('other', 'rewrite', '2026-11-09T04:00:00Z'), metadata: { studio: { kind: 'text', sceneTake: { of: 'PEX-other', kind: 'rewrite', batch: 'x', at: '2026-11-09T04:00:00Z' } } } } as unknown as CanvasNodeData,
  ];
  expect(latestVariables(nodes, 'PEX-a', SCRIPT).variables.map(v => v.name)).toEqual(['人物身份']);
  expect(latestRewrites(nodes, 'PEX-a').map(n => n.id)).toEqual(['r1', 'r2']);
  const loading = [takeNode('v', 'variables', '2026-11-09T05:00:00Z', {}, { status: 'loading', content: '场景｜厨房｜阳台' })];
  expect(latestVariables(loading, 'PEX-a', SCRIPT)).toMatchObject({ status: 'loading', variables: [] });
});
