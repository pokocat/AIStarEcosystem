// A result that lands in an image / video node gives the node its own shape (docs/ip-studio-new-canvas-and-threads.md §6.2).
// Production 2026-10-21 IPP-655ea55a: a 9:16 clip sat in a 320×240 (4:3) box. The node keeps its width; its height follows
// the media, first from the task's 画幅 (`studio.mediaFit.aspectRatio`, set when the result lands) and then from the file's
// real size when it loads (`fitStudioNodeToMedia`), after which the marker is removed. The cap reuses the image node rule
// (`fitNodeSize`); the media itself is drawn with object-fit: contain, so nothing is ever distorted.
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { fitNodeSize } from '@/canvas/lib/canvas/canvas-node-size';
import type { IpRun } from '@ai-star-eco/types';

/** Card chrome above the media in a studio flow card: the 36px header plus the 1px borders (styles/studio-flow.css). */
export const STUDIO_CARD_CHROME = 38;
/** The media area never grows past this (the image node's 640 cap). */
export const STUDIO_MEDIA_MAX_HEIGHT = 640;
/** NodeResizer's minimum height on a studio card. */
const MIN_NODE_HEIGHT = 140;

/** `9:16` / `768x1344` → width / height; undefined for anything else. */
export function studioRatioValue(ratio?: string): number | undefined {
  const match = ratio?.match(/^\s*([1-9]\d*)\s*[:x×]\s*([1-9]\d*)\s*$/);
  return match ? Number(match[1]) / Number(match[2]) : undefined;
}

const isMedia = (node: CanvasNodeData) => node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video;

/** The node with its width kept and its height set to show `mediaWidth × mediaHeight` whole (capped). Same object when unchanged. */
export function fitStudioNodeToShape(node: CanvasNodeData, mediaWidth: number, mediaHeight: number): CanvasNodeData {
  if (!isMedia(node) || !(mediaWidth > 0) || !(mediaHeight > 0) || !(node.width > 0)) return node;
  const media = fitNodeSize(node.width, node.width * mediaHeight / mediaWidth, node.width, STUDIO_MEDIA_MAX_HEIGHT);
  const height = Math.max(MIN_NODE_HEIGHT, Math.round(media.height + STUDIO_CARD_CHROME));
  return Math.abs(height - node.height) < 2 ? node : { ...node, height };
}

/** The node shaped by a 画幅 (`9:16`, or an exact `WxH`); unchanged when the ratio is unknown. */
export function fitStudioNodeToRatio(node: CanvasNodeData, ratio?: string): CanvasNodeData {
  const value = studioRatioValue(ratio);
  return value ? fitStudioNodeToShape(node, value * 1000, 1000) : node;
}

/**
 * The media a node shows reported its real size. The node records it (`naturalWidth/Height` follow what is shown, so the
 * assistant and the frame-crop hint read real numbers), and a result still waiting for its shape (`studio.mediaFit` for
 * this file) takes it once and drops the marker. A late report from a file the node no longer shows is ignored. Returns
 * the same object when nothing changes, so a reload does not save the canvas again.
 */
export function fitStudioNodeToMedia(node: CanvasNodeData, size: { width: number; height: number; storageKey?: string }): CanvasNodeData {
  if (!isMedia(node) || !(size.width > 0) || !(size.height > 0)) return node;
  const meta = node.metadata || {};
  if (size.storageKey && meta.storageKey && size.storageKey !== meta.storageKey) return node;
  const fit = meta.studio?.mediaFit;
  const pending = !!fit && (!fit.storageKey || !meta.storageKey || fit.storageKey === meta.storageKey);
  if (!pending && meta.naturalWidth === size.width && meta.naturalHeight === size.height) return node;
  let next: CanvasNodeData = { ...node, metadata: { ...meta, naturalWidth: size.width, naturalHeight: size.height } };
  if (pending && meta.studio) {
    next = fitStudioNodeToShape(next, size.width, size.height);
    const { mediaFit: _done, ...studio } = meta.studio;
    next = { ...next, metadata: { ...next.metadata, studio } };
  }
  return next;
}

/** A result just landed in the node: remember to take its shape, and take the task's 画幅 now if it is known. */
export function markStudioMediaFit(node: CanvasNodeData, fit: { storageKey?: string; aspectRatio?: string }): CanvasNodeData {
  if (!isMedia(node) || !node.metadata?.studio) return node;
  const marked = { ...node, metadata: { ...node.metadata, studio: { ...node.metadata.studio, mediaFit: { ...fit } } } };
  return fitStudioNodeToRatio(marked, fit.aspectRatio);
}

/** The 画幅 a run was asked for (a video request keeps it at the top, an image run under `studioRequest`); undefined when none. */
export function runAspectRatio(run: Pick<IpRun, 'inputs'>): string | undefined {
  const inputs = run.inputs as unknown as { aspectRatio?: unknown; studioRequest?: { aspectRatio?: unknown } } | undefined;
  for (const value of [inputs?.aspectRatio, inputs?.studioRequest?.aspectRatio]) if (typeof value === 'string' && studioRatioValue(value)) return value;
  return undefined;
}
