import { describe, expect, test } from 'vitest';
import { newestFirst, templateKind, templateNeeds, templatePrompt, templateSearchText, templateSpec } from './template-facts';

const node = (id: string, type: string, title: string, metadata: any) => ({ id, type, title, position: { x: 0, y: 0 }, width: 100, height: 100, metadata });
const doc = { nodes: [
  node('guide', 'text', '创作说明', { content: '这套做法', prompt: '帮我生成这段视频：倒水' }),
  node('input', 'image', '我的商品图', { status: 'idle', studio: { templateInput: { required: false, label: '我的商品图' } } }),
  node('mine', 'video', '我的版本', { prompt: '倒水的特写', size: '16:9', seconds: 6 }),
  node('sample', 'video', '示例效果', { storageKey: 'ipstudio_demo/x/a.mp4', prompt: '倒水的特写', size: '16:9', seconds: 6 }),
] } as any;

describe('what a template tells you before you copy it', () => {
  test('the prompt is the waiting node\'s, not the assistant\'s phrasing', () => expect(templatePrompt(doc)).toBe('倒水的特写'));
  test('the spec comes from the same node', () => expect(templateSpec(doc)).toBe('16:9 · 6 秒'));
  test('a pixel size is not shown as a ratio, and nothing is guessed', () => {
    expect(templateSpec({ nodes: [node('a', 'image', '图', { storageKey: 'k', size: '1024x1024' })] } as any)).toBe('');
  });
  test('a slot waiting for the user is listed, optional or not; nodes with a file or a prompt are not', () => {
    expect(templateNeeds(doc)).toEqual([{ label: '我的商品图', optional: true }]);
    expect(templateNeeds({ nodes: [node('a', 'image', '① 你的照片', {})] } as any)).toEqual([{ label: '① 你的照片', optional: false }]);
  });
  test('search reaches into the prompts', () => {
    expect(templateSearchText({ name: '小红书封面', summary: '撞色', doc: { nodes: [node('a', 'image', '我的版本', { prompt: '秋冬美拉德穿搭' })] } } as any)).toContain('穿搭');
  });
  test('kind follows what the document holds', () => {
    expect(templateKind({ doc })).toBe('video');
    expect(templateKind({ doc: { nodes: [node('a', 'image', '图', { storageKey: 'k' })] } } as any)).toBe('image');
    expect(templateKind({ doc: { nodes: [node('a', 'image', '图', { prompt: 'x' })] } } as any)).toBe('canvas');
  });
});

describe('newestFirst', () => {
  const row = (id: string, createdAt?: string) => ({ id, createdAt });
  const ids = (rows: { id: string }[]) => rows.map(r => r.id);

  test('newer days first; a batch published on one day keeps the order it was given', () => {
    const rows = [row('old', '2026-11-03T02:00:00Z'), row('b1', '2026-11-06T00:22:10Z'), row('b2', '2026-11-06T00:22:20Z'), row('mid', '2026-11-04T02:00:00Z')];
    expect(ids(newestFirst(rows))).toEqual(['b1', 'b2', 'mid', 'old']);
    expect(ids(rows)).toEqual(['old', 'b1', 'b2', 'mid']);
  });

  test('anything without a usable time goes last, in the order given', () => {
    expect(ids(newestFirst([row('builtin'), row('bad', 'not a date'), row('dated', '2026-11-03T02:00:00Z')]))).toEqual(['dated', 'builtin', 'bad']);
  });
});
