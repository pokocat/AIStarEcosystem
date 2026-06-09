"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./api";
import { Portrait } from "./portrait";

// ============================================================
// 移动端 Shell — 真实 H5 应用外层（无手机壳 / 无 chrome 装饰）
//   依赖真实安全区：顶部 env(safe-area-inset-top)、底部 env(safe-area-inset-bottom)
// ============================================================
const hM : any = React.createElement;
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

// —— 顶部导航栏 ——
//  title 居中；onBack 时左侧返回；left/right 为可选操作槽（真实可用，无胶囊占位）
function WxNav({ title, onBack, left, right }) {
  return hM('div', { className: 'wx-nav' },
    onBack
      ? hM('button', { className: 'nav-back m-tap', onClick: onBack, 'aria-label': '返回' }, hM(Icons.chevL, { size: 24, stroke: 2.2 }))
      : (left || hM('span', { className: 'nav-spacer' })),
    hM('span', { className: 'nav-title' }, title),
    right || hM('span', { className: 'nav-spacer' }));
}

// —— 底部 Tab 栏（首页 · 数字人 · ＋创建 · 应用 · 我的）——
const TABS = [
  { key: 'home',    icon: Icons.home, label: '首页' },
  { key: 'library', icon: Icons.user, label: '数字人' },
  { key: 'create',  fab: true,        label: '创建' },
  { key: 'apps',    icon: Icons.grid, label: '应用' },
  { key: 'me',      icon: Icons.user, label: '我的' },
];
// meInitial：当前登录用户名首字（live 模式有真实账号时显示，否则回退为通用头像图标，
// 不再硬编一个与用户无关的「柯」字）。
function WxTabBar({ active, onTab, onCreate, meInitial }) {
  return hM('div', { className: 'wx-tabbar' },
    TABS.map(t => {
      if (t.fab) {
        return hM('div', { key: 'create', className: 'wx-fab-slot' },
          hM('button', { className: 'wx-fab', onClick: onCreate, 'aria-label': '创建数字人' },
            hM('span', { className: 'fab-visual', 'aria-hidden': true },
              hM('img', { className: 'fab-art', src: '/generated/create-entry/fab-create.jpg', alt: '', draggable: false }),
              hM('span', { className: 'fab-veil' })),
            hM(Icons.plus, { size: 28, stroke: 2.4 }),
            hM('span', { className: 'fab-lbl' }, '创建')));
      }
      const on = active === t.key;
      const meNode = meInitial
        ? hM('span', { style: { width: 24, height: 24, borderRadius: 99, display: 'grid', placeItems: 'center',
            fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-disp)',
            background: on ? 'var(--primary)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-3)' } }, meInitial)
        : hM(Icons.user, { size: 24, stroke: on ? 2.1 : 1.85 });
      return hM('button', { key: t.key, className: 'wx-tab' + (on ? ' on' : ''), onClick: () => onTab(t.key) },
        t.key === 'me' ? meNode : hM(t.icon, { size: 24, stroke: on ? 2.1 : 1.85 }),
        hM('span', { className: 'lbl' }, t.label));
    }));
}

