"use client";
// AI 视频的编辑框（2026-11-01，照参考站的样子）：提示词里的「图1」「@图2」显示成「缩略图 + 图1」的小标签，点一下看大图。
// 这类做法通常叫 mention：Tiptap 里一个不可拆的行内节点，光标、删除、撤销都把它当一个字。
// 存下来的仍是纯文本（标签原样写回「图1」），草稿、编导、视频模型和 H3 改写收到的都和以前一样。
// 打字打出「图1」、粘贴进来的「图2」会自动变成标签；编号超出这次交给模型的图数就还是字。
// 输入 @ 弹出已经放好的素材（照参考站，2026-11-05），选一个就插入那张图的标签。
import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { ImageIcon } from "lucide-react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { Node, type Editor, type JSONContent } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { ImageLightbox } from "../image-lightbox";
import { splitPromptRefs } from "./scene-prompt-refs";

/** 第 index 张交给视频模型的图（从 1 开始）。 */
export type ScenePromptRef = { index: number; title: string; url?: string; storageKey?: string;
  /** @ 菜单里标题下面那行（文件名）。 */
  detail?: string };
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

/** 光标前面的 @ 和后面打的字：from 到 to 是选中素材时要换掉的那段。 */
type Mention = { from: number; to: number; query: string; x: number; top: number; bottom: number };

function mentionAt(editor: Editor): Mention | undefined {
  const { selection } = editor.state;
  if (!selection.empty || editor.view.composing) return undefined;
  const { $from } = selection;
  // 标签算一个占位字符，offset 才和文档位置对得上。
  const before = $from.parent.textBetween(0, $from.parentOffset, "\0", "\0");
  const m = /@([^\s@\0]*)$/.exec(before);
  if (!m) return undefined;
  const from = $from.start() + m.index;
  let x = 0, top = 0, bottom = 0;
  try { const at = editor.view.coordsAtPos(from); x = at.left; top = at.top; bottom = at.bottom; } catch { /* 测试环境量不出位置 */ }
  return { from, to: selection.from, query: m[1], x, top, bottom };
}

const matchesMention = (r: ScenePromptRef, query: string) => !query || `图${r.index}`.includes(query) || r.title.includes(query) || !!r.detail?.includes(query);

export function ScenePromptEditor({ value, onChange, refs, ariaLabel, placeholder, onEnter, lead, ref }: {
  value: string; onChange: (value: string) => void; refs: ScenePromptRef[]; ariaLabel: string; placeholder?: string;
  /** 文字前面不可编辑的标签（「技能：服装上身」）。 */
  lead?: string;
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
  const [mention, setMention] = useState<Mention>();
  const [active, setActive] = useState(0);
  const refsNow = useRef(refs);
  refsNow.current = refs;
  const mentionNow = useRef<{ mention?: Mention; active: number; pick: (r: ScenePromptRef) => void }>({ active: 0, pick: () => undefined });
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
        const open = mentionNow.current.mention;
        if (open && !event.isComposing) {
          const items = refsNow.current.filter(r => matchesMention(r, open.query));
          if (event.key === "Escape") { event.stopPropagation(); setMention(undefined); return true; }
          if (items.length) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive(i => (i + step + items.length) % items.length);
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") { mentionNow.current.pick(items[Math.min(mentionNow.current.active, items.length - 1)]); return true; }
          }
        }
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
    onTransaction: ({ editor }) => {
      const next = editor.isFocused ? mentionAt(editor) : undefined;
      setMention(old => old?.from === next?.from && old?.to === next?.to && old?.query === next?.query ? old : next);
      if (!next) setActive(0);
    },
    onBlur: () => setMention(undefined),
  });
  const pick = useCallback((r: ScenePromptRef) => {
    const at = mentionNow.current.mention;
    if (!editor || !at) return;
    editor.chain().focus(undefined, { scrollIntoView: false }).insertContentAt({ from: at.from, to: at.to }, [{ type: "sceneRef", attrs: { index: r.index, raw: `图${r.index}` } }, { type: "text", text: " " }]).run();
    setMention(undefined);
  }, [editor]);
  mentionNow.current = { mention, active, pick };
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
    <div className={`scene-prompt-field${lead ? " has-lead" : ""}`}>
      {lead && <span className="scene-prompt-skill"><ImageIcon size={14} strokeWidth={1.6}/>技能：{lead}</span>}
      {!value && placeholder && <span className="scene-prompt-placeholder" aria-hidden="true">
        {lead && <i className="scene-prompt-skill is-ghost"><ImageIcon size={14} strokeWidth={1.6}/>技能：{lead}</i>}{placeholder}</span>}
      <EditorContent editor={editor}/>
    </div>
    {mention && typeof document !== "undefined" && createPortal(<MentionMenu mention={mention} refs={refs.filter(r => matchesMention(r, mention.query))} empty={!refs.length} active={active} onHover={setActive} onPick={pick}/>, document.body)}
    {preview?.url && <ImageLightbox src={preview.url} alt={preview.title} open onClose={close}/>}
  </RefsContext.Provider>;
}

/** @ 菜单：已经放好的素材。没放素材时说一句怎么才会有，别什么都不出现。 */
function MentionMenu({ mention, refs, empty, active, onHover, onPick }: { mention: Mention; refs: ScenePromptRef[]; empty: boolean; active: number; onHover: (i: number) => void; onPick: (r: ScenePromptRef) => void }) {
  const box = useRef<HTMLDivElement>(null);
  // 贴着 @ 弹，但不能出屏幕：右边放不下往左收，下面放不下翻到 @ 上面（手机上 @ 常在右边，2026-11-05 实测被裁掉一半）。
  const [place, setPlace] = useState<{ left: number; top: number }>({ left: mention.x, top: mention.bottom + 6 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(gap, Math.min(mention.x, window.innerWidth - width - gap));
    const below = mention.bottom + 6;
    const top = below + height + gap <= window.innerHeight ? below : Math.max(gap, mention.top - height - 6);
    setPlace(old => old.left === left && old.top === top ? old : { left, top });
  }, [mention.x, mention.top, mention.bottom, refs.length, empty]);
  if (!empty && !refs.length) return null;
  const at = Math.min(active, refs.length - 1);
  return <div ref={box} className="scene-mention-menu" role="listbox" aria-label="选择素材" style={place} onMouseDown={e => e.preventDefault()}>
    {empty ? <p>先放素材，就能在这里选</p> : refs.map((r, i) => <button key={r.index} type="button" role="option" aria-selected={i === at} className={i === at ? "is-active" : undefined} onMouseEnter={() => onHover(i)} onClick={() => onPick(r)}>
      {r.url || r.storageKey ? <SignedImage src={r.url} storageKey={r.storageKey} alt="" draggable={false}/> : <i/>}
      <span><strong>图{r.index}</strong><small>{r.title}</small>{r.detail && <em>{r.detail}</em>}</span>
    </button>)}
  </div>;
}
