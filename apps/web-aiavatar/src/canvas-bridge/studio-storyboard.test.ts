// 故事板投影的纯函数，node 环境就够（原在 ip/studio-storyboard.test.tsx 的 jsdom 里，2026-10-20 挪过来；
// 渲染与接线仍在那边）。
import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioStoryboardGroups, studioStoryboardLinks, studioStoryboardStatus, updateStudioStoryboardShot } from './studio-storyboard';

const make = (id: string, type: CanvasNodeType): CanvasNodeData => ({ id, type, title: id, width: 320, height: 240, position: { x: 0, y: 0 } });
const nodes = [make('商品文案', CanvasNodeType.Text), make('商品参考', CanvasNodeType.Image), make('待生成视频', CanvasNodeType.Video), make('配音', CanvasNodeType.Audio), make('分组', CanvasNodeType.Group)];
const edges: CanvasConnection[] = [{ id: '1', fromNodeId: '商品文案', toNodeId: '商品参考' }, { id: '2', fromNodeId: '商品参考', toNodeId: '待生成视频' }];

test('groups keep every canvas node exactly once and always list the three base types', () => {
  const groups = studioStoryboardGroups(nodes);
  expect(groups.flatMap(g => g.nodes)).toHaveLength(nodes.length);
  expect(groups.flatMap(g => g.nodes).every(n => nodes.includes(n))).toBe(true);
  expect(studioStoryboardGroups([]).map(g => g.label)).toEqual(['文本', '图片', '视频']);
});

test('links drop duplicate and dangling connections', () => {
  expect(studioStoryboardLinks('商品参考', nodes, [...edges, edges[0], { id: 'deleted', fromNodeId: 'gone', toNodeId: '商品参考' }]).incoming).toEqual([nodes[0]]);
});

test('queue, failure and previous media status take precedence over ready assets', () => {
  const video = { ...nodes[2], metadata: { storageKey: 'old.mp4', status: 'loading' as const, studio: { kind: 'shot' as const, task: { status: 'running' as const, queue: { position: 3 } as never } } } };
  expect(studioStoryboardStatus(video)).toBe('排队第 3 位');
  expect(studioStoryboardStatus({ ...video, metadata: { ...video.metadata, status: 'error' } })).toBe('生成失败');
  expect(studioStoryboardStatus(nodes[1])).toBe('待创作');
  expect(studioStoryboardStatus({ ...nodes[0], metadata: { content: '正文' } })).toBe('已就绪');
});

test('shot edits keep the original canvas identity and notify linked video without discarding its accepted output', () => {
  const shot = { ...nodes[1], metadata: { storageKey: 'frame.png', studio: { kind: 'shot' as const, shot: { id: 'shot', title: '镜头', description: '旧画面', dialogue: '原台词', durationSec: 5, characters: [] } } } };
  const video = { ...nodes[2], metadata: { storageKey: 'accepted.mp4', studio: { kind: 'shot' as const, runId: 'accepted-run' } } };
  const result = updateStudioStoryboardShot([shot, video], edges, shot.id, { description: '新画面', dialogue: '新台词' });
  expect(result[0].id).toBe(shot.id);
  expect(result[0].metadata?.prompt).toBe('新画面');
  expect(result[0].metadata?.studio?.shot?.dialogue).toBe('新台词');
  expect(result[1].metadata?.studio?.upstreamChanged).toBe(true);
  expect(result[1].metadata?.storageKey).toBe('accepted.mp4');
  expect(result[1].metadata?.studio?.runId).toBe('accepted-run');
  expect(updateStudioStoryboardShot(result, edges, shot.id, { description: '新画面' })).toBe(result);
});
