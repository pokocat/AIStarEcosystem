// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { VideoPortraitItem } from '@ai-star-eco/types/video-portrait-library';
import { CanvasConfigComposer } from '@/canvas/components/canvas/canvas-config-composer';
import { CanvasPromptChipInput } from '@/canvas/components/canvas/canvas-prompt-chip-input';
import { PortraitMaterialTable } from './portrait-review-ui';

vi.mock('@/canvas/stores/use-theme-store', () => ({ useThemeStore: () => 'light' }));
vi.mock('@/canvas/components/canvas/canvas-node-reference-bar', () => ({ CanvasNodeReferenceBar: () => null }));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn() }) });
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const src = '/photos/reference.jpg';
const title = '参考人像';

async function checkPreview(trigger: HTMLElement) {
  fireEvent.click(trigger);
  expect(screen.getByRole('toolbar', { name: '缩放' })).toBeTruthy();
  expect(document.querySelector('.director-image-preview img')?.getAttribute('src')).toBe(src);
  const fit = screen.getByRole('button', { name: '适应窗口' });
  expect(fit).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '放大' }));
  await waitFor(() => expect(fit).toHaveProperty('disabled', false));
  fireEvent.click(fit);
  await waitFor(() => expect(fit).toHaveProperty('disabled', true));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('toolbar', { name: '缩放' })).toBeNull();
}

it('previews the selected portrait from the table without starting confirmation', async () => {
  const item: VideoPortraitItem = { id: 'portrait', libraryId: 'ark', key: 'photo', label: title, mediaType: 'image', status: 'needs_review', updatedAt: '2026-11-13T00:00:00Z', previewUrl: src };
  const confirm = vi.fn();
  render(<PortraitMaterialTable items={[item]} onConfirm={confirm} onRefresh={vi.fn()} />);
  await checkPreview(screen.getByRole('button', { name: `放大查看${title}` }));
  expect(screen.getByRole('button', { name: `放大查看${title}` })).toBeTruthy();
  expect(confirm).not.toHaveBeenCalled();
});

it('previews a prompt reference without changing or submitting the prompt', async () => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(<CanvasPromptChipInput value="使用 @图1" references={[{ id: 'ref', nodeId: 'source', kind: 'image', label: '@图1', title, previewUrl: src, active: true }]} onChange={onChange} onSubmit={onSubmit} />);
  await checkPreview(screen.getByAltText(title));
  expect(screen.getByAltText(title)).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('previews a config reference without changing the content or closing the composer', async () => {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(<CanvasConfigComposer nodeId="config" nodes={[]} value="使用 @[node:source]" inputs={[{ nodeId: 'source', type: 'image', title, image: { id: 'ref', name: title, type: 'image/jpeg', dataUrl: src } }]} onChange={onChange} onClose={onClose} />);
  await checkPreview(screen.getByAltText(title));
  expect(screen.getByAltText(title)).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
