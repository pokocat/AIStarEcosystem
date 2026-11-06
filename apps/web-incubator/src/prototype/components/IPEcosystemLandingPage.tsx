import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BarChart3, Building2, CheckCircle2,
  Crown, Film, Globe2, GraduationCap, Heart, Layers,
  MapPin, MessageCircle, Package, Radio, Rocket, Shield, ShoppingBag,
  Sparkles, Star, Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../translations';
import {
  IP_TYPE_TEMPLATES,
  PLATFORM_STATS,
  SOLUTION_CONFIGS,
  type IPTypeId,
  type SolutionId,
} from '../data/ipPlatform';
import { AnimatedArrow, MagneticCTA, TypewriterHighlight } from './HeroInteractions';
import { IPCaseShowcase, type ShowcaseFilter } from './IPCaseShowcase';
import { LandingMobileMenu } from './LandingMobileMenu';
import { LandingFooter } from './LandingFooter';
import { ECOSYSTEM_FAQ, ProductDemo, ScenarioPicker } from './EcosystemEnhancements';
import { FaqSection } from './SolutionDetailSections';
import { IPLifecycleJourney } from './IPLifecycleJourney';
import { SHOWCASE_CASES, SHOWCASE_GROUP_LABELS, SOLUTION_GROUP, type ShowcaseGroup } from '../data/ipShowcaseCases';

interface Props {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onEnter: () => void;
  onSelectSolution: (id: SolutionId) => void;
}

const typeMeta: Record<IPTypeId, { icon: React.ComponentType<{ className?: string }>; solution: SolutionId; color: string; count: string }> = {
  entertainment: { icon: Star, solution: 'ai-artist', color: '#ec4899', count: '1,200+' },
  'virtual-idol': { icon: Sparkles, solution: 'virtual-idol', color: '#a855f7', count: '800+' },
  corporate: { icon: Building2, solution: 'corporate-ip', color: '#3b82f6', count: '500+' },
  brand: { icon: Package, solution: 'brand-ip', color: '#14b8a6', count: '600+' },
  anime: { icon: Film, solution: 'anime-ip', color: '#8b5cf6', count: '900+' },
  city: { icon: MapPin, solution: 'city-ip', color: '#22c55e', count: '300+' },
  founder: { icon: Crown, solution: 'digital-founder', color: '#f59e0b', count: '400+' },
  culture: { icon: Layers, solution: 'culture-ip', color: '#f97316', count: '350+' },
  education: { icon: GraduationCap, solution: 'education-ip', color: '#4f46e5', count: '700+' },
  social: { icon: MessageCircle, solution: 'social-ip', color: '#06b6d4', count: '1,000+' },
};

// 7 cards with the 1st and 6th spanning two columns fill a balanced 3-column grid (2+1 / 1+1+1 / 2+1).
const featuredSolutions: SolutionId[] = ['ai-artist', 'ai-drama', 'story-commerce', 'digital-founder', 'city-ip', 'virtual-idol', 'corporate-ip'];

const fallbackSolution = {
  name: { zh: 'AI 艺人孵化', en: 'AI Artist Incubation' },
  description: { zh: '孵化 AI 艺人，生产音乐、影视和全娱乐内容，运营艺人矩阵。', en: 'Incubate AI artists and operate music, film and full-entertainment content matrices.' },
  accent: '#a855f7',
  secondary: '#06b6d4',
  image: 'https://images.unsplash.com/photo-1767661667474-4f2a197c9a51?auto=format&fit=crop&w=1000&q=85',
};

const showcaseFilters: ShowcaseFilter[] = (Object.keys(SHOWCASE_GROUP_LABELS) as ShowcaseGroup[]).map(group => ({
  id: group,
  label: SHOWCASE_GROUP_LABELS[group],
  match: item => SOLUTION_GROUP[item.solution] === group,
}));

const solutionAccent = (id: SolutionId) =>
  id === 'ecosystem' || id === 'ai-artist' ? fallbackSolution.accent : SOLUTION_CONFIGS[id].accent;

