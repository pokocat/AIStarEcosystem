import { USE_MOCK } from './api/_client';
import { checkPortraitInputs, registerPortrait } from './api/video-portrait-library';
import { PortraitReviewDeferred, requestPortraitReview } from './portrait-review-events';
import type { StudioRunRequest } from '@ai-star-eco/types/ip-studio-workflow';

/** Prepare portrait inputs before a generation is billed. Never classify a detected face as virtual without consent. */
export async function ensurePortraitInputs(model: string | undefined, keys: (string | undefined)[]) {
  const input = [...new Set(keys.filter((key): key is string => !!key))];
  if (USE_MOCK || !model || !input.length) return;
  const preparation = await checkPortraitInputs(model, input);
  if (!preparation?.libraryId) return; // Other model channels retain their existing preparation.
  const items = [...preparation.items];
  if (preparation.candidateKeys.length) {
    const { referenceMayContainFace } = await import('./portrait-face-hint');
    for (const key of preparation.candidateKeys) {
      if (await referenceMayContainFace(key)) items.push(await registerPortrait({ libraryId: preparation.libraryId, key, mediaType: 'image', label: `参考图 ${input.indexOf(key) + 1}` }));
    }
  }
  if (items.length && !await requestPortraitReview([], items)) throw new PortraitReviewDeferred();
}
export const ensureStudioVideoPortraits = (request: Pick<StudioRunRequest, 'operation' | 'model' | 'video' | 'references'>) => request.operation !== 'video' ? Promise.resolve() : ensurePortraitInputs(request.model, [
  request.video?.firstFrameKey, request.video?.lastFrameKey,
  ...(request.video?.references?.filter(ref => ref.mediaType === 'image').map(ref => ref.key) || []), ...(request.references?.map(ref => ref.storageKey) || []),
]);
