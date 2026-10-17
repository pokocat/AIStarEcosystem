import type { IpTemplate } from '@ai-star-eco/types';

export const studioScenes = [
  { id: 'commerce', title: '剧情带货', description: '让商品成为故事的一部分。', templateId: 'IPD-scene-commerce', image: '/studio/scenes/commerce.png' },
  { id: 'recreation', title: '爆款复刻', description: '借鉴出彩的结构，创作自己的表达。', templateId: 'IPD-scene-recreation', image: '/studio/scenes/recreation.png' },
  { id: 'drama', title: '短剧制作', description: '从故事构思，到一幕幕成片。', templateId: undefined, image: '/studio/scenes/drama.png' },
  { id: 'music', title: '音乐创作', description: '让灵感有词，让情绪有声。', templateId: undefined, image: '/studio/scenes/music.png' },
] as const;

export function sceneTemplate(templates: IpTemplate[], templateId?: string) {
  return templateId ? templates.find(t => t.id === templateId && t.enabled !== false && t.visibility !== 'personal') : undefined;
}
