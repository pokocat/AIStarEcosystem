// 抽帧 (2026-10-21): one frame of a video node becomes an image node linked to it, free and in the browser.
// The clip is read as a Blob through the backend (`fetchAssetBlob`): production OSS has no CORS, so drawing a signed
// URL onto a canvas would taint it and `toBlob` would throw. The vendored `captureVideoFrame` (canvas/lib) is left
// untouched; this copy keeps the last frame inside the clip (0.05 s before the end), stops waiting after a while and
// says what went wrong in words the user can act on.
export type StudioFramePosition = 'first' | 'last' | 'current';

/** Seconds as the panel and the node title show them: `00:05`, `01:12`, `1:02:03`. */
export function formatFrameTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** The name of the frame in the new node's title. */
export function framePositionLabel(position: StudioFramePosition, at = 0): string {
  return position === 'first' ? '首帧' : position === 'last' ? '尾帧' : `当前帧 ${formatFrameTime(at)}`;
}

/** Where to seek for a frame: the end is kept 0.05 s inside the clip, a current time past it lands there too. */
export function frameSeekTime(position: StudioFramePosition, duration: number, currentTime = 0): number {
  const end = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.05) : 0;
  if (position === 'first') return 0;
  if (position === 'last') return end;
  return Math.max(0, Math.min(Number.isFinite(currentTime) ? currentTime : 0, end));
}

export class StudioFrameError extends Error {}

function wait(video: HTMLVideoElement, event: 'loadedmetadata' | 'loadeddata' | 'seeked', timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const done = (fn: () => void) => () => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener('error', fail); fn(); };
    const ok = done(resolve), fail = done(() => reject(new StudioFrameError('这条视频无法在浏览器里读取，请换一条 MP4 再试')));
    const timer = setTimeout(done(() => reject(new StudioFrameError('读取视频超时，请重试'))), timeoutMs);
    video.addEventListener(event, ok); video.addEventListener('error', fail);
  });
}

type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (callback: () => void) => number };
/** Wait until the seeked frame is decoded: `seeked` can fire before it is, and drawing then gives a black picture. */
async function frameReady(video: FrameVideo, timeoutMs: number) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await wait(video, 'loadeddata', timeoutMs);
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 300);
    video.requestVideoFrameCallback?.(() => { clearTimeout(timer); resolve(); });
  });
}
/** Every sampled pixel is (nearly) black: either the clip really is black there, or the frame was not decoded yet. */
function looksBlack(video: HTMLVideoElement) {
  const sample = document.createElement('canvas'); sample.width = 32; sample.height = 18;
  const context = sample.getContext('2d'); if (!context) return false;
  context.drawImage(video, 0, 0, 32, 18);
  const data = context.getImageData(0, 0, 32, 18).data;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8) return false;
  return true;
}

/** Capture one frame of `clip` (a Blob read through the backend) as a JPEG Blob of the clip's own size. */
export async function captureStudioVideoFrame(clip: Blob, position: StudioFramePosition, currentTime = 0, timeoutMs = 20_000): Promise<Blob> {
  const url = URL.createObjectURL(clip), video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  try {
    const metadata = wait(video, 'loadedmetadata', timeoutMs);
    video.src = url; video.load();
    await metadata;
    const time = frameSeekTime(position, video.duration, currentTime);
    if (time > 0) { const seeked = wait(video, 'seeked', timeoutMs); video.currentTime = time; await seeked; }
    await frameReady(video, timeoutMs);
    if (!video.videoWidth || !video.videoHeight) throw new StudioFrameError('这条视频没有画面，无法截取');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new StudioFrameError('浏览器不支持截取画面，请换个浏览器再试');
    // Local walkthrough 2026-10-21: the first 截尾帧 after loading came out all black although `seeked` had fired; the same
    // frame drawn again a moment later was fine. A black draw is retried a few times; a clip that really is black there
    // (a fade-out) still ends up black, only a second later.
    for (let attempt = 0; attempt < 3 && looksBlack(video); attempt++) await new Promise(resolve => setTimeout(resolve, 250));
    context.drawImage(video, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new StudioFrameError('没能截出画面，请重试')), 'image/jpeg', 0.92));
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
