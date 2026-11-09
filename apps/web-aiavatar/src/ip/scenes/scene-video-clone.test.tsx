// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/hub/ui', () => ({ HubTabBar: () => null }));
import ToolboxPage from '@/app/toolbox/page';
import { studioNavigation } from '@/shell/studio-navigation';
afterEach(cleanup);
test('工具箱真的挂到导航和页面，三个入口直达视频编辑页', () => {
  expect(studioNavigation.find(n => n.href === '/toolbox')?.label).toBe('工具箱');
  render(<ToolboxPage/>);
  expect(screen.getByRole('link', { name: /深度复刻/ }).getAttribute('href')).toBe('/video?scene=recreation&tool=depth');
  expect(screen.getByRole('link', { name: /分镜复刻/ }).getAttribute('href')).toBe('/video?scene=recreation&tool=recreation');
  expect(screen.getByRole('link', { name: /元素替换/ }).getAttribute('href')).toBe('/video?scene=recreation&tool=replacement');
});
