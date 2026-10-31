import { expect, test } from 'vitest';
import { MODEL_SERVICE_UNAVAILABLE, publicModelErrorMessage, sanitizeModelErrorFields } from './public-model-error';

test.each(['图片生成服务返回错误：预扣费额度失败，用户剩余额度：¥0.0123，需要预扣费额度：¥0.4567 (request id: [已脱敏])',
  'balance $0.0123', '上游账号 quota exceeded', 'api_key=private-secret'])('masks supplier detail: %s', message => {
  expect(publicModelErrorMessage(message, 'STUDIO_IMAGE_PROVIDER_FAILED')).toBe(MODEL_SERVICE_UNAVAILABLE);
});
test('preserves actual customer wallet guidance, actionable media errors and the real lookup ID', () => {
  const wallet = '积分余额不足，本次操作需 320，当前可用 16。请补足积分后继续。';
  expect(publicModelErrorMessage(wallet, 'STUDIO_PAYMENT_REQUIRED')).toBe(wallet);
  expect(publicModelErrorMessage('图片未通过审核，请修改素材', 'STUDIO_IMAGE_PROVIDER_FAILED')).toContain('修改素材');
  expect(publicModelErrorMessage('预扣费额度失败 ¥0.0123 · 追查号 ABCDEF234567')).toBe(MODEL_SERVICE_UNAVAILABLE + ' · 追查号 ABCDEF234567');
});
test('protects historical DTO errors without altering the script or stored source', () => {
  const source = { draft: '预扣费额度失败 ¥0.0123', cost: 320, assets: [{image: {error: {code: 'STUDIO_IMAGE_PROVIDER_FAILED', message: '预扣费额度失败 ¥0.0123'}}}] };
  const safe = sanitizeModelErrorFields(source);
  expect(safe.draft).toBe(source.draft); expect(safe.cost).toBe(320);
  expect(safe.assets[0].image.error.message).toBe(MODEL_SERVICE_UNAVAILABLE);
  expect(source.assets[0].image.error.message).toContain('0.0123');
});

test('old moderation wording does not blame a prompt and retains the real trace', () => {
  const old = '图片未通过生成服务的内容审核：非常抱歉，该提示可能违反了关于暴力内容的防护限制。如果你认为此判断有误，请重试或修改提示语。 · 追查号 ABCDEF234567';
  const source = { draft: old, errorCode: 'STUDIO_IMAGE_PROVIDER_FAILED', errorMessage: old };
  const safe = sanitizeModelErrorFields(source);
  expect(safe.errorMessage).toBe('本次生成未通过内容审核。服务方提示可能涉及暴力内容。服务方未说明触发对象，请检查参考素材和生成描述。 · 追查号 ABCDEF234567');
  expect(safe.draft).toBe(old);
  expect(source.errorMessage).toBe(old);
  expect(publicModelErrorMessage(safe.errorMessage, source.errorCode)).toBe(safe.errorMessage);
});

test.each([
  ['参考图未通过内容审核', '参考图片未通过内容审核'],
  ['生成的图片违反了内容限制', '生成结果未通过内容审核'],
  ['提示词未通过安全检查', '输入文本未通过内容审核'],
])('historical errors keep an explicit subject: %s', (reason, expected) => {
  const visible = publicModelErrorMessage('图片未通过生成服务的内容审核：' + reason, 'STUDIO_IMAGE_PROVIDER_FAILED');
  expect(visible.startsWith(expected)).toBe(true);
  expect(visible).not.toContain('未说明触发对象');
});

test('historical details.reason is corrected without changing the saved source', () => {
  const source = { error: { code: 'STUDIO_IMAGE_PROVIDER_FAILED', message: 'old error', details: {
    providerCode: 'content_policy_violation', category: 'content_moderation', reason: '该提示可能违反暴力内容的防护限制 · 追查号 ABCDEF234567',
  } } };
  const safe = sanitizeModelErrorFields(source);
  expect(safe.error.details.reason).toContain('未说明触发对象');
  expect(safe.error.details.reason).not.toContain('该提示');
  expect(safe.error.details.reason).toContain('追查号 ABCDEF234567');
  expect(source.error.details.reason).toContain('该提示');
});
