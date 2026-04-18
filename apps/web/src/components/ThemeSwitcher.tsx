"use client";

import React, { useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, ThemeStyle, themeConfig } from './ThemeProvider';

interface ThemeSwitcherProps {
  lang: 'zh' | 'en';
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ lang }) => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: ThemeStyle[] = ['cyberpunk', 'glassmorphism', 'gradient', 'neumorphism', 'terminal', 'minimal', 'neon', 'ocean'];
  
  const handleThemeChange = (newTheme: ThemeStyle) => {
    setTheme(newTheme);
    setIsOpen(false);
    
    // Optional: Add a visual feedback animation
    const root = document.documentElement;
    root.style.setProperty('--theme-transition', 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isOpen 
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
            : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
        }`}
      >
        <Palette size={18} />
        <span className="flex-1 text-left">{lang === 'zh' ? 'UI 主题' : 'UI Theme'}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs"
        >
          ▼
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 mt-2 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
              {themes.map((themeKey) => {
                const config = themeConfig[themeKey];
                const isActive = theme === themeKey;
                
                return (
                  <motion.button
                    key={themeKey}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: themes.indexOf(themeKey) * 0.05 }}
                    onClick={() => handleThemeChange(themeKey)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-all group relative overflow-hidden ${
                      isActive
                        ? 'bg-purple-500/20 border border-purple-500/40'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3 relative z-10">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-purple-500/30' : 'bg-white/5'
                      }`}>
                        {isActive ? (
                          <Check className="w-5 h-5 text-purple-300" />
                        ) : (
                          <Palette className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm mb-1 ${
                          isActive ? 'text-purple-300' : 'text-white group-hover:text-purple-300'
                        } transition-colors`}>
                          {config.name[lang]}
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                          {config.description[lang]}
                        </div>
                      </div>
                    </div>
                    
                    {/* Visual preview bar */}
                    <div className="mt-3 flex gap-1 relative z-10">
                      {themeKey === 'cyberpunk' && (
                        <>
                          <div className="h-1 flex-1 bg-cyan-500/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-pink-500/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-purple-500/50 rounded-full"></div>
                        </>
                      )}
                      {themeKey === 'glassmorphism' && (
                        <>
                          <div className="h-1 flex-1 bg-white/30 rounded-full backdrop-blur"></div>
                          <div className="h-1 flex-1 bg-white/40 rounded-full backdrop-blur"></div>
                          <div className="h-1 flex-1 bg-white/50 rounded-full backdrop-blur"></div>
                        </>
                      )}
                      {themeKey === 'gradient' && (
                        <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
                      )}
                      {themeKey === 'neumorphism' && (
                        <>
                          <div className="h-1 flex-1 bg-gray-700 rounded-full shadow-inner"></div>
                          <div className="h-1 flex-1 bg-gray-600 rounded-full shadow-inner"></div>
                          <div className="h-1 flex-1 bg-gray-500 rounded-full shadow-inner"></div>
                        </>
                      )}
                      {themeKey === 'terminal' && (
                        <>
                          <div className="h-1 flex-1 bg-green-500/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-green-400/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-green-300/50 rounded-full"></div>
                        </>
                      )}
                      {themeKey === 'minimal' && (
                        <>
                          <div className="h-1 flex-1 bg-gray-800 rounded-full"></div>
                          <div className="h-1 flex-1 bg-gray-700 rounded-full"></div>
                          <div className="h-1 flex-1 bg-white rounded-full"></div>
                        </>
                      )}
                      {themeKey === 'neon' && (
                        <>
                          <div className="h-1 flex-1 bg-pink-500/60 rounded-full"></div>
                          <div className="h-1 flex-1 bg-orange-500/60 rounded-full"></div>
                          <div className="h-1 flex-1 bg-yellow-400/50 rounded-full"></div>
                        </>
                      )}
                      {themeKey === 'ocean' && (
                        <>
                          <div className="h-1 flex-1 bg-sky-600/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-sky-400/50 rounded-full"></div>
                          <div className="h-1 flex-1 bg-teal-400/50 rounded-full"></div>
                        </>
                      )}
                    </div>

                    {/* Background glow effect on hover */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                      themeKey === 'cyberpunk' ? 'bg-gradient-to-r from-cyan-500/5 to-pink-500/5' :
                      themeKey === 'glassmorphism' ? 'bg-white/5 backdrop-blur' :
                      themeKey === 'gradient' ? 'bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-cyan-500/5' :
                      themeKey === 'neumorphism' ? 'bg-gray-800/20' :
                      themeKey === 'terminal' ? 'bg-green-500/5' :
                      themeKey === 'neon' ? 'bg-gradient-to-r from-pink-500/5 to-orange-500/5' :
                      themeKey === 'ocean' ? 'bg-gradient-to-r from-sky-500/5 to-teal-500/5' :
                      'bg-gray-900/30'
                    }`}></div>
                  </motion.button>
                );
              })}
            </div>
            
            {/* Theme info footer */}
            <div className="p-3 border-t border-white/10 bg-black/40">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Sparkles className="w-3 h-3" />
                <span>{lang === 'zh' ? '当前主题' : 'Current'}: <span className="text-purple-400 font-semibold">{themeConfig[theme].name[lang]}</span></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};