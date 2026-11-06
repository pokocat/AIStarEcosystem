import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, ChevronDown, Clock, Package, Pause, Play, Sparkles, TrendingUp } from 'lucide-react';
import type { Lang } from '../translations';
import type { SolutionDetail, SolutionSpotlight } from '../data/solutionDetails';

interface Theme {
  lang: Lang;
  accent: string;
  secondary: string;
}

const Heading = ({ eyebrow, title, desc, accent }: { eyebrow: string; title: string; desc?: string; accent: string }) => (
  <div className="text-center max-w-3xl mx-auto mb-12">
    <div className="text-xs uppercase tracking-[.22em] mb-4" style={{ color: accent }}>{eyebrow}</div>
    <h2 className="text-3xl md:text-5xl font-black text-white [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
    {desc && <p className="text-gray-400 mt-4 leading-relaxed">{desc}</p>}
  </div>
);

/* ─────────────── Spotlight: the solution's own interactive module ─────────────── */

export const SpotlightSection = ({ spotlight, lang, accent, secondary }: Theme & { spotlight: SolutionSpotlight }) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => v[lang];
  return (
    <section id="spotlight" className="px-6 py-28 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}18, transparent 55%)` }} />
      <div className="max-w-6xl mx-auto relative">
        <Heading eyebrow={zh ? '互动体验' : 'Try It'} title={t(spotlight.title)} desc={t(spotlight.desc)} accent={accent} />
        {spotlight.kind === 'tabs'
          ? <SpotlightTabs spotlight={spotlight} lang={lang} accent={accent} secondary={secondary} />
          : <SpotlightJourney spotlight={spotlight} lang={lang} accent={accent} secondary={secondary} />}
      </div>
    </section>
  );
};

