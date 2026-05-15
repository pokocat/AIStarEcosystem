import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeName = "tech" | "creator" | "premium";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initial = "tech",
  children,
}: {
  initial?: ThemeName;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<ThemeName>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
