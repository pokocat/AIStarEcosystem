/** Camera originals are prepared on the device; server validation remains authoritative. */
export { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_EDGE, IMAGE_UPLOAD_MAX_PIXELS } from './image-upload-policy';
export { ImageUploadError } from './image-upload-errors';
export type { ImageUploadOptions } from './image-upload-policy';
import { IMAGE_ENCODE_MAX_PIXELS, imageUploadLimits, type ImageUploadOptions } from './image-upload-policy';
import { ImageUploadError, isImageMemoryError, heifFailureCode } from './image-upload-errors';
export { isUploadImage, imageKind, imageHeaderSize, fitUploadImage } from './image-upload-format';
import { isUploadImage, imageKind, imageHeaderSize, fitUploadImage } from './image-upload-format';

type Limits = ReturnType<typeof imageUploadLimits>;
type Inspection = { kind: ReturnType<typeof imageKind>; size: ReturnType<typeof imageHeaderSize> };
type Decoded = { source: CanvasImageSource; width: number; height: number; close(): void };
async function nativeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Honor the image orientation before sizing; unrotated header axes must not stretch portrait JPEGs.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch (error) {
      if (isImageMemoryError(error)) throw error;
      // Safari versions differ in supported bitmap formats. The native image element is another decoding path.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob?.size ? resolve(blob) : reject(new ImageUploadError('IMAGE_ENCODE_FAILED')), type, quality));
}
function outputFile(blob: Blob, original: File) {
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const name = (original.name.replace(/\.[^.]*$/, '') || '图片') + '.' + ext;
  return new File([blob], name, { type: blob.type, lastModified: original.lastModified });
}
function compatibleOriginal(file: File, kind: 'jpeg' | 'png') {
  const type = kind === 'png' ? 'image/png' : 'image/jpeg';
  const matchingName = kind === 'png' ? /\.png$/i.test(file.name) : /\.jpe?g$/i.test(file.name);
  return matchingName && file.type === type ? file : outputFile(new Blob([file], { type }), file);
}
function withinLimits(file: File, size: NonNullable<Inspection['size']>, limits: Limits) {
  return size.width > 0 && size.height > 0 && file.size <= limits.maxBytes
    && Math.max(size.width, size.height) <= limits.maxEdge && size.width * size.height <= limits.maxPixels;
}
async function heifInWorker(file: File, limits: Limits): Promise<File> {
  // The optional worker includes the pinned WASM as base64 in its JS bundle; no initial-page decoder download.
  let worker: Worker;
  try { worker = new Worker(new URL('./image-upload.worker.ts', import.meta.url), { type: 'module' }); }
  catch { throw new ImageUploadError('IMAGE_HEIC_CONVERSION_FAILED'); }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      timer = setTimeout(() => reject(new ImageUploadError('IMAGE_PROCESSING_TIMEOUT')), 120_000);
      worker.onmessage = event => {
        if (event.data.blob) resolve(event.data.blob);
        else reject(new ImageUploadError(event.data.code === 'IMAGE_MEMORY_LIMIT' ? 'IMAGE_MEMORY_LIMIT' : 'IMAGE_HEIC_CONVERSION_FAILED'));
      };
      worker.onerror = event => reject(new ImageUploadError(heifFailureCode(event.message)));
      worker.postMessage({ file, ...limits });
    });
    return outputFile(blob, file);
  } finally { clearTimeout(timer); worker.terminate(); }
}

