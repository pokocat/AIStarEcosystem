import type { IpProject } from '@ai-star-eco/types';
import { IpStudioApi } from './api';

/** Home and creation centre share these real in-Studio destinations. */
export const studioEntries = {
  assistant: { title: '全能创作', description: '从一个想法开始，和助手一起梳理创作' },
  image: { title: '图片创作', description: 'IP 形象、设定图、场景与参考改图' },
  video: { title: '视频创作', description: '描述画面，或从一张首帧开始' },
  script: { title: '剧本创编', description: '原创、改编与分集剧本' },
  director: { title: '导演执导', description: '讨论镜头语言、节奏与分镜方案' },
  work: { title: '成片编辑', description: '片段排序、配音、字幕与合成' },
  commerce: { title: 'IP 商品视频', description: '人物与商品、卖点、脚本和成片' },
  speech: { title: '人物配音', description: '选择人物声音，编辑台词并试听' },
  lip: { title: '数字人口型', description: '用视频和配音驱动人物口型' },
  library: { title: 'IP 人物库', description: '引用主形象、设定图、造型与声音' },
  blank: { title: '空白画布', description: '自由组合文字、图片、视频和音频' },
} as const;
export type StudioEntry = keyof typeof studioEntries;
export function parseStudioEntry(value: string | null): StudioEntry | undefined {
  return value && Object.hasOwn(studioEntries, value) ? value as StudioEntry : undefined;
}
export const studioEntryHref = (projectId: string, entry: StudioEntry) =>
  `/projects/${encodeURIComponent(projectId)}${entry === 'blank' ? '' : `?start=${entry}`}`;

export class StudioEntrySaveError extends Error {
  constructor(public project: IpProject, message: string) { super(message); }
}

/** Creating a workspace is free. A brief is an ordinary saved text node, never a generation request. */
export async function createStudioEntry(entry: StudioEntry, brief = '', existing?: IpProject): Promise<IpProject> {
  let project = existing ?? await IpStudioApi.createProject({ name: `${studioEntries[entry].title} · 新画布` });
  const text = brief.trim();
  if (!text) return project;
  try {
    if (existing) {
      project = await IpStudioApi.getProject(existing.id);
      const saved = project.doc.nodes.find(n => n.id === `${project.id}-brief`);
      if (saved) {
        if (saved.metadata?.studioStart === entry && saved.metadata?.prompt === text) return project;
        throw new Error('创作想法已在画布中修改，请打开已有画布继续');
      }
    }
    const doc = { ...project.doc, nodes: [...project.doc.nodes, { id: `${project.id}-brief`, type: 'text', title: '创作想法',
      position: { x: 100, y: 120 }, width: 480, height: 260,
      metadata: { content: text, prompt: text, studioStart: entry } }] };
    return await IpStudioApi.updateProject(project.id, { doc, baseDocVersion: project.docVersion });
  }
  catch (error) {
    throw new StudioEntrySaveError(project, error instanceof Error ? error.message : '创作想法没有保存成功');
  }
}
