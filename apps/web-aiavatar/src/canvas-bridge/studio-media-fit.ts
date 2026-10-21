// A result that lands in an image / video node gives the node its own shape (docs/ip-studio-new-canvas-and-threads.md §6.2).
// Production 2026-10-21 IPP-655ea55a: a 9:16 clip sat in a 320×240 (4:3) box. The node keeps its width; its height follows
// the media, first from the task's 画幅 (`studio.mediaFit.aspectRatio`, set when the result lands) and then from the file's
// real size when it loads (`fitStudioNodeToMedia`), after which the marker is removed. The cap reuses the image node rule
// (`fitNodeSize`); the media itself is drawn with object-fit: contain, so nothing is ever distorted. A video node goes further
// (视频节点铺满, 2026-10-21): whenever its clip's real size is known the box takes the clip's shape, narrowing past the cap, and
// the clip is drawn edge to edge (`fitStudioVideoNode`).
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

/** A video card is never narrower than NodeResizer allows. */
export const STUDIO_VIDEO_MIN_WIDTH = 220;
/** The card's left + right 1px borders: the media area is this much narrower than the node (styles/studio-flow.css). */
export const STUDIO_CARD_BORDER_X = 2;
/** Node height that shows a clip of height/width `ratio` edge to edge in a node `width` wide, and the reverse. */
const videoHeight = (width: number, ratio: number) => (width - STUDIO_CARD_BORDER_X) * ratio + STUDIO_CARD_CHROME;
const videoWidth = (mediaHeight: number, ratio: number) => mediaHeight / ratio + STUDIO_CARD_BORDER_X;

/**
 * 视频节点铺满（2026-10-21）：a video node takes its clip's shape whenever the clip's real size is known, so the clip fills
 * the card with no bars. The width is kept and the height follows the clip; when that would pass the 640 media cap the box
 * narrows instead (never below 220), so a tall clip in a wide box does not end up with bars on its sides. A box already in
 * the clip's shape is left alone, even one the user dragged past the cap. Same object when nothing moves by 2px or more.
 */
export function fitStudioVideoNode(node: CanvasNodeData, mediaWidth: number, mediaHeight: number): CanvasNodeData {
  if (node.type !== CanvasNodeType.Video || !(mediaWidth > 0) || !(mediaHeight > 0) || !(node.width > 0)) return node;
  const ratio = mediaHeight / mediaWidth;
  if (Math.abs(videoHeight(node.width, ratio) - node.height) < 2) return node;
  let width = node.width;
  if (videoHeight(width, ratio) - STUDIO_CARD_CHROME > STUDIO_MEDIA_MAX_HEIGHT) width = Math.max(STUDIO_VIDEO_MIN_WIDTH, videoWidth(STUDIO_MEDIA_MAX_HEIGHT, ratio));
  // A very wide clip in a narrow box: widen until the card is as tall as NodeResizer allows, instead of leaving bars.
  if (videoHeight(width, ratio) < MIN_NODE_HEIGHT) width = videoWidth(MIN_NODE_HEIGHT - STUDIO_CARD_CHROME, ratio);
  width = Math.round(width);
  const height = Math.round(videoHeight(width, ratio));
  return Math.abs(width - node.width) < 2 && Math.abs(height - node.height) < 2 ? node : { ...node, width, height };
}

/** The clip's real size a video node knows about (recorded when it loaded, or given by the upload); undefined when none. */
export function studioVideoSize(node: CanvasNodeData): { width: number; height: number } | undefined {
  const width = node.metadata?.naturalWidth, height = node.metadata?.naturalHeight;
  return node.type === CanvasNodeType.Video && width && width > 0 && height && height > 0 ? { width, height } : undefined;
}

/** The video node is in its clip's shape, so the clip can be drawn edge to edge (object-fit: cover only crops rounding). */
export function studioVideoFitted(node: CanvasNodeData): boolean {
  const size = studioVideoSize(node);
  return !!size && fitStudioVideoNode(node, size.width, size.height) === node;
}

/**
 * The user resized a video node: the width they chose stays and the height follows the clip, with no cap (they asked for
 * that size). Too short for NodeResizer's minimum → wider instead. Nodes without a known clip size stay as dragged.
 */
export function fitStudioVideoToResize(node: CanvasNodeData): CanvasNodeData {
  const size = studioVideoSize(node);
  if (!size || !(node.width > 0)) return node;
  const ratio = size.height / size.width;
  let width = node.width;
  if (videoHeight(width, ratio) < MIN_NODE_HEIGHT) width = videoWidth(MIN_NODE_HEIGHT - STUDIO_CARD_CHROME, ratio);
  width = Math.round(width);
  const height = Math.round(videoHeight(width, ratio));
  return Math.abs(width - node.width) < 1 && Math.abs(height - node.height) < 1 ? node : { ...node, width, height };
}

/**
 * The media a node shows reported its real size. The node records it (`naturalWidth/Height` follow what is shown, so the
 * assistant and the frame-crop hint read real numbers), and a result still waiting for its shape (`studio.mediaFit` for
 * this file) takes it once and drops the marker. A video node always takes its clip's shape (`fitStudioVideoNode`), whether
 * or not it was waiting; an image node keeps a box the user chose. A late report from a file the node no longer shows is
 * ignored. Returns the same object when nothing changes, so a reload does not save the canvas again.
 */
export function fitStudioNodeToMedia(node: CanvasNodeData, size: { width: number; height: number; storageKey?: string }): CanvasNodeData {
  if (!isMedia(node) || !(size.width > 0) || !(size.height > 0)) return node;
  const meta = node.metadata || {};
  if (size.storageKey && meta.storageKey && size.storageKey !== meta.storageKey) return node;
  const fit = meta.studio?.mediaFit;
  const pending = !!fit && (!fit.storageKey || !meta.storageKey || fit.storageKey === meta.storageKey);
  const video = node.type === CanvasNodeType.Video;
  if (!pending && meta.naturalWidth === size.width && meta.naturalHeight === size.height)
    return video ? fitStudioVideoNode(node, size.width, size.height) : node;
  let next: CanvasNodeData = { ...node, metadata: { ...meta, naturalWidth: size.width, naturalHeight: size.height } };
  if (pending && meta.studio) {
    if (!video) next = fitStudioNodeToShape(next, size.width, size.height);
    const { mediaFit: _done, ...studio } = meta.studio;
    next = { ...next, metadata: { ...next.metadata, studio } };
  }
  return video ? fitStudioVideoNode(next, size.width, size.height) : next;
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
