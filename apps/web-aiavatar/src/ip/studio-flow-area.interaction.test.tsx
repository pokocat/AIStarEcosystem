// @vitest-environment jsdom
// 圈选分组（2026-10-25）：选「圈选分组」，在画布上按住拖出一块区域 → 圈住的节点收进去、名字输入框直接打开；
// 太小的拖动不建区域；Esc 退出工具；拖节点进出区域会加入 / 离开。React Flow 换成最小替身，事件按真实路径走。
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import StudioFlowCanvas from './studio-flow-canvas';

vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioMedia: vi.fn(), importStudioStory: vi.fn() }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: vi.fn().mockResolvedValue('saved') }));
vi.mock('./studio-errors', () => ({ useStudioApp: () => ({ message: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }), useStudioErrorState: () => useState(''), StudioErrorNotice: () => null, studioNodeError: () => undefined }));
vi.mock('./studio-script-rich-editor', () => ({ StudioScriptRichEditor: () => null }));
vi.mock('@/proto/api', () => ({ useIdentity: () => ({}) }));
vi.mock('@/shell/wallet-badge', () => ({ WalletBadge: () => null }));
vi.mock('@/canvas-bridge/host-actions', () => ({ HostActionsSlot: () => null }));
vi.mock('@/canvas-bridge/template-projection', () => ({ useTemplateProjection: () => {} }));
vi.mock('@/canvas-bridge/flow-legacy-tasks', () => ({ useFlowLegacyTasks: () => {} }));
vi.mock('./studio-flow-image-tools', () => ({ StudioFlowImageTools: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: () => null }));
vi.mock('./studio-workspace', () => ({ StudioWorkspace: () => null }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: ({ storageKey, ...props }: any) => <img alt="" {...props}/> }));
const flowProps: { current: any } = { current: undefined };
vi.mock('@xyflow/react', () => {
  const viewport = { x: 0, y: 0, zoom: 1 }, flow = { viewportInitialized: true, fitView: vi.fn(), screenToFlowPosition: (p: any) => p, getInternalNode: (id: string) => ({ id }), deleteElements: vi.fn() };
  return { ReactFlowProvider: ({ children }: any) => children,
    ReactFlow: (props: any) => { flowProps.current = props; return <div className="react-flow" data-testid="flow">{props.nodes.map((n: any) => { const Card = props.nodeTypes[n.type];
      return <div key={n.id} data-testid={`node-${n.id}`} onClick={e => props.onNodeClick?.(e, n)} onDoubleClick={e => props.onNodeDoubleClick?.(e, n)}><Card id={n.id} data={n.data} selected={!!n.selected}/></div>; })}</div>; },
    useReactFlow: () => flow, useViewport: () => viewport, Background: () => null, MiniMap: () => null, Handle: () => null, NodeResizer: () => null, BaseEdge: () => null, EdgeLabelRenderer: () => null,
    getBezierPath: () => ['', 0, 0], Position: { Right: 'right', Left: 'left' }, SelectionMode: { Partial: 'partial' }, BackgroundVariant: { Dots: 'dots' } };
});

