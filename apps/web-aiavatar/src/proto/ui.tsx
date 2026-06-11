"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Icons } from "./icons";

// ============================================================
// V3 UI 基础组件
// ============================================================
const { useState: useStateUI, useEffect: useEffectUI, useRef: useRefUI } = React;
const h : any = React.createElement;

// —— Button ——
function Button({ variant = 'primary', size = 'md', icon, iconR, children, onClick, disabled, full, style, ...rest }) {
  const sz = {
    sm: { h: 32, px: 12, fs: 13, gap: 6, ic: 15 },
    md: { h: 40, px: 16, fs: 14, gap: 8, ic: 17 },
    lg: { h: 48, px: 22, fs: 15.5, gap: 9, ic: 19 },
  }[size];
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sz.gap,
    height: sz.h, padding: `0 ${sz.px}px`, width: full ? '100%' : 'auto',
    fontFamily: 'var(--font-ui)', fontSize: sz.fs, fontWeight: 700, letterSpacing: 0,
    borderRadius: 'var(--r-md)', border: '1px solid transparent', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all .16s cubic-bezier(.4,0,.2,1)', whiteSpace: 'nowrap', opacity: disabled ? .5 : 1, minWidth: 0,
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--on-primary)', boxShadow: 'var(--sh-1)' },
    dark:    { background: 'var(--ink)', color: '#fff' },
    soft:    { background: 'var(--primary-soft)', color: 'var(--primary)' },
    line:    { background: 'var(--surface-3)', color: 'var(--ink)' },
    ghost:   { background: 'transparent', color: 'var(--ink-2)' },
    danger:  { background: 'var(--err-s)', color: 'var(--err)' },
  };
  const [hv, setHv] = useStateUI(false);
  const hover = !disabled && hv ? {
    primary: { background: 'var(--primary-700)', transform: 'translateY(-1px)', boxShadow: 'var(--sh-2)' },
    dark:    { background: '#000', transform: 'translateY(-1px)' },
    soft:    { background: '#E2DFFA' },
    line:    { background: '#E7E7EC' },
    ghost:   { background: 'var(--surface-3)', color: 'var(--ink)' },
    danger:  { background: '#FFD7DF' },
  }[variant] : {};
  return h('button', { onClick: disabled ? undefined : onClick, disabled,
    onMouseEnter: () => setHv(true), onMouseLeave: () => setHv(false),
    style: { ...base, ...variants[variant], ...hover, ...style }, ...rest },
    icon && h(icon, { size: sz.ic, stroke: 1.9 }),
    children && h('span', { style: { minWidth: 0, whiteSpace: 'nowrap' } }, children),
    iconR && h(iconR, { size: sz.ic, stroke: 1.9 }));
}

// —— Badge ——
function Badge({ tone = 'mute', children, dot, icon, style }) {
  const map = {
    mute:    { bg: 'var(--surface-3)', c: 'var(--ink-2)' },
    primary: { bg: 'var(--primary-soft)', c: 'var(--primary)' },
    ok:      { bg: 'var(--ok-s)', c: 'var(--ok)' },
    warn:    { bg: 'var(--warn-s)', c: 'var(--warn)' },
    err:     { bg: 'var(--err-s)', c: 'var(--err)' },
    info:    { bg: 'var(--info-s)', c: 'var(--info)' },
  };
  const m = map[tone] || map.mute;
  return h('span', { style: {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 23, padding: '0 9px',
    background: m.bg, color: m.c, borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700,
    letterSpacing: '.01em', ...style } },
    dot && h('span', { style: { width: 6, height: 6, borderRadius: 99, background: m.c } }),
    icon && h(icon, { size: 13, stroke: 2 }),
    children);
}

// —— 引擎角标（已弃用：技术引擎名对用户无意义，统一隐藏）——
function EngineTag() { return null; }

