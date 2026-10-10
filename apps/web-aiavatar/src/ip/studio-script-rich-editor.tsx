"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Table2, Undo2, Redo2, RemoveFormatting, ListTree } from 'lucide-react';
import type { ChainedCommands } from '@tiptap/core';
import { TableOfContents, type TableOfContentData } from '@tiptap/extension-table-of-contents';
import { Plugin } from '@tiptap/pm/state';
import { scriptRichExtensions } from '@/canvas-bridge/studio-script-rich-extensions';

export type ScriptRichEditorHandle = { jump: (id: string) => void; jumpToTitle: (title: string) => void };
type Props = { markdown: string; onChange?: (markdown: string) => void; onOutline?: (anchors: TableOfContentData) => void; readOnly?: boolean; toolbarContainer?: HTMLElement | null; toolbarHidden?: boolean };
// TOC IDs are navigation state, not a user edit or part of the AI proposal baseline.
const documentFingerprint = (document: unknown) => JSON.stringify(document, (key, value) => key === 'id' || key === 'data-toc-id' ? undefined : value);
const DocumentTableOfContents = TableOfContents.extend({
  addProseMirrorPlugins() {
    return [new Plugin({ filterTransaction(transaction, state) {
      // Native anchor maintenance must not create undo steps or count as manual editing.
      if (transaction.docChanged && documentFingerprint(transaction.doc.toJSON()) === documentFingerprint(state.doc.toJSON())) transaction.setMeta('addToHistory', false);
      return true;
    } }), ...(this.parent?.() ?? [])];
  },
});

