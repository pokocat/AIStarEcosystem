"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./data";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 · 数字人库 Library + 资产详情 Detail
// ============================================================
const hML : any = React.createElement;
const { useState: useStateML } = React;
const { WxNav: WxNavL } = MShell;
const { MStatus: MStatusL, MPath: MPathL, MDeriv: MDerivL, CornerTicks: CornerTicksL, MSection: MSectionL } = MKit;

// —— 拼贴卡（截图式：大图 + 右侧两张小图 + 名称在下）——
function MCollageCard({ char, onOpen }) {
  return hML('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    display: 'block', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', border: 'none', background: 'none' } },
    hML('div', { style: { display: 'flex', gap: 5, height: 150, borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)', background: 'var(--canvas-2)' } },
      hML('div', { style: { flex: '0 0 62%', position: 'relative' } },
        hML(Portrait, { char, variant: 'key', ratio: '', expr: 'calm', style: { width: '100%', height: '100%' } }),
        char.fav && hML('div', { style: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 99, background: 'rgba(255,255,255,.92)', display: 'grid', placeItems: 'center', color: 'var(--err)' } }, hML(Icons.heart, { size: 12, stroke: 2 }))),
      hML('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 } },
        hML('div', { style: { flex: 1, overflow: 'hidden' } }, hML(Portrait, { char, variant: 'threeq', expr: 'smile', style: { width: '100%', height: '100%' } })),
        hML('div', { style: { flex: 1, overflow: 'hidden' } }, hML(Portrait, { char, variant: 'side', expr: 'calm', style: { width: '100%', height: '100%' } })))),
    hML('div', { className: 'asset-name m-clip1', style: { fontSize: 18, marginTop: 9 } }, char.name));
}

// 列表行卡（list 视图）
function MAssetCard({ char, onOpen }) {
  return hML('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', padding: 10, cursor: 'pointer',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
    hML('div', { style: { width: 54, height: 54, flex: '0 0 54px', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--line)' } },
      hML(Portrait, { char, variant: 'key', ratio: '1 / 1', expr: 'calm' })),
    hML('div', { style: { flex: 1, minWidth: 0 } },
      hML('div', { className: 'asset-name m-clip1', style: { fontSize: 16 } }, char.name),
      hML('div', { className: 'm-clip1', style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 2 } }, char.archetype)),
    hML(Icons.chevR, { size: 18, stroke: 2, style: { color: 'var(--ink-4)', flex: '0 0 auto' } }));
}

