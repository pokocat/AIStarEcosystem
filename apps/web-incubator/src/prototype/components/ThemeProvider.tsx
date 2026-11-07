/**
 * Colour mode for the whole system: dark (the AI 艺人孵化 homepage look, default) or light.
 * The mode is a class on <html> (`mode-dark` / `mode-light`, plus `dark` for shadcn tokens):
 * light-ui.css remaps the legacy dark-styled pages to light, dark-ui.css remaps the newer
 * light-styled pages to dark. Replaces the old multi-theme picker.
 */
import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ColorMode = 'dark' | 'light';

const KEY = 'ai_color_mode_v1';

export const readColorMode = (): ColorMode => {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};

/** Puts the mode on <html>. Also called before the first render to avoid a flash. */
export const applyColorMode = (mode: ColorMode) => {
  const root = document.documentElement;
  root.classList.toggle('mode-dark', mode === 'dark');
  root.classList.toggle('mode-light', mode === 'light');
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
};

interface ThemeContextType {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ColorMode>(readColorMode);
  useEffect(() => {
    applyColorMode(mode);
    try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  }, [mode]);
  const toggleMode = useCallback(() => setMode(m => (m === 'dark' ? 'light' : 'dark')), []);
  return <ThemeContext.Provider value={{ mode, setMode, toggleMode }}>{children}</ThemeContext.Provider>;
};

/** Sidebar classes shared by the consoles (written light; dark-ui.css maps them in dark mode). */
export const sidebarStyle = {
  bg: 'bg-white',
  itemBase: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  itemActive: 'console-nav-active font-semibold',
  sectionTitle: 'text-slate-400',
  border: 'border-slate-200',
  glow: 'shadow-none',
};