const card = (id: string, x: number, y: number): CanvasNodeData => ({ id, type: CanvasNodeType.Image, title: id, position: { x, y }, width: 200, height: 150, metadata: { status: 'idle' } });
const nodes = () => useCanvasStore.getState().projects[0].nodes;
const areas = () => nodes().filter(n => n.type === CanvasNodeType.Group);
const drag = (from: [number, number], to: [number, number]) => {
  const flow = screen.getByTestId('flow');
  fireEvent.pointerDown(flow, { pointerId: 1, button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(flow, { pointerId: 1, clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2 });
  fireEvent.pointerMove(flow, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(flow, { pointerId: 1, clientX: to[0], clientY: to[1] });
};
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  if (typeof globalThis.CSS?.escape !== 'function') vi.stubGlobal('CSS', { escape: (value: string) => value });
  HTMLElement.prototype.setPointerCapture = () => {};
  useCanvasStore.setState({ projects: [{ id: 'p', title: '画布', nodes: [card('a', 100, 100), card('b', 360, 100), card('far', 1200, 100)], connections: [], viewport: { x: 0, y: 0, k: 1 } } as any] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('drawing an area takes in the circled nodes, opens its name, and hands the tool back', () => {
  const { container } = render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByRole('button', { name: '圈选分组' }));
  expect(screen.getByRole('button', { name: '圈选分组' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('status').textContent).toContain('按住拖动，圈出一块区域');
  // While dragging, React Flow neither pans, box-selects nor drags nodes.
  expect(flowProps.current).toMatchObject({ panOnDrag: false, selectionOnDrag: false, nodesDraggable: false });

  const flow = screen.getByTestId('flow');
  fireEvent.pointerDown(flow, { pointerId: 1, button: 0, clientX: 80, clientY: 60 });
  fireEvent.pointerMove(flow, { pointerId: 1, clientX: 620, clientY: 320 });
  expect(container.querySelector('.studio-flow-area-draft')?.textContent).toBe('收进 2 个节点');
  expect(screen.getByTestId('node-a').querySelector('article')!.classList.contains('is-area-candidate')).toBe(true);
  expect(screen.getByTestId('node-far').querySelector('article')!.classList.contains('is-area-candidate')).toBe(false);
  fireEvent.pointerUp(flow, { pointerId: 1, clientX: 620, clientY: 320 });

  expect(areas()).toHaveLength(1);
  const area = areas()[0];
  expect(nodes().filter(n => n.metadata?.groupId === area.id).map(n => n.id)).toEqual(['a', 'b']);
  expect(container.querySelector('.studio-flow-area-draft')).toBeNull();
  expect(screen.getByRole('button', { name: '圈选分组' }).getAttribute('aria-pressed')).toBe('false');

  // The name is ready to type over.
  const name = screen.getByRole('textbox', { name: '分组名称' }) as HTMLInputElement;
  expect(document.activeElement).toBe(name);
  expect(name.value).toBe('分组 1');
  fireEvent.change(name, { target: { value: '第一集素材' } });
  fireEvent.keyDown(name, { key: 'Enter' });
  expect(areas()[0].title).toBe('第一集素材');
  expect(screen.queryByRole('textbox', { name: '分组名称' })).toBeNull();
  expect(screen.getByLabelText('2 个节点')).toBeTruthy();
});

test('a tiny drag makes nothing, and Esc leaves the tool', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByRole('button', { name: '圈选分组' }));
  drag([100, 100], [120, 112]);
  expect(areas()).toHaveLength(0);
  fireEvent.keyDown(document.body, { key: 'g' });
  expect(screen.getByRole('button', { name: '圈选分组' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(screen.getByRole('button', { name: '圈选分组' }).getAttribute('aria-pressed')).toBe('false');
  expect(flowProps.current.panOnDrag).toBe(true);
});

test('Esc or G in the middle of a drag cancels it: letting go afterwards makes nothing', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  const flow = screen.getByTestId('flow');
  for (const key of ['Escape', 'g']) {
    if (screen.getByRole('button', { name: '圈选分组' }).getAttribute('aria-pressed') !== 'true') fireEvent.click(screen.getByRole('button', { name: '圈选分组' }));
    fireEvent.pointerDown(flow, { pointerId: 1, button: 0, clientX: 80, clientY: 60 });
    fireEvent.pointerMove(flow, { pointerId: 1, clientX: 620, clientY: 320 });
    fireEvent.keyDown(document.body, { key });
    fireEvent.pointerMove(flow, { pointerId: 1, clientX: 640, clientY: 340 });
    fireEvent.pointerUp(flow, { pointerId: 1, clientX: 640, clientY: 340 });
    expect(areas()).toHaveLength(0);
  }
});

test('an empty area can be drawn; dragging a node into it joins, dragging it out leaves', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByRole('button', { name: '圈选分组' }));
  drag([600, 400], [1000, 800]);
  const area = areas()[0];
  expect(nodes().some(n => n.metadata?.groupId === area.id)).toBe(false);
  fireEvent.keyDown(screen.getByRole('textbox', { name: '分组名称' }), { key: 'Escape' });
  expect(areas()[0].title).toBe('分组 1');

  const moveFar = (x: number, y: number) => act(() => {
    useCanvasStore.getState().updateProject('p', { nodes: nodes().map(n => n.id === 'far' ? { ...n, position: { x, y } } : n) });
    flowProps.current.onNodeDragStop({}, { id: 'far' }, [{ id: 'far' }]);
  });
  moveFar(700, 500);
  expect(nodes().find(n => n.id === 'far')?.metadata?.groupId).toBe(area.id);
  expect(screen.getByLabelText('1 个节点')).toBeTruthy();
  moveFar(1600, 100);
  expect(nodes().find(n => n.id === 'far')?.metadata?.groupId).toBeUndefined();
  expect(areas()).toHaveLength(1);
});

test('clicking an area label selects it; double clicking it renames in place', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByRole('button', { name: '圈选分组' }));
  drag([80, 60], [620, 320]);
  fireEvent.keyDown(screen.getByRole('textbox', { name: '分组名称' }), { key: 'Escape' });
  const id = areas()[0].id;
  fireEvent.click(screen.getByTestId(`node-${id}`).querySelector('.studio-flow-area-label')!);
  expect(screen.getByTestId(`node-${id}`).querySelector('article')!.classList.contains('is-selected')).toBe(true);
  fireEvent.doubleClick(screen.getByTestId(`node-${id}`).querySelector('.studio-flow-area-count')!);
  expect(screen.getByRole('textbox', { name: '分组名称' })).toBeTruthy();
});
