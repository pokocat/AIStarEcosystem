import { ReactNode } from "react";

interface Props {
  crumbs?: string[];
  rightSlot?: ReactNode;
  searchPlaceholder?: string;
}

export function Topbar({
  crumbs = [],
  rightSlot,
  searchPlaceholder = "Search…",
}: Props) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-2)",
        }}
      >
        {crumbs.map((c, i) => (
          <span key={i}>
            {c}
            {i < crumbs.length - 1 && (
              <span style={{ color: "var(--fg-3)" }}> / </span>
            )}
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
          color: "var(--fg-2)",
          fontFamily: "var(--font-mono)",
          minWidth: 260,
        }}
      >
        <span>⌕</span>
        <span>{searchPlaceholder}</span>
        <span
          style={{
            marginLeft: "auto",
            padding: "1px 5px",
            border: "1px solid var(--line-2)",
            borderRadius: 2,
            fontSize: 10,
          }}
        >
          ⌘K
        </span>
      </div>
      {rightSlot}
    </header>
  );
}
