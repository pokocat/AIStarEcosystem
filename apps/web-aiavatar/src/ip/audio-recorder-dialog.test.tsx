// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AudioRecorderDialog } from './audio-recorder-dialog';

const api = vi.hoisted(() => ({ convert: vi.fn() }));
vi.mock('@/canvas-bridge/recording-audio', async importOriginal => ({ ...await importOriginal<object>(), recordingFile: api.convert }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return { useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: any) => set(v?.message || String(v || '')), [])]; }, StudioErrorNotice: ({ error }: any) => <span role="alert">{error}</span> };
});
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, ...p }: any) => <button disabled={loading || p.disabled} {...p}>{p.children}</button>,
  Input: (p: any) => <input {...p}/>,
  Modal: ({ children, title }: any) => <div role="dialog" aria-label={title}>{children}</div>,
}));

let rec: FakeRecorder;
class FakeRecorder {
  static isTypeSupported = () => true;
  state = 'inactive'; mimeType = 'audio/webm';
  ondataavailable?: (e: { data: Blob }) => void; onstop?: () => void; onerror?: () => void;
  constructor() { rec = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio']) }); this.onstop?.(); }
}
let getUserMedia: ReturnType<typeof vi.fn>, stopTrack: ReturnType<typeof vi.fn>;
beforeEach(() => {
  stopTrack = vi.fn(); getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal('MediaRecorder', FakeRecorder); vi.stubGlobal('AudioContext', class {});
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:recording'), revokeObjectURL: vi.fn() });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  api.convert.mockResolvedValue(new File(['wav'], '录音.wav', { type: 'audio/wav' }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function beginRecording() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始录音' })); });
  expect(screen.getByLabelText('倒数 3')).toBeDefined();
  expect(rec.state).toBe('inactive');
  await act(async () => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('button', { name: '结束录音' })).toBeDefined();
}
async function record() {
  await beginRecording();
  await act(async () => { vi.advanceTimersByTime(12000); });
  fireEvent.click(screen.getByRole('button', { name: '结束录音' }));
  await screen.findByRole('button', { name: '保存到资产库' });
}

test('stops the microphone before preview; saving is explicit and failures retain the recording', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('网络断开')).mockResolvedValue(undefined), close = vi.fn();
  render(<AudioRecorderDialog open onSave={save} onClose={close}/>);
  await record();
  expect(stopTrack).toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('试听录音').getAttribute('src')).toBe('blob:recording');
  fireEvent.change(screen.getByLabelText('录音名称'), { target: { value: '我的旁白' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存到资产库' })); });
  await screen.findByText('网络断开'); expect(close).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '保存到资产库' })); });
  expect(close).toHaveBeenCalledOnce();
  expect(save.mock.calls[1][0]).toMatchObject({ name: '我的旁白.wav', type: 'audio/wav' });
});

test('closing during recording stops tracks without converting or uploading', async () => {
  const save = vi.fn(); const ui = render(<AudioRecorderDialog open onSave={save} onClose={vi.fn()}/>);
  await beginRecording();
  ui.rerender(<AudioRecorderDialog open={false} onSave={save} onClose={vi.fn()}/>);
  expect(rec.state).toBe('inactive'); expect(stopTrack).toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(api.convert).not.toHaveBeenCalled();
});

test('late permission after closing never starts recording and releases the stream', async () => {
  let grant!: (v: unknown) => void; getUserMedia.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
  const ui = render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: '开始录音' })); ui.unmount();
  grant({ getTracks: () => [{ stop: stopTrack }] });
  await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce()); expect(api.convert).not.toHaveBeenCalled();
});

test('permission rejection leaves a retry and a clear error', async () => {
  getUserMedia.mockRejectedValue(new DOMException('', 'NotAllowedError'));
  render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: '开始录音' }));
  await screen.findByText(/麦克风权限未开启/); expect(screen.getByRole('button', { name: '开始录音' })).toBeDefined();
});

