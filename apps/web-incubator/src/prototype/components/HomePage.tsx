import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, ArrowRight, Globe as GlobeIcon, Layers, Music, Users, Zap,
  Rocket, Crown, TrendingUp, Shield, Play, Star, ChevronRight, Cpu,
  BarChart3, Heart, Award, Mic2, Video, ShoppingBag, Headphones,
  Gamepad, GraduationCap, Film, Tv, Mic, Menu, X, ArrowUpRight,
  CheckCircle2, Target, Flame, Eye, Lock, Globe2, Radio, Coins
} from 'lucide-react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { motion, useScroll, useTransform, useInView, AnimatePresence, useMotionValue, useSpring } from "motion/react";
import { TRANSLATIONS, type Lang } from "../translations";
import { PLATFORM_STATS } from "../data/ipPlatform";
import { ENTERTAINMENT_LAYERS as IP_TYPES } from "../data/entertainmentLayers";
import { EntertainmentGalaxy } from "./EntertainmentGalaxy";
import { ArtistProfilePreview, IncubationPath, OperationsDashboard } from "./ArtistEnhancements";
import { ArtistSystemRadar, FaqShowcase, RoadmapBeam, TechConstellation, TestimonialSpotlight, ThreePortFlywheel, WorkflowPipeline } from "./ArtistShowcaseSections";

/* ======== Particle Background ======== */
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const pts: { x: number; y: number; vx: number; vy: number; s: number; c: string }[] = [];
    for (let i = 0; i < 90; i++) {
      pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, s: Math.random() * 2 + .5, c: Math.random() > .5 ? 'cyan' : 'purple' });
    }
    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = p.c === 'cyan' ? 'rgba(6,182,212,.35)' : 'rgba(147,51,234,.35)'; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(p.x - pts[j].x, p.y - pts[j].y);
          if (d < 110) { ctx.beginPath(); ctx.strokeStyle = `rgba(147,51,234,${.1 * (1 - d / 110)})`; ctx.moveTo(p.x, p.y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
        }
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(id); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

/* ======== Animated Counter ======== */
const Counter = ({ target, suffix = '' }: { target: number; suffix?: string }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const dur = 2200, t0 = Date.now();
    const tick = () => { const p = Math.min((Date.now() - t0) / dur, 1); setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(tick); };
    tick();
  }, [inView, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

/* ======== ScrollSection ======== */
const Section = ({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) => {
  const ref = useRef(null);
  const iv = useInView(ref, { once: true, margin: "-80px" });
  return <motion.section ref={ref} id={id} initial={{ opacity: 0, y: 50 }} animate={iv ? { opacity: 1, y: 0 } : {}} transition={{ duration: .7, ease: "easeOut" }} className={className}>{children}</motion.section>;
};

/* ======== Floating Icon ======== */
const Float = ({ icon: I, className, delay = 0 }: { icon: any; className: string; delay?: number }) => (
  <motion.div animate={{ y: [0, -14, 0], rotate: [0, 6, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, delay, ease: "easeInOut" }} className={className}><I className="w-full h-full" /></motion.div>
);

/* ======== Glow Card ======== */
const GlowCard = ({ children, color = 'cyan', delay = 0 }: { children: React.ReactNode; color?: string; delay?: number }) => {
  const ref = useRef(null);
  const iv = useInView(ref, { once: true });
  const bc = color === 'cyan' ? 'border-cyan-500/20 hover:border-cyan-400/60' : color === 'purple' ? 'border-purple-500/20 hover:border-purple-400/60' : color === 'pink' ? 'border-pink-500/20 hover:border-pink-400/60' : 'border-amber-500/20 hover:border-amber-400/60';
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 35, scale: .96 }} animate={iv ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ duration: .55, delay }} whileHover={{ scale: 1.04, y: -6 }}
      className={`bg-gray-900/60 backdrop-blur-sm border ${bc} rounded-xl p-6 transition-shadow duration-300 hover:shadow-xl hover:shadow-cyan-500/5`}>{children}</motion.div>
  );
};

/* ======== Magnetic cursor hover for CTA ======== */
const MagneticButton = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <motion.button ref={ref} style={{ x: sx, y: sy }} onClick={onClick}
      onMouseMove={e => { const r = ref.current?.getBoundingClientRect(); if (r) { x.set((e.clientX - r.left - r.width / 2) * .15); y.set((e.clientY - r.top - r.height / 2) * .15); } }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className={className}>{children}</motion.button>
  );
};

