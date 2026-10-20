import { afterEach, expect, test, vi } from 'vitest';
import { prepareStudioImageUpload, STUDIO_IMAGE_UPLOAD_MAX_BYTES } from './studio-image-file';

afterEach(() => vi.unstubAllGlobals());
function renderer(mime: string, sizes: number[], { width = 6000, height = 4000, bytes = 9 * 1024 * 1024 } = {}) {
  const close = vi.fn(), drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }),
    toBlob: vi.fn((callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(sizes.shift() ?? 100)], { type }))) };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  vi.stubGlobal('document', { createElement: () => canvas });
  const file = new File([new Uint8Array(bytes)], mime === 'image/png' ? '透明原图.png' : '相机照片.jpg', { type: mime, lastModified: 123 });
  return { file, canvas, close, drawImage };
}

test('ordinary files retain their bytes, identity and metadata', async () => {
  const file = new File(['original'], '相机照片.jpg', { type: 'image/jpeg' });
  expect(await prepareStudioImageUpload(file)).toBe(file);
});

test('a camera original over 8 MB becomes a bounded upload and preserves its filename', async () => {
  const { file, canvas, close, drawImage } = renderer('image/jpeg', [1024]);
  const result = await prepareStudioImageUpload(file);
  expect(result.size).toBeLessThanOrEqual(STUDIO_IMAGE_UPLOAD_MAX_BYTES);
  expect(result.name).toBe(file.name); expect(result.type).toBe('image/jpeg'); expect(result.lastModified).toBe(123);
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 2730);
  expect(file.size).toBe(9 * 1024 * 1024); expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
});

test('PNG stays PNG and is reduced again when the first encode remains too large', async () => {
  const { file, canvas, close } = renderer('image/png', [9 * 1024 * 1024, 1024]);
  const result = await prepareStudioImageUpload(file);
  expect(result.type).toBe('image/png'); expect(result.name).toBe(file.name);
  expect(canvas.toBlob).toHaveBeenCalledTimes(2); expect(canvas.toBlob.mock.calls.every(c => c[1] === 'image/png')).toBe(true);
  expect(close).toHaveBeenCalledOnce();
});

test('a decode error is reported before any network request could be made', async () => {
  const { file } = renderer('image/jpeg', []);
  vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('invalid image'); }));
  await expect(prepareStudioImageUpload(file)).rejects.toThrow('图片无法读取');
});

test('invalid and excessive originals are rejected before decoding', async () => {
  const decode = vi.fn(); vi.stubGlobal('createImageBitmap', decode);
  await expect(prepareStudioImageUpload({ name: 'large.png', size: 51 * 1024 * 1024 } as File)).rejects.toThrow('50 MB');
  await expect(prepareStudioImageUpload({ name: 'fake.exe', size: 9 * 1024 * 1024 } as File)).rejects.toThrow('JPG');
  expect(decode).not.toHaveBeenCalled();
});

// Production 2026-10-20: an image under 8 MB but over the server's pixel limits went up as it was and was refused with
// 「图片最长边不能超过 8000 像素，总像素不能超过 2400 万」.
test.each([['a long edge over 8000', 9000, 3000], ['more than 24 million pixels', 6000, 5000]])('a small file with %s is reduced before upload', async (_label, width, height) => {
  const { file, drawImage, close } = renderer('image/jpeg', [1024], { width, height, bytes: 2 * 1024 * 1024 });
  const result = await prepareStudioImageUpload(file);
  expect(result).not.toBe(file);
  const [, , , w, h] = drawImage.mock.calls[0];
  expect(Math.max(w, h)).toBeLessThanOrEqual(8000);
  expect(w * h).toBeLessThanOrEqual(24_000_000);
  expect(result.name).toBe(file.name); expect(close).toHaveBeenCalledOnce();
});

test('a small file within the pixel limits keeps its original bytes', async () => {
  const { file, drawImage, close } = renderer('image/jpeg', [], { width: 8000, height: 3000, bytes: 2 * 1024 * 1024 });
  expect(await prepareStudioImageUpload(file)).toBe(file);
  expect(drawImage).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
});
