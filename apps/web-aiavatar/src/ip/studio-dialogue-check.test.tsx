// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { STUDIO_CHECK_COMMAND } from '@/canvas-bridge/studio-plan-execution';
import { StudioNodeContent } from './studio-node-content';

vi.mock('./studio-script-rich-editor', () => ({ StudioScriptRichEditor: () => null }));
afterEach(cleanup);
const node = { id: 'chk', type: 'text', title: '第 1 段 · 检查', position: { x: 0, y: 0 }, width: 380, height: 320, metadata: { status: 'success', studio: { kind: 'check',
  check: { status: 'unknown', targetRunId: 'run-v1', sampledTimesSec: [0.5, 2.5], items: [
    { id: 'subject', status: 'pass', evidence: [{ kind: 'frame', timeSec: 2.5, observation: '画面中央是洗衣液' }], reason: '主体和商品一致' },
    { id: 'caption', status: 'unknown', evidence: [{ kind: 'text', observation: '这一段没有字幕' }], reason: '看不出台词是否完整', suggestion: '加字幕再检查' }] } } } } as CanvasNodeData;

test('a check node shows 「AI 判断」 item by item with the sampled evidence, never as a pass', () => {
  render(<StudioNodeContent node={node}/>);
  const verdict = screen.getByLabelText('AI 判断');
  expect(within(verdict).getAllByText('无法判断')).toHaveLength(2);
  expect(within(verdict).getByText('通过')).toBeDefined();
  expect(within(verdict).getByText('2.5 秒：画面中央是洗衣液')).toBeDefined();
  expect(within(verdict).getByText('看了 0.5 秒、2.5 秒 的画面')).toBeDefined();
  expect(within(verdict).getByText('建议：加字幕再检查')).toBeDefined();
  // Not the 「剧本待创作」 summary that ordinary studio text nodes fall back to.
  expect(screen.queryByText('剧本待创作')).toBeNull();
});

test('「就用这版」 and 「重做这一段」 dispatch to the dialogue without starting a canvas drag', () => {
  const drag = vi.fn(), command = vi.fn();
  window.addEventListener(STUDIO_CHECK_COMMAND, command);
  render(<div onMouseDown={drag} onPointerDown={drag}><StudioNodeContent node={node}/></div>);
  for (const name of ['就用这版', '重做这一段']) {
    const button = screen.getByRole('button', { name });
    fireEvent.pointerDown(button); fireEvent.mouseDown(button); fireEvent.click(button);
  }
  window.removeEventListener(STUDIO_CHECK_COMMAND, command);
  expect(drag).not.toHaveBeenCalled();
  expect(command.mock.calls.map(c => c[0].detail)).toEqual([{ action: 'accept', nodeId: 'chk' }, { action: 'redo', nodeId: 'chk' }]);
});

test('a read-only copy shows the verdict without actions; a check still running says so', () => {
  render(<StudioNodeContent node={node} readOnly/>);
  expect(screen.queryByRole('button', { name: '就用这版' })).toBeNull();
  cleanup();
  render(<StudioNodeContent node={{ ...node, metadata: { studio: { kind: 'check' } } }}/>);
  expect(screen.getByRole('status').textContent).toContain('正在检查');
});
