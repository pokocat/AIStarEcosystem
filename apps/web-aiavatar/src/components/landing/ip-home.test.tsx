// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { IpHome } from './ip-home';

const api = vi.hoisted(() => ({ authed: false, create: vi.fn(), push: vi.fn(), newCanvas: vi.fn(), projects: vi.fn(async (): Promise<unknown[]> => []) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('@/proto/api', () => ({ USE_MOCK: false, auth: { isAuthed: () => api.authed } }));
vi.mock('@/shell/desktop-top-bar', () => ({ DesktopTopBar: () => null }));
vi.mock('@/ip/api', () => ({ IpStudioApi: { listProjects: api.projects } }));
vi.mock('@/ip/studio-entry', () => ({ createStudioEntry: api.create, studioEntryHref: vi.fn(), startNewCanvas: api.newCanvas }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('a signed-out visitor who starts a conversation is sent to sign in; nothing is created', async () => {
  api.authed = false;
  await act(async () => { render(<IpHome header={false}/>); });
  fireEvent.change(screen.getByRole('textbox', { name: '想做什么' }), { target: { value: '把商品换成我的保温杯' } });
  fireEvent.click(screen.getByRole('button', { name: '开始对话' }));
  expect(api.push).toHaveBeenCalledWith('/login?next=%2Fdashboard');
  expect(api.create).not.toHaveBeenCalled();
});

test('a signed-in visitor\'s brief creates one canvas with the assistant start; an empty box starts nothing', async () => {
  api.authed = true;
  api.create.mockResolvedValue({ id: 'p1' });
  await act(async () => { render(<IpHome header={false}/>); });
  expect((screen.getByRole('button', { name: '开始对话' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: '想做什么' }), { target: { value: '把商品换成我的保温杯' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '开始对话' })); });
  expect(api.create).toHaveBeenCalledWith('assistant', '把商品换成我的保温杯');
  expect(api.push).toHaveBeenCalledTimes(1);
});

// docs/ip-studio-new-canvas-and-threads.md §2.2: 「创建空白画布」 is the shared 「新建」; 「全部画布」 goes to the projects page.
test('「创建空白画布」 goes through the shared new-canvas start, and 「全部画布」 links to the projects page', async () => {
  api.authed = true;
  api.newCanvas.mockResolvedValue('/projects/blank?start=assistant');
  await act(async () => { render(<IpHome header={false}/>); });
  expect(screen.getByRole('link', { name: '全部画布' }).getAttribute('href')).toBe('/projects');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '创建空白画布' })); });
  expect(api.newCanvas).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
  expect(api.push).toHaveBeenCalledWith('/projects/blank?start=assistant');
});

test('a signed-out visitor has no blank-canvas start; nothing is created', async () => {
  api.authed = false;
  await act(async () => { render(<IpHome header={false}/>); });
  // Signed out there is no 「继续创作」 section at all, so the blank-canvas start is unreachable.
  expect(screen.queryByRole('button', { name: '创建空白画布' })).toBeNull();
  expect(api.newCanvas).not.toHaveBeenCalled();
});
