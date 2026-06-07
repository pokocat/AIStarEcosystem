"use client";
// ============================================================
// BeautyEngine — 端上确定性美颜（WebGL1，单 shader）
//   · 几何精调：位移场液化（径向缩放 + 定向位移，按人脸锚点构建 ≤12 个 op）
//   · 磨皮：保边滤波（色距加权）+ 高频回注，限皮肤 mask
//   · 美白：肤区提亮微冷调；滤镜：全图调色（色温/饱和/对比/褪色/黑白）
//   像素级保持身份：纯图像处理、确定性可复算，不经任何生成式模型。
//   画布 = 原图分辨率（封顶 MAX_SIDE），CSS 缩放显示；导出即 canvas.toBlob。
// ============================================================
import type { FaceAnchors, Pt } from "./landmarks";
import { BeautyParams, gradeOf } from "./presets";

const MAX_SIDE = 1600;
const MAX_OPS = 12;

const VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() { vUv = aUv; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uImg;
uniform sampler2D uMask;
uniform vec2 uTexel;
uniform float uAspect;
uniform int uOpCount;
uniform vec4 uOpA[${MAX_OPS}];  // cx, cy, radius, strength（物理归一坐标：x*aspect）
uniform vec4 uOpB[${MAX_OPS}];  // dirx, diry, type(0=scale 1=shift), 0
uniform float uSmooth;
uniform float uWhiten;
uniform float uGradeAmt;
uniform vec3 uGrade1;  // temp, tint, sat
uniform vec3 uGrade2;  // con, bri, fade
uniform float uMono;

vec2 toPhys(vec2 uvIn) { return vec2(uvIn.x * uAspect, uvIn.y); }

vec2 warpUv(vec2 uvIn) {
  vec2 p = toPhys(uvIn);
  vec2 disp = vec2(0.0);
  for (int i = 0; i < ${MAX_OPS}; i++) {
    if (i < uOpCount) {
      vec4 a = uOpA[i];
      vec4 b = uOpB[i];
      vec2 c = vec2(a.x, a.y);
      float d = distance(p, c) / max(a.z, 0.0001);
      if (d < 1.0) {
        float f = (1.0 - d * d);
        f = f * f;
        if (b.z < 0.5) {
          disp += (p - c) * (-a.w) * f;           // scale：w>0 → 区域放大
        } else {
          disp += -b.xy * (a.w * a.z) * f;        // shift：内容沿 +dir 移动 w*radius
        }
      }
    }
  }
  vec2 q = p + disp;
  return vec2(q.x / uAspect, q.y);
}

// 单 tap 保边采样：rgb = 加权色，a = 权重（避免宏/续行，GLSL ES 1.00 兼容）
vec4 btap(vec2 uvIn, vec3 base, vec2 off) {
  vec3 s = texture2D(uImg, uvIn + off).rgb;
  float w = exp(-dot(s - base, s - base) * 19.0);
  return vec4(s * w, w);
}

void main() {
  vec2 uv = warpUv(vUv);
  vec3 col = texture2D(uImg, uv).rgb;
  float mask = texture2D(uMask, uv).r;

  // —— 磨皮（保边滤波 + 35% 高频回注，仅肤区）——
  if (uSmooth > 0.003) {
    vec2 t = uTexel * (1.0 + 3.5 * uSmooth);
    vec4 acc = vec4(col, 1.0);
    acc += btap(uv, col, vec2( t.x * 1.6, 0.0));
    acc += btap(uv, col, vec2(-t.x * 1.6, 0.0));
    acc += btap(uv, col, vec2(0.0,  t.y * 1.6));
    acc += btap(uv, col, vec2(0.0, -t.y * 1.6));
    acc += btap(uv, col, vec2( t.x * 1.13,  t.y * 1.13));
    acc += btap(uv, col, vec2(-t.x * 1.13,  t.y * 1.13));
    acc += btap(uv, col, vec2( t.x * 1.13, -t.y * 1.13));
    acc += btap(uv, col, vec2(-t.x * 1.13, -t.y * 1.13));
    acc += btap(uv, col, vec2( t.x * 3.2, 0.0));
    acc += btap(uv, col, vec2(-t.x * 3.2, 0.0));
    acc += btap(uv, col, vec2(0.0,  t.y * 3.2));
    acc += btap(uv, col, vec2(0.0, -t.y * 3.2));
    vec3 blur = acc.rgb / acc.a;
    vec3 smoothed = blur + (col - blur) * 0.35;
    col = mix(col, smoothed, uSmooth * mask);
  }

  // —— 美白（肤区为主 + 全图 8% 轻量，微冷去黄）——
  if (uWhiten > 0.003) {
    vec3 wcol = col * (1.0 + 0.16 * uWhiten) + 0.045 * uWhiten;
    wcol = mix(wcol, wcol * vec3(0.985, 1.0, 1.02), 0.55);
    wcol = min(wcol, vec3(1.0));
    col = mix(col, wcol, clamp(uWhiten * (mask * 0.92 + 0.08), 0.0, 1.0));
  }

  // —— 滤镜（全图调色）——
  if (uGradeAmt > 0.003) {
    vec3 g = col;
    g += vec3(uGrade1.x, uGrade1.y * 0.6, -uGrade1.x) * 0.9;            // 色温/色调
    float lum = dot(g, vec3(0.299, 0.587, 0.114));
    g = mix(vec3(lum), g, 1.0 + uGrade1.z);                              // 饱和
    g = (g - 0.5) * (1.0 + uGrade2.x) + 0.5 + uGrade2.y;                 // 对比/亮度
    g = mix(g, g * 0.92 + 0.08, uGrade2.z * 4.0);                        // 褪色提黑
    g = mix(g, vec3(dot(g, vec3(0.299, 0.587, 0.114))), uMono);          // 黑白
    col = mix(col, clamp(g, 0.0, 1.0), uGradeAmt);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

type Op = { cx: number; cy: number; radius: number; strength: number; dirx: number; diry: number; type: 0 | 1 };

export class BeautyEngine {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private texImg: WebGLTexture;
  private texMask: WebGLTexture;
  private anchors: FaceAnchors;
  private aspect: number;
  private disposed = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, prog: WebGLProgram,
                      texImg: WebGLTexture, texMask: WebGLTexture,
                      w: number, h: number, anchors: FaceAnchors) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.texImg = texImg;
    this.texMask = texMask;
    this.width = w;
    this.height = h;
    this.aspect = w / h;
    this.anchors = anchors;
    ["uImg", "uMask", "uTexel", "uAspect", "uOpCount", "uOpA", "uOpB",
     "uSmooth", "uWhiten", "uGradeAmt", "uGrade1", "uGrade2", "uMono"].forEach((n) => {
      // 数组 uniform 在部分驱动需用 "name[0]" 取位置
      this.loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + "[0]");
    });
  }

  /** 创建引擎：canvas 设为图像原始分辨率（封顶 MAX_SIDE）。WebGL 不可用抛 WEBGL_UNSUPPORTED。 */
  static create(source: HTMLImageElement | HTMLCanvasElement, anchors: FaceAnchors,
                canvas: HTMLCanvasElement): BeautyEngine {
    const sw = (source as HTMLImageElement).naturalWidth || source.width;
    const sh = (source as HTMLImageElement).naturalHeight || source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.max(2, Math.round(sw * scale));
    const h = Math.max(2, Math.round(sh * scale));
    canvas.width = w;
    canvas.height = h;

    const gl = (canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false })
      || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true })) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WEBGL_UNSUPPORTED");

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error("SHADER_COMPILE: " + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("SHADER_LINK: " + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // 全屏 quad（左上 = uv(0,0)，与图像/关键点坐标一致）
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, 1, 0, 0,
      1, 1, 1, 0,
      -1, -1, 0, 1,
      1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aUv = gl.getAttribLocation(prog, "aUv");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const mkTex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const texImg = mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as any);

    const texMask = mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintSkinMask(anchors, w, h));

    gl.viewport(0, 0, w, h);
    return new BeautyEngine(canvas, gl, prog, texImg, texMask, w, h, anchors);
  }

  /** 渲染一帧（original=true 渲原图，用于按住对比）。 */
  render(params: BeautyParams, opts?: { original?: boolean }) {
    if (this.disposed) return;
    const gl = this.gl;
    const orig = !!opts?.original;
    gl.useProgram(this.prog);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texImg);
    gl.uniform1i(this.loc.uImg, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texMask);
    gl.uniform1i(this.loc.uMask, 1);

    gl.uniform2f(this.loc.uTexel, 1 / this.width, 1 / this.height);
    gl.uniform1f(this.loc.uAspect, this.aspect);

    const ops = orig ? [] : buildWarpOps(this.anchors, params, this.aspect);
    const A = new Float32Array(MAX_OPS * 4);
    const B = new Float32Array(MAX_OPS * 4);
    ops.slice(0, MAX_OPS).forEach((op, i) => {
      A[i * 4] = op.cx; A[i * 4 + 1] = op.cy; A[i * 4 + 2] = op.radius; A[i * 4 + 3] = op.strength;
      B[i * 4] = op.dirx; B[i * 4 + 1] = op.diry; B[i * 4 + 2] = op.type; B[i * 4 + 3] = 0;
    });
    gl.uniform1i(this.loc.uOpCount, Math.min(ops.length, MAX_OPS));
    gl.uniform4fv(this.loc.uOpA, A);
    gl.uniform4fv(this.loc.uOpB, B);

    gl.uniform1f(this.loc.uSmooth, orig ? 0 : params.skin.smooth / 100);
    gl.uniform1f(this.loc.uWhiten, orig ? 0 : params.skin.whiten / 100);

    const g = gradeOf(orig ? "none" : params.filter);
    const on = params.filter !== "none" && !orig ? 1 : 0;
    gl.uniform1f(this.loc.uGradeAmt, on);
    gl.uniform3f(this.loc.uGrade1, g.temp, g.tint, g.sat);
    gl.uniform3f(this.loc.uGrade2, g.con, g.bri, g.fade);
    gl.uniform1f(this.loc.uMono, g.mono);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** 导出当前参数的全分辨率成品图。 */
  toBlob(params: BeautyParams, type = "image/jpeg", quality = 0.92): Promise<Blob> {
    this.render(params);
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("EXPORT_FAILED"))), type, quality);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      const ext = this.gl.getExtension("WEBGL_lose_context");
      ext && ext.loseContext();
    } catch { /* noop */ }
  }
}

