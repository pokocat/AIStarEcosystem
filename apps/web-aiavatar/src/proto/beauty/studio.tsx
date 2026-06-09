"use client";
import React from "react";
import { Icons } from "../icons";
import * as UI from "../ui";
import { DATA, AvatarApi, USE_MOCK } from "../api";
import { toast } from "../toast";
import { BeautyEngine } from "./engine";
import { detectLandmarks, extractAnchors, canonicalAnchors, warmupLandmarker } from "./landmarks";
import type { FaceAnchors } from "./landmarks";
import {
  BeautyParams, ZERO_PARAMS, cloneParams, isZeroParams,
  BEAUTY_PRESETS, SKIN_CTRLS, FILTERS, describeParams,
} from "./presets";

// ============================================================
// BeautyStudio — 形象精调工作台（端上实时美颜）
//   预览画布（拖动滑杆 60fps 实时生效，按住对比原图）
//   三个分区：精调（5 滑杆）/ 美颜（一键三档 + 磨皮美白）/ 滤镜
//   「应用精调」→ 全分辨率导出 → 上传保存为新版本（不经生成式模型，零积分）
// ============================================================
const hB: any = React.createElement;
const { useState, useEffect, useRef, useCallback } = React;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, err) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => err(new Error("IMAGE_LOAD_FAILED"));
    img.src = url;
  });
}

/** mock / 无定妆图时的占位画像：与 Portrait 同风格，五官画在标准锚点上（让精调可见）。 */
function paintPlaceholderPortrait(char: any): HTMLCanvasElement {
  const w = 768, h = 1024;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  const hue = char && char.hue != null ? char.hue : 250;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue} 20% 94%)`);
  g.addColorStop(1, `hsl(${hue} 18% 86%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `hsl(${hue} 16% 80%)`;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.42, w * 0.34, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.40, w * 0.46, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  const fg = `hsl(${hue} 14% 64%)`;
  const fg2 = `hsl(${hue} 20% 46%)`;
  // 头 + 肩
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.46, w * 0.165, h * 0.205, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h);
  ctx.quadraticCurveTo(w * 0.20, h * 0.72, w * 0.5, h * 0.70);
  ctx.quadraticCurveTo(w * 0.80, h * 0.72, w * 0.84, h);
  ctx.closePath(); ctx.fill();
  // 五官（落在 canonicalAnchors 标准位置）
  ctx.fillStyle = fg2;
  ctx.beginPath(); ctx.ellipse(w * 0.408, h * 0.40, w * 0.034, h * 0.013, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w * 0.592, h * 0.40, w * 0.034, h * 0.013, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = fg2; ctx.lineWidth = w * 0.008; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.425); ctx.lineTo(w * 0.5, h * 0.49); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.465, h * 0.505); ctx.quadraticCurveTo(w * 0.5, h * 0.515, w * 0.535, h * 0.505); ctx.stroke();
  ctx.lineWidth = w * 0.011;
  ctx.beginPath(); ctx.moveTo(w * 0.44, h * 0.563); ctx.quadraticCurveTo(w * 0.5, h * 0.585, w * 0.56, h * 0.563); ctx.stroke();
  return cv;
}

const TABS = [
  ["warp", "精调", Icons.sliders],
  ["skin", "美颜", Icons.sparkle],
  ["filter", "滤镜", Icons.images],
] as any[];

