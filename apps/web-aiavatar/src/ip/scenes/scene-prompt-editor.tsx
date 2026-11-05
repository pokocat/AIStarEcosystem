"use client";
// AI 视频的编辑框（2026-11-01，照参考站的样子）：提示词里的「图1」「@图2」显示成「缩略图 + 图1」的小标签，点一下看大图。
// 这类做法通常叫 mention：Tiptap 里一个不可拆的行内节点，光标、删除、撤销都把它当一个字。
// 存下来的仍是纯文本（标签原样写回「图1」），草稿、编导、视频模型和 H3 改写收到的都和以前一样。
// 打字打出「图1」、粘贴进来的「图2」会自动变成标签；编号超出这次交给模型的图数就还是字。
import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { Node, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { ImageLightbox } from "../image-lightbox";
import { splitPromptRefs } from "./scene-prompt-refs";

/** 第 index 张交给视频模型的图（从 1 开始）。 */
export type ScenePromptRef = { index: number; title: string; url?: string; storageKey?: string };
export type ScenePromptEditorHandle = { focus: (at?: "end" | { line: number }, options?: { preventScroll?: boolean }) => void };

const RefsContext = createContext<{ refs: ScenePromptRef[]; open: (ref: ScenePromptRef) => void }>({ refs: [], open: () => undefined });

/** 纯文本 → 编辑器内容：一行一段，有效的「图N」变成标签。 */
function toDoc(text: string, count: number): JSONContent {
  return { type: "doc", content: text.split("\n").map(line => {
    const content = splitPromptRefs(line, count).map(p => "ref" in p ? { type: "sceneRef", attrs: { index: p.ref, raw: p.raw } } : { type: "text", text: p.text });
    return content.length ? { type: "paragraph", content } : { type: "paragraph" };
  }) };
}
const toText = (editor: Editor) => editor.getText({ blockSeparator: "\n" });

const SceneRef = Node.create<{ count: () => number }>({
  name: "sceneRef", group: "inline", inline: true, atom: true, selectable: false, draggable: false,
  addOptions() { return { count: () => 0 }; },
  addAttributes() { return { index: { default: 1 }, raw: { default: "图1" } }; },
  parseHTML() { return [{ tag: "span[data-scene-ref]", getAttrs: el => ({ index: Number((el as HTMLElement).dataset.sceneRef), raw: (el as HTMLElement).dataset.raw || (el as HTMLElement).textContent || "" }) }]; },
  renderHTML({ node }) { return ["span", { "data-scene-ref": String(node.attrs.index), "data-raw": node.attrs.raw }, node.attrs.raw]; },
  renderText({ node }) { return node.attrs.raw; },
  addNodeView() { return ReactNodeViewRenderer(RefChip, { as: "span" }); },
  addProseMirrorPlugins() {
    const count = this.options.count;
    // 打出来、粘进来的「图N」就地变成标签（输入法拼写中的不动，等它上屏）。
    return [new Plugin({ appendTransaction(trs, _before, state) {
      if (!trs.some(t => t.docChanged) || trs.some(t => t.getMeta("composition"))) return null;
      const n = count(), type = state.schema.nodes.sceneRef;
      if (!n || !type) return null;
      const found: { from: number; to: number; index: number; raw: string }[] = [];
      state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        let offset = 0;
        for (const p of splitPromptRefs(node.text, n)) {
          const size = "ref" in p ? p.raw.length : p.text.length;
          if ("ref" in p) found.push({ from: pos + offset, to: pos + offset + size, index: p.ref, raw: p.raw });
          offset += size;
        }
      });
      if (!found.length) return null;
      const tr = state.tr;
      for (const f of found.reverse()) tr.replaceWith(f.from, f.to, type.create({ index: f.index, raw: f.raw }));
      return tr;
    } })];
  },
});

/** 一个「缩略图 + 图N」标签：编辑框里和编导的脚本卡片里同一个样子。 */
export function PromptRefBadge({ index, info, onOpen }: { index: number; info?: ScenePromptRef; onOpen?: (ref: ScenePromptRef) => void }) {
  const label = `图${index}`;
  return <button type="button" className="scene-prompt-ref" tabIndex={-1} title={info ? `${info.title}，点一下看大图` : label}
    aria-label={info ? `${label}：${info.title}，看大图` : label} onMouseDown={e => e.preventDefault()} onClick={() => info && onOpen?.(info)}>
    {info?.url || info?.storageKey ? <SignedImage src={info.url} storageKey={info.storageKey} alt="" draggable={false}/> : null}
    <span>{label}</span>
  </button>;
}

