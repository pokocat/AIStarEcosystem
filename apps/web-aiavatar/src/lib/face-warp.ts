// ─────────────────────────────────────────────────────────────────────────────
// lib/face-warp.ts — 真实几何形变（任务书 §4「瘦脸/眼睛/鼻梁/脸型/嘴型」确定性算法，非大模型）。
//
// 算法：径向 pinch/bulge(liquify) + 局部缩放 → 逐像素反向映射 + 双线性采样。确定性、可实时。
//
// 形变锚点两种来源：
//   1. 真实关键点（face-landmarks.ts → MediaPipe FaceLandmarker 478 点）算出的 FaceAnchors —— 首选；
//      眼睛/脸型/嘴/鼻按检测到的真实位置形变，任意构图都准。
//   2. 启发式锚点（人像居中假设）—— 检测不可用时回退，保证离线 / 无脸也能动 + 单测无需 WASM。
//
// 后端 com.aistareco.aep.aiavatar.provider.AiAvatarGeometryWarp 是同族服务端实现（契约测试样本）。
// ─────────────────────────────────────────────────────────────────────────────

export interface FaceSliders {
  slimFace: number;   // 瘦脸：脸颊向中线 pinch
  eyeSize: number;    // 眼部缩放
  noseBridge: number; // 鼻梁纵向
  faceShape: number;  // 脸型（下颌纵向）
  mouthShape: number; // 嘴型横向
}

/** 形变锚点（像素坐标系）。由 MediaPipe 关键点算出，或按构图启发式估计。 */
export interface FaceAnchors {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  eyeRadius: number;
  faceCenter: { x: number; y: number };
  faceWidth: number;
  faceRadius: number;
  jaw: { x: number; y: number };
  noseTip: { x: number; y: number };
  noseTop: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  mouthWidth: number;
  /** true=来自真实关键点检测；false=启发式估计。 */
  detected: boolean;
}

export const NEUTRAL: FaceSliders = { slimFace: 0, eyeSize: 0, noseBridge: 0, faceShape: 0, mouthShape: 0 };

export function isNeutral(s: FaceSliders): boolean {
  return s.slimFace === 0 && s.eyeSize === 0 && s.noseBridge === 0 && s.faceShape === 0 && s.mouthShape === 0;
}

/** 按「人像居中、脸在上半部」估计锚点（无关键点检测时的回退）。 */
export function heuristicAnchors(w: number, h: number): FaceAnchors {
  const faceR = 0.3 * Math.min(w, h);
  return {
    leftEye: { x: 0.5 * w - 0.12 * w, y: 0.36 * h },
    rightEye: { x: 0.5 * w + 0.12 * w, y: 0.36 * h },
    eyeRadius: faceR * 0.32,
    faceCenter: { x: 0.5 * w, y: 0.42 * h },
    faceWidth: faceR * 2,
    faceRadius: faceR,
    jaw: { x: 0.5 * w, y: 0.6 * h },
    noseTip: { x: 0.5 * w, y: 0.44 * h },
    noseTop: { x: 0.5 * w, y: 0.38 * h },
    mouthCenter: { x: 0.5 * w, y: 0.54 * h },
    mouthWidth: faceR * 0.9,
    detected: false,
  };
}

const gaussian = (x: number) => Math.exp(-x * x);

/** 径向液化：在 (cx,cy) 半径 r 内对单坐标分量做 bulge(+)/pinch(-)。amount>0 放大。 */
function radial(px: number, py: number, cx: number, cy: number, r: number, amount: number, coord: number, isX: boolean): number {
  if (amount === 0 || r < 1e-6) return coord;
  const dx = px - cx, dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= r || dist < 1e-6) return coord;
  const frac = dist / r;
  const scale = 1.0 - amount * (1.0 - frac) * (1.0 - frac);
  return isX ? cx + dx * scale : cy + dy * scale;
}

/**
 * 对 ImageData 施加形变，返回新 ImageData（不改原图）。
 * @param anchors 形变锚点；缺省时按 heuristicAnchors 估计。
 */
