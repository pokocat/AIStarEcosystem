"use client";

// DramaComposer · 全站统一的「点子 / 提示词」富文本输入（v0.78，基于 TipTap）。
//
// 为什么是 TipTap 而不是 <textarea>：短剧/短视频的输入越来越「带引用」——
// 从创意市场套用一个创意、@一个素材、引一张参考图…… 这些引用需要以「chip」形态
// 进对话框，且未来要在所有输入处复用同一套体验。本组件先落地「引用 chip 托盘 + 富文本
// 正文」这一层（单个固定引用用托盘最稳妥），@内联提及作为后续扩展挂在同一 TipTap 实例上。
//
// 用法：父级提供卡片外壳 + 底部按钮，本组件只负责「引用托盘 + 可编辑正文」：
//   const ref = useRef<DramaComposerHandle>(null);
//   <DramaComposer ref={ref} placeholder="…" refs={refs} onRemoveRef={...}
//                  onChange={setText} onSubmit={start} />
//   ref.current?.setText("给我灵感来的示例")   // 程序化填充（不打断光标）
import * as React from "react";
import { X } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { ComposerRef } from "./composer-ref";
import { COMPOSER_REF_META } from "./composer-ref";

export type { ComposerRef } from "./composer-ref";

export interface DramaComposerHandle {
  focus: () => void;
  /** 程序化设置正文（给我灵感 / 回填用），把光标移到末尾。 */
  setText: (text: string) => void;
  getText: () => string;
  clear: () => void;
}

export interface DramaComposerProps {
  placeholder?: string;
  /** 初始正文（仅创建时注入一次，如 /shorts/new?idea= 带入；之后用户编辑不受控）。 */
  defaultText?: string;
  /** 正文变化（纯文本）。 */
  onChange?: (text: string) => void;
  /** 回车（非 Shift、非输入法合成中）提交。 */
  onSubmit?: () => void;
  /** 引用 chip 托盘（创意 / 模版 / 参考图 / 场景 / 角色…），渲染在正文上方。 */
  refs?: ComposerRef[];
  onRemoveRef?: (id: string) => void;
  /** 正文最小高度（px），默认 72。 */
  minHeight?: number;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** 纯文本 → TipTap 段落 HTML（保留换行为 <br>）。 */
function textToHtml(text: string): string {
  if (!text) return "<p></p>";
  return "<p>" + escapeHtml(text).replace(/\n/g, "<br>") + "</p>";
}

function RefChip({ r, onRemove }: { r: ComposerRef; onRemove?: () => void }) {
  const meta = COMPOSER_REF_META[r.kind];
  const Icon = meta.icon;
  return (
    <span
      className="row gap-2"
      style={{
        maxWidth: "100%",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        borderRadius: 999,
        padding: "5px 8px 5px 5px",
        flex: "none",
      }}
      title={r.sub ? `${r.label} · ${r.sub}` : r.label}
    >
      {r.from && r.to ? (
        <span
          style={{ width: 28, height: 19, borderRadius: 5, flex: "none", background: `linear-gradient(135deg, ${r.from}, ${r.to})` }}
        />
      ) : (
        <span
          className="row"
          style={{ width: 22, height: 22, borderRadius: 6, flex: "none", justifyContent: "center", background: "color-mix(in oklch, var(--accent) 18%, transparent)" }}
        >
          <Icon size={13} />
        </span>
      )}
      <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {meta.label}
        <span style={{ opacity: 0.62 }}> · {r.label}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          title={`移除${meta.label}`}
          aria-label={`移除${meta.label}`}
          onClick={onRemove}
          className="row"
          style={{ flex: "none", cursor: "pointer", color: "inherit", background: "transparent", border: "none", padding: 0 }}
        >
          <X size={13} />
        </button>
      )}
    </span>
  );
}

export const DramaComposer = React.forwardRef<DramaComposerHandle, DramaComposerProps>(function DramaComposer(
  { placeholder = "", defaultText = "", onChange, onSubmit, refs = [], onRemoveRef, minHeight = 72, autoFocus = false, className, style },
  ref,
) {
  // 用 ref 持有最新回调，避免重建 editor（TipTap 重建会丢光标/正文）。
  const onChangeRef = React.useRef(onChange);
  const onSubmitRef = React.useRef(onSubmit);
  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  const editor = useEditor({
    immediatelyRender: false, // Next 16 SSR：禁止首帧即渲染，避免 hydration 不一致
    content: textToHtml(defaultText), // 仅创建时注入一次（useEditor 默认 deps=[] 不重建）
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: { class: "drama-composer-input", "aria-label": placeholder || "输入框" },
      handleKeyDown(view, event) {
        // 回车提交；Shift+回车换行；输入法合成中（中文等）不拦截。
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !(view as { composing?: boolean }).composing) {
          event.preventDefault();
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      onChangeRef.current?.(editor.getText());
    },
  });

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.chain().focus("end").run(),
      setText: (text: string) => {
        if (!editor) return;
        editor.chain().setContent(textToHtml(text)).focus("end").run();
        onChangeRef.current?.(editor.getText());
      },
      getText: () => editor?.getText() ?? "",
      clear: () => {
        if (!editor) return;
        editor.chain().clearContent().focus().run();
        onChangeRef.current?.("");
      },
    }),
    [editor],
  );

  React.useEffect(() => {
    if (autoFocus && editor) editor.commands.focus("end");
  }, [autoFocus, editor]);

  return (
    <div className={`drama-composer col${className ? ` ${className}` : ""}`} style={{ ["--composer-min-h" as string]: `${minHeight}px`, ...style }}>
      {refs.length > 0 && (
        <div className="row gap-2" style={{ flexWrap: "wrap", padding: "12px 16px 0" }}>
          {refs.map((r) => (
            <RefChip key={r.id} r={r} onRemove={onRemoveRef ? () => onRemoveRef(r.id) : undefined} />
          ))}
        </div>
      )}
      <EditorContent editor={editor} style={{ padding: "14px 18px 4px" }} />
    </div>
  );
});
