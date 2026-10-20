// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SignedVideo } from './signed-video';
import { SignedAudio } from './signed-audio';

const sign = vi.hoisted(() => vi.fn(async (key: string) => `/signed/${key}`));
vi.mock('./image-storage', () => ({ refreshImageUrl: sign }));
vi.mock('@/ip/studio-errors', () => ({ reportStudioError: vi.fn() }));
afterEach(() => { cleanup(); sign.mockClear(); });

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
