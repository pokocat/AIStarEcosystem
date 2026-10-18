import { apiFetch } from '@ai-star-eco/api-client';
import type { IpCanvasCover, IpCanvasCoverTarget } from '@ai-star-eco/types';
import { USE_MOCK, mockDelay } from './api/_client';
import { MOCK_TEMPLATES, mockStore } from './mocks/ip-studio';
import { projectPreview } from './project-preview';

function mockTarget(target: IpCanvasCoverTarget, id: string) {
  const item = target === 'project' ? mockStore().projects.get(id) : MOCK_TEMPLATES.find(t => t.id === id);
  if (!item) throw new Error('画布不存在');
  return item;
}

export async function uploadCanvasCover(target: IpCanvasCoverTarget, id: string, file: File) {
  if (USE_MOCK) {
    const item = mockTarget(target, id);
    item.coverUrl = URL.createObjectURL(file);
    return mockDelay({ coverUrl: item.coverUrl });
  }
  const body = new FormData(); body.append('file', file);
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "POST", body });
}
export async function selectCanvasCover(target: IpCanvasCoverTarget, id: string, storageKey: string) {
  if (USE_MOCK) {
    const item = mockTarget(target, id), image = projectPreview(item.doc).images.find(i => i.key === storageKey);
    if (!image) throw new Error('请选择这张画布中的图片');
    item.coverUrl = image.url;
    return mockDelay({ coverUrl: image.url });
  }
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "PUT", body: { storageKey } });
}
export async function resetCanvasCover(target: IpCanvasCoverTarget, id: string) {
  if (USE_MOCK) {
    mockTarget(target, id).coverUrl = undefined;
    return mockDelay({ coverUrl: null });
  }
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
