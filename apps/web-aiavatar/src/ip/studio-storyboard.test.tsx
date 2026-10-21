// @vitest-environment jsdom
import {setupSelectFieldDom,createSelectFieldUser} from '../../../../scripts/vitest/select-field';
setupSelectFieldDom();
const selectFieldValue=createSelectFieldUser({fireEvent,screen});
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { StudioStoryboard } from './studio-storyboard';
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: () => null }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => null }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => null }));
afterEach(cleanup);
const make = (id: string, type: CanvasNodeType): CanvasNodeData => ({ id, type, title: id, width: 320, height: 240, position: { x: 0, y: 0 } });
const nodes = [make('商品文案', CanvasNodeType.Text), make('商品参考', CanvasNodeType.Image), make('待生成视频', CanvasNodeType.Video), make('配音', CanvasNodeType.Audio), make('分组', CanvasNodeType.Group)];
const edges: CanvasConnection[] = [{ id: '1', fromNodeId: '商品文案', toNodeId: '商品参考' }, { id: '2', fromNodeId: '商品参考', toNodeId: '待生成视频' }];
const props = () => ({ nodes, connections: edges, onOpenNode: vi.fn(), onFocusNode: vi.fn(), onCreateScript: vi.fn(), onSplitScript: vi.fn(), onBatch: vi.fn(), onShotChange: vi.fn(), modelName: () => undefined });

test('all canvas nodes appear once without shot metadata; drafts, audio and groups are retained', () => {
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

test('selected detail keeps only its typed list, switches types and follows live node content', async () => {
  const handlers=props(), onCloseDetail=vi.fn();
  const {rerender}=render(<StudioStoryboard {...handlers} selectedNodeId="商品参考" composer={<div>原节点创作表单</div>} onCloseDetail={onCloseDetail}/>);
  expect(screen.getByRole('region',{name:'图片节点列表'})).toBeDefined();
  expect(screen.queryByRole('region',{name:'文本节点列表'})).toBeNull();
  expect(screen.getByRole('region',{name:'节点详情 商品参考'})).toBeDefined();
  expect(screen.getByRole('button',{name:'打开节点 商品参考'}).getAttribute('aria-current')).toBe('true');
  await selectFieldValue(screen.getByRole('combobox',{name:'节点类型'}), 'video');
  expect(handlers.onOpenNode).toHaveBeenCalledWith(nodes[2]);
  const updated={...nodes[2],title:'当前视频新标题',metadata:{status:'error' as const,errorDetails:'模型服务暂不可用'}};
  rerender(<StudioStoryboard {...handlers} nodes={[...nodes.slice(0,2),updated,...nodes.slice(3)]} selectedNodeId={updated.id} onCloseDetail={onCloseDetail}/>);
  expect(screen.getByRole('region',{name:'节点详情 当前视频新标题'})).toBeDefined();
  expect(screen.getByRole('region',{name:'视频节点列表'})).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'返回全部节点'}));
  expect(onCloseDetail).toHaveBeenCalledOnce();
  expect(handlers.onFocusNode).not.toHaveBeenCalled();
});
