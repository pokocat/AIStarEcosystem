"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type ThemeStyle = 
  | 'cyberpunk'      // 赛博朋克强化版
  | 'glassmorphism'  // 玻璃态现代风
  | 'gradient'       // 渐变流体风格
  | 'neumorphism'    // 新拟态风格
  | 'terminal'       // 终端黑客风
  | 'minimal';       // 极简科技风

interface ThemeContextType {
  theme: ThemeStyle;
  setTheme: (theme: ThemeStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeStyle>('cyberpunk');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('ai-star-eco-theme') as ThemeStyle | null;
    if (storedTheme && storedTheme in themeConfig) {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('ai-star-eco-theme', theme);
  }, [theme]);

  const contextValue = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 主题配置
export const themeConfig = {
  cyberpunk: {
    name: { zh: '赛博朋克强化版', en: 'Cyberpunk Enhanced' },
    description: { zh: '霓虹光效+扫描线+故障艺术', en: 'Neon glow + Scanlines + Glitch' },
    sidebar: {
      bg: 'bg-[#0c0c0e]',
      itemBase: 'text-gray-400 hover:bg-white/5 hover:text-white',
      itemActive: 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
      sectionTitle: 'text-gray-600',
      border: 'border-white/10',
      glow: 'shadow-[0_0_10px_rgba(8,145,178,0.5)]'
    }
  },
  glassmorphism: {
    name: { zh: '玻璃态现代风', en: 'Glassmorphism' },
    description: { zh: '毛玻璃+背景模糊+光影层次', en: 'Frosted glass + Blur + Layers' },
    sidebar: {
      bg: 'bg-white/5 backdrop-blur-xl',
      itemBase: 'text-gray-300 hover:bg-white/10 hover:text-white backdrop-blur-sm',
      itemActive: 'bg-white/20 text-white backdrop-blur-md shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] border border-white/30',
      sectionTitle: 'text-gray-400',
      border: 'border-white/20',
      glow: 'shadow-[0_8px_32px_rgba(255,255,255,0.1)]'
    }
  },
  gradient: {
    name: { zh: '渐变流体风格', en: 'Gradient Fluid' },
    description: { zh: '动态渐变+流体动画+彩色光晕', en: 'Dynamic gradient + Fluid + Colorful' },
    sidebar: {
      bg: 'bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20',
      itemBase: 'text-gray-300 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 hover:text-white',
      itemActive: 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-white shadow-[0_0_30px_rgba(168,85,247,0.4)]',
      sectionTitle: 'text-purple-400/70',
      border: 'border-purple-500/20',
      glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]'
    }
  },
  neumorphism: {
    name: { zh: '新拟态风格', en: 'Neumorphism' },
    description: { zh: '柔和阴影+浮雕效果+优雅质感', en: 'Soft shadows + Embossed + Elegant' },
    sidebar: {
      bg: 'bg-[#1a1a1f]',
      itemBase: 'text-gray-400 hover:text-white hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.05)]',
      itemActive: 'text-cyan-300 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.07)] bg-[#141418]',
      sectionTitle: 'text-gray-500',
      border: 'border-transparent',
      glow: 'shadow-[4px_4px_10px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.05)]'
    }
  },
  terminal: {
    name: { zh: '终端黑客风', en: 'Terminal Hacker' },
    description: { zh: '命令行+字符动画+矩阵效果', en: 'Command line + ASCII + Matrix' },
    sidebar: {
      bg: 'bg-black',
      itemBase: 'text-green-500/70 hover:bg-green-500/5 hover:text-green-400 font-mono border border-transparent hover:border-green-500/20',
      itemActive: 'bg-green-500/10 text-green-300 font-mono border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]',
      sectionTitle: 'text-green-600/50 font-mono',
      border: 'border-green-500/20',
      glow: 'shadow-[0_0_10px_rgba(34,197,94,0.4)]'
    }
  },
  minimal: {
    name: { zh: '极简科技风', en: 'Minimal Tech' },
    description: { zh: '简洁线条+微动画+精致图标', en: 'Clean lines + Micro animations + Refined' },
    sidebar: {
      bg: 'bg-[#0a0a0a]',
      itemBase: 'text-gray-500 hover:bg-gray-900 hover:text-white border-l-2 border-transparent hover:border-gray-700 pl-4',
      itemActive: 'text-white bg-gray-900 border-l-2 border-white pl-4',
      sectionTitle: 'text-gray-700 font-light',
      border: 'border-gray-900',
      glow: 'shadow-none'
    }
  }
};
