// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { StudioConversationStart } from './studio-conversation-start';

afterEach(cleanup);
const box = () => screen.getByRole('textbox', { name: '想做什么' }) as HTMLTextAreaElement;

test('a brief goes out on 「开始对话」 or Enter; Shift+Enter keeps writing; an empty box cannot start a conversation', () => {
  const onStart = vi.fn();
  render(<StudioConversationStart onStart={onStart}/>);
  expect((screen.getByRole('button', { name: '开始对话' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(box(), { target: { value: '把商品换成我的保温杯' } });
  fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.keyDown(box(), { key: 'Enter' });
  expect(onStart).toHaveBeenCalledWith('把商品换成我的保温杯');
  fireEvent.click(screen.getByRole('button', { name: '开始对话' }));
  expect(onStart).toHaveBeenCalledTimes(2);
});

test('example openers fill the box without sending; no idea yet points to 灵感 and 专项创作, not an empty canvas', () => {
  const onStart = vi.fn();
  render(<StudioConversationStart onStart={onStart} compact/>);
  fireEvent.click(screen.getByRole('button', { name: '复刻一条短视频' }));
  expect(box().value).toContain('照这条视频的拍法');
  expect(onStart).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: '灵感' }).getAttribute('href')).toBe('/templates');
  expect(screen.getByRole('link', { name: '专项创作' }).getAttribute('href')).toBe('/scenes');
  expect(screen.queryByRole('button', { name: '先进画布看看' })).toBeNull();
});

test('while a canvas is being created nothing can be sent twice', () => {
  const onStart = vi.fn();
  render(<StudioConversationStart onStart={onStart} creating/>);
  fireEvent.change(box(), { target: { value: '写一段短剧' } });
  fireEvent.keyDown(box(), { key: 'Enter' });
  expect(onStart).not.toHaveBeenCalled();
  expect(box().disabled).toBe(true);
});
