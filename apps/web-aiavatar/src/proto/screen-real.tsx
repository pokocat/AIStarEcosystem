"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, CaptureApi, JobApi, RealAuthApi, awaitJob, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 真人复刻 全流程（全屏切屏）
//   录制引导 → 倒计时+三角度转头录制（真实摄像头，纯视频无声） → 最后一步(回放+命名)
//   → 上传素材 → 协议确认 + 本人刷脸 → 核验登记授权 → 素材逐条审核 → 入库
//   live：create avatar → capture → footage → real-auth session（轮询到通过）
//        → verify(登记授权) → generate(upload)
//   美颜仅作用于预览/回放（CSS 滤镜降低心理负担），上传素材始终为原始录像
// ============================================================
const hMR : any = React.createElement;
const { useState: useStateMR, useEffect: useEffectMR, useRef: useRefMR } = React;

// 三角度分段（正面放第一段：后端在第 1 秒抽身份关键帧，正好落在正脸）
const ANGLES = [
  { key: 'front', short: '正面', label: '正对镜头', tip: '目视前方，表情自然放松', icon: 'scan', dir: 0, seconds: 2 },
  { key: 'left', short: '左转', label: '缓慢向左转头', tip: '转到侧脸后稍作停留', icon: 'arrowL', dir: -1, seconds: 2 },
  { key: 'right', short: '右转', label: '缓慢向右转头', tip: '转到另一侧侧脸，保持匀速', icon: 'arrowR', dir: 1, seconds: 2 },
];
const REC_SECONDS = ANGLES.reduce((s, a) => s + a.seconds, 0);
const angleStart = (i) => ANGLES.slice(0, i).reduce((s, a) => s + a.seconds, 0);
const angleAt = (sec) => { let acc = 0; for (let i = 0; i < ANGLES.length; i++) { acc += ANGLES[i].seconds; if (sec < acc) return i; } return ANGLES.length - 1; };
// 美颜仅作用于预览/回放展示层，不写入录制流（身份核验需要原始素材）
const BEAUTY_FILTER = 'brightness(1.07) contrast(.93) saturate(1.07) blur(.6px)';
const AI_POLISH_NOTE = '录像仅用于身份核验 · 数字人形象将由 AI 美化';
const TIPS = [
  { icon: 'sun', title: '光线充足', desc: '正面均匀打光，避免逆光', color: 'var(--ink-2)' },
  { icon: 'scan', title: '正脸入框', desc: '面部居中、肩部以上入镜', color: 'var(--primary)' },
  { icon: 'refresh', title: '缓慢转头', desc: '跟随箭头向左右转头', color: 'var(--ink-2)' },
];
function SunIco({ size = 18 }) {
  return hMR('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' },
    hMR('circle', { cx: 12, cy: 12, r: 4 }),
    hMR('path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }));
}
const tipIcon = (k, size) => k === 'sun' ? hMR(SunIco, { size }) : hMR(Icons[k], { size, stroke: 1.9 });

function CenterNav({ onClose }) {
  return hMR('div', { className: 'wx-nav', style: { paddingLeft: 8, flex: '0 0 auto' } },
    hMR('button', { className: 'nav-back m-tap', onClick: onClose }, hMR(Icons.x, { size: 22, stroke: 2.2 })),
    hMR('span', { className: 'nav-title' }),
    hMR('span', { className: 'nav-spacer' }));
}

// 取景框（四角 + 真实视频流 / 人形剪影兜底；beauty 仅作用于预览显示，children 为引导叠加层）
function CameraStage({ recording, label, dim, ratio = '3 / 4', videoRef, hasStream, beauty, children }) {
  return hMR('div', { style: { position: 'relative', width: '100%', aspectRatio: ratio, borderRadius: 'var(--r-xl)', overflow: 'hidden',
    background: 'radial-gradient(120% 90% at 50% 30%, #2A3A47, #0E171F 75%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' } },
    videoRef && hMR('video', { ref: videoRef, autoPlay: true, muted: true, playsInline: true, style: {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
      filter: beauty ? BEAUTY_FILTER : undefined,
      display: hasStream ? 'block' : 'none' } }),
    !hasStream && hMR('div', { style: { position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '58%', opacity: dim ? .28 : .48, color: '#7E97A8' } },
      hMR('svg', { viewBox: '0 0 100 130', width: '100%', fill: 'currentColor' },
        hMR('circle', { cx: 50, cy: 38, r: 24 }),
        hMR('path', { d: 'M8 130c0-26 18-44 42-44s42 18 42 44z' }))),
    children,
    [{ t: 14, l: 14 }, { t: 14, r: 14, rot: 90 }, { b: 14, r: 14, rot: 180 }, { b: 14, l: 14, rot: 270 }].map((p, i) =>
      hMR('span', { key: i, style: { position: 'absolute', top: p.t, bottom: p.b, left: p.l, right: p.r, width: 24, height: 24,
        borderTop: '2.5px solid rgba(255,255,255,.85)', borderLeft: '2.5px solid rgba(255,255,255,.85)', borderRadius: '5px 0 0 0',
        transform: `rotate(${p.rot || 0}deg)`, transformOrigin: 'center', zIndex: 2 } })),
    hMR('div', { style: { position: 'absolute', top: 13, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 } },
      recording
        ? hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'rgba(244,63,119,.92)', color: '#fff', fontSize: 12, fontWeight: 700 } },
            hMR('span', { style: { width: 8, height: 8, borderRadius: 99, background: '#fff', animation: 'pulse 1s infinite' } }), 'REC')
        : hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'rgba(20,30,40,.55)', backdropFilter: 'blur(6px)', color: hasStream ? '#7DF0B6' : 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 600 } },
            hMR('span', { style: { width: 7, height: 7, borderRadius: 99, background: hasStream ? '#3DD68C' : 'rgba(255,255,255,.5)' } }), hasStream ? '摄像头就绪' : '等待摄像头…')),
    label && hMR('div', { style: { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.78)', fontWeight: 500, zIndex: 2 } }, label));
}

// 录制完成后的「视频回放」卡（真实 blob 回放；beauty 仅滤镜展示层，上传素材不变）
function VideoReview({ badge, onDelete, blobUrl, isImage, beauty, onToggleBeauty }) {
  const vref = useRefMR(null as any);
  const [playing, setPlaying] = useStateMR(false);
  const togglePlay = () => {
    const v = vref.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  return hMR('div', { style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-2)', background: '#0E171F' } },
    blobUrl
      ? (isImage
          ? hMR('img', { src: blobUrl, alt: '素材预览', style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', filter: beauty ? BEAUTY_FILTER : undefined } })
          : hMR('video', { ref: vref, src: blobUrl, playsInline: true, preload: 'metadata', onEnded: () => setPlaying(false), style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', filter: beauty ? BEAUTY_FILTER : undefined } }))
      : hMR('div', { style: { width: '100%', aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', color: '#7E97A8' } },
          hMR(Icons.film, { size: 38 })),
    badge && hMR('span', { style: { position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', fontSize: 12, fontWeight: 700 } },
      hMR(Icons.lock, { size: 13, stroke: 2 }), badge),
    onDelete && hMR('button', { onClick: onDelete, className: 'm-tap', style: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMR(Icons.trash, { size: 16, stroke: 1.9 })),
    blobUrl && !isImage && hMR('button', { onClick: togglePlay, style: { position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'rgba(20,30,40,.6)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700 } },
      hMR(playing ? Icons.bolt : Icons.play, { size: 14 }), playing ? '播放中' : '回放'),
    blobUrl && (onToggleBeauty
      ? hMR('button', { onClick: onToggleBeauty, className: 'm-tap', style: { position: 'absolute', right: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', borderRadius: 99, border: 'none', cursor: 'pointer', background: beauty ? 'rgba(255,255,255,.92)' : 'rgba(20,30,40,.6)', backdropFilter: 'blur(8px)', color: beauty ? 'var(--ink)' : 'rgba(255,255,255,.85)', fontSize: 11.5, fontWeight: 700 } },
          hMR(Icons.sparkle, { size: 13, stroke: 2 }), '美颜预览 ' + (beauty ? '开' : '关'))
      : beauty && hMR('span', { style: { position: 'absolute', right: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', borderRadius: 99, background: 'rgba(20,30,40,.6)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,.85)', fontSize: 11.5, fontWeight: 700 } },
          hMR(Icons.sparkle, { size: 13, stroke: 2 }), '美颜预览')));
}

// —— intro：录制引导 ——
function RealIntro({ onReady, onUpload, onClose, subjectName }) {
  const [coach, setCoach] = useStateMR(true);
  const fileRef = useRefMR(null as any);
  return hMR('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR('input', { ref: fileRef, type: 'file', accept: 'video/*,image/*', style: { display: 'none' },
      onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) onUpload(f); } }),
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '4px 20px 0' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 } },
          hMR(Icons.bolt, { size: 13, stroke: 2 }), '约 ' + REC_SECONDS + ' 秒 · 无需说话'),
        subjectName && hMR('div', { className: 'm-clip1', style: { fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 } }, '正在为「' + subjectName + '」补充真人授权证据'),
        hMR('h1', { style: { fontSize: 25, lineHeight: 1.16, letterSpacing: '-.02em', fontWeight: 800, margin: '0 0 8px' } }, '录几秒转头视频，', hMR('br', null), '建立真人授权素材'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 } },
          '正对镜头，跟随箭头缓慢左右转头即可。素材只用于本人核验、平台审核及后续由你主动发起的视频生成。也可 ',
          hMR('button', { onClick: () => fileRef.current && fileRef.current.click(), style: { background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' } }, '上传已有素材'),
          ' 。')),
      hMR('div', { style: { margin: '16px 0 0' } }, hMR(CameraStage, { label: '将面部置于取景框中央' })),
      hMR('div', { style: { display: 'flex', gap: 8, margin: '14px 0 0' } },
        TIPS.map(t => hMR('div', { key: t.icon, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 7, padding: '13px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
          hMR('div', { style: { width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, ' + t.color + ' 14%, transparent)', color: t.color } }, tipIcon(t.icon, 18)),
          hMR('div', { style: { fontSize: 12, fontWeight: 700 } }, t.title),
          hMR('div', { style: { fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.35 } }, t.desc)))),
      hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '12px 0 0', padding: '11px 13px', background: 'var(--ok-s)', border: '1px solid color-mix(in oklab, var(--ok) 24%, transparent)', borderRadius: 'var(--r-md)' } },
        hMR(Icons.shield, { size: 15, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
        hMR('span', { style: { fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, '正式授权会在下一步单独确认；录制本身不代表已经同意协议。'))),
    hMR('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 20px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 } },
      hMR(UI.Button, { variant: 'line', onClick: () => fileRef.current && fileRef.current.click(), icon: Icons.upload, style: { flex: '0 0 88px', padding: '0 12px' } }, '上传'),
      hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.film, onClick: onReady, style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, '准备好了')),
    coach && hMR('div', { style: { position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(11,22,32,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px', animation: 'mSheetFade .2s ease both' } },
      hMR('div', { className: 'm-fade', style: { width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '22px 20px 20px', boxShadow: 'var(--sh-3)', textAlign: 'center' } },
        hMR('div', { style: { width: 54, height: 54, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMR(Icons.film, { size: 26 })),
        hMR('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, marginBottom: 6 } }, '录制前的小指引'),
        hMR('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' } }, '无需朗读台词：跟随屏幕箭头先正对镜头、再缓慢左右转头，约 ' + REC_SECONDS + ' 秒即可完成。'),
        hMR('div', { style: { display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 20, textAlign: 'left' } },
          TIPS.map(t => hMR('div', { key: t.icon, style: { display: 'flex', alignItems: 'center', gap: 12 } },
            hMR('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, ' + t.color + ' 14%, transparent)', color: t.color } }, tipIcon(t.icon, 19)),
            hMR('div', { style: { minWidth: 0 } },
              hMR('div', { style: { fontSize: 14, fontWeight: 700 } }, t.title),
              hMR('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 1 } }, t.desc))))),
        hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', onClick: () => setCoach(false) }, '知道了，开始准备'))));
}

// —— 录制：倒计时 + 三角度转头引导（真实 getUserMedia + MediaRecorder，纯视频无声）——
function RealRecording({ beauty, onToggleBeauty, onDone, onClose }) {
  const [count, setCount] = useStateMR(3);
  const [phase, setPhase] = useStateMR('count');
  const [progress, setProgress] = useStateMR(0);
  const [hasStream, setHasStream] = useStateMR(false);
  const [flash, setFlash] = useStateMR(null as any);
  const videoRef = useRefMR(null as any);
  const streamRef = useRefMR(null as any);
  const recRef = useRefMR(null as any);
  const chunksRef = useRefMR([] as any[]);
  const doneRef = useRefMR(false);
  const segRef = useRefMR(0);

  // 申请摄像头（纯视频，不要麦克风权限；失败 → 引导上传，不留死路）
  useEffectMR(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; }
        setHasStream(true);
      } catch (e) {
        if (!cancelled) {
          toast('无法访问摄像头，请改用「上传已有素材」', { tone: 'warn' });
          onClose('no-camera');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (recRef.current && recRef.current.state !== 'inactive') { try { recRef.current.stop(); } catch {} }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 倒计时 → 开录
  useEffectMR(() => {
    if (phase !== 'count' || !hasStream) return;
    if (count === 0) {
      setPhase('rec');
      try {
        const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((m) => (window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
        const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          if (doneRef.current) return;
          doneRef.current = true;
          const type = (chunksRef.current[0] && chunksRef.current[0].type) || 'video/webm';
          const blob = new Blob(chunksRef.current, { type });
          if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
          onDone(blob);
        };
        rec.start(250);
        recRef.current = rec;
      } catch (e) {
        toast('录制初始化失败，请改用「上传已有素材」', { tone: 'err' });
        onClose('no-camera');
      }
      return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 850);
    return () => clearTimeout(t);
  }, [count, phase, hasStream]);

  // 录制进度（REC_SECONDS 秒）
  useEffectMR(() => {
    if (phase !== 'rec') return;
    const iv = setInterval(() => setProgress(p => {
      const n = Math.min(100, p + 100 / (REC_SECONDS * 10));
      if (n >= 100) {
        clearInterval(iv);
        setTimeout(() => { try { recRef.current && recRef.current.state !== 'inactive' && recRef.current.stop(); } catch {} }, 200);
      }
      return n;
    }), 100);
    return () => clearInterval(iv);
  }, [phase]);

  const elapsed = progress / 100 * REC_SECONDS;
  const segIdx = phase === 'rec' ? angleAt(elapsed) : 0;
  const cur = ANGLES[segIdx];
  const segRemain = Math.max(1, Math.ceil(angleStart(segIdx) + cur.seconds - elapsed));
  const secs = Math.floor(elapsed);

  // 角度切换：中央闪示新指令 + 轻震动（Android 生效，iOS 静默忽略）
  useEffectMR(() => {
    if (phase !== 'rec' || segIdx === segRef.current) return;
    segRef.current = segIdx;
    setFlash(segIdx);
    try { (navigator as any).vibrate && (navigator as any).vibrate(60); } catch {}
    const t = setTimeout(() => setFlash(null), 950);
    return () => clearTimeout(t);
  }, [segIdx, phase]);

  const cancelRecording = () => {
    doneRef.current = true;
    try { recRef.current && recRef.current.state !== 'inactive' && recRef.current.stop(); } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    onClose('cancelled');
  };

  return hMR('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0B1620' } },
    hMR('div', { className: 'wx-nav', style: { paddingLeft: 16, justifyContent: 'flex-end', gap: 10 } },
      phase === 'rec' && hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 99, background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 13, fontWeight: 700 } },
        hMR('span', { style: { width: 9, height: 9, borderRadius: 99, background: 'var(--err)', animation: 'pulse 1s infinite' } }), hMR('span', { className: 'mono' }, '0:' + String(secs).padStart(2, '0'))),
      hMR('button', { className: 'm-tap', onClick: cancelRecording, style: { height: 36, padding: '0 13px', borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.12)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 } },
        hMR(Icons.x, { size: 16, stroke: 2.2 }), '取消录制')),

    hMR('div', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' } },
      // 角度指引卡：三段步骤 + 当前动作大字（替代原提词器）
      hMR('div', { style: { flex: '0 0 auto', background: 'rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: '15px 16px 14px', marginBottom: 14 } },
        hMR('div', { style: { display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 12 } },
          ANGLES.map((a, i) => {
            const state = phase === 'rec' && i < segIdx ? 'done' : (i === segIdx ? 'on' : 'todo');
            return hMR('span', { key: a.key, style: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, transition: 'all .25s',
              background: state === 'on' ? 'var(--grad)' : 'rgba(255,255,255,.1)',
              color: state === 'todo' ? 'rgba(255,255,255,.45)' : '#fff', opacity: state === 'done' ? .75 : 1 } },
              state === 'done' ? hMR(Icons.check, { size: 12, stroke: 2.6 }) : hMR('span', { className: 'mono', style: { fontSize: 10.5 } }, String(i + 1)),
              a.short,
              state === 'on' && phase === 'rec' && hMR('span', { className: 'mono', style: { fontSize: 10.5, opacity: .85 } }, segRemain + 's'));
          })),
        hMR('div', { key: phase + '-' + segIdx, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, animation: 'mScaleIn .3s ease both' } },
          hMR('span', { style: { display: 'grid', placeItems: 'center', width: 38, height: 38, flex: '0 0 38px', borderRadius: 12, background: 'rgba(255,255,255,.12)', color: '#fff',
            animation: phase === 'rec' && cur.dir !== 0 ? 'mNudgeX 1s ease-in-out infinite' : undefined, '--nudge': cur.dir < 0 ? '-7px' : '7px' } },
            hMR(Icons[cur.icon], { size: 21, stroke: 2.1 })),
          hMR('div', { style: { textAlign: 'left', minWidth: 0 } },
            hMR('div', { style: { fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1.2 } }, phase === 'count' ? '准备 · ' + cur.label : cur.label),
            hMR('div', { style: { fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 3 } }, cur.tip)))),
      hMR('div', { style: { flex: 1, minHeight: 0, position: 'relative' } },
        hMR(CameraStage, { recording: phase === 'rec', videoRef, hasStream, beauty },
          // 面部参考框（虚线椭圆，提示入框位置）
          hMR('div', { style: { position: 'absolute', left: '50%', top: '9%', transform: 'translateX(-50%)', width: '52%', aspectRatio: '3 / 3.8', border: '2px dashed rgba(255,255,255,.34)', borderRadius: '50%', zIndex: 2, pointerEvents: 'none' } }),
          // 转头方向箭头（贴边脉动）
          phase === 'rec' && cur.dir !== 0 && hMR('div', { style: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', [cur.dir < 0 ? 'left' : 'right']: 8, zIndex: 2, display: 'flex', color: '#fff', filter: 'drop-shadow(0 1px 6px rgba(0,0,0,.5))', animation: 'mNudgeX 1s ease-in-out infinite', '--nudge': cur.dir < 0 ? '-9px' : '9px', pointerEvents: 'none' } },
            hMR(Icons[cur.dir < 0 ? 'chevL' : 'chevR'], { size: 32, stroke: 2.6 }),
            hMR(Icons[cur.dir < 0 ? 'chevL' : 'chevR'], { size: 32, stroke: 2.6, style: { marginLeft: -20, opacity: .55 } })),
          // 段切换中央闪示
          flash != null && hMR('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 3, pointerEvents: 'none' } },
            hMR('div', { key: flash, style: { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 20px', borderRadius: 'var(--r-pill)', background: 'rgba(11,22,32,.72)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 17, fontWeight: 800, animation: 'mScaleIn .3s ease both' } },
              ANGLES[flash].dir !== 0 && hMR(Icons[ANGLES[flash].dir < 0 ? 'arrowL' : 'arrowR'], { size: 20, stroke: 2.4 }),
              ANGLES[flash].label)),
          // 美颜预览开关（仅影响预览/回放，不写入录制流）
          hMR('button', { className: 'm-tap', onClick: onToggleBeauty, style: { position: 'absolute', right: 12, bottom: 12, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', borderRadius: 99, border: 'none', cursor: 'pointer', background: beauty ? 'rgba(255,255,255,.92)' : 'rgba(20,30,40,.55)', backdropFilter: 'blur(6px)', color: beauty ? 'var(--ink)' : 'rgba(255,255,255,.85)', fontSize: 11.5, fontWeight: 700 } },
            hMR(Icons.sparkle, { size: 13, stroke: 2 }), '美颜 ' + (beauty ? '开' : '关'))),
        phase === 'count' && hMR('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(11,22,32,.5)', borderRadius: 'var(--r-xl)', zIndex: 3 } },
          hMR('div', { key: count, style: { fontFamily: 'var(--font-disp)', fontSize: 96, fontWeight: 800, color: '#fff', lineHeight: 1, animation: 'mScaleIn .3s ease both' } }, hasStream ? (count === 0 ? '开始' : count) : '…')))),

    hMR('div', { style: { flex: '0 0 auto', padding: '14px 20px calc(16px + var(--home-ind))' } },
      hMR('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12, color: 'rgba(255,255,255,.55)', fontSize: 12 } },
        hMR(Icons.wand, { size: 14, stroke: 2 }), AI_POLISH_NOTE),
      phase === 'rec'
        ? hMR('div', { style: { position: 'relative', height: 6, borderRadius: 99, background: 'rgba(255,255,255,.14)', overflow: 'hidden' } },
            hMR('div', { style: { height: '100%', width: progress + '%', background: 'var(--grad)', borderRadius: 99, transition: 'width .1s linear' } }),
            ANGLES.slice(0, -1).map((_, i) => hMR('span', { key: i, style: { position: 'absolute', top: 0, bottom: 0, width: 2, background: 'rgba(11,22,32,.55)', left: (angleStart(i + 1) / REC_SECONDS * 100) + '%' } })))
        : hMR('div', { style: { textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.5)' } }, hasStream ? '即将开始，请正对镜头…' : '正在请求摄像头权限…')));
}

// —— 最后一步：检查录制 + 命名 ——
function RealLastStep({ defaultName, blobUrl, isImage, beauty, onToggleBeauty, onCreate, onRetry, onClose, busy }) {
  const [name, setName] = useStateMR(defaultName || '');
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('h1', { style: { fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, '最后一步！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 22px', maxWidth: 280 } }, '检查素材并标记所属真人。完成本人确认与平台审核后，这条素材才能用于视频生成。'),
        hMR(VideoReview, { badge: '肖像已保护', blobUrl, isImage, beauty, onToggleBeauty, onDelete: onRetry }),
        hMR('div', { style: { textAlign: 'left', marginTop: 22 } },
          hMR('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 8 } }, '这是谁的真人素材'),
          hMR(UI.Input, { value: name, onChange: setName, placeholder: '输入本人姓名或素材名称' })))),
    hMR('div', { style: { flex: '0 0 auto', padding: '12px 22px calc(14px + var(--home-ind))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 } },
      hMR(UI.Button, { variant: 'dark', size: 'lg', disabled: busy || !name.trim(), onClick: () => onCreate(name.trim()), style: { minWidth: 200 } }, busy ? '处理中…' : '继续授权'),
      hMR('button', { onClick: onRetry, disabled: busy, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' } }, '重新录制')));
}

// —— 真人授权确认：先确认平台协议，再进入七牛本人刷脸页 ——
//   七牛 active 仅是活体 / 同人一致性的技术证据；业务授权以平台协议快照为准。
function RealAuth({ captureId, subjectName, blobUrl, isImage, beauty, onPassed, onClose }) {
  const [agreement, setAgreement] = useStateMR(null as any);
  const [agreementLoading, setAgreementLoading] = useStateMR(true);
  const [accepted, setAccepted] = useStateMR(false);
  const [begun, setBegun] = useStateMR(false);
  const [session, setSession] = useStateMR(null as any);
  const [err, setErr] = useStateMR('');
  const [registering, setRegistering] = useStateMR(false);
  const [startSeq, setStartSeq] = useStateMR(0);
  const [verifySeq, setVerifySeq] = useStateMR(0);
  const [refreshing, setRefreshing] = useStateMR(false);
  const sessionRef = useRefMR(null as any);
  const passedRef = useRefMR(false);

  useEffectMR(() => {
    let live = true;
    RealAuthApi.agreement()
      .then((a) => { if (live) setAgreement(a); })
      .catch((e: any) => { if (live) setErr(e?.message || '授权说明加载失败，请重试'); })
      .finally(() => { if (live) setAgreementLoading(false); });
    return () => { live = false; };
  }, []);

  // 用户明确确认协议后才创建会话；2 秒轮询服务端最终状态。
  useEffectMR(() => {
    if (!begun || !agreement) return;
    let live = true;
    let timer: any = null;
    setSession(null); setErr('');
    passedRef.current = false;
    (async () => {
      try {
        const s = await RealAuthApi.start(captureId, agreement.version);
        if (!live) return;
        sessionRef.current = s;
        setSession(s);
      } catch (e: any) {
        if (live) setErr(e?.message || '认证通道建立失败，请重试');
        return;
      }
      const poll = async () => {
        if (!live || !sessionRef.current) return;
        try {
          const s = await RealAuthApi.get(sessionRef.current.id);
          if (!live) return;
          sessionRef.current = s;
          setSession(s);
        } catch { /* 单次轮询失败不打断，下一轮继续 */ }
        if (live) timer = setTimeout(poll, 2000);
      };
      timer = setTimeout(poll, 2000);
    })();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [captureId, begun, agreement && agreement.version, startSeq]);

  // 从系统浏览器 / 第三方页切回时立即刷新，不必等下一轮定时器。
  useEffectMR(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !sessionRef.current) return;
      try { const s = await RealAuthApi.get(sessionRef.current.id); sessionRef.current = s; setSession(s); } catch {}
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // 认证通过 → 核验并登记肖像授权；服务端说「刷脸尚未完成」时回到等待，不当作失败
  useEffectMR(() => {
    if (!session || session.status !== 'active' || passedRef.current) return;
    let live = true;
    let retry: any = null;
    setRegistering(true);
    CaptureApi.verify(captureId)
      .then((r: any) => { if (!live) return; passedRef.current = true; onPassed(r); })
      .catch((e: any) => {
        if (!live) return;
        if (e?.code === 'DAP_AUTH_NOT_COMPLETED') retry = setTimeout(() => setVerifySeq((n) => n + 1), 2000);
        else setErr(e?.message || '核验没有通过，请重新认证');
      })
      .finally(() => { if (live) setRegistering(false); });
    return () => { live = false; if (retry) clearTimeout(retry); };
  }, [session && session.status, verifySeq]);

  const restart = async () => {
    setErr('');
    if (!sessionRef.current) { setStartSeq((n) => n + 1); return; }
    setRefreshing(true);
    try {
      const s = await RealAuthApi.restart(sessionRef.current.id);
      sessionRef.current = s; setSession(s);
      toast('已重新建立本人确认通道', { tone: 'ok' });
    } catch (e: any) { setErr(e?.message || '重新发起失败，请稍后再试'); }
    finally { setRefreshing(false); }
  };

  const openAuthPage = () => {
    if (!session?.h5Url) return;
    // 移动端使用当前页面打开，七牛完成后会自动回跳 #/real-auth/{sessionId}。
    if (session.mock) { toast('模拟环境：本人刷脸确认将自动完成', { tone: 'ok' }); return; }
    history.replaceState({ realAuth: session.id }, '', '#/real-auth/' + session.id);
    window.location.assign(session.h5Url);
  };

  if (!begun) {
    return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
      hMR(CenterNav, { onClose }),
      hMR('div', { className: 'm-body', style: { padding: '2px 20px 20px' } },
        hMR('div', { className: 'm-fade' },
          hMR('div', { className: 'mono', style: { fontSize: 10.5, letterSpacing: '.12em', color: 'var(--primary)', marginBottom: 8 } }, 'REAL PERSON · CONSENT'),
          hMR('h1', { style: { fontFamily: 'var(--font-disp)', fontSize: 24, lineHeight: 1.22, margin: '0 0 8px' } }, agreement?.title || '真人数字形象授权确认'),
          hMR('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' } },
            agreement?.summary || (agreementLoading ? '正在读取当前授权说明…' : err)),
          agreement && hMR(React.Fragment, null,
            hMR('div', { style: { padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface)', marginBottom: 12 } },
              hMR('div', { style: { display: 'grid', gridTemplateColumns: '72px 1fr', gap: '8px 10px', fontSize: 12.5, lineHeight: 1.5 } },
                hMR('span', { style: { color: 'var(--ink-3)' } }, '授权范围'), hMR('strong', null, agreement.scope),
                hMR('span', { style: { color: 'var(--ink-3)' } }, '有效期限'), hMR('strong', null, agreement.periodMonths + ' 个月'),
                hMR('span', { style: { color: 'var(--ink-3)' } }, '处理方'), hMR('strong', null, agreement.processors.join(' · ')))),
            hMR('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 } },
              agreement.sections.map((item, i) => hMR('div', { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 } },
                hMR('span', { className: 'mono', style: { flex: '0 0 auto', color: 'var(--primary)', fontSize: 10.5, paddingTop: 2 } }, String(i + 1).padStart(2, '0')),
                hMR('span', null, item)))),
            hMR('label', { className: 'm-tap', style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 13px', border: '1px solid ' + (accepted ? 'var(--primary)' : 'var(--line)'), borderRadius: 'var(--r-md)', background: accepted ? 'var(--primary-tint)' : 'var(--surface-2)', cursor: 'pointer' } },
              hMR('input', { type: 'checkbox', checked: accepted, onChange: (e) => setAccepted(e.target.checked), style: { width: 18, height: 18, margin: 0, accentColor: 'var(--primary)', flex: '0 0 auto' } }),
              hMR('span', { style: { fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink)' } }, '我已阅读并同意以上说明，确认素材中的人物是本人，并同意进入七牛云页面完成本人刷脸核验。'))))),
      hMR('div', { style: { flex: '0 0 auto', padding: '10px 20px calc(14px + var(--home-ind))' } },
        hMR(UI.Button, { variant: 'dark', size: 'lg', full: true, disabled: agreementLoading || !agreement || !accepted, onClick: () => { setErr(''); setBegun(true); } }, agreementLoading ? '读取授权说明…' : '同意并继续本人确认')));
  }

  const status = err ? 'error' : (session?.status || 'preparing');
  const TONE: any = {
    error:         { c: 'var(--err)', s: 'var(--err-s)' },
    failed:        { c: 'var(--err)', s: 'var(--err-s)' },
    active:        { c: 'var(--ok)', s: 'var(--ok-s)' },
    awaiting_auth: { c: 'var(--primary)', s: 'var(--primary-soft)' },
    validating:    { c: 'var(--primary)', s: 'var(--primary-soft)' },
    preparing:     { c: 'var(--ink-2)', s: 'var(--surface-3)' },
  };
  const HEAD: any = {
    error:         { title: '认证没有完成', desc: err },
    failed:        { title: '认证未通过', desc: session?.failReason || '本次刷脸没有通过，请在光线充足的环境下重新认证。' },
    active:        { title: '本人确认通过', desc: registering ? '正在绑定授权证据并生成登记…' : '活体与同人一致性核验通过，正在继续。' },
    awaiting_auth: { title: '前往本人刷脸确认', desc: '将在当前页面进入七牛云确认页；完成后会自动返回并继续处理。' },
    validating:    { title: '正在核验结果', desc: '七牛云正在确认活体与同人一致性，请稍候。' },
    preparing:     { title: '正在准备确认通道', desc: '正在为本次授权建立短时安全链接…' },
  };
  const tone = TONE[status] || TONE.preparing;
  const head = HEAD[status] || HEAD.preparing;
  const spinning = status === 'preparing' || status === 'validating' || (status === 'active' && registering);

  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 0', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        // 状态图标
        hMR('div', { style: { width: 56, height: 56, borderRadius: 18, margin: '2px auto 14px', display: 'grid', placeItems: 'center', background: tone.s, color: tone.c } },
          spinning
            ? hMR(UI.Spinner, { size: 22, c: tone.c })
            : hMR(status === 'active' ? Icons.check : status === 'awaiting_auth' ? Icons.scan : Icons.warn, { size: 26, stroke: 2.2 })),
        hMR('h1', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, head.title),
        subjectName && hMR('div', { className: 'm-clip1', style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 auto 8px', maxWidth: 280 } }, '正在为「' + subjectName + '」完成真人授权确认'),
        hMR('p', { style: { fontSize: 13, color: status === 'error' || status === 'failed' ? 'var(--err)' : 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 18px', maxWidth: 290, wordBreak: 'break-word' } }, head.desc),

        // 操作区
        status === 'awaiting_auth' && hMR('div', { style: { margin: '0 auto 16px', maxWidth: 300 } },
          hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.scan, onClick: openAuthPage }, '进入七牛云本人确认'),
          hMR('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 } },
            hMR('span', { style: { fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45, textAlign: 'left', flex: 1, minWidth: 0 } },
              '链接约 2 分钟有效；如已过期，需要重新建立通道。'),
            hMR('button', { onClick: restart, disabled: refreshing, className: 'm-tap', style: { flex: '0 0 auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--primary)' } }, refreshing ? '建立中…' : '重新建立'))),

        (status === 'failed' || status === 'error') && hMR('div', { style: { marginBottom: 16 } },
          hMR(UI.Button, { variant: 'primary', icon: Icons.retry, disabled: refreshing, onClick: restart }, refreshing ? '重新建立中…' : '重新发起本人确认')),

        hMR(VideoReview, { badge: '肖像已保护', blobUrl, isImage, beauty }),
        hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', textAlign: 'left' } },
          hMR(Icons.shield, { size: 16, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
          hMR('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '平台保存你的授权确认快照；七牛云仅提供活体与同人一致性核验。两项证据齐全后才会登记授权凭证。')))));
}

// —— 身份核验 + 生成（真实管线进度）——
function RealVerify({ blobUrl, isImage, beauty, stageText, pct, error, onRetry, onClose }) {
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 0', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('h1', { style: { fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 14px' } }, error ? '生成没有成功' : '身份核验与生成中'),
        error
          ? hMR('div', { style: { marginBottom: 18 } },
              hMR('p', { style: { fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5, margin: '0 0 16px', wordBreak: 'break-all' } }, error),
              hMR(UI.Button, { variant: 'primary', icon: Icons.retry, onClick: onRetry }, '重试'))
          : hMR('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 18 } },
              hMR(UI.Spinner, { size: 18 }),
              hMR('span', { style: { fontSize: 13.5, color: 'var(--ink-2)' } }, stageText || '正在确认你的授权同意…')),
        !error && pct != null && hMR('div', { style: { margin: '0 auto 18px', maxWidth: 260 } }, hMR(UI.Progress, { pct: Math.round(pct), showLabel: true })),
        hMR(VideoReview, { badge: '肖像已保护', blobUrl, isImage, beauty }),
        hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', textAlign: 'left' } },
          hMR(Icons.shield, { size: 16, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
          hMR('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '系统将核验素材与授权同意，加密存档并自动生成电子授权凭证，然后保持身份一致地复刻数字形象。')))));
}

// —— 就绪 + 选择声音 ——
function RealReady({ avatar, onContinue, onClose, authOnly, materialOnly }) {
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { width: 64, height: 64, margin: '4px auto 18px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hMR('div', { style: { position: 'absolute', inset: 8, borderRadius: 99, background: 'var(--primary-soft)' } }),
          hMR('div', { style: { position: 'relative', width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMR(Icons.check, { size: 24, stroke: 2.6 }))),
        hMR('h1', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, materialOnly ? '真人素材已入库' : authOnly ? '真人授权已完成！' : '你的数字人已就绪！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 20px', maxWidth: 260 } },
          materialOnly ? '授权证据已经登记，七牛云正在逐条审核素材；审核通过后才能在视频生成时选择使用。' : authOnly ? '肖像授权已登记，这个形象现在可以正常用于合成出片。' : '下一步可精调脸型、肤质与滤镜，满意后再保存到名录。'),
        avatar && avatar.imageUrl && hMR('div', { style: { width: 170, margin: '0 auto 20px', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
          hMR(Portrait, { char: avatar, variant: 'key', ratio: '4 / 5', expr: 'calm' })),
        (authOnly || materialOnly)
          ? hMR(UI.Button, { variant: 'dark', full: true, size: 'lg', icon: Icons.check, onClick: onClose }, '完成')
          : hMR(UI.Button, { variant: 'dark', full: true, size: 'lg', icon: Icons.sliders, onClick: onContinue }, '继续精调'))),
    hMR('div', { style: { flex: '0 0 auto', padding: '8px 22px calc(14px + var(--home-ind))', textAlign: 'center' } },
      hMR('button', { onClick: onClose, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-3)' } }, '稍后再说')));
}

/**
 * 七牛回跳后的可恢复页面。它只依赖 sessionId，可在刷新、微信 WebView 回流或重新登录后继续。
 */
function MRealAuthResume({ sessionId, ctx }) {
  const [session, setSession] = useStateMR(null as any);
  const [phase, setPhase] = useStateMR('loading'); // loading | waiting | sealing | ready | failed
  const [message, setMessage] = useStateMR('正在读取本人确认结果…');
  const [avatar, setAvatar] = useStateMR(null as any);
  const [busy, setBusy] = useStateMR(false);
  const processedRef = useRefMR(false);

  useEffectMR(() => {
    let live = true;
    let timer: any;
    const poll = async () => {
      try {
        const s = await RealAuthApi.get(sessionId);
        if (!live) return;
        setSession(s);
        if (s.status === 'failed') {
          setPhase('failed'); setMessage(s.failReason || '本次本人确认没有通过。'); return;
        }
        if (s.status === 'active') {
          if (processedRef.current) return;
          processedRef.current = true;
          setPhase('sealing'); setMessage('核验通过，正在绑定授权证据…');
          try {
            await CaptureApi.verify(s.captureId);
            const a = s.avatarId ? await AvatarApi.get(s.avatarId) : null;
            if (!live) return;
            setAvatar(a); setPhase('ready'); setMessage('授权证据已登记，素材正在逐条审核。');
            ctx.reload && ctx.reload();
          } catch (e: any) {
            if (!live) return;
            processedRef.current = false;
            setPhase('failed'); setMessage(e?.message || '授权登记没有完成，请重试。');
          }
          return;
        }
        setPhase('waiting');
        setMessage(s.status === 'validating' ? '七牛云正在确认活体与同人一致性…' : '本人确认尚未完成。');
        timer = setTimeout(poll, 1800);
      } catch (e: any) {
        if (!live) return;
        setPhase('failed'); setMessage(e?.message || '确认会话不存在或已经失效。');
      }
    };
    poll();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [sessionId]);

  const reopen = () => {
    if (!session?.h5Url) return;
    if (session.mock) { toast('模拟环境会自动完成本人确认', { tone: 'ok' }); return; }
    window.location.assign(session.h5Url);
  };
  const restart = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const s = await RealAuthApi.restart(session.id);
      setSession(s); setPhase('waiting'); setMessage('新通道已建立，请继续本人确认。');
      if (!s.mock) { window.location.replace('#/real-auth/' + s.id); window.location.reload(); }
    } catch (e: any) { setMessage(e?.message || '重新发起失败，请稍后再试。'); }
    finally { setBusy(false); }
  };
  const success = phase === 'ready';
  const failed = phase === 'failed';
  return hMR('div', { className: 'm-overlay', 'data-screen-label': '本人确认结果', style: { display: 'flex', flexDirection: 'column' } },
    hMR(CenterNav, { onClose: () => ctx.tab('library') }),
    hMR('div', { className: 'm-body', style: { padding: '10px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { width: 62, height: 62, borderRadius: 20, margin: '8px auto 17px', display: 'grid', placeItems: 'center', background: success ? 'var(--ok-s)' : failed ? 'var(--err-s)' : 'var(--primary-soft)', color: success ? 'var(--ok)' : failed ? 'var(--err)' : 'var(--primary)' } },
          phase === 'loading' || phase === 'waiting' || phase === 'sealing'
            ? hMR(UI.Spinner, { size: 23 })
            : hMR(success ? Icons.check : Icons.warn, { size: 28, stroke: 2.2 })),
        hMR('div', { className: 'mono', style: { fontSize: 10.5, letterSpacing: '.12em', color: 'var(--ink-3)', marginBottom: 7 } }, sessionId),
        hMR('h1', { style: { fontFamily: 'var(--font-disp)', fontSize: 24, margin: '0 0 9px' } },
          success ? '真人素材已入库' : failed ? '本人确认未完成' : '正在确认最终结果'),
        hMR('p', { style: { fontSize: 13.5, color: failed ? 'var(--err)' : 'var(--ink-2)', lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 300 } }, message),
        success && hMR(UI.Button, { variant: 'dark', full: true, size: 'lg', onClick: () => ctx.go('realmaterials') }, '查看真人素材库'),
        phase === 'waiting' && session?.h5Url && hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.scan, onClick: reopen }, '继续本人刷脸确认'),
        failed && session && hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.retry, disabled: busy, onClick: restart }, busy ? '重新建立中…' : '重新发起本人确认'),
        hMR('div', { style: { marginTop: 18, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', textAlign: 'left', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 } },
          '最终状态由服务端向七牛云查询确认，浏览器回跳本身不会直接让授权生效。'))));
}

// —— 外壳：编排 capture → footage → 刷脸认证 → verify → generate ——
//   char 传入既有资产时（授权页 / 资产详情的「去认证」入口）复用该资产，不再新建。
function MRealCapture({ char, ctx, materialOnly = true }) {
  // 入口带进来的既有资产（不是创建向导的空白草稿）
  const existing = char && char.id && char.id !== 'DH-NEW' && !char._fresh ? char : null;
  const [stage, setStage] = useStateMR('intro'); // intro | rec | last | verify | auth | ready
  const [blob, setBlob] = useStateMR(null as any);
  const [blobUrl, setBlobUrl] = useStateMR('');
  const [isImage, setIsImage] = useStateMR(false);
  const [avatar, setAvatar] = useStateMR(existing);
  const [captureId, setCaptureId] = useStateMR('');
  const [stageText, setStageText] = useStateMR('');
  const [pct, setPct] = useStateMR(null as any);
  const [error, setError] = useStateMR('');
  const [busy, setBusy] = useStateMR(false);
  const [phase, setPhase] = useStateMR('upload');  // 进度屏当前所处阶段（决定重试走哪一步）
  const [beauty, setBeauty] = useStateMR(true);    // 美颜预览（仅展示层），默认开
  const nameRef = useRefMR((existing && existing.name) || '');
  // 已经出过形象的资产走「补认证」：认证通过即完成，不重复复刻生成
  const authOnly = materialOnly || !!(existing && existing.imageUrl);
  useEffectMR(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const acceptBlob = (b: Blob | File, image: boolean) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(b);
    setIsImage(image);
    setBlobUrl(URL.createObjectURL(b));
    setStage('last');
  };

  // 1~2 步：建资产 + 捕获会话 + 上传素材 → 进入授权确认与本人刷脸
  const runUpload = async (name: string) => {
    nameRef.current = name;
    setBusy(true); setError(''); setPhase('upload'); setStage('verify'); setPct(5); setStageText('创建资产档案…');
    try {
      const a = avatar || await AvatarApi.create({ path: 'real', name });
      setAvatar(a);
      if (a.name !== name) await AvatarApi.patch(a.id, { name });
      const cap = await CaptureApi.create(a.id);
      setCaptureId(cap.id);
      setPct(22); setStageText('加密上传素材…');
      const fd = new FormData();
      const fname = isImage ? 'capture.png' : 'capture.webm';
      fd.append('file', blob, (blob as any).name || fname);
      await CaptureApi.footage(cap.id, fd);
      setStage('auth');
    } catch (e: any) {
      setError(e?.message || '素材上传失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  // 4 步：复刻生成（认证通过、授权登记后）
  const runGenerate = async (capId: string) => {
    const a = avatar;
    if (!a) { setError('资产信息丢失，请重新开始'); setStage('verify'); return; }
    setBusy(true); setError(''); setPhase('generate'); setStage('verify'); setPct(42); setStageText('复刻数字形象…');
    try {
      const job = await AvatarApi.generate(a.id, { mode: 'upload', captureId: capId });
      await awaitJob(job.id, (j) => { setPct(42 + (j.pct || 0) * 0.55); setStageText(j.eta || '复刻数字形象…'); });
      const fresh = await AvatarApi.get(a.id);
      setAvatar(fresh);
      setPct(100);
      setStage('ready');
      ctx.reload && ctx.reload();
      toast('数字人已生成 · 肖像授权已登记', { tone: 'ok' });
    } catch (e: any) {
      setError(e?.message || '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  // 认证通过 + 授权登记完成
  const onAuthPassed = async () => {
    if (authOnly) {
      const fresh = avatar ? await AvatarApi.get(avatar.id).catch(() => avatar) : avatar;
      setAvatar(fresh);
      setStage('ready');
      ctx.reload && ctx.reload();
      toast('本人确认通过 · 授权证据已登记', { tone: 'ok' });
      return;
    }
    if (materialOnly) {
      const fresh = avatar ? await AvatarApi.get(avatar.id).catch(() => avatar) : avatar;
      setAvatar(fresh);
      setStage('ready');
      ctx.reload && ctx.reload();
      toast('真人素材已提交审核', { tone: 'ok' });
      return;
    }
    toast('本人确认通过 · 授权证据已登记', { tone: 'ok' });
    runGenerate(captureId);
  };

  const continueAdjust = async () => {
    const a = avatar;
    if (!a) { ctx.back(); return; }
    const fresh = await AvatarApi.get(a.id).catch(() => a);
    (ctx.continueAdjust || ctx.realToWizard || ctx.finishCreate)({ ...fresh, _startAdjust: true });
  };

  return hMR('div', { className: 'm-overlay', 'data-screen-label': '真人捕获' },
    stage === 'intro' && hMR(RealIntro, { onClose: ctx.back, subjectName: existing && existing.name,
      onUpload: (f: File) => acceptBlob(f, (f.type || '').startsWith('image/')),
      onReady: () => setStage('rec') }),
    stage === 'rec' && hMR(RealRecording, {
      beauty, onToggleBeauty: () => setBeauty(b => !b),
      onClose: (reason) => setStage('intro'),
      onDone: (b: Blob) => acceptBlob(b, false) }),
    stage === 'last' && hMR(RealLastStep, { defaultName: nameRef.current, blobUrl, isImage, busy, onClose: ctx.back,
      beauty, onToggleBeauty: () => setBeauty(b => !b),
      onRetry: () => setStage('rec'),
      onCreate: (n) => runUpload(n) }),
    stage === 'verify' && hMR(RealVerify, { blobUrl, isImage, beauty, stageText, pct, error,
      onRetry: () => (phase === 'generate' ? runGenerate(captureId) : runUpload(nameRef.current || '我的数字人')),
      onClose: () => { if (!busy) ctx.back(); } }),
    stage === 'auth' && hMR(RealAuth, { captureId, subjectName: avatar && avatar.name, blobUrl, isImage, beauty,
      onPassed: onAuthPassed,
      onClose: ctx.back }),
    stage === 'ready' && hMR(RealReady, { avatar, authOnly, materialOnly, onClose: ctx.back, onContinue: continueAdjust }));
}

export { MRealCapture, MRealAuthResume };
