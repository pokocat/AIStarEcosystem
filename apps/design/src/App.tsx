import { ThemeProvider, useTheme } from "./theme/ThemeProvider";
import { AppShell } from "./layouts/AppShell";
import { PersonasOverview } from "./pages/PersonasOverview";

export default function App() {
  return (
    <ThemeProvider initial="tech">
      <AppShell>
        <PersonasOverview />
      </AppShell>
      <ThemeSwitcher />
    </ThemeProvider>
  );
}

/** Floating debug control — remove in production. */
function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const themes = ["tech", "creator", "premium"] as const;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        zIndex: 1000,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      {themes.map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          style={{
            padding: "6px 10px",
            background: theme === t ? "var(--accent)" : "transparent",
            color: theme === t ? "#fff" : "var(--fg-1)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
