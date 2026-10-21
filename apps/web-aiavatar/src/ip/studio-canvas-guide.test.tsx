// @vitest-environment jsdom
// docs/ip-studio-new-canvas-and-threads.md §2.3: the empty-canvas guide, its copy, when it shows, and that its entries run the
// same additions as the rail's 「＋添加」 (the canvas handles add-text / add-image / add-video / upload).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useImperativeHandle } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { StudioCanvasGuide, studioCanvasGuideVisible } from './studio-canvas-guide';
import StudioFlowCanvas from './studio-flow-canvas';

const api = vi.hoisted(() => ({ upload: vi.fn(), save: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioMedia: vi.fn(), importStudioStory: vi.fn() }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: api.save }));
vi.mock('./studio-errors', () => ({ useStudioApp: () => ({ message: { error: api.error, success: api.success, info: api.info } }), StudioErrorNotice: () => null }));
vi.mock('@/proto/api', () => ({ useIdentity: () => ({}) }));
vi.mock('@/shell/wallet-badge', () => ({ WalletBadge: () => null }));
vi.mock('@/canvas-bridge/host-actions', () => ({ HostActionsSlot: () => null }));
vi.mock('@/canvas-bridge/template-projection', () => ({ useTemplateProjection: () => {} }));
vi.mock('@/canvas-bridge/flow-legacy-tasks', () => ({ useFlowLegacyTasks: () => {} }));
vi.mock('./studio-flow-image-tools', () => ({ StudioFlowImageTools: () => null }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: () => null }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => null }));
// The real picker hides a file input; the guide only needs to reach the same `upload()` the rail calls.
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: ({ actions }: any) => { useImperativeHandle(actions, () => ({ upload: api.upload, library: vi.fn() })); return null; } }));
// The workspace overlay is where the guide lives; a stand-in mounts the real guide under the same rule the workspace uses.
vi.mock('./studio-workspace', async () => {
  const guide = await import('./studio-canvas-guide');
  return { StudioWorkspace: ({ nodes, textEditingNodeId }: any) => <>
    {guide.studioCanvasGuideVisible({ nodeCount: nodes.length, mode: 'canvas', panelOpen: !!textEditingNodeId }) && <guide.StudioCanvasGuide assistantOpen onStartAssistant={() => {}}/>}
    <output aria-label="正在编辑的文字节点">{textEditingNodeId || ''}</output>
  </> };
});
vi.mock('@xyflow/react', () => {
  const viewport = { x: 0, y: 0, zoom: 1 }, flow = { viewportInitialized: true, fitView: vi.fn(), screenToFlowPosition: (p: any) => p, getInternalNode: (id: string) => ({ id }) };
  return { ReactFlowProvider: ({ children }: any) => children, ReactFlow: ({ nodes }: any) => <div>{nodes.map((n: any) => <article key={n.id} aria-label={`节点 ${n.data.document.title}`}/>)}</div>,
    useReactFlow: () => flow, useViewport: () => viewport, Background: () => null, MiniMap: () => null, Handle: () => null, NodeResizer: () => null, BaseEdge: () => null, EdgeLabelRenderer: () => null,
    getBezierPath: () => ['', 0, 0], Position: { Right: 'right', Left: 'left' }, SelectionMode: { Partial: 'partial' }, BackgroundVariant: { Dots: 'dots' } };
});

const commands: { action: string; nodeId?: string }[] = [];
const record = (e: Event) => commands.push((e as CustomEvent).detail);
beforeEach(() => {
  vi.clearAllMocks(); commands.length = 0; api.save.mockResolvedValue('saved');
  window.addEventListener('studio-command', record);
  useCanvasStore.setState({ projects: [{ id: 'p', title: '空白画布 · 新画布', nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } } as any] });
});
afterEach(() => { window.removeEventListener('studio-command', record); cleanup(); });
const nodes = () => useCanvasStore.getState().projects[0].nodes;