function RefChip({ node }: NodeViewProps) {
  const { refs, open } = useContext(RefsContext);
  return <NodeViewWrapper as="span" className="scene-prompt-ref-host" contentEditable={false}>
    <PromptRefBadge index={node.attrs.index} info={refs.find(r => r.index === node.attrs.index)} onOpen={open}/>
  </NodeViewWrapper>;
}

/** 只读的一段文字，里面的「图N」同样显示成标签（编导的脚本卡片用）。 */
export function PromptText({ text, refs }: { text: string; refs: ScenePromptRef[] }) {
  const [preview, setPreview] = useState<ScenePromptRef>();
  const close = useCallback(() => setPreview(undefined), []);
  const pieces = splitPromptRefs(text, refs.length);
  if (pieces.every(p => "text" in p)) return <>{text}</>;
  return <>
    {pieces.map((p, i) => "ref" in p ? <PromptRefBadge key={i} index={p.ref} info={refs.find(r => r.index === p.ref)} onOpen={setPreview}/> : p.text)}
    {preview?.url && <ImageLightbox src={preview.url} alt={preview.title} open onClose={close}/>}
  </>;
}

export function ScenePromptEditor({ value, onChange, refs, ariaLabel, placeholder, onEnter, ref }: {
  value: string; onChange: (value: string) => void; refs: ScenePromptRef[]; ariaLabel: string; placeholder?: string;
  /** 给了就是 Enter 发送、Shift+Enter 换行（输入法拼写中的回车不算）；不给就是 Enter 换行。 */
  onEnter?: () => void; ref?: Ref<ScenePromptEditorHandle>;
}) {
  const count = useRef(refs.length);
  count.current = refs.length;
  const last = useRef(value), change = useRef(onChange);
  change.current = onChange;
  const enter = useRef(onEnter);
  enter.current = onEnter;
  const [preview, setPreview] = useState<ScenePromptRef>();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ blockquote: false, bold: false, bulletList: false, code: false, codeBlock: false, dropcursor: false, gapcursor: false,
        heading: false, horizontalRule: false, italic: false, listItem: false, listKeymap: false, link: false, orderedList: false, strike: false,
        underline: false, trailingNode: false }),
      SceneRef.configure({ count: () => count.current }),
    ],
    content: toDoc(value, refs.length),
    editorProps: { attributes: { role: "textbox", "aria-label": ariaLabel, "aria-multiline": "true", spellcheck: "false", class: "scene-prompt-editor" },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing || !enter.current) return false;
        enter.current();
        return true;
      } },
    onUpdate: ({ editor }) => {
      const text = toText(editor);
      if (text === last.current) return;
      last.current = text;
      change.current(text);
    },
  });
  // 外面换了内容（采用脚本、撤销、换草稿）或者交给模型的图数变了（标签要多出来或变回字）：按文字重建。
  const shownCount = useRef(refs.length);
  useEffect(() => {
    if (!editor) return;
    if (value === last.current && shownCount.current === refs.length) return;
    last.current = value; shownCount.current = refs.length;
    editor.commands.setContent(toDoc(value, refs.length), { emitUpdate: false });
  }, [editor, value, refs.length]);
  useImperativeHandle(ref, () => ({
    focus(at = "end", options) {
      if (!editor) return;
      const scrollIntoView = !options?.preventScroll;
      if (at === "end") { editor.commands.focus("end", { scrollIntoView }); return; }
      // 第 line 行的行末（一行一段）。
      let pos: number | undefined;
      editor.state.doc.forEach((para, offset, i) => { if (i === at.line) pos = offset + 1 + para.content.size; });
      editor.commands.focus(pos ?? "end", { scrollIntoView });
    },
  }), [editor]);
  const context = useMemo(() => ({ refs, open: (r: ScenePromptRef) => setPreview(r) }), [refs]);
  const close = useCallback(() => setPreview(undefined), []);
  return <RefsContext.Provider value={context}>
    <div className="scene-prompt-field">
      {!value && placeholder && <span className="scene-prompt-placeholder" aria-hidden="true">{placeholder}</span>}
      <EditorContent editor={editor}/>
    </div>
    {preview?.url && <ImageLightbox src={preview.url} alt={preview.title} open onClose={close}/>}
  </RefsContext.Provider>;
}
