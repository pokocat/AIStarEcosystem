import { publicModelErrorMessage } from './public-model-error';

/** Shared presentation for durable provider exceptions; polling failures never imply safe regeneration. */
export function modelTaskException(task?: { status?: string; errorCode?: string | null; error_code?: string | null; errorMessage?: string | null; error_message?: string | null }) {
  if (!task || !['running', 'rendering', 'submitting', 'generating', 'queued'].includes(task.status || '')) return null;
  const code = task.errorCode || task.error_code || '';
  const message = publicModelErrorMessage(task.errorMessage || task.error_message || '', code);
  // Technical reasons remain in error details; primary copy explains the user's next step.
  const notice = (guidance: string) => [guidance, message].filter(Boolean).join(' ');
  if (['STUDIO_IMAGE_SUBMISSION_UNKNOWN', 'VIDEO_SUBMISSION_UNKNOWN', 'STUDIO_SPEECH_SUBMISSION_UNKNOWN', 'STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN'].includes(code))
    return { needsReview: true, label: '生成遇到问题', detail: message, notice: notice('生成服务没有返回有效结果，系统正在结束本次任务并退回未完成部分的冻结积分。请刷新查看最新状态，显示失败后可以重新生成。') };
  if (['STUDIO_IMAGE_RECOVERING', 'VIDEO_RECONCILIATION_PENDING', 'STUDIO_SPEECH_RECOVERING', 'STUDIO_LIP_SYNC_RECOVERING'].includes(code))
    // One plain sentence (2026-10-24, the user's wording): the backend keeps querying the original task; how it does that
    // is not the user's concern. The stored message (with its 追查号) stays in detail for error reports, not in the notice.
    return { needsReview: false, label: '模型端仍在处理', detail: message, notice: '模型端仍在处理，请稍后查看状态' };
  return null;
}
