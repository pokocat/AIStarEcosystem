import { ReactNode } from "react";
import { Sidebar, NavGroup } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { Button } from "../components/Button";

const groups: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { icon: "◐", label: "Overview" },
      { icon: "♪", label: "AI Musician", selected: true },
      { icon: "▷", label: "AI Short Drama" },
      { icon: "☆", label: "Celebrity Commerce" },
    ],
  },
  {
    title: "Musician",
    items: [
      { icon: "◇", label: "Personas", selected: true },
      { icon: "🎤", label: "Voice models" },
      { icon: "⌬", label: "Distribution" },
      { icon: "$", label: "Revenue" },
      { icon: "⚖", label: "Rights & licenses" },
    ],
  },
  {
    title: "System",
    items: [
      { icon: "☷", label: "GPU clusters" },
      { icon: "⎈", label: "Settings" },
      { icon: "?", label: "Docs" },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        height: "100vh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Sidebar
        brand={{ initials: "iP", name: "AI IP Platform", meta: "v4.2.1 · stable" }}
        groups={groups}
        footer={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: "var(--bg-3)",
                border: "1px solid var(--line-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              HK
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Hideo Kuroda</div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                SoundForge MCN
              </div>
            </div>
          </div>
        }
      />
      <main style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          crumbs={["AI Musician", "Personas"]}
          searchPlaceholder="Search persona, ID, channel…"
          rightSlot={
            <>
              <Button variant="secondary" size="sm">Export</Button>
              <Button variant="primary" size="sm">+ New persona</Button>
            </>
          }
        />
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
