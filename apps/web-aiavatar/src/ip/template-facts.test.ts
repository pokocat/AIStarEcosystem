import { describe, expect, test } from 'vitest';
import { homeRecommendations, inspirationOrder, inspirationPlacement, newestFirst, templateKind, templateNeeds, templateNodeNote, templatePrompt, templateRatio, templateSearchText, templateSpec } from './template-facts';

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
  test('an inspiration case is the real chain: the reference has no prompt, the generated card holds prompt, spec and result', () => {
    const chain = { nodes: [
      node('guide', 'text', '创作说明', { content: '这套做法', prompt: '帮我生成这段视频：海报动起来' }),
      node('input', 'image', '参考海报', { storageKey: 'ipstudio_demo/x/poster.jpg', naturalWidth: 1680, naturalHeight: 2240, size: '1680x2240' }),
      node('result', 'video', '成片', { storageKey: 'ipstudio_demo/x/a.mp4', prompt: '海报动起来', size: '3:4', seconds: 5, naturalWidth: 834, naturalHeight: 1112 }),
    ] } as any;
    expect(templatePrompt(chain)).toBe('海报动起来');
    expect(templateSpec(chain)).toBe('3:4 · 5 秒');
    expect(templateNeeds(chain)).toEqual([]);
    expect(templateRatio(chain)).toBeCloseTo(834 / 1112);
    // 首帧 → 成片：两个都生成过，规格说的是成片
    const frames = { nodes: [
      node('frame', 'image', '首帧', { storageKey: 'k1', prompt: '电梯门' }),
      node('clip', 'video', '成片', { storageKey: 'k2', prompt: '门打开', seconds: '5', size: '768x1344' }),
    ] } as any;
    expect(templateSpec(frames)).toBe('5 秒');
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

describe('templateNodeNote', () => {
  test('a read-only node never shows its prompt, nor the derived address of its media', () => {
    expect(templateNodeNote({ type: 'video', metadata: { prompt: '倒水的特写' } } as any)).not.toContain('倒水');
    expect(templateNodeNote({ type: 'image', metadata: { content: 'https://cdn.test/a.jpg' } } as any)).not.toContain('https');
    expect(templateNodeNote({ type: 'text', metadata: { content: '这套做法', prompt: '帮我生成' } } as any)).toBe('这套做法');
    expect(templateNodeNote({ type: 'text', metadata: { prompt: '帮我生成' } } as any)).not.toContain('帮我生成');
  });
});

describe('the inspiration wall', () => {
  const nodeWith = (metadata: any, type = 'image') => ({ id: 'n', type, title: 't', position: { x: 0, y: 0 }, width: 1, height: 1, metadata });
  const docOf = (...nodes: any[]) => ({ nodes, connections: [], viewport: { x: 0, y: 0, k: 1 } }) as any;

  test('a work keeps its real shape: measured first, then its size, and nothing is guessed', () => {
    expect(templateRatio(docOf(nodeWith({ storageKey: 'k', naturalWidth: 1344, naturalHeight: 768 }, 'video')))).toBeCloseTo(1.75);
    expect(templateRatio(docOf(nodeWith({ storageKey: 'k', size: '1024x1536' })))).toBeCloseTo(2 / 3);
    expect(templateRatio(docOf(nodeWith({ size: '9:16' }, 'video')))).toBeCloseTo(9 / 16);
    expect(templateRatio(docOf(nodeWith({ storageKey: 'k' })))).toBeUndefined();
    expect(templateRatio(docOf(nodeWith({ storageKey: 'k', size: '21:5' })))).toBe(2);
    expect(templateRatio(docOf(nodeWith({ content: 'words', size: '1:1' }, 'text')))).toBeUndefined();
  });

  const card = (id: string, size: string) => ({ id, doc: docOf(nodeWith({ storageKey: id, size })) });
  test('each card goes into the shortest column', () => {
    const placed = inspirationPlacement([card('tall', '1:2'), card('b', '1:1'), card('c', '1:1')], 2).map(c => c.map(x => x.item.id));
    expect(placed).toEqual([['tall'], ['b', 'c']]);
  });

  test('more cards never move the ones already on the page', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => card(id, i % 2 ? '9:16' : '16:9'));
    const first = inspirationPlacement(rows.slice(0, 4), 3), all = inspirationPlacement(rows, 3);
    first.forEach((column, c) => expect(all[c].slice(0, column.length)).toEqual(column));
  });

  test('newest first, and what has something to look at comes before a list of steps', () => {
    const steps = { id: 'steps', createdAt: '2026-11-06T00:00:00Z', doc: docOf(nodeWith({ prompt: 'p' })) };
    const old = { id: 'old', createdAt: '2026-11-03T00:00:00Z', coverUrl: 'c', doc: docOf() };
    const fresh = { id: 'fresh', createdAt: '2026-11-05T00:00:00Z', doc: docOf(nodeWith({ storageKey: 'k' })) };
    expect(inspirationOrder([old, steps, fresh]).map(t => t.id)).toEqual(['fresh', 'old', 'steps']);
  });

  test('home recommendations compare exact publication times across content types', () => {
    const builtIn = { id: 'built-in', createdAt: undefined };
    const olderVideo = { id: 'video', createdAt: '2026-11-13T11:01:20.123Z', previewVideoUrl: 'video' };
    const newerCanvas = { id: 'canvas', createdAt: '2026-11-13T19:01:20.456+08:00' };
    const rows = [builtIn, olderVideo, newerCanvas];
    expect(homeRecommendations(rows).map(t => t.id)).toEqual(['canvas', 'video', 'built-in']);
    expect(rows.map(t => t.id)).toEqual(['built-in', 'video', 'canvas']);
  });
});

