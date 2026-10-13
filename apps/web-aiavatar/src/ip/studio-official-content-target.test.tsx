// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { IpDemoAdmin } from '@ai-star-eco/types';
import { StudioOfficialContentTarget } from './studio-official-content-target';
afterEach(cleanup);
const items = [
  { id: 'example', name: '角色成片示例', kind: 'example', enabled: true },
  { id: 'legacy', name: '旧画布骨架', kind: 'template', enabled: true },
  { id: 'recipe', name: '多视角 IP 配方', kind: 'template', currentVersionId: 'v1', enabled: true },
] as IpDemoAdmin[];
test('published recipes are visibly unavailable for overwriting and offer the version publishing route', () => {
  const onChange = vi.fn(), onVersion = vi.fn();
  render(<StudioOfficialContentTarget items={items} value="" disabled={false} onChange={onChange} onVersion={onVersion}/>);
  expect((screen.getByRole('option', { name: '多视角 IP 配方 · 版本化模板' }) as HTMLOptionElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: '保存位置' }), { target: { value: 'recipe' } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '发布模板新版本' })); expect(onVersion).toHaveBeenCalledOnce();
});
test('ordinary examples, legacy skeletons and new content keep their original save choices', () => {
  const onChange = vi.fn(); render(<StudioOfficialContentTarget items={items} value="" disabled={false} onChange={onChange} onVersion={vi.fn()}/>);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'example' } }); expect(onChange).toHaveBeenLastCalledWith(items[0]);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'legacy' } }); expect(onChange).toHaveBeenLastCalledWith(items[1]);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } }); expect(onChange).toHaveBeenLastCalledWith(undefined);
});
