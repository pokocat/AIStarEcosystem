"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, BUILTIN_VOICES } from "./data";
import { MShell } from "./shell";

// ============================================================
// 移动端 V4 · 选择虚拟形象音色（全屏切屏）
//   内置 AI 合成音色（prompt 驱动大模型）：女声 4 + 男声 3
//   去掉「克隆 / 设计 / 混合 / 导入」，统一为内置智能音色
// ============================================================
const hVP : any = React.createElement;
const { useState: useStateVP } = React;

// 音色行卡
function VoiceCard({ v, on, playing, onSelect, onPlay }) {
  const [showPrompt, setShowPrompt] = useStateVP(false);
  return hVP('div', { onClick: onSelect, className: 'm-tap', style: {
    cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 11,
    border: '1px solid ' + (on ? 'var(--primary)' : 'var(--line)'),
    background: on ? 'var(--primary-tint)' : 'var(--surface)', boxShadow: on ? 'var(--ring)' : 'var(--sh-1)' } },
    hVP('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' } },
      // 试听
      hVP('button', { onClick: (e) => { e && e.stopPropagation(); onPlay(); }, style: {
        width: 42, height: 42, flex: '0 0 42px', borderRadius: 99, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
        background: playing ? 'var(--primary)' : 'var(--primary-soft)', color: playing ? '#fff' : 'var(--primary)' } },
        playing
          ? hVP('span', { style: { display: 'flex', gap: 2.5, alignItems: 'center' } },
              hVP('span', { style: { width: 3, height: 13, background: '#fff', borderRadius: 2, animation: 'vbar .7s ease-in-out infinite' } }),
              hVP('span', { style: { width: 3, height: 9, background: '#fff', borderRadius: 2, animation: 'vbar .7s ease-in-out infinite .2s' } }),
              hVP('span', { style: { width: 3, height: 13, background: '#fff', borderRadius: 2, animation: 'vbar .7s ease-in-out infinite .4s' } }))
          : hVP(Icons.play, { size: 17 })),
      // 名称 + 特点
      hVP('div', { style: { flex: 1, minWidth: 0 } },
        hVP('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          hVP('span', { style: { fontSize: 15, fontWeight: 700 } }, v.name),
          on && hVP('span', { style: { width: 18, height: 18, borderRadius: 99, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', flex: '0 0 auto' } }, hVP(Icons.check, { size: 11, stroke: 3 }))),
        hVP('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, v.traits)),
      // 选择圈
      hVP('span', { style: { width: 22, height: 22, flex: '0 0 22px', borderRadius: 99, border: '2px solid ' + (on ? 'var(--primary)' : 'var(--line-3)'), background: on ? 'var(--primary)' : 'transparent', display: 'grid', placeItems: 'center' } },
        on && hVP('span', { style: { width: 8, height: 8, borderRadius: 99, background: '#fff' } }))),
    // 适用场景 chips
    hVP('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 12px' } },
      v.scenes.map(s => hVP('span', { key: s, style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: on ? 'var(--surface)' : 'var(--surface-3)', padding: '3px 9px', borderRadius: 'var(--r-pill)' } }, s)),
      hVP('button', { onClick: (e) => { e && e.stopPropagation(); setShowPrompt(p => !p); }, style: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', whiteSpace: 'nowrap' } },
        hVP(Icons.sparkle, { size: 11, stroke: 2 }), showPrompt ? '收起提示' : 'AI 音色提示')),
    // 提示词（prompt 驱动大模型）
    showPrompt && hVP('div', { className: 'm-fade', style: { margin: '0 14px 13px', padding: '10px 12px', background: 'var(--ink)', borderRadius: 'var(--r-md)' } },
      hVP('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 } },
        hVP(Icons.bolt, { size: 12, stroke: 2, style: { color: 'var(--primary-500)' } }),
        hVP('span', { style: { fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,.6)' } }, '后台合成提示词')),
      hVP('div', { className: 'mono', style: { fontSize: 11.5, color: 'rgba(255,255,255,.92)', lineHeight: 1.55 } }, v.prompt)));
}

function MChooseVoice({ char, ctx, onPick }) {
  const VOICES = BUILTIN_VOICES || [];
  const [sel, setSel] = useStateVP((char && ctx.voiceFor && ctx.voiceFor(char) && (VOICES.find(v => v.name === ctx.voiceFor(char)) || {}).id) || VOICES[0].id);
  const [playing, setPlaying] = useStateVP(null);
  const [q, setQ] = useStateVP('');

  const match = (v) => !q || (v.name + v.traits + v.scenes.join('')).toLowerCase().includes(q.toLowerCase());
  const females = VOICES.filter(v => v.gender === 'female' && match(v));
  const males = VOICES.filter(v => v.gender === 'male' && match(v));
  const selVoice = VOICES.find(v => v.id === sel) || VOICES[0];

  const section = (label, icon, list) => list.length > 0 && hVP('div', { style: { marginBottom: 6 } },
    hVP('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '0 2px 11px' } },
      hVP('span', { style: { width: 24, height: 24, borderRadius: 7, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' } }, hVP(icon, { size: 14, stroke: 1.9 })),
      hVP('span', { style: { fontFamily: 'var(--font-disp)', fontSize: 15, fontWeight: 800 } }, label),
      hVP('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-4)' } }, list.length)),
    list.map(v => hVP(VoiceCard, { key: v.id, v, on: sel === v.id, playing: playing === v.id,
      onSelect: () => setSel(v.id), onPlay: () => setPlaying(p => p === v.id ? null : v.id) })));

  return hVP('div', { className: 'm-overlay', 'data-screen-label': '选择音色' },
    hVP('div', { className: 'wx-nav', style: { paddingLeft: 18 } },
      hVP('span', { className: 'nav-title', style: { textAlign: 'left', flex: 1, fontSize: 18 } }, '选择音色'),
      hVP('button', { className: 'nav-back m-tap', onClick: ctx.back }, hVP(Icons.x, { size: 22, stroke: 2.2 }))),
    hVP('div', { className: 'm-body', style: { padding: '2px 18px 92px' } },
      hVP('h1', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 7px' } }, '选择 AI 合成音色'),
      hVP('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 16px' } }, '内置智能音色，由 AI 按音色描述实时合成，无需录制；选定后绑定到该数字人。'),
      // 搜索
      hVP('div', { style: { position: 'relative', marginBottom: 18 } },
        hVP(Icons.search, { size: 15, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' } }),
        hVP('input', { value: q, onChange: e => setQ(e.target.value), placeholder: '搜索音色 / 适用场景…', style: { width: '100%', height: 42, padding: '0 14px 0 38px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none', boxShadow: 'var(--sh-1)' } })),
      section('女声', Icons.user, females),
      section('男声', Icons.user, males),
      females.length === 0 && males.length === 0 && hVP('div', { style: { textAlign: 'center', padding: '50px 0', color: 'var(--ink-3)' } },
        hVP('div', { style: { width: 54, height: 54, borderRadius: 99, background: 'var(--surface-3)', color: 'var(--ink-4)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' } }, hVP(Icons.search, { size: 22 })),
        hVP('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink-2)' } }, '没有匹配的音色'))),

    hVP('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', display: 'flex', gap: 11 } },
      hVP(UI.Button, { variant: 'line', onClick: ctx.back }, '取消'),
      hVP(UI.Button, { variant: 'dark', full: true, size: 'lg', onClick: () => { ctx.setVoice(char, selVoice.name); if (onPick) onPick(selVoice.name); ctx.toast('已设为默认音色 · ' + selVoice.name, { tone: 'ok' }); ctx.back(); } }, '设为默认')));
}

export { MChooseVoice };
