// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RailSceneFlyout } from './rail-scene-flyout';
import { useSceneDrawerPin } from '@/ip/scenes/scene-layout';

const catalog = vi.hoisted(() => ({ load: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/ip/scenes/scene-catalog', () => ({ FREE_SCENE_ID: 'free', loadSceneCatalog: catalog.load, sceneCover: () => '' }));

const scenes = {
  version: 1,
  videoGroups: [{ id: 'ecom', title: '电商带货' }, { id: 'empty', title: '没有场景的组' }],
  imageGroups: [{ id: 'product', title: '商品图' }],
  video: [{ id: 'talk', group: 'ecom', title: '口播带货', description: '有人出镜推荐' }, { id: 'promo', group: 'ecom', title: '促销转化', description: '把优惠讲透' }],
  image: [{ id: 'free', group: 'product', title: '自由出图', description: '自己写' }, { id: 'white', group: 'product', title: '白底图', description: '电商主图' }],
};
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.resetAllMocks(); catalog.load.mockResolvedValue(scenes); window.history.replaceState(null, '', '/projects'); localStorage.clear(); });

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

// 2026-11-01 用户：菜单里浮上去的弹窗也要带固定，和场景页的「全部场景」用同一个组件。
test('the flyout is the same scene list as the page, with the pin; pinning from elsewhere opens the page', async () => {
  rail('video');
  fireEvent.focus(screen.getByRole('link', { name: 'AI 视频' }));
  await screen.findByRole('link', { name: /促销转化/ });
  const panel = screen.getByRole('complementary', { name: 'AI 视频场景' });
  expect(panel.classList.contains('scene-drawer')).toBe(true);
  expect(panel.classList.contains('is-pinned')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '固定在侧边' }));
  expect(localStorage.getItem('aiavatar_scene_drawer_pinned:video')).toBe('1');
  expect(router.push).toHaveBeenCalledWith('/video');
  expect(screen.queryByRole('complementary')).toBeNull();
});

function PagePin() { const [pinned] = useSceneDrawerPin('video'); return <output aria-label="页面里的固定">{pinned ? '固定' : '悬浮'}</output>; }

test('on the scene page the page column follows the pin at once, and the flyout stays floating', async () => {
  window.history.replaceState(null, '', '/video?scene=talk');
  render(<PagePin/>);
  rail('video');
  fireEvent.focus(screen.getByRole('link', { name: 'AI 视频' }));
  await screen.findByRole('link', { name: /口播带货/ });
  fireEvent.click(screen.getByRole('button', { name: '固定在侧边' }));
  expect(screen.getByLabelText('页面里的固定').textContent).toBe('固定');
  expect(router.push).not.toHaveBeenCalled();
  fireEvent.focus(screen.getByRole('link', { name: 'AI 视频' }));
  const again = await screen.findByRole('complementary', { name: 'AI 视频场景' });
  expect(again.classList.contains('is-pinned')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '取消固定' }));
  expect(screen.getByLabelText('页面里的固定').textContent).toBe('悬浮');
});
