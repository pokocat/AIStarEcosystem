// @vitest-environment jsdom
// 抽帧（2026-10-21）：panel choices, the current frame time read from the canvas video, a local placeholder while the frame
// is captured, then an image node linked to the video; a failure removes the placeholder and says why.
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';
import { StudioFlowVideoFrames, type StudioPendingFrame } from './studio-flow-video-frames';

const app = vi.hoisted(() => ({ message: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));
vi.mock('./studio-errors', () => ({ useStudioApp: () => app }));
const fetchAssetBlob = vi.hoisted(() => vi.fn());
vi.mock('@/canvas-bridge/api', () => ({ fetchAssetBlob }));
const uploadImage = vi.hoisted(() => vi.fn());
vi.mock('@/canvas-bridge/image-storage', () => ({ uploadImage }));
const capture = vi.hoisted(() => vi.fn());
vi.mock('@/canvas-bridge/studio-video-frame', async importOriginal => ({ ...(await importOriginal<object>()), captureStudioVideoFrame: capture }));

const source: CanvasNodeData = { id: 'v', type: CanvasNodeType.Video, title: '镜头一', position: { x: 100, y: 50 }, width: 360, height: 678,
  metadata: { status: 'success', content: '/v.mp4', storageKey: 'own/v.mp4', naturalWidth: 720, naturalHeight: 1280 } };
let video: HTMLVideoElement;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  if (!globalThis.CSS?.escape) vi.stubGlobal('CSS', { escape: (s: string) => s });
  const stage = document.createElement('div'); stage.dataset.studioFloatingRoot = '';
  stage.innerHTML = '<div class="react-flow__node" data-id="v"><div class="studio-flow-media"><video></video></div></div>';
  document.body.append(stage);
  video = stage.querySelector('video')!;
  Object.defineProperty(video, 'currentTime', { value: 5.4, writable: true, configurable: true });
});
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function Host({ nodes = [source], onInsert, demo = false, seen }: { nodes?: CanvasNodeData[]; demo?: boolean;
  onInsert: (nodes: CanvasNodeData[], connections: CanvasConnection[]) => Promise<void>; seen?: (p: StudioPendingFrame[]) => void }) {
  const [pending, setPending] = useState<StudioPendingFrame[]>([]);
  seen?.(pending);
  return <><StudioFlowVideoFrames nodes={nodes} pending={pending} onPendingChange={setPending} onInsert={onInsert} demo={demo}/>
    <ul aria-label="占位">{pending.map(p => <li key={p.node.id}>{p.node.title}</li>)}</ul></>;
}

