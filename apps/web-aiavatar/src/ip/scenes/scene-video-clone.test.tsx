// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/hub/ui', () => ({ HubTabBar: () => null }));
import ToolboxPage from '@/app/toolbox/page';
import { studioNavigation } from '@/shell/studio-navigation';
import { VIDEO_CLONE_TOOLS } from '@/ip/scenes/scene-video-clone';
afterEach(cleanup);
test('工具箱真的挂到导航和页面，爆款复刻的三个入口直达视频编辑页', () => {
  expect(studioNavigation.find(n => n.href === '/toolbox')?.label).toBe('工具箱');
  render(<ToolboxPage/>);
  expect(screen.getByRole('link', { name: /^深度复刻/ }).getAttribute('href')).toBe('/video?scene=recreation&tool=depth');
  expect(screen.getByRole('link', { name: /^分镜复刻/ }).getAttribute('href')).toBe('/video?scene=recreation');
  expect(screen.getByRole('link', { name: /^元素替换/ }).getAttribute('href')).toBe('/video?scene=recreation&tool=replacement');
});

test('三种复刻方式的示意图真的挂在卡片上，文件在 public 里', () => {
  render(<ToolboxPage/>);
  for (const tool of VIDEO_CLONE_TOOLS) {
    expect(screen.getByRole('link', { name: new RegExp(`^${tool.title}`) }).querySelector('img')?.getAttribute('src')).toBe(tool.image);
    const file = join(__dirname, '../../../public', tool.image);
    expect(existsSync(file) && statSync(file).isFile()).toBe(true);
  }
});
