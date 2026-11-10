import type { StudioEntry } from './studio-entry';

/**
 * Visual entry points open the existing canvas tools; images are capability illustrations. The blank canvas is not one of
 * them: /create shows it as the 「新建画布」 card above these (docs/ip-studio-new-canvas-and-threads.md §2.2).
 */
export const studioCreateTools = [
  { entry: 'image', description: '设计形象、场景，改写参考画面。', image: 'image' },
  { entry: 'video', description: '由文字描述或首帧生成视频。', image: 'video' },
  { entry: 'script', description: '从故事构思，到完整剧本。', image: 'script' },
  { entry: 'recreation', description: '拆解镜头与风格，生成解析文档。', image: 'recreation' },
  { entry: 'director', description: '推敲镜头、节奏与分镜。', image: 'director' },
  { entry: 'work', description: '编排片段，完成字幕与合成。', image: 'work' },
  { entry: 'speech', description: '选择人物声音，为台词配音。', image: 'speech' },
  { entry: 'lip', description: '用配音驱动人物口型。', image: 'lip' },
  { entry: 'library', description: '沿用角色的形象、造型与声音。', image: 'library' },
] satisfies { entry: Exclude<StudioEntry, 'blank'>; description: string; image: string }[];
