import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioFailedWithoutMedia, studioFailureReason, studioUnusableModel } from './studio-node-failure';

const node = (over: Partial<CanvasNodeData['metadata']> = {}, type = CanvasNodeType.Video): CanvasNodeData => ({
  id: 'v', type, title: '视频片段', position: { x: 0, y: 0 }, width: 360, height: 240,
  metadata: { status: 'error', ...over } as CanvasNodeData['metadata'],
});
// The node as production left it after the third attempt on the retired model (logId M64E8LSCR77Q).
const retired = node({ studio: { kind: 'shot', request: { model: 'ai-98b369eb-b59' }, task: { status: 'failed', stage: 'failed', pct: 100,
  errorCode: 'VIDEO_MODEL_RETIRED', errorMessage: '这个视频模型已被提供方下架，不能再用它生成，请换一个模型' } } as never });

test('a failed draft without media is a failure, not an empty node; a stopped one and a node with media are not', () => {
  expect(studioFailedWithoutMedia(retired)).toBe(true);
  expect(studioFailedWithoutMedia(node({ storageKey: 'k', content: '/cdn/k' }))).toBe(false);
  expect(studioFailedWithoutMedia(node({ errorCode: 'IP_RUN_CANCELLED' }))).toBe(false);
  expect(studioFailedWithoutMedia(node({ status: 'idle' }))).toBe(false);
  expect(studioFailedWithoutMedia(node({}, CanvasNodeType.Text))).toBe(false);
});

test('a model the failure proved gone, or that is no longer offered, is not reused; a passing outage is retried as is', () => {
  expect(studioUnusableModel(retired)).toBe('ai-98b369eb-b59');
  expect(studioUnusableModel(retired, ['ai-98b369eb-b59', 'h3'])).toBe('ai-98b369eb-b59');
  const busy = node({ errorCode: 'DAP_MODEL_HTTP_503', errorDetails: '模型服务暂时不可用（上游 503），请稍后重试', studio: { kind: 'shot', request: { model: 'agnes' } } as never });
  expect(studioUnusableModel(busy, ['agnes', 'gpt-image-2'])).toBeUndefined();
  expect(studioUnusableModel(busy, ['gpt-image-2'])).toBe('agnes');
  expect(studioUnusableModel(busy)).toBeUndefined();
});

test('the reason is one short line without vendor links', () => {
  expect(studioFailureReason(retired)).toBe('这个模型已不可用，请换一个模型再生成');
  const vendor = node({ errorDetails: '视频模型拒绝了这次请求：model x has been rejected; see https://app.example.com/models for more。后面的话。' });
  expect(studioFailureReason(vendor)).not.toContain('https://');
  expect(studioFailureReason(node({}))).toBe('没有生成出来，可以修改后重试');
});