const SpotlightTabs = ({ spotlight, lang, accent, secondary }: Theme & { spotlight: Extract<SolutionSpotlight, { kind: 'tabs' }> }) => {
  const [index, setIndex] = useState(0);
  const t = (v: { zh: string; en: string }) => v[lang];
  const option = spotlight.options[index];
  const gradient = `linear-gradient(135deg, ${accent}, ${secondary})`;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 md:p-8">
      <div className="flex flex-wrap gap-2 mb-8" role="tablist">
        {spotlight.options.map((item, i) => (
          <button key={item.label.en} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)}
            className={`relative h-10 px-5 rounded-full text-sm transition-colors ${i === index ? 'text-white' : 'text-gray-400 hover:text-white border border-white/10'}`}>
            {i === index && <motion.span layoutId="spotlight-tab" className="absolute inset-0 rounded-full" style={{ background: gradient }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <span className="relative">{t(item.label)}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .3 }}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
            <h3 className="text-2xl md:text-3xl text-white font-black max-w-2xl [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>{t(option.headline)}</h3>
            {option.highlight && (
              <span className="self-start md:self-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white" style={{ background: gradient }}>
                <Sparkles className="w-3.5 h-3.5" /> {t(option.highlight)}
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{t(spotlight.cardsTitle)}</div>
          <div className={`grid gap-3 ${option.cards.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {option.cards.map((card, i) => (
              <motion.div key={card.title.en} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white mb-4" style={{ background: gradient }}>{i + 1}</div>
                <div className="text-base text-white font-bold">{t(card.title)}</div>
                <div className="text-sm text-gray-400 mt-1">{t(card.sub)}</div>
              </motion.div>
            ))}
          </div>

          {(option.chips || option.metrics) && (
            <div className="mt-6 grid md:grid-cols-[1fr_auto] gap-6 items-end">
              {option.chips ? (
                <div>
                  {spotlight.chipsTitle && <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">{t(spotlight.chipsTitle)}</div>}
                  <div className="flex flex-wrap items-center gap-2">
                    {option.chips.map((chip, i) => (
                      <React.Fragment key={chip.en}>
                        <span className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-200">
                          <span className="font-mono text-xs mr-2" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</span>{t(chip)}
                        </span>
                        {i < option.chips!.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-gray-600" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : <div />}
              {option.metrics && (
                <div className="flex gap-3">
                  {option.metrics.map(metric => (
                    <div key={metric.label.en} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-center min-w-[110px]">
                      <div className="text-xl font-black whitespace-nowrap" style={{ color: accent, fontFamily: 'var(--font-display)' }}>{metric.value}</div>
                      <div className="text-xs text-gray-500 mt-1">{t(metric.label)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const SpotlightJourney = ({ spotlight, lang, accent, secondary }: Theme & { spotlight: Extract<SolutionSpotlight, { kind: 'journey' }> }) => {
  const zh = lang === 'zh';
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const t = (v: { zh: string; en: string }) => v[lang];
  const steps = spotlight.steps;
  const step = steps[index];
  const gradient = `linear-gradient(135deg, ${accent}, ${secondary})`;

  // Auto-advance through the journey; any manual pick pauses playback.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % steps.length), 3200);
    return () => window.clearTimeout(timer);
  }, [playing, index, steps.length]);

  const pick = (i: number) => { setIndex(i); setPlaying(false); };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 md:p-8">
      <div className="relative">
        <div className="absolute left-0 right-0 top-5 h-px bg-white/10 hidden md:block" />
        <motion.div className="absolute left-0 top-5 h-px hidden md:block" style={{ background: gradient }}
          animate={{ width: `${(index / (steps.length - 1)) * 100}%` }} transition={{ duration: .5 }} />
        <ol className="relative grid grid-cols-3 md:grid-cols-6 gap-y-5 gap-x-2">
          {steps.map((item, i) => {
            const done = i <= index;
            return (
              <li key={item.label.en}>
                <button type="button" onClick={() => pick(i)} className="w-full flex flex-col items-center text-center group">
                  <span className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all"
                    style={done
                      ? { background: gradient, color: '#fff', boxShadow: i === index ? `0 0 0 5px ${accent}25, 0 0 24px ${accent}60` : undefined }
                      : { background: '#0b0f17', color: '#6b7280', border: '1px solid rgba(255,255,255,.12)' }}>
                    {item.time}
                  </span>
                  <span className={`mt-3 text-sm leading-tight ${i === index ? 'text-white font-semibold' : 'text-gray-500 group-hover:text-gray-300'}`}>{t(item.label)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .3 }}
          className="mt-8 grid md:grid-cols-[1fr_auto] gap-5 items-center rounded-2xl border p-6"
          style={{ borderColor: `${accent}40`, background: `linear-gradient(135deg, ${accent}12, transparent 70%)` }}>
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: accent }}>{step.time} · {zh ? `第 ${index + 1} 步` : `Step ${index + 1}`}</div>
            <div className="text-2xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{t(step.label)}</div>
            <p className="text-gray-300 mt-2">{t(step.desc)}</p>
          </div>
          <div className="rounded-xl bg-black/50 border border-white/10 px-5 py-4 text-center min-w-[160px]">
            <div className="text-xs text-gray-500">{zh ? '本步产出' : 'Output'}</div>
            <div className="text-lg font-black mt-1" style={{ color: accent }}>{t(step.output)}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => setPlaying(p => !p)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? (zh ? '暂停演示' : 'Pause') : (zh ? '自动播放' : 'Auto-play')}
        </button>
      </div>
    </div>
  );
};

/* ─────────────── Shared detail sections ─────────────── */

export const DayTimelineSection = ({ day, lang, accent, secondary, name }: Theme & { day: SolutionDetail['day']; name: string }) => {
  const zh = lang === 'zh';
  return (
    <section id="day" className="px-6 py-28 border-y border-white/5 bg-gray-950/40">
      <div className="max-w-5xl mx-auto">
        <Heading eyebrow={zh ? '一个真实工作日' : 'A Day With AI'} title={zh ? `用${name}的一天` : `A Day Running ${name}`} desc={zh ? 'AI 承担重复工作，团队专注创意与决策。' : 'AI handles the repetitive work so the team can focus on decisions.'} accent={accent} />
        <ol className="relative">
          <span aria-hidden className="absolute left-[27px] md:left-1/2 top-2 bottom-2 w-px" style={{ background: `linear-gradient(${accent}, ${secondary})`, opacity: .35 }} />
          {day.map((item, i) => (
            <motion.li key={item.time} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .06 }}
              className={`relative flex items-center gap-5 mb-5 md:w-1/2 ${i % 2 ? 'md:ml-auto md:pl-10' : 'md:pr-10 md:flex-row-reverse md:text-right'}`}>
              <span className={`relative z-10 shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white text-xs font-bold md:absolute ${i % 2 ? 'md:-left-7' : 'md:-right-7'}`}
                style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}>
                <Clock className="w-3.5 h-3.5 mb-0.5 opacity-80" />{item.time}
              </span>
              <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="text-base text-white font-semibold">{item.title[lang]}</div>
                <div className="text-sm mt-1" style={{ color: accent }}>{item.output[lang]}</div>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export const DeliverablesSection = ({ deliverables, lang, accent, secondary }: Theme & { deliverables: SolutionDetail['deliverables'] }) => {
  const zh = lang === 'zh';
  return (
    <section id="deliverables" className="px-6 py-28">
      <div className="max-w-7xl mx-auto">
        <Heading eyebrow={zh ? '你将得到什么' : 'What You Get'} title={zh ? '可以长期复用的 IP 资产' : 'IP Assets You Keep Reusing'} desc={zh ? '每一次创作都会沉淀下来，越用越有价值。' : 'Everything you make is kept and compounds over time.'} accent={accent} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {deliverables.map((item, i) => (
            <motion.div key={item.title.en} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .07 }} whileHover={{ y: -5 }}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900/60 to-black p-6">
              <div className="flex items-center justify-between mb-8">
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}><Package className="w-5 h-5" /></span>
                <span className="text-xs font-mono text-gray-600">0{i + 1}</span>
              </div>
              <h3 className="text-lg text-white font-bold">{item.title[lang]}</h3>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">{item.desc[lang]}</p>
              <div className="mt-5 h-0.5 w-10 rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${secondary})` }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const ResultsSection = ({ results, lang, accent, secondary }: Theme & { results: SolutionDetail['results'] }) => {
  const zh = lang === 'zh';
  return (
    <section id="results" className="px-6 py-28 border-y border-white/5 bg-gray-950/40">
      <div className="max-w-6xl mx-auto">
        <Heading eyebrow={zh ? '使用前后对比' : 'Before & After'} title={zh ? '效率和效果，都看得见' : 'Results You Can Measure'} accent={accent} />
        <div className="grid md:grid-cols-3 gap-4">
          {results.map((item, i) => (
            <motion.div key={item.label.en} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08 }}
              className="rounded-3xl border border-white/10 bg-black/40 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{item.label[lang]}</span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})` }}>
                  <TrendingUp className="w-3 h-3" /> {item.change}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div>
                  <div className="text-xs text-gray-500">{zh ? '使用前' : 'Before'}</div>
                  <div className="text-xl text-gray-400 font-bold mt-1 line-through decoration-gray-600">{item.before[lang]}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600" />
                <div className="text-right">
                  <div className="text-xs text-gray-500">{zh ? '使用后' : 'After'}</div>
                  <div className="text-2xl font-black mt-1" style={{ color: accent, fontFamily: 'var(--font-display)' }}>{item.after[lang]}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">{zh ? '以上为示例数据，实际效果因业务而异。' : 'Illustrative figures; actual results vary by business.'}</p>
      </div>
    </section>
  );
};

export const FaqSection = ({ faq, lang, accent }: Omit<Theme, 'secondary'> & { faq: SolutionDetail['faq'] }) => {
  const zh = lang === 'zh';
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-6 py-28">
      <div className="max-w-3xl mx-auto">
        <Heading eyebrow="FAQ" title={zh ? '你可能关心的问题' : 'Questions You May Have'} accent={accent} />
        <div className="space-y-3">
          {faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q.en} className="rounded-2xl border transition-colors" style={{ borderColor: isOpen ? `${accent}55` : 'rgba(255,255,255,.1)' }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-4 p-5 text-left">
                  <span className="flex items-center gap-3 text-base text-white font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: accent }} /> {item.q[lang]}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="px-5 pb-5 pl-12 text-sm text-gray-400 leading-relaxed">{item.a[lang]}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
