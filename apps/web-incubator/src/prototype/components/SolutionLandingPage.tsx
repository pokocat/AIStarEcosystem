import React, { useState } from 'react';
import { ColorModeToggle } from './ColorModeToggle';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, Cpu, Globe2,
  Layers, Rocket, Shield, Sparkles, Star, Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../translations';
import type { SolutionConfig, SolutionId } from '../data/ipPlatform';
import { AnimatedArrow, MagneticCTA, TypewriterHighlight } from './HeroInteractions';
import { IPCaseShowcase, type ShowcaseFilter } from './IPCaseShowcase';
import { SOLUTION_SHOWCASE_COPY, getSolutionCases } from '../data/ipShowcaseCases';
import { LandingMobileMenu } from './LandingMobileMenu';
import { LandingFooter } from './LandingFooter';
import { getContentMode, getEngine } from '../data/ipEngines';
import { SOLUTION_DETAILS } from '../data/solutionDetails';
import { DayTimelineSection, DeliverablesSection, FaqSection, ResultsSection, SpotlightSection } from './SolutionDetailSections';
import { SectionHead } from './landing/SectionHead';
import { ProductionHub } from './landing/ProductionHub';

interface Props {
  config: SolutionConfig;
  lang: Lang;
  setLang: (lang: Lang) => void;
  onEnter: () => void;
  onSelectSolution: (id: SolutionId) => void;
}

const capabilityIcons = [Wand2, Cpu, Globe2, Shield, Rocket, BarChart3];

