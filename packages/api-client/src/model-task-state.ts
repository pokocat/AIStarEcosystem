/** Shared presentation for durable provider exceptions; polling failures never imply safe regeneration. */
export function modelTaskException(task?: { status?: string; errorCode?: string | null; error_code?: string | null; errorMessage?: string | null; error_message?: string | null }) {
  if (!task || !['running', 'rendering', 'submitting', 'generating', 'queued'].includes(task.status || '')) return null;
  const code = task.errorCode || task.error_code || '';
  const detail = task.errorMessage || task.error_message;
  const notice = (guidance: string) => detail && detail !== guidance ? `${detail} ${guidance}` : guidance;
  if (['STUDIO_IMAGE_SUBMISSION_UNKNOWN', 'VIDEO_SUBMISSION_UNKNOWN', 'STUDIO_SPEECH_SUBMISSION_UNKNOWN', 'STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN'].includes(code))
    return { needsReview: true, label: '受理结果待核对', notice: notice('生成服务响应异常，受理结果待核对。请联系运营核对原任务，请勿重复生成；冻结积分待核实后结算。') };
  if (['STUDIO_IMAGE_RECOVERING', 'VIDEO_RECONCILIATION_PENDING', 'STUDIO_SPEECH_RECOVERING', 'STUDIO_LIP_SYNC_RECOVERING'].includes(code))
    return { needsReview: false, label: '正在恢复原任务', notice: notice('生成服务暂时无法返回结果，正在恢复原任务。请勿重复生成，冻结积分待结果确认后结算。') };
  return null;
}
