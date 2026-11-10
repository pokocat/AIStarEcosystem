/**
 * 星币 prices for AI 导演 generations, on the same table as AI 图片 / AI 视频 (one 1K image,
 * 768P video per second) so a frame costs the same wherever it is made. Text (script, lyrics)
 * and the conversation itself are free.
 */
import { DEFAULT_IMAGE, DEFAULT_VIDEO, imageCost, videoCost } from '../quickgen/sceneData';
import { orderedShots, type CanvasNode } from './directorData';
import type { Asset } from './studioModel';

export const PRICE = {
  frame: imageCost({ ...DEFAULT_IMAGE, count: 1 }),
  asset: imageCost({ ...DEFAULT_IMAGE, count: 1 }),
  video: (seconds = 3) => videoCost({ ...DEFAULT_VIDEO, duration: Math.max(1, seconds) }),
  audio: 60,
  vocal: 80,
};

/** Cost of (re)generating one canvas node: a shot's frame, an arrangement or vocals. */
export const nodeCost = (n: CanvasNode) => (n.kind === 'shot' ? PRICE.frame : n.kind === 'audio' ? PRICE.audio : n.kind === 'vocal' ? PRICE.vocal : 0);

/** A shot's video, plus its frame if that has to be drawn first. */
export const shotVideoCost = (n: CanvasNode) => PRICE.video(n.duration) + (n.status !== 'done' || !n.image ? PRICE.frame : 0);

/** What one-click / 合成 still has to pay for: missing asset sheets, frames, videos, idle sound. */
export const remainingCost = (nodes: CanvasNode[], assets: Asset[]) =>
  assets.filter(a => a.status === 'missing').length * PRICE.asset
  + orderedShots(nodes).filter(s => s.videoStatus !== 'done').reduce((sum, s) => sum + shotVideoCost(s), 0)
  + nodes.filter(n => (n.kind === 'audio' || n.kind === 'vocal') && n.status === 'idle').reduce((sum, n) => sum + nodeCost(n), 0);
