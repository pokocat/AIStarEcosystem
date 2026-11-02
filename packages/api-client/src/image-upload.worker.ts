/*! libheif-js 1.23.5, LGPL-3.0. License: /licenses/libheif-js-LICENSE.txt; source: https://github.com/catdad-experiments/libheif-js */
// This independent, same-origin worker contains the pinned libheif WASM as base64 in its JS bundle.
import createDecoder from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import { fitUploadImage } from './image-upload-format';
import { heifPrimaryColorSpace } from './heif-color-space';
import { heifDecodePixelBudget, IMAGE_ENCODE_MAX_PIXELS } from './image-upload-policy';
import { ImageUploadError, heifFailureCode } from './image-upload-errors';

const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(value: unknown): void };
scope.onmessage = async ({ data }: MessageEvent<{ file: File; maxBytes: number; maxEdge: number; maxPixels: number }>) => {
  try {
    const decoder = await createDecoder();
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const images = new decoder.HeifDecoder().decode(bytes);
    const image = images.find(candidate => candidate.is_primary()) ?? images[0];
    if (!image) throw new Error('No readable image');
    try {
      const width = image.get_width(), height = image.get_height();
      const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      if (!Number.isSafeInteger(width * height) || width * height > heifDecodePixelBudget(memory))
        throw new ImageUploadError('IMAGE_MEMORY_LIMIT');
      // libheif applies container rotation once. Do not apply EXIF orientation a second time.
      const pixels = new ImageData(width, height, { colorSpace: heifPrimaryColorSpace(bytes) });
      await new Promise<void>((resolve, reject) => image.display(pixels, decoded => decoded ? resolve() : reject(new Error('Decode failed'))));
      let size = fitUploadImage(width, height, data.maxEdge, Math.min(data.maxPixels, IMAGE_ENCODE_MAX_PIXELS));
      // Resize before making a canvas: a full-resolution camera canvas can exceed mobile canvas limits.
      const bitmap = await createImageBitmap(pixels, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high', imageOrientation: 'from-image' });
      const type = image.has_alpha_channel() ? 'image/png' : 'image/jpeg';
      try {
        let quality = .9;
        for (;;) {
          const canvas = new OffscreenCanvas(size.width, size.height);
          try {
            const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
            if (!ctx) throw new Error('Canvas unavailable');
            ctx.drawImage(bitmap, 0, 0, size.width, size.height);
            const blob = await canvas.convertToBlob({ type, quality });
            if (blob.size > 0 && blob.size <= data.maxBytes && blob.type === type) { scope.postMessage({ blob }); return; }
          } finally { canvas.width = 0; canvas.height = 0; }
          if (type === 'image/jpeg' && quality > .8) quality = .8;
          else {
            if (size.width === 1 && size.height === 1) throw new Error('Encode failed');
            size = { width: Math.max(1, Math.floor(size.width * .75)), height: Math.max(1, Math.floor(size.height * .75)) };
          }
        }
      } finally { bitmap.close(); }
    } finally { images.forEach(candidate => candidate.free()); }
  } catch (error) { scope.postMessage({ code: error instanceof ImageUploadError ? error.code : heifFailureCode(error) }); }
};
