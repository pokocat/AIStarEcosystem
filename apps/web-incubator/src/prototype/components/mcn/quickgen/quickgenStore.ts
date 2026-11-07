/**
 * Shared store for AI 视频 / AI 图片 generations and the 星币 balance they draw from.
 * Every generator instance (AI 创作's image / video modes and shot / asset targets) reads and
 * writes this one store, so works, balance and in-flight renders stay in sync and survive a
 * panel closing. Uploads are object URLs that die with the page, so they are dropped on save.
 */
import { useSyncExternalStore } from 'react';
import type { GenKind } from './sceneData';

export interface Generation {
  id: string;
  kind: GenKind;
  sceneId: string;
  title: string;
  prompt: string;
  createdAt: number;
  status: 'generating' | 'done';
  images: string[];
  ratio: string;
  duration?: number;
  cost: number;
  sentToPool?: boolean;
  /** Set when generated from the AI 导演台 for a specific shot or asset (see QuickGenEmbed.target). */
  target?: string;
  /** Where the result was placed in the AI 导演台, e.g. 《雨夜》镜头 2. */
  usedIn?: string;
}

const KEY = 'ai_quickgen_v1';
const BALANCE_KEY = 'ai_quickgen_balance_v1';
/** Matches the 星币 wallet shown in 设置 › 订阅与账单. */
export const START_BALANCE = 11180;

const keep = (u: string) => !u.startsWith('blob:');

const loadGenerations = (): Generation[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    // Simulated renders do not survive a reload; treat them as finished.
    return parsed.map((g: Generation) => ({ ...g, status: 'done' as const, images: g.images.filter(keep) })).filter(g => g.images.length);
  } catch {
    return [];
  }
};

const saveGenerations = (list: Generation[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter(g => g.status === 'done').map(g => ({ ...g, images: g.images.filter(keep) })).filter(g => g.images.length).slice(0, 80)));
  } catch { /* storage full or blocked */ }
};

const loadBalance = () => {
  const v = Number(localStorage.getItem(BALANCE_KEY));
  return Number.isFinite(v) && v > 0 ? v : START_BALANCE;
};
const saveBalance = (v: number) => { try { localStorage.setItem(BALANCE_KEY, String(v)); } catch { /* ignore */ } };

interface State {
  gens: Generation[];
  balance: number;
  /** Render progress (0–100) for generations still in flight. */
  progress: Record<string, number>;
}

let state: State = { gens: loadGenerations(), balance: loadBalance(), progress: {} };
const listeners = new Set<() => void>();

const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  if (patch.gens) saveGenerations(state.gens);
  if (patch.balance !== undefined) saveBalance(state.balance);
  listeners.forEach(l => l());
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getState = () => state;

export const useQuickGen = () => useSyncExternalStore(subscribe, getState);

export const updateGeneration = (id: string, patch: Partial<Generation>) =>
  set({ gens: state.gens.map(g => (g.id === id ? { ...g, ...patch } : g)) });

export const removeGeneration = (id: string) => set({ gens: state.gens.filter(g => g.id !== id) });

export const getBalance = () => state.balance;

/** Charges `amount` 星币 if the balance covers it (AI 导演 generations). Returns false otherwise. */
export const spend = (amount: number) => {
  if (amount <= 0) return true;
  if (state.balance < amount) return false;
  set({ balance: state.balance - amount });
  return true;
};

/** Charges the balance, then simulates a render of `ms`. `onDone` runs once the result is ready. */
export const startGeneration = (g: Generation, ms: number, onDone?: (g: Generation) => void) => {
  set({ gens: [g, ...state.gens], balance: state.balance - g.cost, progress: { ...state.progress, [g.id]: 0 } });
  const started = Date.now();
  const timer = window.setInterval(() => {
    const pct = Math.min(100, Math.round(((Date.now() - started) / ms) * 100));
    if (pct < 100) { set({ progress: { ...state.progress, [g.id]: pct } }); return; }
    window.clearInterval(timer);
    const { [g.id]: _finished, ...rest } = state.progress;
    set({ gens: state.gens.map(x => (x.id === g.id ? { ...x, status: 'done' } : x)), progress: rest });
    const done = state.gens.find(x => x.id === g.id);
    if (done) onDone?.(done);
  }, 120);
};
