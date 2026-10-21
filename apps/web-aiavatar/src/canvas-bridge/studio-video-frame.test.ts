import { expect, test } from 'vitest';
import { formatFrameTime, framePositionLabel, frameSeekTime } from './studio-video-frame';

test('frame times read like a player and the last frame stays inside the clip', () => {
  expect(formatFrameTime(5.4)).toBe('00:05');
  expect(formatFrameTime(72.9)).toBe('01:12');
  expect(formatFrameTime(3723)).toBe('1:02:03');
  expect(formatFrameTime(Number.NaN)).toBe('00:00');
  expect(framePositionLabel('first')).toBe('首帧');
  expect(framePositionLabel('last')).toBe('尾帧');
  expect(framePositionLabel('current', 5.4)).toBe('当前帧 00:05');
  expect(frameSeekTime('first', 10, 4)).toBe(0);
  expect(frameSeekTime('last', 10)).toBeCloseTo(9.95);
  expect(frameSeekTime('current', 10, 4)).toBe(4);
  expect(frameSeekTime('current', 10, 12)).toBeCloseTo(9.95);
  expect(frameSeekTime('last', Number.NaN)).toBe(0);
});
