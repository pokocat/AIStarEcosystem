// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { VideoPortraitOverview, VideoPortraitItem } from '@ai-star-eco/types/video-portrait-library';
const mocks = vi.hoisted(() => ({ overview: vi.fn(), review: vi.fn(), declare: vi.fn(), refresh: vi.fn(), resume: vi.fn(), report: vi.fn(), startPerson: vi.fn(), refreshPerson: vi.fn() }));
vi.mock('./studio-errors', () => ({ normalizeStudioError: (e: Error) => ({ message: e.message }), reportStudioError: mocks.report }));
vi.mock('./api/video-portrait-library', () => ({ portraitOverview: mocks.overview, portraitReview: mocks.review, declarePortrait: mocks.declare, refreshPortrait: mocks.refresh, resumePortraitReview: mocks.resume, startPortraitPerson: mocks.startPerson, refreshPortraitPerson: mocks.refreshPerson }));
import { PortraitGuide } from './portrait-review-ui';
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
const run = async (task: () => Promise<unknown>) => { await task(); return true; };
it('submits a photo of an already verified person in one pass and resets consent when the type changes', async () => {
  mocks.declare.mockResolvedValue({ ...item, status: 'processing' });
  render(<PortraitGuide item={item} overview={data()} busy={false} act={run} />);
  const submit = screen.getByRole('button', { name: '提交审核' });expect(submit).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('radio', { name: 'AI 虚拟人像' }));fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(submit).toHaveProperty('disabled', false));
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));
  await waitFor(() => expect(screen.getByRole('checkbox')).toHaveProperty('checked', false));expect(submit).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('radio', { name: '陈泽' }));fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '提交审核' })); });
  expect(mocks.declare).toHaveBeenCalledExactlyOnceWith('portrait', { kind: 'person', personId: 'person', accepted: true, agreementVersion: 'v1' });
  expect(mocks.startPerson).not.toHaveBeenCalled();
});
it('submits the photo with the newly verified person as soon as verification passes, without picking it again', async () => {
  const overview = { ...data(), persons: [] };
  const verifying = { id: 'new-person', libraryId: 'ark', name: '陈彬彬', status: 'verifying' as const, verificationUrl: 'https://verify.example/session', expiresAt: '2026-11-09T02:00:00Z', createdAt: '2026-11-09T01:00:00Z' };
  mocks.startPerson.mockResolvedValue(verifying);mocks.refreshPerson.mockResolvedValue({ ...verifying, status: 'active', verificationUrl: undefined });
  mocks.declare.mockResolvedValue({ ...item, status: 'processing' });
  render(<PortraitGuide item={item} overview={overview} busy={false} act={run} />);
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));
  expect(screen.queryByRole('radio', { name: '其他人物' })).toBeNull(); // No one verified yet: go straight to the name.
  fireEvent.change(screen.getByPlaceholderText('例如：林晚'), { target: { value: ' 陈彬彬 ' } });fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始本人核验' })); });
  expect(mocks.startPerson).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ libraryId: 'ark', name: '陈彬彬', accepted: true, agreementVersion: 'v1' }));
  await screen.findByText(/^请陈彬彬本人/);expect(screen.getByRole('link', { name: '在本机核验' }).getAttribute('href')).toBe('https://verify.example/session');expect(mocks.declare).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '查询核验结果' })); });
  expect(mocks.refreshPerson).toHaveBeenCalledExactlyOnceWith('new-person');
  expect(mocks.declare).toHaveBeenCalledExactlyOnceWith('portrait', { kind: 'person', personId: 'new-person', accepted: true, agreementVersion: 'v1' });
});
it('lists a person still verifying so the scan is picked up instead of entering the name again', async () => {
  const verifying = { id: 'half-done', libraryId: 'ark', name: '陈彬彬', status: 'verifying' as const, verificationUrl: 'https://verify.example/session', expiresAt: '2026-11-09T02:00:00Z', createdAt: '2026-11-09T01:00:00Z' };
  const overview = { ...data(), persons: [verifying, { ...verifying, id: 'older', verificationUrl: undefined, status: 'failed' as const }] };
  mocks.refreshPerson.mockResolvedValue({ ...verifying, status: 'active', verificationUrl: undefined });mocks.declare.mockResolvedValue({ ...item, status: 'processing' });
  render(<PortraitGuide item={item} overview={overview} busy={false} act={run} />);
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));
  expect(screen.getAllByRole('radio', { name: /陈彬彬/ })).toHaveLength(1); // One entry per name; an expired attempt is not offered.
  fireEvent.click(screen.getByRole('radio', { name: /陈彬彬/ }));fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '继续核验' })); });
  expect(mocks.startPerson).not.toHaveBeenCalled();expect(mocks.refreshPerson).toHaveBeenCalledExactlyOnceWith('half-done');
  expect(mocks.declare).toHaveBeenCalledExactlyOnceWith('portrait', { kind: 'person', personId: 'half-done', accepted: true, agreementVersion: 'v1' });
});
it('keeps the original task in an inline modal and resumes only that job after approval', async () => {
  const state = data();state.items[0].status = 'processing';
  mocks.overview.mockImplementation(async () => ({ ...state, items: state.items.map(i => ({ ...i })) }));
  mocks.review.mockImplementation(async () => ({ jobId: 'original-job', items: state.items.map(i => ({ ...i })), awaiting: true, canContinue: state.items.every(i => i.status === 'active') }));
  mocks.refresh.mockImplementation(async () => { state.items[0].status = 'active'; return { ...state.items[0] }; });mocks.resume.mockResolvedValue({ awaiting: false });
  render(<PortraitReviewHost />);let done = false;let pending!: Promise<void>;
  act(() => { pending = requestPortraitReview([{ jobId: 'original-job', reviewId: 'first' }]).then(ready => { done = ready; }); });
  await screen.findByRole('dialog');await screen.findByText('参考图');expect(done).toBe(false);
  const continueButton = screen.getByRole('button', { name: '继续生成' });expect(continueButton).toHaveProperty('disabled', true);expect(mocks.resume).not.toHaveBeenCalled();
  const refreshButton = await screen.findByRole('button', { name: '查询结果' });
  await act(async () => { fireEvent.click(refreshButton); });
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1), { timeout: 1000 });
  await waitFor(() => expect(continueButton).toHaveProperty('disabled', false));
  await waitFor(() => expect(continueButton.classList.contains('ant-btn-loading')).toBe(false));
  await act(async () => { fireEvent.click(continueButton); });await pending;expect(done).toBe(true);expect(mocks.resume).toHaveBeenCalledExactlyOnceWith('original-job');
  expect(mocks.declare).not.toHaveBeenCalled(); // An already-submitted asset is queried, never uploaded again.
});
it('deferring verification closes the modal without resubmitting or losing the pending context', async () => {
  mocks.overview.mockResolvedValue(data());render(<PortraitReviewHost />);
  let pending!: Promise<boolean>;act(() => { pending = requestPortraitReview([], [{ ...item, id: 'defer-item' }]); });await screen.findByRole('dialog');
  // The step's button shares the dialog's single button row; the only verified person is already selected.
  const step = await screen.findByRole('button', { name: '提交审核' });expect(step.closest('.ant-modal-footer')).not.toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));expect(screen.getByRole('radio', { name: '陈泽' })).toHaveProperty('checked', true);
  fireEvent.click(screen.getByRole('button', { name: '稍后处理' }));await expect(pending).resolves.toBe(false);expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.declare).not.toHaveBeenCalled();
});
