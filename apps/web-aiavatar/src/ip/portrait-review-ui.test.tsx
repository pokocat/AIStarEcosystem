// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { VideoPortraitOverview, VideoPortraitItem } from '@ai-star-eco/types/video-portrait-library';
const mocks = vi.hoisted(() => ({ overview: vi.fn(), review: vi.fn(), declare: vi.fn(), declareBatch: vi.fn(), refresh: vi.fn(), resume: vi.fn(), report: vi.fn(), startPerson: vi.fn(), refreshPerson: vi.fn() }));
vi.mock('./studio-errors', () => ({ normalizeStudioError: (e: Error) => ({ message: e.message }), reportStudioError: mocks.report }));
vi.mock('./api/video-portrait-library', () => ({ portraitOverview: mocks.overview, portraitReview: mocks.review, declarePortrait: mocks.declare, declarePortraits: mocks.declareBatch, refreshPortrait: mocks.refresh, resumePortraitReview: mocks.resume, startPortraitPerson: mocks.startPerson, refreshPortraitPerson: mocks.refreshPerson }));
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
it('shows automatic continuation and closes when the server resumes the original task', async () => {
  const state = data();state.items[0].status = 'processing';
  mocks.overview.mockImplementation(async () => ({ ...state, items: state.items.map(i => ({ ...i })) }));
  mocks.review.mockImplementation(async () => ({ jobId: 'original-job', items: state.items.map(i => ({ ...i })), awaiting: state.items[0].status !== 'active' }));
  vi.useFakeTimers();
  try {
    render(<PortraitReviewHost />);let pending!: Promise<boolean>;
    await act(async () => { pending = requestPortraitReview([{ jobId: 'original-job', reviewId: 'first' }]); });
    expect(screen.getByText('素材全部通过后将自动继续生成。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生成' })).toBeNull();
    state.items[0].status = 'active';
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    await expect(pending).resolves.toBe(true);
    expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.refresh).not.toHaveBeenCalled();expect(mocks.declare).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
it('continues a preflight after all photos are approved without a second Generate click', async () => {
  const state = data();state.items = [{ ...item, status: 'processing' }, { ...item, id: 'second', status: 'queued' }];
  mocks.overview.mockImplementation(async () => ({ ...state, items: state.items.map(i => ({ ...i })) }));
  vi.useFakeTimers();
  try {
    render(<PortraitReviewHost />);let ready: boolean | undefined;
    await act(async () => { void requestPortraitReview([], state.items).then(result => { ready = result; }); });
    state.items[0].status = 'active';
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(ready).toBeUndefined();
    state.items[1].status = 'active';
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(ready).toBe(true);
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
it('declares only explicitly selected photos in one request', async () => {
  const second = { ...item, id: 'second', label: '第二张参考图' };
  const third = { ...item, id: 'third', label: '第三张参考图' };
  render(<PortraitGuide item={item} overview={data()} busy={false} act={run} batchItems={[item, second, third]} />);
  fireEvent.click(screen.getByRole('radio', { name: 'AI 虚拟人像' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '第二张参考图' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '提交审核（2 张）' })); });
  expect(mocks.declareBatch).toHaveBeenCalledExactlyOnceWith(['portrait', 'second'], {
    kind: 'virtual', personId: undefined, accepted: true, agreementVersion: 'v1',
  });
  expect(mocks.declare).not.toHaveBeenCalled();
});
it('deferring verification closes the modal without resubmitting or losing the pending context', async () => {
  mocks.overview.mockResolvedValue(data());render(<PortraitReviewHost />);
  let pending!: Promise<boolean>;act(() => { pending = requestPortraitReview([], [{ ...item, id: 'defer-item' }]); });await screen.findByRole('dialog');
  // The step's button shares the dialog's single button row; the only verified person is already selected.
  const step = await screen.findByRole('button', { name: '提交审核' });expect(step.closest('.ant-modal-footer')).not.toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: '真人照片' }));expect(screen.getByRole('radio', { name: '陈泽' })).toHaveProperty('checked', true);
  fireEvent.click(screen.getByRole('button', { name: '暂不生成' }));await expect(pending).resolves.toBe(false);expect(mocks.resume).not.toHaveBeenCalled();expect(mocks.declare).not.toHaveBeenCalled();
});
it('opens the fitted image viewer and returns to the portrait confirmation on Escape', async () => {
  const photo = { ...item, id: 'defer-item', previewUrl: '/photos/reference.jpg' };
  mocks.overview.mockResolvedValue({ ...data(), items: [photo] });
  render(<PortraitReviewHost />);
  let pending!: Promise<boolean>;
  act(() => { pending = requestPortraitReview([], [photo]); });

  const trigger = await screen.findByRole('button', { name: '放大查看参考图' });
  fireEvent.click(trigger);
  expect(screen.getByRole('toolbar', { name: '缩放' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '适应窗口' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: '放大' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '适应窗口' })).toHaveProperty('disabled', false));
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('toolbar', { name: '缩放' })).toBeNull();
  expect(screen.getByRole('dialog', { name: '确认参考人像' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '暂不生成' }));
  await expect(pending).resolves.toBe(false);
});
