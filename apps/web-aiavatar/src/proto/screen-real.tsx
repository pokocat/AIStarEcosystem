"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";
import { Portrait } from "./portrait";
import { MShell } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 真人复刻 全流程（全屏切屏，非浮窗）
//   录制引导 → 倒计时+提词器录制 → 最后一步(检查+命名) → 身份核验 → 就绪+选声音
//   布局参考截图：Last step / Verify identity / Your Avatar is ready
// ============================================================
const hMR : any = React.createElement;
const { useState: useStateMR, useEffect: useEffectMR } = React;

const SCRIPT = '嗨，大家好！我正充满活力地说话，同时保持自然与自信。这样能帮助系统更好地捕捉我的声音、表情与动作，让数字分身在任何视频里都像我本人。准备好了，我们开始吧！';
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

// 顶部居中导航（X 关闭，标题居中下方）—— 截图式
function CenterNav({ onClose, mode = 'x' }) {
  return hMR('div', { className: 'wx-nav', style: { paddingLeft: 8, flex: '0 0 auto' } },
    mode === 'x'
      ? hMR('button', { className: 'nav-back m-tap', onClick: onClose }, hMR(Icons.x, { size: 22, stroke: 2.2 }))
      : hMR('button', { className: 'nav-back m-tap', onClick: onClose }, hMR(Icons.chevL, { size: 24, stroke: 2.2 })),
    hMR('span', { className: 'nav-title' }),
    hMR('span', { className: 'nav-spacer' }));
}

