"use client";

// 片段文本编辑器（v0.198，plan §2.6）：编辑时引用是「头像 + 名字」的标签（contenteditable=false，退格整块删），
// 内部仍存 `@[名字](look:id)`；敲 @ 弹出素材浮层（上下键 + 回车）；「完成」后显示排版好的只读样子
// （每行「（N 秒）」加粗）。引用的 id 在文档里找不到时标签标红。
//
// 编辑框的 DOM 由这里命令式地画（segment-text.ts 的 renderEditor），React 不碰它的子节点：
//   · 用户打字 → 读回文本（serializeEditor）→ onChange；形状不规范了（浏览器塞了块元素、手打了一个标记）才重画并还原光标；
//   · 回车、粘贴、剪切、退格删标签、插入引用 → 先算出新文本再重画（不靠浏览器各自的实现）；
//   · 输入法组字期间一律不动 DOM（中文输入法组字时重画会把字吞掉）。
// 父组件按片段 id 给它 key：换片段 = 换一个编辑器实例。
import * as React from "react";
import { parseShots, type SegmentRef } from "@/canvas/core";
import { CanvasImage } from "@/canvas/shell";
import type { EpisodeAssetItem } from "./derive";
import { RefPicker, isComposingKey, pickerItems } from "./ref-picker";
import {
  atQueryBefore,
  getSelectionOffsets,
  insertRefText,
  needsNormalize,
  removeRefAt,
  renderEditor,
  serializeEditor,
  setCaretOffset,
  spliceText,
  tokenizeSegment,
  type ChipView,
  type TextEdit,
} from "./segment-text";

export interface SegmentTextEditorHandle {
  /** 在光标处（没有光标时在末尾）插入一个引用。不在编辑状态时也能调（父组件同时切到编辑）。 */
  insertRef: (item: Pick<EpisodeAssetItem, "kind" | "id" | "label">) => void;
  /** 「@ 引用」按钮：打开带搜索框的浮层。 */
  openPicker: (anchorEl?: HTMLElement | null) => void;
  focus: () => void;
}

export interface SegmentTextEditorProps {
  value: string;
  editing: boolean;
  readOnly?: boolean;
  placeholder: string;
  ariaLabel: string;
  /** 引用标签怎么显示（名字 / 头像 / 找不到）。 */
  view: (ref: SegmentRef) => ChipView;
  /** view 的结果变了（造型改名、被删、换了图）时换一个值，编辑框据此重画标签。 */
  viewKey: string;
  /** @ 浮层里列的东西。 */
  items: EpisodeAssetItem[];
  onChange: (text: string) => void;
  /** 只读排版上点一下 → 进入编辑。 */
  onRequestEdit?: () => void;
  /** 头像图过期时换新地址。 */
  resign?: (key: string) => Promise<string | undefined>;
}

interface PickerState {
  mode: "inline" | "button";
  /** inline：@ 在文本里的位置。 */
  start: number;
  query: string;
  active: number;
  anchor: { left: number; top: number };
}

function caretRect(root: HTMLElement): { left: number; top: number } {
  const sel = root.ownerDocument.getSelection?.();
  let rect: DOMRect | undefined;
  if (sel && sel.rangeCount) {
    const r = sel.getRangeAt(0);
    rect = typeof r.getBoundingClientRect === "function" ? r.getBoundingClientRect() : undefined;
  }
  if (!rect || (rect.left === 0 && rect.top === 0 && rect.height === 0)) rect = root.getBoundingClientRect();
  return { left: rect.left, top: rect.bottom + 6 };
}

/** 只读排版里的一个引用标签（React 画，头像用 CanvasImage）。 */
export function RefChip({ view }: { view: ChipView }) {
  return (
    <span className={view.missing ? "cve-chip cve-chip-missing" : "cve-chip"} title={view.title} data-missing={view.missing || undefined}>
      <span className="cve-chip-av" aria-hidden>
        {view.image && !view.missing ? (
          <CanvasImage
            asset={view.image}
            alt=""
            className="cve-av-img"
            placeholder={<span className="cve-chip-av-letter">{Array.from(view.label)[0] ?? "@"}</span>}
          />
        ) : (
          <span className="cve-chip-av-letter">{Array.from(view.label)[0] ?? "@"}</span>
        )}
      </span>
      <span className="cve-chip-name">{view.label}</span>
    </span>
  );
}

/** 一段带引用的文字（只读）。 */
export function InlineRefs({ text, view }: { text: string; view: (ref: SegmentRef) => ChipView }) {
  return (
    <>
      {tokenizeSegment(text).map((t, i) => (t.type === "text" ? <React.Fragment key={i}>{t.text}</React.Fragment> : <RefChip key={i} view={view(t.ref)} />))}
    </>
  );
}

