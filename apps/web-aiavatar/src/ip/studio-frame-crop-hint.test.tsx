// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { StudioFrameCropHint } from './studio-frame-crop-hint';

afterEach(cleanup);
const frame = (w: number, h: number): CanvasNodeData => ({ id: 'f', type: 'image', title: '首帧', position: { x: 0, y: 0 }, width: 320, height: 320,
  metadata: { storageKey: 'k/f.png', content: 'https://cdn/f.png', naturalWidth: w, naturalHeight: h } });

// §6.2: production 2026-10-21 IPP-655ea55a. The hint does not block; the fix is offered only when the model has that 画幅.
test('a square first frame for a 9:16 clip says it will be cropped and offers 1:1', () => {
  const onFix = vi.fn();
  render(<StudioFrameCropHint frame={frame(1024, 1024)} ratio="9:16" ratios={['9:16', '16:9', '1:1']} onFix={onFix}/>);
  expect(screen.getByRole('status').textContent).toContain('首帧图是 1:1，会按 9:16 居中裁剪');
  fireEvent.click(screen.getByRole('button', { name: '改成 1:1' }));
  expect(onFix).toHaveBeenCalledWith('1:1');
});

test('no button when the model cannot make the frame’s shape, nothing when the shapes match', () => {
  const { rerender } = render(<StudioFrameCropHint frame={frame(1024, 1024)} ratio="9:16" ratios={['9:16', '16:9']} onFix={() => {}}/>);
  expect(screen.getByRole('status').textContent).toContain('会按 9:16 居中裁剪');
  expect(screen.queryByRole('button')).toBeNull();
  rerender(<StudioFrameCropHint frame={frame(768, 1344)} ratio="9:16" ratios={['9:16']} onFix={() => {}}/>);
  expect(screen.queryByRole('status')).toBeNull();
});
