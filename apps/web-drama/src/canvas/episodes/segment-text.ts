// ─────────────────────────────────────────────────────────────────────────────
// canvas/episodes/segment-text.ts —— 片段文本编辑器的底层：纯文本操作 + contentEditable 的序列化 / 反序列化（v0.198）。
//
// 真值永远是片段文本本身（`@[名字](look:id)` 的写法见 drama-canvas.ts CanvasSegment 注释，解析走 `@/canvas/core` 的 refs）。
// 编辑时把引用显示成「头像 + 名字」的标签（contenteditable=false 的 span，整块删、不能改一半），
// 标签上用 data-cve-ref 存原始标记；读回时按 DOM 顺序拼回去，所以往返不丢字：
//   · 文字节点原样（换行就是 "\n"，编辑框 white-space: pre-wrap）；
//   · 标签 → 它存的原始标记；
//   · 结尾是换行时补一个不计入文本的 <br data-cve-filler>（否则最后那一空行放不进光标）；
//   · 浏览器自己塞进来的 <div> / <p> / <br>（拖放、输入法、自动更正）也认得，读回后由编辑器重画成规范形状。
// 不合法的标记（种类不对、id 带了别的字符……）不是引用，按普通文字原样保留。
// ─────────────────────────────────────────────────────────────────────────────

import { formatRef, parseRefs, type SegmentRef } from "@/canvas/core";

// ── 纯文本 ───────────────────────────────────────────────────────────────────

export type SegmentToken = { type: "text"; text: string } | { type: "ref"; ref: SegmentRef; raw: string };

/** 拆成「文字 / 引用」段（引用按 core 的正则认，其余都是文字）。 */
export function tokenizeSegment(text: string): SegmentToken[] {
  const out: SegmentToken[] = [];
  if (!text) return out;
  let at = 0;
  for (const ref of parseRefs(text)) {
    if (ref.start > at) out.push({ type: "text", text: text.slice(at, ref.start) });
    out.push({ type: "ref", ref, raw: text.slice(ref.start, ref.end) });
    at = ref.end;
  }
  if (at < text.length) out.push({ type: "text", text: text.slice(at) });
  return out;
}

export function joinTokens(tokens: SegmentToken[]): string {
  return tokens.map((t) => (t.type === "text" ? t.text : t.raw)).join("");
}

export interface TextEdit {
  text: string;
  caret: number;
}

/** 把 [start, end) 换成 insert。 */
export function spliceText(text: string, start: number, end: number, insert: string): TextEdit {
  const a = Math.max(0, Math.min(text.length, Math.min(start, end)));
  const b = Math.max(a, Math.min(text.length, Math.max(start, end)));
  return { text: text.slice(0, a) + insert + text.slice(b), caret: a + insert.length };
}

/** 光标 / 选区落在一个引用标记中间时，挪到标记外面（标签不能改一半）。 */
export function snapOutOfRefs(text: string, offset: number, prefer: "start" | "end" = "end"): number {
  for (const r of parseRefs(text)) {
    if (offset > r.start && offset < r.end) return prefer === "start" ? r.start : r.end;
  }
  return offset;
}

/** 在 [start, end) 处插入一个引用。 */
export function insertRefText(
  text: string,
  start: number,
  end: number,
  item: { kind: SegmentRef["kind"]; id: string; label: string },
): TextEdit {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  // 光标（没有选区）落在标记中间：挪到标记后面，别把它拆开；有选区：把沾到一半的标记整个算进选区
  const a = lo === hi ? snapOutOfRefs(text, lo, "end") : snapOutOfRefs(text, lo, "start");
  const b = lo === hi ? a : snapOutOfRefs(text, hi, "end");
  return spliceText(text, a, b, formatRef(item.kind, item.id, item.label));
}

/** 退格 / 删除紧挨着光标的那个引用（整块删）。光标旁边不是引用时回 null（交给浏览器照常删字）。 */
export function removeRefAt(text: string, caret: number, direction: "backward" | "forward"): TextEdit | null {
  for (const r of parseRefs(text)) {
    const hit = direction === "backward" ? r.end === caret : r.start === caret;
    if (hit) return { text: text.slice(0, r.start) + text.slice(r.end), caret: r.start };
  }
  return null;
}

/** @ 后面最多跟几个字还算在查找引用。 */
export const AT_QUERY_MAX = 20;

/**
 * 光标前面是不是一个正在输入的「@查找词」：从光标往回找最近的 @ / ＠，中间不能有空白、换行、括号，
 * 也不能是某个引用标记自己的 @。是的话回 { start: @ 的位置, query }。
 */
