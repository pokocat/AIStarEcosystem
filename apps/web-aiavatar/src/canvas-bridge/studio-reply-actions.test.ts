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

// 2026-10-20 IPT-2f13c2ed42994624907d seq 10: the plan envelope was shown as prose and never ran.
test('the studio-actions tag spelling is folded like the other two, prose around it kept', () => {
  const reply = '好，就按单段 4 秒来做。\n\n<studio-actions>\n[{"tool":"propose_plan","args":{"stage":"production"}}]\n</studio-actions>';
  const split = splitReplyActions(reply);
  expect(split.prose).toBe('好，就按单段 4 秒来做。');
  expect(split.actions).toContain('propose_plan');
  expect(splitReplyActions('先看。<STUDIO_ACTIONS>[]</STUDIO_ACTIONS>再说。').prose).toBe('先看。再说。');
  expect(splitReplyActions('好。<studio-actions>[{"tool":').prose).toBe('好。');
});
