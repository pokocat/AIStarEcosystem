import { describe, expect, test } from 'vitest';
import type { IpRun } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { fitStudioNodeToMedia, fitStudioNodeToRatio, markStudioMediaFit, runAspectRatio, STUDIO_CARD_CHROME, STUDIO_MEDIA_MAX_HEIGHT } from './studio-media-fit';
import { applyStudioRun } from './studio-nodes';

// §6.2 (docs/ip-studio-new-canvas-and-threads.md): production 2026-10-21 IPP-655ea55a, a 9:16 clip in a 320×240 box.
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
    const marked = markStudioMediaFit(video(), { storageKey: 'k/v.mp4', aspectRatio: '9:16' });
    expect(marked.metadata?.studio?.mediaFit).toEqual({ storageKey: 'k/v.mp4', aspectRatio: '9:16' });
    expect(marked.height).toBeGreaterThan(marked.width);
    // The file is really 1:1 (the task asked 9:16, the real metadata wins).
    const loaded = fitStudioNodeToMedia(marked, { width: 1024, height: 1024, storageKey: 'k/v.mp4' });
    expect(loaded.height).toBe(320 + STUDIO_CARD_CHROME);
    expect(loaded.metadata).toMatchObject({ naturalWidth: 1024, naturalHeight: 1024 });
    expect(loaded.metadata?.studio?.mediaFit).toBeUndefined();
    expect(fitStudioNodeToMedia(loaded, { width: 1024, height: 1024, storageKey: 'k/v.mp4' })).toBe(loaded);
    // The user resized it afterwards: a reload only records, never resizes.
    const resized = { ...loaded, height: 500 };
    expect(fitStudioNodeToMedia(resized, { width: 1024, height: 1024, storageKey: 'k/v.mp4' })).toBe(resized);
    // A late report of a file the node no longer shows is ignored.
    expect(fitStudioNodeToMedia(resized, { width: 768, height: 1344, storageKey: 'k/old.mp4' })).toBe(resized);
  });

  test('a node without a pending result records the size of what it shows and keeps its box', () => {
    const plain = video();
    const recorded = fitStudioNodeToMedia(plain, { width: 768, height: 1344, storageKey: 'k/v.mp4' });
    expect(recorded.height).toBe(240);
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
