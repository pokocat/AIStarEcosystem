import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ThemeStyle =
  | 'light'          // 极光纯白（默认）
  | 'cyberpunk'      // 赛博冰青（浅色）
  | 'glassmorphism'  // 琉璃云雾（浅色）
  | 'gradient'       // 幻彩流光（浅色）
  | 'neumorphism'    // 柔和浮雕（浅色）
  | 'terminal'       // 矩阵终端（浅色）
  | 'minimal'        // 极简纸感（浅色）
  | 'neon'           // 霓虹暖阳（浅色）
  | 'ocean';         // 蔚蓝海湾（浅色）

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
  const [theme, setTheme] = useState<ThemeStyle>('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 全浅色高对比度主题配置
export const themeConfig = {
  light: {
    name: { zh: '极光纯白', en: 'Daylight Pure' },
    description: { zh: '纯净白底 + 锐利边框 + 超高对比度深色字', en: 'Pure white canvas + Crisp borders + Deep ink text' },
    sidebar: {
      bg: 'bg-white',
      itemBase: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      itemActive: 'bg-indigo-50 text-indigo-700 font-semibold border-r-2 border-indigo-600 shadow-xs',
      sectionTitle: 'text-slate-400',
      border: 'border-slate-200',
      glow: 'shadow-none'
    }
  },
  cyberpunk: {
    name: { zh: '赛博冰青', en: 'Cyber Ice Cyan' },
    description: { zh: '冰白机能底 + 电光青紫高亮 + 科技感网格', en: 'Ice white + Electric cyan-violet accents' },
    sidebar: {
      bg: 'bg-slate-50/90',
      itemBase: 'text-slate-600 hover:bg-cyan-50/70 hover:text-cyan-900',
      itemActive: 'bg-cyan-50 text-cyan-800 font-semibold border-r-2 border-cyan-600 shadow-xs',
      sectionTitle: 'text-cyan-700/60',
      border: 'border-cyan-200/70',
      glow: 'shadow-sm'
    }
  },
  glassmorphism: {
    name: { zh: '琉璃云雾', en: 'Frosted Daylight' },
    description: { zh: '通透毛玻璃白 + 柔和层叠 + 现代轻盈质感', en: 'Frosted white glass + Soft depth + Airy layers' },
    sidebar: {
      bg: 'bg-white/85 backdrop-blur-xl',
      itemBase: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
      itemActive: 'bg-purple-50/90 text-purple-800 font-semibold border border-purple-200 shadow-xs',
      sectionTitle: 'text-slate-400',
      border: 'border-slate-200/80',
      glow: 'shadow-sm'
    }
  },
  gradient: {
    name: { zh: '幻彩流光', en: 'Prism Daylight' },
    description: { zh: '浅色流光渐变 + 虹彩点缀 + 时尚视觉层次', en: 'Pastel prism gradient + Iridescent highlights' },
    sidebar: {
      bg: 'bg-gradient-to-b from-white via-purple-50/30 to-cyan-50/30',
      itemBase: 'text-slate-600 hover:bg-white/80 hover:text-purple-900',
      itemActive: 'bg-gradient-to-r from-purple-100/80 to-cyan-100/60 text-purple-900 font-semibold border-r-2 border-purple-600',
      sectionTitle: 'text-purple-600/70',
      border: 'border-purple-200/60',
      glow: 'shadow-sm'
    }
  },
  neumorphism: {
    name: { zh: '柔和浮雕', en: 'Soft Tactile' },
    description: { zh: '暖白微浮雕 + 细腻阴影 + 舒适阅读体验', en: 'Warm tactile white + Subtle embossed cards' },
    sidebar: {
      bg: 'bg-[#f4f6f9]',
      itemBase: 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-xs',
      itemActive: 'bg-white text-slate-900 font-semibold shadow-sm border border-slate-200/80',
      sectionTitle: 'text-slate-400',
      border: 'border-slate-200',
      glow: 'shadow-none'
    }
  },
  terminal: {
    name: { zh: '矩阵终端', en: 'Matrix Paper' },
    description: { zh: '工程师浅灰纸感 + 翡翠绿数据高亮 + 等宽字体', en: ' crisp engineering paper + Emerald terminal accents' },
    sidebar: {
      bg: 'bg-emerald-50/20',
      itemBase: 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900 font-mono',
      itemActive: 'bg-emerald-100/70 text-emerald-900 font-mono font-semibold border-r-2 border-emerald-600',
      sectionTitle: 'text-emerald-700/70 font-mono',
      border: 'border-emerald-200/70',
      glow: 'shadow-none'
    }
  },
  minimal: {
    name: { zh: '极简纸感', en: 'Editorial Minimal' },
    description: { zh: '杂志级黑白灰 + 极简线条 + 极致清晰度', en: 'Editorial monochrome + Hairline rules + Max clarity' },
    sidebar: {
      bg: 'bg-white',
      itemBase: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 border-l-2 border-transparent pl-4',
      itemActive: 'text-slate-950 bg-slate-100 font-semibold border-l-2 border-slate-900 pl-4',
      sectionTitle: 'text-slate-400',
      border: 'border-slate-200',
      glow: 'shadow-none'
    }
  },
  neon: {
    name: { zh: '霓虹暖阳', en: 'Solar Amber' },
    description: { zh: '暖白底色 + 琥珀橙红高能点缀 + 电商高转化风', en: 'Warm white + Solar amber-rose commerce accents' },
    sidebar: {
      bg: 'bg-amber-50/20',
      itemBase: 'text-slate-600 hover:bg-amber-50 hover:text-amber-900',
      itemActive: 'bg-gradient-to-r from-amber-100/80 to-rose-100/60 text-amber-900 font-semibold border-r-2 border-amber-500',
      sectionTitle: 'text-amber-700/70',
      border: 'border-amber-200/70',
      glow: 'shadow-none'
    }
  },
  ocean: {
    name: { zh: '蔚蓝海湾', en: 'Ocean Daylight' },
    description: { zh: '清爽浅蓝白底 + 深海蓝专业数据看板风格', en: 'Crisp sky-white + Deep ocean analytical palette' },
    sidebar: {
      bg: 'bg-sky-50/30',
      itemBase: 'text-slate-600 hover:bg-sky-50 hover:text-sky-900',
      itemActive: 'bg-sky-100/80 text-sky-900 font-semibold border-r-2 border-sky-600',
      sectionTitle: 'text-sky-700/70',
      border: 'border-sky-200/70',
      glow: 'shadow-none'
    }
  }
};
