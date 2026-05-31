// ─────────────────────────────────────────────────────────────────────────────
// lib/face-landmarks.ts — MediaPipe FaceLandmarker（478 关键点）真实人脸检测。
//
// 任务书 §4 首选开源方案：MediaPipe FaceMesh。本模块用官方 @mediapipe/tasks-vision
// （Apache-2.0，浏览器 WASM，无需 GPU），检测真实关键点 → 算出供液化形变用的「面部锚点」
// （眼心 / 脸心 / 脸宽 / 下颌 / 鼻 / 嘴），让 face-warp 真正按检测位置形变，而非固定估计。
//
// 资产加载（按优先级）：
//   1. NEXT_PUBLIC_MEDIAPIPE_WASM_BASE / NEXT_PUBLIC_MEDIAPIPE_MODEL_URL（覆盖；内网 CDN 等）
//   2. 默认**同源自托管**：/mediapipe/wasm（由 scripts/setup-mediapipe.mjs 于 predev/prebuild 从
//      node_modules 拷入 public/）+ /mediapipe/face_landmarker.task（已提交在 public/）。
//      同源 → 离线可用、WASM 版本永远与 npm 包一致、不受外网 CDN 网络策略影响。
//      （依赖外网 jsDelivr/Google Storage 时，CDN 一被挡就检测失败 → 回退启发式锚点 → 形变不准，
//       这是「精细化调整不准」的常见根因。）
//
// 检测失败（资产缺失 / 无脸 / WASM 不可用）一律抛出，调用方回退到 face-warp 的启发式锚点 —— 不阻塞。
// ─────────────────────────────────────────────────────────────────────────────

import type { FaceAnchors } from "./face-warp";

const DEFAULT_WASM_BASE = "/mediapipe/wasm";
const DEFAULT_MODEL_URL = "/mediapipe/face_landmarker.task";

const MEDIAPIPE_CONSOLE_NOISE = [
  "Created TensorFlow Lite XNNPACK delegate for CPU",
  "Feedback manager requires a model with a single signature inference",
  "face_landmarker_graph.cc",
  "gl_context.cc",
  "vision_wasm_internal.js",
];

function isMediapipeConsoleNoise(args: unknown[]): boolean {
  const text = args.map((arg) => {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.message;
    return "";
  }).join(" ");
  return MEDIAPIPE_CONSOLE_NOISE.some((needle) => text.includes(needle));
}

function suppressMediapipeConsoleNoise<T>(fn: () => T): T {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    if (!isMediapipeConsoleNoise(args)) originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (!isMediapipeConsoleNoise(args)) originalWarn(...args);
  };
  try {
    return fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

async function suppressMediapipeConsoleNoiseAsync<T>(fn: () => Promise<T>): Promise<T> {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    if (!isMediapipeConsoleNoise(args)) originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (!isMediapipeConsoleNoise(args)) originalWarn(...args);
  };
  try {
    return await fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

function wasmBase(): string {
  return process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE || DEFAULT_WASM_BASE;
}
function modelUrl(): string {
  return process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL || DEFAULT_MODEL_URL;
}

// MediaPipe FaceMesh 标准关键点索引（478 点；规范公开索引，全行业通用）。
const IDX = {
  leftEyeOuter: 33, leftEyeInner: 133, leftIris: 468,
  rightEyeOuter: 263, rightEyeInner: 362, rightIris: 473,
  noseTip: 1, noseBridgeTop: 168, noseBottom: 2,
  mouthLeft: 61, mouthRight: 291, upperLip: 13, lowerLip: 14,
  chin: 152, faceLeft: 234, faceRight: 454, foreheadTop: 10,
} as const;

export type LM = { x: number; y: number; z?: number };

/**
 * 纯函数：478 个归一化关键点 → 像素坐标系 FaceAnchors。
 * 抽出以便单测（无需 WASM）。lm 为 0–1 归一化坐标。
 */
export function landmarksToAnchors(lm: LM[], w: number, h: number): FaceAnchors {
  const px = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const hasIris = lm.length > 473;
  const leftEye = hasIris ? px(IDX.leftIris) : mid(px(IDX.leftEyeOuter), px(IDX.leftEyeInner));
  const rightEye = hasIris ? px(IDX.rightIris) : mid(px(IDX.rightEyeOuter), px(IDX.rightEyeInner));
  const faceLeft = px(IDX.faceLeft), faceRight = px(IDX.faceRight);
  const chin = px(IDX.chin), forehead = px(IDX.foreheadTop);
  const noseTip = px(IDX.noseTip), noseTop = px(IDX.noseBridgeTop);
  const mouthL = px(IDX.mouthLeft), mouthR = px(IDX.mouthRight);
  const mouthC = mid(px(IDX.upperLip), px(IDX.lowerLip));

  const faceCenter = mid(faceLeft, faceRight);
  const faceWidth = Math.hypot(faceRight.x - faceLeft.x, faceRight.y - faceLeft.y);
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  void forehead; void chin; // 已用于下方度量

  return {
    leftEye, rightEye,
    eyeRadius: Math.max(6, eyeDist * 0.28),
    faceCenter: { x: faceCenter.x, y: (faceCenter.y + mid(leftEye, rightEye).y) / 2 },
    faceWidth: Math.max(20, faceWidth),
    faceRadius: Math.max(20, faceWidth * 0.5),
    jaw: chin,
    noseTip, noseTop,
    mouthCenter: mouthC,
    mouthWidth: Math.max(8, Math.hypot(mouthR.x - mouthL.x, mouthR.y - mouthL.y)),
    detected: true,
  };
}

// 懒加载单例（避免重复初始化 WASM）。
let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").FaceLandmarker> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      return suppressMediapipeConsoleNoiseAsync(async () => {
        const fileset = await FilesetResolver.forVisionTasks(wasmBase());
        return FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl(), delegate: "CPU" },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      });
    })().catch((e) => {
      landmarkerPromise = null; // 失败可重试
      throw e;
    });
  }
  return landmarkerPromise;
}

export interface DetectResult {
  anchors: FaceAnchors;
  /** 478 个归一化关键点（0–1），供可选的关键点叠加可视化。 */
  landmarks: LM[];
}

/**
 * 检测一张图的人脸关键点并换算成像素坐标系的 FaceAnchors。
 * @param source <img> / canvas / ImageBitmap
 * @param w/h    目标像素尺寸（与后续 warp 的 ImageData 同尺寸）
 * @throws 检测不可用 / 无脸 时抛出，调用方回退启发式
 */
export async function detectFaceAnchors(
  source: CanvasImageSource,
  w: number,
  h: number,
): Promise<DetectResult> {
  const landmarker = await getLandmarker();
  const res = suppressMediapipeConsoleNoise(() => landmarker.detect(source as HTMLImageElement));
  const faces = res.faceLandmarks;
  if (!faces || faces.length === 0 || !faces[0] || faces[0].length < 468) {
    throw new Error("NO_FACE_DETECTED");
  }
  const lm = faces[0] as LM[];
  return { anchors: landmarksToAnchors(lm, w, h), landmarks: lm };
}

/** 预热（在精调页挂载时调，避免首次拖滑块卡顿）。失败静默。 */
export function warmupLandmarker(): void {
  getLandmarker().catch(() => { /* 回退启发式，不阻塞 */ });
}
