import { describe, expect, it } from 'vitest';
import { modelTaskException } from './model-task-state';
describe('durable model task exceptions', () => {
  it('keeps a safe reason and the lookup ID beside recovery instructions, but not the status code', () => {
    const detail = (error_message: string) => modelTaskException({status:'running',error_code:'VIDEO_SUBMISSION_UNKNOWN',error_message})?.detail;
    expect(detail('参考视频要 2–15 秒，请调整后再试 · 追查号 ABCDEF234567')).toBe('参考视频要 2–15 秒，请调整后再试 · 追查号 ABCDEF234567');
    // AGENTS.md §8.0.1 ①：状态码留在日志和 internalDetail，不进界面。
    expect(detail('HTTP 503 · 追查号 ABCDEF234567')).toContain('追查号 ABCDEF234567');
    expect(detail('HTTP 503 · 追查号 ABCDEF234567')).not.toContain('HTTP 503');
  });
  it.each(['STUDIO_IMAGE_SUBMISSION_UNKNOWN','VIDEO_SUBMISSION_UNKNOWN','STUDIO_SPEECH_SUBMISSION_UNKNOWN','STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN'])('%s is review-only across wire styles', code => {
    expect(modelTaskException({status:'running',errorCode:code})).toMatchObject({needsReview:true,label:'生成遇到问题'});
    expect(modelTaskException({status:'rendering',error_code:code})?.notice).toContain('冻结积分');
  });
  it.each(['VIDEO_RECONCILIATION_PENDING','STUDIO_IMAGE_RECOVERING','STUDIO_SPEECH_RECOVERING','STUDIO_LIP_SYNC_RECOVERING'])('%s is original-task recovery',errorCode => {
    expect(modelTaskException({status:'running',errorCode,errorMessage:'模型端仍在处理，请稍后查看状态 · 追查号 X'}))
      .toMatchObject({needsReview:false,label:'模型端仍在处理',notice:'模型端仍在处理，请稍后查看状态'});
  });
  it('never reclassifies completed or failed tasks, normal progress, or arbitrary errors', () => {
    for (const status of ['failed','done','ready','succeeded']) expect(modelTaskException({status,errorCode:'VIDEO_SUBMISSION_UNKNOWN'})).toBeNull();
    expect(modelTaskException({status:'running'})).toBeNull();expect(modelTaskException({status:'running',errorCode:'UNKNOWN'})).toBeNull();
  });
});
