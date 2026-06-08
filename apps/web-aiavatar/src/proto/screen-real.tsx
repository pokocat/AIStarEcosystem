"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, CaptureApi, awaitJob, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 真人复刻 全流程（全屏切屏）
//   录制引导 → 倒计时+提词器录制（真实摄像头） → 最后一步(回放+命名)
//   → 身份核验（上传素材+verify+生成） → 就绪+选声音
//   live：create avatar → capture → footage → verify(自动登记授权) → generate(upload)
// ============================================================
const hMR : any = React.createElement;
const { useState: useStateMR, useEffect: useEffectMR, useRef: useRefMR } = React;

const SCRIPT = '嗨，大家好！我正充满活力地说话，同时保持自然与自信。这样能帮助系统更好地捕捉我的声音、表情与动作，让数字分身在任何视频里都像我本人。准备好了，我们开始吧！';
const REC_SECONDS = 12;
const TIPS = [
  { icon: 'sun', title: '光线充足', desc: '正面均匀打光，避免逆光', color: 'var(--ink-2)' },
  { icon: 'scan', title: '正脸入框', desc: '面部居中、肩部以上入镜', color: 'var(--primary)' },
  { icon: 'zap', title: '充满活力', desc: '表情自然、语气有精神', color: 'var(--ink-2)' },
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

// 取景框（四角 + 真实视频流 / 人形剪影兜底）
function CameraStage({ recording, label, dim, ratio = '3 / 4', videoRef, hasStream }) {
  return hMR('div', { style: { position: 'relative', width: '100%', aspectRatio: ratio, borderRadius: 'var(--r-xl)', overflow: 'hidden',
    background: 'radial-gradient(120% 90% at 50% 30%, #2A3A47, #0E171F 75%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' } },
    videoRef && hMR('video', { ref: videoRef, autoPlay: true, muted: true, playsInline: true, style: {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
      display: hasStream ? 'block' : 'none' } }),
    !hasStream && hMR('div', { style: { position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '58%', opacity: dim ? .28 : .48, color: '#7E97A8' } },
      hMR('svg', { viewBox: '0 0 100 130', width: '100%', fill: 'currentColor' },
        hMR('circle', { cx: 50, cy: 38, r: 24 }),
        hMR('path', { d: 'M8 130c0-26 18-44 42-44s42 18 42 44z' }))),
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

// 录制完成后的「视频回放」卡（真实 blob 回放）
function VideoReview({ badge, onDelete, blobUrl, isImage }) {
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
          ? hMR('img', { src: blobUrl, alt: '素材预览', style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' } })
          : hMR('video', { ref: vref, src: blobUrl, playsInline: true, onEnded: () => setPlaying(false), style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' } }))
      : hMR('div', { style: { width: '100%', aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', color: '#7E97A8' } },
          hMR(Icons.film, { size: 38 })),
    badge && hMR('span', { style: { position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', fontSize: 12, fontWeight: 700 } },
      hMR(Icons.lock, { size: 13, stroke: 2 }), badge),
    onDelete && hMR('button', { onClick: onDelete, className: 'm-tap', style: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMR(Icons.trash, { size: 16, stroke: 1.9 })),
    blobUrl && !isImage && hMR('button', { onClick: togglePlay, style: { position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'rgba(20,30,40,.6)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 700 } },
      hMR(playing ? Icons.bolt : Icons.play, { size: 14 }), playing ? '播放中' : '回放'));
}

// —— intro：录制引导 ——
function RealIntro({ onReady, onUpload, onClose }) {
  const [coach, setCoach] = useStateMR(true);
  const fileRef = useRefMR(null as any);
  return hMR('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR('input', { ref: fileRef, type: 'file', accept: 'video/*,image/*', style: { display: 'none' },
      onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) onUpload(f); } }),
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '4px 20px 0' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 } },
          hMR(Icons.bolt, { size: 13, stroke: 2 }), '约 ' + REC_SECONDS + ' 秒完成捕获'),
        hMR('h1', { style: { fontSize: 25, lineHeight: 1.16, letterSpacing: '-.02em', fontWeight: 800, margin: '0 0 8px' } }, '录一段动作，', hMR('br', null), '生成你的数字分身'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 } },
          '正对镜头朗读屏幕脚本即可，录一次便可在该形象的任意造型中复用。也可 ',
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
        hMR('span', { style: { fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, '录制即代表本人知情同意，素材将加密存档并用于生成肖像授权凭证。'))),
    hMR('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 20px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 } },
      hMR(UI.Button, { variant: 'line', onClick: () => fileRef.current && fileRef.current.click(), icon: Icons.upload, style: { flex: '0 0 88px', padding: '0 12px' } }, '上传'),
      hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.film, onClick: onReady, style: { flex: '1 1 0', width: 'auto', padding: '0 14px' } }, '准备好了')),
    coach && hMR('div', { style: { position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(11,22,32,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px', animation: 'mSheetFade .2s ease both' } },
      hMR('div', { className: 'm-fade', style: { width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '22px 20px 20px', boxShadow: 'var(--sh-3)', textAlign: 'center' } },
        hMR('div', { style: { width: 54, height: 54, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMR(Icons.film, { size: 26 })),
        hMR('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, marginBottom: 6 } }, '录制前的小指引'),
        hMR('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' } }, '跟读屏幕脚本、保持正脸与活力，约 ' + REC_SECONDS + ' 秒即可完成。'),
        hMR('div', { style: { display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 20, textAlign: 'left' } },
          TIPS.map(t => hMR('div', { key: t.icon, style: { display: 'flex', alignItems: 'center', gap: 12 } },
            hMR('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, ' + t.color + ' 14%, transparent)', color: t.color } }, tipIcon(t.icon, 19)),
            hMR('div', { style: { minWidth: 0 } },
              hMR('div', { style: { fontSize: 14, fontWeight: 700 } }, t.title),
              hMR('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 1 } }, t.desc))))),
        hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', onClick: () => setCoach(false) }, '知道了，开始准备'))));
}

// —— 录制：倒计时 + 提词器（真实 getUserMedia + MediaRecorder）——
function RealRecording({ onDone, onClose }) {
  const [count, setCount] = useStateMR(3);
  const [phase, setPhase] = useStateMR('count');
  const [progress, setProgress] = useStateMR(0);
  const [hasStream, setHasStream] = useStateMR(false);
  const videoRef = useRefMR(null as any);
  const streamRef = useRefMR(null as any);
  const recRef = useRefMR(null as any);
  const chunksRef = useRefMR([] as any[]);
  const doneRef = useRefMR(false);

  // 申请摄像头（失败 → 引导上传，不留死路）
  useEffectMR(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: true });
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

  const read = Math.floor((progress / 100) * SCRIPT.length);
  const secs = Math.floor(progress / 100 * REC_SECONDS);
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
      hMR('div', { style: { flex: '0 0 auto', background: 'rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: '20px 20px', marginBottom: 14 } },
        hMR('p', { style: { fontSize: 18, lineHeight: 1.7, fontWeight: 600, margin: 0, textAlign: 'center' } },
          hMR('span', { style: { color: '#fff' } }, SCRIPT.slice(0, read)),
          hMR('span', { style: { color: 'rgba(255,255,255,.34)' } }, SCRIPT.slice(read)))),
      hMR('div', { style: { flex: 1, minHeight: 0, position: 'relative' } },
        hMR(CameraStage, { recording: phase === 'rec', videoRef, hasStream }),
        phase === 'count' && hMR('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(11,22,32,.5)', borderRadius: 'var(--r-xl)', zIndex: 3 } },
          hMR('div', { key: count, style: { fontFamily: 'var(--font-disp)', fontSize: 96, fontWeight: 800, color: '#fff', lineHeight: 1, animation: 'mScaleIn .3s ease both' } }, hasStream ? (count === 0 ? '开始' : count) : '…')))),

    hMR('div', { style: { flex: '0 0 auto', padding: '14px 20px calc(16px + var(--home-ind))' } },
      hMR('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12, color: '#FFD36B', fontSize: 13.5, fontWeight: 600 } },
        hMR(Icons.zap, { size: 16, stroke: 2 }), '记得充满活力地说话'),
      phase === 'rec'
        ? hMR('div', { style: { height: 6, borderRadius: 99, background: 'rgba(255,255,255,.14)', overflow: 'hidden' } },
            hMR('div', { style: { height: '100%', width: progress + '%', background: 'var(--grad)', borderRadius: 99, transition: 'width .1s linear' } }))
        : hMR('div', { style: { textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.5)' } }, hasStream ? '即将开始，请正对镜头…' : '正在请求摄像头权限…')));
}

// —— 最后一步：检查录制 + 命名 ——
function RealLastStep({ defaultName, blobUrl, isImage, onCreate, onRetry, onClose, busy }) {
  const [name, setName] = useStateMR(defaultName || '');
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('h1', { style: { fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, '最后一步！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 22px', maxWidth: 280 } }, '检查素材，确认无误后即可生成你的数字人。'),
        hMR(VideoReview, { badge: '肖像已保护', blobUrl, isImage, onDelete: onRetry }),
        hMR('div', { style: { textAlign: 'left', marginTop: 22 } },
          hMR('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 8 } }, '为你的数字人命名'),
          hMR(UI.Input, { value: name, onChange: setName, placeholder: '输入名称' })))),
    hMR('div', { style: { flex: '0 0 auto', padding: '12px 22px calc(14px + var(--home-ind))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 } },
      hMR(UI.Button, { variant: 'dark', size: 'lg', disabled: busy || !name.trim(), onClick: () => onCreate(name.trim()), style: { minWidth: 200 } }, busy ? '处理中…' : '生成数字人'),
      hMR('button', { onClick: onRetry, disabled: busy, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' } }, '重新录制')));
}

// —— 身份核验 + 生成（真实管线进度）——
function RealVerify({ blobUrl, isImage, stageText, pct, error, onRetry, onClose }) {
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
        hMR(VideoReview, { badge: '肖像已保护', blobUrl, isImage }),
        hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', textAlign: 'left' } },
          hMR(Icons.shield, { size: 16, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
          hMR('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '系统将核验素材与授权同意，加密存档并自动生成电子授权凭证，然后保持身份一致地复刻数字形象。')))));
}

// —— 就绪 + 选择声音 ——
function RealReady({ avatar, onContinue, onClose }) {
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { width: 64, height: 64, margin: '4px auto 18px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hMR('div', { style: { position: 'absolute', inset: 8, borderRadius: 99, background: 'var(--primary-soft)' } }),
          hMR('div', { style: { position: 'relative', width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMR(Icons.check, { size: 24, stroke: 2.6 }))),
        hMR('h1', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, '你的数字人已就绪！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 20px', maxWidth: 260 } }, '下一步可精调脸型、肤质与滤镜，满意后再保存到名录。'),
        avatar && avatar.imageUrl && hMR('div', { style: { width: 170, margin: '0 auto 20px', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
          hMR(Portrait, { char: avatar, variant: 'key', ratio: '4 / 5', expr: 'calm' })),
        hMR(UI.Button, { variant: 'dark', full: true, size: 'lg', icon: Icons.sliders, onClick: onContinue }, '继续精调'))),
    hMR('div', { style: { flex: '0 0 auto', padding: '8px 22px calc(14px + var(--home-ind))', textAlign: 'center' } },
      hMR('button', { onClick: onClose, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-3)' } }, '稍后再说')));
}

// —— 外壳：编排 capture → footage → verify → generate ——
function MRealCapture({ char, ctx }) {
  const [stage, setStage] = useStateMR('intro'); // intro | rec | last | verify | ready
  const [blob, setBlob] = useStateMR(null as any);
  const [blobUrl, setBlobUrl] = useStateMR('');
  const [isImage, setIsImage] = useStateMR(false);
  const [avatar, setAvatar] = useStateMR(null as any);
  const [stageText, setStageText] = useStateMR('');
  const [pct, setPct] = useStateMR(null as any);
  const [error, setError] = useStateMR('');
  const [busy, setBusy] = useStateMR(false);
  const nameRef = useRefMR('');
  useEffectMR(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const acceptBlob = (b: Blob | File, image: boolean) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(b);
    setIsImage(image);
    setBlobUrl(URL.createObjectURL(b));
    setStage('last');
  };

  const runPipeline = async (name: string) => {
    nameRef.current = name;
    setBusy(true); setError(''); setStage('verify'); setPct(5); setStageText('创建资产档案…');
    try {
      // 1. 资产 + 捕获会话
      const a = avatar || await AvatarApi.create({ path: 'real', name });
      setAvatar(a);
      if (a.name !== name) await AvatarApi.patch(a.id, { name });
      const cap = await CaptureApi.create(a.id);
      // 2. 上传素材
      setPct(18); setStageText('加密上传素材…');
      const fd = new FormData();
      const fname = isImage ? 'capture.png' : 'capture.webm';
      fd.append('file', blob, (blob as any).name || fname);
      await CaptureApi.footage(cap.id, fd);
      // 3. 身份核验（自动登记授权）
      setPct(34); setStageText('身份核验 · 登记电子授权…');
      await CaptureApi.verify(cap.id);
      // 4. 复刻生成
      setPct(42); setStageText('复刻数字形象…');
      const job = await AvatarApi.generate(a.id, { mode: 'upload', captureId: cap.id });
      await awaitJob(job.id, (j) => { setPct(42 + (j.pct || 0) * 0.55); setStageText(j.eta || '复刻数字形象…'); });
      const fresh = await AvatarApi.get(a.id);
      setAvatar(fresh);
      setPct(100);
      setStage('ready');
      toast('数字人已生成 · 肖像授权已保存', { tone: 'ok' });
    } catch (e: any) {
      setError(e?.message || '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const continueAdjust = async () => {
    const a = avatar;
    if (!a) { ctx.back(); return; }
    const fresh = await AvatarApi.get(a.id).catch(() => a);
    (ctx.continueAdjust || ctx.realToWizard || ctx.finishCreate)({ ...fresh, _startAdjust: true });
  };

  return hMR('div', { className: 'm-overlay', 'data-screen-label': '真人捕获' },
    stage === 'intro' && hMR(RealIntro, { onClose: ctx.back,
      onUpload: (f: File) => acceptBlob(f, (f.type || '').startsWith('image/')),
      onReady: () => setStage('rec') }),
    stage === 'rec' && hMR(RealRecording, {
      onClose: (reason) => setStage('intro'),
      onDone: (b: Blob) => acceptBlob(b, false) }),
    stage === 'last' && hMR(RealLastStep, { defaultName: nameRef.current, blobUrl, isImage, busy, onClose: ctx.back,
      onRetry: () => setStage('rec'),
      onCreate: (n) => runPipeline(n) }),
    stage === 'verify' && hMR(RealVerify, { blobUrl, isImage, stageText, pct, error,
      onRetry: () => runPipeline(nameRef.current || '我的数字人'),
      onClose: () => { if (!busy) ctx.back(); } }),
    stage === 'ready' && hMR(RealReady, { avatar, onClose: ctx.back, onContinue: continueAdjust }));
}

export { MRealCapture };
