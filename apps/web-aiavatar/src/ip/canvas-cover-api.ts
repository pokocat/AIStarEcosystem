import { prepareImageForUpload } from '@ai-star-eco/api-client/image-upload';
import { apiFetch } from '@ai-star-eco/api-client';
import { signKeys } from '@/canvas-bridge/api';
import type { IpCanvasCover, IpCanvasCoverTarget } from '@ai-star-eco/types';
import { USE_MOCK, mockDelay } from './api/_client';
import { MOCK_TEMPLATES, mockStore } from './mocks/ip-studio';
import { projectPreview } from './project-preview';

function mockTarget(target: IpCanvasCoverTarget, id: string) {
  const item = target === 'project' ? mockStore().projects.get(id) : MOCK_TEMPLATES.find(t => t.id === id);
  if (!item) throw new Error('画布不存在');
  return item;
}

export function signCoverChoices(keys: string[]) {
  return USE_MOCK ? mockDelay<Record<string, string>>({}) : signKeys(keys);
}

export async function uploadCanvasCover(target: IpCanvasCoverTarget, id: string, file: File) {
  if (USE_MOCK) {
    const item = mockTarget(target, id);
    item.coverUrl = URL.createObjectURL(file);
    if ('lookCount' in item) item.coverVideoUrl = undefined;
    return mockDelay({ coverUrl: item.coverUrl });
  }
  const body = new FormData(); body.append('file', await prepareImageForUpload(file));
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "POST", body });
}
export async function selectCanvasCover(target: IpCanvasCoverTarget, id: string, storageKey: string) {
  if (USE_MOCK) {
    const item = mockTarget(target, id);
    const { images, videos } = projectPreview(item.doc);
    const image = images.find(i => i.key === storageKey);
    const video = 'lookCount' in item ? videos.find(v => v.key === storageKey) : undefined;
    if (!image && !video) throw new Error('请选择这张画布中的素材');
    item.coverUrl = image?.url;
    if ('lookCount' in item) item.coverVideoUrl = video?.url;
    return mockDelay({ coverUrl: image?.url ?? null, coverVideoUrl: video?.url });
  }
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "PUT", body: { storageKey } });
}
export async function resetCanvasCover(target: IpCanvasCoverTarget, id: string) {
  if (USE_MOCK) {
    const item = mockTarget(target, id);
    item.coverUrl = undefined;
    if ('lookCount' in item) item.coverVideoUrl = undefined;
    return mockDelay({ coverUrl: null });
  }
  return apiFetch<IpCanvasCover>(`/v1/ip-studio/covers/${target}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
