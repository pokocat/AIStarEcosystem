"use client";

/** 名片状态徽标 —— 已发布 / 草稿。资产页与名片页共用。 */
export function StatusPill({ published }: { published: boolean }) {
  return (
    <span
      className="shrink-0 px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={published
        ? { background: "var(--ok-soft)", color: "var(--ok)" }
        : { background: "var(--surface-3)", color: "var(--ink-3)" }}
    >
      {published ? "已发布" : "草稿"}
    </span>
  );
}
