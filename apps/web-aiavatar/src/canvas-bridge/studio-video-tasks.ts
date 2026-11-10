import { ensureStudioVideoPortraits } from '@/ip/portrait-review-preflight';
import { apiFetch } from '@/ip/api/_client';
import { withStudioBilling } from './studio-billing';
import { normalizeStudioError } from '@/ip/studio-errors';
import type { StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
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
  if (input.video) await ensureStudioVideoPortraits(input.video);
  const body = await prepareVideoTask(projectId, input);
  return apiFetch<StudioVideoTask>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/video-tasks`, { method: "POST", body });
}
export const videoTaskStatus = (task: StudioVideoTask) => task.execution?.status ?? task.run?.status ?? 'running';
export function videoTaskLabel(task: StudioVideoTask) {
  const status = videoTaskStatus(task);
  return status === 'done' ? '已完成' : status === 'running' ? task.retryAt ? '重试中' : '生成中'
    : status === 'canceled' ? '已停止' : status === 'paused' ? '已暂停' : '需处理';
}
/** 这条任务现在要用户处理：页面把「在画布中查看」放到主按钮。 */
export const videoTaskNeedsAction = (task: StudioVideoTask) => ['needs_user', 'failed', 'partial'].includes(videoTaskStatus(task));
/** 没做完的那一步。标题用用户在进度条上看到的说法，内部步骤名（审核脚本、分镜图检查）只留在生成记录里；视频页和画布都读这里。 */
export const videoTaskProblemStep = (task: StudioVideoTask) => task.execution?.steps.find(s => s.status === 'failed' || s.status === 'needs_user');
/**
 * 能不能在原任务上接着做，按钮怎么叫。视频页和画布都按这里显示，判定与服务端「继续」一致
 * （StudioPlanExecutionService#control、#adoptVideoRepairs）：
 * - 只有暂停、停下等用户的任务能接着做；超时、已停止、已结束的不能。
 * - 预算不够要先追加预算，素材不在这次制作里要先决定素材：这两种点重试还会停在同一处，不给。
 * - 同一步已经试过 3 次，服务端只接受在画布上修好的这一步，页面上不给重试。
 * 2026-11-07 之前只有「结果读不了」这一种能在视频页重试：分镜图生成服务没回结果、积分已退、原因里写着「可以重新生成」，
 * 页面上却只有「在画布上查看」（线上 PEX-9caea05b1848414ca167）。
 */
export function videoTaskResumeLabel(task: StudioVideoTask): '重试这一步' | '继续生成' | undefined {
  const execution = task.execution;
  if (!execution || (execution.status !== 'needs_user' && execution.status !== 'paused')) return undefined;
  if (execution.budgets.some(b => (b.shortfall ?? 0) > 0)) return undefined;
  const step = videoTaskProblemStep(task);
  if (!step) return '继续生成';
  if (step.materials?.length || step.attempt >= 3) return undefined;
  return step.status === 'failed' || step.errorCode ? '重试这一步' : '继续生成';
}
export function videoTaskProblemTitle(step: StudioPlanExecutionStep) {
  const named = /^第/.test(step.title) ? step.title : undefined;
  const name = step.operation === 'recreation' ? '参考视频分析' : step.operation === 'text' ? '分镜脚本' : step.operation === 'assemble' ? '导出成片'
    : named ?? (step.operation === 'video' ? '视频' : '分镜图');
  return `${name}没有完成`;
}
export function videoTaskProblemText(task: StudioVideoTask) {
  const step = videoTaskProblemStep(task);
  const reason = step?.reason ?? task.execution?.needsUserReason ?? (task.run?.status === 'failed' ? task.run.errorMessage : undefined);
  const text = reason ? normalizeStudioError(reason).message : '';
  return step && step.attempt >= 3 ? `已尝试 ${step.attempt} 次，仍未完成。${text}` : text;
}
export function videoTaskHref(task: Pick<StudioVideoTask, 'id' | 'projectId' | 'sceneId'>) {
  return `/video?${new URLSearchParams({ scene: task.sceneId, draft: task.projectId, task: task.id })}`;
}
export function videoTaskCanvasHref(task: StudioVideoTask) {
  const failed = task.execution?.steps.find(s => s.status === 'failed' || s.status === 'needs_user');
  return `/projects/${encodeURIComponent(task.projectId)}?${new URLSearchParams({ task: task.id, ...(failed ? { step: failed.id, stage: failed.stage } : {}) })}`;
}