/** 「完成」之后的样子：每个镜头一段，行首「（N 秒）」加粗。 */
export function SegmentTextView({ text, view }: { text: string; view: (ref: SegmentRef) => ChipView }) {
  const shots = parseShots(text);
  return (
    <>
      {shots.map((s, i) => (
        <p key={i} className="cve-shot">
          {s.durationSec != null && <b className="cve-shot-dur">（{s.durationSec} 秒）</b>}
          <InlineRefs text={s.text} view={view} />
        </p>
      ))}
    </>
  );
}

export const SegmentTextEditor = React.forwardRef<SegmentTextEditorHandle, SegmentTextEditorProps>(function SegmentTextEditor(
  { value, editing, readOnly, placeholder, ariaLabel, view, viewKey, items, onChange, onRequestEdit, resign },
  ref,
) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  /** 编辑框里现在画着的是哪一版（文本 + 标签样子）；和 props 对不上才重画。 */
  const rendered = React.useRef<{ text: string; viewKey: string } | null>(null);
  /** 重画后要放光标的位置（程序改的文本）。 */
  const pendingCaret = React.useRef<number | null>(null);
  const composing = React.useRef(false);
  /** 最近一次光标 / 选区在编辑框里的位置（点左栏素材、点「@ 引用」时插在这儿）。 */
  const lastSel = React.useRef<{ start: number; end: number } | null>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const [, setTick] = React.useState(0);
  const [picker, setPicker] = React.useState<PickerState | null>(null);
  const pickerRef = React.useRef(picker);
  pickerRef.current = picker;

  const live = editing && !readOnly;

  // ── 画编辑框 ──────────────────────────────────────────────────────────────
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!live || !root) {
      rendered.current = null;
      return;
    }
    // 输入法组字中不动 DOM（重画会把正在组的字吞掉）；组完字 afterInput 会再对一次
    if (composing.current) return;
    const cur = rendered.current;
    const stale = !cur || cur.text !== value || cur.viewKey !== viewKey;
    if (!stale && pendingCaret.current == null) return;
    const focused = root.ownerDocument.activeElement === root;
    const keep = pendingCaret.current ?? (focused ? (getSelectionOffsets(root)?.start ?? null) : null);
    if (stale) {
      renderEditor(root, value, viewRef.current, { resign });
      rendered.current = { text: value, viewKey };
    }
    if (pendingCaret.current != null) {
      root.focus();
      setCaretOffset(root, Math.min(pendingCaret.current, value.length));
      lastSel.current = { start: pendingCaret.current, end: pendingCaret.current };
      pendingCaret.current = null;
    } else if (keep != null) {
      setCaretOffset(root, Math.min(keep, value.length));
    }
  });

  // 记住光标位置
  React.useEffect(() => {
    if (!live) return;
    const onSel = () => {
      const root = rootRef.current;
      if (!root) return;
      const s = getSelectionOffsets(root);
      if (s) lastSel.current = s;
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [live]);

  // 退出编辑时收起浮层
  React.useEffect(() => {
    if (!live) setPicker(null);
  }, [live]);

  /** 程序改的文本：记下光标，重画。 */
  const applyEdit = React.useCallback(
    (edit: TextEdit) => {
      pendingCaret.current = edit.caret;
      rendered.current = null;
      if (edit.text !== valueRef.current) onChange(edit.text);
      setTick((t) => t + 1);
    },
    [onChange],
  );

  const closePicker = React.useCallback(() => setPicker(null), []);

  const pick = React.useCallback(
    (item: Pick<EpisodeAssetItem, "kind" | "id" | "label">) => {
      const p = pickerRef.current;
      const root = rootRef.current;
      const text = root && live ? serializeEditor(root) : valueRef.current;
      if (p?.mode === "inline" && root) {
        const caret = getSelectionOffsets(root)?.start ?? p.start + 1 + p.query.length;
        applyEdit(insertRefText(text, p.start, Math.max(p.start, caret), item));
      } else {
        const s = lastSel.current ?? { start: text.length, end: text.length };
        applyEdit(insertRefText(text, s.start, s.end, item));
      }
      setPicker(null);
    },
    [applyEdit, live],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      insertRef: (item) => {
        const text = valueRef.current;
        const s = lastSel.current ?? { start: text.length, end: text.length };
        applyEdit(insertRefText(text, s.start, s.end, item));
      },
      openPicker: (anchorEl) => {
        const r = (anchorEl ?? rootRef.current)?.getBoundingClientRect();
        setPicker({
          mode: "button",
          start: -1,
          query: "",
          active: 0,
          anchor: r ? { left: r.left, top: r.bottom + 6 } : { left: 16, top: 120 },
        });
      },
      focus: () => rootRef.current?.focus(),
    }),
    [applyEdit],
  );

  // ── 输入 ──────────────────────────────────────────────────────────────────
  const afterInput = (data: string | null) => {
    const root = rootRef.current;
    if (!root) return;
    const text = serializeEditor(root);
    const sel = getSelectionOffsets(root);
    const caret = sel?.start ?? text.length;
    if (needsNormalize(root)) {
      applyEdit({ text, caret });
    } else {
      // 标签样子沿用编辑框里现在画着的那一版：期间 viewKey 变过（如组字时造型换了图）的话，下一次渲染会重画标签
      rendered.current = { text, viewKey: rendered.current?.viewKey ?? viewKey };
      if (text !== valueRef.current) onChange(text);
      else setTick((t) => t + 1);
    }
    // @ 浮层
    const q = atQueryBefore(text, caret);
    const p = pickerRef.current;
    if (p?.mode === "inline") {
      if (!q || q.start !== p.start) setPicker(null);
      else if (q.query !== p.query) setPicker({ ...p, query: q.query, active: 0 });
    } else if (q && q.query === "" && (data === "@" || data === "＠" || (data ?? "").endsWith("@") || (data ?? "").endsWith("＠"))) {
      setPicker({ mode: "inline", start: q.start, query: "", active: 0, anchor: caretRect(root) });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    // 输入法组字中：方向键 / 回车 / Esc 都是给输入法选字用的，引用浮层和编辑框一律不接
    if (isComposingKey(e, composing.current)) return;
    const p = pickerRef.current;
    if (p?.mode === "inline") {
      const list = pickerItems(items, p.query);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = list.length;
        if (n) setPicker({ ...p, active: e.key === "ArrowDown" ? (p.active + 1) % n : (p.active - 1 + n) % n });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && list.length) {
        e.preventDefault();
        pick(list[Math.min(p.active, list.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPicker(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const text = serializeEditor(root);
      const s = getSelectionOffsets(root) ?? { start: text.length, end: text.length };
      applyEdit(spliceText(text, s.start, s.end, "\n"));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      const text = serializeEditor(root);
      const s = getSelectionOffsets(root);
      if (!s || s.start !== s.end) return;
      const edit = removeRefAt(text, s.start, e.key === "Backspace" ? "backward" : "forward");
      if (edit) {
        e.preventDefault();
        applyEdit(edit);
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (!pasted) return;
    const text = serializeEditor(root);
    const s = getSelectionOffsets(root) ?? { start: text.length, end: text.length };
    applyEdit(spliceText(text, s.start, s.end, pasted));
  };

  /** 复制 / 剪切带上原始标记：贴回来还是标签。 */
  const onCopyCut = (e: React.ClipboardEvent<HTMLDivElement>, cut: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const text = serializeEditor(root);
    const s = getSelectionOffsets(root);
    if (!s || s.start === s.end) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", text.slice(s.start, s.end));
    if (cut) applyEdit(spliceText(text, s.start, s.end, ""));
  };

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  if (!live) {
    const empty = !value.trim();
    return (
      <div
        className={`cve-text cve-text-view${empty ? " is-empty" : ""}${readOnly ? " is-readonly" : ""}`}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        aria-label={readOnly ? undefined : `${ariaLabel}（点一下编辑）`}
        onClick={() => !readOnly && onRequestEdit?.()}
        onKeyDown={(e) => {
          if (!readOnly && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onRequestEdit?.();
          }
        }}
        data-testid="cve-text-view"
      >
        {empty ? <span className="cve-text-ph">{placeholder}</span> : <SegmentTextView text={value} view={view} />}
      </div>
    );
  }

  return (
    <>
      <div
        ref={rootRef}
        className="cve-text cve-text-edit"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-ph={placeholder}
        spellCheck={false}
        onInput={(e) => {
          const ne = e.nativeEvent as InputEvent;
          if (composing.current || ne.isComposing) return;
          afterInput(ne.data ?? null);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          afterInput(e.data ?? null);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCopy={(e) => onCopyCut(e, false)}
        onCut={(e) => onCopyCut(e, true)}
        onDrop={(e) => e.preventDefault()}
        onBlur={() => {
          if (pickerRef.current?.mode === "inline") setPicker(null);
        }}
        data-testid="cve-text-edit"
      />
      {picker && (
        <RefPicker
          mode={picker.mode}
          items={items}
          query={picker.query}
          onQuery={(q) => setPicker((p) => (p ? { ...p, query: q } : p))}
          active={picker.active}
          onActive={(i) => setPicker((p) => (p ? { ...p, active: i } : p))}
          onPick={pick}
          onClose={closePicker}
          anchor={picker.anchor}
        />
      )}
    </>
  );
});