export function warpImageData(src: ImageData, s: FaceSliders, anchors?: FaceAnchors): ImageData {
  const w = src.width, h = src.height;
  const out = new ImageData(w, h);
  const sp = src.data, dp = out.data;
  const a = anchors ?? heuristicAnchors(w, h);

  const faceR = a.faceRadius;
  const faceW = a.faceWidth;
  const slim = s.slimFace / 100, eye = s.eyeSize / 100, nose = s.noseBridge / 100,
    face = s.faceShape / 100, mouth = s.mouthShape / 100;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;

      // 全局人脸椭圆遮罩：脸心为 1，向外平滑衰减到 0。所有位移都乘以它 →
      // 人脸区域外（背景 / 肩膀 / 头发外缘 / 画面边缘）位移≈0，绝不被一起拉变形。
      // （这正是「调脸型把整张图都变形」的修复点：之前只有纵向衰减、无横向 + 无区域遮罩。）
      const mdx = (x - a.faceCenter.x) / (faceW * 0.8);
      const mdy = (y - a.faceCenter.y) / (faceR * 1.35);
      const faceMask = Math.exp(-(mdx * mdx + mdy * mdy));

      if (faceMask < 0.02) {
        // 远离人脸：原样拷贝，零形变、零重采样模糊。
        dp[di] = sp[di]; dp[di + 1] = sp[di + 1]; dp[di + 2] = sp[di + 2]; dp[di + 3] = sp[di + 3];
        continue;
      }

      // 各效果的「加性位移」，均带横向 + 纵向局部高斯，再统一乘全局遮罩。
      let dx = 0, dy = 0;

      // 1) 瘦脸：脸颊水平向脸中线 pinch（纵向限制在脸高度内；横向由 faceMask 收口）。
      if (slim !== 0) {
        const wy = gaussian((y - a.faceCenter.y) / (faceR * 0.75));
        dx += (x - a.faceCenter.x) * 0.38 * slim * wy;
      }
      // 2) 鼻梁：鼻区纵向拉伸（鼻区 2D 高斯，本就局部）。
      if (nose !== 0) {
        const wx = gaussian((x - a.noseTip.x) / (faceR * 0.16));
        const wy = gaussian((y - a.noseTip.y) / (faceR * 0.45));
        dy += (y - a.noseTop.y) * 0.16 * nose * wx * wy;
      }
      // 3) 脸型 / 下颌：下颌纵向收放（仅脸中线以下；+横向高斯限制在脸宽内，肩膀同高度不动）。
      if (face !== 0 && y > a.faceCenter.y) {
        const wy = gaussian((y - a.jaw.y) / (faceR * 0.5));
        const wx = gaussian((x - a.faceCenter.x) / (faceW * 0.5));
        dy += (y - a.jaw.y) * 0.34 * face * wy * wx;
      }
      // 4) 嘴型：嘴区水平收放（嘴区 2D 高斯）。
      if (mouth !== 0) {
        const wy = gaussian((y - a.mouthCenter.y) / (faceR * 0.18));
        const wx = gaussian((x - a.mouthCenter.x) / (a.mouthWidth * 0.9));
        dx += (x - a.mouthCenter.x) * 0.28 * mouth * wy * wx;
      }

      let sx = x + dx * faceMask;
      let sy = y + dy * faceMask;

      // 5) 眼睛：左右眼锚点径向 bulge/pinch（radial 自身限制在 eyeRadius 内，已是局部）。
      if (eye !== 0) {
        sx = radial(sx, sy, a.leftEye.x, a.leftEye.y, a.eyeRadius, eye * 0.35, sx, true);
        sy = radial(sx, sy, a.leftEye.x, a.leftEye.y, a.eyeRadius, eye * 0.35, sy, false);
        sx = radial(sx, sy, a.rightEye.x, a.rightEye.y, a.eyeRadius, eye * 0.35, sx, true);
        sy = radial(sx, sy, a.rightEye.x, a.rightEye.y, a.eyeRadius, eye * 0.35, sy, false);
      }

      sampleBilinear(sp, w, h, sx, sy, dp, di);
    }
  }
  return out;
}

function sampleBilinear(sp: Uint8ClampedArray, w: number, h: number, x: number, y: number, dp: Uint8ClampedArray, di: number) {
  x = Math.max(0, Math.min(w - 1.001, x));
  y = Math.max(0, Math.min(h - 1.001, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0, fy = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = sp[i00 + c] + (sp[i10 + c] - sp[i00 + c]) * fx;
    const bot = sp[i01 + c] + (sp[i11 + c] - sp[i01 + c]) * fx;
    dp[di + c] = Math.round(top + (bot - top) * fy);
  }
}

/**
 * 浏览器便捷：对一张 <img>/Canvas 源在离屏 canvas 上形变，返回 dataURL。
 * @param anchors 缺省走启发式；传入真实关键点锚点则按检测位置形变。
 */
export async function warpImageToDataUrl(
  source: CanvasImageSource & { width?: number; height?: number },
  s: FaceSliders,
  maxSide = 512,
  anchors?: FaceAnchors,
): Promise<string> {
  const srcW = (source as HTMLImageElement).naturalWidth || (source as { width?: number }).width || maxSide;
  const srcH = (source as HTMLImageElement).naturalHeight || (source as { height?: number }).height || maxSide;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
  const warped = warpImageData(src, s, anchors);
  ctx.putImageData(warped, 0, 0);
  return canvas.toDataURL("image/png");
}
