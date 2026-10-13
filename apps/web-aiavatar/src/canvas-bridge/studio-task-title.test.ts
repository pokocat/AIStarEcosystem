import { expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { studioTaskPresentation } from './studio-task-title';

const nodes = [{ id: 'image', title: '后来改名的图片', metadata: {} }, { id: 'chat', title: '全能创作', metadata: { studio: { conversation: {} } } }] as CanvasNodeData[];
const run = (inputs: object, output: object = {}): IpRun => ({ id: 'run', nodeId: 'chat', kind: 'studio-assistant', inputs, output } as IpRun);
const context = [{ id: 'image', title: '小巡形象图', type: 'image' }];
const step = (field: string, nodeId = 'image') => ({ id: 'step', operation: 'text', title: '建议修改', prompt: '改写', editTarget: { field, nodeId } });

test.each([['prompt', '修改提示词'], ['content', '修改正文'], ['script', '修改剧本']])('names %s edits from the submitted node snapshot', (field, action) => {
  expect(studioTaskPresentation(run({ operation: 'assistant', prompt: '请改得更自然', appliedCanvasContext: context }, { plan: { steps: [step(field)] } }), nodes))
    .toEqual({ title: `${action} · 小巡形象图`, detail: '请改得更自然' });
});
test('different requests on one conversation retain their own action and original instructions', () => {
  const first = studioTaskPresentation(run({ operation: 'assistant', prompt: '优化当前形象的提示词', contextNodeIds: ['image'], appliedCanvasContext: context }), nodes);
  const second = studioTaskPresentation(run({ operation: 'assistant', prompt: '修改正文，加一句欢迎语', contextNodeIds: ['image'], appliedCanvasContext: context }), nodes);
  expect(first.title).toBe('修改提示词 · 小巡形象图'); expect(second.title).toBe('修改正文 · 小巡形象图');
  expect(first.detail).not.toBe(second.detail);
});
test('new content and multi-step plans identify the actual proposed results', () => {
  expect(studioTaskPresentation(run({}, { plan: { steps: [{ operation: 'text', title: '小巡欢迎语' }] } }), nodes).title).toBe('创作文字 · 小巡欢迎语');
  expect(studioTaskPresentation(run({}, { plan: { steps: [{ operation: 'text', title: '小巡设定' }, { operation: 'image', title: '小巡形象' }] } }), nodes).title).toBe('规划创作流程 · 小巡设定、小巡形象');
});
test('missing old context uses a surviving canvas title, while deleted nodes stay identifiable', () => {
  expect(studioTaskPresentation(run({}, { plan: { steps: [step('prompt')] } }), nodes).title).toBe('修改提示词 · 后来改名的图片');
  expect(studioTaskPresentation(run({}, { plan: { steps: [step('prompt', 'deleted')] } }), nodes).title).toBe('修改提示词 · 已移除节点');
});
test('wrapped native image requests and video durations display the right action and node', () => {
  expect(studioTaskPresentation({ ...run({ studioRequest: { operation: 'image', prompt: '角色正面照' } }), nodeId: 'image', kind: 'generate' }, nodes).title).toBe('生成图片 · 后来改名的图片');
  expect(studioTaskPresentation({ ...run({ operation: 'video', durationSec: 5 }), nodeId: 'image', kind: 'studio-video' }, nodes).title).toBe('生成视频 · 后来改名的图片 · 5 秒');
});
test('a fresh or failed conversation shows the current request without borrowing later results', () => {
  expect(studioTaskPresentation(run({ prompt: '写一句全新的欢迎语' }), nodes)).toEqual({ title: 'AI 创作 · 写一句全新的欢迎语', detail: '写一句全新的欢迎语' });
});
