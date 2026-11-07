// @vitest-environment jsdom
// 裁剪、拆图、抽帧的图随上传进资产库；不带来源的上传（蒙版、普通图片）只存文件。
import { beforeEach, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@ai-star-eco/api-client', () => ({ apiFetch: api.fetch }));
vi.mock('@ai-star-eco/api-client/image-upload', () => ({ prepareImageForUpload: async (f: File) => f }));
vi.mock('./studio-billing', () => ({ legacyImageBillingDetails: vi.fn(), withStudioBilling: vi.fn(), invalidateStudioModelQuote: vi.fn() }));
vi.mock('./studio-api', () => ({ studioCapabilities: vi.fn(), submitStudioRun: vi.fn() }));

import { uploadImage } from './api';

beforeEach(() => { vi.resetAllMocks(); api.fetch.mockResolvedValue({ key: 'k', url: 'u' }); });
const blob = new Blob(['x'], { type: 'image/png' });

test('an image made on the canvas goes to the canvas endpoint with where it came from', async () => {
  await uploadImage(blob, 'a.png', { projectId: 'IPP-1', nodeId: 'n1', title: '图片 · 裁剪', prompt: '一只橘猫' });
  const [path, init] = api.fetch.mock.calls[0];
  expect(path).toBe('/v1/ip-studio/projects/IPP-1/library/images');
  const form = init.body as FormData;
  expect(form.get('nodeId')).toBe('n1');
  expect(form.get('title')).toBe('图片 · 裁剪');
  expect(form.get('prompt')).toBe('一只橘猫');
  expect(form.get('file')).toBeTruthy();
});

test('an ordinary upload stays a plain upload', async () => {
  await uploadImage(blob, 'a.png');
  const [path, init] = api.fetch.mock.calls[0];
  expect(path).toBe('/v1/ip-studio/uploads');
  expect((init.body as FormData).get('nodeId')).toBeNull();
});
