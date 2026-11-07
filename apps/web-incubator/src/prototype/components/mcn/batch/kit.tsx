/**
 * Shared building blocks for the workshop's batch tools (真人切片 · AI 数字人 · 混剪批量), in the
 * AI 创作 layout: a 340px composer column on the left, tasks and results on the right.
 * Renders are simulated from start time + duration, so progress survives reloads and tab switches.
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuickGen } from '../quickgen/quickgenStore';

/** A list persisted to localStorage (falls back to `seed` the first time). */
export const useStoredList = <T,>(key: string, seed: () => T[]) => {
  const [list, setList] = useState<T[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : seed();
    } catch {
      return seed();
    }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(list.slice(0, 40))); } catch { /* ignore */ } }, [key, list]);
  return [list, setList] as const;
};

export interface Timed { startedAt: number; durationMs: number }
/** 0–100 from wall-clock time. */
export const progressOf = (t: Timed, now: number) => (t.durationMs <= 0 ? 100 : Math.min(100, Math.round(((now - t.startedAt) / t.durationMs) * 100)));

/** Ticks while `active`, so running tasks re-render their progress. */
export const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
};

export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const today = () => new Date().toISOString().slice(0, 10);

/** Transient status line at the bottom of the results area. */
export const useToast = () => {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(id); }, [toast]);
  const node = (
    <AnimatePresence>
      {toast && (
        <motion.div role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full px-4 py-2 text-[12px] shadow-lg" style={{ background: '#0f172a', color: '#ffffff' }}>
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return [node, setToast] as const;
};

export const ToolLayout = ({ composer, children }: { composer: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex flex-col lg:h-full lg:flex-row lg:overflow-hidden">
    <section className="flex shrink-0 flex-col border-b border-gray-200 bg-white lg:h-full lg:w-[340px] lg:border-b-0 lg:border-r">{composer}</section>
    <div className="min-w-0 flex-1 space-y-3 p-3 md:p-4 lg:min-h-0 lg:overflow-y-auto">{children}</div>
  </div>
);

/** Composer column: header, scrolling fields, sticky footer with the primary action. */
export const Composer = ({ icon: Icon, color, title, desc, children, footer }: {
  icon: React.ComponentType<{ className?: string }>; color: string; title: string; desc: string; children: React.ReactNode; footer: React.ReactNode;
}) => (
  <>
    <div className="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: `${color}14`, color }}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 leading-tight">
        <div className="text-[14px] font-semibold text-gray-900">{title}</div>
        <div className="truncate text-[11px] text-gray-500">{desc}</div>
      </div>
    </div>
    <div className="space-y-4 px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{children}</div>
    <div className="shrink-0 border-t border-gray-100 p-3">{footer}</div>
  </>
);

export const Field = ({ label, hint, children, right }: { label: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-medium text-gray-700">{label}</span>
      {right ?? (hint && <span className="text-[11px] text-gray-400">{hint}</span>)}
    </div>
    {children}
  </div>
);

export const Chips = <V extends string | number>({ options, value, onChange }: { options: Array<[V, string]>; value: V; onChange: (v: V) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(([v, l]) => (
      <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
        className={`rounded-lg px-2.5 py-1 text-[12px] transition ${value === v ? 'font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        style={value === v ? { background: '#0f172a', color: '#ffffff' } : undefined}>{l}</button>
    ))}
  </div>
);

export const Check = ({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 hover:bg-gray-50">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
    <span className="min-w-0">
      <span className="block text-[12px] text-gray-800">{label}</span>
      {sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
    </span>
  </label>
);

/** Primary action with its 星币 cost, the reason it is blocked, and the shared balance. */
export const RunButton = ({ zh, label, cost, blocked, onClick }: { zh: boolean; label: string; cost: number; blocked: string | null; onClick: () => void }) => {
  const { balance } = useQuickGen();
  const reason = blocked ?? (balance < cost ? (zh ? '星币不足，请到 设置 › 订阅与账单 充值' : 'Not enough credits — top up in Settings › Billing') : null);
  return (
    <>
      <button type="button" onClick={onClick} disabled={!!reason}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition disabled:cursor-not-allowed"
        style={reason ? { background: '#ddd6fe', color: '#5b21b6' } : { background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#ffffff', boxShadow: '0 8px 20px -10px rgba(124,58,237,.7)' }}>
        {label}<span className="rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: 'rgba(255,255,255,.22)' }}>⬡ {cost}</span><ArrowUp className="h-4 w-4" />
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5 text-[11px]">
        <span className={`truncate ${reason ? 'text-gray-500' : 'text-emerald-600'}`}>{reason ?? (zh ? '可以开始' : 'Ready')}</span>
        <span className="shrink-0 text-gray-400">{zh ? '余额' : 'Balance'} ⬡ {balance.toLocaleString()}</span>
      </div>
    </>
  );
};

export const Stats = ({ items }: { items: Array<{ label: string; value: string | number; tone?: string }> }) => (
  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    {items.map(s => (
      <div key={s.label} className="rounded-2xl border border-gray-200 bg-white px-3.5 py-3">
        <div className="text-[11px] text-gray-500">{s.label}</div>
        <div className="mt-0.5 text-[22px] font-bold tabular-nums" style={{ color: s.tone ?? '#0f172a', fontFamily: 'var(--font-display)' }}>{s.value}</div>
      </div>
    ))}
  </div>
);

export type Tone = 'running' | 'review' | 'done' | 'failed' | 'idle';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  running: { bg: '#ede9fe', fg: '#6d28d9' },
  review: { bg: '#fef3c7', fg: '#92400e' },
  done: { bg: '#d1fae5', fg: '#047857' },
  failed: { bg: '#fee2e2', fg: '#b91c1c' },
  idle: { bg: '#f1f5f9', fg: '#475569' },
};
export const Pill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: TONES[tone].bg, color: TONES[tone].fg }}>
    {tone === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}{tone === 'done' && <CheckCircle2 className="h-3 w-3" />}{children}
  </span>
);

export const Bar = ({ pct, tone = '#7c3aed' }: { pct: number; tone?: string }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: tone }} /></div>
);

export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-gray-200 bg-white ${className}`}>{children}</section>
);

export const SectionHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
    <div className="min-w-0">
      <h3 className="text-[14px] font-semibold text-gray-900">{title}</h3>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
    {right}
  </div>
);

export const Empty = ({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-5 w-5" /></span>
    <div className="mt-3 text-[14px] font-semibold text-gray-900">{title}</div>
    <p className="mt-1 max-w-xs text-[12px] text-gray-500">{desc}</p>
  </div>
);

export const SmallButton = ({ onClick, children, primary, disabled, title }: { onClick: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean; title?: string }) => (
  <button type="button" onClick={onClick} disabled={disabled} title={title}
    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${primary ? '' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
    style={primary ? { background: '#7c3aed', color: '#ffffff' } : undefined}>{children}</button>
);
