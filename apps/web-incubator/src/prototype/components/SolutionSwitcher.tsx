import React, { useEffect, useRef, useState } from 'react';
import {
  Building2, ChevronDown, Crown, Film, GraduationCap, Grid3X3,
  Landmark, MapPin, MessageCircle, Package, ShoppingBag, Sparkles, Star,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Lang } from '../translations';
import {
  SOLUTION_CONFIGS, SOLUTION_ORDER, getSolutionLabel,
  type SolutionId,
} from '../data/ipPlatform';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  ecosystem: Grid3X3,
  'ai-artist': Star,
  film: Film,
  shopping: ShoppingBag,
  sparkles: Sparkles,
  building: Building2,
  package: Package,
  map: MapPin,
  crown: Crown,
  landmark: Landmark,
  education: GraduationCap,
  gamepad: Sparkles,
  message: MessageCircle,
};

const groups = [
  { id: 'platform', zh: '平台入口', en: 'Platform' },
  { id: 'entertainment', zh: '娱乐与内容', en: 'Entertainment & Content' },
  { id: 'business', zh: '企业与品牌', en: 'Business & Brand' },
  { id: 'culture', zh: '城市、文化与教育', en: 'City, Culture & Education' },
  { id: 'intelligence', zh: '智能交互', en: 'Intelligent Interaction' },
] as const;

interface Props {
  value: SolutionId;
  lang: Lang;
  onChange: (id: SolutionId) => void;
}

export const SolutionSwitcher = ({ value, lang, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const zh = lang === 'zh';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const list = listRef.current;
      const activeItem = list?.querySelector<HTMLElement>('[data-active="true"]');
      if (list && activeItem) list.scrollTop = Math.max(0, activeItem.offsetTop - 88);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, value]);

  const getMeta = (id: SolutionId) => {
    if (id === 'ecosystem') return { group: 'platform', icon: 'ecosystem', accent: '#06b6d4' };
    if (id === 'ai-artist') return { group: 'platform', icon: 'ai-artist', accent: '#a855f7' };
    const config = SOLUTION_CONFIGS[id];
    return { group: config.group, icon: config.icon, accent: config.accent };
  };

  return (
    <div className="homepage-dark">
      <button
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-label={zh ? '切换解决方案' : 'Switch solution'}
        className="fixed bottom-5 right-5 z-[190] flex items-center gap-3 rounded-2xl border border-white/15 bg-black/85 backdrop-blur-xl p-2 sm:px-4 sm:py-3 text-left text-white hover:border-cyan-400/40 transition"
        style={{ boxShadow: '0 16px 50px rgba(0,0,0,.45)' }}
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
          <Grid3X3 className="w-4 h-4 text-cyan-300" />
        </div>
        <div className="hidden sm:block">
          <div className="text-xs text-gray-500 uppercase tracking-widest">{zh ? '切换解决方案' : 'Switch Solution'}</div>
          <div className="text-xs font-semibold mt-0.5">{getSolutionLabel(value)[lang]}</div>
        </div>
        <ChevronDown className={`hidden sm:block w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label={zh ? '关闭解决方案列表' : 'Close solution list'}
              className="fixed inset-0 z-[180] cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={listRef}
              initial={{ opacity: 0, y: 12, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: .98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed bottom-20 right-3 sm:right-5 z-[190] w-[calc(100vw-24px)] sm:w-[340px] max-h-[68vh] overflow-y-auto overscroll-contain [scrollbar-width:thin] rounded-2xl border border-white/15 bg-[#070b12]/95 backdrop-blur-xl p-3 text-white"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,.55)' }}
              role="dialog"
              aria-label={zh ? '选择首页' : 'Choose homepage'}
            >
              <div className="px-2 pt-1 pb-3 border-b border-white/10">
                <div className="text-sm font-bold">{zh ? '选择首页' : 'Choose Homepage'}</div>
                <div className="text-xs text-gray-500 mt-1">{zh ? '点击列表直接切换' : 'Select from the list to switch'}</div>
              </div>

              <div className="pt-2 space-y-3">
                {groups.map(group => {
                  const solutions = SOLUTION_ORDER.filter(id => getMeta(id).group === group.id);
                  if (!solutions.length) return null;
                  return (
                    <div key={group.id}>
                      <div className="px-2 py-1.5 text-xs text-gray-600 uppercase tracking-wider">{zh ? group.zh : group.en}</div>
                      <div className="space-y-0.5">
                        {solutions.map(id => {
                          const meta = getMeta(id);
                          const Icon = icons[meta.icon] || Sparkles;
                          const active = id === value;
                          return (
                            <button
                              key={id}
                              type="button"
                              data-active={active}
                              onClick={() => {
                                if (!active) onChange(id);
                                setOpen(false);
                              }}
                              className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/5"
                              style={active ? {
                                background: `${meta.accent}14`,
                                boxShadow: `inset 0 0 0 1px ${meta.accent}45`,
                              } : undefined}
                            >
                              <span
                                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                                style={{ color: meta.accent, background: `${meta.accent}15` }}
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium text-white truncate">{getSolutionLabel(id)[lang]}</span>
                              </span>
                              {active && (
                                <span className="text-xs shrink-0" style={{ color: meta.accent }}>
                                  {zh ? '当前' : 'Current'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SolutionSwitcher;
