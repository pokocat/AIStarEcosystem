"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { DATA } from "./api";
import { Portrait } from "./portrait";

// ============================================================
// 移动端 Shell — iPhone 外壳 + 微信小程序 chrome + 底部 Tab 栏
//   关键约束：右上角胶囊区（约 92px）永远留空，自定义导航栏右侧 padding 让位
// ============================================================
const hM : any = React.createElement;
const { useState: useStateM } = React;

// —— 微信状态栏（黑图标 / 浅底）——
function WxStatusBar() {
  return hM('div', { className: 'wx-statusbar' },
    hM('span', { className: 't' }, '9:41'),
    hM('span', { className: 'ico' },
      // 信号
      hM('svg', { width: 18, height: 11, viewBox: '0 0 18 11', fill: 'currentColor' },
        hM('rect', { x: 0, y: 7, width: 3, height: 4, rx: .6 }),
        hM('rect', { x: 4.5, y: 4.8, width: 3, height: 6.2, rx: .6 }),
        hM('rect', { x: 9, y: 2.5, width: 3, height: 8.5, rx: .6 }),
        hM('rect', { x: 13.5, y: 0, width: 3, height: 11, rx: .6 })),
      // wifi
      hM('svg', { width: 16, height: 11, viewBox: '0 0 16 11', fill: 'currentColor' },
        hM('path', { d: 'M8 3C10.2 3 12.2 3.9 13.6 5.3L14.6 4.2C12.9 2.5 10.6 1.4 8 1.4C5.4 1.4 3.1 2.5 1.4 4.2L2.4 5.3C3.8 3.9 5.8 3 8 3Z' }),
        hM('path', { d: 'M8 6.4C9.3 6.4 10.5 6.9 11.3 7.8L8 11L4.7 7.8C5.5 6.9 6.7 6.4 8 6.4Z' })),
      // 电池
      hM('svg', { width: 26, height: 12, viewBox: '0 0 26 12' },
        hM('rect', { x: .5, y: .5, width: 22, height: 11, rx: 3, fill: 'none', stroke: 'currentColor', strokeOpacity: .4 }),
        hM('rect', { x: 2, y: 2, width: 19, height: 8, rx: 1.6, fill: 'currentColor' }),
        hM('path', { d: 'M24 4v4c.8-.3 1.4-1.1 1.4-2S24.8 4.3 24 4z', fill: 'currentColor', fillOpacity: .5 }))));
}

// —— 微信胶囊（占位 · 不可点，提醒此区域须避开）——
function WxCapsule() {
  return hM('div', { className: 'wx-capsule', title: '微信小程序胶囊按钮区域' },
    hM(Icons.more, { size: 18, stroke: 2.2 }),
    hM('span', { className: 'div' }),
    hM('span', { style: { width: 14, height: 14, borderRadius: 99, border: '1.6px solid currentColor', display: 'inline-block' } }));
}

// —— 自定义导航栏 ——
//  modes: title 居中（tab 页）/ back 返回（二级页）
//  left: 放在标题左侧的元素（如通知铃）；right 侧因胶囊占位，尽量留空
function WxNav({ title, onBack, left, right }) {
  return hM('div', { className: 'wx-nav' },
    onBack
      ? hM('button', { className: 'nav-back m-tap', onClick: onBack }, hM(Icons.chevL, { size: 24, stroke: 2.2 }))
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
  { key: 'me',      icon: Icons.dot,  label: '我的' },
];
function WxTabBar({ active, onTab, onCreate, meIcon }) {
  return hM('div', { className: 'wx-tabbar' },
    TABS.map(t => {
      if (t.fab) {
        return hM('div', { key: 'create', className: 'wx-fab-slot' },
          hM('button', { className: 'wx-fab', onClick: onCreate, 'aria-label': '创建数字人' },
            hM(Icons.plus, { size: 28, stroke: 2.4 }),
            hM('span', { className: 'fab-lbl' }, '创建')));
      }
      const on = active === t.key;
      const Ico = t.key === 'me' ? null : t.icon;
      return hM('button', { key: t.key, className: 'wx-tab' + (on ? ' on' : ''), onClick: () => onTab(t.key) },
        t.key === 'me'
          ? hM('span', { style: { width: 24, height: 24, borderRadius: 99, display: 'grid', placeItems: 'center',
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-disp)',
              background: on ? 'var(--primary)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--ink-3)' } }, '柯')
          : hM(Ico, { size: 24, stroke: on ? 2.1 : 1.85 }),
        hM('span', { className: 'lbl' }, t.label));
    }));
}

// —— 手机外壳 ——
//  状态栏固定在顶部（始终可见）；屏幕内容放在其下方的相对定位容器里，
//  覆盖页只在该容器内 inset:0，绝不遮挡状态栏与胶囊。
function PhoneFrame({ children, darkCap }) {
  return hM('div', { className: 'm-device' },
    hM('div', { className: 'm-island' }),
    hM('div', { className: 'm-screen' + (darkCap ? ' dark-cap' : '') },
      hM(WxStatusBar, null),
      hM(WxCapsule, null),
      hM('div', { className: 'm-content', style: { flex: 1, position: 'relative', minHeight: 0 } }, children),
      hM('div', { className: 'm-home-ind' }, hM('span', null))));
}

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

export const MShell = { WxStatusBar, WxCapsule, WxNav, WxTabBar, PhoneFrame, TABS };
export const MKit = { MStatus, MPath, MDeriv, MSection, CornerTicks };
