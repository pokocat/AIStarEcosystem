"use client";

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
  { icon: Music, zh: '音乐', en: 'Music', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { icon: Film, zh: '影视', en: 'Film & TV', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { icon: ShoppingBag, zh: '商业代言', en: 'Endorsement', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { icon: Tv, zh: '综艺节目', en: 'Variety Show', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { icon: Mic, zh: '曲艺表演', en: 'Performing Arts', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { icon: Star, zh: '舞台表演', en: 'Stage', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { icon: GraduationCap, zh: '教育培训', en: 'Education', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: Gamepad, zh: '游戏娱乐', en: 'Gaming', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
];

const TESTIMONIALS = [
  { name: 'CyberLuna', role_zh: '独立制作人', role_en: 'Indie Producer', zh: '3个月内我孵化了5个AI歌手，月收入突破10万。这个平台完全改变了我的职业路径。', en: 'I incubated 5 AI singers in 3 months with 100k monthly income. This platform totally changed my career path.', avatar: 'https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=100&q=80', rating: 5 },
  { name: 'NeonStudio', role_zh: 'MCN机构', role_en: 'MCN Agency', zh: '作为专业发行机构，AI Star Eco让我们的签约效率提升了300%，内容产出质量远超预期。', en: 'As a professional agency, AI Star Eco boosted our signing efficiency by 300%.', avatar: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&q=80', rating: 5 },
  { name: 'PixelDream', role_zh: '粉丝用户', role_en: 'Fan User', zh: '我在这里发现了很多独特的AI艺人，每天都能听到全新风格的音乐，收藏的NFT也在增值。', en: 'I discovered many unique AI artists here with fresh music every day.', avatar: 'https://images.unsplash.com/photo-1514525253440-b393452e2347?w=100&q=80', rating: 5 },
  { name: 'StarForge', role_zh: '全能制作人', role_en: 'Full-stack Creator', zh: '从音乐到短剧，从综艺到游戏，我在一个平台上做出了4个不同领域的爆款内容。', en: 'From music to short dramas, variety shows to games, I created viral content across 4 domains on one platform.', avatar: 'https://images.unsplash.com/photo-1630754157718-8b7b3aaa57e2?w=100&q=80', rating: 5 },
];

const ROADMAP = [
  { phase: 'Phase 1', status: 'done' as const, zh: '基础孵化系统', en: 'Core Incubation', items_zh: ['AI歌手创建', '音乐生成引擎', '基础发行渠道'], items_en: ['AI Singer Creation', 'Music Gen Engine', 'Basic Distribution'] },
  { phase: 'Phase 2', status: 'active' as const, zh: '全娱乐生态', en: 'Full Entertainment', items_zh: ['8大领域覆盖', '三端生态架构', 'NFT资产系统'], items_en: ['8 Domain Coverage', '3-Port Architecture', 'NFT Asset System'] },
  { phase: 'Phase 3', status: 'upcoming' as const, zh: 'Web3 深度融合', en: 'Web3 Integration', items_zh: ['DAO治理上线', '跨链资产互通', '去中心化版权'], items_en: ['DAO Governance', 'Cross-chain Assets', 'Decentralized IP'] },
  { phase: 'Phase 4', status: 'upcoming' as const, zh: '元宇宙演出', en: 'Metaverse Stage', items_zh: ['虚拟演唱会', 'AR互动体验', '全息投影演出'], items_en: ['Virtual Concerts', 'AR Experience', 'Holographic Shows'] },
];

const STATS = [
  { v: 100000, s: '+', zh: '生态创业者', en: 'Creators', c: 'text-cyan-400', icon: Users },
  { v: 5000000, s: '+', zh: '作品产出', en: 'Works Created', c: 'text-purple-400', icon: Music },
  { v: 150, s: '+', zh: '分发平台', en: 'Platforms', c: 'text-pink-400', icon: Globe2 },
  { v: 8, s: '', zh: '娱乐领域', en: 'Domains', c: 'text-amber-400', icon: Layers },
  { v: 50000, s: '+', zh: 'NFT铸造', en: 'NFTs Minted', c: 'text-green-400', icon: Coins },
  { v: 99.9, s: '%', zh: '系统可用性', en: 'Uptime', c: 'text-red-400', icon: Shield },
];

const PARTNERS = ['Sony Music AI', 'ByteDance', 'Tencent Music', 'NetEase Cloud', 'Spotify Labs', 'Warner AI', 'Universal Digital', 'Bilibili'];

const FAQ = [
  { q_zh: '什么是AI艺人孵化？', q_en: 'What is AI Artist Incubation?', a_zh: 'AI艺人孵化是使用人工智能技术创建虚拟艺人，培养其唱功、演技等才艺能力，并在多个娱乐领域进行内容创作和商业变现的全新模式。', a_en: 'AI Artist Incubation uses AI to create virtual artists, develop their talents like singing and acting, and create content for commercial success across entertainment domains.' },
  { q_zh: '需要专业技能才能开始吗？', q_en: 'Do I need professional skills?', a_zh: '完全不需要！我们的AI工具会帮助你完成从创建到发行的所有技术环节。你只需要有创意和想法，平台会帮你实现。', a_en: 'Not at all! Our AI tools handle all technical aspects from creation to distribution. You just need creativity and ideas.' },
  { q_zh: '如何赚取收入？', q_en: 'How do I earn revenue?', a_zh: '通过流媒体版税、NFT销售、商业代言、粉丝打赏、虚拟演出等多维度渠道。平台提供完整的商业变现体系。', a_en: 'Through streaming royalties, NFT sales, brand endorsements, fan tips, virtual performances and more. The platform provides a complete monetization system.' },
  { q_zh: '我的版权如何保护？', q_en: 'How is my copyright protected?', a_zh: '所有原创内容自动通过区块链确权上链，生成不可篡改的版权证明。支持跨平台版权追踪和维权。', a_en: 'All original content is automatically registered on blockchain with immutable copyright proof. Cross-platform tracking and protection are supported.' },
];

/* ======== MAIN COMPONENT ======== */
export const HomePage = ({ onEnter, lang, setLang }: { onEnter: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const t = TRANSLATIONS[lang];
  const zh = lang === 'zh';
  const { scrollYProgress } = useScroll();
  const navOpacity = useTransform(scrollYProgress, [0, 0.03], [0, 1]);
  const [activeT, setActiveT] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [typedText, setTypedText] = useState('');
  const heroWords = zh ? ['音乐帝国', '虚拟偶像', '娱乐矩阵', '数字王朝'] : ['Music Empire', 'Virtual Idols', 'Entertainment', 'Digital Dynasty'];
  const [wordIdx, setWordIdx] = useState(0);

  // Typewriter effect for hero
  useEffect(() => {
    const word = heroWords[wordIdx];
    let i = 0;
    setTypedText('');
    const typeInterval = setInterval(() => {
      if (i <= word.length) { setTypedText(word.slice(0, i)); i++; }
      else { clearInterval(typeInterval); setTimeout(() => setWordIdx(w => (w + 1) % heroWords.length), 2000); }
    }, 120);
    return () => clearInterval(typeInterval);
  }, [wordIdx, lang]);

  // Testimonial rotation
  useEffect(() => {
    const iv = setInterval(() => setActiveT(i => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      <ParticleBackground />

      {/* ===== STICKY NAV ===== */}
      <motion.nav style={{ backgroundColor: useTransform(navOpacity, v => `rgba(0,0,0,${v * .85})`) }} className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-cyan-500/10 backdrop-blur-lg">
        <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent" style={{ fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>AI Star Eco</span>
        </motion.div>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-5">
          {[
            { href: '#features', label: t.nav.features },
            { href: '#domains', label: zh ? '八大领域' : 'Domains' },
            { href: '#ecosystem', label: t.nav.ecosystem },
            { href: '#showcase', label: zh ? '案例' : 'Cases' },
            { href: '#roadmap', label: zh ? '路线图' : 'Roadmap' },
            { href: '#faq', label: 'FAQ' },
          ].map((n, i) => (
            <a key={i} href={n.href} className="text-gray-400 hover:text-white transition text-sm font-light tracking-wide relative group">
              {n.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setLang(zh ? 'en' : 'zh')} className="hover:bg-white/10"><GlobeIcon className="w-4 h-4 mr-1" /> {zh ? 'EN' : '中'}</Button>
          <Button onClick={onEnter} size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90">{t.nav.enter}</Button>
        </div>
        {/* Mobile hamburger */}
        <button className="md:hidden text-white" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-14 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 flex flex-col gap-4 md:hidden">
            {['features', 'domains', 'ecosystem', 'showcase', 'roadmap', 'faq'].map(id => (
              <a key={id} href={`#${id}`} onClick={() => setMobileMenu(false)} className="text-gray-300 hover:text-white py-2 capitalize">{id}</a>
            ))}
            <Button onClick={() => { setMobileMenu(false); setLang(zh ? 'en' : 'zh'); }} variant="outline" className="border-white/20">{zh ? 'English' : '中文'}</Button>
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
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">
                {typedText}
              </span>
              <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: .6, repeat: Infinity }} className="text-cyan-400 ml-0.5">|</motion.span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .3 }} className="text-base sm:text-lg text-gray-400 max-w-2xl leading-relaxed font-light">
              {t.hero.desc}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .5 }} className="flex flex-wrap gap-4">
              <MagneticButton onClick={onEnter} className="h-14 px-8 text-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white rounded-lg inline-flex items-center gap-2 cursor-pointer">
                {t.hero.cta_primary}
                <motion.span animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}><ArrowRight className="w-5 h-5" /></motion.span>
              </MagneticButton>
              <Button variant="outline" size="lg" className="h-14 px-8 text-lg border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                <Play className="w-5 h-5 mr-2" /> {t.hero.cta_secondary}
              </Button>
            </motion.div>

            {/* Mini stats inline */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .8 }} className="flex flex-wrap gap-8 pt-6">
              {[{ n: '100K+', l: zh ? '创业者' : 'Creators' }, { n: '5M+', l: zh ? '作品' : 'Works' }, { n: '8', l: zh ? '大领域' : 'Domains' }].map((s, i) => (
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
            {STATS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08, duration: .5 }}
                whileHover={{ scale: 1.08 }}
                className="text-center bg-gray-900/30 border border-white/5 rounded-xl p-5 hover:border-cyan-500/20 transition-all">
                <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.c} opacity-60`} />
                <div className={`text-3xl font-extrabold tracking-tight ${s.c}`} style={{ fontFamily: "var(--font-display)" }}><Counter target={s.v} suffix={s.s} /></div>
                <div className="text-xs text-gray-500 mt-1 font-light">{zh ? s.zh : s.en}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 3. WORKFLOW ===== */}
      <Section id="features" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/40 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30 mb-4">{t.workflow.tag}</Badge>
            <h2 className="text-4xl md:text-5xl mb-6 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.workflow.title}</h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto font-light leading-relaxed">{t.workflow.desc}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.workflow.steps.map((step: any, i: number) => {
              const icons = [Rocket, Cpu, Layers, TrendingUp];
              const colors = ['cyan', 'purple', 'pink', 'amber'] as const;
              const I = icons[i];
              const tc = ['text-cyan-400', 'text-purple-400', 'text-pink-400', 'text-amber-400'][i];
              const bg = ['bg-cyan-500/10', 'bg-purple-500/10', 'bg-pink-500/10', 'bg-amber-500/10'][i];
              return (
                <GlowCard key={i} color={colors[i]} delay={i * .12}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center border border-white/5`}>
                      <I className={`w-6 h-6 ${tc}`} />
                    </div>
                    <div className="text-xs text-gray-600">STEP 0{i + 1}</div>
                  </div>
                  <h3 className="text-lg mb-2 text-white font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-gray-400/80 text-sm leading-relaxed font-light">{step.desc}</p>
                </GlowCard>
              );
            })}
          </div>
          {/* Animated connecting arrows on desktop */}
          <div className="hidden lg:flex items-center justify-center mt-10 gap-3">
            {[0, 1, 2].map(i => (
              <React.Fragment key={i}>
                <motion.div className="h-px w-20 bg-gradient-to-r from-cyan-500/40 to-purple-500/40" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: .6 + i * .15, duration: .5 }} />
                <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: .75 + i * .15 }}>
                  <ChevronRight className="w-4 h-4 text-purple-400/50" />
                </motion.div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 4. EIGHT DOMAINS ===== */}
      <Section id="domains" className="relative z-10 py-28 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-amber-900/30 text-amber-400 border-amber-500/30 mb-4">{zh ? '全领域覆盖' : 'Full Coverage'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '8大娱乐领域，无限可能' : '8 Entertainment Domains, Infinite Possibilities'}</h2>
            <p className="text-base text-gray-400/80 max-w-2xl mx-auto font-light">{zh ? '从音乐到游戏，覆盖完整娱乐产业版图' : 'From music to gaming — the complete entertainment landscape'}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {DOMAINS.map((d, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 25, rotateY: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * .07 }}
                whileHover={{ scale: 1.08, y: -8 }}
                className={`${d.bg} border ${d.border} hover:border-white/20 rounded-xl p-6 text-center cursor-pointer transition-all group relative overflow-hidden`}>
                {/* Shine effect */}
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12" initial={{ x: '-100%' }} whileHover={{ x: '200%' }} transition={{ duration: .6 }} />
                <motion.div whileHover={{ rotate: 360 }} transition={{ duration: .5 }}>
                  <d.icon className={`w-10 h-10 mx-auto ${d.color} mb-3`} />
                </motion.div>
                <div className="text-sm text-white font-semibold tracking-tight">{zh ? d.zh : d.en}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 5. BENTO SHOWCASE ===== */}
      <Section id="showcase" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30 mb-4">{zh ? '平台能力' : 'Platform Capabilities'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '一站式 AI 娱乐基础设施' : 'All-in-One AI Entertainment Infrastructure'}</h2>
          </div>
          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* Large card */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} whileHover={{ y: -4 }}
              className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border border-cyan-500/15 rounded-2xl overflow-hidden group relative">
              <div className="h-56 md:h-72 overflow-hidden relative">
                <img src="https://images.unsplash.com/photo-1651505942687-efc26cb528ba?w=800&q=80" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
              </div>
              <div className="p-8">
                <Layers className="w-10 h-10 text-cyan-400 mb-4" />
                <h3 className="text-2xl mb-3 font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.features.saas_title}</h3>
                <p className="text-gray-400/80 text-sm leading-relaxed mb-4 font-light">{t.features.saas_desc}</p>
                <div className="flex gap-2 flex-wrap">
                  {(zh ? ['AI音乐', 'AI视频', '动作捕捉', '人物建模'] : ['AI Music', 'AI Video', 'MoCap', '3D Modeling']).map((tag, i) => (
                    <Badge key={i} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            </motion.div>
            {/* Small card 1 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .15 }} whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/15 rounded-2xl p-6 group overflow-hidden relative">
              <div className="h-32 overflow-hidden rounded-lg mb-4 relative">
                <img src="https://images.unsplash.com/photo-1630754157718-8b7b3aaa57e2?w=400&q=80" alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
              </div>
              <Music className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-lg mb-2 font-semibold tracking-tight">{t.features.assets_title}</h3>
              <p className="text-gray-400/80 text-xs leading-relaxed font-light">{t.features.assets_desc}</p>
            </motion.div>
            {/* Small card 2 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: .25 }} whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-pink-900/20 to-cyan-900/20 border border-pink-500/15 rounded-2xl p-6 group overflow-hidden relative">
              <div className="h-32 overflow-hidden rounded-lg mb-4 relative">
                <img src="https://images.unsplash.com/photo-1765224747184-05d35f23859a?w=400&q=80" alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
              </div>
              <Users className="w-8 h-8 text-pink-400 mb-3" />
              <h3 className="text-lg mb-2 font-semibold tracking-tight">{t.features.dao_title}</h3>
              <p className="text-gray-400/80 text-xs leading-relaxed font-light">{t.features.dao_desc}</p>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ===== 6. THREE-PORT ECOSYSTEM ===== */}
      <Section id="ecosystem" className="relative z-10 py-28 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-pink-900/30 text-pink-400 border-pink-500/30 mb-4">{zh ? '三端生态' : 'Three-Port Ecosystem'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '完整商业闭环，三端协同共赢' : 'Complete Business Loop, Three-Port Synergy'}</h2>
            <p className="text-base text-gray-400/80 max-w-xl mx-auto font-light">{zh ? '粉丝消费 × 创业孵化 × 机构赋能 = 无限增长飞轮' : 'Fan Consumption × Creator Incubation × Agency Empowerment = Infinite Growth Flywheel'}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
            {/* Animated connection */}
            <div className="hidden md:block absolute top-1/2 left-[33%] w-[34%] h-px">
              <motion.div className="h-full bg-gradient-to-r from-pink-500/40 via-cyan-500/40 to-purple-500/40" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: .5 }} />
            </div>
            {([
              { icon: Heart, title: zh ? '艺人观赏台' : 'Fan Platform', sub: zh ? '粉丝消费端 · C2C' : 'Consumer End · C2C', desc: zh ? '观看全部作品、支持偶像、收藏NFT数字资产、参与投票决策，构建沉浸式追星体验' : 'Watch content, support idols, collect NFTs, vote on decisions — immersive fan experience', color: 'pink', features: zh ? ['追星互动', 'NFT收藏', '投票治理'] : ['Fan Interaction', 'NFT Collection', 'Voting'] },
              { icon: Rocket, title: zh ? '生态创业者' : 'Eco Entrepreneur', sub: zh ? '内容创作端 · Core' : 'Creator End · Core', desc: zh ? '孵化AI艺人、制作全域内容、运营艺人矩阵、多维度商业变现，零门槛创业' : 'Incubate AI artists, create content, manage matrix, monetize — zero barrier entrepreneurship', color: 'cyan', features: zh ? ['AI孵化', '内容制作', '商业变现'] : ['AI Incubation', 'Content Creation', 'Monetization'] },
              { icon: Shield, title: zh ? '专业发行机构' : 'Pro Agency', sub: zh ? 'B2B赋能端 · Enterprise' : 'B2B End · Enterprise', desc: zh ? '提供导演服务、发行资源对接、版权管理、签约优质艺人，为生态注入专业能力' : 'Director services, distribution resources, copyright mgmt, artist signing — professional empowerment', color: 'purple', features: zh ? ['导演服务', '版权管理', '资源对接'] : ['Director Service', 'Copyright Mgmt', 'Resources'] },
            ] as const).map((item, i) => {
              const cmap: Record<string, string> = { pink: 'border-pink-500/15 hover:border-pink-400/40', cyan: 'border-cyan-500/15 hover:border-cyan-400/40', purple: 'border-purple-500/15 hover:border-purple-400/40' };
              const ibg: Record<string, string> = { pink: 'bg-pink-500/10 text-pink-400', cyan: 'bg-cyan-500/10 text-cyan-400', purple: 'bg-purple-500/10 text-purple-400' };
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * .15, duration: .6 }}
                  whileHover={{ scale: 1.03 }}
                  className={`bg-gray-900/50 backdrop-blur border ${cmap[item.color]} rounded-xl p-8 text-center relative z-10 transition-all`}>
                  <Badge className={`${ibg[item.color]} border-0 mb-3 text-xs`}>{item.sub}</Badge>
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${ibg[item.color]} flex items-center justify-center`}>
                    <item.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl mb-3 text-white font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                  <p className="text-gray-400/80 text-sm leading-relaxed mb-4 font-light">{item.desc}</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {item.features.map((f, j) => (
                      <span key={j} className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">{f}</span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ===== 7. ARTIST SYSTEM ===== */}
      <Section className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-green-900/30 text-green-400 border-green-500/30 mb-4">{zh ? '艺人体系' : 'Artist System'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '7种艺人类型 × 6大才艺能力' : '7 Artist Types × 6 Talent Skills'}</h2>
            <p className="text-base text-gray-400/80 font-light">{zh ? '完整的等级系统与游戏化成长体验' : 'Complete leveling system with gamified growth'}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Types */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-gray-900/40 border border-white/5 rounded-xl p-8">
              <h3 className="text-lg mb-6 text-cyan-400 flex items-center gap-2 font-bold tracking-tight"><Users className="w-5 h-5" /> {zh ? '艺人类型' : 'Artist Types'}</h3>
              <div className="space-y-3">
                {[
                  { n: zh ? '歌手' : 'Singer', pct: 90, c: 'from-cyan-500 to-cyan-400' },
                  { n: zh ? '演员' : 'Actor', pct: 85, c: 'from-purple-500 to-purple-400' },
                  { n: zh ? '综艺咖' : 'Entertainer', pct: 80, c: 'from-pink-500 to-pink-400' },
                  { n: zh ? '舞者' : 'Dancer', pct: 75, c: 'from-amber-500 to-amber-400' },
                  { n: zh ? '主持人' : 'Host', pct: 70, c: 'from-green-500 to-green-400' },
                  { n: zh ? '全能艺人' : 'All-Rounder', pct: 95, c: 'from-red-500 to-pink-400' },
                  { n: zh ? '偶像' : 'Idol', pct: 88, c: 'from-indigo-500 to-blue-400' },
                ].map((at, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * .05 }} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-gray-300 shrink-0 font-medium">{at.n}</div>
                    <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div className={`h-full bg-gradient-to-r ${at.c} rounded-full`} initial={{ width: 0 }} whileInView={{ width: `${at.pct}%` }} viewport={{ once: true }} transition={{ delay: .3 + i * .06, duration: .8, ease: "easeOut" }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{at.pct}%</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            {/* Skills */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-gray-900/40 border border-white/5 rounded-xl p-8">
              <h3 className="text-lg mb-6 text-purple-400 flex items-center gap-2 font-bold tracking-tight"><Award className="w-5 h-5" /> {zh ? '6大才艺能力' : '6 Talent Skills'}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { n: zh ? '唱功' : 'Vocal', icon: Mic2, c: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                  { n: zh ? '演技' : 'Acting', icon: Video, c: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { n: zh ? '舞蹈' : 'Dance', icon: Sparkles, c: 'text-pink-400', bg: 'bg-pink-500/10' },
                  { n: zh ? '主持' : 'Hosting', icon: Headphones, c: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { n: zh ? '喜剧' : 'Comedy', icon: Star, c: 'text-green-400', bg: 'bg-green-500/10' },
                  { n: zh ? '综艺感' : 'Variety', icon: Zap, c: 'text-red-400', bg: 'bg-red-500/10' },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: .85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * .08 }}
                    whileHover={{ scale: 1.06 }}
                    className={`${s.bg} border border-white/5 rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-white/15 transition`}>
                    <s.icon className={`w-7 h-7 ${s.c}`} />
                    <div>
                      <div className="text-white text-sm font-semibold">{s.n}</div>
                      <div className="text-xs text-gray-500 font-light">Lv.1→100</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Quality tiers */}
              <div className="mt-5 p-4 bg-black/30 rounded-lg border border-white/5">
                <div className="text-xs text-gray-500 mb-3">{zh ? '品质等级' : 'Quality Tiers'}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { l: zh ? '普通' : 'Common', c: 'text-gray-400 border-gray-600' },
                    { l: zh ? '稀有' : 'Rare', c: 'text-blue-400 border-blue-500/30' },
                    { l: zh ? '史诗' : 'Epic', c: 'text-purple-400 border-purple-500/30' },
                    { l: zh ? '传说' : 'Legend', c: 'text-amber-400 border-amber-500/30' },
                    { l: zh ? '神话' : 'Mythic', c: 'text-red-400 border-red-500/30' },
                  ].map((q, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: .5 + i * .08, type: "spring" }}
                      className={`text-xs ${q.c} px-2.5 py-1 rounded-full border`}>{q.l}</motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ===== 8. TESTIMONIALS ===== */}
      <Section className="relative z-10 py-28 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30 mb-4">{zh ? '用户之声' : 'Testimonials'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '来自生态创业者的真实反馈' : 'Real Feedback from Our Community'}</h2>
          </div>
          <div className="relative min-h-[240px]">
            <AnimatePresence mode="wait">
              {TESTIMONIALS.map((tm, i) => i === activeT && (
                <motion.div key={i} initial={{ opacity: 0, y: 25, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -25, scale: .97 }} transition={{ duration: .5 }}
                  className="absolute inset-0 flex flex-col items-center text-center">
                  <div className="flex gap-1 mb-4">{Array.from({ length: tm.rating }).map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mb-6 italic leading-relaxed font-light">"{zh ? tm.zh : tm.en}"</p>
                  <img src={tm.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-cyan-500/30 mb-3 object-cover" />
                  <div className="text-white font-bold">{tm.name}</div>
                  <div className="text-xs text-gray-500 font-light tracking-wide">{zh ? tm.role_zh : tm.role_en}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            {TESTIMONIALS.map((_, i) => (
              <button key={i} onClick={() => setActiveT(i)} className={`h-2 rounded-full transition-all duration-300 ${i === activeT ? 'bg-cyan-400 w-8' : 'bg-gray-600 w-2'}`} />
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 9. PARTNERS ===== */}
      <Section className="relative z-10 py-16 px-6 border-y border-white/5">
        <div className="container mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-[0.25em] font-medium">{zh ? '生态合作伙伴' : 'Ecosystem Partners'}</p>
          </div>
          <div className="overflow-hidden relative">
            <motion.div animate={{ x: [0, -800] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="flex gap-12 items-center whitespace-nowrap">
              {[...PARTNERS, ...PARTNERS].map((p, i) => (
                <div key={i} className="text-gray-600 text-lg shrink-0 hover:text-gray-400 transition cursor-default font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{p}</div>
              ))}
            </motion.div>
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent pointer-events-none" />
          </div>
        </div>
      </Section>

      {/* ===== 10. ROADMAP ===== */}
      <Section id="roadmap" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-purple-900/30 text-purple-400 border-purple-500/30 mb-4">{zh ? '发展路线' : 'Roadmap'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '产品路线图' : 'Product Roadmap'}</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-green-500/30 via-cyan-500/30 to-gray-600/20" />
            {ROADMAP.map((r, i) => {
              const sc = r.status === 'done' ? 'bg-green-500' : r.status === 'active' ? 'bg-cyan-500' : 'bg-gray-600';
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .12, duration: .5 }}>
                  <div className="flex justify-center mb-5">
                    <motion.div className={`w-4 h-4 rounded-full ${sc} relative z-10 ring-4 ring-black`} animate={r.status === 'active' ? { scale: [1, 1.3, 1], boxShadow: ['0 0 0 0 rgba(6,182,212,0)', '0 0 0 8px rgba(6,182,212,.2)', '0 0 0 0 rgba(6,182,212,0)'] } : {}} transition={{ duration: 2, repeat: Infinity }} />
                  </div>
                  <div className={`bg-gray-900/50 border ${r.status === 'active' ? 'border-cyan-500/30' : 'border-white/5'} rounded-xl p-5`}>
                    <div className="text-xs text-gray-500 mb-1">{r.phase}</div>
                    <h4 className="text-white mb-3 font-semibold tracking-tight">{zh ? r.zh : r.en}</h4>
                    <ul className="space-y-1.5">
                      {(zh ? r.items_zh : r.items_en).map((item, j) => (
                        <li key={j} className="text-xs text-gray-400 flex items-center gap-2">
                          {r.status === 'done' ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" /> : <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.status === 'active' ? 'bg-cyan-400' : 'bg-gray-600'}`} />}
                          {item}
                        </li>
                      ))}
                    </ul>
                    {r.status === 'active' && <Badge className="mt-3 bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-xs">{zh ? '进行中' : 'In Progress'}</Badge>}
                    {r.status === 'done' && <Badge className="mt-3 bg-green-500/10 text-green-400 border-green-500/30 text-xs">{zh ? '已完成' : 'Done'}</Badge>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ===== 11. TECH STACK ===== */}
      <Section className="relative z-10 py-28 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-indigo-900/30 text-indigo-400 border-indigo-500/30 mb-4">{zh ? '技术底座' : 'Tech Stack'}</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '前沿技术驱动' : 'Powered by Cutting-Edge Tech'}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { name: 'AI Engine', desc: zh ? 'GPT-4o + 自研大模型' : 'GPT-4o + Custom LLM', icon: Cpu, c: 'text-cyan-400' },
              { name: 'Blockchain', desc: zh ? '版权确权 · NFT铸造' : 'Copyright · NFT Mint', icon: Lock, c: 'text-purple-400' },
              { name: 'Real-time', desc: zh ? 'WebSocket · CDN加速' : 'WebSocket · Global CDN', icon: Zap, c: 'text-amber-400' },
              { name: 'Analytics', desc: zh ? '智能数据分析引擎' : 'Smart Analytics Engine', icon: BarChart3, c: 'text-pink-400' },
              { name: 'Cloud Infra', desc: zh ? '多云架构 · 弹性伸缩' : 'Multi-cloud · Auto-scale', icon: Globe2, c: 'text-green-400' },
              { name: 'Security', desc: zh ? '零信任安全架构' : 'Zero-trust Security', icon: Shield, c: 'text-red-400' },
              { name: 'Streaming', desc: zh ? '低延迟音视频流' : 'Low-latency AV Stream', icon: Radio, c: 'text-indigo-400' },
              { name: 'Edge AI', desc: zh ? '端侧AI推理加速' : 'On-device AI Inference', icon: Flame, c: 'text-orange-400' },
            ].map((tech, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * .06 }}
                whileHover={{ scale: 1.06, rotateY: 5 }}
                className="bg-gray-900/40 border border-white/5 rounded-xl p-5 hover:border-indigo-500/25 transition-all group">
                <tech.icon className={`w-7 h-7 ${tech.c} mb-2 group-hover:scale-110 transition-transform`} />
                <div className="text-white text-sm mb-1 font-semibold tracking-tight">{tech.name}</div>
                <div className="text-xs text-gray-500 font-light">{tech.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 12. FAQ ===== */}
      <Section id="faq" className="relative z-10 py-28 px-6 bg-gradient-to-b from-black via-gray-900/30 to-black">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-14">
            <Badge className="bg-amber-900/30 text-amber-400 border-amber-500/30 mb-4">FAQ</Badge>
            <h2 className="text-4xl md:text-5xl mb-4 font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '常见问题' : 'Frequently Asked Questions'}</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((faq, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * .08 }}
                className="border border-white/5 rounded-xl overflow-hidden bg-gray-900/30 hover:border-white/10 transition-colors">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="text-white text-sm pr-4 font-semibold">{zh ? faq.q_zh : faq.q_en}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 45 : 0 }} transition={{ duration: .2 }}>
                    <span className="text-cyan-400 text-xl">+</span>
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .3 }}>
                      <div className="px-5 pb-5 text-sm text-gray-400/80 leading-relaxed font-light">{zh ? faq.a_zh : faq.a_en}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

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
              <Button variant="outline" size="lg" className="h-14 px-8 border-white/10 text-gray-300 hover:bg-white/5">
                {zh ? '预约演示' : 'Book a Demo'} <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-white/5 py-14 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span className="text-base bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>AI Star Eco</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed font-light">{zh ? '全球首个全娱乐领域\nAI艺人孵化平台' : "World's first full-domain\nAI artist incubation platform"}</p>
            </div>
            {[
              { t: zh ? '产品' : 'Product', links: [zh ? 'AI孵化器' : 'AI Incubator', zh ? '音乐工坊' : 'Music Studio', zh ? '发行矩阵' : 'Distribution', zh ? 'NFT市场' : 'NFT Market'] },
              { t: zh ? '生态' : 'Ecosystem', links: [zh ? '粉丝社区' : 'Fan Community', zh ? '创业者中心' : 'Creator Hub', zh ? '机构入驻' : 'Agency Portal', zh ? '开发者API' : 'Developer API'] },
              { t: zh ? '资源' : 'Resources', links: [zh ? '白皮书' : 'Whitepaper', zh ? '帮助中心' : 'Help Center', zh ? '开发文档' : 'Docs', zh ? '博客' : 'Blog'] },
              { t: zh ? '关于' : 'About', links: [zh ? '团队' : 'Team', zh ? '路线图' : 'Roadmap', zh ? '联系我们' : 'Contact', zh ? '招聘' : 'Careers'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white text-sm mb-3 font-semibold uppercase tracking-wider">{col.t}</h4>
                {col.links.map((l, j) => <a key={j} href="#" className="block text-xs text-gray-500 hover:text-gray-300 transition py-1">{l}</a>)}
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xs text-gray-600">© 2026 AI Star Eco. All rights reserved.</span>
            <div className="flex gap-4">
              {[zh ? '隐私政策' : 'Privacy', zh ? '服务条款' : 'Terms', zh ? '安全' : 'Security'].map((l, i) => (
                <a key={i} href="#" className="text-xs text-gray-600 hover:text-gray-400 transition">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <motion.button
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center backdrop-blur text-cyan-400 hover:bg-cyan-500/30 transition"
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
