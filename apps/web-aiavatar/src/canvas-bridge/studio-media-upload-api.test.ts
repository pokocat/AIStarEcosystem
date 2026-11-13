import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), fetch: vi.fn() }));
vi.mock('./studio-image-file', () => ({ prepareStudioImageUpload: mocks.prepare }));
vi.mock('@ai-star-eco/api-client', () => ({ apiFetch: mocks.fetch }));
import { importStudioMedia } from './studio-api';
import { uploadLibraryMedia } from './asset-library';
beforeEach(() => vi.clearAllMocks());

test('the shared upload endpoint sends the optimized image instead of its large original', async () => {
  const original = new File(['original'], 'camera.jpg', { type: 'image/jpeg' });
  const optimized = new File(['optimized'], 'camera.jpg', { type: 'image/jpeg' });
  mocks.prepare.mockResolvedValueOnce(optimized); mocks.fetch.mockResolvedValueOnce({ key: 'own/photo.jpg' });
  await importStudioMedia('project', original, 'image');
  const body = mocks.fetch.mock.calls[0][1].body as FormData;
  expect(await (body.get('file') as File).text()).toBe('optimized'); expect(body.get('mediaType')).toBe('image');
  expect(mocks.prepare).toHaveBeenCalledWith(original);
});

test('a failed image preparation sends no request and other media keeps original bytes', async () => {
  mocks.prepare.mockRejectedValueOnce(new Error('decode failed'));
  await expect(importStudioMedia('project', new File(['bad'], 'camera.jpg'), 'image')).rejects.toThrow('decode failed');
  expect(mocks.fetch).not.toHaveBeenCalled();
  await importStudioMedia('project', new File(['video-original'], 'clip.mp4'), 'video');
  expect(await (mocks.fetch.mock.calls[0][1].body.get('file') as File).text()).toBe('video-original');
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
});

test('library upload sends a fresh copy of the prepared image with its filename and media type', async () => {
  const original = new File(['original'], 'camera.heic');
  const prepared = new File(['image bytes'], 'camera.jpg', { type: 'image/jpeg' });
  const readBytes = vi.spyOn(prepared, 'arrayBuffer');
  mocks.prepare.mockResolvedValueOnce(prepared);
  mocks.fetch.mockResolvedValueOnce({ key: 'own/camera.jpg' });

  await uploadLibraryMedia(original, 'image', 'folder');

  expect(readBytes).toHaveBeenCalledOnce();
  expect(mocks.prepare).toHaveBeenCalledWith(original);
  const [path, { body }] = mocks.fetch.mock.calls[0] as [string, { body: FormData }];
  expect(path).toBe('/v1/ip-studio/library/uploads');
  const part = body.get('file') as File;
  expect(part).not.toBe(prepared);
  expect(part.name).toBe('camera.jpg');
  expect(part.type).toBe('image/jpeg');
  expect(await part.text()).toBe('image bytes');
  expect(body.get('mediaType')).toBe('image');
  expect(body.get('folderId')).toBe('folder');
});
