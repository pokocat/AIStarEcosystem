"use client";
// ============================================================
// 人脸关键点：MediaPipe Face Landmarker（478 点，浏览器 WASM）
//   · 资产自托管优先（/public/mediapipe/**，scripts/fetch-mediapipe-assets.sh 可重新拉取）
//   · 自托管缺失时回退 jsDelivr CDN + Google 模型仓（可用 NEXT_PUBLIC_MP_ASSETS_BASE 覆盖）
//   · 检测失败 / 资产加载失败 → 调用方退回 CANONICAL 标准构图近似锚点（流程不致断）
// 许可：MediaPipe Apache-2.0，可商用。
// ============================================================

export type Pt = { x: number; y: number };

/** 从 478 关键点提炼的「美颜锚点」：引擎只消费这一层，与具体检测器解耦。 */
export type FaceAnchors = {
  detected: boolean;          // false = 标准构图近似（mock 占位 / 检测失败降级）
  eyeL: Pt; eyeR: Pt; eyeRadius: number;
  mouth: Pt; mouthRadius: number;
  noseL: Pt; noseR: Pt; noseTip: Pt; bridge: Pt;
  chin: Pt; axis: Pt;         // 单位向量：鼻梁 → 下巴（脸纵轴方向）
  cheekL: Pt[]; cheekR: Pt[]; // 每侧 2 个下颌锚点（瘦脸位移场中心）
  faceWidth: number;          // 物理归一（x 已乘 aspect 前的 uv 距离由引擎换算）
  oval: Pt[];                 // 脸部轮廓多边形（皮肤 mask）
  eyePolyL: Pt[]; eyePolyR: Pt[]; mouthPoly: Pt[]; browL: Pt[]; browR: Pt[];
};

// ── MediaPipe 加载（单例）─────────────────────────────────────

const MP_VERSION = "0.10.35";
const LOCAL_BASE = "/mediapipe";
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const CDN_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// 绕过打包器静态分析的动态 import（webpack / turbopack 均不解析）
const dynImport: (u: string) => Promise<any> = new Function("u", "return import(u)") as any;

let landmarkerPromise: Promise<any> | null = null;

// MediaPipe WASM 把 INFO / W 级内部日志打到 console.error（如「Created TensorFlow Lite
// XNNPACK delegate for CPU.」），Next dev overlay 会误判为报错弹窗 → 执行期间过滤已知噪声。
const MP_NOISE = /^(INFO:|I\d{4}|W\d{4}|E\d{4})|TensorFlow Lite|XNNPACK delegate|All log messages before absl|gl_context|OpenGL error checking/;
function withMpLogMuted<T>(fn: () => T): T {
  const orig = console.error;
  (console as any).error = (...args: any[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (MP_NOISE.test(first)) return;
    orig.apply(console, args);
  };
  try {
    return fn();
  } finally {
    console.error = orig;
  }
}
async function withMpLogMutedAsync<T>(fn: () => Promise<T>): Promise<T> {
  const orig = console.error;
  (console as any).error = (...args: any[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (MP_NOISE.test(first)) return;
    orig.apply(console, args);
  };
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
}

async function urlOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function createLandmarker(): Promise<any> {
  const envBase = process.env.NEXT_PUBLIC_MP_ASSETS_BASE || "";
  const localOk = envBase ? true : await urlOk(`${LOCAL_BASE}/vision_bundle.mjs`);
  const base = envBase || (localOk ? LOCAL_BASE : CDN_BASE);
  const bundleUrl = base === LOCAL_BASE || envBase
    ? `${base}/vision_bundle.mjs`
    : `${CDN_BASE}/vision_bundle.mjs`;
  const wasmBase = `${base}/wasm`;
  const modelUrl = base === LOCAL_BASE || envBase ? `${base}/face_landmarker.task` : CDN_MODEL;

  const vision = await dynImport(new URL(bundleUrl, window.location.href).href);
  return withMpLogMutedAsync(async () => {
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  });
}

function getLandmarker(): Promise<any> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((e) => {
      landmarkerPromise = null; // 失败允许下次重试
      throw e;
    });
  }
  return landmarkerPromise;
}

/** 预热（进入精调页时调，可显著缩短首次检测耗时）。失败静默。 */
export function warmupLandmarker(): void {
  getLandmarker().catch(() => {});
}

