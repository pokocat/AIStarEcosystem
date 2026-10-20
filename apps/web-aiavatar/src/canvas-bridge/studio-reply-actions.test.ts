import { expect, test } from 'vitest';
import { splitReplyActions } from './studio-reply-actions';

// Production 2026-10-19 (IPP-6658ccda): two early replies showed `<tool_call>{...}</tool_call>` as if the assistant said it.
test('raw action blocks in older replies are folded away from the prose; plain replies are untouched', () => {
  const tagged = splitReplyActions('我先看一下素材。\n<tool_call>{"tool":"read_canvas","args":{}}</tool_call>\n看完了。');
  expect(tagged.prose).toBe('我先看一下素材。\n\n看完了。');
  expect(tagged.actions).toBe('<tool_call>{"tool":"read_canvas","args":{}}</tool_call>');
  const marker = splitReplyActions('方案整理好了。\n<<<studio-actions>>>\n[{"tool":"propose_plan","args":{}}]');
  expect(marker.prose).toBe('方案整理好了。');
  expect(marker.actions).toContain('propose_plan');
  expect(splitReplyActions('<tool_call>{"tool":"stop"').prose).toBe('');
  const plain = '没有动作的普通回复，保留原样。\n\n\n第二段';
  expect(splitReplyActions(plain)).toEqual({ prose: plain, actions: '' });
});
