/**
 * 暗色 / 亮色 switch. `icon`: a top-bar button; `row`: a sidebar row; `segmented`: settings.
 */
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme, type ColorMode } from './ThemeProvider';

interface Props {
  lang: 'zh' | 'en';
  variant?: 'icon' | 'row' | 'segmented';
  className?: string;
}

const LABEL: Record<ColorMode, { zh: string; en: string }> = { dark: { zh: '暗色', en: 'Dark' }, light: { zh: '亮色', en: 'Light' } };

export const ColorModeToggle = ({ lang, variant = 'icon', className = '' }: Props) => {
  const { mode, setMode, toggleMode } = useTheme();
  const zh = lang === 'zh';
  const next: ColorMode = mode === 'dark' ? 'light' : 'dark';
  const label = zh ? `切换到${LABEL[next].zh}` : `Switch to ${LABEL[next].en.toLowerCase()}`;

  if (variant === 'segmented') {
    return (
      <div role="radiogroup" aria-label={zh ? '界面底色' : 'Colour mode'} className={`inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 ${className}`}>
        {(['dark', 'light'] as const).map(m => {
          const Icon = m === 'dark' ? Moon : Sun;
          const on = mode === m;
          return (
            <button key={m} type="button" role="radio" aria-checked={on} onClick={() => setMode(m)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              <Icon className={`h-4 w-4 ${on ? 'text-violet-600' : ''}`} />{zh ? LABEL[m].zh : LABEL[m].en}
            </button>
          );
        })}
      </div>
    );
  }

  const Icon = mode === 'dark' ? Moon : Sun;
  if (variant === 'row') {
    return (
      <button type="button" onClick={toggleMode} aria-label={label} title={label}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${className}`}>
        <Icon size={18} />
        <span className="flex-1 text-left font-medium">{zh ? '界面底色' : 'Appearance'}</span>
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition" style={{ background: mode === 'dark' ? '#7c3aed' : '#cbd5e1' }}>
          <span className="absolute h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: mode === 'dark' ? 18 : 2 }} />
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={toggleMode} aria-label={label} title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-black/5 ${className}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
};
