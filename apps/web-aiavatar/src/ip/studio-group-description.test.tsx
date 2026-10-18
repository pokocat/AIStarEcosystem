// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioGroupDescription } from './studio-group-description';
import { ConfigProvider } from 'antd';
afterEach(cleanup);
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });

test('notes support explicit save, cancellation and clearing without becoming text nodes', async () => {
  const change = vi.fn();
  render(<ConfigProvider theme={{ token: { motion: false } }}><StudioGroupDescription title="换人生成" description={'原说明\n操作步骤'} onChange={change}/></ConfigProvider>);
  expect(screen.getByRole('button', { name: '编辑分组说明：换人生成' }).textContent).toContain('原说明');
  fireEvent.click(screen.getByRole('button', { name: '编辑分组说明：换人生成' }));
  fireEvent.change(screen.getByRole('textbox', { name: '分组说明' }), { target: { value: '不保存' } });
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
  expect(change).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '编辑分组说明：换人生成' }));
  expect(screen.getByRole('textbox', { name: '分组说明' })).toHaveProperty('value', '原说明\n操作步骤');
  fireEvent.change(screen.getByRole('textbox', { name: '分组说明' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '保存说明' }));
  expect(change).toHaveBeenCalledExactlyOnceWith('');
});
test('read-only templates show complete notes but never expose an editor', () => {
  const description = '参考原片\n替换人物\n保持原声\n完整第四行';
  render(<StudioGroupDescription title="原声成片" description={description}/>);
  fireEvent.click(screen.getByRole('button', { name: '查看分组说明：原声成片' }));
  expect(screen.getByRole('dialog').textContent).toContain('完整第四行');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.queryByRole('button', { name: '保存说明' })).toBeNull();
});
