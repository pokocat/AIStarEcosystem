/**
 * ThemeShowcase - 主题展示组件
 * 用于演示所有可用主题的视觉效果
 * 
 * 注意：这是一个可选的演示组件，不影响核心功能
 */

import React from 'react';
import { useTheme, themeConfig, ThemeStyle } from './ThemeProvider';
import { Check } from 'lucide-react';

interface ThemeShowcaseProps {
  lang: 'zh' | 'en';
}

export const ThemeShowcase: React.FC<ThemeShowcaseProps> = ({ lang }) => {
  const { theme, setTheme } = useTheme();
  const themes: ThemeStyle[] = ['cyberpunk', 'glassmorphism', 'gradient', 'neumorphism', 'terminal', 'minimal'];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
      {themes.map((themeKey) => {
        const config = themeConfig[themeKey];
        const isActive = theme === themeKey;
        
        return (
          <button
            key={themeKey}
            onClick={() => setTheme(themeKey)}
            className={`relative p-6 rounded-2xl border-2 transition-all ${
              isActive 
                ? 'border-purple-500 scale-105 shadow-[0_0_30px_rgba(168,85,247,0.3)]' 
                : 'border-white/10 hover:border-white/30 hover:scale-102'
            }`}
          >
            {/* Theme preview */}
            <div className={`h-32 rounded-xl mb-4 overflow-hidden ${config.sidebar.bg}`}>
              <div className="p-3 space-y-2">
                <div className={`h-2 w-3/4 rounded ${config.sidebar.itemActive.includes('cyan') ? 'bg-cyan-500/30' : 'bg-purple-500/30'}`}></div>
                <div className="h-2 w-1/2 rounded bg-white/10"></div>
                <div className="h-2 w-2/3 rounded bg-white/10"></div>
              </div>
            </div>
            
            {/* Theme name */}
            <h3 className={`font-bold mb-2 ${isActive ? 'text-purple-300' : 'text-white'}`}>
              {config.name[lang]}
            </h3>
            
            {/* Theme description */}
            <p className="text-xs text-gray-500">
              {config.description[lang]}
            </p>
            
            {/* Active indicator */}
            {isActive && (
              <div className="absolute top-3 right-3 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
