// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { StudioStoryboard } from './studio-storyboard';
import { studioStoryboardGroups, studioStoryboardLinks, studioStoryboardStatus, updateStudioStoryboardShot } from '@/canvas-bridge/studio-storyboard';
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: () => null }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => null }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => null }));
afterEach(cleanup);
const make = (id: string, type: CanvasNodeType): CanvasNodeData => ({ id, type, title: id, width: 320, height: 240, position: { x: 0, y: 0 } });
const nodes = [make('商品文案', CanvasNodeType.Text), make('商品参考', CanvasNodeType.Image), make('待生成视频', CanvasNodeType.Video), make('配音', CanvasNodeType.Audio), make('分组', CanvasNodeType.Group)];
const edges: CanvasConnection[] = [{ id: '1', fromNodeId: '商品文案', toNodeId: '商品参考' }, { id: '2', fromNodeId: '商品参考', toNodeId: '待生成视频' }];
const props = () => ({ nodes, connections: edges, onOpenNode: vi.fn(), onFocusNode: vi.fn(), onCreateScript: vi.fn(), onSplitScript: vi.fn(), onBatch: vi.fn(), onShotChange: vi.fn(), modelName: () => undefined });

test('all canvas nodes appear once without shot metadata; drafts, audio and groups are retained', () => {
  const groups = studioStoryboardGroups(nodes);
  expect(groups.flatMap(g => g.nodes)).toHaveLength(nodes.length);
  expect(groups.flatMap(g => g.nodes).every(n => nodes.includes(n))).toBe(true);
  expect(studioStoryboardGroups([]).map(g => g.label)).toEqual(['文本', '图片', '视频']);
  render(<StudioStoryboard {...props()}/>);
  for (const node of nodes) expect(screen.getByRole('article', { name: `故事板节点 ${node.title}` })).toBeDefined();
  expect(screen.queryByRole('button', { name: '加入故事板' })).toBeNull();
});

test('node opening and link navigation use original identities, and canvas updates replace the projection', () => {
  const handlers = props();
  const { rerender } = render(<StudioStoryboard {...handlers}/>);
  const image = screen.getByRole('article', { name: '故事板节点 商品参考' });
  fireEvent.click(within(image).getByRole('button', { name: '打开节点 商品参考' }));
  expect(handlers.onOpenNode).toHaveBeenCalledWith(nodes[1]);
  fireEvent.click(within(image).getByRole('button', { name: '查看引用 商品文案' }));
  expect(handlers.onOpenNode).toHaveBeenCalledWith(nodes[0]);
  expect(handlers.onFocusNode).not.toHaveBeenCalled();
  rerender(<StudioStoryboard {...handlers} nodes={[{ ...nodes[0], title: '修改后的文案', metadata: { content: '新版正文' } }, ...nodes.slice(1)]} connections={[]}/>);
  expect(screen.getByRole('button', { name: '打开节点 修改后的文案' })).toBeDefined();
  expect(screen.queryByText('新版正文')).toBeNull();
  expect(screen.queryByRole('button', { name: '查看引用 商品文案' })).toBeNull();
  expect(studioStoryboardLinks('商品参考', nodes, [...edges, edges[0], { id: 'deleted', fromNodeId: 'gone', toNodeId: '商品参考' }]).incoming).toEqual([nodes[0]]);
});

test('empty types stay visible and expansion can always restore all types', () => {
  render(<StudioStoryboard {...props()} nodes={[nodes[1]]}/>);
  expect(screen.getByText('暂无文本节点')).toBeDefined();
  expect(screen.getByText('暂无视频节点')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '展开图片列表' }));
  expect(screen.queryByRole('region', { name: '文本节点列表' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '恢复全部节点类型' }));
  expect(screen.getByRole('region', { name: '文本节点列表' })).toBeDefined();
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

test('selected detail keeps only its typed list, switches types and follows live node content', () => {
  const handlers=props(), onCloseDetail=vi.fn();
  const {rerender}=render(<StudioStoryboard {...handlers} selectedNodeId="商品参考" composer={<div>原节点创作表单</div>} onCloseDetail={onCloseDetail}/>);
  expect(screen.getByRole('region',{name:'图片节点列表'})).toBeDefined();
  expect(screen.queryByRole('region',{name:'文本节点列表'})).toBeNull();
  expect(screen.getByRole('region',{name:'节点详情 商品参考'})).toBeDefined();
  expect(screen.getByRole('button',{name:'打开节点 商品参考'}).getAttribute('aria-current')).toBe('true');
  fireEvent.change(screen.getByRole('combobox',{name:'节点类型'}),{target:{value:'video'}});
  expect(handlers.onOpenNode).toHaveBeenCalledWith(nodes[2]);
  const updated={...nodes[2],title:'当前视频新标题',metadata:{status:'error' as const,errorDetails:'模型服务暂不可用'}};
  rerender(<StudioStoryboard {...handlers} nodes={[...nodes.slice(0,2),updated,...nodes.slice(3)]} selectedNodeId={updated.id} onCloseDetail={onCloseDetail}/>);
  expect(screen.getByRole('region',{name:'节点详情 当前视频新标题'})).toBeDefined();
  expect(screen.getByRole('region',{name:'视频节点列表'})).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'返回全部节点'}));
  expect(onCloseDetail).toHaveBeenCalledOnce();
  expect(handlers.onFocusNode).not.toHaveBeenCalled();
});
