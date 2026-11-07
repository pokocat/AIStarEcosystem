/**
 * Hand-offs between quick generation (AI 视频 / AI 图片) and the AI 导演台.
 * Quick-gen results can be sent into the current project (new shot, replace a shot, asset sheet)
 * or start a new project; the director reads the current project from its auto-save.
 */
import type { GenKind } from '../quickgen/sceneData';
import { orderedShots } from './directorData';
import { ASSET_LABELS, type AssetType } from './studioModel';
import { currentProjectScope, loadSnapshot } from './studioStorage';

export interface DirectorMedia { genId: string; kind: GenKind; image: string; title: string; prompt: string; duration?: number }
export type DirectorTarget =
  | { type: 'new' }
  | { type: 'shot' }
  | { type: 'replace'; shotId: string }
  | { type: 'asset'; assetId: string };
export interface DirectorImport { media: DirectorMedia; to: DirectorTarget }

export interface ProjectOutline {
  name: string;
  shots: Array<{ id: string; title: string; image?: string }>;
  assets: Array<{ id: string; type: AssetType; typeLabel: { zh: string; en: string }; name: string; image?: string }>;
}

/** The project currently open in the AI 导演 for this solution + IP (`base` scope), from its auto-save. */
export const currentProject = (base: string): ProjectOutline | null => {
  const snap = loadSnapshot(currentProjectScope(base));
  if (!snap) return null;
  return {
    name: snap.spec.name,
    shots: orderedShots(snap.nodes).map(s => ({ id: s.id, title: s.title, image: s.image })),
    assets: snap.assets.map(a => ({ id: a.id, type: a.type, typeLabel: ASSET_LABELS[a.type], name: a.name, image: a.image })),
  };
};
