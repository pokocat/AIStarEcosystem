// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { IpHome } from './ip-home';

const api = vi.hoisted(() => ({ authed: false, create: vi.fn(), push: vi.fn(), projects: vi.fn(async () => []) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('@/proto/api', () => ({ USE_MOCK: false, auth: { isAuthed: () => api.authed } }));
vi.mock('@/shell/desktop-top-bar', () => ({ DesktopTopBar: () => null }));
vi.mock('@/ip/api', () => ({ IpStudioApi: { listProjects: api.projects } }));
vi.mock('@/ip/studio-entry', () => ({ createStudioEntry: api.create, studioEntryHref: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test.each([false, true])('home start routes to creation without writes, authenticated=%s', async authed => {
  api.authed = authed;
  await act(async () => { render(<IpHome header={false}/>); });
  const link = screen.getByRole('link', { name: '开始创作' });
  expect(link.getAttribute('href')).toBe('/create');
  link.addEventListener('click', e => e.preventDefault());
  fireEvent.click(link);
  expect(api.create).not.toHaveBeenCalled();
  expect(api.push).not.toHaveBeenCalled();
});
