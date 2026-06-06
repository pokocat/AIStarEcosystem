"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, BUILTIN_VOICES } from "./data";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 · 声音工作室 Voice + 应用中心 Apps
// ============================================================
const hMV : any = React.createElement;
const { useState: useStateMV } = React;
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

function VoiceRowM({ v, playing, onPlay }) {
  const char = DATA.CHARS.find(c => c.id === v.char);
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
  const onPlay = (id) => setPlaying(p => p === id ? null : id);
  const VOICES = BUILTIN_VOICES || [];

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
        hMV(VAction, { icon: Icons.mic, title: '克隆我的声音', sub: '录一段或上传音频，1:1 复刻声线', onClick: () => ctx.go('voiceclone') }),
        hMV(VAction, { icon: Icons.upload, title: '从第三方导入', sub: '接入已有声音库 / 授权音色', onClick: () => ctx.go('voiceclone') })),

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
        : hMV('div', { className: 'm-stagger', style: { display: 'flex', flexDirection: 'column', gap: 11 } },
            DATA.VOICES.map(v => hMV(VoiceRowM, { key: v.id, v, playing: playing === v.id, onPlay })))));
}

// ============================================================
// 应用中心 Apps
// ============================================================
const M_APPS = [
  { key: 'music', name: '音乐工作室', code: 'APP-MUS', icon: 'music', blurb: '数字人 MV、音乐短片与虚拟歌手演出', g1: '#7C5CE6', g2: '#2E2270', accent: '#C9B8FF',
    tools: [{ name: 'MV 生成器', desc: '一首歌一键生成数字人 MV', icon: 'clapper' }, { name: '虚拟歌手演出', desc: '数字人演唱与舞台呈现', icon: 'music' }, { name: '音乐短片', desc: '氛围配乐 + 角色叙事短片', icon: 'play' }] },
  { key: 'drama', name: '短剧工坊', code: 'APP-DRA', icon: 'clapper', blurb: '数字人出演剧情短剧，多角色演绎成片', g1: '#3E63C8', g2: '#16224C', accent: '#9DB8FF',
    tools: [{ name: '剧情短剧', desc: '剧本到成片的短剧制作', icon: 'clapper' }, { name: '多角色对戏', desc: '多个数字人同场演绎', icon: 'users' }, { name: '分镜成片', desc: '自动分镜与剪辑合成', icon: 'layers' }] },
  { key: 'live', name: '短视频带货', code: 'APP-LIV', icon: 'cart', blurb: '数字人口播带货，短视频与直播间开播', g1: '#E8884A', g2: '#6E3214', accent: '#FFD0A6',
    tools: [{ name: '口播带货', desc: '商品脚本一键口播视频', icon: 'mic' }, { name: '直播间开播', desc: '数字人 7×24 无人直播', icon: 'bolt' }, { name: '商品讲解', desc: '卖点拆解与讲解视频', icon: 'doc' }] },
];

function MApps({ ctx }) {
  const [tab, setTab] = useStateMV('all');
  const go = (name) => ctx.toast(name + ' · 即将上线，敬请期待', { tone: 'warn' });
  const tabs = [{ key: 'all', label: '全部' }, ...M_APPS.map(a => ({ key: a.key, label: a.name }))];
  const tools = M_APPS.flatMap(a => a.tools.map(t => ({ ...t, app: a }))).filter(t => tab === 'all' || t.app.key === tab);

  return hMV('div', { className: 'm-body has-tabbar', 'data-screen-label': '应用中心' },
    hMV(WxNavV, { title: '应用中心' }),
    hMV('div', { style: { padding: '2px 18px 0' } },
      hMV('p', { style: { fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: '0 0 14px' } }, '用你的数字人资产驱动下游业务，一键前往子应用。')),

    // 精选大卡（横滑）
    hMV('div', { className: 'm-hscroll', style: { padding: '0 18px 4px' } },
      M_APPS.map(a => hMV('button', { key: a.key, onClick: () => go(a.name), className: 'm-press', style: {
        flex: '0 0 244px', position: 'relative', height: 148, borderRadius: 'var(--r-xl)', overflow: 'hidden', cursor: 'pointer',
        border: '1px solid var(--line-2)', background: 'var(--surface)', boxShadow: 'var(--sh-1)', textAlign: 'left', padding: 0 } },
        hMV('div', { style: { position: 'absolute', right: -8, bottom: -10, color: 'var(--surface-3)', opacity: 1 } }, hMV(Icons[a.icon], { size: 96, stroke: 1.1 })),
        hMV('div', { style: { position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 9 } },
          hMV('span', { style: { display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)' } }, hMV(Icons[a.icon], { size: 18, stroke: 1.8 })),
          hMV('span', { style: { fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-3)', padding: '3px 9px', borderRadius: 'var(--r-pill)' } }, '即将上线')),
        hMV('div', { style: { position: 'absolute', left: 16, bottom: 15, right: 16 } },
          hMV('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 20, color: 'var(--ink)', letterSpacing: '-.02em' } }, a.name),
          hMV('div', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontWeight: 500 } }, a.blurb))))),

    // 信息条
    hMV('div', { style: { margin: '18px 18px 6px', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
      hMV(Icons.info, { size: 15, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
      hMV('span', { style: { fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.45 } }, '子应用复用同一套已定稿的数字人资产，点击将跳转前往。')),

    // tabs
    hMV('div', { style: { display: 'flex', gap: 8, padding: '12px 18px 4px', overflowX: 'auto' }, className: 'no-bar' },
      tabs.map(t => {
        const on = t.key === tab;
        return hMV('button', { key: t.key, onClick: () => setTab(t.key), style: {
          flex: '0 0 auto', height: 32, padding: '0 14px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
          background: on ? 'var(--ink)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600 } }, t.label);
      })),

    // 工具列表
    hMV('div', { className: 'm-stagger', style: { padding: '10px 18px 8px', display: 'flex', flexDirection: 'column', gap: 11 } },
      tools.map((t, i) => hMV('button', { key: t.app.key + i, onClick: () => go(t.app.name), className: 'm-tap', style: {
        display: 'flex', alignItems: 'center', gap: 12, padding: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
        hMV('div', { style: { width: 44, height: 44, flex: '0 0 44px', borderRadius: 'var(--r-md)', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink)' } }, hMV(Icons[t.icon], { size: 21, stroke: 1.7 })),
        hMV('div', { style: { flex: 1, minWidth: 0 } },
          hMV('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            hMV('span', { className: 'm-clip1', style: { fontSize: 14, fontWeight: 700 } }, t.name),
            hMV(Icons.external, { size: 12, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } })),
          hMV('div', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 2 } }, t.desc),
          hMV('div', { style: { fontSize: 10, color: 'var(--ink-4)', marginTop: 3, fontWeight: 600 } }, t.app.name))))));
}

export { MVoice };
export { MApps };