export const SolutionLandingPage = ({ config, lang, setLang, onEnter, onSelectSolution }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const zh = lang === 'zh';
  const text = <T extends { zh: string; en: string }>(value: T) => value[lang];
  const heroPhrases = [
    config.highlight,
    {
      zh: `构建${config.name.zh}内容矩阵`,
      en: `Build a ${config.name.en} Matrix`,
    },
    {
      zh: '连接内容、分发与商业价值',
      en: 'Connect Content, Reach and Value',
    },
  ];
  const cases = getSolutionCases(config.id);
  const caseFilters: ShowcaseFilter[] = Array.from(new Map(cases.map(item => [item.category.en, item.category])).values())
    .map(category => ({ id: category.en, label: category, match: item => item.category.en === category.en }));
  const showcaseCopy = SOLUTION_SHOWCASE_COPY[config.id] ?? {
    title: { zh: `看看这些${config.name.zh}案例`, en: `${config.name.en} Showcase` },
    subtitle: { zh: '由创作者使用 AI Star Eco 打造', en: 'Created with AI Star Eco' },
  };
  const gradient = `linear-gradient(135deg, ${config.accent}, ${config.secondary})`;
  const detail = SOLUTION_DETAILS[config.id];
  const theme = { lang, accent: config.accent, secondary: config.secondary };
  const goHome = () => onSelectSolution('ecosystem');
  const navLinks = [
    { href: '#capabilities', label: zh ? '核心能力' : 'Capabilities' },
    { href: '#spotlight', label: zh ? '互动体验' : 'Try It' },
    { href: '#workflow', label: zh ? '业务流程' : 'Workflow' },
    { href: '#case', label: zh ? '案例' : 'Cases' },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: 'var(--font-sans)' }}>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={goHome} className="flex items-center gap-2 shrink-0" aria-label={zh ? '返回 AI IP 生态首页' : 'Back to AI IP Ecosystem'}>
              <Sparkles className="w-5 h-5" style={{ color: config.accent }} />
              <span className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>AI Star Eco</span>
            </button>
            <span className="hidden sm:inline text-xs text-gray-400 border border-white/10 rounded-full px-2.5 py-1 truncate">
              {text(config.name)}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <button type="button" onClick={goHome} className="inline-flex items-center gap-1 hover:text-white transition">
              <ArrowLeft className="w-3.5 h-3.5" /> {zh ? '全部方案' : 'All Solutions'}
            </button>
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-white transition">{link.label}</a>
            ))}
            <ColorModeToggle lang={zh ? 'zh' : 'en'} className="-mx-1 h-8 w-8 hover:bg-white/10" />
            <button onClick={onEnter} className="text-white rounded-full px-4 py-2 font-semibold" style={{ background: gradient }}>
              {text(config.primaryCTA)}
            </button>
          </div>
          <LandingMobileMenu
            open={menuOpen}
            onToggle={setMenuOpen}
            links={[{ label: zh ? '全部方案' : 'All Solutions', onClick: goHome }, ...navLinks]}
            lang={lang}
            setLang={setLang}
            enterLabel={text(config.primaryCTA)}
            onEnter={onEnter}
            gradient={gradient}
          />
        </div>
      </nav>

      <header className="relative min-h-screen pt-24 px-6 flex items-center overflow-hidden">
        <img src={config.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/45" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 45%, ${config.accent}22, transparent 35%)` }} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <motion.div animate={{ y: [0, -14, 0], rotate: [0, 7, -4, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute top-[20%] right-[13%] w-8 h-8 opacity-30" style={{ color: config.accent }}><Sparkles className="w-full h-full" /></motion.div>
        <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute bottom-[28%] right-[24%] w-6 h-6 opacity-20" style={{ color: config.secondary }}><Star className="w-full h-full" /></motion.div>
        <div className="absolute bottom-[12%] inset-x-0 overflow-hidden opacity-[0.04] pointer-events-none">
          <motion.div animate={{ x: [0, -1200] }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} className="whitespace-nowrap text-[100px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
            AI IP · CREATE · DISTRIBUTE · LICENSE · MONETIZE · AI IP · CREATE · DISTRIBUTE ·
          </motion.div>
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 border rounded-full px-4 py-2 text-xs mb-8" style={{ color: config.accent, borderColor: `${config.accent}45`, background: `${config.accent}0d` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: config.accent, boxShadow: `0 0 10px ${config.accent}` }} />
              {text(config.badge)}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.08] [text-wrap:balance]" style={{ fontFamily: 'var(--font-display)' }}>
              {text(config.title)}<br />
              <TypewriterHighlight phrases={heroPhrases} lang={lang} gradient={`linear-gradient(90deg, ${config.accent}, ${config.secondary})`} />
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }} className="mt-7 text-base md:text-lg text-gray-400 max-w-2xl leading-relaxed">
              {text(config.description)}
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4 }} className="mt-10 flex flex-wrap gap-4">
              <MagneticCTA onClick={onEnter} className="h-14 px-7 rounded-xl text-white font-bold" style={{ background: `linear-gradient(135deg, ${config.accent}, ${config.secondary})`, boxShadow: `0 16px 40px ${config.accent}25` }}>
                {text(config.primaryCTA)} <AnimatedArrow className="w-4 h-4" />
              </MagneticCTA>
              <motion.a href="#case" whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: .98 }} className="group h-14 px-7 rounded-xl border border-white/15 text-gray-300 hover:text-white hover:border-white/30 flex items-center gap-2 transition">
                {zh ? '查看标杆案例' : 'View Featured Case'} <ArrowUpRight className="w-4 h-4" />
              </motion.a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .55 }} className="mt-12 flex flex-wrap gap-8">
              {config.heroStats.map(item => (
                <div key={item.label.en}>
                  <div className="text-2xl font-black" style={{ color: config.accent, fontFamily: 'var(--font-display)' }}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{text(item.label)}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </header>

      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead eyebrow={zh ? '为谁打造' : 'Built for'} meta="TEAMS / 03" accent={config.accent}
            title={zh ? '为这些团队量身打造' : 'Built for Teams Like Yours'}
            desc={zh ? '从定位、内容生产到商业变现，每类团队都有对应的场景模板与工作流。' : 'From positioning and production to monetization, every team gets matching templates and workflows.'} />
          <div className="grid sm:grid-cols-3 gap-3">
            {config.audience.map((item, index) => (
              <motion.div key={item.name.en} whileHover={{ y: -4 }} className="group relative min-h-[200px] overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 p-5 flex flex-col">
                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: `radial-gradient(360px 160px at 0% 0%, ${config.accent}1f, transparent 70%)` }} />
                <div className="relative flex items-center justify-between">
                  <span className="eyebrow-mono text-gray-500">TEAM / 0{index + 1}</span>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.accent, boxShadow: `0 0 8px ${config.accent}` }} />
                </div>
                <div className="relative mt-auto text-xl text-white font-bold" style={{ fontFamily: 'var(--font-display)' }}>{text(item.name)}</div>
                <div className="relative text-xs text-gray-400 mt-2 flex items-start gap-1.5 leading-relaxed"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: config.accent }} /> {text(item.need)}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead eyebrow={zh ? '核心能力' : 'Capabilities'} meta={`CAPABILITIES / 0${config.capabilities.length}`} accent={config.accent}
            title={zh ? '从创作到变现，一站完成' : 'From Creation to Revenue, All in One Place'} />
          {/* Bento: the lead capability spans two columns, like the homepage's domain grid. */}
          <div className="grid md:grid-cols-3 gap-3">
            {config.capabilities.map((item, index) => {
              const Icon = capabilityIcons[index % capabilityIcons.length];
              const lead = index === 0;
              return (
                <motion.div key={item.title.en} whileHover={{ y: -5 }}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/60 p-6 flex flex-col transition hover:border-white/20 ${lead ? 'md:col-span-2 min-h-[240px]' : 'min-h-[240px]'}`}>
                  <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(160deg, transparent 55%, ${index % 2 ? config.secondary : config.accent}1a)` }} />
                  <div className="relative flex items-start justify-between">
                    <span className="eyebrow-mono text-gray-500">CAP / 0{index + 1}</span>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ color: config.accent, background: `${config.accent}14`, border: `1px solid ${config.accent}33` }}><Icon className="w-5 h-5" /></span>
                  </div>
                  <div className="relative mt-auto">
                    <h3 className={`${lead ? 'text-3xl' : 'text-xl'} text-white font-bold`} style={{ fontFamily: 'var(--font-display)' }}>{text(item.title)}</h3>
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-xl">{text(item.description)}</p>
                  </div>
                  <ArrowUpRight className="absolute bottom-5 right-5 w-4 h-4 text-gray-500 transition group-hover:text-white" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <ProductionHub config={config} lang={lang} />

      {detail && <SpotlightSection spotlight={detail.spotlight} {...theme} />}

      <section className="px-6 py-24 border-y border-white/5 bg-gray-950/40">
        <div className="max-w-7xl mx-auto">
          <SectionHead eyebrow={zh ? '内容场景与 AI 引擎' : 'Content modes & AI engines'} meta="PRESET STACK" accent={config.accent}
            title={zh ? '为这个领域预装最合适的生产能力' : 'The Right Production Stack, Preconfigured'} />
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-gray-900/60 p-6 md:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-7">
                <div><div className="eyebrow-mono text-gray-500">{zh ? '内容场景' : 'Content modes'}</div><div className="text-xl text-white font-bold mt-1">{zh ? '从模板快速启动' : 'Start From Proven Templates'}</div></div>
                <Layers className="w-6 h-6" style={{ color: config.accent }} />
              </div>
              <div className="flex-1 grid auto-rows-fr gap-3">
                {config.preset.contentModes.map((mode, index) => {
                  const entry = getContentMode(mode);
                  return (
                    <div key={mode} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
                      <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-black" style={{ color: config.accent, background: `${config.accent}14`, fontFamily: 'var(--font-display)' }}>0{index + 1}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-white font-semibold">{text(entry.name)}</div>
                        <div className="text-xs text-gray-400 mt-1 leading-relaxed">{text(entry.description)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gray-900/60 p-6 md:p-8">
              <div className="flex items-center justify-between mb-7">
                <div><div className="eyebrow-mono text-gray-500">{zh ? '推荐引擎' : 'Recommended engines'}</div><div className="text-xl text-white font-bold mt-1">{zh ? '按需组合的 AI 能力栈' : 'Composable AI Capability Stack'}</div></div>
                <Cpu className="w-6 h-6" style={{ color: config.secondary }} />
              </div>
              <div className="space-y-2">
                {config.preset.recommendedEngines.map((engine, index) => {
                  const entry = getEngine(engine);
                  return (
                    <div key={engine} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-mono" style={{ color: config.secondary, background: `${config.secondary}12` }}>E{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200">{text(entry.name)}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{text(entry.description)}</div>
                      </div>
                      <span className="eyebrow-mono hidden sm:inline" style={{ color: config.secondary }}>READY</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <SectionHead eyebrow={zh ? '业务流程' : 'Workflow'} meta={`STEPS / 0${config.workflow.length}`} accent={config.accent}
            title={zh ? '从 IP 定义到商业价值' : 'From IP Definition to Commercial Value'} />
          <ol className="relative grid md:grid-cols-5 gap-8 md:gap-4">
            <span aria-hidden className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px" style={{ background: `linear-gradient(90deg, ${config.accent}, ${config.secondary})`, opacity: .45 }} />
            {config.workflow.map((step, index) => (
              <motion.li key={step.en} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}
                className="relative flex md:flex-col items-center gap-4 md:gap-0 md:text-center">
                <span className="relative z-10 w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-sm font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${config.accent}, ${config.secondary})`, boxShadow: `0 0 0 6px var(--landing-bg), 0 10px 30px ${config.accent}35`, fontFamily: 'var(--font-display)' }}>
                  0{index + 1}
                </span>
                <div className="md:mt-5">
                  <div className="eyebrow-mono text-gray-500">STEP / 0{index + 1}</div>
                  <div className="text-base text-white font-semibold mt-1">{text(step)}</div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {detail && (
        <>
          <DayTimelineSection day={detail.day} name={text(config.name)} {...theme} />
          <DeliverablesSection deliverables={detail.deliverables} {...theme} />
          <ResultsSection results={detail.results} {...theme} />
        </>
      )}

      <IPCaseShowcase
        id="case"
        lang={lang}
        cases={cases}
        filters={caseFilters}
        eyebrow={{ zh: `${config.name.zh}案例`, en: `${config.name.en} Cases` }}
        title={showcaseCopy.title}
        subtitle={showcaseCopy.subtitle}
        accent={config.accent}
        secondary={config.secondary}
        cardAction={{ zh: '用此模板创建', en: 'Use this template' }}
        onCaseClick={onEnter}
        ctaLabel={{ zh: '用同类模板开始创建', en: 'Start From a Similar Template' }}
        onCta={onEnter}
      />

      {detail && <FaqSection faq={detail.faq} lang={lang} accent={config.accent} />}

      <section className="px-6 py-28 text-center border-t border-white/5">
        <Layers className="w-8 h-8 mx-auto mb-5" style={{ color: config.accent }} />
        <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{text(config.primaryCTA)}</h2>
        <p className="text-gray-500 mt-4">{zh ? '选择场景即可开始，AI 会按你的业务配置好内容模板与生产引擎。' : 'Pick your scenario and start — AI configures the right templates and engines for your business.'}</p>
        <button onClick={onEnter} className="mt-8 h-14 px-9 rounded-xl text-white font-bold inline-flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${config.accent}, ${config.secondary})` }}>
          {zh ? '立即开始创建' : 'Start Creating'} <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <LandingFooter lang={lang} accent={config.accent} onSelectSolution={onSelectSolution} onEnter={onEnter} />
    </div>
  );
};

export default SolutionLandingPage;
