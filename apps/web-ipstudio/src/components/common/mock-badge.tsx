"use client";

// 示例产物角标 —— mock 模式下的占位图 / 样例数据必须显式标注，
// 绝不与真产物混淆（AGENTS.md §8.0 降级产物打显式标记）。

export function MockBadge({ label = "示例" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase"
      style={{
        background: "var(--warn-soft)",
        color: "var(--warn)",
        border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
        fontFamily: "var(--font-mono)",
      }}
      title="当前是演示数据，不是真实生成结果"
    >
      {label}
    </span>
  );
}
