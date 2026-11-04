import { expect, test } from 'vitest';
import { readingCue, RECORDING_LINES } from './recording-guide';

test('both paces complete within the fifteen-second suggestion, with a quiet lead-in', () => {
  for (const pace of ['natural', 'relaxed'] as const) {
    expect(readingCue(0, pace)).toEqual({ read: 0, current: -1 });
    expect(readingCue(14, pace)).toEqual({ read: Array.from(RECORDING_LINES.join('')).length, current: -1 });
  }
  expect(readingCue(6, 'natural').read).toBeGreaterThan(readingCue(6, 'relaxed').read);
});
