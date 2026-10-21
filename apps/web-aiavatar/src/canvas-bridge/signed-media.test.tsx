// @vitest-environment jsdom
// SignedVideo / SignedAudio 是两份各自独立的实现（复制而来），所以两边都要测；
// 合在一个文件里只是省一次 jsdom 初始化（原 signed-audio.test.tsx / signed-video.test.tsx）。
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, test, vi } from 'vitest';
import { SignedVideo } from './signed-video';
import { SignedAudio } from './signed-audio';

const defaultSign = async (key: string) => `/signed/${key}`;
const sign = vi.hoisted(() => vi.fn());
vi.mock('./image-storage', () => ({ refreshImageUrl: sign }));
vi.mock('@/ip/studio-errors', () => ({ reportStudioError: vi.fn() }));
sign.mockImplementation(defaultSign);
// 恢复用例会改 sign 的返回值：每条结束都还原成默认实现，免得串到下一条。
afterEach(() => { cleanup(); sign.mockReset(); sign.mockImplementation(defaultSign); });

// R1 (Codex retest 2026-10-19): restored nodes carry a key and no URL; the players must sign it like SignedImage does.
test.each([['video', SignedVideo], ['audio', SignedAudio]] as const)('a %s with only a storage key is signed and played', async (tag, Player) => {
  const view = render(<Player storageKey="ipstudio_gen/u1/a.mp4"/>);
  await waitFor(() => expect(view.container.querySelector(tag)?.getAttribute('src')).toBe('/signed/ipstudio_gen/u1/a.mp4'));
  expect(sign).toHaveBeenCalledTimes(1);
});

test('a player that already has a URL does not sign again', () => {
  render(<SignedVideo src="/cdn/a.mp4" storageKey="ipstudio_gen/u1/a.mp4"/>);
  expect(sign).not.toHaveBeenCalled();
});

describe.each([
  ['audio', SignedAudio, '音频', 'wav'],
  ['video', SignedVideo, '视频', 'mp4'],
] as const)('signed %s recovery', (tag, Player, label, ext) => {
  it('retries the actual media element when signing returns the same URL, without an automatic loop', async () => {
    sign.mockResolvedValue(`/same.${ext}`);
    const { container, getByRole } = render(<Player src={`/same.${ext}`} storageKey={`owned/media.${ext}`} controls/>);
    const original = container.querySelector(tag)!; fireEvent.error(original);
    await waitFor(() => expect(container.querySelector(tag)).not.toBe(original));
    expect(container.querySelector(tag)?.getAttribute('src')).toBe(`/same.${ext}`);
    fireEvent.error(container.querySelector(tag)!);
    await waitFor(() => expect(getByRole('button', { name: `${label}加载失败 · 重新加载` })).toBeTruthy());
    expect(sign).toHaveBeenCalledOnce();
  });
  it('renews an expired URL by storage key and preserves the media controls', async () => {
    sign.mockResolvedValue(`/renewed.${ext}`);
    const { container } = render(<Player src={`/expired.${ext}`} storageKey={`owned/media.${ext}`} controls/>);
    fireEvent.error(container.querySelector(tag)!);
    await waitFor(() => expect(container.querySelector(tag)?.getAttribute('src')).toBe(`/renewed.${ext}`));
    expect(sign).toHaveBeenCalledWith(`owned/media.${ext}`); expect(container.querySelector(tag)?.controls).toBe(true);
  });
  it('shows a manual retry after renewal fails, without an automatic request loop', async () => {
    sign.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(`/recovered.${ext}`);
    const { container, getByRole } = render(<Player src={`/expired.${ext}`} storageKey={`owned/media.${ext}`}/>);
    fireEvent.error(container.querySelector(tag)!);
    await waitFor(() => expect(getByRole('button', { name: `${label}加载失败 · 重新加载` })).toBeTruthy());
    expect(sign).toHaveBeenCalledTimes(1); fireEvent.click(getByRole('button'));
    await waitFor(() => expect(container.querySelector(tag)?.getAttribute('src')).toBe(`/recovered.${ext}`));
    expect(sign).toHaveBeenCalledTimes(2);
  });
});
