import React, { useState } from 'react';
import { Palette, Check, Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, ThemeStyle, themeConfig } from './ThemeProvider';

interface ThemeSwitcherProps {
  lang: 'zh' | 'en';
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ lang }) => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: ThemeStyle[] = [
    'light',
    'cyberpunk',
    'glassmorphism',
    'gradient',
    'minimal',
    'neon',
    'ocean',
    'terminal',
    'neumorphism',
  ];

  const handleThemeChange = (newTheme: ThemeStyle) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isOpen
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
        }`}
      >
        <Palette size={18} className="text-indigo-600 shrink-0" />
        <span className="flex-1 text-left truncate">
          {lang === 'zh' ? '主题风格' : 'UI Theme'}: {themeConfig[theme].name[lang]}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto">
              {themes.map((themeKey) => {
                const config = themeConfig[themeKey];
                const isActive = theme === themeKey;

                return (
                  <button
                    key={themeKey}
                    onClick={() => handleThemeChange(themeKey)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                      isActive
                        ? 'bg-indigo-50/90 border border-indigo-200 text-indigo-950'
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isActive ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Palette className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {config.name[lang]}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {config.description[lang]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {lang === 'zh' ? '全站浅色高对比度护眼模式' : 'High-Contrast Light Studio'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
