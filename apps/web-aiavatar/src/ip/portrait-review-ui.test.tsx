// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { VideoPortraitOverview, VideoPortraitItem } from '@ai-star-eco/types/video-portrait-library';
const mocks = vi.hoisted(() => ({ overview: vi.fn(), review: vi.fn(), declare: vi.fn(), refresh: vi.fn(), resume: vi.fn(), report: vi.fn() }));
vi.mock('./studio-errors', () => ({ normalizeStudioError: (e: Error) => ({ message: e.message }), reportStudioError: mocks.report }));
vi.mock('./api/video-portrait-library', () => ({ portraitOverview: mocks.overview, portraitReview: mocks.review, declarePortrait: mocks.declare, refreshPortrait: mocks.refresh, resumePortraitReview: mocks.resume }));
import { PortraitDeclaration } from './portrait-review-ui';
import { PortraitReviewHost } from './portrait-review-host';
import { requestPortraitReview, finishPortraitReview } from './portrait-review-events';
const item: VideoPortraitItem = { id: 'portrait', libraryId: 'ark', key: 'photo', label: '参考图', mediaType: 'image', status: 'needs_review', updatedAt: '2026-11-09T01:00:00Z' };
const data = (): VideoPortraitOverview => ({ libraries: [{ id: 'ark', name: '官方人像' }], items: [{ ...item }], persons: [{ id: 'person', libraryId: 'ark', name: '陈泽', status: 'active', expiresAt: '2026-11-09T02:00:00Z', createdAt: '2026-11-09T01:00:00Z' }], agreement: { version: 'v1', text: '人像授权说明', virtualDeclaration: '虚拟人像声明' } });
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { finishPortraitReview('original-job:first', false); finishPortraitReview('defer-item', false); cleanup(); });
it('uses framework controls and resets consent when the portrait type changes', async () => {
  const submit = vi.fn();render(<PortraitDeclaration item={item} overview={data()} busy={false} onSubmit={submit} onPerson={vi.fn()} />);
  expect(document.querySelector('select')).toBeNull();expect(screen.getByRole('combobox')).toBeTruthy();
  const button = screen.getByRole('button', { name: '提交审核' });expect(button).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('radio', { name: 'AI 虚拟人像' }));fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(button).toHaveProperty('disabled', false));
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));await waitFor(() => expect(screen.getByRole('checkbox')).toHaveProperty('checked', false));expect(button).toHaveProperty('disabled', true);
});
it('keeps the original task in an inline modal and resumes only that job after approval', async () => {
  const state = data();mocks.overview.mockImplementation(async () => ({ ...state, items: state.items.map(i => ({ ...i })) }));
  mocks.review.mockImplementation(async () => ({ jobId: 'original-job', items: state.items.map(i => ({ ...i })), awaiting: true, canContinue: state.items.every(i => i.status === 'active') }));
  mocks.declare.mockImplementation(async () => { state.items[0].status = 'processing'; return { ...state.items[0] }; });
  mocks.refresh.mockImplementation(async () => { state.items[0].status = 'active'; return { ...state.items[0] }; });mocks.resume.mockResolvedValue({ awaiting: false });
  render(<PortraitReviewHost />);let done = false;const pending = requestPortraitReview([{ jobId: 'original-job', reviewId: 'first' }]).then(ready => { done = ready; });
  await screen.findByRole('dialog');await screen.findByText('参考图');expect(done).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '确认人像' }));fireEvent.click(await screen.findByRole('radio', { name: 'AI 虚拟人像' }));fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByRole('button', { name: '提交审核' })).toHaveProperty('disabled', false));
  fireEvent.submit(screen.getByRole('button', { name: '提交审核' }).closest('form')!);await waitFor(() => expect(mocks.declare).toHaveBeenCalledTimes(1));
  const continueButton = screen.getByRole('button', { name: '继续生成' });expect(continueButton).toHaveProperty('disabled', true);expect(mocks.resume).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: '查询结果' }));await waitFor(() => expect(continueButton).toHaveProperty('disabled', false));
  fireEvent.click(continueButton);await pending;expect(done).toBe(true);expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('original-job');
});
it('deferring verification closes the modal without resubmitting or losing the pending context', async () => {
  mocks.overview.mockResolvedValue(data());render(<PortraitReviewHost />);
  const pending = requestPortraitReview([], [{ ...item, id: 'defer-item' }]);await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: '稍后处理' }));await expect(pending).resolves.toBe(false);expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.declare).not.toHaveBeenCalled();
});
