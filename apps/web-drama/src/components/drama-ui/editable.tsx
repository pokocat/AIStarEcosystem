"use client";

// 行内可编辑文本 — 设计真源：screens-script.jsx `Editable`。
// 行为：失焦提交（避免光标抖动）；非 block 模式回车提交。
import * as React from "react";

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
  // 受控同步：当外部 value 变化但元素未聚焦时，刷新内容
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== value) el.innerText = value;
  }, [value]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      data-ph={placeholder}
      onFocus={(e) => {
        e.currentTarget.style.background = "var(--accent-soft)";
        e.currentTarget.style.boxShadow = "inset 0 0 0 1.5px var(--accent)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.boxShadow = "none";
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
        display: "inline-block",
        minWidth: 18,
        transition: "background .12s",
        ...style,
      }}
    >
      {value}
    </span>
  );
}
