import type { AiGenerationQueuePosition } from '@ai-star-eco/types';

type Task = { status?: string; stage?: string; pct?: number; queue?: AiGenerationQueuePosition | null };
export function studioTaskQueued(task?: Task): boolean {
  return task?.status === 'running' && (!!task.queue || task.stage === 'endpoint.queued' || task.stage === 'queued');
}
export function studioQueueNotice(queue?: AiGenerationQueuePosition | null): string {
  return queue && queue.position > 0
    ? `排队提醒：当前模型请求量较高，你目前排在第 ${queue.position} 位。`
    : '排队中 · 有空位后自动开始';
}
export function studioTaskLabel(task?: Task, compact = false): string {
  if (studioTaskQueued(task)) return compact ? task?.queue?`排队第 ${task.queue.position} 位`:'排队中' : studioQueueNotice(task?.queue);
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
