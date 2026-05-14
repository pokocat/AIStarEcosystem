import { ReactNode } from "react";

export interface NavItem {
  icon: string;
  label: string;
  href?: string;
  selected?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface Props {
  brand: {
    initials: string;
    name: string;
    meta?: string;
  };
  groups: NavGroup[];
  footer?: ReactNode;
}

export function Sidebar({ brand, groups, footer }: Props) {
  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        padding: "18px 0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "0 18px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 12,
            color: "#fff",
          }}
        >
          {brand.initials}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{brand.name}</div>
          {brand.meta && (
            <div
              style={{
                fontSize: 10,
                color: "var(--fg-2)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {brand.meta}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 10px", flex: 1, overflow: "auto" }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--fg-3)",
                letterSpacing: 1.5,
                padding: gi === 0 ? "8px 8px 6px" : "18px 8px 6px",
                textTransform: "uppercase",
              }}
            >
              {g.title}
            </div>
            {g.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 8px",
                  borderRadius: "var(--radius-md)",
                  background: it.selected ? "var(--bg-3)" : "transparent",
                  color: it.selected ? "var(--fg-0)" : "var(--fg-1)",
                  fontSize: 13,
                  cursor: "pointer",
                  marginBottom: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: it.selected ? "var(--accent)" : "var(--fg-2)",
                    width: 14,
                    fontSize: 12,
                  }}
                >
                  {it.icon}
                </span>
                <span style={{ fontWeight: it.selected ? 500 : 400 }}>
                  {it.label}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {footer && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