test('opens under the video with 首帧 chosen, shows the current frame time, and hides the action bar meanwhile', async () => {
  const events: unknown[] = []; const listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener('studio-video-frames', listener);
  render(<Host onInsert={vi.fn()}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  const dialog = await screen.findByRole('dialog', { name: '抽帧' });
  expect(dialog.dataset.anchorId).toBe('v');
  expect(screen.getByText('截取一帧画面，生成一张连着这条视频的图片。')).toBeDefined();
  expect((screen.getByRole('radio', { name: '截首帧' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('radio', { name: '截当前帧 00:05' })).toBeDefined();
  expect(screen.getByText('免费，不消耗积分')).toBeDefined();
  // The playhead moves: the label follows.
  act(() => { video.currentTime = 72.2; video.dispatchEvent(new Event('timeupdate')); });
  expect(screen.getByRole('radio', { name: '截当前帧 01:12' })).toBeDefined();
  expect(events.at(-1)).toEqual({ nodeId: 'v' });
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
  expect(screen.queryByRole('dialog', { name: '抽帧' })).toBeNull();
  expect(events.at(-1)).toEqual({ nodeId: undefined });
  window.removeEventListener('studio-video-frames', listener);
});

test('submit shows a local placeholder, then inserts an image node linked to the video with the frame', async () => {
  const clip = new Blob(['x']), frame = new Blob(['f'], { type: 'image/jpeg' });
  fetchAssetBlob.mockResolvedValue(clip); capture.mockResolvedValue(frame);
  let finish!: (v: unknown) => void; uploadImage.mockReturnValue(new Promise(r => { finish = r; }));
  const onInsert = vi.fn().mockResolvedValue(undefined);
  render(<Host onInsert={onInsert}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  fireEvent.click(await screen.findByRole('radio', { name: '截当前帧 00:05' }));
  fireEvent.click(screen.getByRole('button', { name: /提\s*交/ }));
  // The panel closes and the placeholder is on the canvas while the frame is captured and uploaded.
  expect(screen.queryByRole('dialog', { name: '抽帧' })).toBeNull();
  expect(screen.getByRole('list', { name: '占位' }).textContent).toBe('镜头一 · 当前帧 00:05');
  await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(frame));
  expect(fetchAssetBlob).toHaveBeenCalledWith('own/v.mp4');
  expect(capture).toHaveBeenCalledWith(clip, 'current', 5.4);
  await act(async () => { finish({ url: '/f.jpg', storageKey: 'own/f.jpg', width: 720, height: 1280, bytes: 1, mimeType: 'image/jpeg' }); });
  await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1));
  const [[node], [edge]] = onInsert.mock.calls[0];
  expect(node).toMatchObject({ type: 'image', title: '镜头一 · 当前帧 00:05', width: 360, height: 674,
    position: { x: 100 + 360 + 80, y: 50 }, metadata: { storageKey: 'own/f.jpg', content: '/f.jpg', naturalWidth: 720, naturalHeight: 1280, origin: 'derived', status: 'success' } });
  // Not a generation: no task fields, no AI mark.
  expect(node.metadata.studio).toBeUndefined(); expect(node.metadata.runId).toBeUndefined();
  expect(edge).toMatchObject({ fromNodeId: 'v', toNodeId: node.id });
  expect(screen.getByRole('list', { name: '占位' }).textContent).toBe('');
});

test.each([
  ['the clip cannot be read', () => fetchAssetBlob.mockRejectedValue(new Error('HTTP 403')), '无法读取这条视频，请重试'],
  ['the frame cannot be drawn', () => { fetchAssetBlob.mockResolvedValue(new Blob(['x'])); capture.mockRejectedValue(new Error('boom')); }, '没能截出画面，请重试'],
])('when %s the placeholder goes away and the reason is shown', async (_, arrange, reason) => {
  arrange();
  const onInsert = vi.fn();
  render(<Host onInsert={onInsert}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  fireEvent.click(await screen.findByRole('radio', { name: '截尾帧' }));
  fireEvent.click(screen.getByRole('button', { name: /提\s*交/ }));
  expect(screen.getByRole('list', { name: '占位' }).textContent).toBe('镜头一 · 尾帧');
  await waitFor(() => expect(app.message.error).toHaveBeenCalled());
  expect((app.message.error.mock.calls[0][0] as Error).message).toBe(reason);
  expect(screen.getByRole('list', { name: '占位' }).textContent).toBe('');
  expect(onInsert).not.toHaveBeenCalled();
});

test('a video without a file, a generating video and 演示模式 do not capture', async () => {
  const { rerender } = render(<Host nodes={[{ ...source, metadata: { status: 'idle' } }]} onInsert={vi.fn()}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  expect(screen.queryByRole('dialog', { name: '抽帧' })).toBeNull();
  rerender(<Host nodes={[{ ...source, metadata: { ...source.metadata, status: 'loading' } }]} onInsert={vi.fn()}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  expect(screen.queryByRole('dialog', { name: '抽帧' })).toBeNull();
  expect(app.message.info).toHaveBeenCalledWith('视频正在生成，完成后再抽帧');
  rerender(<Host demo onInsert={vi.fn()}/>);
  act(() => dispatchStudioCommand('video-frames', 'v'));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', '演示模式不能抽帧，连上服务后可用。');
  expect(screen.getByRole('button', { name: /提\s*交/ })).toHaveProperty('disabled', true);
});