export function atQueryBefore(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, Math.min(text.length, caret)));
  const idx = Math.max(before.lastIndexOf("@"), before.lastIndexOf("＠"));
  if (idx < 0) return null;
  const query = before.slice(idx + 1);
  if (query.length > AT_QUERY_MAX || /[\s[\]()（）@＠]/.test(query)) return null;
  if (parseRefs(text).some((r) => idx >= r.start && idx < r.end)) return null;
  return { start: idx, query };
}

// ── DOM：序列化 / 反序列化 ───────────────────────────────────────────────────

export const REF_ATTR = "data-cve-ref";
export const FILLER_ATTR = "data-cve-filler";

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE"]);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function isRefEl(n: Node | null | undefined): n is HTMLElement {
  return !!n && n.nodeType === ELEMENT_NODE && (n as Element).hasAttribute(REF_ATTR);
}

function isFiller(n: Node | null | undefined): boolean {
  return !!n && n.nodeType === ELEMENT_NODE && (n as Element).tagName === "BR" && (n as Element).hasAttribute(FILLER_ATTR);
}

/** 一个 <br> 后面还有没有有内容的兄弟（块尾 / 编辑框末尾的 <br> 只是占位，不算换行）。 */
function hasContentAfter(n: Node): boolean {
  let s = n.nextSibling;
  while (s) {
    if (s.nodeType !== TEXT_NODE || (s as Text).data.length > 0) return true;
    s = s.nextSibling;
  }
  return false;
}

/**
 * 读回文本按「行」来：块元素（浏览器塞进来的 <div> / <p>）各占一行，<br> 换行，文字节点里的 "\n" 原样保留。
 * 块尾 / 编辑框末尾的 <br> 是占位，不算换行；只有一个占位 <br> 的块是一个空行。
 */
interface SerializeState {
  lines: string[];
  /** 刚出了一个块：后面再有内容要另起一行。 */
  needBreak: boolean;
}

function pushContent(st: SerializeState, s: string) {
  if (!s) return;
  if (st.needBreak) {
    st.lines.push("");
    st.needBreak = false;
  }
  st.lines[st.lines.length - 1] += s;
}

function walkSerialize(node: Node, st: SerializeState): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === TEXT_NODE) {
      pushContent(st, (child as Text).data);
      return;
    }
    if (child.nodeType !== ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const raw = el.getAttribute(REF_ATTR);
    if (raw !== null) {
      pushContent(st, raw);
      return;
    }
    if (el.tagName === "BR") {
      if (el.hasAttribute(FILLER_ATTR) || !hasContentAfter(el)) return;
      if (st.needBreak) {
        st.lines.push("");
        st.needBreak = false;
      }
      st.lines.push("");
      return;
    }
    if (BLOCK_TAGS.has(el.tagName)) {
      if (st.needBreak || st.lines[st.lines.length - 1] !== "") st.lines.push("");
      st.needBreak = false;
      walkSerialize(el, st);
      st.needBreak = true;
      return;
    }
    walkSerialize(el, st);
  });
}

/** 编辑框（或其中一段，如 Range.cloneContents() 的片段）→ 片段文本。 */
export function serializeEditor(node: Node): string {
  const st: SerializeState = { lines: [""], needBreak: false };
  walkSerialize(node, st);
  return st.lines.join("\n");
}

export interface ChipView {
  label: string;
  missing: boolean;
  image?: { key: string; url?: string };
  /** hover 说明；缺省：找得到 = 名字，找不到 = 「这个造型被删了」之类。 */
  title?: string;
}

export interface RenderEditorOptions {
  /** 头像图加载失败时按 key 换新地址（签名 1 小时过期）；缺省不换，直接退回首字。 */
  resign?: (key: string) => Promise<string | undefined>;
}

function initialOf(label: string): string {
  return Array.from(label.trim())[0] ?? "@";
}

function setInitial(av: HTMLElement, label: string) {
  while (av.firstChild) av.removeChild(av.firstChild);
  av.textContent = initialOf(label);
  av.classList.add("cve-chip-av-letter");
}

function fillAvatar(av: HTMLElement, view: ChipView, opts: RenderEditorOptions | undefined) {
  const img = view.image;
  if (!img?.key || view.missing) {
    setInitial(av, view.label);
    return;
  }
  const doc = av.ownerDocument;
  const el = doc.createElement("img");
  el.alt = "";
  el.draggable = false;
  let retried = false;
  const fallback = () => setInitial(av, view.label);
  const retry = () => {
    if (retried || !opts?.resign) {
      fallback();
      return;
    }
    retried = true;
    void opts.resign(img.key).then((url) => {
      if (url && url !== el.getAttribute("src")) el.setAttribute("src", url);
      else fallback();
    }, fallback);
  };
  el.addEventListener("error", retry);
  av.appendChild(el);
  if (img.url) el.setAttribute("src", img.url);
  else retry(); // 有 key 没地址：直接去换一个
}

