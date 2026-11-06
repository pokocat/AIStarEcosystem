import { apiFetch } from '@/ip/api/_client';
import { withStudioBilling } from './studio-billing';
import type { StudioVideoTask, StudioVideoTaskCreate, StudioVideoTaskPage, StudioVideoTaskQuote } from '@ai-star-eco/types/ip-studio-video-task';

export const videoTasks = (page = 0) => apiFetch<StudioVideoTaskPage>('/v1/ip-studio/video-tasks', { query: { page } });
export const videoTask = (id: string) => apiFetch<StudioVideoTask>(`/v1/ip-studio/video-tasks/${encodeURIComponent(id)}`);
export const videoTaskPrice = (query: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) =>
  apiFetch<StudioVideoTaskQuote>('/v1/ip-studio/studio/video-task-price', { query, signal });
export async function prepareVideoTask(projectId: string, input: StudioVideoTaskCreate) {
  const body = input.billing ? input : await withStudioBilling(projectId, input, { expectedCost: input.budgetCap });
  if (body.configuration) body.configuration = { ...body.configuration, billing: body.billing };
  if (body.video) body.video = { ...body.video, billing: body.billing };
  return body;
}
export async function startVideoTask(projectId: string, input: StudioVideoTaskCreate) {
  const body = await prepareVideoTask(projectId, input);
  return apiFetch<StudioVideoTask>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/video-tasks`, { method: "POST", body });
}
export const videoTaskStatus = (task: StudioVideoTask) => task.execution?.status ?? task.run?.status ?? 'running';
export function videoTaskLabel(task: StudioVideoTask) {
  const status = videoTaskStatus(task);
  return status === 'done' ? '已完成' : status === 'running' ? task.retryAt ? '重试中' : '制作中'
    : status === 'canceled' ? '已停止' : status === 'paused' ? '已暂停' : '需处理';
}
export function videoTaskHref(task: Pick<StudioVideoTask, 'id' | 'projectId' | 'sceneId'>) {
  return `/video?${new URLSearchParams({ scene: task.sceneId, draft: task.projectId, task: task.id })}`;
}
export function videoTaskCanvasHref(task: StudioVideoTask) {
  const failed = task.execution?.steps.find(s => s.status === 'failed' || s.status === 'needs_user');
  return `/projects/${encodeURIComponent(task.projectId)}?${new URLSearchParams({ task: task.id, ...(failed ? { step: failed.id, stage: failed.stage } : {}) })}`;
}
