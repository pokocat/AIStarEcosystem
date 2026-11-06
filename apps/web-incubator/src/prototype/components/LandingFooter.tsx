import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { Lang } from '../translations';
import { SOLUTION_CONFIGS, getSolutionLabel, type SolutionId } from '../data/ipPlatform';

interface Props {
  lang: Lang;
  accent: string;
  onSelectSolution: (id: SolutionId) => void;
  onEnter: () => void;
}

type VerticalId = keyof typeof SOLUTION_CONFIGS;

const columns: Array<{ zh: string; en: string; ids: SolutionId[] }> = [
  { zh: '娱乐与内容', en: 'Entertainment', ids: ['ai-artist', 'ai-drama', 'virtual-idol', 'anime-ip'] },
  { zh: '企业与品牌', en: 'Business & Brand', ids: ['digital-founder', 'corporate-ip', 'brand-ip', 'story-commerce'] },
  { zh: '城市、文化与教育', en: 'City, Culture & Education', ids: ['city-ip', 'culture-ip', 'education-ip', 'social-ip'] },
];

/** Shared footer for the ecosystem homepage and all vertical solution homepages. */
export const LandingFooter = ({ lang, accent, onSelectSolution, onEnter }: Props) => {
  const zh = lang === 'zh';
  const linkClass = 'block py-1.5 text-sm text-gray-500 hover:text-white transition text-left';

  return (
    <footer className="border-t border-white/5 px-6 pt-16 pb-28">
      <div className="max-w-7xl mx-auto grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <button type="button" onClick={() => onSelectSolution('ecosystem')} className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: accent }} />
            <span className="text-base text-white font-bold" style={{ fontFamily: 'var(--font-display)' }}>AI Star Eco</span>
          </button>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed max-w-xs">
            {zh ? 'AI IP 生态平台：孵化、运营与经营每一种数字 IP。' : 'The AI IP ecosystem to incubate, operate and grow every kind of digital IP.'}
          </p>
        </div>
        {columns.map(column => (
          <div key={column.en}>
            <h4 className="text-xs text-white font-semibold uppercase tracking-wider mb-3">{zh ? column.zh : column.en}</h4>
            {column.ids.map(id => (
              <button key={id} type="button" onClick={() => onSelectSolution(id)} className={linkClass}>
                {id === 'ai-artist' || id === 'ecosystem' ? getSolutionLabel(id)[lang] : SOLUTION_CONFIGS[id as VerticalId].name[lang]}
              </button>
            ))}
          </div>
        ))}
        <div>
          <h4 className="text-xs text-white font-semibold uppercase tracking-wider mb-3">{zh ? '平台' : 'Platform'}</h4>
          <button type="button" onClick={() => onSelectSolution('ecosystem')} className={linkClass}>{zh ? '方案总览' : 'All Solutions'}</button>
          <button type="button" onClick={onEnter} className={`${linkClass} inline-flex items-center gap-1`}>
            {zh ? '进入平台' : 'Enter Platform'} <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/5 text-xs text-gray-600">
        © 2026 AI Star Eco · {zh ? 'AI IP 生态平台' : 'AI IP Ecosystem Platform'}
      </div>
    </footer>
  );
};

export default LandingFooter;
