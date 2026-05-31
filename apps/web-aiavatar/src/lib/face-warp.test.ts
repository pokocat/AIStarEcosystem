import { describe, it, expect, beforeAll } from "vitest";
import { warpImageData, heuristicAnchors, isNeutral, NEUTRAL, type FaceAnchors, type FaceSliders } from "./face-warp";

// Node 无 DOM ImageData：用最小 polyfill。
beforeAll(() => {
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
    (globalThis as { ImageData: unknown }).ImageData = class {
      data: Uint8ClampedArray; width: number; height: number;
      constructor(a: number | Uint8ClampedArray, b: number, c?: number) {
        if (typeof a === "number") { this.width = a; this.height = b; this.data = new Uint8ClampedArray(a * b * 4); }
        else { this.data = a; this.width = b; this.height = c!; }
      }
    };
  }
});

function checkerboard(w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const checker = ((x >> 2) + (y >> 2)) % 2 === 0;
      const base = checker ? 40 : 215;
      img.data[i] = (base + x * 3) & 0xff;
      img.data[i + 1] = (base + y * 3) & 0xff;
      img.data[i + 2] = (base + (x + y) * 2) & 0xff;
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

describe("face-warp 几何形变（真实确定性算法）", () => {
  it("中性参数近似恒等", () => {
    const src = checkerboard(128, 160);
    const out = warpImageData(src, NEUTRAL);
    expect(diffCount(src, out)).toBe(0);
  });

  it("瘦脸滑块改变像素", () => {
    const src = checkerboard(128, 160);
    const out = warpImageData(src, { ...NEUTRAL, slimFace: 60 });
    expect(diffCount(src, out)).toBeGreaterThan(0);
  });

  it("确定性：同输入两次结果一致", () => {
    const src = checkerboard(128, 160);
    const s: FaceSliders = { slimFace: 40, eyeSize: 25, noseBridge: 15, faceShape: 20, mouthShape: 10 };
    const a = warpImageData(src, s);
    const b = warpImageData(src, s);
    expect(diffCount(a, b)).toBe(0);
  });

  it("各滑块独立生效（眼睛缩放也改变像素）", () => {
    const src = checkerboard(128, 160);
    expect(diffCount(src, warpImageData(src, { ...NEUTRAL, eyeSize: 70 }))).toBeGreaterThan(0);
    expect(diffCount(src, warpImageData(src, { ...NEUTRAL, noseBridge: 70 }))).toBeGreaterThan(0);
    expect(diffCount(src, warpImageData(src, { ...NEUTRAL, faceShape: 70 }))).toBeGreaterThan(0);
    expect(diffCount(src, warpImageData(src, { ...NEUTRAL, mouthShape: 70 }))).toBeGreaterThan(0);
  });

  it("叠加滑块不会清掉前序位移（瘦脸+眼睛 与 仅眼睛 结果不同）", () => {
    const src = checkerboard(128, 160);
    const eyeOnly = warpImageData(src, { ...NEUTRAL, eyeSize: 40 });
    const both = warpImageData(src, { ...NEUTRAL, slimFace: 50, eyeSize: 40 });
    expect(diffCount(eyeOnly, both)).toBeGreaterThan(0);
  });

  it("输出尺寸与输入一致", () => {
    const src = checkerboard(96, 120);
    const out = warpImageData(src, { ...NEUTRAL, slimFace: 30 });
    expect(out.width).toBe(96);
    expect(out.height).toBe(120);
  });

  it("isNeutral 判定", () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(isNeutral({ ...NEUTRAL, eyeSize: 1 })).toBe(false);
  });
});

// ── 关键点驱动（MediaPipe FaceLandmarker 锚点）—— 形变定位到真实检测位置 ──────────
/** 仅在某矩形区域内统计像素差异 —— 验证形变是否定位在该区域。 */
function diffInRegion(a: ImageData, b: ImageData, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
    }
  return n;
}

