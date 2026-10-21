// @vitest-environment jsdom
// A live reply is laid out in arrival order: text, a work record, then more text. The second text part starts with the
// paragraph break between the model's calls; under white-space: pre-wrap that showed as a blank gap of two empty lines
// under the work record (browser walk 2026-10-20). The paragraphs are shown without their edge whitespace.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StudioDialogueMessage, StudioMessageBlock } from '@ai-star-eco/types/ip-studio-workflow';
import { blockKey } from '@/canvas-bridge/studio-dialogue-store';
import { StudioDialogueMessageView, StudioDialogueQueueMark } from './studio-dialogue-message';

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

// The summary closing an execution already says 「做好了，花了 30 积分。」; the per-reply credits line under it repeated the
// number (user feedback 2026-10-20). An ordinary reply keeps its line.
const billing = { inputTokens: 100, outputTokens: 50, credits: 3, inputCreditsPerK: 1, outputCreditsPerK: 2 };
test('a reply shows its credits once, the execution summary does not repeat them under its text', () => {
  const reply = { ...message, blocks: [], text: '画布上现在有 0 个对象。', billing };
  const { container, rerender } = render(<StudioDialogueMessageView message={reply} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  expect(container.querySelector('.studio-dialogue-footer')?.textContent).toBe('3 积分');
  rerender(<StudioDialogueMessageView message={{ ...reply, text: '做好了，花了 30 积分。', clientMessageId: 'exec-summary-PEX-1' }} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  expect(container.querySelector('.studio-dialogue-footer')).toBeNull();
  rerender(<StudioDialogueMessageView message={{ ...reply, text: '做好了，花了 30 积分。还有部分积分在结算。', clientMessageId: 'exec-summary-PEX-1', settling: true }} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  expect(container.querySelector('.studio-dialogue-footer')).toBeNull();
  expect(container.textContent).not.toContain('积分结算中');
});

// Codex review 2026-10-20 (P1): while a lost answer to 「开始制作」 is being settled, the card says so and can check now.
test('a card whose confirmation is being settled says so and offers 「现在再查一次」', async () => {
  const approval: StudioMessageBlock = { type: 'approval', approvalId: 'ap1', stage: 'production', planFingerprint: 'f1', scope: ['海报'], quotedCost: 8, budgetCap: 12, autoFixCap: 0, status: 'pending' };
  const card = { ...message, text: '', blocks: [approval] };
  const recheck = vi.fn();
  const waiting = { ...handlers, onApprove: vi.fn(() => new Promise(() => {})), verifyingApprovalId: 'ap1', onRecheck: recheck };
  render(<StudioDialogueMessageView message={card} nodes={[]} shortfalls={{}} handlers={waiting}/>);
  expect(screen.queryByText('正在核对确认结果，请稍等')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '开始制作' }));
  expect(await screen.findByText('正在核对确认结果，请稍等')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '现在再查一次' }));
  expect(recheck).toHaveBeenCalledOnce();
});

// User feedback 2026-10-21: 「已收到」「排队中」 on a message were too loud as words. Each delivery state is a small icon whose
// name (screen readers) and hover tip carry the old words; the bubble shows no text for it.
test('a sent message shows where it stands as an icon, not as words', () => {
  const sent: StudioDialogueMessage = { id: 'u1', threadId: 'th', seq: 3, role: 'user', status: 'done', createdAt: '2026-10-21T01:00:00Z', text: '加字幕', blocks: [] };
  const words = { accepted: '已收到', queued: '排队中，下一步应用', applied: '已应用' } as const;
  for (const [state, label] of Object.entries(words) as [keyof typeof words, string][]) {
    const { container, unmount } = render(<StudioDialogueMessageView message={sent} queueState={state} nodes={[]} shortfalls={{}} handlers={handlers}/>);
    const mark = screen.getByRole('status');
    expect(mark.getAttribute('title')).toBe(label);
    expect(screen.getByRole('img', { name: label }).tagName.toLowerCase()).toBe('svg');
    expect(mark.textContent).toBe('');
    expect(container.textContent).not.toContain(label);
    unmount();
  }
  const { container } = render(<StudioDialogueMessageView message={sent} nodes={[]} shortfalls={{}} handlers={handlers}/>);
  expect(container.querySelector('.studio-dialogue-queue')).toBeNull();
});

test('a message still on its way shows a spinning icon named 「发送中」', () => {
  render(<StudioDialogueQueueMark state="sending"/>);
  const icon = screen.getByRole('img', { name: '发送中' });
  expect(icon.getAttribute('class')).toContain('studio-dialogue-action-spin');
  expect(screen.getByRole('status').textContent).toBe('');
});
