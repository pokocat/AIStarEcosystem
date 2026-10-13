// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { StudioMediaGenerationState } from './studio-media-generation-state';

afterEach(cleanup);

test.each(['image','video'] as const)('a running %s task shows centered visual feedback and its real progress', media => {
  const label=media==='video'?'视频':'图片';
  render(<StudioMediaGenerationState media={media} confirmed task={{ status: 'running', stage: 'generating', pct: 10 }}/>);
  expect(screen.getByRole('status').textContent).toContain(`正在生成${label}`);
  expect(screen.getByRole('progressbar', { name: `${label}任务进度` }).getAttribute('aria-valuenow')).toBe('10');
  expect(screen.getByText('10%')).toBeDefined();
});

test('queue and unconfirmed submission do not show misleading percentages', () => {
  const queued = render(<StudioMediaGenerationState media="video" confirmed task={{ status: 'running', stage: 'queued', pct: 10, queue: { position: 3, running: 1 } }}/>);
  expect(screen.getByRole('status').textContent).toContain('等待生成视频');
  expect(screen.getByRole('status').textContent).toContain('第 3 位');
  expect(screen.queryByRole('progressbar')).toBeNull();
  queued.unmount();

  render(<StudioMediaGenerationState media="video" confirmed={false}/>);
  expect(screen.getByRole('status').textContent).toContain('正在确认生成任务');
  expect(screen.queryByRole('progressbar')).toBeNull();
});
