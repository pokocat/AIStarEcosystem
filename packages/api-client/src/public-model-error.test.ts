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
