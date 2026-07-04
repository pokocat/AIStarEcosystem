"use client";

// 行内可编辑文本 — 设计真源：screens-script.jsx `Editable`。
// 行为：失焦提交（避免光标抖动）；非 block 模式回车提交。
// v0.98：全站可编辑文本统一 hover 反馈——鼠标移上去出现浅底+描边+铅笔 icon，提示「可编辑」。
import * as React from "react";
import { Pencil } from "lucide-react";

interface EditableProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  /** 块级模式不响应回车提交（允许换行） */
  block?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function Editable({ value, onCommit, placeholder, block, style, className }: EditableProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  // 受控同步：当外部 value 变化但元素未聚焦时，刷新内容
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== value) el.innerText = value;
  }, [value]);

  const active = hover || focused;
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: block ? "block" : "inline-block", verticalAlign: block ? undefined : "top" }}
    >
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={className}
        data-ph={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onCommit(e.currentTarget.innerText.trim());
        }}
        onKeyDown={(e) => {
          if (!block && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        style={{
          outline: "none",
          borderRadius: 6,
          padding: "1px 5px",
          margin: "-1px -5px",
          cursor: "text",
          display: block ? "block" : "inline-block",
          minWidth: 18,
          transition: "background .12s, box-shadow .12s",
          background: focused ? "var(--accent-soft)" : hover ? "var(--surface-2)" : "transparent",
          boxShadow: focused ? "inset 0 0 0 1.5px var(--accent)" : hover ? "inset 0 0 0 1px var(--line)" : "none",
          ...style,
        }}
      >
        {value}
      </span>
      {/* hover/focus 时右侧铅笔提示「可编辑」（不参与编辑内容，pointerEvents:none） */}
      {active && (
        <Pencil
          size={11}
          style={{
            position: "absolute",
            right: 3,
            top: block ? 5 : "50%",
            transform: block ? undefined : "translateY(-50%)",
            color: "var(--accent)",
            opacity: 0.7,
            pointerEvents: "none",
          }}
        />
      )}
    </span>
  );
}