// —— Card ——
function Card({ children, pad = 18, hover, onClick, sel, style }) {
  const [hv, setHv] = useStateUI(false);
  return h('div', { onClick,
    onMouseEnter: () => hover && setHv(true), onMouseLeave: () => hover && setHv(false),
    style: {
      background: 'var(--surface)', border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--line)'),
      borderRadius: 'var(--r-lg)', padding: pad, cursor: onClick ? 'pointer' : 'default',
      boxShadow: sel ? 'var(--ring)' : (hv ? 'var(--sh-2)' : 'var(--sh-1)'),
      transform: hv ? 'translateY(-2px)' : 'none', transition: 'all .18s cubic-bezier(.4,0,.2,1)', ...style } },
    children);
}

// —— SegTabs（顶部 tab，HeyGen 式下划线 + 可选右侧控件槽）——
function Tabs({ tabs, active, onChange, right, style }) {
  return h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', ...style } },
    h('div', { style: { display: 'flex', gap: 26 } },
      tabs.map(t => {
        const on = t.key === active;
        return h('button', { key: t.key, onClick: () => onChange(t.key), style: {
          position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 13px',
          fontFamily: 'var(--font-disp)', fontSize: 17, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
          color: on ? 'var(--ink)' : 'var(--ink-3)', letterSpacing: '-.01em', transition: 'color .15s' } },
          t.label,
          t.count != null && h('span', { className: 'mono', style: { fontSize: 11.5, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)',
            background: on ? 'var(--primary-soft)' : 'var(--surface-3)', color: on ? 'var(--primary)' : 'var(--ink-3)' } }, t.count),
          on && h('span', { style: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5,
            background: 'var(--primary)', borderRadius: 99 } }));
      })),
    right && h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 } }, right));
}

// —— Segmented（分段控件）——
function Seg({ options, value, onChange, size = 'md', style }) {
  const hh = size === 'sm' ? 30 : 36;
  return h('div', { style: {
    display: 'inline-flex', background: 'var(--surface-3)', padding: 3, borderRadius: 'var(--r-pill)', ...style } },
    options.map(o => {
      const on = o.key === value;
      return h('button', { key: o.key, onClick: () => onChange(o.key), title: o.title, style: {
        display: 'inline-flex', alignItems: 'center', gap: 6, height: hh, padding: '0 14px',
        background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
        border: 'none', borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        boxShadow: on ? 'var(--sh-1)' : 'none', transition: 'all .14s' } },
        o.icon && h(o.icon, { size: 15, stroke: 1.9 }), o.label && h('span', null, o.label));
    }));
}

// —— Pill 过滤标签 ——
function FilterPill({ active, children, onClick, count }) {
  return h('button', { onClick, style: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34, minWidth: 84, padding: '0 15px',
    background: active ? 'var(--ink)' : 'var(--surface-3)', color: active ? '#fff' : 'var(--ink-2)',
    border: 'none', borderRadius: 'var(--r-pill)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', whiteSpace: 'nowrap', flex: '0 0 auto' } },
    children,
    count != null && h('span', { style: { fontSize: 11, opacity: .6, fontFamily: 'var(--font-mono)' } }, count));
}

// —— 输入 ——
function Field({ label, hint, required, children, style }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, ...style } },
    label && h('label', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' } },
      label, required && h('span', { style: { color: 'var(--err)', marginLeft: 3 } }, '*')),
    children,
    hint && h('div', { style: { fontSize: 12, color: 'var(--ink-3)' } }, hint));
}
const inputBase = {
  width: '100%', height: 44, padding: '0 14px', background: 'var(--surface)', color: 'var(--ink)',
  border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', fontSize: 14, fontFamily: 'var(--font-ui)',
  outline: 'none', transition: 'border .15s, box-shadow .15s',
};
function Input({ value, onChange, placeholder, icon, type = 'text', style }) {
  const [f, setF] = useStateUI(false);
  return h('div', { style: { position: 'relative', width: '100%' } },
    icon && h(icon, { size: 17, stroke: 1.8, style: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }),
    h('input', { type, value, placeholder, onChange: e => onChange && onChange(e.target.value),
      onFocus: () => setF(true), onBlur: () => setF(false),
      style: { ...inputBase, paddingLeft: icon ? 40 : 14, borderColor: f ? 'var(--primary)' : 'var(--line-2)', boxShadow: f ? 'var(--ring)' : 'none', ...style } }));
}
function Textarea({ value, onChange, placeholder, rows = 4, style }) {
  const [f, setF] = useStateUI(false);
  return h('textarea', { value, placeholder, rows, onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setF(true), onBlur: () => setF(false),
    style: { ...inputBase, height: 'auto', padding: '12px 14px', resize: 'vertical', lineHeight: 1.6,
      borderColor: f ? 'var(--primary)' : 'var(--line-2)', boxShadow: f ? 'var(--ring)' : 'none', ...style } });
}
function Select({ value, onChange, options, placeholder, style }) {
  return h('div', { style: { position: 'relative', width: '100%' } },
    h('select', { value, onChange: e => onChange && onChange(e.target.value),
      style: { ...inputBase, appearance: 'none', cursor: 'pointer', color: value ? 'var(--ink)' : 'var(--ink-3)', ...style } },
      placeholder && h('option', { value: '', disabled: true }, placeholder),
      options.map(o => h('option', { key: o.value ?? o, value: o.value ?? o }, o.label ?? o))),
    h(Icons.chevD, { size: 16, stroke: 2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }));
}

