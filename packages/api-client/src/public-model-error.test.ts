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

test('old records in supplier or technical wording read as our own sentence and keep the lookup number', () => {
  expect(publicModelErrorMessage('视频1被上游拒收：reference video duration must be within 2..15 seconds · 追查号 JVNLY9US3XJT', 'VIDEO_REF_UPLOAD_FAILED'))
    .toBe('参考视频要 2–15 秒，请调整后再试 · 追查号 JVNLY9US3XJT');
  expect(publicModelErrorMessage('生成服务没有返回有效的任务信息，本次生成失败。未完成部分的冻结积分已退回，你可以重新生成。 错误原因：UpstreamCallException', 'STUDIO_IMAGE_SUBMISSION_UNKNOWN'))
    .toBe('生成服务没有返回结果，这次生成失败。未完成部分的积分已退回，可以重新生成。');
  expect(publicModelErrorMessage('resource not found', 'AI_CALL_FAILED')).toBe('生成服务未能完成本次请求，请重试或更换模型。');
  expect(publicModelErrorMessage('生成服务暂时不可用，请稍后再试或联系平台处理。', 'STUDIO_VIDEO_FAILED')).toBe('生成服务暂时不可用，请稍后重试。');
  expect(publicModelErrorMessage('图片结果下载失败（上游 500）', 'STUDIO_IMAGE_PROVIDER_FAILED')).toBe('图片结果下载失败');
  expect(publicModelErrorMessage('这张画布不存在，或者已经删了', 'IP_PROJECT_NOT_FOUND')).toBe('这张画布不存在，或者已经删了');
});

test('a model chatting, supplier logic and our own code prefix read as a retry and keep the lookup number', () => {
  const retry = '生成服务未能完成本次请求，请重试或更换模型。';
  expect(publicModelErrorMessage('图片生成服务返回错误：我目前无法在此对话中直接生成图片，但可以帮你整理 · 追查号 ABCDEF234567', 'STUDIO_IMAGE_PROVIDER_FAILED')).toBe(`${retry} · 追查号 ABCDEF234567`);
  expect(publicModelErrorMessage('当前生图模式不接受参考图或蒙版，请使用图片编辑接口', 'DAP_MODEL_HTTP_400')).toBe(retry);
  expect(publicModelErrorMessage('VIDEO_MIRROR_FAILED：视频生成好了，但没能存进我方存储（oss down）')).toBe(retry);
  expect(publicModelErrorMessage('InternalServiceError', 'VIDEO_PROVIDER_INTERNAL')).toBe(retry);
});

test('our own Chinese sentence that mentions an API Key is left alone', () => {
  const own = '未为「视频生成」绑定 AI 模型端点。请到管理后台绑定一个端点（端点需含 baseUrl 与有效 API Key）。';
  expect(publicModelErrorMessage(own, 'VIDEO_NOT_CONFIGURED')).toBe(own);
});
