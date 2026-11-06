// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CommerceStrip, DirectorProducts, productMentions, productStatus } from './director-products';
import { SettingsPanel } from './director-settings';

const api = vi.hoisted(() => ({ edit: vi.fn(), patchWork: vi.fn() }));
const studio = vi.hoisted(() => ({ uploadImage: vi.fn() }));
const lib = vi.hoisted(() => ({ libraryObjects: vi.fn(), createLibraryObject: vi.fn(), addLibraryVersion: vi.fn(), editLibraryObject: vi.fn(), deleteLibraryObject: vi.fn(), readLibraryObject: vi.fn() }));
const ask = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ DirectorApi: api, IpStudioApi: studio }));
vi.mock('@/canvas-bridge/asset-library', () => ({ ...lib, mainLibraryVersion: (o: any) => o.versions.find((v: any) => v.id === o.mainVersionId) }));
vi.mock('./director-assistant', () => ({ useAssistant: () => ({ ask }) }));
const studioApp = vi.hoisted(() => ({ modal: { confirm: vi.fn() } as { confirm: (...a: any[]) => any } }));
vi.mock('../studio-errors', async importOriginal => ({ ...(await importOriginal<object>()), useStudioApp: () => studioApp }));
vi.mock('../studio-ai-icon', () => ({ AiMark: () => null }));
vi.mock('./director-asset-studio', () => ({ AssetRefList: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const product = (over: any = {}) => ({
  id: 'p1', kind: 'product', name: '恒温保温杯', aliases: ['保温杯'], description: '316 不锈钢内胆', prompt: '', promptCustom: false, episodeIds: [], voice: null, rev: 3, libraryObjectId: 'o1', placement: '',
  image: { candidates: [{ id: 'm1', key: 'k1', url: '/1.png', runId: null, source: 'library', createdAt: '' }, { id: 'm2', key: 'k2', url: '/2.png', runId: null, source: 'library', createdAt: '' }], adoptedId: 'm1', adoptedBy: 'user', error: null },
  ...over,
});
const work = (over: any = {}): any => ({ id: 'w1', draft: '', episodes: [], assets: [], clips: [], tasks: [], settings: { style: '真人写实', aspectRatio: '9:16', commerce: true, videoModel: null }, pricing: { mock: false, image: 16 }, videoModels: [], imageModels: [], textModels: [], ...over });
const props = (w: any, more: any = {}) => ({ work: w, episodeId: null, apply: vi.fn(), setError: vi.fn(), goTab: vi.fn(), reviewExtract: vi.fn(), openSettings: vi.fn(), pickEpisode: vi.fn(), startPipeline: vi.fn(), focusClip: vi.fn(), focus: null, ...more });
const libraryObject = (id: string, name: string, over: any = {}) => ({ id, kind: 'product', name, description: `${name}说明`, prompt: '', mainVersionId: `${id}-v`, versions: [{ id: `${id}-v`, storageKey: `${id}.png`, url: `/${id}.png`, prompt: '', createdAt: '' }], sources: [], createdAt: '', updatedAt: 't1', ...over });

test('status says what is true: not written yet, written into episodes, used by clips', () => {
  const p = product();
  expect(productStatus(work({ assets: [p] }), p as any)).toEqual({ text: '生成剧本时写进剧情', tone: 'idle' });
  const draft = work({ draft: '他走进办公室。', assets: [p] });
  expect(productStatus(draft, p as any)).toEqual({ text: '剧本里还没有写到', tone: 'todo' });
  // 剧本里写简称也认得出来：别名、名字的结尾两个字以上
  expect(productMentions(work({ draft: '他拿起保温杯。' }), p as any).inDraft).toBe(true);
  expect(productMentions(work({ draft: '他拿起保温杯。' }), { ...p, aliases: [] } as any).inDraft).toBe(true);
  expect(productMentions(work({ draft: '她喷了一下香水。' }), { ...p, name: '玫瑰香水', aliases: [] } as any).inDraft).toBe(true);
  expect(productMentions(work({ draft: '她摘了一朵玫瑰。' }), { ...p, name: '玫瑰香水', aliases: [] } as any).inDraft).toBe(false);
  const eps = [{ id: 'e1', no: 1, content: '他拿起保温杯。' }, { id: 'e2', no: 2, content: '第二天。' }];
  const written = work({ episodes: eps, assets: [p] });
  expect(productStatus(written, p as any).text).toBe('已写进第 1 集');
  const used = work({ episodes: eps, assets: [p], clips: [{ id: 'c1', assetIds: ['p1'], shots: [] }, { id: 'c2', assetIds: [], shots: [] }] });
  expect(productStatus(used, p as any)).toEqual({ text: '已写进第 1 集 · 用在 1 个片段', tone: 'done' });
});

test('with no products the workspace offers the library', async () => {
  lib.libraryObjects.mockResolvedValue({ items: [], page: 0, total: 0, hasMore: false });
  render(<DirectorProducts {...props(work())}/>);
  expect(screen.getByRole('heading', { name: '还没有商品' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '添加商品' }));
  await screen.findByRole('dialog', { name: '商品库' });
  await screen.findByRole('heading', { name: '商品库还是空的' });
  expect(lib.libraryObjects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'product' }));
});

test('the placement idea saves on blur with the current revision, and only when it changed', async () => {
  const p = product(), apply = vi.fn();
  api.edit.mockResolvedValue(work({ assets: [{ ...p, placement: '加班时喝水', rev: 4 }] }));
  render(<DirectorProducts {...props(work({ assets: [p] }), { apply })}/>);
  const idea = screen.getByRole('textbox', { name: /植入想法/ });
  fireEvent.blur(idea);
  expect(api.edit).not.toHaveBeenCalled();
  fireEvent.change(idea, { target: { value: ' 加班时喝水 ' } });
  fireEvent.blur(idea);
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith('w1', 'asset.update', 'p1', 3, { placement: '加班时喝水' }));
  await waitFor(() => expect(apply).toHaveBeenCalled());
});

