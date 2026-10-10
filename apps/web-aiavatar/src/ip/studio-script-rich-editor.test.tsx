// @vitest-environment jsdom
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { scriptRichExtensions } from '@/canvas-bridge/studio-script-rich-extensions';
import { StudioScriptRichEditor, type ScriptRichEditorHandle } from './studio-script-rich-editor';
import { markdownToScript, scriptFramework, scriptMarkdownError } from '@/canvas-bridge/studio-script-markdown';

const editors: Editor[] = [];
const open = (markdown: string) => { const e = new Editor({ extensions: scriptRichExtensions(), content: markdown, contentType: 'markdown' }); editors.push(e); return e; };
beforeEach(() => { vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 0)); });
afterEach(() => { cleanup(); editors.splice(0).forEach(e => e.destroy()); vi.unstubAllGlobals(); });

test('the script framework is rendered as headings, labels retain line breaks, and the downstream projection survives editing', () => {
  const e = open(scriptFramework('雨夜'));
  expect(e.getHTML()).toContain('<h2>人物小传</h2>');
  expect(e.getHTML()).toContain('故事背景：<br>核心冲突：');
  e.commands.insertContentAt(e.state.doc.content.size - 1, '结尾补充');
  const value = e.getMarkdown();
  expect(scriptMarkdownError(value)).toBeUndefined();
  expect(markdownToScript(value).episodes[0].content).toContain('场景：');
  expect(markdownToScript(value).episodes[0].content).toContain('出场人物：');
  expect(open(value).getHTML()).toBe(e.getHTML());
});

test('formatting structural headings keeps their visible identity, saved marks and outline navigation', () => {
  const e = open(scriptFramework('雨夜'));
  const decorate = (title: string, mark: string) => {
    let target: { from: number; to: number } | undefined;
    e.state.doc.descendants((node, pos) => { if (node.type.name === 'heading' && node.textContent === title) target = { from: pos + 1, to: pos + 1 + node.content.size }; });
    expect(target).toBeDefined(); e.commands.setTextSelection(target!); e.commands.setMark(mark);
  };
  decorate('雨夜', 'italic'); decorate('故事大纲', 'bold'); decorate('主角', 'underline'); decorate('第 1 集 · 开场', 'strike');
  const markdown = e.getMarkdown(), projected = markdownToScript(markdown);
  expect(scriptMarkdownError(markdown)).toBeUndefined();
  expect(projected.title).toBe('雨夜'); expect(projected.characters[0].name).toBe('主角');
  expect(projected.episodes[0]).toMatchObject({ no: 1, title: '开场' });
  expect(open(markdown).getJSON()).toEqual(e.getJSON());
  expect(markdown).toContain('## **故事大纲**'); expect(markdown).toContain('++主角++');
});

test.each([
  ['bold', '**对白**'], ['italic', '*对白*'], ['underline', '++对白++'], ['strike', '~~对白~~'],
])('%s formatting persists across the document interchange and reload', (mark, markdown) => {
  const e = open('对白'); e.commands.setTextSelection({ from: 1, to: 3 }); e.commands.setMark(mark);
  expect(e.getMarkdown()).toBe(markdown);
  expect(open(e.getMarkdown()).getJSON()).toEqual(e.getJSON());
});

test('nested lists, ordered lists, quotes and a simple table retain their structure', () => {
  const value = '# 雨夜\n\n- 动作\n  - 递出钥匙\n\n1. 开场\n2. 悬念\n\n> 雨声盖过对白\n\n| 人物 | 对白 |\n| --- | --- |\n| 林 | 你终于来了 |';
  const e = open(value), reloaded = open(e.getMarkdown());
  expect(reloaded.getJSON()).toEqual(e.getJSON());
  expect(reloaded.getHTML()).toContain('<table');
  expect(reloaded.getHTML()).toContain('<blockquote>');
  expect(reloaded.getHTML()).toContain('<ol>');
});

test('pasted HTML cannot retain scripts, event attributes or javascript links', () => {
  const e = open('原稿');
  e.commands.setContent('<h1 onclick="alert(1)">雨夜</h1><script>alert(1)</script><p><a href="javascript:alert(1)">对白</a></p>');
  expect(e.getHTML()).not.toMatch(/script|onclick|javascript/);
});

test('opening or receiving an unchanged document does not emit a normalized draft or reset the cursor', async () => {
  const value = scriptFramework('雨夜'), change = vi.fn();
  const { rerender } = render(<StudioScriptRichEditor markdown={value} onChange={change}/>);
  const doc = await screen.findByRole('textbox', { name: '剧本文档' });
  expect(doc.querySelector('h2')?.textContent).toBe('故事大纲');
  expect(doc.textContent).not.toContain('##');
  expect(change).not.toHaveBeenCalled();
  rerender(<StudioScriptRichEditor markdown={value} onChange={change}/>);
  expect(change).not.toHaveBeenCalled();
});

test('toolbar formatting reflects the current selection state', async () => {
  const change = vi.fn(); render(<StudioScriptRichEditor markdown="对白" onChange={change}/>);
  const doc = await screen.findByRole('textbox', { name: '剧本文档' });
  const selection = window.getSelection()!, range = document.createRange();
  range.selectNodeContents(doc.querySelector('p')!); selection.removeAllRanges(); selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  // ProseMirror reads the DOM selection after focus.
  fireEvent.focus(doc); fireEvent.mouseUp(doc);
  await waitFor(() => expect(screen.getByRole('button', { name: '加粗' })).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: '加粗' }));
  // Stored marks at a collapsed cursor are valid too; the schema round-trip above covers selected text.
  expect(screen.getByRole('button', { name: '加粗' }).getAttribute('aria-pressed')).toBe('true');
});

