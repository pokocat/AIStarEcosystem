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

test('example openers fill the box without sending; in the new version they sit under the box and there is no charge note (2026-10-31 redesign)', () => {
  document.documentElement.setAttribute('data-ui', 'next');
  try {
    const onStart = vi.fn();
    render(<StudioConversationStart onStart={onStart} compact/>);
    fireEvent.click(screen.getByRole('button', { name: '复刻一条短视频' }));
    expect(box().value).toContain('照这条视频的拍法');
    expect(onStart).not.toHaveBeenCalled();
    // 新版：常用开头在框外面一排，框里只有输入和发送；花钱的地方会先报价，这里不写扣费说明。
    expect(document.querySelector('.studio-conversation-start-box .studio-conversation-start-examples')).toBeNull();
    expect(document.querySelector('.studio-conversation-start > .studio-conversation-start-examples')).not.toBeNull();
    expect(screen.queryByText(/按实际用量扣少量积分/)).toBeNull();
    expect(screen.queryByRole('button', { name: '先进画布看看' })).toBeNull();
  } finally { document.documentElement.removeAttribute('data-ui'); }
});

test('while a canvas is being created nothing can be sent twice', () => {
  const onStart = vi.fn();
  render(<StudioConversationStart onStart={onStart} creating/>);
  fireEvent.change(box(), { target: { value: '写一段短剧' } });
  fireEvent.keyDown(box(), { key: 'Enter' });
  expect(onStart).not.toHaveBeenCalled();
  expect(box().disabled).toBe(true);
});