export const IPEcosystemLandingPage = ({ lang, setLang, onEnter, onSelectSolution }: Props) => {
  const zh = lang === 'zh';
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { href: '#ip-types', label: zh ? 'IP 类型' : 'IP Types' },
    { href: '#solutions', label: zh ? '解决方案' : 'Solutions' },
    { href: '#product', label: zh ? '产品演示' : 'Product' },
    { href: '#cases', label: zh ? '案例' : 'Cases' },
  ];
  const t = <T extends { zh: string; en: string }>(value: T) => value[lang];
  const heroPhrases = [
    { zh: '定义你的 IP 帝国。', en: 'Define Your IP Empire.' },
    { zh: '孵化多元数字 IP。', en: 'Incubate Diverse Digital IP.' },
    { zh: '连接内容与商业价值。', en: 'Connect Content and Business Value.' },
  ];

  return (
    <div className="homepage-dark min-h-screen bg-black text-white overflow-x-hidden" style={{ fontFamily: 'var(--font-sans)' }}>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>AI Star Eco</span>
            <span className="hidden sm:inline text-xs text-cyan-300 border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 rounded-full">IP ECOSYSTEM v3.0</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="hover:text-white transition">{link.label}</a>
            ))}
            <button onClick={onEnter} className="h-9 px-4 rounded-full text-white font-semibold bg-gradient-to-r from-cyan-500 to-purple-600">{zh ? '进入平台' : 'Enter Platform'}</button>
          </div>
          <LandingMobileMenu
            open={menuOpen}
            onToggle={setMenuOpen}
            links={navLinks}
            lang={lang}
            setLang={setLang}
            enterLabel={zh ? '进入平台' : 'Enter Platform'}
            onEnter={onEnter}
            gradient="linear-gradient(135deg, #06b6d4, #9333ea)"
          />
        </div>
      </nav>

      <header id="top" className="relative min-h-screen px-6 pt-24 flex items-center overflow-hidden">
        <img src="https://images.unsplash.com/photo-1644088379091-d574269d422f?auto=format&fit=crop&w=2200&q=90" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(168,85,247,.18),transparent_32%)]" />
        <motion.div animate={{ y: [0, -14, 0], rotate: [0, 6, -5, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute top-[20%] right-[15%] text-cyan-400/30"><Sparkles className="w-9 h-9" /></motion.div>
        <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute bottom-[28%] right-[26%] text-purple-400/25"><Star className="w-7 h-7" /></motion.div>
        <div className="absolute bottom-[11%] inset-x-0 overflow-hidden opacity-[0.04]">
          <motion.div animate={{ x: [0, -1400] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="whitespace-nowrap text-[110px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
            CREATE YOUR IP EMPIRE · ONE MODEL · TEN TEMPLATES · CREATE YOUR IP EMPIRE ·
          </motion.div>
        </div>
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 border border-cyan-500/35 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 text-xs text-cyan-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {zh ? '全球领先的 AI IP 生态平台' : 'A Full-Stack AI IP Ecosystem'}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="text-6xl md:text-8xl lg:text-[96px] font-black tracking-tighter leading-[.98]" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '创造未来。' : 'Create the Future.'}<br />
            <TypewriterHighlight phrases={heroPhrases} lang={lang} gradient="linear-gradient(90deg, #22d3ee, #a855f7, #ec4899)" />
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .28 }} className="max-w-3xl mt-8 text-base md:text-lg text-gray-300 leading-relaxed">
            {zh
              ? '从 AI 艺人、短剧角色和品牌 IP，到城市代言人、数字创始人与 AI 导师——十种 IP 类型，共用一套生产、分发、授权与商业化系统。'
              : 'From AI artists, drama characters and brand IP to city ambassadors, digital founders and AI tutors — ten IP types powered by one production, distribution, licensing and monetization system.'}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }} className="mt-10 flex flex-wrap gap-4">
            <MagneticCTA onClick={() => document.querySelector('#ip-types')?.scrollIntoView({ behavior: 'smooth' })} className="h-14 px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold shadow-[0_16px_50px_rgba(6,182,212,.2)]">
              {zh ? '选择我的 IP 类型' : 'Choose My IP Type'} <AnimatedArrow className="w-4 h-4" />
            </MagneticCTA>
            <motion.a href="#cases" whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: .98 }} className="h-14 px-8 rounded-xl border border-white/20 bg-black/30 backdrop-blur text-gray-200 flex items-center gap-2 hover:border-white/40 transition">
              {zh ? '查看 IP 案例' : 'Explore IP Cases'} <ArrowUpRight className="w-4 h-4" />
            </motion.a>
          </motion.div>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-y-4 max-w-3xl">
            {[
              [PLATFORM_STATS.creators.short, zh ? 'IP 创作者' : 'IP Creators'],
              [PLATFORM_STATS.assets.short, zh ? 'IP 内容资产' : 'IP Assets'],
              [PLATFORM_STATS.ipTypes, zh ? '种 IP 类型' : 'IP Types'],
              [PLATFORM_STATS.channels, zh ? '分发与商业渠道' : 'Channels'],
            ].map(([value, label], index) => (
              <div key={label} className={`py-3 min-w-0 ${index % 2 === 1 ? 'pl-6' : ''} ${index > 0 ? 'md:pl-6 md:border-l border-white/10' : ''}`}>
                <div className="text-2xl md:text-4xl font-black bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>{value}</div>
                <div className="text-xs text-gray-500 mt-2">{label}</div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </header>

      <ScenarioPicker lang={lang} onSelectSolution={onSelectSolution} />

      <section id="ip-types" className="relative px-6 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <div className="text-xs text-purple-400 uppercase tracking-[.24em] mb-4">{zh ? '十种 IP 类型模板' : '10 IP TYPE TEMPLATES'}</div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '你的影响力，可以从这里开始' : 'Every Kind of Influence Starts Here'}</h2>
            <p className="text-gray-500 mt-5">{zh ? '选择最贴近你的 IP 类型，查看专属方案、标杆案例与创作模板。' : 'Pick the IP type closest to you to explore tailored solutions, cases and templates.'}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {IP_TYPE_TEMPLATES.map((item, index) => {
              const meta = typeMeta[item.id];
              const Icon = meta.icon;
              return (
                <motion.button key={item.id} onClick={() => onSelectSolution(meta.solution)} whileHover={{ y: -6 }} className="group min-h-[210px] rounded-2xl p-5 text-left relative overflow-hidden"
                  style={{ background: 'linear-gradient(145deg, rgba(16,23,38,.92), rgba(5,8,14,.98))', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ color: '#fff', background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)`, boxShadow: `0 12px 30px ${meta.color}20` }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="mt-7 text-base text-white font-bold">{t(item.name)}</div>
                  <div className="text-xs text-gray-500 mt-2 leading-relaxed">{t(item.description)}</div>
                  <div className="absolute left-5 bottom-4 flex items-center gap-2 text-xs" style={{ color: meta.color }}>
                    {meta.count} {zh ? '项目案例' : 'projects'} <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="solutions" className="px-6 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <div className="text-xs text-pink-400 uppercase tracking-[.24em] mb-4">{zh ? '垂直解决方案' : 'VERTICAL SOLUTIONS'}</div>
              <h2 className="text-4xl md:text-6xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '深入每一种真实业务场景' : 'Built for Real Business Scenarios'}</h2>
            </div>
            <p className="text-xs text-gray-500 max-w-sm">{zh ? '覆盖娱乐、企业、品牌与城市等场景，每个方案都有专属工作流与标杆案例。' : 'Entertainment, business, brand and city scenarios, each with dedicated workflows and featured cases.'}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {featuredSolutions.map((id, index) => {
              const config = id === 'ai-artist' ? fallbackSolution : SOLUTION_CONFIGS[id as Exclude<SolutionId, 'ecosystem' | 'ai-artist'>];
              return (
                <motion.button key={id} onClick={() => onSelectSolution(id)} whileHover={{ y: -5 }} className={`${index === 0 || index === 5 ? 'md:col-span-2' : ''} h-[330px] rounded-3xl overflow-hidden relative group text-left border border-white/10`}>
                  <img src={config.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-transparent" />
                  <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, transparent, ${config.accent}50)` }} />
                  <div className="relative h-full p-6 flex flex-col">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ color: config.accent, background: `${config.accent}18`, border: `1px solid ${config.accent}35` }}>
                      {index === 0 ? <Star className="w-5 h-5" /> : index === 1 ? <Film className="w-5 h-5" /> : index === 2 ? <ShoppingBag className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    </div>
                    <div className="mt-auto">
                      <h3 className="text-2xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{t(config.name)}</h3>
                      <p className="text-xs text-gray-400 mt-2 max-w-lg line-clamp-2">{t(config.description)}</p>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-xs" style={{ color: config.accent }}>{zh ? '了解方案' : 'Explore solution'} <ArrowRight className="w-3 h-3" /></div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <ProductDemo lang={lang} />

      <IPLifecycleJourney lang={lang} onSelectSolution={onSelectSolution} />

      <IPCaseShowcase
        id="cases"
        lang={lang}
        cases={SHOWCASE_CASES}
        filters={showcaseFilters}
        eyebrow={{ zh: 'IP 明星展示', en: 'IP Showcase' }}
        title={{ zh: '看看这些令人惊艳的 IP', en: 'Meet Some Remarkable IPs' }}
        subtitle={{ zh: '由全球创作者使用 AI Star Eco 打造的精彩 IP', en: 'Created by creators worldwide with AI Star Eco' }}
        accent="#a855f7"
        secondary="#ec4899"
        getAccent={item => solutionAccent(item.solution)}
        initialLimit={8}
        cardAction={{ zh: '查看该方案', en: 'View solution' }}
        onCaseClick={item => onSelectSolution(item.solution)}
        ctaLabel={{ zh: '查看全部 IP 展示', en: 'View All IP Showcases' }}
      />

      <section className="px-6 py-28 border-y border-white/5 bg-gray-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-xs text-cyan-400 uppercase tracking-[.24em] mb-4">{zh ? '三端协同生态' : 'THREE-PORT ECOSYSTEM'}</div>
            <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '共同创造、管理与放大 IP 价值' : 'Create, Govern and Grow IP Value Together'}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Rocket, titleZh: '生态创业者工作台', titleEn: 'Creator Workspace', descZh: '创建 IP、生产内容、运营矩阵并完成商业变现。', descEn: 'Create IP, produce content, operate matrices and monetize.', color: '#06b6d4' },
              { icon: Crown, titleZh: '明星与权利方端', titleEn: 'Celebrity & Rights Portal', descZh: '管理授权、素材、合同、审核与收益分配。', descEn: 'Manage licensing, assets, contracts, review and revenue.', color: '#a855f7' },
              { icon: Heart, titleZh: '星海粉丝端', titleEn: 'StarSea Fan App', descZh: '发现 IP、观看内容、参与互动并收藏数字资产。', descEn: 'Discover IP, enjoy content, interact and collect digital assets.', color: '#ec4899' },
            ].map((item, index) => (
              <motion.div key={item.titleEn} whileHover={{ y: -5 }} className="rounded-3xl border border-white/10 bg-black/35 p-7 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }} />
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ color: item.color, background: `${item.color}14`, border: `1px solid ${item.color}30` }}><item.icon className="w-6 h-6" /></div>
                  <span className="text-xs text-gray-500 font-mono">PORT 0{index + 1}</span>
                </div>
                <h3 className="text-xl text-white font-bold mt-10">{zh ? item.titleZh : item.titleEn}</h3>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">{zh ? item.descZh : item.descEn}</p>
                <div className="mt-7 flex items-center gap-2 text-xs" style={{ color: item.color }}><Radio className="w-3 h-3" /> {zh ? '三端数据实时互通' : 'Data synced across portals'}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FaqSection faq={ECOSYSTEM_FAQ} lang={lang} accent="#22d3ee" />

      <section className="px-6 py-28 border-t border-white/5 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(168,85,247,.16),transparent_45%)]" />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-400 uppercase tracking-[.24em] mb-5"><CheckCircle2 className="w-4 h-4" /> {zh ? '统一系统，开放生态' : 'ONE SYSTEM, OPEN ECOSYSTEM'}</div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '选择你的 IP，开始创造。' : 'Choose Your IP. Start Creating.'}</h2>
          <p className="text-gray-500 mt-5">{zh ? '进入生态创业者、明星 IP 或粉丝端，共同参与 IP 的创造、运营与价值增长。' : 'Enter the creator, celebrity IP or fan portal to create, operate and grow IP value together.'}</p>
          <button onClick={onEnter} className="mt-9 h-14 px-9 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold inline-flex items-center gap-2">
            {zh ? '进入 AI IP 生态平台' : 'Enter AI IP Ecosystem'} <Rocket className="w-4 h-4" />
          </button>
        </div>
      </section>

      <LandingFooter lang={lang} accent="#22d3ee" onSelectSolution={onSelectSolution} onEnter={onEnter} />
    </div>
  );
};

export default IPEcosystemLandingPage;