test('re-recording releases the old preview; unmount releases the new microphone', async () => {
  const ui = render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  await record();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重录' })); });
  await act(async () => { vi.advanceTimersByTime(3000); });
  expect(screen.getByRole('button', { name: '结束录音' })).toBeDefined(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording');
  ui.unmount(); expect(stopTrack).toHaveBeenCalledTimes(2);
});

test('capture stops at 14.9 seconds, excluding countdown, without uploading automatically', async () => {
  const save = vi.fn(); render(<AudioRecorderDialog open onSave={save} onClose={vi.fn()}/>);
  await beginRecording();
  await act(async () => { vi.advanceTimersByTime(14800); });
  expect(rec.state).toBe('recording');
  await act(async () => { vi.advanceTimersByTime(100); });
  expect(screen.getByRole('button', { name: '保存到资产库' })).toBeDefined();
  expect(rec.state).toBe('inactive'); expect(stopTrack).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '保存到资产库' })).toBeDefined(); expect(save).not.toHaveBeenCalled();
});

test('finishing is disabled until 10.5 seconds and shows the remaining time', async () => {
  render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  await beginRecording();
  await act(async () => { vi.advanceTimersByTime(8000); });
  const stop = screen.getByRole('button', { name: '结束录音' }) as HTMLButtonElement;
  expect(stop.disabled).toBe(true); expect(screen.getByText('还需朗读 3 秒')).toBeDefined();
  fireEvent.click(stop); expect(rec.state).toBe('recording'); expect(api.convert).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(2400); }); expect(stop.disabled).toBe(true);
  await act(async () => { vi.advanceTimersByTime(100); }); expect(stop.disabled).toBe(false);
  fireEvent.click(stop); await screen.findByRole('button', { name: '保存到资产库' });
});

test('a custom name survives re-recording while an untouched default is refreshed', async () => {
  api.convert.mockResolvedValueOnce(new File(['wav'], '录音-第一遍.wav')).mockResolvedValueOnce(new File(['wav'], '录音-第二遍.wav')).mockResolvedValue(new File(['wav'], '录音-第三遍.wav'));
  render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  await record();
  expect((screen.getByLabelText('录音名称') as HTMLInputElement).value).toBe('录音-第一遍');
  const retake = async () => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重录' })); });
    await act(async () => { vi.advanceTimersByTime(15000); });
    fireEvent.click(screen.getByRole('button', { name: '结束录音' }));
    await screen.findByRole('button', { name: '保存到资产库' });
  };
  await retake(); expect((screen.getByLabelText('录音名称') as HTMLInputElement).value).toBe('录音-第二遍');
  fireEvent.change(screen.getByLabelText('录音名称'), { target: { value: '我的专属旁白' } });
  await retake(); expect((screen.getByLabelText('录音名称') as HTMLInputElement).value).toBe('我的专属旁白');
});

test('the guide advances character by character and the pace stays fixed during capture', async () => {
  render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: '稍慢' }));
  await beginRecording();
  await act(async () => { vi.advanceTimersByTime(4000); });
  const script = screen.getByLabelText('朗读示例');
  expect(script.querySelectorAll('.is-read').length).toBeGreaterThan(0);
  expect(script.querySelectorAll('.is-current')).toHaveLength(1);
  expect((screen.getByRole('button', { name: '稍慢' }) as HTMLButtonElement).disabled).toBe(true);
});

test('cancelling during countdown releases the mic without ever recording', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  const ui = render(<AudioRecorderDialog open onSave={vi.fn()} onClose={vi.fn()}/>);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始录音' })); });
  expect(screen.getByLabelText('倒数 3')).toBeDefined();
  ui.unmount();
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(rec.state).toBe('inactive'); expect(stopTrack).toHaveBeenCalled(); expect(api.convert).not.toHaveBeenCalled();
});
