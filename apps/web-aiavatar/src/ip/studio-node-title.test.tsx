// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StudioNodeTitle } from './studio-node-title';
afterEach(cleanup);

test('double clicking a title edits inline without opening the content panel', () => {
  const rename = vi.fn(), open = vi.fn();
  render(<div onDoubleClick={open}><StudioNodeTitle title="原名称" onRename={rename}/></div>);
  fireEvent.doubleClick(screen.getByRole('button', { name: '重命名节点 原名称' }));
  const input = screen.getByRole('textbox', { name: '节点名称' });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: '  新名称  ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(rename).toHaveBeenCalledExactlyOnceWith('新名称');
  expect(open).not.toHaveBeenCalled();
});
test('Escape cancels and empty names preserve the saved title', () => {
  const rename = vi.fn(); render(<StudioNodeTitle title="原名称" onRename={rename}/>);
  fireEvent.doubleClick(screen.getByRole('button'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '取消修改' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
  fireEvent.doubleClick(screen.getByRole('button'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
  fireEvent.blur(screen.getByRole('textbox'));
  expect(rename).not.toHaveBeenCalled(); expect(screen.getByRole('button').textContent).toBe('原名称');
});
test('blur commits once and keyboard editing leaves read-only titles inert', () => {
  const rename = vi.fn(); const view = render(<StudioNodeTitle title="原名称" onRename={rename}/>);
  fireEvent.keyDown(screen.getByRole('button'), { key: 'F2' });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '新名称' } });
  fireEvent.blur(screen.getByRole('textbox')); expect(rename).toHaveBeenCalledExactlyOnceWith('新名称');
  view.rerender(<StudioNodeTitle title="只读标题"/>);
  fireEvent.doubleClick(screen.getByText('只读标题')); expect(screen.queryByRole('textbox')).toBeNull();
});
