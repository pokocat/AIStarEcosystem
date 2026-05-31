import { describe, it, expect } from "vitest";
import { landmarksToAnchors, type LM } from "./face-landmarks";

// 合成一组 478 归一化关键点：双眼在上、鼻居中、嘴在下、下颌最低、脸左右两侧。
// 索引按 MediaPipe FaceMesh 规范（见 face-landmarks.ts IDX）。
function syntheticFace(): LM[] {
  const lm: LM[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => { lm[i] = { x, y }; };
  // 眼睛（左在画面左=较小 x）
  set(33, 0.36, 0.40); set(133, 0.44, 0.40);   // 左眼角
  set(263, 0.64, 0.40); set(362, 0.56, 0.40);  // 右眼角
  set(468, 0.40, 0.40); set(473, 0.60, 0.40);  // 虹膜中心
  // 鼻
  set(1, 0.50, 0.55); set(168, 0.50, 0.42); set(2, 0.50, 0.60);
  // 嘴
  set(61, 0.42, 0.70); set(291, 0.58, 0.70); set(13, 0.50, 0.68); set(14, 0.50, 0.72);
  // 脸轮廓
  set(152, 0.50, 0.90); set(234, 0.30, 0.50); set(454, 0.70, 0.50); set(10, 0.50, 0.20);
  return lm;
}

describe("landmarksToAnchors（MediaPipe 关键点 → 形变锚点）", () => {
  const W = 400, H = 500;
  const anchors = landmarksToAnchors(syntheticFace(), W, H);

  it("眼心用虹膜中心，左右分明且在脸上方", () => {
    expect(anchors.leftEye.x).toBeCloseTo(0.40 * W, 0);
    expect(anchors.rightEye.x).toBeCloseTo(0.60 * W, 0);
    expect(anchors.leftEye.x).toBeLessThan(anchors.rightEye.x);
    expect(anchors.leftEye.y).toBeLessThan(anchors.jaw.y);
  });

  it("下颌在最低（chin=152）", () => {
    expect(anchors.jaw.y).toBeCloseTo(0.90 * H, 0);
    expect(anchors.jaw.y).toBeGreaterThan(anchors.mouthCenter.y);
  });

  it("嘴在鼻下、脸宽来自左右轮廓点", () => {
    expect(anchors.mouthCenter.y).toBeGreaterThan(anchors.noseTip.y);
    expect(anchors.faceWidth).toBeCloseTo((0.70 - 0.30) * W, 0);
    expect(anchors.mouthWidth).toBeCloseTo((0.58 - 0.42) * W, 0);
  });

  it("eyeRadius 由瞳距推出（正且合理）", () => {
    const eyeDist = (0.60 - 0.40) * W;
    expect(anchors.eyeRadius).toBeCloseTo(eyeDist * 0.28, 0);
    expect(anchors.eyeRadius).toBeGreaterThan(0);
  });

  it("detected=true（真实检测产出）", () => {
    expect(anchors.detected).toBe(true);
  });

  it("无虹膜点（468 点版）回退用眼角中点", () => {
    const lm = syntheticFace().slice(0, 468); // 去掉虹膜点
    const a = landmarksToAnchors(lm, W, H);
    // 左眼角中点 = (0.36+0.44)/2 = 0.40
    expect(a.leftEye.x).toBeCloseTo(0.40 * W, 0);
    expect(a.rightEye.x).toBeCloseTo(0.60 * W, 0);
  });
});
