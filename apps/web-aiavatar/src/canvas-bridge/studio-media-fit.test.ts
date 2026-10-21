import { describe, expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { fitStudioNodeToMedia, fitStudioNodeToRatio, fitStudioVideoNode, fitStudioVideoToResize, markStudioMediaFit, runAspectRatio, studioVideoFitted, STUDIO_CARD_CHROME, STUDIO_MEDIA_MAX_HEIGHT, STUDIO_VIDEO_MIN_WIDTH } from './studio-media-fit';
import { applyStudioRun } from './studio-nodes';

// §6.2 (docs/ip-studio-new-canvas-and-threads.md): production 2026-10-21 IPP-655ea55a, a 9:16 clip in a 320×240 box.
const image = (over: Partial<CanvasNodeData> = {}, meta: CanvasNodeData['metadata'] = {}): CanvasNodeData =>
  ({ id: 'i', type: 'image', title: '图片', position: { x: 10, y: 20 }, width: 320, height: 240, metadata: { status: 'success', storageKey: 'k/v.png', studio: { kind: 'shot' }, ...meta }, ...over });
const video = (over: Partial<CanvasNodeData> = {}, meta: CanvasNodeData['metadata'] = {}): CanvasNodeData =>
  ({ id: 'v', type: 'video', title: '视频', position: { x: 10, y: 20 }, width: 320, height: 240, metadata: { status: 'success', storageKey: 'k/v.mp4', studio: { kind: 'shot' }, ...meta }, ...over });

describe('the box takes the shape of what it shows', () => {
  test('a ratio keeps the width and sets the height, capped like an image node', () => {
    const tall = fitStudioNodeToRatio(video(), '9:16');
    expect(tall.width).toBe(320);
    expect(tall.height).toBe(Math.round(320 * 16 / 9 + STUDIO_CARD_CHROME));
    expect(tall.position).toEqual({ x: 10, y: 20 });
    const wide = fitStudioNodeToRatio(video(), '16:9');
    expect(wide.height).toBe(Math.round(320 * 9 / 16 + STUDIO_CARD_CHROME));
    const capped = fitStudioNodeToRatio(video({ width: 480 }), '9:16');
    expect(capped.height).toBe(STUDIO_MEDIA_MAX_HEIGHT + STUDIO_CARD_CHROME);
    expect(capped.width).toBe(480);
    const plain = video();
    expect(fitStudioNodeToRatio(plain, undefined)).toBe(plain);
    expect(fitStudioNodeToRatio(plain, 'square')).toBe(plain);
    const text: CanvasNodeData = { ...plain, type: 'text' };
    expect(fitStudioNodeToRatio(text, '9:16')).toBe(text);
  });

  test('a result waiting for its shape takes the real size once and the marker goes; later loads only keep the size current', () => {
    const marked = markStudioMediaFit(image(), { storageKey: 'k/v.png', aspectRatio: '9:16' });
    expect(marked.metadata?.studio?.mediaFit).toEqual({ storageKey: 'k/v.png', aspectRatio: '9:16' });
    expect(marked.height).toBeGreaterThan(marked.width);
    // The file is really 1:1 (the task asked 9:16, the real metadata wins).
    const loaded = fitStudioNodeToMedia(marked, { width: 1024, height: 1024, storageKey: 'k/v.png' });
    expect(loaded.height).toBe(320 + STUDIO_CARD_CHROME);
    expect(loaded.metadata).toMatchObject({ naturalWidth: 1024, naturalHeight: 1024 });
    expect(loaded.metadata?.studio?.mediaFit).toBeUndefined();
    expect(fitStudioNodeToMedia(loaded, { width: 1024, height: 1024, storageKey: 'k/v.png' })).toBe(loaded);
    // An image node the user resized afterwards: a reload only records, never resizes (images are not in 视频节点铺满).
    const resized = { ...loaded, height: 500 };
    expect(fitStudioNodeToMedia(resized, { width: 1024, height: 1024, storageKey: 'k/v.png' })).toBe(resized);
    // A late report of a file the node no longer shows is ignored.
    expect(fitStudioNodeToMedia(resized, { width: 768, height: 1344, storageKey: 'k/old.png' })).toBe(resized);
  });

  test('an image node without a pending result records the size of what it shows and keeps its box', () => {
    const plain = image();
    const recorded = fitStudioNodeToMedia(plain, { width: 768, height: 1344, storageKey: 'k/v.png' });
    expect(recorded.height).toBe(240);
    expect(recorded.width).toBe(320);
    expect(recorded.metadata).toMatchObject({ naturalWidth: 768, naturalHeight: 1344 });
  });

  test('a manual result takes its shape: the task 画幅 now, the marker for the real size', () => {
    const run = { id: 'IPR-1', projectId: 'p', nodeId: 'v', kind: 'studio-video', status: 'done', stage: 'done', pct: 100, cost: 40,
      inputs: { aspectRatio: '9:16', prompt: '转身' } as unknown as IpRun['inputs'], createdAt: '',
      output: { videoCandidates: [{ index: 0, jobId: 'j', status: 'done', pct: 100, storageKey: 'k/new.mp4', url: 'u', durationSec: 5 }] } } as IpRun;
    expect(runAspectRatio(run)).toBe('9:16');
    expect(runAspectRatio({ inputs: { studioRequest: { aspectRatio: '1:1' } } as unknown as IpRun['inputs'] })).toBe('1:1');
    const applied = applyStudioRun(video({}, { storageKey: undefined, status: 'loading', studio: { kind: 'shot' } }), run);
    expect(applied.metadata?.storageKey).toBe('k/new.mp4');
    expect(applied.metadata?.studio?.mediaFit).toEqual({ storageKey: 'k/new.mp4', aspectRatio: '9:16' });
    expect(applied.height).toBeGreaterThan(applied.width);
    // Applying the same finished run again (a reload) does not resize.
    expect(applyStudioRun({ ...applied, height: 300 }, run).height).toBe(300);
  });
});

// 视频节点铺满（2026-10-21）：a video node takes its clip's shape whenever the clip's real size is known.
describe('a video node is always in its clip\'s shape', () => {
  test('a landscape clip keeps the width and sets the height', () => {
    const fitted = fitStudioVideoNode(video(), 1920, 1080);
    expect(fitted.width).toBe(320);
    // The media area is the node minus its 1px borders on each side, so the clip fills it exactly.
    expect(fitted.height).toBe(Math.round(318 * 9 / 16 + STUDIO_CARD_CHROME));
    expect(fitted.position).toEqual({ x: 10, y: 20 });
  });

  test('a portrait clip that would pass the 640 cap narrows the box instead of leaving side bars', () => {
    const fitted = fitStudioVideoNode(video({ width: 480, height: 300 }), 1080, 1920);
    expect(fitted.height).toBe(STUDIO_MEDIA_MAX_HEIGHT + STUDIO_CARD_CHROME);
    expect(fitted.width).toBe(Math.round(STUDIO_MEDIA_MAX_HEIGHT * 1080 / 1920 + 2));
    // The media area matches the clip within rounding.
    expect(Math.abs((fitted.height - STUDIO_CARD_CHROME) / (fitted.width - 2) - 1920 / 1080)).toBeLessThan(0.01);
    // Very tall clips stop at the minimum width; the ratio still wins over the cap.
    const strip = fitStudioVideoNode(video({ width: 480 }), 100, 1000);
    expect(strip.width).toBe(STUDIO_VIDEO_MIN_WIDTH);
    expect(strip.height).toBe((STUDIO_VIDEO_MIN_WIDTH - 2) * 10 + STUDIO_CARD_CHROME);
  });

  test('a very wide clip in a narrow box widens to the minimum card height', () => {
    const fitted = fitStudioVideoNode(video({ width: 220 }), 3000, 1000);
    expect(fitted.height).toBe(140);
    expect(fitted.width).toBe(Math.round((140 - STUDIO_CARD_CHROME) * 3 + 2));
  });

  test('under 2px of difference is the same object; a box already in shape stays, even past the cap', () => {
    const fitted = fitStudioVideoNode(video(), 1920, 1080);
    expect(fitStudioVideoNode(fitted, 1920, 1080)).toBe(fitted);
    const nearly = { ...fitted, height: fitted.height + 1 };
    expect(fitStudioVideoNode(nearly, 1920, 1080)).toBe(nearly);
    const big = video({ width: 600, height: Math.round(598 * 16 / 9 + STUDIO_CARD_CHROME) });
    expect(fitStudioVideoNode(big, 1080, 1920)).toBe(big);
  });

  test('a loaded clip reshapes any video node, with or without a pending marker or studio metadata', () => {
    const old = video({}, { studio: undefined });
    const loaded = fitStudioNodeToMedia(old, { width: 768, height: 1344, storageKey: 'k/v.mp4' });
    expect(loaded.metadata).toMatchObject({ naturalWidth: 768, naturalHeight: 1344 });
    expect(loaded.width).toBe(320);
    expect(loaded.height).toBe(Math.round(318 * 1344 / 768 + STUDIO_CARD_CHROME));
    expect(fitStudioNodeToMedia(loaded, { width: 768, height: 1344, storageKey: 'k/v.mp4' })).toBe(loaded);
    // Already recorded but the box drifted (an old document): the next load puts it back in shape.
    const drifted = { ...loaded, height: 240 };
    expect(fitStudioNodeToMedia(drifted, { width: 768, height: 1344, storageKey: 'k/v.mp4' }).height).toBe(loaded.height);
    // A pending result's marker still goes away.
    const marked = markStudioMediaFit(video(), { storageKey: 'k/v.mp4', aspectRatio: '9:16' });
    const landed = fitStudioNodeToMedia(marked, { width: 1024, height: 1024, storageKey: 'k/v.mp4' });
    expect(landed.metadata?.studio?.mediaFit).toBeUndefined();
    expect(landed.height).toBe(landed.width - 2 + STUDIO_CARD_CHROME);
    // A late report of another file is ignored.
    expect(fitStudioNodeToMedia(drifted, { width: 100, height: 100, storageKey: 'k/old.mp4' })).toBe(drifted);
  });

  test('without a known size nothing moves; fitted means the box is in shape', () => {
    const unknown = video();
    expect(fitStudioVideoToResize(unknown)).toBe(unknown);
    expect(studioVideoFitted(unknown)).toBe(false);
    const known = video({}, { naturalWidth: 1920, naturalHeight: 1080 });
    expect(studioVideoFitted(known)).toBe(false);
    expect(studioVideoFitted(fitStudioVideoNode(known, 1920, 1080))).toBe(true);
    expect(fitStudioVideoNode(image(), 1920, 1080)).toEqual(image());
  });

  test('after a resize the chosen width stays and the height follows the clip, with no cap', () => {
    const dragged = video({ width: 700, height: 300 }, { naturalWidth: 1080, naturalHeight: 1920 });
    const fixed = fitStudioVideoToResize(dragged);
    expect(fixed.width).toBe(700);
    expect(fixed.height).toBe(Math.round(698 * 1920 / 1080 + STUDIO_CARD_CHROME));
    expect(fitStudioVideoToResize(fixed)).toBe(fixed);
  });
});