describe("face-warp 关键点驱动（眼睛/脸型按真实检测位置形变）", () => {
  const W = 200, H = 200;

  function anchorsAt(eyeY: number): FaceAnchors {
    // 把双眼锚点放在指定纵向位置（模拟 MediaPipe 检测到的真实眼睛位置）。
    return {
      leftEye: { x: 0.4 * W, y: eyeY }, rightEye: { x: 0.6 * W, y: eyeY },
      eyeRadius: 22,
      faceCenter: { x: 0.5 * W, y: 0.5 * H }, faceWidth: 0.5 * W, faceRadius: 0.3 * W,
      jaw: { x: 0.5 * W, y: 0.85 * H }, noseTip: { x: 0.5 * W, y: 0.55 * H },
      noseTop: { x: 0.5 * W, y: 0.45 * H }, mouthCenter: { x: 0.5 * W, y: 0.7 * H }, mouthWidth: 0.3 * W,
      detected: true,
    };
  }

  it("眼睛形变定位在传入的眼睛锚点处（上半 vs 下半）", () => {
    const src = checkerboard(W, H);
    // 锚点在顶部 → 形变集中在上半；锚点在底部 → 集中在下半。
    const topAnchors = anchorsAt(0.25 * H);
    const botAnchors = anchorsAt(0.75 * H);
    const topWarp = warpImageData(src, { ...NEUTRAL, eyeSize: 70 }, topAnchors);
    const botWarp = warpImageData(src, { ...NEUTRAL, eyeSize: 70 }, botAnchors);

    const topHalfChangesForTop = diffInRegion(src, topWarp, 0, 0, W, H / 2);
    const botHalfChangesForTop = diffInRegion(src, topWarp, 0, H / 2, W, H);
    const topHalfChangesForBot = diffInRegion(src, botWarp, 0, 0, W, H / 2);
    const botHalfChangesForBot = diffInRegion(src, botWarp, 0, H / 2, W, H);

    // 顶部锚点：上半改动远多于下半；底部锚点反之。
    expect(topHalfChangesForTop).toBeGreaterThan(botHalfChangesForTop);
    expect(botHalfChangesForBot).toBeGreaterThan(topHalfChangesForBot);
  });

  it("不同眼睛锚点位置产出不同结果（证明真用了锚点而非固定中心）", () => {
    const src = checkerboard(W, H);
    const a = warpImageData(src, { ...NEUTRAL, eyeSize: 60 }, anchorsAt(0.3 * H));
    const b = warpImageData(src, { ...NEUTRAL, eyeSize: 60 }, anchorsAt(0.7 * H));
    expect(diffCount(a, b)).toBeGreaterThan(0);
  });

  it("传锚点 与 不传（启发式）结果不同 —— 锚点确实参与运算", () => {
    const src = checkerboard(W, H);
    const heuristic = warpImageData(src, { ...NEUTRAL, slimFace: 50 });
    const custom = warpImageData(src, { ...NEUTRAL, slimFace: 50 }, anchorsAt(0.3 * H));
    expect(diffCount(heuristic, custom)).toBeGreaterThan(0);
  });

  it("传入 heuristicAnchors 与 缺省 等价（回退路径一致）", () => {
    const src = checkerboard(W, H);
    const explicit = warpImageData(src, { ...NEUTRAL, eyeSize: 40 }, heuristicAnchors(W, H));
    const implicit = warpImageData(src, { ...NEUTRAL, eyeSize: 40 });
    expect(diffCount(explicit, implicit)).toBe(0);
  });

  it("锚点驱动仍确定性（同锚点同滑块两次一致）", () => {
    const src = checkerboard(W, H);
    const anchors = anchorsAt(0.4 * H);
    const s: FaceSliders = { slimFace: 30, eyeSize: 40, noseBridge: 20, faceShape: 25, mouthShape: 15 };
    expect(diffCount(warpImageData(src, s, anchors), warpImageData(src, s, anchors))).toBe(0);
  });

  it("heuristicAnchors 形状合理（眼在脸上方、下颌在下方）", () => {
    const a = heuristicAnchors(200, 260);
    expect(a.leftEye.x).toBeLessThan(a.rightEye.x);
    expect(a.leftEye.y).toBeLessThan(a.jaw.y);
    expect(a.faceWidth).toBeGreaterThan(0);
    expect(a.detected).toBe(false);
  });

  it("形变限制在人脸区域内：调脸型/瘦脸/嘴不动四角背景（修「整图变形」）", () => {
    const src = checkerboard(W, H);
    // 小脸居中、四周留足背景的锚点。
    const smallFace: FaceAnchors = {
      leftEye: { x: 0.42 * W, y: 0.44 * H }, rightEye: { x: 0.58 * W, y: 0.44 * H }, eyeRadius: 14,
      faceCenter: { x: 0.5 * W, y: 0.5 * H }, faceWidth: 0.3 * W, faceRadius: 0.15 * W,
      jaw: { x: 0.5 * W, y: 0.64 * H }, noseTip: { x: 0.5 * W, y: 0.52 * H },
      noseTop: { x: 0.5 * W, y: 0.46 * H }, mouthCenter: { x: 0.5 * W, y: 0.58 * H }, mouthWidth: 0.18 * W,
      detected: true,
    };
    const strong: FaceSliders = { slimFace: 90, eyeSize: 0, noseBridge: 0, faceShape: 90, mouthShape: 90 };
    const out = warpImageData(src, strong, smallFace);
    const C = 24; // 四角 24×24 背景块：零改动（旧 bug 会把它们一起拉变形）。
    expect(diffInRegion(src, out, 0, 0, C, C)).toBe(0);
    expect(diffInRegion(src, out, W - C, 0, W, C)).toBe(0);
    expect(diffInRegion(src, out, 0, H - C, C, H)).toBe(0);
    expect(diffInRegion(src, out, W - C, H - C, W, H)).toBe(0);
    // 人脸中心区域：确实发生形变（仍然有效）。
    expect(diffInRegion(src, out, 0.4 * W, 0.4 * H, 0.6 * W, 0.7 * H)).toBeGreaterThan(0);
  });
});