test('choosing another image changes which picture goes to the storyboard', async () => {
  const p = product();
  api.edit.mockResolvedValue(work({ assets: [p] }));
  render(<DirectorProducts {...props(work({ assets: [p] }))}/>);
  const group = screen.getByRole('radiogroup', { name: /选择「恒温保温杯」的参考图/ });
  fireEvent.click(within(group).getByRole('radio', { name: '第 1 张' }));
  expect(api.edit).not.toHaveBeenCalled();
  fireEvent.click(within(group).getByRole('radio', { name: '第 2 张' }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith('w1', 'asset.adopt', 'p1', null, { candidateId: 'm2' }));
});

test('writing into the script goes through the assistant, one episode at a time, and waits for the user to send', () => {
  const p = product({ placement: '加班时喝水' });
  const { unmount } = render(<DirectorProducts {...props(work({ draft: '正文', assets: [p] }))}/>);
  fireEvent.click(screen.getByRole('button', { name: '写进剧本' }));
  expect(ask).toHaveBeenCalledWith({ kind: 'script', episodeId: 'draft' }, expect.stringContaining('把商品「恒温保温杯」自然写进这一段剧情：加班时喝水'));
  expect(api.edit).not.toHaveBeenCalled();
  unmount(); ask.mockClear();
  const eps = [{ id: 'e1', no: 1, title: '开场', content: '无' }, { id: 'e2', no: 2, title: '反转', content: '他拿起保温杯' }];
  render(<DirectorProducts {...props(work({ episodes: eps, assets: [p] }))}/>);
  const menu = screen.getByRole('menu', { name: '写进哪一集', hidden: true });
  expect(within(menu).getByRole('menuitem', { name: /第 2 集 · 反转.*已写到/, hidden: true })).toBeTruthy();
  fireEvent.click(within(menu).getByRole('menuitem', { name: /第 1 集 · 开场/, hidden: true }));
  expect(ask).toHaveBeenCalledWith({ kind: 'script', episodeId: 'e1' }, expect.any(String));
});

test('the status line takes you to where the product is used', () => {
  const p = product(), focusClip = vi.fn(), goTab = vi.fn(), pickEpisode = vi.fn();
  const eps = [{ id: 'e1', no: 1, title: '开场', content: '无' }, { id: 'e2', no: 2, title: '反转', content: '他拿起保温杯' }];
  const { unmount } = render(<DirectorProducts {...props(work({ episodes: eps, assets: [p] }), { goTab, pickEpisode })}/>);
  fireEvent.click(screen.getByRole('button', { name: '已写进第 2 集' }));
  expect(pickEpisode).toHaveBeenCalledWith('e2');
  expect(goTab).toHaveBeenCalledWith('script');
  unmount();
  const clips = [{ id: 'c1', episodeId: 'e2', order: 1, title: '', assetIds: ['p1'], shots: [] }];
  render(<DirectorProducts {...props(work({ episodes: eps, assets: [p], clips }), { focusClip })}/>);
  fireEvent.click(screen.getByRole('button', { name: '已写进第 2 集 · 用在 1 个片段' }));
  expect(focusClip).toHaveBeenCalledWith({ clipId: 'c1', assetId: 'p1', open: 'assets' });
});

test('no write button before there is a script', () => {
  render(<DirectorProducts {...props(work({ assets: [product()] }))}/>);
  expect(screen.queryByRole('button', { name: '写进剧本' })).toBeNull();
  expect(screen.getByText('生成剧本时写进剧情')).toBeTruthy();
});

test('picking several products adds them to the work; ones already in the work cannot be picked again', async () => {
  const p = product(), apply = vi.fn(), w = work({ assets: [p] });
  lib.libraryObjects.mockResolvedValue({ items: [libraryObject('o1', '恒温保温杯'), libraryObject('o2', '玫瑰香水'), libraryObject('o3', '护手霜')], page: 0, total: 3, hasMore: false });
  api.edit.mockResolvedValue(w);
  render(<DirectorProducts {...props(w, { apply })}/>);
  fireEvent.click(screen.getByRole('button', { name: '从商品库添加' }));
  const dialog = await screen.findByRole('dialog', { name: '商品库' });
  const added = await within(dialog).findByRole('button', { name: '恒温保温杯，已在本剧' }) as HTMLButtonElement;
  expect(added.disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: '选择玫瑰香水' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '选择护手霜' }));
  expect(within(dialog).getByText('已选 2 件')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: '添加到本剧' }));
  await waitFor(() => expect(api.edit).toHaveBeenCalledTimes(2));
  expect(api.edit).toHaveBeenCalledWith('w1', 'product.add', null, null, { objectId: 'o2' });
  expect(api.edit).toHaveBeenCalledWith('w1', 'product.add', null, null, { objectId: 'o3' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '商品库' })).toBeNull());
  expect(apply).toHaveBeenCalledTimes(2);
});