/** Markdown remains an interchange format; users edit the rendered document. */
export const StudioScriptRichEditor = forwardRef<ScriptRichEditorHandle, Props>(function StudioScriptRichEditor({ markdown, onChange, onOutline, readOnly = false, toolbarContainer, toolbarHidden = false }, ref) {
  const lastValue = useRef(markdown), change = useRef(onChange);
  const scroll = useRef<HTMLDivElement>(null), outline = useRef(onOutline);
  const imported = useRef<{ markdown: string; document: string } | null>(null);
  const synchronizing = useRef(false);
  const [anchors, setAnchors] = useState<TableOfContentData>([]), [navigationOpen, setNavigationOpen] = useState(false);
  change.current = onChange;
  outline.current = onOutline;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...scriptRichExtensions(), DocumentTableOfContents.configure({
      scrollParent: () => scroll.current || window,
      onUpdate: anchors => { setAnchors(anchors); outline.current?.(anchors); },
    })],
    content: markdown,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: { attributes: { role: 'textbox', 'aria-label': readOnly ? 'AI 建议剧本' : '剧本文档', 'aria-multiline': 'true', 'aria-readonly': String(readOnly), spellcheck: 'false' } },
    onUpdate: ({ editor, transaction }) => {
      if (synchronizing.current) return;
      if (documentFingerprint(transaction.doc.toJSON()) === documentFingerprint(transaction.before.toJSON())) {
        // TOC initialization can also append the editor's trailing empty paragraph.
        // Keep that rendered baseline while retaining the exact original Markdown.
        if (!imported.current || imported.current.document === documentFingerprint(transaction.before.toJSON())) {
          imported.current = { markdown: lastValue.current, document: documentFingerprint(editor.getJSON()) };
        }
        return;
      }
      if (!imported.current) { imported.current = { markdown: lastValue.current, document: documentFingerprint(editor.getJSON()) }; return; }
      // Undo back to the imported document also restores its exact proposal baseline.
      const value = documentFingerprint(editor.getJSON()) === imported.current.document ? imported.current.markdown : editor.getMarkdown();
      // Opening a document must not normalize its baseline or invalidate an AI proposal.
      if (value === lastValue.current) return;
      lastValue.current = value;
      change.current?.(value);
    },
  });
  const state = useEditorState({ editor, selector: ({ editor: e }) => e ? {
    heading: [1, 2, 3, 4].find(level => e.isActive('heading', { level })) || 0,
    bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
    bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'), table: e.isActive('table'),
    undo: e.can().undo(), redo: e.can().redo(),
  } : null });
  useEffect(() => {
    if (!editor) return;
    if (!imported.current) imported.current = { markdown: lastValue.current, document: documentFingerprint(editor.getJSON()) };
    if (markdown === lastValue.current) return;
    lastValue.current = markdown;
    synchronizing.current = true;
    try {
      editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false });
      imported.current = { markdown, document: documentFingerprint(editor.getJSON()) };
    } finally { synchronizing.current = false; }
  }, [editor, markdown]);
  const jump = (id: string) => {
    const anchor = editor?.storage.tableOfContents.content.find(item => item.id === id);
    if (!editor || !anchor) return;
    if (!readOnly) editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(anchor.pos + 1).run();
    anchor.dom.scrollIntoView({ block: 'start' });
    editor.storage.tableOfContents.scrollHandler();
    setNavigationOpen(false);
  };
  useImperativeHandle(ref, () => ({ jump, jumpToTitle(title) {
    const anchor = editor?.storage.tableOfContents.content.find(item => item.textContent === title);
    if (anchor) jump(anchor.id);
  } }), [editor, readOnly]);
  const control = (name: string, icon: React.ReactNode, command: (chain: ChainedCommands) => ChainedCommands, active?: boolean, disabled = false) =>
    <button key={name} type="button" title={name} aria-label={name} aria-pressed={active} disabled={!editor || disabled} onMouseDown={e => e.preventDefault()} onClick={() => editor && command(editor.chain().focus()).run()}>{icon}</button>;
  const toolbar = !readOnly && !toolbarHidden && <div className="studio-rich-toolbar" role="toolbar" aria-label="正文格式">
      <select aria-label="段落样式" value={state?.heading || 0} disabled={!editor} onChange={e => { const level = Number(e.target.value); if (level) editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 | 4 }).run(); else editor?.chain().focus().setParagraph().run(); }}>
        <option value="0">正文</option><option value="1">文档标题</option><option value="2">章节标题</option><option value="3">分集 / 人物标题</option><option value="4">场次标题</option>
      </select>
      <span className="studio-rich-toolbar-divider"/>
      {control('加粗', <Bold size={17}/>, c => c.toggleBold(), state?.bold)}
      {control('斜体', <Italic size={17}/>, c => c.toggleItalic(), state?.italic)}
      {control('下划线', <Underline size={17}/>, c => c.toggleUnderline(), state?.underline)}
      {control('删除线', <Strikethrough size={17}/>, c => c.toggleStrike(), state?.strike)}
      <span className="studio-rich-toolbar-divider"/>
      {control('无序列表', <List size={17}/>, c => c.toggleBulletList(), state?.bullet)}
      {control('有序列表', <ListOrdered size={17}/>, c => c.toggleOrderedList(), state?.ordered)}
      {control('引用', <Quote size={17}/>, c => c.toggleBlockquote(), state?.quote)}
      {control('插入表格', <Table2 size={17}/>, c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), undefined, state?.table)}
      {control('清除文字格式', <RemoveFormatting size={17}/>, c => c.unsetAllMarks())}
      <span className="studio-rich-toolbar-divider"/>
      {control('撤销编辑', <Undo2 size={17}/>, c => c.undo(), undefined, !state?.undo)}
      {control('重做编辑', <Redo2 size={17}/>, c => c.redo(), undefined, !state?.redo)}
    </div>;
  return <div className={`studio-rich-editor${readOnly ? ' is-readonly' : ''}`}>
    {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
    {state?.table && !readOnly && !toolbarHidden && <div className="studio-rich-table-controls" role="toolbar" aria-label="表格操作">
        {['添加行', '删除行', '添加列', '删除列', '删除表格'].map((name, i) => <button key={name} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { const c = editor!.chain().focus(); [() => c.addRowAfter(), () => c.deleteRow(), () => c.addColumnAfter(), () => c.deleteColumn(), () => c.deleteTable()][i]().run(); }}>{name}</button>)}
    </div>}
    <button className="studio-document-navigation-toggle" type="button" aria-label="文档标题导航" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(!navigationOpen)}><ListTree size={16}/>目录</button>
    <div ref={scroll} className="studio-rich-scroll">
      <div className="studio-document-reading-layout">
        <div className={`studio-document-navigation${navigationOpen ? ' is-open' : ''}`} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setNavigationOpen(false); }} onKeyDown={e => { if (e.key === 'Escape' && navigationOpen) { e.stopPropagation(); setNavigationOpen(false); } }}>
          <nav aria-label="文档标题导航">
            <ol>{anchors.map(anchor => <li key={anchor.id} data-level={anchor.originalLevel} style={{ '--outline-depth': Math.max(0, anchor.originalLevel - 2) } as React.CSSProperties}>
              <button type="button" title={anchor.textContent} aria-current={anchor.isActive ? 'location' : undefined} onClick={() => jump(anchor.id)}>{anchor.textContent}</button>
            </li>)}</ol>
          </nav>
        </div>
        <EditorContent editor={editor} className="studio-rich-paper"/>
      </div>
    </div>
  </div>;
});
