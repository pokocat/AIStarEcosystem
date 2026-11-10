import type { VideoPortraitItem, VideoPortraitReviewLink } from '@ai-star-eco/types/video-portrait-library';

export type PortraitReviewRequest = { key: string; links: VideoPortraitReviewLink[]; items: VideoPortraitItem[] };
let sink: ((request: PortraitReviewRequest) => void) | undefined;
const pending = new Map<string, { request: PortraitReviewRequest; resolve: ((ready: boolean) => void)[] }>();
const observed = new Set<string>();
const keyFor = (links: VideoPortraitReviewLink[], items: VideoPortraitItem[]) => links.length
  ? links.map(l => `${l.jobId}:${l.reviewId || ''}`).sort().join(',') : items.map(i => i.id).sort().join(',');

/** One request per submission/review revision. Multiple pollers join the same dialog. */
export function requestPortraitReview(links: VideoPortraitReviewLink[] = [], items: VideoPortraitItem[] = []): Promise<boolean> {
  const key = keyFor(links, items);
  if (!key) return Promise.resolve(true);
  return new Promise(resolve => {
    const existing = pending.get(key);
    if (existing) { existing.resolve.push(resolve); return; }
    const request = { key, links, items };
    pending.set(key, { request, resolve: [resolve] });
    sink?.(request);
  });
}
export function observePortraitReviews(links?: VideoPortraitReviewLink[]) {
  if (!links?.length || typeof window === 'undefined') return;
  for (const link of links) {
    const key = keyFor([link], []);
    if (observed.has(key)) continue;
    observed.add(key);
    if (observed.size > 500) observed.delete(observed.values().next().value!);
    void requestPortraitReview([link]);
  }
}
export function finishPortraitReview(key: string, ready: boolean) {
  const entry = pending.get(key); if (!entry) return;
  pending.delete(key); entry.resolve.forEach(resolve => resolve(ready));
}
export function subscribePortraitReviews(handler: (request: PortraitReviewRequest) => void) {
  sink = handler; pending.forEach(entry => handler(entry.request));
  return () => { if (sink === handler) sink = undefined; };
}
/** Closing verification is a deliberate pause; callers preserve their draft and don't show an error dialog. */
export class PortraitReviewDeferred extends Error {
  readonly code = 'STUDIO_PORTRAIT_REVIEW_DEFERRED';
  constructor() { super('人像核验已暂缓，当前内容已保留。'); }
}
