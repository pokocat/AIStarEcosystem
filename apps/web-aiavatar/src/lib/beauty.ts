// ─────────────────────────────────────────────────────────────────────────────
// lib/beauty.ts — 真实客户端美颜 / 质感（确定性、可实时）。
//
// 任务书 §4「美颜/质感」首选 GFPGAN/CodeFormer（服务端修复模型）+ 经典美白磨皮。
// 重型修复走后端 restore Provider（异步任务）；这里实现「经典美白磨皮」那一半的
// 真实前端算法，让模板美化 / 精调的美颜滑块即时可见、确定性、离线可跑：
//   1. 磨皮：可分离 box-blur（近似双边）→ 仅在肤色像素上按强度与原图混合（保边）。
//   2. 美白：肤色像素向白提亮（luma lift）。
//   3. 暖色：R↑ / B↓ 微调色温。
//   4. 亮度：线性提亮。
//
// 评估过开源 Banuba/beauty-web：其 Web SDK 需 client token（商用授权），无 token 无法
// 运行，故采用本算法作为「可离线、可商用」的真实美颜路径（见 DECISIONS.md §B）。
// 与 face-warp.ts 同为纯函数 + 浏览器便捷封装，可单测。
// ─────────────────────────────────────────────────────────────────────────────

export interface BeautyParams {
  /** 磨皮强度 0–100。 */
  smooth: number;
  /** 美白强度 0–100。 */
  whiten: number;
  /** 暖色色温 0–100。 */
  warmth: number;
  /** 亮度 0–100（50=中性）。 */
  brightness: number;
}

export const BEAUTY_NEUTRAL: BeautyParams = { smooth: 0, whiten: 0, warmth: 0, brightness: 50 };

export function isBeautyNeutral(p: BeautyParams): boolean {
  return p.smooth === 0 && p.whiten === 0 && p.warmth === 0 && p.brightness === 50;
}

/** 简易肤色判定（YCbCr 经验范围）。返回 0–1 的肤色权重。 */
function skinWeight(r: number, g: number, b: number): number {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  // 经典肤色簇范围 + 软边界。
  const inCb = cb > 77 && cb < 135;
  const inCr = cr > 133 && cr < 180;
  if (inCb && inCr) return 1;
  // 软衰减：靠近范围中心给部分权重，避免硬边界。
  const dCb = Math.min(Math.abs(cb - 106) / 40, 1);
  const dCr = Math.min(Math.abs(cr - 156) / 30, 1);
  const w = 1 - Math.max(dCb, dCr);
  return Math.max(0, w * 0.6);
}

/** 可分离 box-blur（半径 r），返回新数组（RGB；A 直接拷贝）。 */
function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  if (r < 1) return data.slice();
  const tmp = new Float32Array(data.length);
  const out = new Uint8ClampedArray(data.length);
  const win = r * 2 + 1;
  // 横向
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        const xx = Math.max(0, Math.min(w - 1, x));
        sum += data[(y * w + xx) * 4 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / win;
        const xOut = Math.max(0, Math.min(w - 1, x - r));
        const xIn = Math.max(0, Math.min(w - 1, x + r + 1));
        sum += data[(y * w + xIn) * 4 + c] - data[(y * w + xOut) * 4 + c];
      }
    }
  }
  // 纵向
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        const yy = Math.max(0, Math.min(h - 1, y));
        sum += tmp[(yy * w + x) * 4 + c];
      }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = Math.round(sum / win);
        const yOut = Math.max(0, Math.min(h - 1, y - r));
        const yIn = Math.max(0, Math.min(h - 1, y + r + 1));
        sum += tmp[(yIn * w + x) * 4 + c] - tmp[(yOut * w + x) * 4 + c];
      }
    }
  }
  // A 通道拷贝
  for (let i = 3; i < data.length; i += 4) out[i] = data[i];
  return out;
}

/**
 * 对 ImageData 施加美颜，返回新 ImageData（不改原图）。纯函数、确定性。
 */
export function applyBeauty(src: ImageData, p: BeautyParams): ImageData {
  const w = src.width, h = src.height;
  const sp = src.data;
  const out = new ImageData(w, h);
  const dp = out.data;

  const smooth = p.smooth / 100;
  const whiten = p.whiten / 100;
  const warmth = p.warmth / 100;
  const bright = (p.brightness - 50) / 50; // -1..1

  // 磨皮半径随尺寸缩放（保持视觉一致），随强度增大。
  const radius = smooth > 0 ? Math.max(1, Math.round((Math.min(w, h) / 220) * (1 + smooth * 2))) : 0;
  const blurred = radius > 0 ? boxBlur(sp, w, h, radius) : sp;

  for (let i = 0; i < sp.length; i += 4) {
    let r = sp[i], g = sp[i + 1], b = sp[i + 2];
    const skin = smooth > 0 || whiten > 0 ? skinWeight(r, g, b) : 0;

    // 1) 磨皮：肤色区域按强度混合到模糊图（保边：仅肤色 + 强度加权）。
    if (radius > 0 && skin > 0) {
      const k = smooth * skin;
      r = r * (1 - k) + blurred[i] * k;
      g = g * (1 - k) + blurred[i + 1] * k;
      b = b * (1 - k) + blurred[i + 2] * k;
    }

    // 2) 美白：肤色像素向白提亮。
    if (whiten > 0 && skin > 0) {
      const k = whiten * skin * 0.5;
      r = r + (255 - r) * k;
      g = g + (255 - g) * k;
      b = b + (255 - b) * k;
    }

    // 3) 暖色色温。
    if (warmth !== 0) {
      r = r + 18 * warmth;
      b = b - 14 * warmth;
    }

    // 4) 亮度。
    if (bright !== 0) {
      const add = bright * 40;
      r += add; g += add; b += add;
    }

    dp[i] = clamp(r);
    dp[i + 1] = clamp(g);
    dp[i + 2] = clamp(b);
    dp[i + 3] = sp[i + 3];
  }
  return out;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** 浏览器便捷：对一张 <img>/Canvas 源做美颜，返回 dataURL。 */
export async function beautifyToDataUrl(
  source: CanvasImageSource & { width?: number; height?: number },
  p: BeautyParams,
  maxSide = 640,
): Promise<string> {
  const srcW = (source as HTMLImageElement).naturalWidth || (source as { width?: number }).width || maxSide;
  const srcH = (source as HTMLImageElement).naturalHeight || (source as { height?: number }).height || maxSide;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  const srcData = ctx.getImageData(0, 0, w, h);
  const result = applyBeauty(srcData, p);
  ctx.putImageData(result, 0, 0);
  return canvas.toDataURL("image/png");
}