async function prepare(file: File, limits: Limits, { kind }: Inspection): Promise<File> {
  let image: Decoded;
  try { image = await nativeImage(file); }
  catch (error) {
    if (isImageMemoryError(error)) throw new ImageUploadError('IMAGE_MEMORY_LIMIT');
    if (kind === 'heif' || /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) return heifInWorker(file, limits);
    throw new ImageUploadError(kind === 'jpeg' || kind === 'png' ? 'IMAGE_DECODE_FAILED' : 'IMAGE_NOT_RECOGNIZED');
  }
  try {
    const compatible = kind === 'jpeg' || kind === 'png';
    if (compatible && withinLimits(file, image, limits)) return compatibleOriginal(file, kind);
    let size = fitUploadImage(image.width, image.height, limits.maxEdge, Math.min(limits.maxPixels, IMAGE_ENCODE_MAX_PIXELS));
    const canvas = document.createElement('canvas');
    try {
      // PNG photos also need an actual transparency check: opaque photos use JPEG without losing extra resolution.
      let type = 'image/jpeg', checkedAlpha = kind === 'jpeg', quality = .9;
      for (;;) {
        canvas.width = size.width; canvas.height = size.height;
        const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
        if (!ctx) {
          if (size.width === 1 && size.height === 1) throw new ImageUploadError('IMAGE_MEMORY_LIMIT');
          size = { width: Math.max(1, Math.floor(size.width * .5)), height: Math.max(1, Math.floor(size.height * .5)) };
          continue;
        }
        ctx.drawImage(image.source, 0, 0, size.width, size.height);
        if (!checkedAlpha) {
          // Read short strips instead of allocating another full-resolution RGBA buffer.
          for (let y = 0; y < size.height; y += 64) {
            const rgba = ctx.getImageData(0, y, size.width, Math.min(64, size.height - y)).data;
            for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) { type = 'image/png'; break; }
            if (type === 'image/png') break;
          }
          checkedAlpha = true;
        }
        let blob: Blob;
        try { blob = await encode(canvas, type, quality); }
        catch (error) {
          if (isImageMemoryError(error)) throw new ImageUploadError('IMAGE_MEMORY_LIMIT');
          if (size.width === 1 && size.height === 1) throw error;
          size = fitUploadImage(size.width, size.height, Math.max(1, Math.floor(Math.max(size.width, size.height) * .7)));
          continue;
        }
        if (blob.size <= limits.maxBytes && blob.type === type) return outputFile(blob, file);
        if (type === 'image/jpeg' && quality > .8) quality = .8;
        else {
          if (size.width === 1 && size.height === 1) throw new ImageUploadError('IMAGE_ENCODE_FAILED');
          size = { width: Math.max(1, Math.floor(size.width * .75)), height: Math.max(1, Math.floor(size.height * .75)) };
        }
      }
    } finally { canvas.width = 0; canvas.height = 0; }
  } catch (error) {
    if (isImageMemoryError(error)) throw new ImageUploadError('IMAGE_MEMORY_LIMIT');
    throw error;
  } finally { image.close(); }
}

// Only decoding/encoding queues. A compliant original can upload while another entry's HEIC is still processing.
let tail: Promise<unknown> = Promise.resolve();
const prepared = new WeakMap<File, Map<string, Promise<File>>>();
export function prepareImageForUpload(file: File, options: ImageUploadOptions = {}): Promise<File> {
  const limits = imageUploadLimits(options), key = `${limits.maxBytes}/${limits.maxEdge}/${limits.maxPixels}`;
  let cache = prepared.get(file);
  if (!cache) { cache = new Map(); prepared.set(file, cache); }
  const hit = cache.get(key); if (hit) return hit;
  const result = (async () => {
    if (!file.size) throw new ImageUploadError('IMAGE_EMPTY');
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    const kind = imageKind(bytes), size = imageHeaderSize(bytes, kind);
    if ((kind === 'jpeg' || kind === 'png') && size && withinLimits(file, size, limits)) return compatibleOriginal(file, kind);
    const work = tail.then(() => prepare(file, limits, { kind, size }));
    tail = work.catch(() => {});
    return work;
  })();
  cache.set(key, result);
  result.then(output => {
    let outputCache = prepared.get(output);
    if (!outputCache) { outputCache = new Map(); prepared.set(output, outputCache); }
    outputCache.set(key, Promise.resolve(output));
  }, () => cache!.delete(key));
  return result;
}
/** DAP multipart uploads retain field order, repeated fields and non-image files. */
export async function prepareImageFormData(form: FormData) {
  const result = new FormData();
  const entries: [string, FormDataEntryValue][] = [];
  form.forEach((value, name) => entries.push([name, value]));
  for (const [name, value] of entries) result.append(name,
    typeof value !== 'string' && isUploadImage(value) ? await prepareImageForUpload(value) : value);
  return result;
}