// —— Slider ——
function Slider({ value, min = -50, max = 50, onChange, accent = 'var(--primary)' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return h('div', { style: { position: 'relative', height: 22, display: 'flex', alignItems: 'center' } },
    h('div', { style: { position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 99, background: 'var(--surface-3)', border: '1px solid var(--line)' } }),
    h('div', { style: { position: 'absolute', left: 0, width: pct + '%', height: 5, borderRadius: 99, background: accent } }),
    h('input', { type: 'range', min, max, value, onChange: e => onChange(+e.target.value),
      style: { position: 'absolute', left: -2, right: -2, width: 'calc(100% + 4px)', margin: 0, appearance: 'none', background: 'transparent', cursor: 'pointer', height: 22 } }),
    h('div', { style: { position: 'absolute', left: `calc(${pct}% - 9px)`, width: 18, height: 18, borderRadius: 99, background: 'var(--surface)', border: '2px solid ' + accent, boxShadow: 'var(--sh-1)', pointerEvents: 'none' } }));
}

// —— ProgressBar ——
function Progress({ pct, tone = 'primary', h: hh = 6, showLabel }) {
  const c = { primary: 'var(--primary)', ok: 'var(--ok)', warn: 'var(--warn)', err: 'var(--err)' }[tone];
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%' } },
    h('div', { style: { flex: 1, height: hh, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' } },
      h('div', { style: { width: pct + '%', height: '100%', borderRadius: 99, background: c, transition: 'width .4s ease' } })),
    showLabel && h('span', { className: 'mono', style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, minWidth: 34, textAlign: 'right' } }, pct + '%'));
}

// —— Spinner ——
function Spinner({ size = 16, c = 'var(--primary)' }) {
  return h('span', { style: { display: 'inline-block', width: size, height: size, borderRadius: 99,
    border: `2px solid ${c}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite' } });
}

// —— Stepper（顶部固定步骤条）——
function Stepper({ steps, current, done = [], onJump }) {
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: 0 } },
    steps.map((s, i) => {
      const isDone = done.includes(s.key);
      const isCur = s.key === current;
      const reachable = isDone || isCur;
      const c = isCur ? 'var(--primary)' : isDone ? 'var(--ok)' : 'var(--ink-4)';
      return h(React.Fragment, { key: s.key },
        i > 0 && h('div', { style: { width: 26, height: 2, margin: '0 4px', borderRadius: 99,
          background: (done.includes(steps[i-1].key)) ? 'var(--ok)' : 'var(--line-2)' } }),
        h('button', { onClick: () => reachable && onJump && onJump(s.key), style: {
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px',
          background: isCur ? 'var(--primary-soft)' : 'transparent', border: 'none',
          borderRadius: 'var(--r-pill)', cursor: reachable ? 'pointer' : 'default' } },
          h('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 99, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)',
            background: isCur ? 'var(--primary)' : isDone ? 'var(--ok)' : 'var(--surface-3)',
            color: (isCur || isDone) ? '#fff' : 'var(--ink-3)', border: isDone || isCur ? 'none' : '1px solid var(--line-2)' } },
            isDone ? h(Icons.check, { size: 14, stroke: 2.6 }) : s.n),
          h('span', { style: { fontSize: 13.5, fontWeight: isCur ? 700 : 600, whiteSpace: 'nowrap', color: isCur ? 'var(--primary)' : isDone ? 'var(--ink-2)' : 'var(--ink-3)' } }, s.short)));
    }));
}

// —— Modal ——
function Modal({ open, onClose, children, w = 720, title }) {
  useEffectUI(() => {
    if (!open) return;
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn);
  }, [open]);
  if (!open) return null;
  const node = h('div', { onClick: onClose, style: {
    position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,25,34,.42)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 20px', overflow: 'auto' } },
    h('div', { onClick: e => e.stopPropagation(), className: 'fade-up', style: {
      width: '100%', maxWidth: w, background: 'var(--surface)', borderRadius: 'var(--r-2xl)',
      boxShadow: 'var(--sh-3)', border: '1px solid var(--line)' } },
      title && h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', borderBottom: '1px solid var(--line)' } },
        h('h3', { style: { fontSize: 19 } }, title),
        h('button', { onClick: onClose, style: { background: 'var(--surface-3)', border: 'none', width: 34, height: 34, borderRadius: 99, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' } }, h(Icons.x, { size: 18 }))),
      children));
  // portal 到 body：调用方常把 Modal 渲染在 .m-fade / .m-stagger 内容里，这些容器的
  // transform 动画（fill-mode: both 永久生效）会常驻 stacking context，fixed 覆盖层
  // 在其中压不过外层 sticky / 底部操作栏（与 MLightbox 同因）。
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

// —— Confirm（二次确认；危险操作用，替代原生 confirm）——
function Confirm({ open, onClose, onConfirm, title = '确认操作', desc, confirmText = '确认', cancelText = '取消', danger = true, busy }) {
  return h(Modal, { open, onClose: busy ? () => {} : onClose, w: 340 },
    h('div', { style: { padding: '22px 22px 18px' } },
      h('div', { style: { fontSize: 17, fontWeight: 800, marginBottom: 8 } }, title),
      desc && h('div', { style: { fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 18 } }, desc),
      h('div', { style: { display: 'flex', gap: 10, marginTop: desc ? 0 : 16 } },
        h(Button, { variant: 'line', full: true, onClick: onClose, disabled: busy }, cancelText),
        h('button', { onClick: onConfirm, disabled: busy, className: 'm-tap', style: {
          flex: 1, height: 42, border: 'none', borderRadius: 'var(--r-pill)', cursor: busy ? 'default' : 'pointer',
          background: danger ? 'var(--err)' : 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700,
          opacity: busy ? .6 : 1 } }, busy ? '处理中…' : confirmText))));
}

// —— Tooltip-ish 小标签 ——
function Spec({ children, style }) {
  return h('span', { className: 'mono', style: { fontSize: 11, color: 'var(--ink-3)', ...style } }, children);
}

// —— Toast ——
function ToastHost() {
  const [items, setItems] = useStateUI([]);
  useEffectUI(() => {
    window.toast = (msg, opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      setItems(x => [...x, { id, msg, tone: opts.tone || 'default' }]);
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), opts.dur || 2600);
    };
  }, []);
  return h('div', { style: { position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
    zIndex: 300, display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center' } },
    items.map(it => {
      const tc = { ok: 'var(--ok)', err: 'var(--err)', warn: 'var(--warn)', default: 'var(--primary)' }[it.tone];
      const ic = { ok: Icons.checkc, err: Icons.warn, warn: Icons.warn, default: Icons.info }[it.tone];
      return h('div', { key: it.id, className: 'fade-up', style: {
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: 'var(--ink)',
        color: '#fff', borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-3)', fontSize: 13.5, fontWeight: 600 } },
        h(ic, { size: 17, style: { color: tc } }), it.msg);
    }));
}

export { Button, Badge, EngineTag, Card, Tabs, Seg, FilterPill, Field, Input, Textarea, Select,
  Slider, Progress, Spinner, Stepper, Modal, Confirm, Spec, ToastHost, inputBase };
