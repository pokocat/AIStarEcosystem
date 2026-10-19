import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), fetch: vi.fn() }));
vi.mock('./studio-image-file', () => ({ prepareStudioImageUpload: mocks.prepare }));
vi.mock('@ai-star-eco/api-client', () => ({ apiFetch: mocks.fetch }));
import { importStudioMedia } from './studio-api';
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
