import { expect, test } from 'vitest';
import { heifPrimaryColorSpace } from './heif-color-space';

const join = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, b) => sum + b.length, 0));
  let pos = 0; for (const part of parts) { result.set(part, pos); pos += part.length; } return result;
};
const box = (name: string, payload: Uint8Array) => {
  const result = new Uint8Array(8 + payload.length); new DataView(result.buffer).setUint32(0, result.length);
  result.set(new TextEncoder().encode(name), 4); result.set(payload, 8); return result;
};
function example(primary = 1) {
  const colr = (primaries: number) => box('colr', join(new TextEncoder().encode('nclx'), new Uint8Array([0, primaries, 0, 13, 0, 0, 128])));
  // The thumbnail has an sRGB profile while the primary photo has P3. Property association, not first colr, decides.
  const ipco = box('ipco', join(colr(1), colr(12)));
  const ipma = box('ipma', new Uint8Array([0,0,0,0, 0,0,0,2, 0,1,1,2, 0,2,1,1]));
  return box('meta', join(new Uint8Array(4), box('pitm', new Uint8Array([0,0,0,0,0,primary])), box('iprp', join(ipco,ipma))));
}
test('the primary image color property determines P3, independently of thumbnail property order', () => {
  expect(heifPrimaryColorSpace(example(1))).toBe('display-p3');
  expect(heifPrimaryColorSpace(example(2))).toBe('srgb');
});
test('absent or truncated color metadata does not prevent image decoding', () => {
  expect(heifPrimaryColorSpace(new Uint8Array())).toBe('srgb');
  expect(heifPrimaryColorSpace(example().subarray(0, 40))).toBe('srgb');
});