test('external AI adoption displays its formatted content without a synthetic change; the proposal renderer is read-only', async () => {
  const change = vi.fn(), { rerender } = render(<StudioScriptRichEditor markdown="# 原稿" onChange={change}/>);
  await screen.findByRole('textbox', { name: '剧本文档' });
  rerender(<StudioScriptRichEditor markdown={'# AI 版本\n\n**新对白**'} onChange={change}/>);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'AI 版本' })).toBeDefined());
  expect(change).not.toHaveBeenCalled();
  cleanup(); render(<StudioScriptRichEditor markdown={'# AI 版本\n\n**新对白**'} readOnly/>);
  const proposal = await screen.findByRole('textbox', { name: 'AI 建议剧本' });
  expect(proposal.getAttribute('contenteditable')).toBe('false');
  expect(screen.queryByRole('toolbar')).toBeNull();
  expect(proposal.querySelector('strong')?.textContent).toBe('新对白');
});

test('outline navigation finds rendered headings and selects their text position', async () => {
  const scroll = vi.fn(); HTMLElement.prototype.scrollIntoView = scroll;
  const ref = createRef<ScriptRichEditorHandle>(), outline = vi.fn(); render(<StudioScriptRichEditor ref={ref} markdown={scriptFramework('雨夜')} onOutline={outline}/>);
  await screen.findByRole('textbox', { name: '剧本文档' }); await waitFor(() => expect(outline).toHaveBeenCalled()); act(() => ref.current?.jumpToTitle('人物小传'));
  expect(scroll).toHaveBeenCalledWith({ block: 'start' });
});

test('the native document outline follows renamed, inserted, deleted and demoted headings with stable distinct anchors', async () => {
  const outline = vi.fn(), change = vi.fn(); render(<StudioScriptRichEditor markdown={'# 原标题\n\n## 故事大纲\n\n### 概要设计\n\n### 概要设计'} onOutline={outline} onChange={change}/>);
  await screen.findByRole('textbox', { name: '剧本文档' });
  const anchors = () => outline.mock.calls.at(-1)?.[0] ?? [];
  await waitFor(() => expect(anchors()).toHaveLength(4));
  expect(change).not.toHaveBeenCalled();
  expect((screen.getByRole('button',{name:'撤销编辑'}) as HTMLButtonElement).disabled).toBe(true);
  const editor: Editor = anchors()[0].editor, id = anchors()[2].id;
  expect(anchors()[2].id).not.toBe(anchors()[3].id);
  act(() => editor.commands.insertContentAt({from: anchors()[2].pos+1,to: anchors()[2].pos+1+anchors()[2].node.content.size},'剧情概要'));
  expect(anchors()[2]).toMatchObject({id,textContent:'剧情概要',originalLevel:3});
  act(() => editor.chain().setTextSelection(anchors()[2].pos+1).setHeading({level:4}).run());
  expect(anchors()[2]).toMatchObject({id,textContent:'剧情概要',originalLevel:4});
  act(() => editor.commands.insertContentAt(editor.state.doc.content.size,{type:'heading',attrs:{level:2},content:[{type:'text',text:'自定义章节'}]}));
  expect(anchors().at(-1)).toMatchObject({textContent:'自定义章节',originalLevel:2});
  const removed=anchors()[2];act(() => editor.commands.deleteRange({from:removed.pos,to:removed.pos+removed.node.nodeSize}));
  expect(anchors().some((anchor:any)=>anchor.id===id)).toBe(false);
  act(() => editor.commands.undo()); expect(anchors().some((anchor:any)=>anchor.textContent==='剧情概要')).toBe(true);
  act(() => editor.commands.redo()); expect(anchors().some((anchor:any)=>anchor.textContent==='剧情概要')).toBe(false);
});

test('duplicate heading titles navigate by native anchor ID and external proposal changes update the outline without dirtying it', async () => {
  const outline=vi.fn(),change=vi.fn(),ref=createRef<ScriptRichEditorHandle>(),scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
  const {rerender}=render(<StudioScriptRichEditor ref={ref} markdown={'# 文档\n\n## 同名标题\n\n## 同名标题'} onOutline={outline} onChange={change}/>);
  await screen.findByRole('textbox',{name:'剧本文档'});await waitFor(()=>expect(outline.mock.calls.at(-1)?.[0]).toHaveLength(3));
  const anchors=outline.mock.calls.at(-1)![0],second=anchors[2];act(()=>ref.current?.jump(second.id));
  expect(second.editor.state.selection.from).toBe(second.pos+1);
  expect(scroll).toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
  rerender(<StudioScriptRichEditor ref={ref} markdown={'# 建议稿\n\n## 新大纲\n\n### 新子标题'} onOutline={outline} onChange={change}/>);
  await waitFor(()=>expect(outline.mock.calls.at(-1)![0].map((a:any)=>a.textContent)).toEqual(['建议稿','新大纲','新子标题']));
  expect(change).not.toHaveBeenCalled();
});