// ── 位移场构建（锚点 + 滑杆 → ops；物理归一坐标）────────────────

function buildWarpOps(an: FaceAnchors, params: BeautyParams, aspect: number): Op[] {
  const w = params.warp;
  const phys = (p: Pt) => ({ x: p.x * aspect, y: p.y });
  const pd = (a: Pt, b: Pt) => { const pa = phys(a), pb = phys(b); return Math.hypot(pa.x - pb.x, pa.y - pb.y); };
  const norm = (x: number, y: number) => { const l = Math.hypot(x, y) || 1e-4; return { x: x / l, y: y / l }; };

  const faceW = an.faceWidth * aspect;            // x 向距离 → 物理
  const eyeR = an.eyeRadius * aspect;
  const mouthR = an.mouthRadius * aspect;
  const bridgeP = phys(an.bridge);
  const chinP = phys(an.chin);
  const axis = norm(chinP.x - bridgeP.x, chinP.y - bridgeP.y);

  const ops: Op[] = [];
  const scaleOp = (c: Pt, radius: number, strength: number) => {
    const cp = phys(c);
    ops.push({ cx: cp.x, cy: cp.y, radius, strength, dirx: 0, diry: 0, type: 0 });
  };
  const shiftOp = (c: Pt, radius: number, strength: number, dir: { x: number; y: number }) => {
    const cp = phys(c);
    ops.push({ cx: cp.x, cy: cp.y, radius, strength, dirx: dir.x, diry: dir.y, type: 1 });
  };

  // 眼睛：径向缩放（+大眼 −小眼）
  if (w.eye !== 0) {
    const s = (w.eye / 50) * 0.16;
    scaleOp(an.eyeL, eyeR * 2.3, s);
    scaleOp(an.eyeR, eyeR * 2.3, s);
  }
  // 嘴型：径向缩放（+丰唇/放大 −收嘴）
  if (w.mouth !== 0) {
    scaleOp(an.mouth, mouthR * 1.9, (w.mouth / 50) * 0.14);
  }
  // 脸型：下颌四点定向位移（−瘦脸内收 +增宽外扩）
  if (w.face !== 0) {
    const k = (-w.face / 50) * 0.10;               // 滑杆负 → 内收
    const inward = (p: Pt) => {
      const pp = phys(p);
      // 朝脸纵轴（bridge→chin 直线）的垂足方向
      const t = (pp.x - bridgeP.x) * axis.x + (pp.y - bridgeP.y) * axis.y;
      const foot = { x: bridgeP.x + axis.x * t, y: bridgeP.y + axis.y * t };
      return norm(foot.x - pp.x, foot.y - pp.y);
    };
    [...an.cheekL, ...an.cheekR].forEach((p) => shiftOp(p, faceW * 0.32, k, inward(p)));
  }
  // 下巴：沿脸纵轴位移（+拉长 −缩短）
  if (w.chin !== 0) {
    shiftOp(an.chin, faceW * 0.42, (w.chin / 50) * 0.07, axis);
  }
  // 鼻梁：鼻翼向中线收拢（+挺直收窄 −放宽）
  if (w.nose !== 0) {
    const k = (w.nose / 50) * 0.06;
    const noseW = Math.max(pd(an.noseL, an.noseR), 1e-3);
    const tipP = phys(an.noseTip);
    const lP = phys(an.noseL);
    const rP = phys(an.noseR);
    shiftOp(an.noseL, noseW * 0.95, k, norm(tipP.x - lP.x, tipP.y - lP.y));
    shiftOp(an.noseR, noseW * 0.95, k, norm(tipP.x - rP.x, tipP.y - rP.y));
  }
  return ops;
}

