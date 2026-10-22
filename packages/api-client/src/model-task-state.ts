/** Shared presentation for durable provider exceptions; polling failures never imply safe regeneration. */
export function modelTaskException(task?: { status?: string; errorCode?: string | null; error_code?: string | null; errorMessage?: string | null; error_message?: string | null }) {
  if (!task || !['running', 'rendering', 'submitting', 'generating', 'queued'].includes(task.status || '')) return null;
  const code = task.errorCode || task.error_code || '';
  // Technical reasons remain in error details; primary copy explains the user's next step.
  const notice = (guidance: string) => [guidance, task.errorMessage || task.error_message].filter(Boolean).join(' ');
  if (['STUDIO_IMAGE_SUBMISSION_UNKNOWN', 'VIDEO_SUBMISSION_UNKNOWN', 'STUDIO_SPEECH_SUBMISSION_UNKNOWN', 'STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN'].includes(code))
    return { needsReview: true, label: '生成遇到问题', detail: task.errorMessage || task.error_message, notice: notice('生成服务没有返回有效结果，系统正在结束本次任务并退回未完成部分的冻结积分。请刷新查看最新状态，显示失败后可以重新生成。') };
  if (['STUDIO_IMAGE_RECOVERING', 'VIDEO_RECONCILIATION_PENDING', 'STUDIO_SPEECH_RECOVERING', 'STUDIO_LIP_SYNC_RECOVERING'].includes(code))
    return { needsReview: false, label: '正在重新查询结果', detail: task.errorMessage || task.error_message, notice: notice('暂时没有查到生成结果，系统会继续查询。你也可以刷新查看最新状态；刷新不会重新生成或再次扣费。') };
  return null;
}
