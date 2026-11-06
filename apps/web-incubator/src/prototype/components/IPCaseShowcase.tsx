import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ExternalLink, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Lang } from '../translations';
import type { LocalizedText } from '../data/ipPlatform';
import type { ShowcaseCase } from '../data/ipShowcaseCases';

export interface ShowcaseFilter {
  id: string;
  label: LocalizedText;
  match: (item: ShowcaseCase) => boolean;
}

interface Props {
  id?: string;
  lang: Lang;
  cases: ShowcaseCase[];
  filters: ShowcaseFilter[];
  eyebrow: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  accent: string;
  secondary: string;
  getAccent?: (item: ShowcaseCase) => string;
  /** Number of cards shown before expanding, under the "all" filter. */
  initialLimit?: number;
  cardAction: LocalizedText;
  onCaseClick: (item: ShowcaseCase) => void;
  ctaLabel: LocalizedText;
  onCta?: () => void;
}

const ALL = 'all';

export const IPCaseShowcase = ({
  id, lang, cases, filters, eyebrow, title, subtitle, accent, secondary,
  getAccent, initialLimit, cardAction, onCaseClick, ctaLabel, onCta,
}: Props) => {
  const [active, setActive] = useState(ALL);
  const [expanded, setExpanded] = useState(false);
  const gradient = `linear-gradient(135deg, ${accent}, ${secondary})`;

  const tabs = useMemo(() => [{ id: ALL, label: { zh: '全部', en: 'All' } }, ...filters.filter(f => cases.some(f.match))], [cases, filters]);

  const visible = useMemo(() => {
    if (active !== ALL) {
      const filter = filters.find(f => f.id === active);
      return filter ? cases.filter(filter.match) : cases;
    }
    if (!initialLimit || expanded) return cases;
    const featured = cases.filter(item => item.featured);
    return (featured.length ? featured : cases).slice(0, initialLimit);
  }, [active, cases, expanded, filters, initialLimit]);

  const canExpand = active === ALL && !!initialLimit && cases.length > initialLimit;

  const handleCta = () => {
    if (canExpand) {
      setExpanded(value => !value);
      return;
    }
    onCta?.();
  };

  return (
    <section id={id} className="relative px-6 py-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}1f, transparent 60%)` }} />
      <div className="max-w-7xl mx-auto relative">
        <div className="text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs mb-6"
            style={{ color: accent, border: `1px solid ${accent}50`, background: `${accent}12` }}>
            <Sparkles className="w-3.5 h-3.5" /> {eyebrow[lang]}
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .05 }}
            className="text-4xl md:text-6xl font-black tracking-tight text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>
            {title[lang]}
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: .12 }}
            className="text-base md:text-lg text-gray-400 mt-5">
            {subtitle[lang]}
          </motion.p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3" role="tablist">
          {tabs.map(tab => {
            const selected = tab.id === active;
            return (
              <motion.button key={tab.id} role="tab" aria-selected={selected} onClick={() => setActive(tab.id)}
                whileHover={{ y: -2 }} whileTap={{ scale: .96 }}
                className={`relative h-11 min-w-[88px] px-6 rounded-full text-sm transition-colors ${selected ? 'text-white' : 'text-gray-400 hover:text-white border border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
                {selected && (
                  <motion.span layoutId={`${id ?? 'showcase'}-tab`} className="absolute inset-0 rounded-full"
                    style={{ background: gradient, boxShadow: `0 10px 30px ${accent}45` }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                )}
                <span className="relative">{tab.label[lang]}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Phones get a swipeable carousel; larger screens a grid. */}
        <motion.div layout className="mt-12 -mx-6 px-6 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {visible.map((item, index) => {
              const color = getAccent?.(item) ?? accent;
              return (
                <motion.button key={item.id} layout type="button" onClick={() => onCaseClick(item)}
                  initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .95 }}
                  transition={{ duration: .35, delay: Math.min(index, 7) * .04 }} whileHover={{ y: -6 }}
                  className="group w-[80%] shrink-0 snap-center sm:w-auto text-left rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 bg-[#0b0b10] transition-colors"
                  style={{ boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>
                  <div className="relative h-72 overflow-hidden">
                    <img src={item.image} alt={item.name[lang]} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/35 to-transparent" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500" style={{ background: `linear-gradient(180deg, transparent 30%, ${color}30)` }} />
                    <span className="absolute top-4 right-4 rounded-md px-2.5 py-1 text-xs text-white font-medium" style={{ background: color, boxShadow: `0 6px 18px ${color}55` }}>
                      {item.tag[lang]}
                    </span>
                    <span className="absolute top-4 left-4 flex items-center gap-1 rounded-full bg-black/55 backdrop-blur px-2.5 py-1 text-xs text-white opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition">
                      {cardAction[lang]} <ArrowUpRight className="w-3 h-3" />
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="text-2xl text-white font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{item.name[lang]}</h3>
                      <p className="text-xs text-gray-300 mt-2 line-clamp-1">{item.description[lang]}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-5 pt-4">
                    {item.metrics.map(metric => (
                      <div key={metric.label.en} className="rounded-xl bg-white/[0.04] border border-white/[0.04] px-1.5 py-3 text-center">
                        <div className="text-sm md:text-base font-black leading-tight break-words" style={{ color }}>{metric.value}</div>
                        <div className="text-xs uppercase tracking-wide text-gray-500 mt-1 truncate">{metric.label[lang]}</div>
                      </div>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {(canExpand || onCta) && (
          <div className="mt-14 flex justify-center">
            <motion.button onClick={handleCta} whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: .97 }}
              className="h-12 px-7 rounded-lg text-white font-semibold inline-flex items-center gap-2.5"
              style={{ background: gradient, boxShadow: `0 14px 36px ${accent}35` }}>
              {canExpand && expanded ? (lang === 'zh' ? '收起展示' : 'Show Less') : ctaLabel[lang]}
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>
    </section>
  );
};

export default IPCaseShowcase;
