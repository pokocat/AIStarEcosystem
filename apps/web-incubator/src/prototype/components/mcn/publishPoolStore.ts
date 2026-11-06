/**
 * Items sent to 发布中心 › 发布池 from other parts of the console (currently the AI 导演台).
 * Stored in localStorage so the pool survives reloads; a window event keeps open views in sync.
 */
export interface ExternalPoolItem {
  id: string;
  title: string;
  type: 'director';
  partnerName: string;
  platform: string;
  account: string;
  status: 'pending_review';
  scheduledAt: string;
  preCheck: { auth: boolean | null; watermark: boolean | null; quality: boolean | null };
  duration: string;
  thumbColor: string;
  thumbImage?: string;
  formats: string[];
}

const KEY = 'ai_publish_pool_v1';
export const POOL_EVENT = 'ai-publish-pool-change';

export const readPool = (): ExternalPoolItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addToPool = (item: ExternalPoolItem) => {
  const next = [item, ...readPool().filter(i => i.id !== item.id)].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked: keep in-memory only */ }
  window.dispatchEvent(new CustomEvent(POOL_EVENT));
  return next;
};

/** "2025-09-12 12:00" style timestamp, `daysAhead` from now at 20:00 (prime time). */
export const primeTimeSlot = (daysAhead = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 20:00`;
};
