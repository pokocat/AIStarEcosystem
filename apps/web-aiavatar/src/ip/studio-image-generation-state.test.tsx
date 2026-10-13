// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { StudioImageGenerationState } from './studio-image-generation-state';

afterEach(cleanup);

test('shows a centered generation state with the reported progress', () => {
  render(<StudioImageGenerationState confirmed task={{ status: 'running', stage: 'generating', pct: 10 }}/>);
  expect(screen.getByRole('status').textContent).toContain('正在生成图片');
  expect(screen.getByRole('progressbar', { name: '图片任务进度' }).getAttribute('aria-valuenow')).toBe('10');
  expect(screen.getByText('10%')).toBeDefined();
});

test('queue and unconfirmed submission do not show misleading percentages', () => {
  const queued = render(<StudioImageGenerationState confirmed task={{ status: 'running', stage: 'queued', pct: 10, queue: { position: 3, running: 1 } }}/>);
  expect(screen.getByRole('status').textContent).toContain('等待生成图片');
  expect(screen.getByRole('status').textContent).toContain('第 3 位');
  expect(screen.queryByRole('progressbar')).toBeNull();
  queued.unmount();

  render(<StudioImageGenerationState confirmed={false}/>);
  expect(screen.getByRole('status').textContent).toContain('正在确认生成任务');
  expect(screen.queryByRole('progressbar')).toBeNull();
});
