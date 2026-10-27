import type { IpProject } from '@ai-star-eco/types';
import { IpStudioApi } from './api';

/** Home and creation centre share these real in-Studio destinations. */
export const studioEntries = {
  assistant: { title: '全能创作', description: '从一个想法开始，和助手一起梳理创作' },
  ip: { title: '制作个人 IP', description: '真人照片变成数字人形象，出多角度设定图' },
  image: { title: '图片创作', description: 'IP 形象、设定图、场景与参考改图' },
  recreation: { title: '解析视频', description: '生成全片拆解文档和风格参考画面' },
  video: { title: '视频创作', description: '描述画面，或从一张首帧开始' },
  script: { title: '剧本创编', description: '原创、改编与分集剧本' },
  director: { title: '分镜讨论', description: '跟助手聊镜头语言、节奏与分镜方案' },
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
/**
 * A brief that asks to copy a reference video cannot be answered before the video is on the canvas: sent at once, the
 * first paid reply only asks for the material (production 2026-10-19, 「复刻一条短视频」 example). Such a brief opens the
 * canvas with the recreation checklist and waits for the user to send.
 */
export const studioBriefNeedsReference = (text: string) => /复刻|翻拍|拉片|做同款|照这条|参考视频|这条视频|原片/.test(text);
/** `send` asks the canvas to send the saved brief as the first message as soon as the assistant is ready (dialogue-first start). */
export const studioEntryHref = (projectId: string, entry: StudioEntry, options: { send?: boolean } = {}) =>
  `/projects/${encodeURIComponent(projectId)}${entry === 'blank' ? '' : `?start=${entry}${options.send && entry === 'assistant' ? '&send=1' : ''}`}`;

/** Names nobody chose: what 「新建」 and the entries call a fresh canvas. Only these are ever replaced by a suggested name. */
export const studioCanvasHasDefaultTitle = (title?: string) => { const t = title?.trim() || ""; return !t || / · 新画布$/.test(t) || t === "未命名画布"; };
/**
 * A recognisable name from what the user asked for: its first clause, without the polite lead-in, at most 20 characters.
 * Every canvas used to be 「全能创作 · 新画布」, and three of them in a row could not be told apart (production 2026-10-19).
 */
export function studioTitleFromBrief(text: string): string | undefined {
  const clause = text.replace(/@\S+/g, "").replace(/[\[［][^\]］]*[\]］]/g, "").split(/[。！？!?\n；;，,：]/)
    .map(part => part.trim().replace(/^(请你?|麻烦你?)?(帮我|给我|帮忙)?/, "").trim()).find(part => part.length >= 2);
  if (!clause) return undefined;
  return clause.length > 20 ? `${clause.slice(0, 20)}…` : clause;
}

/** What 「新建」 names a canvas; the reuse rule below only ever picks a canvas still carrying exactly this name. */
export const STUDIO_NEW_CANVAS_NAME = `${studioEntries.blank.title} · 新画布`;
/** A blank canvas made within this window and never touched is opened again instead of a new one. */
export const STUDIO_NEW_CANVAS_REUSE_MS = 2 * 60 * 60 * 1000;

/** The newest untouched blank canvas from the last two hours, if any. Any failure to tell means 「none」. */
async function reusableBlankCanvas(now: number): Promise<string | undefined> {
  try {
    const recent = (await IpStudioApi.listProjects())
      .filter(p => p.name === STUDIO_NEW_CANVAS_NAME)
      .map(p => ({ id: p.id, created: Date.parse(p.createdAt) }))
      .filter(p => Number.isFinite(p.created) && now - p.created <= STUDIO_NEW_CANVAS_REUSE_MS)
      .sort((a, b) => b.created - a.created)[0];
    if (!recent) return undefined;
    const { doc } = await IpStudioApi.getProject(recent.id);
    return !doc.nodes.length && !doc.assistantConversations?.length ? recent.id : undefined;
  } catch {
    return undefined;
  }
}

let newCanvasInFlight: Promise<string> | undefined;
/**
 * Every 「新建创作 / 新建画布 / 新建空白画布」: a free blank canvas opened with the assistant
 * (docs/ip-studio-new-canvas-and-threads.md §2.1). Clicking it again soon after reuses the canvas that was never touched,
 * so repeated clicks do not pile up empty canvases. Concurrent calls (double click, StrictMode effects) share one creation.
 * Resolves to the canvas address.
 */
export function startNewCanvas(): Promise<string> {
  newCanvasInFlight ??= (async () => {
    const id = (await reusableBlankCanvas(Date.now())) ?? (await createStudioEntry('blank')).id;
    return studioEntryHref(id, 'assistant');
  })().finally(() => { newCanvasInFlight = undefined; });
  return newCanvasInFlight;
}

export class StudioEntrySaveError extends Error {
  constructor(public project: IpProject, message: string) { super(message); }
}

/** Creating a workspace is free. A brief is an ordinary saved text node, never a generation request. */
export async function createStudioEntry(entry: StudioEntry, brief = '', existing?: IpProject): Promise<IpProject> {
  const text = brief.trim();
  let project = existing ?? await IpStudioApi.createProject({ name: (text && studioTitleFromBrief(text)) || `${studioEntries[entry].title} · 新画布` });
  if (!text) return project;
  try {
    if (existing) {
      project = await IpStudioApi.getProject(existing.id);
      const saved = [...project.doc.nodes,...project.doc.assistantConversations||[]].find(n => n.id === `${project.id}-brief`);
      if (saved) {
        if (saved.metadata?.studioStart === entry && saved.metadata?.prompt === text) return project;
        throw new Error('创作想法已在画布中修改，请打开已有画布继续');
      }
    }
    const assistant=entry==='assistant'||entry==='director';
    const input={ id: `${project.id}-brief`, type: 'text', title: '创作想法',
      position: { x: 100, y: 120 }, width: 480, height: 260,
      metadata: { content: text, prompt: text, studioStart: entry,
        ...(assistant?{studio:{kind:'assistant' as const,conversation:{mode:entry==='director'?'director' as const:'general' as const,turns:[]}}}:{}) } };
    const doc = { ...project.doc, ...(assistant?{assistantConversations:[...project.doc.assistantConversations||[],input]}:{nodes:[...project.doc.nodes,input]}) };
    return await IpStudioApi.updateProject(project.id, { doc, baseDocVersion: project.docVersion });
  }
  catch (error) {
    throw new StudioEntrySaveError(project, error instanceof Error ? error.message : '创作想法没有保存成功');
  }
}
