// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { IpHome } from './ip-home';

const api = vi.hoisted(() => ({ authed: false, create: vi.fn(), push: vi.fn(), newCanvas: vi.fn(), projects: vi.fn(async (): Promise<unknown[]> => []),
  templates: vi.fn(async (): Promise<unknown[]> => []), examples: vi.fn(async (): Promise<unknown[]> => []),
  // 首页卡片由运营配，公开接口读：这里照接口形状给两张。
  cards: vi.fn(async () => [
    { id: 'commerce', title: '电商带货', description: '商品展示和带货短视频', sceneId: 'ecom-talking', kind: 'video', covers: [{ sceneId: 'ecom-talking', coverUrl: 'https://cdn/ops-cover.webp' }, { sceneId: 'ecom-seeding' }] },
    { id: 'product-set', title: '商品套图', description: '白底图、卖点图一起出', sceneId: 'white-background', kind: 'image', covers: [{ sceneId: 'white-background' }] },
  ]) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('@/proto/api', () => ({ USE_MOCK: false, auth: { isAuthed: () => api.authed } }));
vi.mock('@/shell/desktop-top-bar', () => ({ DesktopTopBar: () => null }));
vi.mock('@/ip/api', () => ({ IpStudioApi: { listProjects: api.projects, listTemplates: api.templates, listDemoExamples: api.examples, sceneHomeCards: api.cards } }));
vi.mock('@/ip/studio-entry', () => ({ createStudioEntry: api.create, studioEntryHref: vi.fn(), startNewCanvas: api.newCanvas }));
vi.mock('@/ip/studio-template-use', () => ({ StudioTemplateUse: ({ template }: { template: { name: string } }) => <div role="dialog" aria-label={`预览 ${template.name}`}/> }));
// 这个文件测新版首页（`?ui=new` 之后）；默认的旧版首页见 ip-home-classic.test.tsx。
beforeEach(() => { document.documentElement.setAttribute('data-ui', 'next'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); document.documentElement.removeAttribute('data-ui'); });

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

// docs/studio-scene-creation.md §3: tools open a page or a canvas with that panel; goals go to the scene pages.
test('tools and goals: 导演台 is a page, 人物配音 opens a canvas with its panel, goals link to the scene pages', async () => {
  api.authed = true;
  api.create.mockResolvedValue({ id: 'p1' });
  await act(async () => { render(<IpHome header={false}/>); });
  const tools = within(screen.getByRole('navigation', { name: '常用工具' }));
  await act(async () => { fireEvent.click(tools.getByRole('button', { name: '导演台' })); });
  expect(api.push).toHaveBeenCalledWith('/director');
  expect(api.create).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(tools.getByRole('button', { name: '人物配音' })); });
  expect(api.create).toHaveBeenCalledWith('speech');
  expect(screen.getByRole('link', { name: /电商带货/ }).getAttribute('href')).toBe('/video?scene=ecom-talking');
  expect(screen.getByRole('link', { name: /商品套图/ }).getAttribute('href')).toBe('/image?scene=white-background');
  // 运营传了封面就用它，没传的按场景编号用随包封面。
  const art = screen.getByRole('link', { name: /电商带货/ }).querySelectorAll('img');
  expect([...art].map(img => img.getAttribute('src'))).toEqual(['https://cdn/ops-cover.webp', '/studio/scene-covers/ecom-seeding.webp']);
});

// 灵感 moved onto Home: official templates and examples, filtered by what they contain; opening one previews it.
test('灵感 lists templates and examples on Home, filters by content and opens the read-only preview', async () => {
  api.authed = true;
  const doc = (type: string) => ({ nodes: [{ id: 'n', type, title: 't', position: { x: 0, y: 0 }, width: 10, height: 10, metadata: { storageKey: 'k', content: 'u' } }], connections: [], viewport: { x: 0, y: 0, k: 1 } });
  api.examples.mockResolvedValue([{ id: 'e1', name: '带货成片', summary: '', lookCount: 0, estimatedCredits: 0, doc: doc('video') }]);
  api.templates.mockResolvedValue([{ id: 't1', name: '商品主图', summary: '', lookCount: 0, estimatedCredits: 0, doc: doc('image') },
    { id: 't2', name: '我的流程', summary: '', lookCount: 0, estimatedCredits: 0, visibility: 'personal', doc: doc('image') }]);
  await act(async () => { render(<IpHome header={false}/>); });
  expect(screen.getByRole('button', { name: '预览模板 带货成片' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '预览模板 商品主图' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '预览模板 我的流程' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '图片' }));
  expect(screen.queryByRole('button', { name: '预览模板 带货成片' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '预览模板 商品主图' }));
  expect(screen.getByRole('dialog', { name: '预览 商品主图' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /更多灵感/ }).getAttribute('href')).toBe('/templates');
});
