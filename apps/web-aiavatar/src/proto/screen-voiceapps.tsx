"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, VoiceApi, AppApi, useApi, seed } from "./api";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 · 声音工作室 Voice + 应用中心 Apps
// ============================================================
const hMV : any = React.createElement;
const { useState: useStateMV, useRef: useRefMV, useEffect: useEffectMV } = React;
const { WxNav: WxNavV } = MShell;
const { MSection: MSectionV } = MKit;

// ============================================================
// 内置 AI 合成音色（prompt 驱动大模型生成）—— 全局共享
//   不再做「克隆 / 设计 / 混合」，统一为后台 prompt → 大模型实时合成音色
// ============================================================

// 声音动作大卡
function VAction({ icon, title, sub, onClick }) {
  return hMV('button', { onClick, className: 'm-tap', style: {
    display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
    hMV('div', { style: { width: 44, height: 44, flex: '0 0 44px', borderRadius: 'var(--r-md)', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } },
      hMV(icon, { size: 21, stroke: 1.9 })),
    hMV('div', { style: { minWidth: 0, flex: 1 } },
      hMV('div', { style: { fontSize: 14.5, fontWeight: 700 } }, title),
      hMV('div', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 2 } }, sub)),
    hMV('div', { style: { color: 'var(--ink-4)', flex: '0 0 auto' } }, hMV(Icons.chevR, { size: 18, stroke: 2 })));
}

function MWave({ data, color = 'var(--primary)', playing }) {
  return hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 2, height: 28, flex: 1, overflow: 'hidden' } },
    data.map((v, i) => hMV('span', { key: i, style: { width: 3, flex: '0 0 3px', height: Math.max(4, v) + 'px', borderRadius: 9, background: color,
      opacity: playing ? 1 : .42, animation: playing ? `pulse ${0.7 + (i % 5) * 0.12}s ease-in-out infinite` : 'none' } })));
}

function VoiceRowM({ v, playing, onPlay, chars }: any) {
  const char = (chars || []).find(c => c.id === v.char);
  const kindLabel = { clone: '真人克隆', design: 'AI 设计' }[v.kind];
  const kindTone = { clone: 'info', design: 'primary' }[v.kind];
  return hMV('div', { className: 'm-card', style: { padding: '12px 14px' } },
    hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      hMV('button', { onClick: () => onPlay(v.id), className: 'm-tap', style: {
        width: 42, height: 42, flex: '0 0 42px', borderRadius: 99, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
        background: playing ? 'var(--primary)' : 'var(--primary-soft)', color: playing ? '#fff' : 'var(--primary)' } },
        playing ? hMV('span', { style: { display: 'flex', gap: 2.5 } }, hMV('span', { style: { width: 3, height: 12, background: '#fff', borderRadius: 2 } }), hMV('span', { style: { width: 3, height: 12, background: '#fff', borderRadius: 2 } })) : hMV(Icons.play, { size: 17 })),
      hMV('div', { style: { minWidth: 0, flex: 1 } },
        hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          hMV('span', { className: 'm-clip1', style: { fontSize: 14.5, fontWeight: 700 } }, v.name),
          v.fav && hMV(Icons.heart, { size: 12, stroke: 2, style: { color: 'var(--err)', flex: '0 0 auto' } })),
        hMV('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, (char ? '绑定 ' + char.name + ' · ' : '') + v.tone)),
      hMV('span', { className: 'mono', style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, flex: '0 0 auto' } }, v.dur)),
    hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 } },
      hMV(MWave, { data: v.wave, playing }),
      hMV(UI.Badge, { tone: kindTone }, kindLabel),
      hMV('span', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, flex: '0 0 auto' } }, v.gender + ' · ' + v.lang.split(' · ')[1])));
}