test('a new product needs a name and an image, saves every image, and comes back selected', async () => {
  lib.libraryObjects.mockResolvedValue({ items: [], page: 0, total: 0, hasMore: false });
  studio.uploadImage.mockResolvedValueOnce({ key: 'k-a', url: '/a.png' }).mockResolvedValueOnce({ key: 'k-b', url: '/b.png' });
  lib.createLibraryObject.mockResolvedValue(libraryObject('new', '玫瑰香水', { versions: [], mainVersionId: undefined }));
  lib.addLibraryVersion.mockImplementation(async (_id: string, key: string) => libraryObject('new', '玫瑰香水', { mainVersionId: 'v-k-a', versions: key === 'k-a' ? [{ id: 'v-k-a', storageKey: 'k-a', url: '/a.png' }] : [{ id: 'v-k-a', storageKey: 'k-a', url: '/a.png' }, { id: 'v-k-b', storageKey: 'k-b', url: '/b.png' }] }));
  lib.editLibraryObject.mockImplementation(async () => libraryObject('new', '玫瑰香水', { mainVersionId: 'v-k-b', versions: [{ id: 'v-k-a', storageKey: 'k-a', url: '/a.png' }, { id: 'v-k-b', storageKey: 'k-b', url: '/b.png' }] }));
  render(<DirectorProducts {...props(work())}/>);
  fireEvent.click(screen.getByRole('button', { name: '添加商品' }));
  const dialog = await screen.findByRole('dialog', { name: '商品库' });
  await within(dialog).findByRole('heading', { name: '商品库还是空的' });
  fireEvent.click(within(dialog).getByRole('button', { name: '新建商品' }));
  const save = within(dialog).getByRole('button', { name: '保存' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  expect(within(dialog).getByText('还差：商品图、商品名称')).toBeTruthy();
  const input = within(dialog).getByLabelText('选择商品图片') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['a'], '玫瑰香水.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })] } });
  await within(dialog).findByText('主图');
  await waitFor(() => expect(within(dialog).getAllByRole('button', { name: '移除这张图' })).toHaveLength(2));
  expect((within(dialog).getByRole('textbox', { name: '商品名称' }) as HTMLInputElement).value).toBe('玫瑰香水');
  fireEvent.click(within(dialog).getByRole('button', { name: '设为主图' }));
  fireEvent.change(within(dialog).getByRole('textbox', { name: /商品说明/ }), { target: { value: '留香八小时' } });
  fireEvent.click(save);
  await waitFor(() => expect(lib.createLibraryObject).toHaveBeenCalledWith({ kind: 'product', name: '玫瑰香水', description: '留香八小时' }));
  await waitFor(() => expect(lib.addLibraryVersion).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(lib.editLibraryObject).toHaveBeenCalledWith('new', { mainVersionId: 'v-k-b' }));
  expect(await within(dialog).findByText('已选 1 件')).toBeTruthy();
});

test('leaving a form with unsaved content asks first; an untouched form just closes', async () => {
  const confirm = vi.fn();
  studioApp.modal = { confirm };
  lib.libraryObjects.mockResolvedValue({ items: [libraryObject('o1', '香水')], page: 0, total: 1, hasMore: false });
  render(<DirectorProducts {...props(work())}/>);
  fireEvent.click(screen.getByRole('button', { name: '添加商品' }));
  const dialog = await screen.findByRole('dialog', { name: '商品库' });
  await within(dialog).findByRole('button', { name: '选择香水' });
  fireEvent.click(within(dialog).getByRole('button', { name: '新建商品' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  await within(dialog).findByRole('heading', { name: '商品库' });
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: '新建商品' }));
  fireEvent.change(within(dialog).getByRole('textbox', { name: '商品名称' }), { target: { value: '留下的名字' } });
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect((within(dialog).getByRole('textbox', { name: '商品名称' }) as HTMLInputElement).value).toBe('留下的名字');
  const leave = confirm.mock.calls[0][0];
  leave.onOk(); leave.afterClose();
  await within(dialog).findByRole('heading', { name: '商品库' });
});

test('a save that fails halfway retries on the same product instead of creating a second one', async () => {
  lib.libraryObjects.mockResolvedValue({ items: [], page: 0, total: 0, hasMore: false });
  studio.uploadImage.mockResolvedValue({ key: 'k-a', url: '/a.png' });
  lib.createLibraryObject.mockResolvedValue(libraryObject('new', '香水', { versions: [], mainVersionId: undefined }));
  lib.addLibraryVersion.mockRejectedValueOnce(new Error('网络断了')).mockResolvedValue(libraryObject('new', '香水', { mainVersionId: 'v', versions: [{ id: 'v', storageKey: 'k-a', url: '/a.png' }] }));
  lib.editLibraryObject.mockResolvedValue(libraryObject('new', '香水', { versions: [], mainVersionId: undefined }));
  render(<DirectorProducts {...props(work())}/>);
  fireEvent.click(screen.getByRole('button', { name: '添加商品' }));
  const dialog = await screen.findByRole('dialog', { name: '商品库' });
  await within(dialog).findByRole('heading', { name: '商品库还是空的' });
  fireEvent.click(within(dialog).getByRole('button', { name: '新建商品' }));
  fireEvent.change(within(dialog).getByLabelText('选择商品图片'), { target: { files: [new File(['a'], '香水.png', { type: 'image/png' })] } });
  await within(dialog).findByText('主图');
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await within(dialog).findByText(/网络断了/);
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(lib.addLibraryVersion).toHaveBeenCalledTimes(2));
  expect(lib.createLibraryObject).toHaveBeenCalledTimes(1);
});

test('retrying a failed edit does not trip over its own earlier save', async () => {
  const p = product(), first = libraryObject('o1', '恒温保温杯');
  lib.readLibraryObject.mockResolvedValue(first);
  lib.editLibraryObject.mockResolvedValue({ ...first, updatedAt: 't2' });
  lib.addLibraryVersion.mockRejectedValueOnce(new Error('网络断了')).mockResolvedValue({ ...first, updatedAt: 't3' });
  studio.uploadImage.mockResolvedValue({ key: 'k-new', url: '/new.png' });
  api.edit.mockResolvedValue(work({ assets: [p] }));
  render(<DirectorProducts {...props(work({ assets: [p] }))}/>);
  fireEvent.click(within(screen.getByRole('menu', { hidden: true })).getByRole('menuitem', { name: '在商品库编辑', hidden: true }));
  const dialog = await screen.findByRole('dialog', { name: '编辑商品' });
  fireEvent.change(within(dialog).getByLabelText('选择商品图片'), { target: { files: [new File(['a'], 'n.png', { type: 'image/png' })] } });
  await waitFor(() => expect(within(dialog).getAllByRole('button', { name: '移除这张图' })).toHaveLength(2));
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await within(dialog).findByText(/网络断了/);
  expect(lib.editLibraryObject).toHaveBeenLastCalledWith('o1', expect.objectContaining({ updatedAt: 't1' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(lib.addLibraryVersion).toHaveBeenCalledTimes(2));
  expect(lib.editLibraryObject.mock.calls[1][1]).not.toHaveProperty('updatedAt');
});

test('the strip on the script page lists the products, or warns when there are none, and stays away when the switch is off', () => {
  const goTab = vi.fn();
  const { rerender, container } = render(<CommerceStrip work={work()} goTab={goTab}/>);
  expect(screen.getByText('还没有添加商品，生成的剧本不会植入商品。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '添加商品' }));
  expect(goTab).toHaveBeenCalledWith('products');
  rerender(<CommerceStrip work={work({ assets: [product()] })} goTab={goTab}/>);
  expect(screen.getByText('恒温保温杯')).toBeTruthy();
  expect(screen.getByText('写进剧情的商品')).toBeTruthy();
  rerender(<CommerceStrip work={work({ settings: { commerce: false }, assets: [product()] })} goTab={goTab}/>);
  expect(container.textContent).toBe('');
});

test('settings only send the switch when it changed, and explain what turning it off keeps', async () => {
  const w = work({ assets: [product()] });
  api.patchWork.mockResolvedValue(w);
  const { unmount } = render(<SettingsPanel work={w} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(api.patchWork).toHaveBeenCalled());
  expect(api.patchWork.mock.calls[0][1].settings).not.toHaveProperty('commerce');
  unmount(); api.patchWork.mockClear();
  render(<SettingsPanel work={w} apply={vi.fn()} onClose={vi.fn()} setError={vi.fn()}/>);
  fireEvent.click(screen.getByRole('switch', { name: '带货短剧' }));
  expect(screen.getByText(/已加入的商品和已写好的片段保持不变/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(api.patchWork.mock.calls[0][1].settings.commerce).toBe(false));
});

test('the workspace only appears behind the switch (§8.0.1 ⑥)', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ip/director/director-workbench.tsx'), 'utf8');
  expect(src).toMatch(/\.\.\.\(commerce \? \[\["products", "商品", ShoppingBag\]\]/);
  expect(src).toMatch(/tab === "products" && commerce && <DirectorProducts/);
  const script = readFileSync(resolve(process.cwd(), 'src/ip/director/director-script.tsx'), 'utf8');
  expect(script).toMatch(/<CommerceStrip work=/);
  const assets = readFileSync(resolve(process.cwd(), 'src/ip/director/director-assets.tsx'), 'utf8');
  expect(assets).toMatch(/const scoped = work\.assets\.filter\(a => a\.kind !== "product"\)/);
});
