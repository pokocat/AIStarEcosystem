import { nanoid } from 'nanoid';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

export const ASSISTANT_CONTEXT_LIMIT = 16;
export const ASSISTANT_STORY_LIMIT = 24000;
export const assistantContextNodes = (nodes: CanvasNodeData[]) => nodes.filter(n => !['assistant', 'batch'].includes(n.metadata?.studio?.kind || ''));
export const assistantContextIds = (ids: string[]) => [...new Set(ids)].slice(0, ASSISTANT_CONTEXT_LIMIT);

/** Only the active @ query opens suggestions; ordinary email addresses remain text. */
export function assistantMentionQuery(text: string, caret: number) {
  const match = /(?:^|\s)@([^@\n]{0,40})$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[1].length - 1, end: caret, query: match[1] } : undefined;
}

export function insertAssistantMention(text: string, query: { start: number; end: number }, title: string) {
  return text.slice(0, query.start) + '@' + title + ' ' + text.slice(query.end);
}

/** Stories become ordinary editable canvas text, so refresh and retry use the same source. */
export async function readAssistantStory(file: File, nodes: CanvasNodeData[], extractDocument?: (file: File) => Promise<{ text: string }>): Promise<CanvasNodeData> {
  const document = /\.(pdf|doc|docx)$/i.test(file.name);
  if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) throw new Error('请选择 TXT、Markdown、PDF 或 Word 故事文件');
  if (file.size > (document ? 8 * 1024 * 1024 : 256 * 1024)) throw new Error(document ? 'PDF / Word 文件最多 8 MB，请按章节拆分' : '故事文件过大，请拆成不超过 256 KB 的文件');
  let text: string;
  if (document) {
    if (!extractDocument) throw new Error('暂时无法读取 PDF / Word，请稍后重试');
    text = (await extractDocument(file)).text.trim();
  } else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '').trim(); }
    catch { throw new Error('无法读取故事，请将文件保存为 UTF-8 编码'); }
  }
  if (!text || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error('文件没有可用的文字内容');
  if (text.length > ASSISTANT_STORY_LIMIT) throw new Error('单份故事最多 24000 字，请按章节拆分');
  return { id: nanoid(), type: CanvasNodeType.Text, title: file.name.replace(/\.(txt|md|markdown|pdf|doc|docx)$/i, ''), width: 480, height: 300,
    position: { x: Math.max(20, ...nodes.map(n => n.position.x + n.width)) + 80, y: 120 }, metadata: { content: text, status: 'idle' } };
}
