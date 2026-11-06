/**
 * Local auto-save for the AI 导演台: one snapshot per solution + artist, plus a shared works library.
 * Generation timers do not survive a reload, so in-flight states are reset to "pending" on load.
 */
import type { CanvasNode, ChatMessage, Edge, ProjectSpec, Ratio } from './directorData';
import type { Asset, Episode, StudioView } from './studioModel';
import type { Work } from './WorksDrawer';

export interface StudioSnapshot {
  v: 1;
  savedAt: number;
  spec: ProjectSpec;
  nodes: CanvasNode[];
  edges: Edge[];
  episodes: Episode[];
  assets: Asset[];
  style: string;
  ratio: Ratio;
  view: StudioView;
  messages: ChatMessage[];
  exported: boolean;
}

const projectKey = (scope: string) => `ai_director_project_v1:${scope}`;
const WORKS_KEY = 'ai_director_works_v1';

// Object URLs from uploads die with the page, so they are not worth keeping.
const keepable = (url?: string) => (url && !url.startsWith('blob:') ? url : undefined);

const settle = (s: StudioSnapshot): StudioSnapshot => ({
  ...s,
  nodes: s.nodes.map(n => {
    const image = keepable(n.image);
    const lostUpload = !!n.image && !image;
    return {
      ...n, image,
      status: n.status === 'generating' || lostUpload ? 'idle' : n.status,
      videoStatus: n.videoStatus === 'generating' || (lostUpload && n.videoStatus === 'done') ? 'idle' : n.videoStatus,
    };
  }),
  assets: s.assets.map(a => ({ ...a, image: keepable(a.image), status: a.status === 'generating' || (a.image && !keepable(a.image)) ? 'missing' : a.status })),
  episodes: s.episodes.map(e => (e.status === 'generating' ? { ...e, status: e.body ? 'done' : 'idle' } : e)),
});

export const loadSnapshot = (scope: string): StudioSnapshot | null => {
  try {
    const raw = localStorage.getItem(projectKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioSnapshot;
    if (parsed?.v !== 1 || !parsed.spec || !Array.isArray(parsed.nodes)) return null;
    return settle(parsed);
  } catch {
    return null;
  }
};

/** Returns false when the browser refuses (quota, private mode). */
export const saveSnapshot = (scope: string, snap: Omit<StudioSnapshot, 'v' | 'savedAt'>): number | false => {
  const savedAt = Date.now();
  try {
    localStorage.setItem(projectKey(scope), JSON.stringify({ ...snap, v: 1, savedAt, messages: snap.messages.slice(-60) }));
    return savedAt;
  } catch {
    return false;
  }
};

export const loadWorks = (fallback: Work[]): Work[] => {
  try {
    const raw = localStorage.getItem(WORKS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const saveWorks = (works: Work[]) => {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(works.slice(0, 100))); } catch { /* ignore */ }
};