export function BeautyStudio({ char, onApplied }: { char: any; onApplied?: (fresh: any) => void }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error | unsupported
  const [errMsg, setErrMsg] = useState("");
  const [tab, setTab] = useState("warp");
  const [params, setParams] = useState<BeautyParams>(cloneParams(ZERO_PARAMS));
  const [approx, setApprox] = useState(false);      // 未检出人脸 → 标准构图近似
  const [demoImage, setDemoImage] = useState(false); // 占位画像（mock / 无定妆图）
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warpSel, setWarpSel] = useState("face"); // 精调当前选中项（单滑杆）
  const [skinSel, setSkinSel] = useState("smooth"); // 美颜当前选中项（单滑杆）

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BeautyEngine | null>(null);
  const paramsRef = useRef<BeautyParams>(params);
  const rafRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  const scheduleRender = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      engineRef.current && engineRef.current.render(paramsRef.current);
    });
  }, []);

  const update = useCallback((p: BeautyParams) => {
    paramsRef.current = p;
    setParams(p);
    scheduleRender();
  }, [scheduleRender]);

  const init = useCallback(async (seedBlob?: Blob) => {
    setStatus("loading");
    setErrMsg("");
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    try {
      if (!USE_MOCK) warmupLandmarker();
      const blob = seedBlob || await AvatarApi.imageBlob(char.id, `${char?.versions || 0}-${Date.now()}`);
      let source: HTMLImageElement | HTMLCanvasElement;
      let demo = false;
      if (blob) {
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        source = await loadImage(url);
      } else {
        source = paintPlaceholderPortrait(char);
        demo = true;
      }
      let anchors: FaceAnchors;
      if (demo || USE_MOCK) {
        // mock / 占位画像：跳过关键点资产加载，直接用标准构图锚点（离线可预览）
        anchors = canonicalAnchors();
      } else {
        const pts = await detectLandmarks(source as any);
        anchors = pts ? extractAnchors(pts) : canonicalAnchors();
      }
      if (!canvasRef.current) return;
      // 复用已有上下文换底图；首次（或上下文已 dispose）才新建。
      // 切忌 dispose 后在同一 canvas 上 create —— loseContext 过的 canvas 会取回死上下文。
      let engine = engineRef.current;
      if (engine) engine.reload(source, anchors);
      else { engine = BeautyEngine.create(source, anchors, canvasRef.current); engineRef.current = engine; }
      const zero = cloneParams(ZERO_PARAMS);
      paramsRef.current = zero;
      setParams(zero);
      engine.render(zero);
      setApprox(!anchors.detected);
      setDemoImage(demo);
      setStatus("ready");
    } catch (e: any) {
      if (e && e.message === "WEBGL_UNSUPPORTED") setStatus("unsupported");
      else { setErrMsg((e && e.message) || "加载失败"); setStatus("error"); }
    }
  }, [char && char.id]);

  useEffect(() => {
    init();
    return () => {
      engineRef.current && engineRef.current.dispose();
      engineRef.current = null;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      rafRef.current && cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char && char.id]);

  // —— 按住对比 ——
  const compareDown = () => {
    if (status !== "ready" || !engineRef.current) return;
    setComparing(true);
    engineRef.current.render(paramsRef.current, { original: true });
  };
  const compareUp = () => {
    if (!engineRef.current) return;
    setComparing(false);
    engineRef.current.render(paramsRef.current);
  };

  // —— 应用：导出全分辨率 → 上传保存新版本 → 以结果为基底继续 ——
  const apply = async () => {
    if (busy || status !== "ready" || !engineRef.current) return;
    if (isZeroParams(params)) { toast("先调整参数再应用", { tone: "warn" }); return; }
    setBusy(true);
    try {
      const blob = await engineRef.current.toBlob(params);
      const r = await AvatarApi.applyRefine(char.id, blob, params, describeParams(params));
      toast("已保存为新版本", { tone: "ok" });
      const fresh = { ...(((r && r.avatar) || r || {}) as any) };
      if (r && r.imageUrl && !fresh.imageUrl) fresh.imageUrl = r.imageUrl;
      await init(blob); // 新结果成为基底，参数归零继续调；避免刚保存后立刻回源取图的竞态
      onApplied && onApplied(fresh);
    } catch (e: any) {
      toast((e && e.message) || "保存失败", { tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  const presetActive = (p: any) =>
    Object.keys(p.warp).every((k) => p.warp[k] === (params.warp as any)[k]) &&
    p.skin.smooth === params.skin.smooth && p.skin.whiten === params.skin.whiten;

  // 单滑杆 + 底部横滚参数条（剪映/美图式）：同一时刻只展开一个滑杆，预览常驻可见
  const chipSliders = (ctrls: any[], group: "warp" | "skin", sel: string, setSel: (k: string) => void) => {
    const fmt = (v: number) => (group === "warp" ? (v > 0 ? "+" : "") + v : String(v));
    const cur = ctrls.find((c) => c.key === sel) || ctrls[0];
    const cv = (params as any)[group][cur.key] || 0;
    return hB('div', null,
      // 当前选中项的单滑杆（紧贴预览下沿）
      hB('div', { style: { marginBottom: 14 } },
        hB('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } },
          hB('span', { style: { fontSize: 13.5, fontWeight: 700 } }, cur.name),
          hB('span', { className: 'mono', style: { fontSize: 12, color: cv !== 0 ? 'var(--primary)' : 'var(--ink-3)', fontWeight: 700 } }, fmt(cv))),
        hB(UI.Slider, { value: cv, min: cur.min, max: cur.max, onChange: (nv: number) => update({ ...params, [group]: { ...(params as any)[group], [cur.key]: nv } }) })),
      // 横滚参数条（已调整项亮蓝并带数值）
      hB('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -15px', padding: '0 15px 4px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } },
        ctrls.map((c) => {
          const v = (params as any)[group][c.key] || 0;
          const on = c.key === sel;
          const dirty = v !== 0;
          return hB('button', { key: c.key, onClick: () => setSel(c.key), style: { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer', whiteSpace: 'nowrap', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'), background: on ? 'var(--primary-tint)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600 } },
            c.name,
            dirty && hB('span', { className: 'mono', style: { fontSize: 10.5, fontWeight: 700, color: on ? 'var(--primary)' : 'var(--ink-3)' } }, fmt(v)));
        })));
  };

  // ── 视图 ───────────────────────────────────────────────────
  return hB('div', null,
    // 预览画布
    hB('div', {
      style: { position: 'relative', width: 'fit-content', maxWidth: '100%', margin: '0 auto 12px', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)', background: 'var(--surface-3)', WebkitUserSelect: 'none', userSelect: 'none' },
      onPointerDown: compareDown, onPointerUp: compareUp, onPointerLeave: compareUp, onPointerCancel: compareUp,
      onContextMenu: (e: any) => e.preventDefault(),
    },
      hB('canvas', { ref: canvasRef, width: 768, height: 1024, style: { display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '46vh', touchAction: 'manipulation', WebkitTouchCallout: 'none' } }),
      // 角标
      status === 'ready' && hB('div', { style: { position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 } },
        demoImage && hB(UI.Badge, { tone: 'warn' }, '标准示意图'),
        !demoImage && approx && hB(UI.Badge, { tone: 'warn' }, '未识别人脸 · 近似调整')),
      status === 'ready' && hB('div', { style: { position: 'absolute', right: 10, bottom: 10, padding: '5px 11px', borderRadius: 'var(--r-pill)', background: 'rgba(20,16,30,.55)', color: '#fff', fontSize: 11, fontWeight: 600, pointerEvents: 'none', backdropFilter: 'blur(4px)' } },
        comparing ? '原图' : '按住对比原图'),
      // 加载 / 错误态
      status === 'loading' && hB('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', minHeight: 320 } },
        hB('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 } },
          hB(UI.Spinner, { size: 22 }),
          hB('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, '正在加载形象与人脸关键点…'))),
      status === 'error' && hB('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', minHeight: 320 } },
        hB('div', { style: { textAlign: 'center', padding: 20 } },
          hB('div', { style: { fontSize: 13.5, fontWeight: 700, marginBottom: 6 } }, '画布加载失败'),
          hB('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, wordBreak: 'break-all' } }, errMsg),
          hB(UI.Button, { variant: 'line', size: 'sm', icon: Icons.retry, onClick: init }, '重试'))),
      status === 'unsupported' && hB('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', minHeight: 320 } },
        hB('div', { style: { textAlign: 'center', padding: 20, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 } },
          '当前浏览器不支持实时精调（WebGL 不可用）。', hB('br'), '请换用系统浏览器或升级后再试。'))),

    // 分区 tabs
    hB('div', { style: { display: 'flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-pill)', marginBottom: 12 } },
      TABS.map(([k, l, ic]: any) => {
        const on = tab === k;
        return hB('button', { key: k, onClick: () => setTab(k), style: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, boxShadow: on ? 'var(--sh-1)' : 'none' } },
          hB(ic, { size: 14, stroke: 1.9 }), l);
      })),

    // 面板
    hB('div', { className: 'm-card', style: { padding: 15, marginBottom: 12 } },
      tab === 'warp' && chipSliders(DATA.WARP_CTRLS, 'warp', warpSel, setWarpSel),
      tab === 'skin' && hB('div', null,
        hB('div', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 9 } }, '一键美颜'),
        hB('div', { style: { display: 'flex', gap: 8, marginBottom: 16 } },
          BEAUTY_PRESETS.map((p) => {
            const on = presetActive(p);
            return hB('button', { key: p.key, onClick: () => update({ ...params, warp: { ...p.warp }, skin: { ...p.skin } }), style: { flex: 1, padding: '9px 4px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'), background: on ? 'var(--primary-tint)' : 'var(--surface)', textAlign: 'center' } },
              hB('div', { style: { fontSize: 13, fontWeight: 700, color: on ? 'var(--primary)' : 'var(--ink)' } }, p.name),
              hB('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, p.desc));
          })),
        chipSliders(SKIN_CTRLS as any, 'skin', skinSel, setSkinSel)),
      tab === 'filter' && hB('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        FILTERS.map((f) => {
          const on = params.filter === f.key;
          return hB('button', { key: f.key, onClick: () => update({ ...params, filter: f.key }), style: { fontSize: 13, padding: '8px 15px', background: on ? 'var(--ink)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', fontWeight: 600, cursor: 'pointer' } }, f.name);
        }))),

    // 操作区
    hB('div', { style: { display: 'flex', gap: 10, marginBottom: 8 } },
      hB(UI.Button, { variant: 'line', icon: Icons.refresh, disabled: busy || status !== 'ready', onClick: () => update(cloneParams(ZERO_PARAMS)), style: { flex: '0 0 88px', padding: '0 12px' } }, '重置'),
      hB(UI.Button, { variant: 'primary', full: true, icon: Icons.checkc, disabled: busy || status !== 'ready' || isZeroParams(params), onClick: apply, style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, busy ? '保存中…' : '应用保存')),
    hB('div', { style: { fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.5 } },
      '端上实时处理 · 不消耗积分 · 像素级保持本人特征',
      demoImage ? hB('span', null, hB('br'), '当前为标准示意图，生成定妆形象后即可精调真实照片') : null));
}
