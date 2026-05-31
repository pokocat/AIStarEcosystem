import { describe, it, expect, beforeAll } from "vitest";
import { applyBeauty, isBeautyNeutral, BEAUTY_NEUTRAL, type BeautyParams } from "./beauty";

// Node 无 DOM ImageData：最小 polyfill（与 face-warp.test 同款）。
beforeAll(() => {
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
    (globalThis as { ImageData: unknown }).ImageData = class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(a: number | Uint8ClampedArray, b: number, c?: number) {
        if (typeof a === "number") {
          this.width = a;
          this.height = b;
          this.data = new Uint8ClampedArray(a * b * 4);
        } else {
          this.data = a;
          this.width = b;
          this.height = c!;
        }
      }
    };
  }
});

/** 一张肤色调子的噪声图（YCbCr 落在肤色簇内）。 */
function skinNoise(w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (i * 2654435761) % 40;
    img.data[i] = 200 + n - 20; // R 高
    img.data[i + 1] = 150 + ((n * 3) % 30) - 15; // G 中
    img.data[i + 2] = 130 + ((n * 7) % 30) - 15; // B 低
    img.data[i + 3] = 255;
  }
  return img;
}

function diffCount(a: ImageData, b: ImageData): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  }
  return n;
}

function variance(img: ImageData): number {
  let sum = 0,
    sum2 = 0,
    n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i];
    sum += v;
    sum2 += v * v;
    n++;
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

describe("beauty 美颜（真实确定性算法）", () => {
  it("中性参数近似恒等", () => {
    const src = skinNoise(64, 64);
    const out = applyBeauty(src, BEAUTY_NEUTRAL);
    expect(diffCount(src, out)).toBe(0);
  });

  it("磨皮降低肤色区域噪声方差（保边平滑）", () => {
    const src = skinNoise(64, 64);
    const out = applyBeauty(src, { ...BEAUTY_NEUTRAL, smooth: 90 });
    expect(variance(out)).toBeLessThan(variance(src));
  });

  it("美白提升肤色像素亮度", () => {
    const src = skinNoise(48, 48);
    const out = applyBeauty(src, { ...BEAUTY_NEUTRAL, whiten: 80 });
    let before = 0,
      after = 0;
    for (let i = 0; i < src.data.length; i += 4) {
      before += src.data[i] + src.data[i + 1] + src.data[i + 2];
      after += out.data[i] + out.data[i + 1] + out.data[i + 2];
    }
    expect(after).toBeGreaterThan(before);
  });

  it("确定性：同输入两次一致", () => {
    const src = skinNoise(40, 40);
    const p: BeautyParams = { smooth: 50, whiten: 30, warmth: 40, brightness: 60 };
    expect(diffCount(applyBeauty(src, p), applyBeauty(src, p))).toBe(0);
  });

  it("亮度提升整体变亮", () => {
    const src = skinNoise(32, 32);
    const out = applyBeauty(src, { ...BEAUTY_NEUTRAL, brightness: 80 });
    expect(out.data[0]).toBeGreaterThanOrEqual(src.data[0]);
  });

  it("isBeautyNeutral 判定", () => {
    expect(isBeautyNeutral(BEAUTY_NEUTRAL)).toBe(true);
    expect(isBeautyNeutral({ ...BEAUTY_NEUTRAL, smooth: 1 })).toBe(false);
  });
});
