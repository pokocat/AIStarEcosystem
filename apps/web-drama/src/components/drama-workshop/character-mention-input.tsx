"use client";

// 画面内容 @提及输入（v0.98）——分镜表「画面内容」格的富文本输入：输入 @ 弹本集角色列表，
// 选中即成内联 chip（如 @苏娜）。内联的 chip 就是本镜「出场人物」（写入 shot.cast），
// 出首帧时把这些角色的参考图喂进去锁脸，保障跨镜人物一致（借鉴 ViMax 的角色参考复用）。
//
// 存储：shot.visual 存渲染文本（chip 序列化为「@名字」，可读且可回读重建）；shot.cast 存角色 id 列表（真值）。
import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";

export interface MentionChar { id: string; name: string }

export interface CharacterMentionInputProps {
  /** 已存的画面文本（可含「@名字」，会回读重建为 chip）。 */
  value: string;
  /** 本集角色（@ 菜单来源）。 */
  characters: MentionChar[];
  /** 文本或出场人物变化：visual=渲染文本，cast=内联提及到的角色 id 列表。 */
  onChange: (visual: string, cast: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** 把已存文本按已知角色名解析为 TipTap 文档（「@名字」→ mention 节点，其余为纯文本）。 */
function buildContent(value: string, chars: MentionChar[]) {
  const text = value || "";
  const names = [...chars].filter((c) => c.name).sort((a, b) => b.name.length - a.name.length);
  const nodes: Array<Record<string, unknown>> = [];
  let buf = "";
  const flush = () => { if (buf) { nodes.push({ type: "text", text: buf }); buf = ""; } };
  let i = 0;
  while (i < text.length) {
    if (text[i] === "@") {
      const rest = text.slice(i + 1);
      const hit = names.find((c) => rest.startsWith(c.name));
      if (hit) { flush(); nodes.push({ type: "mention", attrs: { id: hit.id, label: hit.name } }); i += 1 + hit.name.length; continue; }
    }
    buf += text[i];
    i += 1;
  }
  flush();
  return { type: "doc", content: [nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" }] };
}

/** 遍历文档取所有 mention 的角色 id（去重、保序）。 */
function extractCast(editor: { state: { doc: { descendants: (cb: (n: { type: { name: string }; attrs: Record<string, unknown> }) => void) => void } } }): string[] {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention") {
      const id = node.attrs.id as string | undefined;
      if (id && !ids.includes(id)) ids.push(id);
    }
  });
  return ids;
}

export function CharacterMentionInput({ value, characters, onChange, placeholder = "画面内容（输入 @ 提及人物）…", disabled }: CharacterMentionInputProps) {
  const charsRef = React.useRef(characters);
  charsRef.current = characters;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: buildContent(value, characters),
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false, horizontalRule: false }),
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: "char-mention-chip" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: {
          char: "@",
          items: ({ query }) =>
            charsRef.current.filter((c) => c.name && c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
          render: () => {
            let el: HTMLDivElement | null = null;
            let items: MentionChar[] = [];
            let selected = 0;
            let command: ((attrs: { id: string; label: string }) => void) | null = null;
            const position = (rect: DOMRect | null) => {
              if (!el || !rect) return;
              el.style.left = `${rect.left + window.scrollX}px`;
              el.style.top = `${rect.bottom + window.scrollY + 4}px`;
            };
            const pick = (idx: number) => {
              const it = items[idx];
              if (it && command) command({ id: it.id, label: it.name });
            };
            const paint = () => {
              if (!el) return;
              el.innerHTML = "";
              if (!items.length) {
                const d = document.createElement("div");
                d.textContent = "无匹配角色（去「角色与场景」添加）";
                d.style.cssText = "padding:6px 8px;color:var(--ink-3);font-size:12px";
                el.appendChild(d);
                return;
              }
              items.forEach((it, idx) => {
                const b = document.createElement("button");
                b.type = "button";
                b.textContent = `@${it.name}`;
                b.style.cssText = `display:block;width:100%;text-align:left;border:none;background:${idx === selected ? "var(--accent-soft)" : "transparent"};color:var(--ink-1);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:600`;
                b.onmousedown = (e) => { e.preventDefault(); pick(idx); };
                el!.appendChild(b);
              });
            };
            const destroy = () => { if (el) { el.remove(); el = null; } };
            return {
              onStart: (props: { command: (attrs: { id: string; label: string }) => void; items: MentionChar[]; clientRect?: (() => DOMRect | null) | null }) => {
                command = props.command;
                items = props.items;
                selected = 0;
                el = document.createElement("div");
                el.style.cssText = "position:absolute;z-index:9999;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow-lg);padding:4px;min-width:150px;max-height:220px;overflow:auto";
                document.body.appendChild(el);
                position(props.clientRect?.() ?? null);
                paint();
              },
              onUpdate: (props: { command: (attrs: { id: string; label: string }) => void; items: MentionChar[]; clientRect?: (() => DOMRect | null) | null }) => {
                command = props.command;
                items = props.items;
                selected = 0;
                position(props.clientRect?.() ?? null);
                paint();
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                if (!items.length && props.event.key !== "Escape") return false;
                if (props.event.key === "ArrowDown") { selected = (selected + 1) % items.length; paint(); return true; }
                if (props.event.key === "ArrowUp") { selected = (selected - 1 + items.length) % items.length; paint(); return true; }
                if (props.event.key === "Enter") { pick(selected); return true; }
                if (props.event.key === "Escape") { destroy(); return true; }
                return false;
              },
              onExit: () => destroy(),
            };
          },
        },
      }),
    ],
    editorProps: { attributes: { class: "char-mention-input" } },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getText(), extractCast(editor)),
  });

  // 外部 value 变化（如 AI 改写整镜）且非编辑中 → 重建内容；正常输入时 value===getText 不触发。
  React.useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getText()) {
      editor.commands.setContent(buildContent(value, charsRef.current));
    }
  }, [value, editor]);
  React.useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  return (
    <>
      <style>{`.char-mention-chip{background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:1px 7px;font-weight:700;white-space:nowrap}.char-mention-input{outline:none;font-size:13px;line-height:1.6;min-height:40px}.char-mention-input p{margin:0}.char-mention-input p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:var(--ink-3);float:left;height:0;pointer-events:none}`}</style>
      <EditorContent editor={editor} />
    </>
  );
}