/* ======== Data ======== */
const DOMAINS = [
  { icon: Music, zh: '音乐', en: 'Music', descZh: '声音生成 · 数字专辑', descEn: 'Sound generation · Digital albums', color: 'text-cyan-300', accent: 'from-cyan-500/70', image: '/images/scene-artist-incubation.webp', featured: true },
  { icon: Film, zh: '影视', en: 'Film & TV', descZh: 'AI短剧 · 虚拟制片', descEn: 'AI drama · Virtual production', color: 'text-purple-300', accent: 'from-purple-500/70', image: '/images/scene-film.webp' },
  { icon: ShoppingBag, zh: '商业代言', en: 'Endorsement', descZh: '品牌共创 · 智能植入', descEn: 'Brand co-creation · Smart placement', color: 'text-pink-300', accent: 'from-pink-500/70', image: '/images/scene-endorsement.webp' },
  { icon: Tv, zh: '综艺节目', en: 'Variety Show', descZh: '虚拟主持 · 互动内容', descEn: 'Virtual hosts · Interactive content', color: 'text-amber-300', accent: 'from-amber-500/70', image: '/images/scene-variety.webp' },
  { icon: Mic, zh: '曲艺表演', en: 'Performing Arts', descZh: '数字传承 · 创新演绎', descEn: 'Digital heritage · New expression', color: 'text-emerald-300', accent: 'from-emerald-500/70', image: '/images/scene-performing-arts.webp' },
  { icon: Star, zh: '舞台表演', en: 'Stage', descZh: '虚拟演唱会 · 沉浸舞台', descEn: 'Virtual concert · Immersive stage', color: 'text-red-300', accent: 'from-red-500/70', image: '/images/scene-stage.webp', featured: true },
  { icon: Radio, zh: '直播互动', en: 'Live Interaction', descZh: '虚拟直播 · 粉丝实时互动', descEn: 'Virtual livestreams · Real-time fan chat', color: 'text-blue-300', accent: 'from-blue-500/70', image: '/images/scene-live.webp' },
  { icon: Gamepad, zh: '游戏娱乐', en: 'Gaming', descZh: '数字角色 · 互动世界', descEn: 'Digital characters · Interactive worlds', color: 'text-indigo-300', accent: 'from-indigo-500/70', image: '/images/scene-gaming.webp' },
  { icon: Radio, zh: '剧情带货', en: 'Story Commerce', descZh: 'AI剧情 · 商品软植入 · 内容转化', descEn: 'AI stories · Product placement · Conversion', color: 'text-orange-300', accent: 'from-orange-500/70', image: '/images/scene-story-commerce.webp' },
  { icon: Crown, zh: '数字主理人', en: 'Digital Founder', descZh: '厂牌主理人 · 制作人数字分身', descEn: 'Label founders · Producer avatars', color: 'text-teal-300', accent: 'from-teal-500/70', image: '/images/scene-digital-founder.webp' },
];

const STATS = [
  { v: 100000, s: '+', zh: '生态创业者', en: 'Creators', c: 'text-cyan-400', icon: Users },
  { v: 5000000, s: '+', zh: '作品产出', en: 'Works Created', c: 'text-purple-400', icon: Music },
  { v: 150, s: '+', zh: '分发平台', en: 'Platforms', c: 'text-pink-400', icon: Globe2 },
  { v: 10, s: '', zh: '娱乐领域', en: 'Domains', c: 'text-amber-400', icon: Layers },
  { v: 50000, s: '+', zh: 'NFT铸造', en: 'NFTs Minted', c: 'text-green-400', icon: Coins },
  { v: 99.9, s: '%', zh: '系统可用性', en: 'Uptime', c: 'text-red-400', icon: Shield },
];

// Channel categories (not named partners) — avoids implying unverified partnerships.
const PARTNERS_ZH = ['音乐流媒体', '短视频平台', '长视频平台', '直播平台', '社交媒体', '电商平台', '播客电台', '数字藏品'];
const PARTNERS_EN = ['Music Streaming', 'Short Video', 'Long-form Video', 'Live Streaming', 'Social Media', 'E-commerce', 'Podcasts', 'Digital Collectibles'];