/**
 * 检测单张图的人脸关键点（478 点，归一化 0..1）。
 * 失败 / 无人脸 → null（调用方退回 CANONICAL 近似锚点）。
 */
export async function detectLandmarks(image: HTMLImageElement | HTMLCanvasElement): Promise<Pt[] | null> {
  try {
    const lm = await getLandmarker();
    const res = withMpLogMuted(() => lm.detect(image));
    const face = res?.faceLandmarks?.[0];
    if (!face || face.length < 468) return null;
    return face.map((p: any) => ({ x: p.x, y: p.y }));
  } catch {
    return null;
  }
}

// ── 锚点提炼 ─────────────────────────────────────────────────

// 经典 FaceMesh 拓扑索引（MediaPipe 官方 connections 同源）
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_L = [33, 160, 158, 133, 153, 144];
const EYE_R = [362, 385, 387, 263, 373, 380];
const BROW_L = [70, 63, 105, 66, 107];
const BROW_R = [336, 296, 334, 293, 300];
const LIPS = [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91];

const avg = (pts: Pt[]): Pt => {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
};
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** 478 关键点 → 美颜锚点。 */
export function extractAnchors(pts: Pt[]): FaceAnchors {
  const P = (i: number): Pt => ({ x: pts[i].x, y: pts[i].y });
  const eyeL = avg(EYE_L.map(P));
  const eyeR = avg(EYE_R.map(P));
  const bridge = P(168);
  const chin = P(152);
  const axisLen = dist(bridge, chin) || 1e-4;
  const axis = { x: (chin.x - bridge.x) / axisLen, y: (chin.y - bridge.y) / axisLen };
  return {
    detected: true,
    eyeL,
    eyeR,
    eyeRadius: Math.max(dist(P(33), P(133)), dist(P(362), P(263))) * 0.62,
    mouth: avg([P(61), P(291), P(13), P(14)]),
    mouthRadius: dist(P(61), P(291)) * 0.62,
    noseL: P(129),
    noseR: P(358),
    noseTip: P(1),
    bridge,
    chin,
    axis,
    cheekL: [P(132), P(136)],
    cheekR: [P(361), P(365)],
    faceWidth: dist(P(234), P(454)),
    oval: FACE_OVAL.map(P),
    eyePolyL: EYE_L.map(P),
    eyePolyR: EYE_R.map(P),
    mouthPoly: LIPS.map(P),
    browL: BROW_L.map(P),
    browR: BROW_R.map(P),
  };
}

/**
 * 标准构图近似锚点（3:4 半身肖像，脸居中偏上）。
 * 用于：mock 占位画像 / 关键点资产加载失败 / 图中未检出人脸 —— 流程可用但提示「近似调整」。
 */
export function canonicalAnchors(): FaceAnchors {
  const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 28): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
    }
    return out;
  };
  return {
    detected: false,
    eyeL: { x: 0.408, y: 0.40 },
    eyeR: { x: 0.592, y: 0.40 },
    eyeRadius: 0.044,
    mouth: { x: 0.5, y: 0.565 },
    mouthRadius: 0.05,
    noseL: { x: 0.465, y: 0.495 },
    noseR: { x: 0.535, y: 0.495 },
    noseTip: { x: 0.5, y: 0.49 },
    bridge: { x: 0.5, y: 0.40 },
    chin: { x: 0.5, y: 0.645 },
    axis: { x: 0, y: 1 },
    cheekL: [{ x: 0.368, y: 0.50 }, { x: 0.405, y: 0.585 }],
    cheekR: [{ x: 0.632, y: 0.50 }, { x: 0.595, y: 0.585 }],
    faceWidth: 0.3,
    oval: ellipse(0.5, 0.46, 0.168, 0.21),
    eyePolyL: ellipse(0.408, 0.40, 0.05, 0.024, 12),
    eyePolyR: ellipse(0.592, 0.40, 0.05, 0.024, 12),
    mouthPoly: ellipse(0.5, 0.565, 0.062, 0.03, 12),
    browL: ellipse(0.408, 0.355, 0.055, 0.014, 10),
    browR: ellipse(0.592, 0.355, 0.055, 0.014, 10),
  };
}