// 公开数字人（mock）
const PUBLIC_AVATARS = [
  { id: 'PA-01', name: 'Annie', archetype: '商务职业', hue: 28, cat: 'pro', fav: false, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
  { id: 'PA-02', name: 'Christina', archetype: '居家生活', hue: 168, cat: 'life', fav: true, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
  { id: 'PA-03', name: 'Terry', archetype: '播客主播', hue: 248, cat: 'ugc', fav: false, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
  { id: 'PA-04', name: 'Pamela', archetype: '社媒口播', hue: 8, cat: 'community', fav: false, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
  { id: 'PA-05', name: 'Marcus', archetype: '专业讲解', hue: 200, cat: 'pro', fav: false, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
  { id: 'PA-06', name: 'Yuki', archetype: '生活方式', hue: 320, cat: 'life', fav: true, path: 'ai', status: 'archived', counts: {}, deriv: {}, def: {} },
];

function MLibrary({ ctx }) {
  const [top, setTop] = useStateML('mine'); // mine | public
  const [cat, setCat] = useStateML('all');
  const [q, setQ] = useStateML('');
  const [view, setView] = useStateML('grid');
  const [fav, setFav] = useStateML(false);

  let list: any = top === 'mine' ? DATA.CHARS.slice() : PUBLIC_AVATARS.slice();
  if (fav) list = list.filter(c => c.fav);
  if (top === 'public' && cat !== 'all') list = list.filter(c => cat === 'fav' ? c.fav : c.cat === cat);
  if (q) list = list.filter(c => (c.name + (c.archetype || '') + c.id).toLowerCase().includes(q.toLowerCase()));

  const cats = [
    { key: 'all', label: '全部' }, { key: 'pro', label: '专业' }, { key: 'life', label: '生活方式' },
    { key: 'ugc', label: 'UGC' }, { key: 'community', label: '社区' }, { key: 'fav', label: '收藏' },
  ];

  return hML('div', { className: 'm-body has-tabbar', 'data-screen-label': '数字人库' },
    // 顶部 tab（无右上角按钮 — 避让微信胶囊区；创建靠底部 FAB 与网格入口）
    hML('div', { className: 'wx-nav', style: { paddingLeft: 18 } },
      hML('div', { style: { flex: 1, minWidth: 0, display: 'flex', gap: 22 } },
        [['mine', '我的数字人'], ['public', '公开数字人']].map(([k, l]) => {
          const on = top === k;
          return hML('button', { key: k, onClick: () => setTop(k), style: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', fontFamily: 'var(--font-disp)', fontSize: 16.5, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' } },
            l, on && hML('span', { style: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderRadius: 99, background: 'var(--primary)' } }));
        }))),

    // 搜索 + 筛选 + 视图
    hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 18px 0' } },
      hML('div', { style: { position: 'relative', flex: 1 } },
        hML(Icons.search, { size: 16, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
        hML('input', { value: q, placeholder: '搜索…', onChange: e => setQ(e.target.value), style: {
          width: '100%', height: 42, padding: '0 14px 0 38px', background: 'var(--surface)', border: '1px solid var(--line-2)',
          borderRadius: 'var(--r-pill)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none', boxShadow: 'var(--sh-1)' } })),
      top === 'public' && hML('button', { onClick: () => ctx.toast('筛选'), className: 'm-tap', style: { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 14px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' } },
        hML(Icons.sliders, { size: 15, stroke: 1.9 }), '筛选'),
      hML('button', { onClick: () => setView(v => v === 'grid' ? 'list' : 'grid'), className: 'm-tap', style: { flex: '0 0 auto', width: 42, height: 42, borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } },
        hML(view === 'grid' ? Icons.list : Icons.gallery, { size: 17, stroke: 1.9 }))),

    // 分类 pills（公开）
    top === 'public' && hML('div', { style: { display: 'flex', gap: 8, padding: '13px 18px 0', overflowX: 'auto' }, className: 'no-bar' },
      cats.map(c => {
        const on = cat === c.key;
        return hML('button', { key: c.key, onClick: () => setCat(c.key), style: {
          flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          border: '1px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'), background: on ? 'var(--primary-soft)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--ink-2)' } }, c.label);
      })),
    top === 'mine' && hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '13px 18px 0' } },
      [['all', '全部'], ['real', '真人复刻'], ['ai', 'AI 原创']].map(([k, l]) => {
        const on = cat === k;
        return hML('button', { key: k, onClick: () => setCat(k), style: { flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid ' + (on ? 'var(--primary)' : 'var(--line-2)'), background: on ? 'var(--primary-soft)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--ink-2)' } }, l);
      }),
      hML('div', { style: { flex: 1 } }),
      hML('button', { onClick: () => setFav(f => !f), title: '只看收藏', style: { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 99, cursor: 'pointer', background: fav ? 'var(--primary-soft)' : 'var(--surface)', color: fav ? 'var(--primary)' : 'var(--ink-3)', border: '1px solid ' + (fav ? 'var(--primary)' : 'var(--line-2)') } }, hML(Icons.heart, { size: 16, stroke: 2 }))),

    // 主体
    (() => {
      const filtered = top === 'mine' && cat !== 'all' && cat !== 'fav' ? list.filter(c => c.path === cat) : list;
      if (filtered.length === 0) return hML('div', { style: { textAlign: 'center', padding: '70px 0', color: 'var(--ink-3)' } },
        hML('div', { style: { width: 52, height: 52, borderRadius: 99, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--ink-4)' } }, hML(Icons.search, { size: 22 })),
        hML('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink-2)' } }, '没有匹配的数字人'));
      return view === 'grid'
        ? hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 12px' } },
            top === 'mine' && hML('button', { key: '__new', onClick: ctx.openCreateSheet, className: 'm-tap', style: { height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', color: 'var(--ink-3)' } },
              hML('span', { style: { width: 42, height: 42, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hML(Icons.add, { size: 20, stroke: 2 })),
              hML('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, '新建数字人')),
            filtered.map(c => hML(MCollageCard, { key: c.id, char: c, onOpen: ctx.openChar })))
        : hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 } },
            filtered.map(c => hML(MAssetCard, { key: c.id, char: c, onOpen: ctx.openChar })));
    })());
}

// ============================================================
// 详情 Detail
// ============================================================
function MDetail({ char, ctx }) {
  const [tab, setTab] = useStateML('atlas');
  const voice = ctx.voiceFor(char);
  const s = DATA.STATUS[char.status];
  const tabs = [
    { key: 'atlas', label: '标准图集' },
    { key: 'deriv', label: '衍生资产' },
    { key: 'versions', label: '版本' },
    { key: 'license', label: char.path === 'real' ? '肖像授权' : '设定档案' },
  ];
  const wip = char.status !== 'archived' && char.status !== 'finalized';

  return hML('div', { className: 'm-overlay', 'data-screen-label': '资产详情' },
    hML(WxNavL, { title: char.name, onBack: ctx.back,
      right: hML('button', { className: 'nav-spacer m-tap', onClick: () => ctx.toast('已分享调用链接', { tone: 'ok' }), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hML(Icons.share, { size: 19, stroke: 1.9 })) }),
    hML('div', { className: 'm-body', style: { paddingBottom: 88 } },
      // 档案头
      hML('div', { className: 'm-card', style: { margin: '4px 18px 0', overflow: 'hidden' } },
        hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' } },
          hML('span', { className: 'reg-no', style: { fontSize: 11.5 } }, char.id),
          hML(MPathL, { path: char.path })),
        hML('div', { style: { display: 'flex', gap: 0 } },
          hML('div', { style: { position: 'relative', padding: 11, background: 'var(--canvas-2)', flex: '0 0 158px' } },
            hML('div', { style: { position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)' } },
              hML(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
              hML('div', { style: { position: 'absolute', bottom: 8, left: 8 } }, hML(MStatusL, { status: char.status })),
              char.status === 'archived' && hML('div', { style: { position: 'absolute', top: 9, right: 9 } }, hML('span', { className: 'seal', style: { fontSize: 9 } }, '已登记'))),
            hML(CornerTicksL, null)),
          hML('div', { style: { flex: 1, minWidth: 0, padding: '14px 14px 12px' } },
            hML('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 } },
              hML('div', { className: 'asset-name-lg', style: { fontSize: 25 } }, char.name),
              char.fav && hML(Icons.heart, { size: 17, stroke: 2, style: { color: 'var(--err)', flex: '0 0 auto', marginTop: 4 } })),
            hML('div', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 } }, char.codename),
            hML('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.45 } }, char.tagline),
            // 声音 pill —— 展示并可更换
            hML('button', { onClick: () => ctx.chooseVoice(char), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 11, height: 34, padding: '0 11px 0 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--sh-1)' } },
              hML('span', { style: { display: 'grid', placeItems: 'center', color: 'var(--ink)' } }, hML('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, hML('path', { d: 'M7 5v14l12-7z' }))),
              hML('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' } }, voice),
              hML(Icons.chevD, { size: 15, stroke: 2, style: { color: 'var(--ink-3)' } })))),
        char.def && char.def['设定语'] && hML('div', { style: { padding: '0 16px 15px' } },
          hML('div', { style: { fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, paddingLeft: 11, borderLeft: '2px solid var(--primary-soft)' } }, '“' + char.def['设定语'] + '”'))),

      // 概览统计
      hML('div', { className: 'm-card', style: { margin: '12px 18px 0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' } },
        [['版本', char.versions], ['衍生类型', Object.values(char.deriv).filter(x => x === 'done').length], ['图集', char.counts.atlas], ['更新', char.updated]].map(([k, v], i) =>
          hML('div', { key: i, style: { textAlign: 'center', flex: 1, borderLeft: i ? '1px solid var(--line)' : 'none' } },
            hML('div', { className: 'mono', style: { fontSize: 16, fontWeight: 700 } }, v),
            hML('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 } }, k)))),

      // tabs
      hML('div', { style: { position: 'sticky', top: 0, zIndex: 5, background: 'var(--canvas)', padding: '16px 18px 0', marginTop: 6 } },
        hML('div', { style: { display: 'flex', gap: 8, overflowX: 'auto' }, className: 'no-bar' },
          tabs.map(t => {
            const on = t.key === tab;
            return hML('button', { key: t.key, onClick: () => setTab(t.key), style: {
              flex: '0 0 auto', height: 34, padding: '0 15px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
              background: on ? 'var(--primary-soft)' : 'transparent', color: on ? 'var(--primary)' : 'var(--ink-3)',
              fontSize: 13.5, fontWeight: on ? 700 : 600 } }, t.label);
          }))),

      hML('div', { className: 'm-fade', key: tab, style: { padding: '16px 18px 0' } },
        tab === 'atlas' && hML(MAtlas, { char }),
        tab === 'deriv' && hML(MDerivTab, { char, ctx }),
        tab === 'versions' && hML(MVersions, { char }),
        tab === 'license' && hML(MLicense, { char, ctx }))),

    // 底部固定操作
    hML('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))',
      background: 'linear-gradient(transparent, var(--surface) 28%)', display: 'flex', gap: 9 } },
      hML(UI.Button, { variant: 'primary', full: true, icon: wip ? Icons.bolt : Icons.wand, onClick: () => wip ? ctx.startCreate(char.path, char) : ctx.openLooks(char) }, wip ? '继续创建链路' : '设计造型'),
      hML(UI.Button, { variant: 'line', icon: Icons.grid, onClick: () => ctx.tab('apps') }, '投入应用')));
}

function MAtlas({ char }) {
  return hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
    DATA.SHOTS.map((sh, i) => hML('div', { key: sh.key },
      hML('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
        hML(Portrait, { char, variant: ['key','key','side','threeq','look'][i] || 'key', ratio: '3 / 4', expr: i === 4 ? 'smile' : 'calm' })),
      hML('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' } },
        hML('span', { style: { fontSize: 12, fontWeight: 600 } }, sh.name),
        hML('span', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)' } }, sh.spec)))));
}

function MDerivTab({ char, ctx }) {
  return hML('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    DATA.DERIVS.map(d => {
      const st = char.deriv[d.key]; const count = char.counts[d.key];
      const map = { done: { tone: 'ok', label: count + ' ' + d.unit }, running: { tone: 'primary', label: '生成中' }, draft: { tone: 'mute', label: '草稿' }, empty: { tone: 'mute', label: '未创建' } };
      const m = map[st] || map.empty;
      return hML('div', { key: d.key, className: 'm-card', style: { padding: 13, display: 'flex', alignItems: 'center', gap: 12 } },
        hML('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: DATA.catSoft(d.cat), display: 'grid', placeItems: 'center', color: DATA.catColor(d.cat) } }, hML(Icons[d.icon], { size: 20 })),
        hML('div', { style: { flex: 1, minWidth: 0 } },
          hML('div', { style: { fontSize: 14, fontWeight: 700 } }, d.name),
          hML('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, d.desc)),
        st === 'done'
          ? hML(UI.Button, { variant: 'soft', size: 'sm', onClick: () => ctx.openDeriv(char, d.key) }, m.label)
          : st === 'running'
          ? hML(UI.Badge, { tone: 'primary', dot: true }, '生成中')
          : hML(UI.Button, { variant: 'line', size: 'sm', icon: Icons.sparkle, onClick: () => ctx.startDerive ? ctx.startDerive(char) : ctx.toast('开始生成 ' + d.name) }, '生成'));
    }));
}

function MVersions({ char }) {
  const evs = [
    { v: 'v' + char.versions, t: char.updated, note: '完成创建 · 锁定标准图集', icon: Icons.archive, cur: true },
    { v: 'v' + (char.versions - 1), t: '今天 11:20', note: '定稿确认 · 5 张标准图', icon: Icons.checkc },
    { v: 'v' + (char.versions - 2), t: '今天 10:08', note: '模板美化 · 影棚柔光', icon: Icons.palette },
    { v: 'v' + (char.versions - 3), t: '昨天 18:44', note: '精调 · 脸型 +12 / 眼睛 +6', icon: Icons.sliders },
    { v: 'v1', t: '昨天 15:30', note: '初始选稿', icon: Icons.sparkle },
  ];
  return hML('div', null, evs.map((e, i) => hML('div', { key: i, style: { display: 'flex', gap: 12 } },
    hML('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' } },
      hML('div', { style: { width: 34, height: 34, borderRadius: 99, background: e.cur ? 'var(--primary)' : 'var(--surface)', border: '1px solid ' + (e.cur ? 'var(--primary)' : 'var(--line-2)'), display: 'grid', placeItems: 'center', color: e.cur ? '#fff' : 'var(--ink-3)' } }, hML(e.icon, { size: 16 })),
      i < evs.length - 1 && hML('div', { style: { width: 2, flex: 1, minHeight: 14, background: 'var(--line)', margin: '4px 0' } })),
    hML('div', { style: { flex: 1, paddingBottom: 16 } },
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        hML('span', { className: 'mono', style: { fontSize: 12.5, fontWeight: 700, color: e.cur ? 'var(--primary)' : 'var(--ink)' } }, e.v),
        e.cur && hML(UI.Badge, { tone: 'primary' }, '当前'),
        hML('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, e.t)),
      hML('div', { style: { fontSize: 13, color: 'var(--ink-2)', marginTop: 3 } }, e.note)))));
}

function MLicense({ char, ctx }) {
  if (char.path === 'ai') {
    return hML('div', null,
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: 12, background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-soft)' } },
        hML(Icons.ai, { size: 18, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
        hML('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } }, 'AI 原创虚构形象 · 版权自有，无需真人肖像授权。')),
      hML('div', { style: { display: 'flex', flexDirection: 'column' } },
        Object.entries(char.def).map(([k, v]) => hML('div', { key: k, style: { padding: '11px 0', borderBottom: '1px solid var(--line)' } },
          hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
          hML('div', { style: { fontSize: 13.5, color: 'var(--ink)', fontWeight: Array.isArray(v) ? 400 : 600, lineHeight: 1.45 } }, Array.isArray(v) ? v.join(' · ') : v)))));
  }
  const lic = DATA.LICENSES.find(l => l.id === char.license) || DATA.LICENSES[0];
  return hML('div', { className: 'm-card', style: { padding: 16 } },
    hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
        hML(Icons.shield, { size: 19, style: { color: 'var(--ok)' } }),
        hML('div', null,
          hML('div', { style: { fontSize: 14, fontWeight: 700 } }, '电子肖像授权'),
          hML('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)' } }, lic.id))),
      hML(UI.Badge, { tone: 'ok', icon: Icons.checkc }, '生效中')),
    [['肖像权人', lic.subject], ['授权范围', lic.scope], ['授权期限', lic.period], ['使用平台', lic.platforms.join(' · ')], ['绑定素材', lic.photos + ' 张（加密存档）']].map(([k, v]) =>
      hML('div', { key: k, style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
        hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
        hML('div', { style: { fontSize: 13.5, fontWeight: 600 } }, v))),
    hML('div', { style: { marginTop: 14 } },
      hML(UI.Button, { variant: 'line', full: true, icon: Icons.download, onClick: () => ctx.toast('已下载授权凭证') }, '下载授权凭证')));
}

export { MLibrary };
export { MDetail };
