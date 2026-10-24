// @vitest-environment jsdom
// 单击节点（2026-10-23）：a fitted video fills its whole card, so a click on the <video> / <audio> itself must open the node's
// panel as well as play. Real controls on the card keep their own click; shift / cmd, and picking a reference, are unchanged.
// The React Flow stand-in calls `onNodeClick` from a wrapper the way @xyflow/react's NodeWrapper does (click bubbles up).
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import StudioFlowCanvas from './studio-flow-canvas';

vi.mock('@/canvas-bridge/studio-api', () => ({ importStudioMedia: vi.fn(), importStudioStory: vi.fn() }));
vi.mock('@/canvas-bridge/studio-save', () => ({ saveStudioDocument: vi.fn().mockResolvedValue('saved') }));
vi.mock('./studio-errors', () => ({ useStudioApp: () => ({ message: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }), useStudioErrorState: () => useState(''), StudioErrorNotice: ({ error }: any) => <p role="alert">{String(error)}</p>, studioNodeError: () => undefined }));
vi.mock('./studio-script-rich-editor', () => ({ StudioScriptRichEditor: () => null }));
vi.mock('./studio-node-title', () => ({ StudioNodeTitle: ({ title }: any) => <span>{title}</span> }));
vi.mock('@/proto/api', () => ({ useIdentity: () => ({}) }));
vi.mock('@/shell/wallet-badge', () => ({ WalletBadge: () => null }));
vi.mock('@/canvas-bridge/host-actions', () => ({ HostActionsSlot: () => null }));
vi.mock('@/canvas-bridge/template-projection', () => ({ useTemplateProjection: () => {} }));
vi.mock('@/canvas-bridge/flow-legacy-tasks', () => ({ useFlowLegacyTasks: () => {} }));
vi.mock('./studio-flow-image-tools', () => ({ StudioFlowImageTools: () => null }));
vi.mock('./studio-attachment-picker', () => ({ StudioAttachmentPicker: () => null }));
vi.mock('./studio-workspace', () => ({ StudioWorkspace: () => null }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: ({ storageKey, ...props }: any) => <img alt="" {...props}/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: ({ storageKey, ...props }: any) => <video data-testid="clip" {...props}/> }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: ({ storageKey, ...props }: any) => <audio data-testid="voice" {...props}/> }));
vi.mock('@xyflow/react', () => {
  const viewport = { x: 0, y: 0, zoom: 1 }, flow = { viewportInitialized: true, fitView: vi.fn(), screenToFlowPosition: (p: any) => p, getInternalNode: (id: string) => ({ id }), deleteElements: vi.fn() };
  return { ReactFlowProvider: ({ children }: any) => children,
    ReactFlow: ({ nodes, nodeTypes, onNodeClick }: any) => <div>{nodes.map((n: any) => { const Card = nodeTypes[n.type];
      return <div key={n.id} data-testid={`node-${n.id}`} onClick={e => onNodeClick?.(e, n)}><Card id={n.id} data={n.data} selected={false}/></div>; })}</div>,
    useReactFlow: () => flow, useViewport: () => viewport, Background: () => null, MiniMap: () => null, Handle: () => null, NodeResizer: () => null, BaseEdge: () => null, EdgeLabelRenderer: () => null,
    getBezierPath: () => ['', 0, 0], Position: { Right: 'right', Left: 'left' }, SelectionMode: { Partial: 'partial' }, BackgroundVariant: { Dots: 'dots' } };
});

const commands: { action: string; nodeId?: string }[] = [], picked: string[] = [];
const record = (e: Event) => commands.push((e as CustomEvent).detail);
const pick = (e: Event) => picked.push((e as CustomEvent).detail.nodeId);
const video: CanvasNodeData = { id: 'v', type: CanvasNodeType.Video, title: '镜头', position: { x: 0, y: 0 }, width: 320, height: Math.round(320 * 9 / 16 + 38),
  metadata: { status: 'success', content: '/v.mp4', storageKey: 'k/v.mp4', naturalWidth: 1920, naturalHeight: 1080 } };
const audio: CanvasNodeData = { id: 'a', type: CanvasNodeType.Audio, title: '配音', position: { x: 400, y: 0 }, width: 320, height: 160,
  metadata: { status: 'success', content: '/a.wav', storageKey: 'k/a.wav' } };
beforeEach(() => {
  commands.length = 0; picked.length = 0;
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  if (typeof globalThis.CSS?.escape !== 'function') vi.stubGlobal('CSS', { escape: (value: string) => value });
  window.addEventListener('studio-command', record);
  window.addEventListener('studio-reference-selected', pick);
  useCanvasStore.setState({ projects: [{ id: 'p', title: '画布', nodes: [video, audio], connections: [], viewport: { x: 0, y: 0, k: 1 } } as any] });
});
afterEach(() => { window.removeEventListener('studio-command', record); window.removeEventListener('studio-reference-selected', pick); cleanup(); vi.unstubAllGlobals(); });

test('clicking the <video> of a fitted video node plays as usual and opens its panel', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  expect(screen.getByTestId('node-v').querySelector('article')!.classList.contains('is-fitted')).toBe(true);
  // Not cancelled: the element keeps its own play / pause.
  expect(fireEvent.click(screen.getByTestId('clip'))).toBe(true);
  expect(commands).toEqual([{ action: 'video', nodeId: 'v' }]);
});

test('opening the panel writes its draft into the node without rebuilding the <video> (playback is not reset)', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  const before = screen.getByTestId('clip');
  fireEvent.click(before);
  // What the workspace does on 「video」: it keeps the composer draft on the node.
  act(() => useCanvasStore.getState().updateProject('p', { nodes: [{ ...video, metadata: { ...video.metadata, studio: { kind: 'shot', composerDraft: { operation: 'video', prompt: '慢慢推近' } as any } } }, audio] }));
  expect(screen.getByTestId('clip')).toBe(before);
});

test('clicking the <audio> of an audio node opens its voice panel', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  expect(fireEvent.click(screen.getByTestId('voice'))).toBe(true);
  expect(commands).toEqual([{ action: 'speech', nodeId: 'a' }]);
});

test('a button on the card keeps its own click and does not open the panel', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByRole('button', { name: /替换视频/ }));
  expect(commands).toEqual([{ action: 'upload-video', nodeId: 'v' }]);
});

test('shift / cmd / ctrl click on the video selects only and opens nothing', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  fireEvent.click(screen.getByTestId('clip'), { shiftKey: true });
  fireEvent.click(screen.getByTestId('clip'), { metaKey: true });
  fireEvent.click(screen.getByTestId('voice'), { ctrlKey: true });
  expect(commands).toEqual([]);
});

test('while picking a reference, clicking the video picks it as the reference instead of opening its panel', () => {
  render(<StudioFlowCanvas projectId="p"/>);
  act(() => { window.dispatchEvent(new CustomEvent('studio-reference-mode', { detail: { active: true, originId: 'a' } })); });
  fireEvent.click(screen.getByTestId('clip'));
  expect(picked).toEqual(['v']);
  expect(commands).toEqual([]);
});