/* ======== MAIN COMPONENT ======== */
export const HomePage = ({ onEnter, onHome, lang, setLang }: { onEnter: () => void; onHome?: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang];
  const zh = lang === 'zh';
  const { scrollYProgress } = useScroll();
  const navOpacity = useTransform(scrollYProgress, [0, 0.03], [0, 1]);
  const [activeIP, setActiveIP] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [typedText, setTypedText] = useState('A');
  const heroWords = zh ? ['AI 明星', '虚拟偶像', '娱乐矩阵', '数字娱乐帝国'] : ['AI Star', 'Virtual Idol', 'Entertainment Matrix', 'Digital Entertainment Empire'];
  const longestHeroWord = heroWords.reduce((longest, word) => word.length > longest.length ? word : longest, '');
  const [wordIdx, setWordIdx] = useState(0);
  const visibleIPCases = [0, 1, 2].map(offset => IP_TYPES[(activeIP + offset) % IP_TYPES.length]);

  // Typewriter effect for hero
  useEffect(() => {
    const word = heroWords[wordIdx];
    let index = 1;
    let typeTimer: number | undefined;
    let pauseTimer: number | undefined;
    setTypedText(word.slice(0, 1));

    const typeNext = () => {
      if (index <= word.length) {
        setTypedText(word.slice(0, index));
        index += 1;
        typeTimer = window.setTimeout(typeNext, 120);
        return;
      }
      pauseTimer = window.setTimeout(() => setWordIdx(current => (current + 1) % heroWords.length), 2000);
    };

    typeTimer = window.setTimeout(typeNext, 120);
    return () => {
      if (typeTimer) window.clearTimeout(typeTimer);
      if (pauseTimer) window.clearTimeout(pauseTimer);
    };
  }, [wordIdx, lang]);

  return (
    <div className="homepage-dark min-h-screen bg-black text-white relative overflow-x-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      <ParticleBackground />

      {/* ===== STICKY NAV ===== */}
      <motion.nav style={{ backgroundColor: useTransform(navOpacity, v => `rgba(0,0,0,${v * .85})`) }} className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-cyan-500/10 backdrop-blur-lg">
        <motion.button type="button" onClick={() => (onHome ? onHome() : window.scrollTo({ top: 0, behavior: 'smooth' }))} aria-label={zh ? '返回 AI IP 生态首页' : 'Back to AI IP Ecosystem'} className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent" style={{ fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>AI Star Eco</span>
        </motion.button>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-5">
          {[
            { href: '#features', label: t.nav.features },
            { href: '#domains', label: zh ? '十大领域' : 'Domains' },
            { href: '#artist-system', label: zh ? '角色 IP' : 'Role IPs' },
            { href: '#ip-universe', label: zh ? '娱乐生态' : 'Entertainment' },
            { href: '#ecosystem', label: t.nav.ecosystem },
            { href: '#incubation-path', label: zh ? '孵化路线' : 'Incubation' },
            { href: '#faq', label: 'FAQ' },
          ].map((n, i) => (
            <a key={i} href={n.href} className="text-gray-400 hover:text-white transition text-sm font-light tracking-wide relative group">
              {n.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
          <Button onClick={onEnter} size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90">{t.nav.enter}</Button>
        </div>
        {/* Mobile hamburger */}
        <button className="md:hidden text-white" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-14 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 flex flex-col gap-4 md:hidden">
            {onHome && (
              <button type="button" onClick={() => { setMobileMenu(false); onHome(); }} className="text-left text-gray-300 hover:text-white py-2">{zh ? '全部方案' : 'All Solutions'}</button>
            )}
            {[
              { id: 'features', label: t.nav.features },
              { id: 'domains', label: zh ? '十大领域' : 'Domains' },
              { id: 'artist-system', label: zh ? '角色 IP' : 'Role IPs' },
              { id: 'showcase', label: zh ? '产品演示' : 'Product Demo' },
              { id: 'ip-universe', label: zh ? '娱乐生态' : 'Entertainment' },
              { id: 'ecosystem', label: t.nav.ecosystem },
              { id: 'incubation-path', label: zh ? '孵化路线' : 'Incubation' },
              { id: 'faq', label: 'FAQ' },
            ].map(item => (
              <a key={item.id} href={`#${item.id}`} onClick={() => setMobileMenu(false)} className="text-gray-300 hover:text-white py-2">{item.label}</a>
            ))}
            <Button onClick={() => { setMobileMenu(false); onEnter(); }} className="bg-gradient-to-r from-cyan-500 to-purple-600">{t.nav.enter}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 1. HERO ===== */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        <div className="absolute top-[12%] right-[-8%] w-[700px] h-[700px] bg-gradient-to-b from-purple-800/25 to-cyan-800/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[5%] left-[-12%] w-[550px] h-[550px] bg-gradient-to-t from-cyan-800/20 to-purple-800/15 rounded-full blur-[100px] pointer-events-none" />
        <Float icon={Music} className="absolute top-[22%] right-[14%] w-8 h-8 text-cyan-500/20" delay={0} />
        <Float icon={Star} className="absolute top-[38%] right-[26%] w-6 h-6 text-purple-500/20" delay={1} />
        <Float icon={Zap} className="absolute bottom-[28%] right-[8%] w-10 h-10 text-pink-500/15" delay={2} />
        <Float icon={Crown} className="absolute top-[55%] left-[6%] w-7 h-7 text-amber-500/15" delay={1.5} />
        <Float icon={Heart} className="absolute top-[18%] left-[18%] w-5 h-5 text-pink-500/15" delay={3} />

        {/* Horizontal scrolling text decoration */}
        <div className="absolute bottom-[15%] left-0 right-0 overflow-hidden opacity-[0.03] pointer-events-none">
          <motion.div animate={{ x: [0, -1500] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="whitespace-nowrap text-[120px] uppercase tracking-widest font-black" style={{ fontFamily: "var(--font-display)" }}>
            AI STAR ECO · INCUBATE YOUR EMPIRE · BREAK THE DIMENSION · AI STAR ECO · INCUBATE YOUR EMPIRE ·
          </motion.div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl space-y-8">
            <motion.div initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .5 }}>
              <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30 text-xs px-4 py-1.5 gap-2 font-medium uppercase tracking-wider">
                <motion.span animate={{ opacity: [1, .4, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {t.hero.badge}
              </Badge>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .1 }} className="text-5xl sm:text-6xl md:text-8xl leading-[1.05] font-black tracking-tighter" style={{ fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
              {t.hero.title1}<br />
              <span className="inline-grid">
                <span aria-hidden className="invisible [grid-area:1/1]">{longestHeroWord}<span className="ml-0.5">|</span></span>
                <span className="[grid-area:1/1]">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">
                    {typedText}
                  </span>
                  <motion.span aria-hidden animate={{ opacity: [1, 0] }} transition={{ duration: .6, repeat: Infinity }} className="text-cyan-400 ml-0.5">|</motion.span>
                </span>
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .3 }} className="text-base sm:text-lg text-gray-400 max-w-2xl leading-relaxed font-light">
              {t.hero.desc}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .5 }} className="flex flex-wrap gap-4">
              <MagneticButton onClick={onEnter} className="h-14 px-8 text-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white rounded-lg inline-flex items-center gap-2 cursor-pointer">
                {t.hero.cta_primary}
                <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><ArrowRight className="w-5 h-5" /></motion.span>
              </MagneticButton>
              <Button variant="outline" size="lg" onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })} className="h-14 px-8 text-lg border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                <Play className="w-5 h-5 mr-2" /> {t.hero.cta_secondary}
              </Button>
            </motion.div>

            {/* Mini stats inline */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .8 }} className="flex flex-wrap gap-8 pt-6">
              {[{ n: PLATFORM_STATS.creators.short, l: zh ? '创业者' : 'Creators' }, { n: PLATFORM_STATS.assets.short, l: zh ? '作品' : 'Works' }, { n: '10', l: zh ? '大领域' : 'Domains' }].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * .15 }}>
                  <div className="text-2xl text-cyan-400 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{s.n}</div>
                  <div className="text-xs text-gray-500 font-light">{s.l}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" animate={{ y: [0, 8, 0], opacity: [.3, 1, .3] }} transition={{ duration: 2.5, repeat: Infinity }}>
          <span className="text-xs text-gray-600">{zh ? '向下探索' : 'Explore'}</span>
          <div className="w-5 h-8 rounded-full border border-gray-700 flex justify-center pt-1.5">
            <motion.div className="w-1 h-1 rounded-full bg-cyan-400" animate={{ y: [0, 14, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
          </div>
        </motion.div>
      </section>

      {/* ===== 2. STATS MARQUEE ===== */}
      <Section className="relative z-10 py-20 px-6 border-y border-white/5">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {STATS.map((s, i) => {
              const SIcon = s.icon;
              return (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08, duration: .5 }}
                whileHover={{ scale: 1.08 }}
                className="text-center bg-gray-900/30 border border-white/5 rounded-xl p-5 hover:border-cyan-500/20 transition-all">
                <SIcon className={`w-5 h-5 mx-auto mb-2 ${s.c} opacity-60`} />
                <div className={`text-3xl font-extrabold tracking-tight ${s.c}`} style={{ fontFamily: "var(--font-display)" }}><Counter target={s.v} suffix={s.s} /></div>
                <div className="text-xs text-gray-500 mt-1 font-light">{zh ? s.zh : s.en}</div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      <WorkflowPipeline lang={lang} tag={t.workflow.tag} title={t.workflow.title} desc={t.workflow.desc} steps={t.workflow.steps} />

      <ArtistProfilePreview lang={lang} onEnter={onEnter} />

      {/* ===== 4. TEN DOMAINS ===== */}
      <Section id="domains" className="relative z-10 py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(6,182,212,0.1),transparent_32%),radial-gradient(circle_at_85%_70%,rgba(168,85,247,0.1),transparent_34%)] pointer-events-none" />
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-12 max-w-6xl mx-auto">
            <div className="max-w-3xl">
            <Badge className="bg-amber-900/30 text-amber-400 border-amber-500/30 mb-4">{zh ? '全领域覆盖' : 'Full Coverage'}</Badge>
              <h2 className="text-4xl md:text-6xl mb-5 font-extrabold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>{zh ? '10大娱乐领域，无限可能' : '10 Entertainment Domains, Infinite Possibilities'}</h2>
              <p className="text-base text-gray-400/80 max-w-2xl font-light">{zh ? '从音乐、游戏到剧情带货与数字创始人，让每一种灵感都有专属的 AI 内容生产线。' : 'From music and gaming to story commerce and digital founders, every idea gets its own AI-powered production line.'}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 uppercase tracking-[0.24em]">
              <span className="w-12 h-px bg-cyan-400/60" />
              {zh ? '探索产业版图' : 'Explore the landscape'}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {DOMAINS.map((d, i) => {
              const DIcon = d.icon;
              return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 25, rotateY: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * .07 }}
                whileHover={{ y: -7 }}
                className={`${d.featured ? 'md:col-span-2' : ''} h-72 border border-white/10 hover:border-white/30 rounded-2xl cursor-pointer transition-all group relative overflow-hidden bg-gray-900`}>
                <img src={d.image} alt={zh ? `${d.zh}领域视觉` : `${d.en} domain`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
                <div className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t ${d.accent} via-transparent to-transparent opacity-30 group-hover:opacity-50 transition-opacity duration-500`} />
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="text-xs font-mono text-white/60 tracking-[0.22em]">DOMAIN / {String(i + 1).padStart(2, '0')}</span>
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center">
                    <DIcon className={`w-5 h-5 ${d.color}`} />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl text-white font-bold tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>{zh ? d.zh : d.en}</h3>
                      <p className="text-xs text-white/60 font-light">{zh ? d.descZh : d.descEn}</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      <ArtistSystemRadar lang={lang} onEnter={onEnter} />
      <IncubationPath lang={lang} />

      {/* ===== 5. BENTO SHOWCASE ===== */}
      <Section id="showcase" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,.04) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[760px] h-[420px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 max-w-6xl mx-auto">
            <div className="max-w-3xl">
              <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30 mb-4">{zh ? 'AI 内容生产中枢' : 'AI Content Command Center'}</Badge>
              <h2 className="text-4xl md:text-6xl mb-5 font-extrabold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
                {zh ? '一站式 AI 娱乐基础设施' : 'All-in-One AI Entertainment Infrastructure'}
              </h2>
              <p className="text-gray-400/80 max-w-2xl leading-relaxed font-light">
                {zh ? '把创意、数字角色、内容生成、矩阵分发与商业变现连接成一条持续运转的生产线。' : 'Connect ideas, digital characters, content generation, matrix distribution and monetization into one always-on production line.'}
              </p>
            </div>
            <button onClick={onEnter} className="group shrink-0 inline-flex items-center gap-2 text-sm text-cyan-300 border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/40 rounded-full px-5 py-2.5 transition-all">
              {zh ? '进入 AI 创作中枢' : 'Enter AI Command Center'}
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 max-w-6xl mx-auto">
            {/* Production command center */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} whileHover={{ y: -3 }}
              className="md:col-span-8 md:row-span-2 min-h-[520px] border border-cyan-500/20 rounded-3xl overflow-hidden group relative bg-gray-900/60">
              <img src="/images/scene-production-center.webp" alt={zh ? 'AI 内容生产中枢' : 'AI content production center'} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-br from-gray-950/95 via-gray-950/85 to-cyan-950/60" />
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(103,232,249,.35) 1px, transparent 0)', backgroundSize: '22px 22px' }} />

              <div className="relative h-full p-6 md:p-8 flex flex-col">
                <div className="flex items-start justify-between gap-6 mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                      <span className="text-xs text-emerald-300 font-mono tracking-[0.2em] uppercase">{zh ? '生产线运行中' : 'Production line live'}</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl text-white font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {zh ? 'AI 内容生产中枢' : 'AI Content Production Hub'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-2 max-w-lg">{zh ? '一个工作台，调度全域娱乐内容的生产与增长。' : 'One workspace orchestrating production and growth across entertainment.'}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <Cpu className="w-4 h-4 text-cyan-300" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase">AI Cluster</div>
                      <div className="text-xs text-white font-mono">98.7% ONLINE</div>
                    </div>
                  </div>
                </div>

                {/* Live production pipeline */}
                <div className="relative py-2">
                  <div className="hidden lg:block absolute left-[8%] right-[8%] top-1/2 h-px bg-gradient-to-r from-cyan-500/10 via-cyan-400/50 to-amber-400/10">
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-16 h-px bg-gradient-to-r from-transparent via-white to-transparent"
                      animate={{ left: ['0%', '90%', '0%'] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative">
                  {([
                    { icon: Sparkles, zh: '创意输入', en: 'Creative Brief', metaZh: '品牌 / IP / 剧情', metaEn: 'Brand / IP / Story', color: '#22d3ee', statusZh: '已接收', statusEn: 'Ready' },
                    { icon: Video, zh: 'AI 内容生成', en: 'AI Generation', metaZh: '脚本 · 声音 · 画面', metaEn: 'Script · Voice · Visual', color: '#c084fc', statusZh: '生成中', statusEn: 'Running' },
                    { icon: Globe2, zh: '矩阵分发', en: 'Matrix Publish', metaZh: '12 个平台已连接', metaEn: '12 platforms linked', color: '#f472b6', statusZh: '已连接', statusEn: 'Linked' },
                    { icon: TrendingUp, zh: '商业变现', en: 'Monetization', metaZh: 'GMV / 版权 / 广告', metaEn: 'GMV / IP / Ads', color: '#fbbf24', statusZh: '追踪中', statusEn: 'Tracking' },
                  ] as const).map((step, i) => {
                    const StepIcon = step.icon;
                    return (
                      <motion.div key={step.zh} className="relative z-10" whileHover={{ y: -4 }} transition={{ duration: .2 }}>
                        <div
                          className="h-full min-h-[174px] rounded-xl p-4 overflow-hidden relative"
                          style={{
                            background: 'linear-gradient(145deg, rgba(8,18,30,.96), rgba(3,8,16,.94))',
                            border: `1px solid ${step.color}30`,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.24)`,
                          }}
                        >
                          <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${step.color}90, transparent)` }} />
                          <div className="flex items-center justify-between gap-2 mb-5">
                            <span className="text-xs font-mono tracking-[0.18em]" style={{ color: '#64748b' }}>NODE 0{i + 1}</span>
                            <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider" style={{ color: step.color }}>
                              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: step.color, boxShadow: `0 0 8px ${step.color}` }} />
                              {zh ? step.statusZh : step.statusEn}
                            </span>
                          </div>
                          <div className="w-9 h-9 rounded-lg border flex items-center justify-center mb-3" style={{ color: step.color, borderColor: `${step.color}35`, background: `${step.color}12` }}>
                            <StepIcon className="w-4 h-4" />
                          </div>
                          <div className="text-sm font-semibold tracking-tight" style={{ color: '#f8fafc' }}>{zh ? step.zh : step.en}</div>
                          <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>{zh ? step.metaZh : step.metaEn}</div>
                          <div className="absolute left-4 right-4 bottom-3 h-px bg-white/5 overflow-hidden">
                            <motion.div className="h-full" style={{ background: step.color }} initial={{ width: 0 }} whileInView={{ width: `${72 + i * 8}%` }} viewport={{ once: true }} transition={{ duration: .8, delay: .3 + i * .12 }} />
                          </div>
                        </div>
                        {i < 3 && (
                          <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 items-center justify-center rounded-full z-20"
                            style={{ background: '#07111d', border: '1px solid rgba(34,211,238,.3)' }}>
                            <ChevronRight className="w-3 h-3 text-cyan-300" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  </div>
                </div>

                <div className="mt-auto pt-8 grid grid-cols-3 gap-3">
                  {[
                    { value: '1,286', zh: '今日生成内容', en: 'Generated Today', trend: '+18.4%' },
                    { value: '42.6h', zh: '节省制作时间', en: 'Time Saved', trend: '+31.2%' },
                    { value: '¥328K', zh: '内容驱动 GMV', en: 'Content GMV', trend: '+24.8%' },
                  ].map(item => (
                    <div key={item.en} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-lg md:text-2xl text-white font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{item.value}</div>
                        <span className="hidden sm:block text-xs text-emerald-300 bg-emerald-500/10 rounded-full px-1.5 py-0.5">{item.trend}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{zh ? item.zh : item.en}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Story commerce */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .12 }} whileHover={{ y: -4 }}
              className="md:col-span-4 min-h-[252px] border border-orange-500/20 rounded-3xl overflow-hidden group relative">
              <img src="/images/scene-story-commerce.webp" alt={zh ? '剧情带货' : 'Story commerce'} className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-orange-950/20" />
              <div className="relative h-full p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-orange-300" />
                  </div>
                  <span className="text-xs text-orange-300 font-mono tracking-widest border border-orange-500/20 rounded-full px-2 py-1">NEW ENGINE</span>
                </div>
                <div>
                  <h3 className="text-xl text-white font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>{zh ? 'AI 剧情带货引擎' : 'AI Story Commerce Engine'}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{zh ? '自动生成剧情脚本，将商品自然植入角色与情节，兼顾内容质量和转化效率。' : 'Generate stories that weave products naturally into characters and plots, balancing quality with conversion.'}</p>
                  <div className="flex gap-2 mt-4">
                    {(zh ? ['剧情生成', '智能植入', '转化预测'] : ['Story Gen', 'Smart Placement', 'Conversion']).map(tag => <span key={tag} className="text-xs text-orange-200/80 bg-orange-500/10 border border-orange-500/15 px-2 py-1 rounded-full">{tag}</span>)}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Digital founder */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .2 }} whileHover={{ y: -4 }}
              className="md:col-span-4 min-h-[252px] border border-teal-500/20 rounded-3xl overflow-hidden group relative">
              <img src="/images/scene-digital-founder.webp" alt={zh ? '数字创始人' : 'Digital founder'} className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-teal-950/20" />
              <div className="relative h-full p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-teal-300" />
                  </div>
                  <span className="text-xs text-teal-300 font-mono tracking-widest border border-teal-500/20 rounded-full px-2 py-1">DIGITAL IP</span>
                </div>
                <div>
                  <h3 className="text-xl text-white font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>{zh ? '数字创始人工作室' : 'Digital Founder Studio'}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{zh ? '将创始人转化为可持续输出的数字分身，用于企业介绍、品牌观点与全球化传播。' : 'Turn founders into always-on digital avatars for company stories, brand perspectives and global communication.'}</p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-teal-200/80">
                    <Radio className="w-3.5 h-3.5" />
                    {zh ? '多语言 · 多场景 · 7×24 内容输出' : 'Multilingual · Multi-scene · Always on'}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Foundation capability cards */}
            {([
              { icon: Film, titleZh: 'AI 短剧剧本', titleEn: 'AI Drama Scripts', descZh: '人物小传、分集大纲与分镜脚本一体生成', descEn: 'Characters, episode arcs and storyboards in one flow', metric: '36 SEC', metricZh: '平均初稿', metricEn: 'First draft', color: 'purple' },
              { icon: Globe2, titleZh: '全域矩阵分发', titleEn: 'Omnichannel Matrix', descZh: '多账号、多平台、一键适配与定时发布', descEn: 'Multi-account publishing with automatic adaptation', metric: '150+', metricZh: '分发渠道', metricEn: 'Channels', color: 'cyan' },
              { icon: BarChart3, titleZh: '商业增长引擎', titleEn: 'Growth Engine', descZh: 'GMV、版权与广告收益统一追踪优化', descEn: 'Track and optimize GMV, IP and ad revenue', metric: '+38%', metricZh: '平均效率', metricEn: 'Efficiency', color: 'pink' },
            ] as const).map((card, i) => {
              const CardIcon = card.icon;
              const colors = {
                purple: 'text-purple-300 bg-purple-500/10 border-purple-500/20 hover:border-purple-400/40',
                cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-400/40',
                pink: 'text-pink-300 bg-pink-500/10 border-pink-500/20 hover:border-pink-400/40',
              };
              return (
                <motion.div key={card.titleEn} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .25 + i * .08 }} whileHover={{ y: -4 }}
                  className={`md:col-span-4 rounded-2xl border p-5 bg-gray-900/40 transition-colors ${colors[card.color]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[card.color]}`}>
                      <CardIcon className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-white font-bold font-mono">{card.metric}</div>
                      <div className="text-xs text-gray-600">{zh ? card.metricZh : card.metricEn}</div>
                    </div>
                  </div>
                  <h3 className="text-base text-white font-semibold mt-5 mb-1.5">{zh ? card.titleZh : card.titleEn}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{zh ? card.descZh : card.descEn}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ===== 6. IP UNIVERSE ===== */}
      <Section id="ip-universe" className="relative z-10 py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 10% 20%, rgba(236,72,153,.08), transparent 26%), radial-gradient(circle at 90% 75%, rgba(6,182,212,.08), transparent 30%)' }} />
        <div className="container mx-auto relative">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 max-w-6xl mx-auto">
            <div className="max-w-4xl">
              <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30 mb-4">{zh ? 'AI 娱乐 IP 宇宙' : 'AI Entertainment IP Universe'}</Badge>
              <h2 className="text-4xl md:text-5xl mb-5 font-extrabold tracking-tight leading-[1.08] [text-wrap:balance]" style={{ fontFamily: "var(--font-display)" }}>
                {zh ? '从一个 AI 艺人，到完整娱乐生态' : 'From One AI Artist to a Complete Entertainment Ecosystem'}
              </h2>
              <p className="text-gray-400/80 max-w-2xl leading-relaxed font-light">
                {zh ? '不只孵化明星，也孵化制作人、经纪人、数字创始人与粉丝商业网络，让台前与幕后围绕同一个 IP 持续协作。' : 'Incubate not only stars, but also producers, managers, digital founders and the fan-commerce network that grows around one IP.'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="text-3xl text-white font-black" style={{ fontFamily: "var(--font-display)" }}>4</span>
              <span className="leading-tight">{zh ? <>层协作网络<br />覆盖娱乐全链路</> : <>Collaboration layers<br />across entertainment</>}</span>
            </div>
          </div>

          {/* Entertainment galaxy: AI artist at the centre, four collaboration layers around it */}
          <EntertainmentGalaxy lang={lang} layers={IP_TYPES} active={activeIP} onActiveChange={setActiveIP} />

          {/* Linked case gallery */}
          <div className="mt-16 max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-xs text-cyan-400 font-mono uppercase tracking-[0.22em] mb-2">{zh ? '精选案例' : 'Selected Cases'}</div>
                <h3 className="text-2xl md:text-3xl text-white font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {zh ? `${IP_TYPES[activeIP].zh} · 协作案例` : `${IP_TYPES[activeIP].en} · Collaboration Case`}
                </h3>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600 font-mono">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: IP_TYPES[activeIP].color, boxShadow: `0 0 10px ${IP_TYPES[activeIP].color}` }} />
                LIVE CASE LIBRARY
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeIP}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: .35 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                {visibleIPCases.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <motion.article
                      key={item.en}
                      whileHover={{ y: -5 }}
                      className={`${i === 0 ? 'md:col-span-2' : 'md:col-span-1'} h-[390px] rounded-3xl overflow-hidden relative group border border-white/10 hover:border-white/25 transition-colors`}
                    >
                      <img src={item.image} alt={zh ? item.caseZh : item.caseEn} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                      <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(145deg, transparent 35%, ${item.color}45)` }} />
                      <div className="relative h-full p-5 md:p-6 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md" style={{ background: 'rgba(0,0,0,.42)', border: `1px solid ${item.color}45` }}>
                            <ItemIcon className="w-3.5 h-3.5" style={{ color: item.color }} />
                            <span className="text-xs text-white font-semibold">{zh ? item.zh : item.en}</span>
                          </div>
                          <ArrowUpRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>

                        <div className="mt-auto">
                          <div className="mb-5">
                            <div className="inline-flex items-center gap-1.5 mb-3 rounded-full px-2.5 py-1 text-xs text-white/85 bg-black/45 border border-white/10 backdrop-blur">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                              {zh ? item.chainZh : item.chainEn}
                            </div>
                            <div className={`${i === 0 ? 'text-3xl' : 'text-2xl'} text-white font-black leading-tight mb-3`} style={{ fontFamily: "var(--font-display)" }}>
                              {zh ? item.caseZh : item.caseEn}
                            </div>
                            <p className="text-xs text-gray-300/80 leading-relaxed line-clamp-3">{zh ? item.descZh : item.descEn}</p>
                          </div>
                          <div className="flex items-end justify-between gap-4 pt-4 border-t border-white/10">
                            <div>
                              <div className="text-2xl font-black whitespace-nowrap" style={{ color: item.color, fontFamily: "var(--font-display)" }}>{zh ? item.metric : item.metricEn}</div>
                              <div className="text-xs text-gray-500 mt-1">{zh ? item.metricZh : item.metricLabelEn}</div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-1">
                              {(zh ? item.tagsZh : item.tagsEn).slice(0, i === 0 ? 3 : 2).map(tag => (
                                <span key={tag} className="text-xs text-white/60 bg-black/40 border border-white/10 rounded-full px-2 py-1">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Section>

      <OperationsDashboard lang={lang} />

      <ThreePortFlywheel lang={lang} />
      <TestimonialSpotlight lang={lang} />

      {/* ===== 9. PARTNERS ===== */}
      <Section className="relative z-10 py-16 px-6 border-y border-white/5">
        <div className="container mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-[0.25em] font-medium">{zh ? '一键分发至 150+ 平台' : 'Publish to 150+ Platforms'}</p>
          </div>
          <div className="overflow-hidden relative">
            <motion.div animate={{ x: [0, -800] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="flex gap-12 items-center whitespace-nowrap">
              {[...(zh ? PARTNERS_ZH : PARTNERS_EN), ...(zh ? PARTNERS_ZH : PARTNERS_EN)].map((p, i) => (
                <div key={i} className="text-gray-600 text-lg shrink-0 hover:text-gray-400 transition cursor-default font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{p}</div>
              ))}
            </motion.div>
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent pointer-events-none" />
          </div>
        </div>
      </Section>

      <RoadmapBeam lang={lang} />
      <TechConstellation lang={lang} />
      <FaqShowcase lang={lang} onEnter={onEnter} />

      {/* ===== 13. CTA ===== */}
      <Section className="relative z-10 py-32 px-6">
        <div className="container mx-auto text-center">
          <motion.div whileInView={{ scale: [.95, 1] }} viewport={{ once: true }} transition={{ duration: .6 }}
            className="max-w-3xl mx-auto bg-gradient-to-br from-cyan-900/20 via-purple-900/15 to-pink-900/15 border border-cyan-500/15 rounded-3xl p-10 sm:p-14 backdrop-blur relative overflow-hidden">
            {/* Sweeping light */}
            <motion.div className="absolute inset-0 rounded-3xl" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(6,182,212,.08) 50%, transparent 60%)' }}
              animate={{ x: ['-150%', '250%'] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
            {/* Glow orb */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />

            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}>
              <Sparkles className="w-12 h-12 text-cyan-400 mx-auto mb-6" />
            </motion.div>
            <h2 className="text-4xl md:text-5xl mb-4 relative z-10 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '准备好开始了吗？' : 'Ready to Begin?'}</h2>
            <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-xl mx-auto relative z-10 font-light">
              {zh ? '加入10万+创业者，开启你的AI娱乐帝国之旅。免费开始，无需信用卡。' : 'Join 100k+ creators and start building your AI entertainment empire. Free to start, no credit card required.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
              <MagneticButton onClick={onEnter} className="h-14 px-10 text-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl inline-flex items-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/20 transition-shadow">
                {zh ? '免费开始创作' : 'Start Creating Free'} <ArrowRight className="w-5 h-5" />
              </MagneticButton>
              <Button variant="outline" size="lg" onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })} className="h-14 px-8 border-white/10 text-gray-300 hover:bg-white/5">
                {zh ? '观看产品演示' : 'Watch Product Demo'} <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-white/5 pt-14 pb-28 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span className="text-base bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>AI Star Eco</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-light">{zh ? '全球首个全娱乐领域\nAI艺人孵化平台' : "World's first full-domain\nAI artist incubation platform"}</p>
            </div>
            {[
              { t: zh ? '产品' : 'Product', links: [
                { l: zh ? 'AI孵化器' : 'AI Incubator', action: onEnter },
                { l: zh ? '核心功能' : 'Features', href: '#features' },
                { l: zh ? '产品演示' : 'Product Demo', href: '#showcase' },
                { l: zh ? '十大领域' : 'Domains', href: '#domains' },
              ] },
              { t: zh ? '生态' : 'Ecosystem', links: [
                { l: zh ? '角色 IP 体系' : 'Role IP System', href: '#artist-system' },
                { l: zh ? '娱乐生态' : 'Entertainment Ecosystem', href: '#ip-universe' },
                { l: zh ? '三端生态' : 'Ecosystem', href: '#ecosystem' },
                { l: zh ? '创业者中心' : 'Creator Hub', action: onEnter },
                ...(onHome ? [{ l: zh ? '全部方案' : 'All Solutions', action: onHome }] : []),
              ] },
              { t: zh ? '资源' : 'Resources', links: [
                { l: zh ? '路线图' : 'Roadmap', href: '#roadmap' },
                { l: zh ? '常见问题' : 'FAQ', href: '#faq' },
              ] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white text-sm mb-3 font-semibold uppercase tracking-wider">{col.t}</h4>
                {col.links.map((item, j) => (
                  <a key={j} href={item.href ?? '#'} onClick={item.action ? (event => { event.preventDefault(); item.action?.(); }) : undefined} className="block text-xs text-gray-500 hover:text-gray-300 transition py-1">{item.l}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xs text-gray-600">© 2026 AI Star Eco. All rights reserved.</span>
            <div className="flex gap-4">
              {[zh ? '隐私政策' : 'Privacy', zh ? '服务条款' : 'Terms', zh ? '安全' : 'Security'].map((l, i) => (
                <span key={i} className="text-xs text-gray-600">{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <motion.button
        aria-label={zh ? '回到顶部' : 'Back to top'}
        className="fixed bottom-24 right-6 z-50 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center backdrop-blur text-cyan-400 hover:bg-cyan-500/30 transition"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }}
      >
        ↑
      </motion.button>
    </div>
  );
};