// —— 应用根容器 ——
//  铺满视口（桌面端居中为一列），顶部预留状态栏安全区；
//  内容、底部 Tab、覆盖页、Sheet 都挂在相对定位的 .m-content 里。
//  onRefresh：传入则启用「下拉刷新」—— 在内容区顶部下拉触发（仅当滚动条在顶部）。
function AppShell({ children, onRefresh }) {
  const ref = useRefM(null);
  const [pull, setPull] = useStateM(0);          // 当前下拉位移（px，已加阻尼）
  const [refreshing, setRefreshing] = useStateM(false);

  useEffectM(() => {
    const root = ref.current;
    if (!root || !onRefresh) return;
    const THRESH = 62, MAX = 84;
    let startY = 0, active = false, dist = 0, scroller: any = null;

    const onStart = (e) => {
      if (refreshing) return;
      const t = e.target;
      if (t && t.closest && t.closest('.m-sheet')) return;              // sheet 内不触发
      const sc = t && t.closest ? t.closest('.m-body') : null;          // 仅在内容滚动区生效
      if (!sc || sc.scrollTop > 0) { active = false; return; }
      scroller = sc; startY = e.touches[0].clientY; active = true; dist = 0;
    };
    const onMove = (e) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || (scroller && scroller.scrollTop > 0)) { active = false; dist = 0; setPull(0); return; }
      dist = Math.min(MAX, dy * 0.5);
      setPull(dist);
      if (dy > 4 && e.cancelable) e.preventDefault();                   // 阻止原生橡皮筋/滚动
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      const fire = dist >= THRESH;
      setPull(0);
      if (fire) {
        setRefreshing(true);
        try { onRefresh(); } catch { /* noop */ }
        setTimeout(() => setRefreshing(false), 800);
      }
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh, refreshing]);

  const pulling = pull > 0;
  const show = pulling || refreshing;
  const y = refreshing ? 12 : Math.min(pull, 56) - 40;                  // 指示器从顶部滑入
  return hM('div', { className: 'app-root' },
    hM('div', { ref, className: 'm-content', style: { flex: 1, position: 'relative', minHeight: 0 } },
      onRefresh && hM('div', { className: 'm-ptr', style: { opacity: show ? 1 : 0, transition: pulling ? 'opacity .12s' : 'opacity .25s' } },
        hM('div', { className: 'm-ptr-dot', style: {
          transform: `translateY(${y}px)` + (refreshing ? '' : ` rotate(${Math.min(pull * 4, 360)}deg)`),
          transition: pulling ? 'none' : 'transform .25s cubic-bezier(.22,1,.36,1)' } },
          refreshing ? hM(UI.Spinner, { size: 18 }) : hM(Icons.refresh, { size: 18, stroke: 2 }))),
      children));
}
// 兼容旧名（调用方仍叫 PhoneFrame，但已无手机壳语义）
const PhoneFrame = AppShell;

// ============================================================
// 共享内容部件（移动版）
// ============================================================

// 状态徽标
function MStatus({ status }) {
  const s = DATA.STATUS[status];
  return hM(UI.Badge, { tone: s.tone, dot: true }, s.label);
}
// 创建路径 chip
function MPath({ path, mini }) {
  const p = DATA.PATHS[path];
  return hM('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: mini ? 10.5 : 11.5,
    fontWeight: 700, color: p.tint, background: p.tintS, padding: mini ? '2px 7px' : '3px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap' } },
    hM(Icons[p.icon], { size: mini ? 11 : 13, stroke: 2 }), path === 'real' ? '真人复刻' : 'AI 原创');
}
// 衍生计数小条
function MDeriv({ char, max = 4 }) {
  let items = DATA.DERIVS.filter(d => char.counts[d.key] > 0);
  if (!items.length) return hM('span', { style: { fontSize: 11.5, color: 'var(--ink-4)' } }, '暂无衍生物');
  let extra = 0;
  if (items.length > max) { extra = items.length - max; items = items.slice(0, max); }
  return hM('div', { style: { display: 'flex', gap: 5, flexWrap: 'nowrap' } },
    items.map(d => hM('span', { key: d.key, style: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5,
      fontWeight: 600, flex: '0 0 auto', color: DATA.catColor(d.cat), background: DATA.catSoft(d.cat), padding: '2px 6px', borderRadius: 6 } },
      hM(Icons[d.icon], { size: 11, stroke: 2 }), hM('span', { className: 'mono' }, char.counts[d.key]))),
    extra > 0 && hM('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', alignSelf: 'center' } }, '+' + extra));
}

// 区块标题
function MSection({ title, sub, action, onAction, style }) {
  return hM('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, margin: '0 0 13px', ...style } },
    hM('div', { style: { minWidth: 0 } },
      hM('div', { style: { fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 18, letterSpacing: '-.02em', color: 'var(--ink)' } }, title),
      sub && hM('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 } }, sub)),
    action && hM('button', { onClick: onAction, style: { display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none',
      cursor: 'pointer', color: 'var(--primary)', fontSize: 13, fontWeight: 700, flex: '0 0 auto', padding: 0 } },
      action, hM(Icons.chevR, { size: 15, stroke: 2.2 })));
}

// 角标贴片（档案标本式）
function CornerTicks() {
  const pos = [{ top: 5, left: 5 }, { top: 5, right: 5, transform: 'scaleX(-1)' }, { bottom: 5, left: 5, transform: 'scaleY(-1)' }, { bottom: 5, right: 5, transform: 'scale(-1)' }];
  return pos.map((p, i) => hM('span', { key: i, className: 'corner-tick', style: { position: 'absolute', ...p } }));
}

export const MShell = { WxNav, WxTabBar, PhoneFrame, AppShell, TABS };
export const MKit = { MStatus, MPath, MDeriv, MSection, CornerTicks };
