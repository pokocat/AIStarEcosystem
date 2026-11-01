/** Browser recordings use WebM/MP4 (as in proto/screen-more.tsx).
 * Library imports accept WAV/MP3/M4A, so send real PCM WAV bytes, never a renamed WebM. */
// Product choice: overlap of short voice-clone samples (10–20s) and our video reference limit (15s).
// https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide
// https://platform.minimax.cn/docs/api-reference/voice-cloning-clone
export const RECORDING_MIN_SECONDS = 10;
export const RECORDING_MAX_SECONDS = 15;
export const RECORDING_SAMPLE_RATE = 24000;

export function recordingWav(buffer: AudioBuffer): Blob {
  const frames = Math.min(buffer.length, buffer.sampleRate * RECORDING_MAX_SECONDS);
  const data = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(data);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, frames * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < frames; i++) {
    const value = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return new Blob([data], { type: 'audio/wav' });
}

export async function recordingFile(blob: Blob): Promise<File> {
  const context = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (!buffer.length || !buffer.numberOfChannels) throw new Error('没有录到声音，请重新录制。');
    if (buffer.length / buffer.sampleRate < RECORDING_MIN_SECONDS) throw new Error('录音不足 10 秒，请跟着文字完整读一遍再保存。');
    const wav = recordingWav(buffer);
    if (wav.size > 25 * 1024 * 1024) throw new Error('录音超过 25 MB，请缩短后重录。');
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return new File([wav], `录音-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.wav`, { type: 'audio/wav' });
  } finally { await context.close(); }
}

export function microphoneError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '麦克风权限未开启，请在浏览器的网站设置中允许使用麦克风，再试一次。';
  if (name === 'NotFoundError') return '没有找到麦克风，请连接设备后重试，也可以上传音频文件。';
  if (name === 'NotReadableError') return '麦克风暂时无法使用，请检查是否被其他应用占用后重试。';
  return '录音未能完成，请重新录制，也可以上传音频文件。';
}