describe('when the guide shows', () => {
  test('only on an empty canvas, in the canvas view, with no creation panel open', () => {
    expect(studioCanvasGuideVisible({ nodeCount: 0, mode: 'canvas', panelOpen: false })).toBe(true);
    expect(studioCanvasGuideVisible({ nodeCount: 1, mode: 'canvas', panelOpen: false })).toBe(false);
    expect(studioCanvasGuideVisible({ nodeCount: 0, mode: 'storyboard', panelOpen: false })).toBe(false);
    expect(studioCanvasGuideVisible({ nodeCount: 0, mode: 'work', panelOpen: false })).toBe(false);
    expect(studioCanvasGuideVisible({ nodeCount: 0, mode: 'canvas', panelOpen: true })).toBe(false);
  });
  test('the workspace hides it for every creation panel it owns and no longer keeps the old empty state', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'src/ip/studio-workspace.tsx'), 'utf8');
    const call = workspace.slice(workspace.indexOf('studioCanvasGuideVisible({'), workspace.indexOf('<StudioCanvasGuide '));
    for (const open of ['director', 'speechOpen', 'lipSyncOpen', 'recreationOpen', 'templateLibraryOpen', 'assetPicker', 'batchOpen', 'taskList', 'libraryQuery!==undefined']) expect(call).toContain(open);
    expect(call).toContain('nodeCount:nodes.length,mode,');
    expect(workspace).not.toContain('画布还是空的');
  });
});

describe('the card', () => {
  test('says what the canvas is for and offers the five ways in; with the assistant open there is no extra button', () => {
    render(<StudioCanvasGuide assistantOpen onStartAssistant={vi.fn()}/>);
    expect(screen.getByRole('heading', { name: '这张画布还是空的' })).toBeTruthy();
    expect(screen.getByText('在助手里说想做什么，它会把每一步放进画布。也可以自己选一个开始：')).toBeTruthy();
    const expected = [['文字', '写设定、剧本或提示词'], ['图片生成', '写一句描述出图，可以加参考图'], ['视频生成', '用描述或一张首帧出视频'], ['配音', '选一个声音，把台词念出来'], ['上传素材', '图片、视频或文档']];
    for (const [name, hint] of expected) expect(screen.getByRole('button', { name, description: hint })).toBeTruthy();
    expect(screen.getByText(/双击画布空白处也能添加/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '和助手开始' })).toBeNull();
  });
  test('with the assistant closed, 「和助手开始」 opens it', () => {
    const start = vi.fn();
    render(<StudioCanvasGuide assistantOpen={false} onStartAssistant={start}/>);
    fireEvent.click(screen.getByRole('button', { name: '和助手开始' }));
    expect(start).toHaveBeenCalledOnce();
    expect(commands).toEqual([]);
  });
  test('each entry and 「从模板开始」 sends the rail\'s own command', () => {
    render(<StudioCanvasGuide assistantOpen onStartAssistant={vi.fn()}/>);
    for (const name of ['文字', '图片生成', '视频生成', '配音', '上传素材', '从模板开始']) fireEvent.click(screen.getByRole('button', { name }));
    expect(commands.map(c => c.action)).toEqual(['add-text', 'add-image', 'add-video', 'speech', 'upload', 'templates']);
  });
});

describe('on the canvas', () => {
  test('「图片生成」 places an image node like the rail and opens its generation panel; the guide then goes away', async () => {
    render(<StudioFlowCanvas projectId="p"/>);
    fireEvent.click(screen.getByRole('button', { name: '图片生成' }));
    await waitFor(() => expect(nodes()).toHaveLength(1));
    expect(nodes()[0]).toMatchObject({ type: 'image', title: '图片' });
    await waitFor(() => expect(commands).toContainEqual({ action: 'image', nodeId: nodes()[0].id }));
    expect(screen.queryByRole('heading', { name: '这张画布还是空的' })).toBeNull();
  });
  test('「视频生成」 places a video node and opens its generation panel', async () => {
    render(<StudioFlowCanvas projectId="p"/>);
    fireEvent.click(screen.getByRole('button', { name: '视频生成' }));
    await waitFor(() => expect(nodes()).toHaveLength(1));
    expect(nodes()[0]).toMatchObject({ type: 'video', title: '视频' });
    await waitFor(() => expect(commands).toContainEqual({ action: 'video', nodeId: nodes()[0].id }));
  });
  test('「文字」 places a text node and starts editing it', async () => {
    render(<StudioFlowCanvas projectId="p"/>);
    fireEvent.click(screen.getByRole('button', { name: '文字' }));
    await waitFor(() => expect(nodes()).toHaveLength(1));
    expect(nodes()[0]).toMatchObject({ type: 'text', title: '文字', metadata: { content: '' } });
    expect(screen.getByRole('status', { name: '正在编辑的文字节点' }).textContent).toBe(nodes()[0].id);
  });
  test('「上传素材」 opens the same file picker as the rail and adds nothing by itself', () => {
    render(<StudioFlowCanvas projectId="p"/>);
    fireEvent.click(screen.getByRole('button', { name: '上传素材' }));
    expect(api.upload).toHaveBeenCalledOnce();
    expect(nodes()).toHaveLength(0);
  });
});
