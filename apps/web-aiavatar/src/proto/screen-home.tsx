"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA, AvatarApi, JobApi, useApi, seed, USE_MOCK } from "./api";
import { Portrait } from "./portrait";
import { LiveJobBadge } from "./job-badge";
import { MShell, MKit } from "./shell";

// ============================================================
// 移动端 V4 · 首页 Home — 悬浮轮播宣传 + 「我的数字人资产」优先 + 空态引导
// ============================================================
const hMH : any = React.createElement;
const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;
const { WxNav: WxNavH } = MShell;
const { MSection: MSectionH, MStatus: MStatusH, MPath: MPathH, CornerTicks: CornerTicksH } = MKit;

// ——————————————————————————————————————————
function MCarousel({ slides }) {
  const [i, setI] = useStateH(0);
  const dragRef = useRefH(null as any);
  const n = slides.length;
  useEffectH(() => {
    if (n <= 1 || typeof window === 'undefined') return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let t: any = null;
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    const start = () => {
      if (!t && document.visibilityState === 'visible') t = setInterval(() => setI(p => (p + 1) % n), 4600);
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [n]);
  const down = (e) => { dragRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const up = (e) => {
    const s = dragRef.current; dragRef.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.3) setI(p => (p + (dx < 0 ? 1 : -1) + n) % n);
  };

  return hMH('div', { style: { position: 'relative', margin: '8px 16px 0' } },
    // 柔光悬浮底
    hMH('div', { style: { position: 'absolute', inset: '6px 10px -8px', borderRadius: 26, pointerEvents: 'none',
      background: slides[i].glow, filter: 'blur(20px)', opacity: .8, transition: 'background .5s' } }),
    // 主体
    hMH('div', { onPointerDown: down, onPointerUp: up, onPointerCancel: () => { dragRef.current = null; }, style: { position: 'relative', height: 166, borderRadius: 'var(--r-2xl)', overflow: 'hidden',
      boxShadow: '0 10px 30px -8px rgba(20,36,55,.22), 0 2px 8px rgba(20,36,55,.06)', border: '1px solid rgba(255,255,255,.6)', touchAction: 'pan-y' } },
      // 滑轨
      hMH('div', { style: { display: 'flex', height: '100%', width: n * 100 + '%', transform: `translateX(-${i * (100 / n)}%)`, transition: 'transform .5s cubic-bezier(.22,1,.36,1)' } },
        slides.map((s, k) => hMH('button', { key: k, onClick: s.onClick, style: {
          flex: '0 0 ' + (100 / n) + '%', position: 'relative', border: 'none', cursor: 'pointer', padding: 0,
          background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 10, overflow: 'hidden' } },
          s.image && hMH('img', { src: s.image, alt: '', draggable: false, loading: k === 0 ? 'eager' : 'lazy', decoding: 'async', fetchPriority: k === 0 ? 'high' : 'low', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' } }),
          hMH('span', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,16,24,.72), rgba(8,16,24,.32) 54%, rgba(8,16,24,.06))' } }),
          hMH('div', { style: { position: 'relative', fontFamily: 'var(--font-disp)', fontSize: 21, fontWeight: 800, letterSpacing: 0, color: '#fff', textAlign: 'left', lineHeight: 1.14, padding: '0 18px', textShadow: '0 2px 10px rgba(0,0,0,.22)' } }, s.title),
          hMH('span', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, margin: '0 0 16px 18px', padding: '0 8px 0 8px', background: 'rgba(255,255,255,.92)', color: 'var(--ink)', borderRadius: 'var(--r-pill)', boxShadow: '0 6px 16px rgba(20,36,55,.22)' } },
            s.badge && hMH('span', { style: { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', background: 'rgba(255,255,255,.16)', padding: '3px 8px', borderRadius: 'var(--r-pill)' } }, s.badge),
            hMH('span', { style: { fontSize: 13.5, fontWeight: 700, paddingLeft: s.badge ? 0 : 8 } }, s.cta),
            hMH('span', { style: { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 99, background: 'var(--primary)', color: '#fff' } }, hMH(Icons.arrowR, { size: 14, stroke: 2.4 }))))))),
    // 圆点
    hMH('div', { style: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 11 } },
      slides.map((s, k) => hMH('button', { key: k, onClick: () => setI(k), 'aria-label': '第' + (k + 1) + '张', style: {
        width: k === i ? 18 : 6, height: 6, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0,
        background: k === i ? 'var(--primary)' : 'var(--line-3)', transition: 'all .3s' } }))));
}

// ——————————————————————————————————————————
// 「我的数字人资产」大卡（首屏主角）
// ——————————————————————————————————————————
function MAssetCardBig({ char, onOpen, onJobDone }) {
  return hMH('button', { onClick: () => onOpen(char), className: 'm-press', style: {
    flex: '0 0 165px', textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-1)' } },
    hMH('div', { style: { position: 'relative', padding: 8, background: 'var(--canvas-2)' } },
      hMH('div', { style: { position: 'relative', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)' } },
        hMH(Portrait, { char, variant: 'key', ratio: '4 / 5', expr: 'calm' }),
        hMH(LiveJobBadge, { char, onDone: onJobDone }),
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

// 大功能卡：统一尺寸，抽象背景图经品牌 duotone（去色 + 青色高光）收敛 ——
// 原图四张各一霓虹色系（蓝紫/绿金/紫粉/蓝绿），在单青色清爽皮肤里互相打架；
// 去色后统一为「深墨底 + 青色微光」，四张卡成为一组刻意的暗段落而非彩虹噪音。
function MFeatureCard({ title, sub, cta, image, icon, onClick }) {
  return hMH('button', { onClick, className: 'm-press', style: {
    position: 'relative', height: 142, textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.18)', borderRadius: 'var(--r-xl)', background: '#0E1822', color: '#fff',
    boxShadow: '0 16px 38px rgba(10,24,42,.16), 0 1px 0 rgba(255,255,255,.32) inset',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' } },
    hMH('img', { src: image, alt: '', draggable: false, loading: 'lazy', decoding: 'async', fetchPriority: 'low', style: {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .8,
      filter: 'grayscale(1) brightness(.94) contrast(1.05)', transform: 'scale(1.02)', pointerEvents: 'none' } }),
    hMH('span', { style: { position: 'absolute', inset: 0, background:
      'linear-gradient(120deg, rgba(7,13,20,.94) 0%, rgba(9,16,25,.78) 46%, rgba(9,16,25,.26) 100%)' } }),
    hMH('span', { style: { position: 'absolute', inset: 0, background:
      'radial-gradient(circle at 84% 24%, rgba(18,179,222,.42), transparent 52%), radial-gradient(circle at 16% 12%, rgba(255,255,255,.16), transparent 30%), linear-gradient(180deg, rgba(255,255,255,.08), transparent 38%, rgba(0,0,0,.26))', mixBlendMode: 'screen', opacity: .8 } }),
    hMH('span', { style: { position: 'absolute', left: 1, right: 1, top: 1, height: '50%', borderRadius: 'calc(var(--r-xl) - 1px) calc(var(--r-xl) - 1px) 0 0',
      background: 'linear-gradient(180deg, rgba(255,255,255,.18), transparent)', pointerEvents: 'none' } }),
    hMH('div', { style: { position: 'relative', padding: '14px 14px 0' } },
      hMH('span', { style: { display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 10,
        background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.20)', color: '#fff',
        boxShadow: '0 8px 20px rgba(0,0,0,.18)', marginBottom: 9 } }, hMH(icon, { size: 16, stroke: 2 })),
      hMH('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 16.5, lineHeight: 1.12, letterSpacing: '-.01em', maxWidth: '92%', textShadow: '0 2px 10px rgba(0,0,0,.35)' } }, title),
      sub && hMH('div', { style: { fontSize: 11.5, color: 'rgba(255,255,255,.74)', marginTop: 5, maxWidth: '94%', lineHeight: 1.38, fontWeight: 500, textShadow: '0 1px 8px rgba(0,0,0,.35)' } }, sub)),
    hMH('div', { style: { position: 'relative', padding: '0 14px 13px', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 12.5, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.36)' } },
      cta, hMH(Icons.arrowR, { size: 15, stroke: 2.2 })));
}

// ——————————————————————————————————————————
function MHome({ ctx }) {
  // 显式 loading：live 模式拉取资产时先显示骨架，避免误闪「还没有数字人资产」空态
  const [avatars, setAvatars] = useStateH(seed.avatars());
  const [loadingAvatars, setLoadingAvatars] = useStateH(!USE_MOCK);
  useEffectH(() => {
    let live = true;
    AvatarApi.list('mine')
      .then((d) => { if (live) { setAvatars(d); setLoadingAvatars(false); } })
      .catch(() => { if (live) setLoadingAvatars(false); });
    return () => { live = false; };
  }, []);
  const tasks = useApi(() => JobApi.list(), seed.jobs());
  const myAssets = avatars;
  const wip = avatars.filter(c => ['proofing','iterating','refining','pending','deriving'].includes(c.status));
  const running = tasks.filter(t => t.status === 'running').length;
  const hasAssets = myAssets.length > 0;

  const SLIDES = [
    // bg/glow 统一青蓝族 pastel（V4 清爽皮肤纪律：去紫/粉）—— glow 在轮播两侧 blur 可见
    { title: '一句话生成专属 AI 数字人，马上开工', cta: '立即生成', badge: 'HOT', image: '/generated/home-banners/create-avatar.jpg',
      bg: 'linear-gradient(120deg,#D8F1FB,#E0EDFB 52%,#E8F6F4)', glow: 'linear-gradient(120deg,#BEE7F7,#CDE1F5,#CFEFE9)', onClick: () => ctx.startCreate('ai') },
    { title: '真人授权复刻，拍一段就有数字分身', cta: '马上录制', image: '/generated/home-banners/real-clone.jpg',
      bg: 'linear-gradient(120deg,#D8F1FB,#E3ECFB)', glow: 'linear-gradient(120deg,#BEE7F7,#CFE0F5)', onClick: () => ctx.startRealClone() },
    { title: '精修形象加图集视频，内容资产整套出炉', cta: '生成整套', image: '/generated/home-banners/refine-assets.jpg',
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
    hMH('div', { className: 'm-defer-section', style: { padding: '24px 0 0' } },
      hMH('div', { style: { padding: '0 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 14 } },
        hMH('div', { style: { minWidth: 0 } },
          hMH('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 800, fontSize: 19, letterSpacing: '-.02em' } }, '我的数字人资产'),
          hMH('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 } }, loadingAvatars && !hasAssets ? '正在加载…' : hasAssets ? (myAssets.length + ' 个形象 · 可随时调用') : '从这里开始你的第一个数字人')),
        hasAssets && hMH('button', { onClick: () => ctx.tab('library'), style: { display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 700, padding: 0, flex: '0 0 auto' } },
          '全部', hMH(Icons.chevR, { size: 15, stroke: 2.2 }))),
      loadingAvatars && !hasAssets
        ? hMH('div', { className: 'm-hscroll', style: { padding: '0 18px 4px' } },
            Array.from({ length: 3 }).map((_, i) => hMH('div', { key: i, style: { flex: '0 0 165px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-1)' } },
              hMH('div', { className: 'm-skel', style: { width: '100%', aspectRatio: '4 / 5' } }),
              hMH('div', { style: { padding: '10px 12px 13px' } },
                hMH('div', { className: 'm-skel', style: { height: 13, width: '80%', borderRadius: 5 } }),
                hMH('div', { className: 'm-skel', style: { height: 11, width: '55%', marginTop: 7, borderRadius: 5 } })))))
        : hasAssets
        ? hMH('div', { className: 'm-hscroll', style: { padding: '0 18px 4px' } },
            myAssets.map(c => hMH(MAssetCardBig, { key: c.id, char: c, onOpen: ctx.openChar, onJobDone: ctx.reload })),
            hMH(MAddAssetCard, { onClick: ctx.openCreateSheet }))
        : hMH(MAssetEmpty, { ctx })),

    // 开始创作
    hMH('div', { className: 'm-defer-section', style: { padding: '26px 0 8px' } },
      hMH('div', { style: { padding: '0 18px' } },
        hMH(MSectionH, { title: '开始创作' })),
      hMH('div', { style: { padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        hMH(MFeatureCard, { title: '创建数字人', sub: '一句描述，原创虚构形象', cta: '开始创建',
          image: '/generated/feature-cards/create-avatar.jpg', icon: Icons.sparkle, onClick: () => ctx.startCreate('ai') }),
        hMH(MFeatureCard, { title: '真人授权复刻', sub: '录一段动作，合规复刻', cta: '开始录制',
          image: '/generated/feature-cards/real-clone.jpg', icon: Icons.person, onClick: () => ctx.startRealClone() }),
        hMH(MFeatureCard, { title: '克隆声音', sub: '录一段即生成', cta: '声音工作室',
          image: '/generated/feature-cards/voice-clone.jpg', icon: Icons.mic, onClick: () => ctx.go('voice') }),
        hMH(MFeatureCard, { title: '接入应用', sub: '短剧 · 带货 · 音乐', cta: '应用中心',
          image: '/generated/feature-cards/app-connect.jpg', icon: Icons.clapper, onClick: () => ctx.tab('apps') }))));
}

export { MHome };
