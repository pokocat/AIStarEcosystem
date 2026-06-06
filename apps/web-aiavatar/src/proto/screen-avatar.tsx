"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, SceneApi, useApi, seed } from "./api";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 V4 · 数字人造型 — 造型档案 + 设计新造型(场景替换) + 公开数字人
//   布局参考截图：Avatar looks detail / Design new looks / Public Avatars
// ============================================================
const hAV : any = React.createElement;
const { useState: useStateAV } = React;
const { WxNav: WxNavAV } = MShell;

// 场景库经 SceneApi 提供（见各组件内的 useApi 调用）。

// ============================================================
// 造型档案（截图：Avatar looks detail）
// ============================================================
function MLooksGrid({ char, ctx }) {
  const voice = ctx.voiceFor(char);
  const looks = [
    { id: 'l1', kind: 'final', label: char.name, variant: 'key', expr: 'calm' },
    { id: 'l2', kind: 'gen', pct: 5 },
    { id: 'l3', kind: 'gen', pct: 38 },
  ];
  return hAV('div', { className: 'm-overlay', 'data-screen-label': '造型档案' },
    // 顶部：返回 + 头像 + 名称 + 声音 pill
    hAV('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAV('button', { className: 'nav-back m-tap', onClick: ctx.back }, hAV(Icons.chevL, { size: 24, stroke: 2.2 })),
      hAV('span', { className: 'nav-title' }),
      hAV('span', { className: 'nav-spacer' })),
    hAV('div', { className: 'm-body', style: { padding: '0 18px 28px' } },
      hAV('div', { style: { display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 } },
        hAV('div', { style: { width: 56, height: 56, flex: '0 0 56px', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--line)' } },
          hAV(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
        hAV('div', { style: { flex: 1, minWidth: 0 } },
          hAV('div', { className: 'asset-name', style: { fontSize: 20 } }, char.name),
          hAV('button', { onClick: () => ctx.chooseVoice(char), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 5, height: 30, padding: '0 6px 0 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer' } },
            hAV(Icons.play, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }),
            hAV('span', { style: { fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' } }, voice),
            hAV(Icons.chevD, { size: 14, stroke: 2, style: { color: 'var(--ink-3)' } }))),
        hAV('button', { className: 'm-tap', onClick: () => ctx.toast(char.fav ? '已收藏' : '已加入收藏'), style: { width: 36, height: 36, flex: '0 0 36px', borderRadius: 99, border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: char.fav ? 'var(--err)' : 'var(--ink-3)' } }, hAV(Icons.heart, { size: 17, stroke: 2 }))),

      hAV('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', margin: '0 2px 12px' } }, looks.length + ' 个造型'),
      hAV('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        // 操作双拼格
        hAV('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
          hAV('button', { onClick: () => ctx.designLooks(char), className: 'm-tap', style: { flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' } },
            hAV('span', { style: { width: 38, height: 38, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hAV(Icons.wand, { size: 18, stroke: 1.9 })),
            hAV('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, 'AI 设计造型')),
          hAV('button', { onClick: () => ctx.toast('上传造型素材…'), className: 'm-tap', style: { flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' } },
            hAV('span', { style: { width: 38, height: 38, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, hAV(Icons.upload, { size: 18, stroke: 1.9 })),
            hAV('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, '上传造型'))),
        // 造型卡
        looks.map(l => l.kind === 'final'
          ? hAV('button', { key: l.id, onClick: () => ctx.openDeriv(char, 'scene'), className: 'm-press', style: { position: 'relative', padding: 0, border: 'none', cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
              hAV(Portrait, { char, variant: l.variant, ratio: '3 / 4', expr: l.expr }),
              hAV('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,18,26,.6), transparent 50%)' } }),
              hAV('div', { style: { position: 'absolute', left: 12, bottom: 11, fontSize: 13.5, fontWeight: 700, color: '#fff' } }, l.label))
          : hAV('div', { key: l.id, style: { position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', aspectRatio: '3 / 4',
              background: 'linear-gradient(150deg,#DDEAF7,#E9E2F6 50%,#F6E2EE)', display: 'grid', placeItems: 'center' } },
              hAV('span', { className: 'mono', style: { fontSize: 22, fontWeight: 800, color: 'var(--ink-2)' } }, l.pct + '%'),
              hAV('span', { style: { position: 'absolute', bottom: 11, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 } }, '生成中…'))))));
}

// ============================================================
// 设计新造型（截图：Design new looks）
// ============================================================
function MDesignLooks({ char, ctx }) {
  const [desc, setDesc] = useStateAV('');
  const [tab, setTab] = useStateAV('all');
  const [sel, setSel] = useStateAV(null);
  const [q, setQ] = useStateAV('');
  const SCENES = useApi(() => SceneApi.list(), seed.scenes());
  return hAV('div', { className: 'm-overlay', 'data-screen-label': '设计造型' },
    hAV('div', { className: 'wx-nav', style: { paddingLeft: 8 } },
      hAV('button', { className: 'nav-back m-tap', onClick: ctx.back }, hAV(Icons.x, { size: 22, stroke: 2.2 })),
      hAV('span', { className: 'nav-title' }),
      hAV('span', { className: 'nav-spacer' })),
    hAV('div', { className: 'm-body', style: { padding: '0 18px 24px' } },
      // 标题 + 头像 pill
      hAV('div', { style: { textAlign: 'center', marginBottom: 18 } },
        hAV('h1', { style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 12px' } }, '为它设计新造型'),
        hAV('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 9, height: 40, padding: '0 16px 0 6px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)' } },
          hAV('span', { style: { width: 28, height: 28, borderRadius: 99, overflow: 'hidden' } }, hAV(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
          hAV('span', { style: { fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' } }, char.name))),

      // 描述编辑卡
      hAV('div', { style: { border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-1)', marginBottom: 26 } },
        hAV('div', { style: { display: 'flex', gap: 13, padding: 15 } },
          hAV('div', { className: 'ph', style: { width: 84, height: 112, flex: '0 0 84px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-4)' } }, hAV(Icons.image, { size: 26, stroke: 1.6 })),
          hAV('div', { style: { flex: 1, minWidth: 0 } },
            hAV('div', { style: { fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: 7 } }, '描述你想怎样修改这个造型'),
            hAV('textarea', { value: desc, onChange: e => setDesc(e.target.value), rows: 3, placeholder: '例：换成商务西装，背景改为新闻演播室…', style: { width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'none', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', lineHeight: 1.5 } }))),
        hAV('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--line)' } },
          hAV('button', { onClick: () => ctx.toast('选择场景元素'), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 } },
            hAV(Icons.add, { size: 15, stroke: 1.9 }), '场景元素'),
          hAV('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            hAV('button', { className: 'm-tap', onClick: () => ctx.toast('竖屏'), style: { display: 'inline-flex', alignItems: 'center', gap: 3, height: 34, padding: '0 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink-2)' } }, hAV(Icons.cube, { size: 15, stroke: 1.8 }), hAV(Icons.chevD, { size: 13, stroke: 2 })),
            hAV('button', { onClick: () => desc.trim() ? ctx.toast('正在生成新造型…', { tone: 'ok' }) : null, style: { width: 38, height: 38, borderRadius: 99, border: 'none', cursor: desc.trim() ? 'pointer' : 'default', background: desc.trim() ? 'var(--primary)' : 'var(--surface-3)', color: desc.trim() ? '#fff' : 'var(--ink-4)', display: 'grid', placeItems: 'center' } }, hAV(Icons.chevU, { size: 18, stroke: 2.2 })))),
        hAV('button', { onClick: () => ctx.toast('用个人模型提升相似度'), style: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', border: 'none', borderTop: '1px solid var(--line)', background: 'var(--primary-tint)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' } },
          '用个人模型提升相似度', hAV(Icons.chevR, { size: 15, stroke: 2.2 }))),

      // 或选择场景替换
      hAV('div', { style: { fontSize: 18, fontWeight: 800, letterSpacing: '-.01em', margin: '0 2px 13px' } }, '或选择一个场景替换'),
      hAV('div', { style: { position: 'relative', marginBottom: 14 } },
        hAV(Icons.search, { size: 16, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
        hAV('input', { value: q, onChange: e => setQ(e.target.value), placeholder: '搜索场景…', style: { width: '100%', height: 44, padding: '0 14px 0 38px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none' } })),
      hAV('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } },
        [['all', '全部'], ['packs', '造型包']].map(([k, l]) => {
          const on = tab === k;
          return hAV('button', { key: k, onClick: () => setTab(k), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'), background: on ? 'var(--primary-soft)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--ink-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 } },
            k === 'packs' && hAV(Icons.idcard, { size: 14, stroke: 1.9 }), l);
        })),
      hAV('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        SCENES.filter(s => !q || s.name.includes(q)).map(s => {
          const on = sel === s.id;
          return hAV('button', { key: s.id, onClick: () => setSel(s.id), className: 'm-press', style: { position: 'relative', padding: 0, cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '2px solid ' + (on ? 'var(--primary)' : 'transparent'), boxShadow: on ? 'var(--ring)' : 'var(--sh-1)' } },
            hAV(Portrait, { char, variant: s.variant, ratio: '1 / 1', expr: s.expr }),
            on && hAV('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(10,18,26,.28)' } },
              hAV('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 15px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,.94)', color: 'var(--ink)', fontSize: 13, fontWeight: 700 } }, '套用造型', hAV(Icons.arrowR, { size: 15, stroke: 2.2 }))));
        }))),
    sel && hAV('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)' } },
      hAV(UI.Button, { variant: 'primary', full: true, size: 'lg', iconR: Icons.arrowR, onClick: () => { ctx.toast('正在套用场景…', { tone: 'ok' }); ctx.back(); } }, '套用此场景生成')));
}

export { MLooksGrid };
export { MDesignLooks };
