import { expect, test, vi } from 'vitest';
import { microphoneError, recordingFile, recordingWav } from './recording-audio';

test('WAV has real RIFF/PCM bytes, correct duration and a mono mix of all channels', async () => {
  const buffer = { length: 3, sampleRate: 16000, numberOfChannels: 2,
    getChannelData: (n: number) => n ? new Float32Array([1, -1, 0]) : new Float32Array([1, 1, -1]) } as AudioBuffer;
  const blob = recordingWav(buffer), bytes = await blob.arrayBuffer(), view = new DataView(bytes);
  expect(blob.type).toBe('audio/wav'); expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
  expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
  expect(view.getUint16(22, true)).toBe(1); expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(40, true)).toBe(6); expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8);
  expect([0, 1, 2].map(i => view.getInt16(44 + i * 2, true))).toEqual([32767, 0, -16384]);
});

test('conversion closes its audio context even when browser decoding fails', async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class { close = close; decodeAudioData = vi.fn().mockRejectedValue(new Error('bad audio')); });
  try { await expect(recordingFile(new Blob(['bad']))).rejects.toThrow('bad audio'); expect(close).toHaveBeenCalledOnce(); }
  finally { vi.unstubAllGlobals(); }
});

test('microphone errors explain how to recover', () => {
  expect(microphoneError(new DOMException('', 'NotAllowedError'))).toContain('允许使用麦克风');
  expect(microphoneError(new DOMException('', 'NotFoundError'))).toContain('没有找到麦克风');
});

test('short samples cannot be passed off as voice-cloning recordings', async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class {
    close = close;
    decodeAudioData = vi.fn().mockResolvedValue({ length: 24000 * 9, sampleRate: 24000, numberOfChannels: 1 });
  });
  try { await expect(recordingFile(new Blob(['audio']))).rejects.toThrow('不足 10 秒'); expect(close).toHaveBeenCalledOnce(); }
  finally { vi.unstubAllGlobals(); }
});

test('late recording chunks are cropped to exactly 14.9 seconds in PCM WAV', async () => {
  const sampleRate = 24000;
  const buffer = { length: sampleRate * 16, sampleRate, numberOfChannels: 1, getChannelData: () => new Float32Array(sampleRate * 16) } as AudioBuffer;
  expect(recordingWav(buffer).size).toBe(44 + 14.9 * sampleRate * 2);
});

test('unsupported real-time sample rates fall back to the device rate and are resampled for WAV', async () => {
  const native = { length: 48000 * 11, sampleRate: 48000, numberOfChannels: 1 };
  const normalized = { length: 24000 * 11, sampleRate: 24000, numberOfChannels: 1, getChannelData: () => new Float32Array(24000 * 11) };
  const close = vi.fn().mockResolvedValue(undefined), connect = vi.fn(), start = vi.fn();
  const source = { buffer: null, connect, start };
  const construct = vi.fn();
  vi.stubGlobal('AudioContext', class {
    constructor(options?: AudioContextOptions) { construct(options); if (options) throw new DOMException('', 'NotSupportedError'); }
    close = close; decodeAudioData = vi.fn().mockResolvedValue(native);
  });
  const offline = vi.fn();
  vi.stubGlobal('OfflineAudioContext', class {
    constructor(...args: unknown[]) { offline(...args); }
    destination = {}; createBufferSource = () => source; startRendering = vi.fn().mockResolvedValue(normalized);
  });
  try {
    const file = await recordingFile(new Blob(['audio']));
    expect(construct.mock.calls).toEqual([[{ sampleRate: 24000 }], [undefined]]);
    expect(offline).toHaveBeenCalledWith(1, 24000 * 11, 24000);
    expect(source.buffer).toBe(native); expect(connect).toHaveBeenCalledOnce(); expect(start).toHaveBeenCalledOnce();
    const bytes = await file.arrayBuffer();
    expect(new DataView(bytes).getUint32(24, true)).toBe(24000); expect(file.size).toBe(44 + 24000 * 11 * 2);
    expect(close).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});

test('failure during fallback resampling still closes the real-time audio context', async () => {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class { close = close; decodeAudioData = vi.fn().mockResolvedValue({ length: 48000 * 11, sampleRate: 48000, numberOfChannels: 1 }); });
  vi.stubGlobal('OfflineAudioContext', class { constructor() { throw new Error('resampling failed'); } });
  try { await expect(recordingFile(new Blob(['audio']))).rejects.toThrow('resampling failed'); expect(close).toHaveBeenCalledOnce(); }
  finally { vi.unstubAllGlobals(); }
});
