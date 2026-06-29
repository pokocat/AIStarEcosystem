"use client";

// 轻量 Markdown 渲染（v0.95）—— 给 AI 对话气泡用，支持模型常用的少量语法：
//   **加粗** / 有序列表 `1.` / 无序列表 `-`·`*`·`·` / 段落换行。
// 不引第三方库、不走 dangerouslySetInnerHTML —— 全部用 React 元素渲染，文本天然转义，无注入风险。
import * as React from "react";

/** 行内解析：仅处理 **加粗**，其余原样（单个 * 视作普通字符，避免误伤）。 */
function parseInline(s: string): React.ReactNode[] {
  const parts = s.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((p, i) => {
    const m = /^\*\*([^*\n]+)\*\*$/.exec(p);
    if (m) return <strong key={i} style={{ fontWeight: 700 }}>{m[1]}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

const ORDERED = /^(\d{1,2})[.、)]\s+(.*)$/;
const BULLET = /^[-*·•]\s+(.*)$/;

export function MarkdownLite({ text, style }: { text: string; style?: React.CSSProperties }) {
  const lines = (text ?? "").split(/\r?\n/);
  return (
    <div style={style}>
      {lines.map((line, i) => {
        const t = line.trimEnd();
        if (!t.trim()) return <div key={i} style={{ height: 6 }} />;

        const om = ORDERED.exec(t);
        if (om) {
          return (
            <div key={i} className="row" style={{ alignItems: "baseline", gap: 7, margin: "2px 0" }}>
              <span style={{ flex: "none", fontWeight: 700, color: "var(--accent)", minWidth: 16 }}>{om[1]}.</span>
              <span style={{ flex: 1, minWidth: 0 }}>{parseInline(om[2])}</span>
            </div>
          );
        }
        const bm = BULLET.exec(t);
        if (bm) {
          return (
            <div key={i} className="row" style={{ alignItems: "baseline", gap: 7, margin: "2px 0" }}>
              <span style={{ flex: "none", color: "var(--accent)" }}>·</span>
              <span style={{ flex: 1, minWidth: 0 }}>{parseInline(bm[1])}</span>
            </div>
          );
        }
        return <div key={i} style={{ margin: "1px 0" }}>{parseInline(t)}</div>;
      })}
    </div>
  );
}