// ── 皮肤 mask（CPU 一次性绘制：脸部轮廓 − 眉眼嘴，边缘羽化）────

function paintSkinMask(an: FaceAnchors, w: number, h: number): HTMLCanvasElement {
  const mw = Math.max(2, Math.round(Math.min(512, w)));
  const mh = Math.max(2, Math.round(mw * (h / w)));
  const draw = document.createElement("canvas");
  draw.width = mw;
  draw.height = mh;
  const ctx = draw.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, mw, mh);

  const poly = (pts: Pt[], expand = 1) => {
    if (!pts.length) return;
    const c = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    c.x /= pts.length; c.y /= pts.length;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = (c.x + (p.x - c.x) * expand) * mw;
      const y = (c.y + (p.y - c.y) * expand) * mh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };

  ctx.fillStyle = "#fff";
  poly(an.oval, 1);
  ctx.globalCompositeOperation = "destination-out";
  poly(an.eyePolyL, 1.7);
  poly(an.eyePolyR, 1.7);
  poly(an.browL, 1.9);
  poly(an.browR, 1.9);
  poly(an.mouthPoly, 1.35);
  ctx.globalCompositeOperation = "source-over";

  // 羽化（canvas filter 不可用时直接用硬边 mask，效果略生硬但可用）
  const out = document.createElement("canvas");
  out.width = mw;
  out.height = mh;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#000";
  octx.fillRect(0, 0, mw, mh);
  try {
    (octx as any).filter = `blur(${Math.max(2, Math.round(mw / 64))}px)`;
    octx.drawImage(draw, 0, 0);
    (octx as any).filter = "none";
  } catch {
    octx.drawImage(draw, 0, 0);
  }
  return out;
}
