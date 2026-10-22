import { modelTaskException } from '@ai-star-eco/api-client/model-task-state';
import type { AiGenerationQueuePosition } from '@ai-star-eco/types';

type Task = { kind?: string; status?: string; stage?: string; pct?: number; errorCode?: string; queue?: AiGenerationQueuePosition | null };
export function studioTaskNeedsReview(task?: Task): boolean {
  return modelTaskException(task)?.needsReview === true;
}
export function studioTaskRecovering(task?: Task): boolean {
  return modelTaskException(task)?.needsReview === false;
}
export const studioRecoveryNotice = '生成服务暂时无法返回结果，正在恢复原任务。请勿重复生成，冻结积分待结果确认后结算。';
export const studioReviewNotice = '生成服务响应异常，受理结果待核对。请联系运营核对原任务，请勿重复生成；冻结积分待核实后结算。';
/** Image stages are checkpoints, not provider percentages. */
export function studioTaskHasProgress(task?: Task): boolean {
  return task?.kind !== 'generate' && !studioTaskNeedsReview(task) && !studioTaskRecovering(task) && !task?.stage?.startsWith('image.') && task?.stage !== 'storage.persist';
}
export function studioTaskQueued(task?: Task): boolean {
  return task?.status === 'running' && (!!task.queue || task.stage === 'endpoint.queued' || task.stage === 'queued');
}
export function studioQueueNotice(queue?: AiGenerationQueuePosition | null): string {
  return queue && queue.position > 0
    ? `排队提醒：当前模型请求量较高，你目前排在第 ${queue.position} 位。`
    : '排队中 · 有空位后自动开始';
}
export function studioTaskLabel(task?: Task, compact = false): string {
  if (studioTaskNeedsReview(task)) return '受理结果待核对';
  if (studioTaskRecovering(task)) return '正在恢复原任务';
  if (studioTaskQueued(task)) return compact ? task?.queue?`排队第 ${task.queue.position} 位`:'排队中' : studioQueueNotice(task?.queue);
  if(task?.stage==='image.provider.recovering')return '正在查询原图片任务';
  if(task?.stage==='image.provider.queued')return '生成服务排队中';
  if(task?.stage?.startsWith('image.'))return '正在生成图片';
  if(task?.stage==='storage.persist')return '正在保存结果';
  if(task?.kind==='generate')return task.stage==='prompt.compile'?'正在准备图片':'正在生成图片';
  if(task?.stage==='film.plan')return '正在整理视频分段';
  if(task?.stage==='film.cut')return '正在裁切视频片段';
  if(task?.stage==='film.analyze')return '正在逐段分析镜头';
  if(task?.stage==='recreation.audio')return '正在提取原声音频';
  if(task?.stage==='recreation.frames')return '正在读取视频画面';
  if(task?.stage==='recreation.read')return '正在逐段读取画面';
  if(task?.stage==='recreation.summarize')return '正在整理全片拆解';
  if(task?.stage==='recreation.analyze')return '正在分析创作手法';
  return task?.pct === undefined ? '生成中' : `生成中 ${task.pct}%`;
}