/** 造一个引用标签（编辑框里用；只读排版由 React 画）。 */
export function createChip(doc: Document, raw: string, ref: SegmentRef, view: ChipView, opts?: RenderEditorOptions): HTMLElement {
  const el = doc.createElement("span");
  el.className = view.missing ? "cve-chip cve-chip-missing" : "cve-chip";
  el.setAttribute("contenteditable", "false");
  el.setAttribute(REF_ATTR, raw);
  el.setAttribute("data-kind", ref.kind);
  el.setAttribute("data-id", ref.id);
  if (view.title) el.title = view.title;
  const av = doc.createElement("span");
  av.className = "cve-chip-av";
  av.setAttribute("aria-hidden", "true");
  fillAvatar(av, view, opts);
  const name = doc.createElement("span");
  name.className = "cve-chip-name";
  name.textContent = view.label;
  el.append(av, name);
  return el;
}

/** 片段文本 → 编辑框（清空重画成规范形状）。 */
export function renderEditor(root: HTMLElement, text: string, view: (ref: SegmentRef) => ChipView, opts?: RenderEditorOptions): void {
  const doc = root.ownerDocument;
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const t of tokenizeSegment(text)) {
    if (t.type === "text") root.appendChild(doc.createTextNode(t.text));
    else root.appendChild(createChip(doc, t.raw, t.ref, view(t.ref), opts));
  }
  if (text.endsWith("\n")) {
    const br = doc.createElement("br");
    br.setAttribute(FILLER_ATTR, "");
    root.appendChild(br);
  }
}

/**
 * 编辑框现在是不是规范形状（只有文字节点、标签、结尾那个占位 <br>）。不是 → 读回文本后重画一遍：
 * 浏览器塞进来的块元素、手打 / 粘贴出来的原始标记（该变成标签）、占位 <br> 丢了或多了。
 */
export function needsNormalize(root: HTMLElement): boolean {
  const kids = Array.from(root.childNodes);
  let chips = 0;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.nodeType === TEXT_NODE) continue;
    if (isRefEl(n)) {
      chips += 1;
      continue;
    }
    if (isFiller(n) && i === kids.length - 1) continue;
    return true;
  }
  const text = serializeEditor(root);
  if (parseRefs(text).length !== chips) return true;
  return text.endsWith("\n") !== isFiller(kids[kids.length - 1]);
}

// ── DOM：光标 ⇄ 文本位置 ─────────────────────────────────────────────────────

function offsetAt(root: HTMLElement, container: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  try {
    range.setEnd(container, offset);
  } catch {
    return serializeEditor(root).length;
  }
  return serializeEditor(range.cloneContents()).length;
}

/** 当前选区在片段文本里的位置；选区不在编辑框里回 null。 */
export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = root.ownerDocument.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const start = offsetAt(root, r.startContainer, r.startOffset);
  const end = r.collapsed ? start : offsetAt(root, r.endContainer, r.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** 把光标放到片段文本的第 offset 个字符处（编辑框须是 renderEditor 画出来的规范形状）。 */
export function setCaretOffset(root: HTMLElement, offset: number): void {
  const doc = root.ownerDocument;
  const sel = doc.getSelection?.();
  if (!sel) return;
  const range = doc.createRange();
  const kids = Array.from(root.childNodes);
  let acc = 0;
  let placed = false;
  for (let i = 0; i < kids.length && !placed; i++) {
    const n = kids[i];
    if (n.nodeType === TEXT_NODE) {
      const len = (n as Text).data.length;
      if (offset <= acc + len) {
        range.setStart(n, Math.max(0, offset - acc));
        placed = true;
      }
      acc += len;
      continue;
    }
    if (isRefEl(n)) {
      if (offset <= acc) {
        range.setStart(root, i);
        placed = true;
        break;
      }
      acc += (n.getAttribute(REF_ATTR) ?? "").length;
      if (offset < acc) {
        range.setStart(root, i + 1);
        placed = true;
      }
      continue;
    }
    if (isFiller(n)) {
      if (offset <= acc) {
        range.setStart(root, i);
        placed = true;
      }
      continue;
    }
    // 不规范的节点（正常不会出现）：按它读出来的长度算，光标放在它后面
    acc += serializeEditor(n).length;
    if (offset <= acc) {
      range.setStart(root, i + 1);
      placed = true;
    }
  }
  if (!placed) {
    const last = kids[kids.length - 1];
    range.setStart(root, isFiller(last) ? kids.length - 1 : kids.length);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
