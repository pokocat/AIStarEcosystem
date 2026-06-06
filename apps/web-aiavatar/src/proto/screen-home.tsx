"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, JobApi, useApi, seed } from "./api";
import { Portrait } from "./portrait";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 V4 · 首页 Home — 悬浮轮播宣传 + 「我的数字人资产」优先 + 空态引导
// ============================================================
const hMH : any = React.createElement;
const { useState: useStateH, useEffect: useEffectH } = React;
const { WxNav: WxNavH } = MShell;
const { MSection: MSectionH, MStatus: MStatusH, MPath: MPathH, CornerTicks: CornerTicksH } = MKit;

// ——————————————————————————————————————————
// 悬浮轮播宣传 Banner
// ——————————————————————————————————————————
function GradWord({ children }) {
  return hMH('span', { style: { background: 'linear-gradient(92deg,#5B7CFF,#9B6BFF 55%,#E36BD0)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontWeight: 800 } }, children);
}

function MCarousel({ slides }) {
  const [i, setI] = useStateH(0);
  const n = slides.length;
  useEffectH(() => {
    const t = setInterval(() => setI(p => (p + 1) % n), 4600);
    return () => clearInterval(t);
  }, [n]);
  const go = (d, e) => { if (e) e.stopPropagation(); setI(p => (p + d + n) % n); };

  return hMH('div', { style: { position: 'relative', margin: '8px 16px 0' } },
    // 柔光悬浮底
    hMH('div', { style: { position: 'absolute', inset: '6px 10px -8px', borderRadius: 26, pointerEvents: 'none',
      background: slides[i].glow, filter: 'blur(20px)', opacity: .8, transition: 'background .5s' } }),
    // 主体
    hMH('div', { style: { position: 'relative', height: 150, borderRadius: 'var(--r-2xl)', overflow: 'hidden',
      boxShadow: '0 10px 30px -8px rgba(20,36,55,.22), 0 2px 8px rgba(20,36,55,.06)', border: '1px solid rgba(255,255,255,.6)' } },
      // 滑轨
      hMH('div', { style: { display: 'flex', height: '100%', width: n * 100 + '%', transform: `translateX(-${i * (100 / n)}%)`, transition: 'transform .5s cubic-bezier(.22,1,.36,1)' } },
        slides.map((s, k) => hMH('button', { key: k, onClick: s.onClick, style: {
          flex: '0 0 ' + (100 / n) + '%', position: 'relative', border: 'none', cursor: 'pointer', padding: 0,
          background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 15 } },
          hMH('div', { style: { fontFamily: 'var(--font-disp)', fontSize: 20.5, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)', textAlign: 'center', lineHeight: 1.16, padding: '0 46px', whiteSpace: 'nowrap' } }, s.title),
          hMH('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 8px 0 8px', background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-pill)', boxShadow: '0 6px 16px rgba(20,36,55,.28)' } },
            s.badge && hMH('span', { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 'var(--r-pill)' } }, s.badge),
            hMH('span', { style: { fontSize: 13.5, fontWeight: 700, paddingLeft: s.badge ? 0 : 8 } }, s.cta),
            hMH('span', { style: { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 99, background: 'rgba(255,255,255,.16)' } }, hMH(Icons.arrowR, { size: 14, stroke: 2.4 })))))),
      // 左右箭头
      hMH('button', { onClick: e => go(-1, e), 'aria-label': '上一张', style: arrowStyle('left') }, hMH(Icons.chevL, { size: 18, stroke: 2.2 })),
      hMH('button', { onClick: e => go(1, e), 'aria-label': '下一张', style: arrowStyle('right') }, hMH(Icons.chevR, { size: 18, stroke: 2.2 }))),
    // 圆点
    hMH('div', { style: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 11 } },
      slides.map((s, k) => hMH('button', { key: k, onClick: () => setI(k), 'aria-label': '第' + (k + 1) + '张', style: {
        width: k === i ? 18 : 6, height: 6, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
        background: k === i ? 'var(--primary)' : 'var(--line-3)', transition: 'all .3s' } }))));
}
function arrowStyle(side) {
  return { position: 'absolute', top: '50%', [side]: 10, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 99,
    border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
    background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(20,36,55,.12)' };
}

// ——————————————————————————————————————————
// 「我的数字人资产」大卡（首屏主角）
// ——————————————————————————————————————————
function MAssetCardBig({ char, onOpen }) {
  return hMH('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    flex: '0 0 165px', textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
    hMH('div', { style: { position: 'relative', padding: 8, background: 'var(--canvas-2)' } },
      hMH('div', { style: { position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)' } },
        hMH(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
        hMH('div', { style: { position: 'absolute', bottom: 7, left: 7 } }, hMH(MStatusH, { status: char.status })),
        char.fav && hMH('div', { style: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 99, background: 'rgba(255,255,255,.92)', display: 'grid', placeItems: 'center', color: 'var(--err)' } }, hMH(Icons.heart, { size: 12, stroke: 2 }))),
      hMH(CornerTicksH, null)),
    hMH('div', { style: { padding: '10px 12px 13px' } },
      hMH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
        hMH('span', { className: 'reg-no', style: { fontSize: 9.5 } }, char.id),
        hMH(MPathH, { path: char.path, mini: true })),
      hMH('div', { className: 'asset-name m-clip1', style: { fontSize: 16.5, marginTop: 6 } }, char.name),
      hMH('div', { className: 'm-clip1', style: { fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 } }, char.archetype)));
}

// 新建入口卡（资产 rail 末尾）
function MAddAssetCard({ onClick }) {
  return hMH('button', { onClick, className: 'm-tap', style: {
    flex: '0 0 116px', cursor: 'pointer', border: '1.5px dashed var(--line-3)', background: 'var(--surface-2)',
    borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--ink-3)' } },
    hMH('span', { style: { width: 40, height: 40, borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' } }, hMH(Icons.plus, { size: 20, stroke: 2.2 })),
    hMH('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' } }, '新建'));
}

// 空态引导
function MAssetEmpty({ ctx }) {
  return hMH('div', { className: 'm-fade', style: { margin: '0 18px', position: 'relative', overflow: 'hidden',
    border: '1.5px dashed var(--line-3)', borderRadius: 'var(--r-xl)', background: 'var(--surface)', padding: '30px 22px 24px', textAlign: 'center' } },
    hMH('div', { style: { position: 'absolute', top: -90, left: '50%', transform: 'translateX(-50%)', width: 260, height: 180, pointerEvents: 'none',
      background: 'radial-gradient(closest-side, rgba(18,179,222,.16), transparent 70%)', filter: 'blur(6px)' } }),
    hMH('div', { style: { position: 'relative' } },
      hMH('div', { style: { width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px', display: 'grid', placeItems: 'center',
        background: 'var(--primary-soft)', color: 'var(--primary)', boxShadow: 'var(--sh-1)' } }, hMH(Icons.user, { size: 28, stroke: 1.7 })),
      hMH('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, letterSpacing: '-.01em', marginBottom: 7 } }, '还没有数字人资产'),
      hMH('p', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 auto 20px', maxWidth: 260 } },
        '创建你的第一个数字人，形象、声音与衍生物都会沉淀在这里，随时调用到创作中。'),
      hMH('div', { style: { display: 'flex', gap: 10 } },
        hMH(UI.Button, { variant: 'primary', full: true, size: 'lg', icon: Icons.sparkle, onClick: () => ctx.startCreate('ai') }, 'AI 原创'),
        hMH(UI.Button, { variant: 'line', full: true, size: 'lg', icon: Icons.person, onClick: () => ctx.startRealClone() }, '真人复刻')),
      hMH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, fontSize: 11.5, color: 'var(--ink-3)' } },
        hMH(Icons.bolt, { size: 13, stroke: 2, style: { color: 'var(--primary)' } }), '约 15 秒即可生成第一版形象')));
}

// 进行中链路小卡
function MWipCard({ char, onOpen }) {
  const st = DATA.STATUS[char.status];
  const pct = Math.round((st.step / 5) * 100);
  return hMH('button', { onClick: () => onOpen(char), className: 'm-tap', style: {
    flex: '0 0 232px', display: 'flex', gap: 11, padding: 11, textAlign: 'left', cursor: 'pointer',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-1)' } },
    hMH(Portrait, { char, variant: 'key', ratio: '1 / 1', radius: 9, expr: 'calm', style: { width: 44, flex: '0 0 44px', alignSelf: 'flex-start' } }),
    hMH('div', { style: { flex: 1, minWidth: 0 } },
      hMH('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
        hMH('span', { className: 'asset-name m-clip1', style: { fontSize: 14.5 } }, char.name),
        hMH(UI.Badge, { tone: st.tone, style: { flex: '0 0 auto' } }, st.label)),
      hMH('div', { className: 'mono', style: { fontSize: 10, color: 'var(--ink-4)', margin: '2px 0 8px' } }, char.id),
      hMH('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        hMH('div', { style: { flex: 1 } }, hMH(UI.Progress, { pct, h: 5, tone: char.status === 'pending' ? 'warn' : 'primary' })),
        hMH('span', { className: 'mono', style: { fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 } }, pct + '%'))));
}

// 大功能卡 — tone: 'dark'(墨) / 'accent'(青) / 'plain'(白底细框)
function MFeatureCard({ title, sub, cta, tone, icon, onClick, big }) {
  const plain = tone === 'plain', dark = tone === 'dark', accent = tone === 'accent';
  const bg = dark ? 'linear-gradient(155deg,#1C2B3A,#14202B)' : accent ? 'var(--grad)' : 'var(--surface)';
  const fg = plain ? 'var(--ink)' : '#fff';
  const subC = plain ? 'var(--ink-3)' : 'rgba(255,255,255,.9)';
  const ctaC = plain ? 'var(--primary)' : '#fff';
  return hMH('button', { onClick, className: 'm-press', style: {
    position: 'relative', textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden',
    border: plain ? '1px solid var(--line-2)' : 'none',
    borderRadius: 'var(--r-xl)', height: big ? 150 : 124, background: bg, color: fg,
    boxShadow: plain ? 'var(--sh-1)' : 'var(--sh-2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' } },
    hMH('div', { style: { position: 'absolute', right: -10, bottom: -12, opacity: plain ? 1 : .16, color: plain ? 'var(--surface-3)' : '#fff' } },
      hMH(icon, { size: big ? 92 : 78, stroke: 1.2 })),
    hMH('div', { style: { position: 'relative', padding: '15px 15px 0' } },
      plain && hMH('span', { style: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--primary)', marginBottom: 10 } }, hMH(icon, { size: 18, stroke: 1.9 })),
      hMH('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: big ? 19 : 16, lineHeight: 1.14, letterSpacing: '-.02em', maxWidth: '80%' } }, title),
      sub && hMH('div', { style: { fontSize: 11.5, color: subC, marginTop: 5, maxWidth: '82%', lineHeight: 1.45, fontWeight: 500 } }, sub)),
    hMH('div', { style: { position: 'relative', padding: '0 15px 13px', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 12.5, color: ctaC } },
      cta, hMH(Icons.arrowR, { size: 15, stroke: 2.2 })));
}

// ——————————————————————————————————————————
function MHome({ ctx }) {
  const [demoEmpty, setDemoEmpty] = useStateH(false);
  const avatars = useApi(() => AvatarApi.list('mine'), seed.avatars());
  const tasks = useApi(() => JobApi.list(), seed.jobs());
  const myAssets = demoEmpty ? [] : avatars;
  const wip = avatars.filter(c => ['proofing','iterating','refining','pending','deriving'].includes(c.status));
  const running = tasks.filter(t => t.status === 'running').length;
  const hasAssets = myAssets.length > 0;

  const SLIDES = [
    { title: hMH('span', null, hMH(GradWord, null, 'Avatar V'), ' 来了'), cta: '立即体验', badge: 'NEW',
      bg: 'linear-gradient(120deg,#DDE6FF,#EBE0FF 52%,#FBE3F1)', glow: 'linear-gradient(120deg,#BFD0FF,#D9C6FF,#F7CDE6)', onClick: () => ctx.startCreate('ai') },
    { title: hMH('span', null, '真人复刻 ', hMH('span', { style: { color: 'var(--primary)' } }, '15 秒成片')), cta: '开始录制',
      bg: 'linear-gradient(120deg,#D8F1FB,#E3ECFF)', glow: 'linear-gradient(120deg,#BEE7F7,#CFE0FF)', onClick: () => ctx.startRealClone() },
    { title: hMH('span', null, '一句话 ', hMH('span', { style: { color: '#1AA06E' } }, '生成数字人')), cta: '去创建',
      bg: 'linear-gradient(120deg,#DEF5EA,#DCEFFB)', glow: 'linear-gradient(120deg,#C5EEDA,#C9E6F8)', onClick: () => ctx.startCreate('ai') },
  ];

  return hMH('div', { className: 'm-body has-tabbar', 'data-screen-label': '首页' },
    hMH(WxNavH, { title: '数字人资产',
      left: hMH('button', { className: 'nav-spacer m-tap', onClick: () => ctx.go('tasks'), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', position: 'relative', display: 'grid', placeItems: 'center' } },
        hMH(Icons.bell, { size: 21, stroke: 1.9 }),
        running > 0 && hMH('span', { style: { position: 'absolute', top: 1, right: 1, minWidth: 15, height: 15, padding: '0 3px', background: 'var(--err)', color: '#fff',
          borderRadius: 99, fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center', border: '1.5px solid var(--surface)' } }, running)) }),

    // 悬浮轮播宣传
    hMH(MCarousel, { slides: SLIDES }),

    // 我的数字人资产（首屏主角）
    hMH('div', { style: { padding: '24px 0 0' } },
      hMH('div', { style: { padding: '0 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 14 } },
        hMH('div', { style: { minWidth: 0 } },
          hMH('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, letterSpacing: '-.02em' } }, '我的数字人资产'),
          hMH('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 } }, hasAssets ? (myAssets.length + ' 个形象 · 可随时调用') : '从这里开始你的第一个数字人')),
        hMH('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' } },
          // 空态预览开关（演示用）
          hMH('button', { onClick: () => setDemoEmpty(v => !v), title: '预览「未创建」空态', style: {
            display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 99, cursor: 'pointer', border: '1px solid var(--line-2)',
            background: demoEmpty ? 'var(--primary-soft)' : 'var(--surface)', color: demoEmpty ? 'var(--primary)' : 'var(--ink-3)' } }, hMH(Icons.eye, { size: 15, stroke: 1.9 })),
          hasAssets && hMH('button', { onClick: () => ctx.tab('library'), style: { display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 700, padding: 0 } },
            '全部', hMH(Icons.chevR, { size: 15, stroke: 2.2 })))),
      hasAssets
        ? hMH('div', { className: 'm-hscroll', style: { padding: '0 18px 4px' } },
            myAssets.map(c => hMH(MAssetCardBig, { key: c.id, char: c, onOpen: ctx.openChar })),
            hMH(MAddAssetCard, { onClick: ctx.openCreateSheet }))
        : hMH(MAssetEmpty, { ctx })),

    // 开始创作
    hMH('div', { style: { padding: '26px 0 8px' } },
      hMH('div', { style: { padding: '0 18px' } },
        hMH(MSectionH, { title: '开始创作' })),
      hMH('div', { style: { padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        hMH(MFeatureCard, { title: '创建数字人', sub: '一句描述，原创虚构形象', cta: '开始创建', big: true, tone: 'dark',
          icon: Icons.sparkle, onClick: () => ctx.startCreate('ai') }),
        hMH(MFeatureCard, { title: '真人授权复刻', sub: '录一段动作，合规复刻', cta: '开始录制', big: true, tone: 'accent',
          icon: Icons.person, onClick: () => ctx.startRealClone() })),
      hMH('div', { style: { padding: '12px 18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        hMH(MFeatureCard, { title: '克隆声音', sub: '录一段即生成', cta: '声音工作室', tone: 'plain',
          icon: Icons.mic, onClick: () => ctx.go('voice') }),
        hMH(MFeatureCard, { title: '接入应用', sub: '短剧 · 带货 · 音乐', cta: '应用中心', tone: 'plain',
          icon: Icons.clapper, onClick: () => ctx.tab('apps') }))));
}

export { MHome };
