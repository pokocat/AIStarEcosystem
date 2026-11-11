/** A payment/quote dialog closed before admission; never a supplier/task failure. */
export function isStudioBillingCancelled(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'STUDIO_BILLING_CANCELLED';
}

/** 积分不足提示框里用户选了什么（挂在取消错误上，页面按它换模型或重新生成）。 */
export type StudioCreditShortageChoice =
  | { kind: 'close' }
  /** changes：换过去会改掉的设置。有就只换模型、让用户看过再生成，没有才自动重新发起。 */
  | { kind: 'switch-model'; endpointId: string; name: string; changes?: string }
  | { kind: 'retry' }
  /** 关掉「智能优化」按原文生成：优化提示词只能用普通积分，视频本身可能全由模型赠款付。 */
  | { kind: 'no-optimize' };

export function studioCreditShortageChoice(error: unknown): StudioCreditShortageChoice | undefined {
  return isStudioBillingCancelled(error) ? (error as { creditShortage?: StudioCreditShortageChoice }).creditShortage : undefined;
}

/**
 * 付款账户积分不够、服务端没有受理（没建任务、没扣积分）。
 * PAYMENT_REQUIRED 还会来自提现、企业回收，只认生成冻结时的那两句；存储配额、每日用量、制作预算也是 402，但都不是充值能解决的这回事。
 * SCOPED_CREDITS_INSUFFICIENT 也不算：那是用户选了「只用模型赠款」，余额再多也不会放行，照旧错误弹窗，重新生成时费用确认里可以取消勾选。
 */
export function isStudioCreditShortage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === 'MODEL_CREDITS_INSUFFICIENT') return true;
  return code === 'PAYMENT_REQUIRED' && typeof message === 'string' && /^(积分余额不足|钱包不存在或余额不足)/.test(message);
}
