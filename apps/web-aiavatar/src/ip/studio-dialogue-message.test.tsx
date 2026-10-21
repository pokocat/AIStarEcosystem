// @vitest-environment jsdom
// A live reply is laid out in arrival order: text, a work record, then more text. The second text part starts with the
// paragraph break between the model's calls; under white-space: pre-wrap that showed as a blank gap of two empty lines
// under the work record (browser walk 2026-10-20). The paragraphs are shown without their edge whitespace.
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StudioDialogueMessage, StudioMessageBlock } from '@ai-star-eco/types/ip-studio-workflow';
import { blockKey } from '@/canvas-bridge/studio-dialogue-store';
import { StudioDialogueMessageView } from './studio-dialogue-message';

afterEach(cleanup);

const tool: StudioMessageBlock = { type: 'tool_call', toolCallId: 't1', toolName: 'read_canvas', title: '查看画布', safeInputSummary: '查看画布上的全部对象',
  status: 'done', startedAt: '2026-10-20T13:00:00Z', finishedAt: '2026-10-20T13:00:00Z', durationMs: 10, result: { summary: '画布上有 0 个对象' }, creditsActual: 0 };
const message: StudioDialogueMessage = { id: 'm1', threadId: 'th', seq: 2, role: 'assistant', status: 'done', createdAt: '2026-10-20T13:00:00Z',
  text: '我先看一下画布上有什么。\n\n画布上现在有 0 个对象。', blocks: [tool] };
const handlers = { onCompose: vi.fn(), onRevise: vi.fn(), onApprove: vi.fn(), planReady: () => true, onAdopt: vi.fn() };

test('a text part after a work record is shown without the blank lines that separate model calls', () => {
  const layout = { order: ['t:p1', `b:${blockKey(tool)}`, 't:p2'], parts: { p1: '我先看一下画布上有什么。', p2: '\n\n画布上现在有 0 个对象。' } };
  const { container } = render(<StudioDialogueMessageView message={message} layout={layout} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  const paragraphs = [...container.querySelectorAll('.studio-dialogue-text')].map(p => p.textContent);
  expect(paragraphs).toEqual(['我先看一下画布上有什么。', '画布上现在有 0 个对象。']);
});

test('line breaks inside a paragraph are kept', () => {
  const layout = { order: ['t:p1'], parts: { p1: '第一行\n第二行\n' } };
  const { container } = render(<StudioDialogueMessageView message={{ ...message, blocks: [] }} layout={layout} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  expect(container.querySelector('.studio-dialogue-text')?.textContent).toBe('第一行\n第二行');
});
