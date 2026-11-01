/** Original short reading sample. Timing is a visual pace guide, not speech recognition.
 * Commas and sentence ends hold the highlight longer to allow natural breath pauses. */
export const RECORDING_LINES = [
  '清晨的阳光，轻轻落在窗边。',
  '我端起温水，听见远处的鸟鸣。',
  '放慢脚步，让今天多一点惊喜。',
];
export type ReadingPace = 'natural' | 'relaxed';
const weights = Array.from(RECORDING_LINES.join('')).map(c => /[。？！]/.test(c) ? 2.4 : /[，、；]/.test(c) ? 1.8 : 1);
const total = weights.reduce((a, b) => a + b, 0);

export function readingCue(seconds: number, pace: ReadingPace): { read: number; current: number } {
  if (seconds < .5) return { read: 0, current: -1 };
  const position = Math.max(0, (seconds - .5) / (pace === 'relaxed' ? 13.5 : 11.5)) * total;
  let end = 0;
  for (let i = 0; i < weights.length; i++) {
    end += weights[i];
    if (position < end) return { read: i, current: i };
  }
  return { read: weights.length, current: -1 };
}
