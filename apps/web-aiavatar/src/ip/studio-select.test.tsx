// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StudioSelect } from './studio-select';
import { setupRadixSelectDom } from './testing/radix-select-dom';

setupRadixSelectDom();
afterEach(cleanup);
const options = [{value:'',label:'全部'},{value:'draft',label:'草稿'},{value:'published',label:'已发布',disabled:true}];

test('uses a DOM listbox, supports empty values and restores focus after keyboard dismissal', async () => {
  const change = vi.fn();
  function Harness() {
    const [value,setValue] = useState('draft');
    return <div data-studio-overlay-root><StudioSelect label="状态" value={value} options={options} onChange={v => {setValue(v);change(v);}}/></div>;
  }
  render(<Harness/>);
  const trigger = screen.getByRole('combobox',{name:'状态'});
  expect(trigger.tagName).toBe('BUTTON');
  fireEvent.keyDown(trigger,{key:'ArrowDown'});
  const menu = await screen.findByRole('listbox');
  expect(menu.closest('[data-studio-overlay-root]')).toBeTruthy();
  expect(screen.getByRole('option',{name:'已发布'}).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('option',{name:'全部'}));
  expect(change).toHaveBeenCalledWith('');
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  fireEvent.keyDown(trigger,{key:'ArrowDown'});
  await screen.findByRole('listbox');
  fireEvent.keyDown(document.activeElement!,{key:'Escape'});
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(change).toHaveBeenCalledTimes(1);
});

test('does not open a disabled control', () => {
  render(<StudioSelect label="状态" value="" options={options} onChange={vi.fn()} disabled/>);
  const trigger = screen.getByRole('combobox',{name:'状态'});
  expect(trigger.hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(trigger,{key:'ArrowDown'});
  expect(screen.queryByRole('listbox')).toBeNull();
});
