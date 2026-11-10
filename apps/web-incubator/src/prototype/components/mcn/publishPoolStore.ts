/**
 * Items sent to 发布中心 › 发布池 from other parts of the console: AI 导演 / AI 视频 and the batch
 * tools (真人切片、AI 数字人、混剪批量).
 * Stored in localStorage so the pool survives reloads; a window event keeps open views in sync.
 */
export interface ExternalPoolItem {
  id: string;
  title: string;
  type: 'director' | 'clip' | 'digital_person' | 'mix';
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
/** PublishPool sample items in 待审核 (pending_review); works sent from the AI 导演台 add to this. */
export const SAMPLE_POOL_COUNT = 2;

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
