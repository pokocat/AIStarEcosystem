// @vitest-environment jsdom
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AvatarLibrary, VoiceLibrary } from './supplementary-asset-library';
import type { Avatar, License, StarGrant, VoiceAsset } from '@/proto/data';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('./library-grid-motion', () => ({ LibraryGridMotion: ({ children }: any) => <div>{children}</div> }));
vi.mock('antd', () => ({
  Button: ({ icon, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, ...p }: any) => <input {...p}/>,
  Select: ({ options, onChange, value, ...p }: any) => <select value={value} onChange={e => onChange(e.target.value)} {...p}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>,
}));
const ready = <T,>(data: T) => ({ data, loading: false, error: null });
const avatar = (id: string, name: string, path: 'ai' | 'real') => ({ id, name, path, archetype: '画家', status: 'finalized', versions: 2, updated: '2026-10-12' } as Avatar);
const grant = (status: 'authorized' | 'expired') => ({ id: `g-${status}`, starName: '授权人物', starId: 's-1', scenes: ['带货'], status } as StarGrant);
const voice = (id: string, kind: VoiceAsset['kind'] = 'clone', lang = '中文') => ({ id, name: `声音${id}`, kind, lang, gender: '女声', tone: '温暖', dur: '00:10', wave: [] } as VoiceAsset);
afterEach(cleanup);

test('avatar categories and search preserve each real asset destination and hide expired grants', () => {
  render(<AvatarLibrary avatars={ready([avatar('a', 'AI画家', 'ai'), avatar('b', '真人画家', 'real')])} licenses={ready([])} grants={ready([grant('authorized'), grant('expired')])} refresh={vi.fn()}/>);
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getByRole('link', { name: '查看形象 授权人物' }).getAttribute('href')).toBe('/stars/g-authorized');
  fireEvent.click(screen.getByRole('button', { name: /真人形象/ }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '查看形象 真人画家' }).getAttribute('href')).toBe('/assets/b');
  fireEvent.change(screen.getByRole('textbox', { name: '搜索人物形象' }), { target: { value: '不存在' } });
  expect(screen.getByText('没有找到匹配资产')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
});

test('failed grants do not hide successful avatars and unknown licenses do not become pending', () => {
  const refresh = vi.fn();
  render(<AvatarLibrary avatars={ready([avatar('b', '真人画家', 'real')])} licenses={{ ...ready([] as License[]), error: '授权超时' }} grants={{ ...ready([] as StarGrant[]), error: '读取超时' }} refresh={refresh}/>);
  expect(screen.getByRole('article', { name: '人物形象 真人画家' })).toBeDefined();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByText('授权信息暂不可用')).toBeDefined();
  expect(screen.queryByText('待完成授权')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
  expect(refresh).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: /真人形象/ }));
  expect(screen.getByRole('alert').textContent).toContain('明星授权读取失败'); // Notifications remain until dismissed; the recovered library is usable.
  expect(screen.getByText('1 项匹配资产')).toBeDefined();
});

test('real avatar license status remains accurate on redesigned cards', () => {
  render(<AvatarLibrary avatars={ready([avatar('b', '真人画家', 'real')])} licenses={ready([{ char: 'b', status: 'expired' } as License])} grants={ready([])} refresh={vi.fn()}/>);
  expect(screen.getByText('授权已到期')).toBeDefined();
  expect(screen.queryByText('授权有效')).toBeNull();
});

test('voice pagination, category and language filters include all saved voices without playback calls', () => {
  render(<VoiceLibrary voices={ready([...Array.from({ length: 25 }, (_, i) => voice(String(i + 1))), voice('设计', 'design', '英文')])} refresh={vi.fn()}/>);
  expect(screen.getAllByRole('article')).toHaveLength(24);
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getByRole('article', { name: '专属声音 声音25' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /设计声/ }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('1 / 1')).toBeDefined();
  fireEvent.change(screen.getByRole('combobox', { name: '声音语言' }), { target: { value: '中文' } });
  expect(screen.getByText('没有找到匹配资产')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(screen.getAllByRole('article')).toHaveLength(24);
  expect(document.querySelector('audio')).toBeNull();
});

test('voice load failure is a single retryable error rather than an empty asset library', () => {
  render(<VoiceLibrary voices={{ ...ready([] as VoiceAsset[]), error: '网络不可用' }} refresh={vi.fn()}/>);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByText('专属声音暂不可读取')).toBeDefined();
  expect(screen.queryByText('还没有专属声音')).toBeNull();
  expect(screen.getByRole('button', { name: '重新读取资产' })).toBeDefined();
});

beforeEach(() => { mountStudioErrorNotifications(); });
