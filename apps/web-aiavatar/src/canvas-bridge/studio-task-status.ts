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
  return task?.pct === undefined ? '生成中' : `生成中 ${task.pct}%`;
}