function MVoice({ ctx }) {
  const [tab, setTab] = useStateMV('builtin');
  const [playing, setPlaying] = useStateMV(null);
  const audioRef = useRefMV(null as any);
  const VOICES = useApi(() => VoiceApi.builtin(), seed.builtinVoices());
  const myVoices = useApi(() => VoiceApi.mine(), seed.myVoices());
  const chars = useApi(() => AvatarApi.list('mine'), seed.avatars());
  useEffectMV(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }, []);

  // 我的克隆声线 → 播放原始采样；内置音色 → 暂无 TTS，提示说明
  const onPlay = (id) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === id) { setPlaying(null); return; }
    const mine: any = myVoices.find((v: any) => v.id === id);
    if (mine) {
      if (mine.audioUrl) {
        const a = new Audio(mine.audioUrl);
        a.onended = () => setPlaying(null);
        a.play().catch(() => ctx.toast('播放失败，请稍后重试', { tone: 'warn' }));
        audioRef.current = a;
        setPlaying(id);
      } else {
        ctx.toast('该声线暂无可播放采样', { tone: 'warn' });
      }
      return;
    }
    // 内置音色
    setPlaying(id);
    ctx.toast('内置音色为合成声线，可直接绑定到数字人资产', { tone: 'ok' });
    setTimeout(() => setPlaying((p) => (p === id ? null : p)), 1800);
  };

  const vrow = (v) => {
    const pl = playing === v.id;
    return hMV('div', { key: v.id, className: 'm-card', style: { padding: '12px 14px', marginBottom: 11 } },
      hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        hMV('button', { onClick: () => onPlay(v.id), className: 'm-tap', style: { width: 42, height: 42, flex: '0 0 42px', borderRadius: 99, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: pl ? 'var(--primary)' : 'var(--primary-soft)', color: pl ? '#fff' : 'var(--primary)' } },
          pl ? hMV('span', { style: { display: 'flex', gap: 2.5 } }, hMV('span', { style: { width: 3, height: 12, background: '#fff', borderRadius: 2, animation: 'vbar .7s ease-in-out infinite' } }), hMV('span', { style: { width: 3, height: 12, background: '#fff', borderRadius: 2, animation: 'vbar .7s ease-in-out infinite .25s' } })) : hMV(Icons.play, { size: 17 })),
        hMV('div', { style: { minWidth: 0, flex: 1 } },
          hMV('div', { style: { fontSize: 14.5, fontWeight: 700 } }, v.name),
          hMV('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, v.traits)),
        hMV('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--surface-3)', padding: '3px 9px', borderRadius: 'var(--r-pill)', flex: '0 0 auto' } }, v.gender === 'female' ? '女声' : '男声')),
      hMV('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 } },
        v.scenes.map(s => hMV('span', { key: s, style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 'var(--r-pill)' } }, s))));
  };

  return hMV('div', { className: 'm-overlay', 'data-screen-label': '声音工作室' },
    hMV(WxNavV, { title: '声音', onBack: ctx.back }),
    hMV('div', { className: 'm-body', style: { padding: '4px 18px 30px' } },
      hMV('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 16px' } },
        '内置 AI 智能音色由大模型按音色描述实时合成，开箱即用；也可克隆本人声线作为专属音色。'),
      hMV('div', { style: { display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 24 } },
        hMV(VAction, { icon: Icons.mic, title: '克隆我的声音', sub: '录一段或上传音频，加密存档为专属声线', onClick: () => ctx.go('voiceclone') })),

      hMV('div', { style: { display: 'flex', gap: 8, marginBottom: 16 } },
        [['builtin', '内置音色'], ['mine', '我的声音']].map(([k, l]) => {
          const on = tab === k;
          return hMV('button', { key: k, onClick: () => setTab(k), style: {
            height: 34, padding: '0 16px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--primary-soft)' : 'var(--surface-3)', color: on ? 'var(--primary)' : 'var(--ink-3)',
            fontSize: 13.5, fontWeight: on ? 700 : 600 } }, l);
        })),

      tab === 'builtin'
        ? hMV('div', { className: 'm-stagger' },
            hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '2px 2px 11px' } },
              hMV('span', { style: { fontFamily: 'var(--font-disp)', fontSize: 14.5, fontWeight: 800 } }, '女声'),
              hMV('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)' } }, VOICES.filter(v => v.gender === 'female').length)),
            VOICES.filter(v => v.gender === 'female').map(vrow),
            hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '16px 2px 11px' } },
              hMV('span', { style: { fontFamily: 'var(--font-disp)', fontSize: 14.5, fontWeight: 800 } }, '男声'),
              hMV('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)' } }, VOICES.filter(v => v.gender === 'male').length)),
            VOICES.filter(v => v.gender === 'male').map(vrow))
        : myVoices.length === 0
          ? hMV('div', { style: { textAlign: 'center', padding: '36px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
              hMV('div', { style: { width: 50, height: 50, borderRadius: 15, margin: '0 auto 13px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMV(Icons.mic, { size: 23 })),
              hMV('div', { style: { fontSize: 14.5, fontWeight: 700, marginBottom: 5 } }, '还没有专属声线'),
              hMV('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, '录 ' + 10 + ' 秒即可克隆你的声音'),
              hMV(UI.Button, { variant: 'primary', icon: Icons.mic, onClick: () => ctx.go('voiceclone') }, '去克隆'))
          : hMV('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 11 } },
              myVoices.map(v => hMV(VoiceRowM, { key: v.id, v, playing: playing === v.id, onPlay, chars })))));
}

// ============================================================
// 应用中心 Apps（应用清单经 AppApi 提供，mock 源见 data.APPLICATIONS）
// ============================================================

function MApps({ ctx }) {
  const M_APPS = useApi(() => AppApi.list(), seed.applications());
  const go = (name) => ctx.toast(name + ' · 当前为邀约开通，请联系客户经理获取权限', { tone: 'warn' });
  const appCardImages = {
    music: '/generated/app-cards/music.jpg',
    live: '/generated/app-cards/live-commerce.jpg',
    drama: '/generated/app-cards/drama.jpg',
  };

  return hMV('div', { className: 'm-body has-tabbar', 'data-screen-label': '应用中心' },
    hMV(WxNavV, { title: '应用中心' }),
    hMV('div', { style: { padding: '2px 18px 0' } },
      hMV('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '子应用复用同一套已定稿的数字人资产，点击前往。')),

    // 竖向应用卡片（与平台子应用一一对应：AI 歌手 / AI 短视频带货 / AI 短剧）
    hMV('div', { className: 'm-stagger', style: { padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 13 } },
      M_APPS.map(a => hMV('button', { key: a.key, onClick: () => go(a.name), className: 'm-press', style: {
        position: 'relative', width: '100%', minHeight: 182, borderRadius: 'var(--r-xl)', overflow: 'hidden', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,.72)', background: '#FDFDFB',
        boxShadow: '0 16px 36px rgba(76,92,125,.10), 0 1px 0 rgba(255,255,255,.9) inset',
        textAlign: 'left', padding: '16px 16px 15px' } },
        hMV('img', { src: appCardImages[a.key] || appCardImages.music, alt: '', draggable: false, loading: 'lazy', decoding: 'async', fetchPriority: 'low', style: {
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .92,
          filter: 'saturate(1.03) contrast(1.01)', pointerEvents: 'none' } }),
        hMV('span', { style: { position: 'absolute', inset: 0, background:
          'linear-gradient(105deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.88) 40%, rgba(255,255,255,.48) 67%, rgba(255,255,255,.14) 100%)' } }),
        hMV('span', { style: { position: 'absolute', inset: 0, background:
          `radial-gradient(circle at 14% 8%, rgba(255,255,255,.88), transparent 34%), radial-gradient(circle at 88% 12%, ${a.accent}66, transparent 34%), linear-gradient(180deg, rgba(255,255,255,.38), transparent 44%, rgba(245,248,255,.36))`,
          mixBlendMode: 'screen', opacity: .86 } }),
        hMV('span', { style: { position: 'absolute', inset: '1px 1px auto', height: '54%', borderRadius: 'calc(var(--r-xl) - 1px) calc(var(--r-xl) - 1px) 0 0',
          background: 'linear-gradient(180deg, rgba(255,255,255,.92), transparent)', pointerEvents: 'none' } }),
        // 头行：icon + 开通状态
        hMV('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          hMV('span', { style: { display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 14,
            background: 'rgba(255,255,255,.72)', color: a.g1, border: '1px solid rgba(255,255,255,.86)',
            boxShadow: `0 10px 24px ${a.accent}4D, 0 1px 0 rgba(255,255,255,.9) inset`, backdropFilter: 'blur(8px)' } }, hMV(Icons[a.icon], { size: 20, stroke: 1.9 })),
          hMV('span', { style: { fontSize: 10, fontWeight: 800, color: 'rgba(34,43,58,.68)', background: 'rgba(255,255,255,.68)',
            border: '1px solid rgba(255,255,255,.78)', padding: '4px 10px', borderRadius: 'var(--r-pill)', boxShadow: '0 8px 18px rgba(70,86,118,.08)', backdropFilter: 'blur(8px)' } }, '邀约开通')),
        // 名称 + 描述
        hMV('div', { style: { position: 'relative', marginTop: 12 } },
          hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
            hMV('span', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 21, color: 'var(--ink)', letterSpacing: '-.02em', textShadow: '0 1px 0 rgba(255,255,255,.75)' } }, a.name),
            hMV(Icons.external, { size: 14, stroke: 2, style: { color: 'rgba(34,43,58,.42)' } })),
          hMV('div', { style: { fontSize: 12.5, color: 'rgba(37,47,62,.72)', marginTop: 5, lineHeight: 1.5, fontWeight: 600, maxWidth: '74%', minHeight: 38, textShadow: '0 1px 0 rgba(255,255,255,.7)' } }, a.blurb)),
        // 能力标签
        hMV('div', { style: { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 } },
          (a.tools || []).map((t, i) => hMV('span', { key: i, style: {
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'rgba(34,43,58,.74)',
            background: 'rgba(255,255,255,.66)', border: '1px solid rgba(255,255,255,.78)', padding: '4px 10px',
            borderRadius: 'var(--r-pill)', boxShadow: '0 8px 18px rgba(70,86,118,.08)', backdropFilter: 'blur(8px)' } },
            hMV(Icons[t.icon] || Icons.sparkle, { size: 12, stroke: 2, style: { color: a.g1 } }), t.name)))))));
}

export { MVoice };
export { MApps };
