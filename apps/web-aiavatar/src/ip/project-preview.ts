import type { IpProjectDoc } from '@ai-star-eco/types';

export interface ProjectImage { key: string; url: string; title: string }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const plain = (value: string) => value.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>~|]/g, '').replace(/\s+/g, ' ').trim();

/** Small, read-only projection of saved content. Empty/pending nodes are not finished assets. */
export function projectPreview(doc: IpProjectDoc) {
  const images: ProjectImage[] = [], videoKeys = new Set<string>(), audioKeys = new Set<string>();
  const imageKeys = new Set<string>();
  let excerpt = '', textCount = 0, videoTitle = '', audioTitle = '', duration = 0;
  for (const node of doc.nodes) {
    const meta = object(node.metadata), studio = object(meta.studio), script = object(studio.script);
    const key = text(meta.storageKey);
    if (node.type === 'image') {
      const choices = array(meta.images).map(object);
      const primary = choices.find(i => i.id === meta.primaryImageId);
      const add = (candidate: Record<string, unknown>) => {
        const k = text(candidate.storageKey), url = text(candidate.url) || text(candidate.content);
        if (k && !imageKeys.has(k)) { imageKeys.add(k); images.push({ key: k, url, title: node.title || '图片' }); }
      };
      if (primary) add(primary);
      add(meta);
      choices.forEach(add);
    }
    if (node.type === 'video') {
      if (key) { videoKeys.add(key); videoTitle ||= node.title; const take = array(meta.videos).map(object).find(v => v.storageKey === key); const seconds = Number(take?.seconds || meta.durationSec || meta.seconds); if (!duration && Number.isFinite(seconds) && seconds > 0) duration = seconds; }
      for (const v of array(meta.videos).map(object)) if (text(v.storageKey) && v.status !== 'failed' && v.status !== 'error' && v.status !== 'loading') videoKeys.add(text(v.storageKey));
    }
    if (node.type === 'audio' && key) { audioKeys.add(key); audioTitle ||= node.title; }
    if (node.type === 'text') {
      const content = text(meta.content) || text(script.outline) || array(script.episodes).map(e => text(object(e).content)).find(Boolean) || '';
      if (content) { textCount++; excerpt ||= plain(content).slice(0, 240); }
    }
  }
  const counts = [images.length && `${images.length} 张图片`, videoKeys.size && `${videoKeys.size} 段视频`, audioKeys.size && `${audioKeys.size} 段音频`, textCount && `${textCount} 份文字`].filter(Boolean).join(' · ');
  const steps = doc.nodes.filter(n => n.type !== 'group' && n.type !== 'config').map(n => n.title || ({ image: '图片', video: '视频', text: '文字', audio: '音频' }[n.type] || '创作节点'));
  return { images, excerpt, counts, steps, videoTitle, audioTitle, duration, empty: doc.nodes.length === 0 };
}
export type ProjectPreview = ReturnType<typeof projectPreview>;
