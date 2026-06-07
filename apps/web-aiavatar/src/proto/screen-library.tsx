"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, LicenseApi, awaitJob, useApi, seed } from "./api";
import { Portrait } from "./portrait";
import { LiveJobBadge } from "./job-badge";
import { MShell, MKit } from "./shell";
import { toast } from "./toast";

// ============================================================
// 移动端 · 数字人库 Library + 资产详情 Detail
// ============================================================
const hML : any = React.createElement;
const { useState: useStateML, useEffect: useEffectML } = React;
const { WxNav: WxNavL } = MShell;
const { MStatus: MStatusL, MPath: MPathL, CornerTicks: CornerTicksL } = MKit;

// —— 拼贴卡（大图 + 右侧两张小图 + 名称在下）——
function MCollageCard({ char, onOpen, onJobDone }) {
  return hML('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    display: 'block', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', border: 'none', background: 'none' } },
    hML('div', { style: { display: 'flex', gap: 5, height: 150, borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)', background: 'var(--canvas-2)' } },
      hML('div', { style: { flex: '0 0 62%', position: 'relative' } },
        hML(Portrait, { char, variant: 'key', ratio: '', expr: 'calm', style: { width: '100%', height: '100%' } }),
        hML(LiveJobBadge, { char, onDone: onJobDone, compact: true }),
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

function MLibrary({ ctx }) {
  const [top, setTop] = useStateML('mine'); // mine | public
  const [cat, setCat] = useStateML('all');
  const [q, setQ] = useStateML('');
  const [view, setView] = useStateML('grid');
  const [fav, setFav] = useStateML(false);

  const pool = useApi(() => AvatarApi.list(top === 'mine' ? 'mine' : 'public'), seed.avatars(top === 'mine' ? 'mine' : 'public'), [top]);
  let list: any = pool.slice();
  if (fav) list = list.filter(c => c.fav);
  if (top === 'public' && cat !== 'all') list = list.filter(c => cat === 'fav' ? c.fav : c.cat === cat);
  if (q) list = list.filter(c => (c.name + (c.archetype || '') + c.id).toLowerCase().includes(q.toLowerCase()));

  const cats = [
    { key: 'all', label: '全部' }, { key: 'pro', label: '专业' }, { key: 'life', label: '生活方式' },
    { key: 'ugc', label: 'UGC' }, { key: 'community', label: '社区' }, { key: 'fav', label: '收藏' },
  ];

  return hML('div', { className: 'm-body has-tabbar', 'data-screen-label': '数字人库' },
    hML('div', { className: 'wx-nav', style: { paddingLeft: 18 } },
      hML('div', { style: { flex: 1, minWidth: 0, display: 'flex', gap: 22 } },
        [['mine', '我的数字人'], ['public', '公开数字人']].map(([k, l]) => {
          const on = top === k;
          return hML('button', { key: k, onClick: () => setTop(k), style: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', fontFamily: 'var(--font-disp)', fontSize: 16.5, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' } },
            l, on && hML('span', { style: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderRadius: 99, background: 'var(--primary)' } }));
        }))),

    hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 18px 0' } },
      hML('div', { style: { position: 'relative', flex: 1 } },
        hML(Icons.search, { size: 16, stroke: 1.9, style: { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
        hML('input', { value: q, placeholder: '搜索…', onChange: e => setQ(e.target.value), style: {
          width: '100%', height: 42, padding: '0 14px 0 38px', background: 'var(--surface)', border: '1px solid var(--line-2)',
          borderRadius: 'var(--r-pill)', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none', boxShadow: 'var(--sh-1)' } })),
      hML('button', { onClick: () => setView(v => v === 'grid' ? 'list' : 'grid'), className: 'm-tap', style: { flex: '0 0 auto', width: 42, height: 42, borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } },
        hML(view === 'grid' ? Icons.list : Icons.gallery, { size: 17, stroke: 1.9 }))),

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

    (() => {
      const filtered = top === 'mine' && cat !== 'all' && cat !== 'fav' ? list.filter(c => c.path === cat) : list;
      if (filtered.length === 0 && !(top === 'mine')) return hML('div', { style: { textAlign: 'center', padding: '70px 0', color: 'var(--ink-3)' } },
        hML('div', { style: { width: 52, height: 52, borderRadius: 99, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--ink-4)' } }, hML(Icons.search, { size: 22 })),
        hML('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--ink-2)' } }, '没有匹配的数字人'));
      return view === 'grid'
        ? hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 12px' } },
            top === 'mine' && hML('button', { key: '__new', onClick: ctx.openCreateSheet, className: 'm-tap', style: { height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', color: 'var(--ink-3)' } },
              hML('span', { style: { width: 42, height: 42, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hML(Icons.add, { size: 20, stroke: 2 })),
              hML('span', { style: { fontSize: 13.5, fontWeight: 700, color: 'var(--ink-2)' } }, '新建数字人')),
            filtered.map(c => hML(MCollageCard, { key: c.id, char: c, onOpen: ctx.openChar, onJobDone: ctx.reload })))
        : hML('div', { className: 'm-stagger', style: { padding: '14px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 } },
            filtered.map(c => hML(MAssetCard, { key: c.id, char: c, onOpen: ctx.openChar })));
    })());
}

// ============================================================
// 详情 Detail（图集 / 衍生 / 版本 / 授权 全接真数据）
// ============================================================
function MDetail({ char: initialChar, ctx }) {
  const [char, setChar] = useStateML(initialChar);
  const [tab, setTab] = useStateML('atlas');
  const [derivBusy, setDerivBusy] = useStateML({} as any);
  const voice = ctx.voiceFor(char);
  const s = DATA.STATUS[char.status] || DATA.STATUS.draft;
  const isPublic = String(char.id || '').startsWith('PA-');
  const tabs = [
    { key: 'atlas', label: '标准图集' },
    { key: 'deriv', label: '衍生资产' },
    { key: 'versions', label: '版本' },
    { key: 'license', label: char.path === 'real' ? '肖像授权' : '设定档案' },
  ];
  const wip = char.status !== 'archived' && char.status !== 'finalized' && char.status !== 'deriving';

  // 进入详情即拉取最新（live 模式列表数据可能滞后）
  useEffectML(() => {
    if (isPublic) return;
    AvatarApi.get(char.id).then((fresh) => fresh && setChar((c) => ({ ...c, ...fresh }))).catch(() => {});
  }, []);

  const refresh = async () => {
    try { const fresh = await AvatarApi.get(char.id); setChar((c) => ({ ...c, ...fresh })); ctx.reload && ctx.reload(); } catch {}
  };

  const toggleFav = async () => {
    const next = !char.fav;
    setChar((c) => ({ ...c, fav: next }));
    try { await AvatarApi.patch(char.id, { fav: next }); ctx.reload && ctx.reload(); }
    catch (e: any) { setChar((c) => ({ ...c, fav: !next })); toast(e?.message || '操作失败', { tone: 'err' }); }
  };

  const share = async () => {
    try {
      const url = location.origin + location.pathname + '#detail';
      await navigator.clipboard.writeText(char.name + ' · ' + char.id + ' ' + url);
      toast('已复制分享链接', { tone: 'ok' });
    } catch { toast('复制失败，请手动分享', { tone: 'warn' }); }
  };

  const runDerive = async (key) => {
    if (derivBusy[key]) return;
    setDerivBusy((m) => ({ ...m, [key]: { pct: 3 } }));
    try {
      const j = await AvatarApi.createDerivative(char.id, { type: key });
      await awaitJob(j.id, (jj) => setDerivBusy((m) => ({ ...m, [key]: { pct: jj.pct } })));
      toast((DATA.DERIVS.find(d => d.key === key) || {}).name + ' · 完成', { tone: 'ok' });
      await refresh();
    } catch (e: any) {
      toast(e?.message || '生成失败', { tone: 'err' });
    } finally {
      setDerivBusy((m) => { const n = { ...m }; delete n[key]; return n; });
    }
  };

  return hML('div', { className: 'm-overlay', 'data-screen-label': '资产详情' },
    hML(WxNavL, { title: char.name, onBack: ctx.back,
      right: hML('button', { className: 'nav-spacer m-tap', onClick: share, style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'grid', placeItems: 'center' } }, hML(Icons.share, { size: 19, stroke: 1.9 })) }),
    hML('div', { className: 'm-body', style: { paddingBottom: 88 } },
      // 档案头
      hML('div', { className: 'm-card', style: { margin: '4px 18px 0', overflow: 'hidden' } },
        hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' } },
          hML('span', { className: 'reg-no', style: { fontSize: 11.5 } }, char.id),
          hML('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            char.mock && hML(UI.Badge, { tone: 'warn' }, 'MOCK'),
            hML(MPathL, { path: char.path }))),
        hML('div', { style: { display: 'flex', gap: 0 } },
          hML('div', { style: { position: 'relative', padding: 11, background: 'var(--canvas-2)', flex: '0 0 158px' } },
            hML('div', { style: { position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)' } },
              hML(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
              hML(LiveJobBadge, { char, onDone: refresh }),
              hML('div', { style: { position: 'absolute', bottom: 8, left: 8 } }, hML(MStatusL, { status: char.status })),
              char.status === 'archived' && hML('div', { style: { position: 'absolute', top: 9, right: 9 } }, hML('span', { className: 'seal', style: { fontSize: 9 } }, '已登记'))),
            hML(CornerTicksL, null)),
          hML('div', { style: { flex: 1, minWidth: 0, padding: '14px 14px 12px' } },
            hML('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 } },
              hML('div', { className: 'asset-name-lg', style: { fontSize: 25 } }, char.name),
              !isPublic && hML('button', { onClick: toggleFav, className: 'm-tap', style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 0, color: char.fav ? 'var(--err)' : 'var(--ink-4)', flex: '0 0 auto' } },
                hML(Icons.heart, { size: 17, stroke: 2 }))),
            hML('div', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 } }, char.codename),
            hML('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.45 } }, char.tagline),
            !isPublic && hML('button', { onClick: () => ctx.chooseVoice(char), className: 'm-tap', style: { display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 11, height: 34, padding: '0 11px 0 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--sh-1)' } },
              hML('span', { style: { display: 'grid', placeItems: 'center', color: 'var(--ink)' } }, hML('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, hML('path', { d: 'M7 5v14l12-7z' }))),
              hML('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' } }, voice),
              hML(Icons.chevD, { size: 15, stroke: 2, style: { color: 'var(--ink-3)' } })))),
        char.def && char.def['设定语'] && hML('div', { style: { padding: '0 16px 15px' } },
          hML('div', { style: { fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, paddingLeft: 11, borderLeft: '2px solid var(--primary-soft)' } }, '“' + char.def['设定语'] + '”'))),

      // 概览统计
      hML('div', { className: 'm-card', style: { margin: '12px 18px 0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' } },
        [['版本', char.versions], ['衍生类型', Object.values(char.deriv || {}).filter(x => x === 'done').length], ['图集', (char.counts || {}).atlas || 0], ['更新', char.updated]].map(([k, v], i) =>
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
        tab === 'atlas' && hML(MAtlas, { char, busy: derivBusy['atlas'], onGenerate: () => runDerive('atlas') }),
        tab === 'deriv' && hML(MDerivTab, { char, ctx, busy: derivBusy, onGenerate: runDerive }),
        tab === 'versions' && hML(MVersions, { char }),
        tab === 'license' && hML(MLicense, { char, ctx }))),

    // 底部固定操作
    hML('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 18px calc(12px + var(--home-ind))',
      background: 'linear-gradient(transparent, var(--surface) 28%)', display: 'flex', gap: 9 } },
      isPublic
        ? hML(UI.Button, { variant: 'primary', full: true, icon: Icons.grid, onClick: () => ctx.tab('apps') }, '投入应用')
        : hML(React.Fragment, null,
            hML(UI.Button, { variant: 'primary', full: true, icon: wip ? Icons.bolt : Icons.wand, onClick: () => wip ? ctx.startCreate(char.path, char) : ctx.openLooks(char) }, wip ? '继续创建链路' : '设计造型'),
            hML(UI.Button, { variant: 'line', icon: Icons.grid, onClick: () => ctx.tab('apps') }, '投入应用'))));
}

function MAtlas({ char, busy, onGenerate }) {
  const shots = char.shotImages || {};
  const hasReal = Object.keys(shots).length > 0;
  const shotKeyOf = { 'front-half': 0, 'front-full': 1, left: 2, right: 3, expr: 4 };
  if (!hasReal && !char.imageUrl) {
    // 完全没有生成产物（mock 数据除外）→ 引导生成
    return hML('div', { style: { textAlign: 'center', padding: '34px 18px', border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)' } },
      hML('div', { style: { width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' } }, hML(Icons.images, { size: 24 })),
      hML('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 6 } }, '还没有标准图集'),
      hML('p', { style: { fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 } }, busy ? '正在出图…' : '从定妆形象一键生成 5 张标准机位图'),
      busy
        ? hML('div', { style: { maxWidth: 200, margin: '0 auto' } }, hML(UI.Progress, { pct: Math.round(busy.pct || 5), showLabel: true }))
        : hML(UI.Button, { variant: 'primary', icon: Icons.sparkle, onClick: onGenerate }, '生成标准图集'));
  }
  return hML('div', null,
    busy && hML('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 13px', background: 'var(--primary-tint)', border: '1px solid var(--primary-soft)', borderRadius: 'var(--r-md)' } },
      hML(UI.Spinner, { size: 15 }),
      hML('div', { style: { flex: 1 } }, hML(UI.Progress, { pct: Math.round(busy.pct || 5), h: 5 }))),
    hML('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      DATA.SHOTS.map((sh, i) => hML('div', { key: sh.key },
        hML('div', { style: { position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
          hML(Portrait, { char: { ...char, shotImages: null }, src: shots[sh.key] || null, variant: ['key','key','side','threeq','look'][i] || 'key', ratio: '3 / 4', expr: i === 4 ? 'smile' : 'calm' })),
        hML('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '0 2px' } },
          hML('span', { style: { fontSize: 12, fontWeight: 600 } }, sh.name),
          hML('span', { className: 'mono', style: { fontSize: 10.5, color: 'var(--ink-3)' } }, sh.spec)))),
    !hasReal ? null : null),
    !busy && hML('div', { style: { marginTop: 14 } },
      hML(UI.Button, { variant: 'line', full: true, icon: Icons.refresh, onClick: onGenerate }, hasReal ? '重新出图' : '生成标准图集')));
}

function MDerivTab({ char, ctx, busy, onGenerate }) {
  return hML('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    DATA.DERIVS.map(d => {
      const st = (char.deriv || {})[d.key]; const count = (char.counts || {})[d.key] || 0;
      const b = busy[d.key];
      const map = { done: { tone: 'ok', label: count + ' ' + d.unit }, running: { tone: 'primary', label: '生成中' }, draft: { tone: 'mute', label: '草稿' }, empty: { tone: 'mute', label: '未创建' } };
      const m = map[st] || map.empty;
      return hML('div', { key: d.key, className: 'm-card', style: { padding: 13, display: 'flex', alignItems: 'center', gap: 12 } },
        hML('div', { style: { width: 40, height: 40, flex: '0 0 40px', borderRadius: 11, background: DATA.catSoft(d.cat), display: 'grid', placeItems: 'center', color: DATA.catColor(d.cat) } }, hML(Icons[d.icon], { size: 20 })),
        hML('div', { style: { flex: 1, minWidth: 0 } },
          hML('div', { style: { fontSize: 14, fontWeight: 700 } }, d.name),
          b ? hML('div', { style: { marginTop: 6 } }, hML(UI.Progress, { pct: Math.round(b.pct || 4), h: 5 }))
            : hML('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 } }, d.desc)),
        b ? hML('span', { className: 'mono', style: { fontSize: 11, color: 'var(--primary)', fontWeight: 700 } }, Math.round(b.pct || 4) + '%')
          : st === 'done'
          ? hML('div', { style: { display: 'flex', gap: 6, flex: '0 0 auto' } },
              hML(UI.Button, { variant: 'soft', size: 'sm', onClick: () => ctx.openDeriv(char, d.key) }, m.label),
              hML('button', { onClick: () => onGenerate(d.key), className: 'm-tap', title: '重新生成', style: { width: 32, height: 32, borderRadius: 99, border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' } }, hML(Icons.refresh, { size: 14 })))
          : st === 'running'
          ? hML(UI.Badge, { tone: 'primary', dot: true }, '生成中')
          : hML(UI.Button, { variant: 'line', size: 'sm', icon: Icons.sparkle, onClick: () => onGenerate(d.key) }, '生成'));
    }));
}

function MVersions({ char }) {
  const KIND_ICON: any = { archive: Icons.archive, finalize: Icons.checkc, template: Icons.palette, refine: Icons.sliders, iterate: Icons.wand, init: Icons.sparkle, look: Icons.shirt, derive: Icons.layers };
  const evs = useApi(() => AvatarApi.versions(char.id), [], []);
  if (!evs.length) return hML('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 } }, '暂无版本记录');
  return hML('div', null, evs.map((e: any, i) => hML('div', { key: i, style: { display: 'flex', gap: 12 } },
    hML('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' } },
      hML('div', { style: { width: 34, height: 34, borderRadius: 99, background: e.cur ? 'var(--primary)' : 'var(--surface)', border: '1px solid ' + (e.cur ? 'var(--primary)' : 'var(--line-2)'), display: 'grid', placeItems: 'center', color: e.cur ? '#fff' : 'var(--ink-3)' } }, hML(KIND_ICON[e.kind] || Icons.sparkle, { size: 16 })),
      i < evs.length - 1 && hML('div', { style: { width: 2, flex: 1, minHeight: 14, background: 'var(--line)', margin: '4px 0' } })),
    hML('div', { style: { flex: 1, paddingBottom: 16, display: 'flex', gap: 10 } },
      hML('div', { style: { flex: 1, minWidth: 0 } },
        hML('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          hML('span', { className: 'mono', style: { fontSize: 12.5, fontWeight: 700, color: e.cur ? 'var(--primary)' : 'var(--ink)' } }, e.v),
          e.cur && hML(UI.Badge, { tone: 'primary' }, '当前'),
          hML('span', { style: { fontSize: 11.5, color: 'var(--ink-3)' } }, e.t)),
        hML('div', { style: { fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.45 } }, e.note)),
      e.imageUrl && hML('div', { style: { width: 44, flex: '0 0 44px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' } },
        hML('img', { src: e.imageUrl, alt: e.v, style: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' } }))))));
}

function MLicense({ char, ctx }) {
  const licenses = useApi(() => LicenseApi.list(), seed.licenses());
  const [downloading, setDownloading] = useStateML(false);
  if (char.path === 'ai' || !char.license) {
    return hML('div', null,
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: 12, background: 'var(--primary-tint)', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-soft)' } },
        hML(Icons.ai, { size: 18, style: { color: 'var(--primary)', flex: '0 0 auto' } }),
        hML('span', { style: { fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 } },
          char.path === 'ai' ? 'AI 原创虚构形象 · 版权自有，无需真人肖像授权。' : '该资产暂未绑定肖像授权；完成真人捕获核验后会自动登记。')),
      hML('div', { style: { display: 'flex', flexDirection: 'column' } },
        Object.entries(char.def || {}).map(([k, v]: any) => hML('div', { key: k, style: { padding: '11px 0', borderBottom: '1px solid var(--line)' } },
          hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
          hML('div', { style: { fontSize: 13.5, color: 'var(--ink)', fontWeight: Array.isArray(v) ? 400 : 600, lineHeight: 1.45 } }, Array.isArray(v) ? v.join(' · ') : String(v || '—'))))));
  }
  const lic = licenses.find((l: any) => l.id === char.license);
  if (!lic) return hML('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 } }, '授权信息加载中…');
  const download = async () => {
    setDownloading(true);
    try {
      const r = await LicenseApi.certificate(lic.id);
      if (r.certificateUrl) { window.open(r.certificateUrl, '_blank'); toast('凭证已打开', { tone: 'ok' }); }
      else toast('凭证生成中，请稍后再试', { tone: 'warn' });
    } catch (e: any) { toast(e?.message || '下载失败', { tone: 'err' }); }
    finally { setDownloading(false); }
  };
  return hML('div', { className: 'm-card', style: { padding: 16 } },
    hML('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 } },
      hML('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
        hML(Icons.shield, { size: 19, style: { color: 'var(--ok)' } }),
        hML('div', null,
          hML('div', { style: { fontSize: 14, fontWeight: 700 } }, '电子肖像授权'),
          hML('div', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)' } }, lic.id))),
      hML(UI.Badge, { tone: lic.status === 'active' ? 'ok' : lic.status === 'pending' ? 'warn' : 'err', icon: Icons.checkc }, lic.status === 'active' ? '生效中' : lic.status === 'pending' ? '待签署' : '已过期')),
    [['肖像权人', lic.subject], ['授权范围', lic.scope], ['授权期限', lic.period], ['使用平台', (lic.platforms || []).join(' · ')], ['绑定素材', lic.photos + ' 份（加密存档）']].map(([k, v]) =>
      hML('div', { key: k, style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
        hML('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 3 } }, k),
        hML('div', { style: { fontSize: 13.5, fontWeight: 600 } }, v))),
    hML('div', { style: { marginTop: 14 } },
      hML(UI.Button, { variant: 'line', full: true, icon: Icons.download, disabled: downloading, onClick: download }, downloading ? '生成中…' : '下载授权凭证')));
}

export { MLibrary };
export { MDetail };