// 取景框（四角 + 人形剪影）
function CameraStage({ recording, label, dim, ratio = '3 / 4' }) {
  return hMR('div', { style: { position: 'relative', width: '100%', aspectRatio: ratio, borderRadius: 'var(--r-xl)', overflow: 'hidden',
    background: 'radial-gradient(120% 90% at 50% 30%, #2A3A47, #0E171F 75%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' } },
    hMR('div', { style: { position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: '58%', opacity: dim ? .28 : .48, color: '#7E97A8' } },
      hMR('svg', { viewBox: '0 0 100 130', width: '100%', fill: 'currentColor' },
        hMR('circle', { cx: 50, cy: 38, r: 24 }),
        hMR('path', { d: 'M8 130c0-26 18-44 42-44s42 18 42 44z' }))),
    [{ t: 14, l: 14 }, { t: 14, r: 14, rot: 90 }, { b: 14, r: 14, rot: 180 }, { b: 14, l: 14, rot: 270 }].map((p, i) =>
      hMR('span', { key: i, style: { position: 'absolute', top: p.t, bottom: p.b, left: p.l, right: p.r, width: 24, height: 24,
        borderTop: '2.5px solid rgba(255,255,255,.85)', borderLeft: '2.5px solid rgba(255,255,255,.85)', borderRadius: '5px 0 0 0',
        transform: `rotate(${p.rot || 0}deg)`, transformOrigin: 'center' } })),
    hMR('div', { style: { position: 'absolute', top: 13, left: 0, right: 0, display: 'flex', justifyContent: 'center' } },
      recording
        ? hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'rgba(244,63,119,.92)', color: '#fff', fontSize: 12, fontWeight: 700 } },
            hMR('span', { style: { width: 8, height: 8, borderRadius: 99, background: '#fff', animation: 'pulse 1s infinite' } }), 'REC')
        : hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'rgba(20,30,40,.55)', backdropFilter: 'blur(6px)', color: '#7DF0B6', fontSize: 12, fontWeight: 600 } },
            hMR('span', { style: { width: 7, height: 7, borderRadius: 99, background: '#3DD68C' } }), '摄像头就绪')),
    label && hMR('div', { style: { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.78)', fontWeight: 500 } }, label));
}

// 录制完成后的「视频回放」卡（静帧 + 播放条）—— 截图式
function VideoReview({ badge, onDelete }) {
  return hMR('div', { style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
    hMR(CameraStage, { ratio: '4 / 3', dim: true }),
    badge && hMR('span', { style: { position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', fontSize: 12, fontWeight: 700 } },
      hMR(Icons.lock, { size: 13, stroke: 2 }), badge),
    onDelete && hMR('button', { onClick: onDelete, className: 'm-tap', style: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.92)', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMR(Icons.trash, { size: 16, stroke: 1.9 })),
    // 播放条
    hMR('div', { style: { position: 'absolute', left: 10, right: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-pill)', background: 'rgba(20,30,40,.55)', backdropFilter: 'blur(8px)' } },
      hMR('span', { style: { color: '#fff', display: 'grid', placeItems: 'center' } }, hMR(Icons.play, { size: 16 })),
      hMR('div', { style: { flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.28)', position: 'relative' } },
        hMR('span', { style: { position: 'absolute', left: 0, top: -3, width: 10, height: 10, borderRadius: 99, background: '#fff' } })),
      hMR('span', { className: 'mono', style: { color: 'rgba(255,255,255,.85)', fontSize: 11 } }, '00:12')));
}

// —— intro：录制引导 ——
function RealIntro({ onReady, onUpload, onClose }) {
  const [lang, setLang] = useStateMR('中文');
  const [coach, setCoach] = useStateMR(true);
  return hMR('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '4px 20px 0' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 } },
          hMR(Icons.bolt, { size: 13, stroke: 2 }), '约 15 秒完成捕获'),
        hMR('h1', { style: { fontSize: 25, lineHeight: 1.16, letterSpacing: '-.02em', fontWeight: 800, margin: '0 0 8px' } }, '录一段动作，', hMR('br', null), '生成你的数字分身'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 } },
          '正对镜头朗读屏幕脚本即可，录一次便可在该形象的任意造型中复用。也可 ',
          hMR('button', { onClick: onUpload, style: { background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 700, fontSize: 13.5, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' } }, '上传已有素材'),
          ' 。')),
      hMR('div', { style: { margin: '16px 0 0' } }, hMR(CameraStage, { label: '将面部置于取景框中央' })),
      hMR('div', { style: { display: 'flex', gap: 8, margin: '14px 0 0' } },
        TIPS.map(t => hMR('div', { key: t.icon, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 7, padding: '13px 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
          hMR('div', { style: { width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, ' + t.color + ' 14%, transparent)', color: t.color } }, tipIcon(t.icon, 18)),
          hMR('div', { style: { fontSize: 12, fontWeight: 700 } }, t.title),
          hMR('div', { style: { fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.35 } }, t.desc)))),
      hMR('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 15px', margin: '12px 0 0', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
        hMR('div', { style: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 } },
          hMR(Icons.type, { size: 18, style: { color: 'var(--ink-3)', flex: '0 0 auto' } }),
          hMR('span', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 } }, '屏幕将提供口播脚本')),
        hMR('div', { style: { display: 'flex', gap: 6, flex: '0 0 auto' } },
          ['中文', 'EN'].map(l => hMR('button', { key: l, onClick: () => setLang(l), style: { height: 30, padding: '0 12px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: lang === l ? 'var(--ink)' : 'var(--surface-3)', color: lang === l ? '#fff' : 'var(--ink-3)' } }, l)))),
      hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '12px 0 0', padding: '11px 13px', background: 'var(--ok-s)', border: '1px solid color-mix(in oklab, var(--ok) 24%, transparent)', borderRadius: 'var(--r-md)' } },
        hMR(Icons.shield, { size: 15, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
        hMR('span', { style: { fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, '录制即代表本人知情同意，素材将加密存档并用于生成肖像授权凭证。'))),
    hMR('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 20px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 } },
      hMR(UI.Button, { variant: 'line', onClick: onUpload, icon: Icons.upload }, '上传'),
      hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.film, onClick: onReady }, '我准备好了')),
    coach && hMR('div', { style: { position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(11,22,32,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 26px', animation: 'mSheetFade .2s ease both' } },
      hMR('div', { className: 'm-fade', style: { width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '22px 20px 20px', boxShadow: 'var(--sh-3)', textAlign: 'center' } },
        hMR('div', { style: { width: 54, height: 54, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMR(Icons.film, { size: 26 })),
        hMR('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, marginBottom: 6 } }, '录制前的小指引'),
        hMR('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' } }, '跟读屏幕脚本、保持正脸与活力，约 15 秒即可完成。'),
        hMR('div', { style: { display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 20, textAlign: 'left' } },
          TIPS.map(t => hMR('div', { key: t.icon, style: { display: 'flex', alignItems: 'center', gap: 12 } },
            hMR('div', { style: { width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, ' + t.color + ' 14%, transparent)', color: t.color } }, tipIcon(t.icon, 19)),
            hMR('div', { style: { minWidth: 0 } },
              hMR('div', { style: { fontSize: 14, fontWeight: 700 } }, t.title),
              hMR('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 1 } }, t.desc))))),
        hMR(UI.Button, { variant: 'primary', full: true, size: 'lg', onClick: () => setCoach(false) }, '知道了，开始准备'))));
}

// —— 录制：倒计时 + 提词器 ——
function RealRecording({ onDone, onClose }) {
  const [count, setCount] = useStateMR(3);
  const [phase, setPhase] = useStateMR('count');
  const [progress, setProgress] = useStateMR(0);

  useEffectMR(() => {
    if (phase !== 'count') return;
    if (count === 0) { setPhase('rec'); return; }
    const t = setTimeout(() => setCount(c => c - 1), 850);
    return () => clearTimeout(t);
  }, [count, phase]);
  useEffectMR(() => {
    if (phase !== 'rec') return;
    const iv = setInterval(() => setProgress(p => { const n = Math.min(100, p + 100 / 60); if (n >= 100) { clearInterval(iv); setTimeout(onDone, 400); } return n; }), 100);
    return () => clearInterval(iv);
  }, [phase]);

  const read = Math.floor((progress / 100) * SCRIPT.length);
  const secs = Math.floor(progress / 100 * 6);

  return hMR('div', { style: { position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0B1620' } },
    // 顶部：录制时间 + 关闭（右上，截图式）
    hMR('div', { className: 'wx-nav', style: { paddingLeft: 16, justifyContent: 'flex-end', gap: 10 } },
      phase === 'rec' && hMR('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 99, background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 13, fontWeight: 700 } },
        hMR('span', { style: { width: 9, height: 9, borderRadius: 99, background: 'var(--err)', animation: 'pulse 1s infinite' } }), hMR('span', { className: 'mono' }, '0:' + String(secs).padStart(2, '0'))),
      hMR('button', { className: 'm-tap', onClick: onClose, style: { width: 36, height: 36, borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.12)', color: '#fff', display: 'grid', placeItems: 'center' } }, hMR(Icons.x, { size: 20, stroke: 2.2 }))),

    hMR('div', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 16px', overflow: 'hidden' } },
      // 提词器
      hMR('div', { style: { flex: '0 0 auto', background: 'rgba(255,255,255,.08)', borderRadius: 'var(--r-lg)', padding: '20px 20px', marginBottom: 14 } },
        hMR('p', { style: { fontSize: 18, lineHeight: 1.7, fontWeight: 600, margin: 0, textAlign: 'center' } },
          hMR('span', { style: { color: '#fff' } }, SCRIPT.slice(0, read)),
          hMR('span', { style: { color: 'rgba(255,255,255,.34)' } }, SCRIPT.slice(read)))),
      // 摄像头
      hMR('div', { style: { flex: 1, minHeight: 0, position: 'relative' } },
        hMR(CameraStage, { recording: phase === 'rec' }),
        phase === 'count' && hMR('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(11,22,32,.5)', borderRadius: 'var(--r-xl)' } },
          hMR('div', { key: count, style: { fontFamily: 'var(--font-disp)', fontSize: 96, fontWeight: 800, color: '#fff', lineHeight: 1, animation: 'mScaleIn .3s ease both' } }, count === 0 ? '开始' : count)))),

    hMR('div', { style: { flex: '0 0 auto', padding: '14px 20px calc(16px + var(--home-ind))' } },
      hMR('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12, color: '#FFD36B', fontSize: 13.5, fontWeight: 600 } },
        hMR(Icons.zap, { size: 16, stroke: 2 }), '记得充满活力地说话'),
      phase === 'rec'
        ? hMR('div', { style: { height: 6, borderRadius: 99, background: 'rgba(255,255,255,.14)', overflow: 'hidden' } },
            hMR('div', { style: { height: '100%', width: progress + '%', background: 'var(--grad)', borderRadius: 99, transition: 'width .1s linear' } }))
        : hMR('div', { style: { textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,.5)' } }, '即将开始，请正对镜头…')));
}

// —— 最后一步：检查录制 + 命名（截图 Last step）——
function RealLastStep({ defaultName, onCreate, onRetry, onClose }) {
  const [name, setName] = useStateMR(defaultName || '我的数字人');
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('h1', { style: { fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, '最后一步！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 22px', maxWidth: 280 } }, '检查录制内容，确认无误后即可生成你的数字人。'),
        hMR(VideoReview, { badge: '肖像已保护', onDelete: onRetry }),
        hMR('div', { style: { textAlign: 'left', marginTop: 22 } },
          hMR('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 8 } }, '为你的数字人命名'),
          hMR(UI.Input, { value: name, onChange: setName, placeholder: '输入名称' })))),
    hMR('div', { style: { flex: '0 0 auto', padding: '12px 22px calc(14px + var(--home-ind))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 } },
      hMR(UI.Button, { variant: 'dark', size: 'lg', onClick: () => onCreate(name), style: { minWidth: 200 } }, '生成数字人'),
      hMR('button', { onClick: onRetry, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' } }, '重新录制')));
}

// —— 身份核验（截图 Verify identity）——
function RealVerify({ onDone, onClose }) {
  useEffectMR(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 0', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('h1', { style: { fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 14px' } }, '身份核验中'),
        hMR('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22 } },
          hMR(UI.Spinner, { size: 18 }),
          hMR('span', { style: { fontSize: 13.5, color: 'var(--ink-2)' } }, '正在确认你的授权同意，预计 30–60 秒')),
        hMR(VideoReview, { badge: '肖像已保护' }),
        hMR('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', textAlign: 'left' } },
          hMR(Icons.shield, { size: 16, style: { color: 'var(--ok)', flex: '0 0 auto', marginTop: 1 } }),
          hMR('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 } }, '系统将比对录制中的口令与人脸，确保是本人且知情同意，随后加密存档生成授权凭证。')))));
}

// —— 就绪 + 选择声音（截图 Your Avatar is ready）——
function RealReady({ name, onPickVoice, onClose }) {
  return hMR('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } },
    hMR(CenterNav, { onClose }),
    hMR('div', { className: 'm-body', style: { padding: '2px 22px 28px', textAlign: 'center' } },
      hMR('div', { className: 'm-fade' },
        hMR('div', { style: { width: 64, height: 64, margin: '4px auto 18px', position: 'relative', display: 'grid', placeItems: 'center' } },
          hMR('div', { style: { position: 'absolute', inset: 8, borderRadius: 99, background: 'var(--primary-soft)' } }),
          hMR('div', { style: { position: 'relative', width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff' } }, hMR(Icons.check, { size: 24, stroke: 2.6 }))),
        hMR('h1', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' } }, '你的数字人已就绪！'),
        hMR('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 24px', maxWidth: 260 } }, '为它选择一个声音，即可开始创作视频。'),
        // 全新声音
        hMR('div', { style: { textAlign: 'left', padding: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)', marginBottom: 14 } },
          hMR('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 } },
            hMR('span', { style: { fontSize: 15.5, fontWeight: 700 } }, '全新声音'),
            hMR(UI.Badge, { tone: 'ok' }, '推荐')),
          hMR('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '单独克隆一段声音，获得与你最接近的声线效果。'),
          hMR(UI.Button, { variant: 'dark', full: true, size: 'lg', icon: Icons.mic, onClick: () => onPickVoice('new') }, '录制声音')),
        // 从录制提取
        hMR('div', { style: { textAlign: 'left', padding: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
          hMR('div', { style: { fontSize: 15.5, fontWeight: 700, marginBottom: 12 } }, '从录制中提取'),
          hMR('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', marginBottom: 14 } },
            hMR('span', { style: { color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hMR(Icons.play, { size: 17 })),
            hMR('div', { style: { flex: 1, height: 4, borderRadius: 99, background: 'var(--line-2)', position: 'relative' } },
              hMR('span', { style: { position: 'absolute', left: 0, top: -3, width: 10, height: 10, borderRadius: 99, background: 'var(--ink-2)' } })),
            hMR('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)' } }, '0:08')),
          hMR(UI.Button, { variant: 'line', full: true, size: 'lg', onClick: () => onPickVoice('footage') }, '使用此声音')))),
    hMR('div', { style: { flex: '0 0 auto', padding: '8px 22px calc(14px + var(--home-ind))', textAlign: 'center' } },
      hMR('button', { onClick: () => onPickVoice('skip'), style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-3)' } }, '稍后再说')));
}

// —— 外壳 ——
function MRealCapture({ char, ctx }) {
  const [stage, setStage] = useStateMR('intro'); // intro | rec | last | verify | ready
  const [name, setName] = useStateMR('我的数字人');
  const finish = () => ctx.finishCreate({ ...char, name, status: 'archived', _captured: true });
  return hMR('div', { className: 'm-overlay', 'data-screen-label': '真人捕获' },
    stage === 'intro' && hMR(RealIntro, { onClose: ctx.back, onUpload: () => setStage('last'), onReady: () => setStage('rec') }),
    stage === 'rec' && hMR(RealRecording, { onClose: ctx.back, onDone: () => setStage('last') }),
    stage === 'last' && hMR(RealLastStep, { defaultName: name, onClose: ctx.back, onRetry: () => setStage('rec'), onCreate: (n) => { setName(n); toast('正在生成数字人…'); setStage('verify'); } }),
    stage === 'verify' && hMR(RealVerify, { onClose: ctx.back, onDone: () => setStage('ready') }),
    stage === 'ready' && hMR(RealReady, { name, onClose: finish,
      onPickVoice: (kind) => { if (kind === 'new') { ctx.go('voiceclone'); } else { toast(kind === 'footage' ? '已使用录制声音' : '已创建，稍后可配音', { tone: 'ok' }); finish(); } } }));
}

export { MRealCapture };
