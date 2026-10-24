import { describe, expect, it } from 'vitest';
import { modelTaskException } from './model-task-state';
describe('durable model task exceptions', () => {
  it('keeps the actual safe failure reason and lookup ID beside recovery instructions', () => {
    expect(modelTaskException({status:'running',error_code:'VIDEO_SUBMISSION_UNKNOWN',error_message:'HTTP 503 · 追查号 ABCDEF234567'})?.detail).toContain('HTTP 503 · 追查号 ABCDEF234567');
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
