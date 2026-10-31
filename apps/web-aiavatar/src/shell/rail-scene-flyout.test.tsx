// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RailSceneFlyout } from './rail-scene-flyout';

const catalog = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('@/ip/scenes/scene-catalog', () => ({ FREE_SCENE_ID: 'free', loadSceneCatalog: catalog.load }));
vi.mock('@/ip/scenes/scene-layout', () => ({ SceneThumb: () => <span className="scene-thumb"/> }));

const scenes = {
  version: 1,
  videoGroups: [{ id: 'ecom', title: '电商带货' }, { id: 'empty', title: '没有场景的组' }],
  imageGroups: [{ id: 'product', title: '商品图' }],
  video: [{ id: 'talk', group: 'ecom', title: '口播带货', description: '有人出镜推荐' }, { id: 'promo', group: 'ecom', title: '促销转化', description: '把优惠讲透' }],
  image: [{ id: 'free', group: 'product', title: '自由出图', description: '自己写' }, { id: 'white', group: 'product', title: '白底图', description: '电商主图' }],
};
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.resetAllMocks(); catalog.load.mockResolvedValue(scenes); window.history.replaceState(null, '', '/projects'); });

const rail = (kind: 'video' | 'image', enabled = true) => render(<RailSceneFlyout kind={kind} label={kind === 'video' ? 'AI 视频' : 'AI 图片'} enabled={enabled}><a href={`/${kind}`}>{kind === 'video' ? 'AI 视频' : 'AI 图片'}</a></RailSceneFlyout>);

test('hovering AI 视频 opens every scene by group; each one links straight into that scene', async () => {
  vi.useFakeTimers();
  const { container } = rail('video');
  fireEvent.pointerEnter(container.querySelector('.rail-flyout-host')!);
  expect(screen.queryByRole('complementary')).toBeNull();
  await act(async () => { vi.advanceTimersByTime(150); });
  vi.useRealTimers();
  const panel = await screen.findByRole('complementary', { name: 'AI 视频场景' });
  expect(await screen.findByRole('link', { name: /促销转化/ })).toBeDefined();
  expect(screen.getByRole('link', { name: /促销转化/ }).getAttribute('href')).toBe('/video?scene=promo');
  expect(panel.textContent).toContain('电商带货');
  expect(panel.textContent).not.toContain('没有场景的组');
});

test('keyboard focus opens it, Esc closes it and does not reopen on the returned focus', async () => {
  rail('image');
  fireEvent.focus(screen.getByRole('link', { name: 'AI 图片' }));
  expect(await screen.findByRole('link', { name: /白底图/ })).toBeDefined();
  // 自由出图放在最前面，不进分组。
  expect(screen.getAllByRole('link')[1].textContent).toContain('自由出图');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('complementary')).toBeNull();
});

test('marks the scene you are on, and stays out of the way when signed out', async () => {
  window.history.replaceState(null, '', '/video?scene=talk');
  rail('video');
  fireEvent.focus(screen.getByRole('link', { name: 'AI 视频' }));
  expect((await screen.findByRole('link', { name: /口播带货/ })).getAttribute('aria-current')).toBe('true');
  cleanup();
  rail('video', false);
  fireEvent.focus(screen.getByRole('link', { name: 'AI 视频' }));
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(catalog.load).toHaveBeenCalledTimes(1);
});
