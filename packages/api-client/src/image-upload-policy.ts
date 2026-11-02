export const IMAGE_UPLOAD_ACCEPT = 'image/*,.heic,.heif';
// Match the canvas upload API. Source files have no byte-size refusal threshold: larger originals are prepared below.
export const IMAGE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_EDGE = 8000;
export const IMAGE_UPLOAD_MAX_PIXELS = 64_000_000;
// Only newly encoded canvases have this area budget; compliant originals do not need a canvas at all.
export const IMAGE_ENCODE_MAX_PIXELS = 16_000_000;
export const STUDIO_MEDIA_IMAGE_LIMITS = { maxBytes: 8 * 1024 * 1024, maxEdge: 8000, maxPixels: 24_000_000 } as const;
export interface ImageUploadOptions { maxBytes?: number; maxEdge?: number; maxPixels?: number }
export function imageUploadLimits(options: ImageUploadOptions = {}) {
  const positive = (value: number | undefined, fallback: number) => value != null && Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    maxBytes: positive(options.maxBytes, IMAGE_UPLOAD_MAX_BYTES),
    maxEdge: positive(options.maxEdge, IMAGE_UPLOAD_MAX_EDGE),
    maxPixels: positive(options.maxPixels, IMAGE_UPLOAD_MAX_PIXELS),
  };
}
/** RGBA budget before libheif display allocates a full-resolution buffer. Native decoding is attempted first. */
export function heifDecodePixelBudget(memoryGiB?: number) {
  if (memoryGiB != null && memoryGiB <= 2) return 32_000_000;
  if (memoryGiB != null && memoryGiB >= 8) return 128_000_000;
  return 64_000_000;
}
