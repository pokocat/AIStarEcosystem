import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import type { Lang } from '../../translations';

export type GachaRarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

export const RARITY_CONFIG: Record<GachaRarity, {
  label: string; color: string; glow: string;
  bg: string; border: string;
  desc_zh: string; desc_en: string;
  particles: number;
}> = {
  N: {
    label: 'NORMAL', color: '#9ca3af', glow: 'rgba(156,163,175,0.3)',
    bg: 'from-gray-600/20 to-gray-700/20', border: 'border-gray-600/40',
    desc_zh: '初出茅庐，潜力待发', desc_en: 'A new star yet to rise',
    particles: 8,
  },
  R: {
    label: 'RARE', color: '#60a5fa', glow: 'rgba(96,165,250,0.45)',
    bg: 'from-blue-500/20 to-blue-700/20', border: 'border-blue-500/40',
    desc_zh: '蓄势待发，初露锋芒', desc_en: 'Rare talent, starting to shine',
    particles: 12,
  },
  SR: {
    label: 'SUPER RARE', color: '#c084fc', glow: 'rgba(192,132,252,0.5)',
    bg: 'from-purple-500/25 to-violet-700/20', border: 'border-purple-500/40',
    desc_zh: '才华横溢，锋芒毕露', desc_en: 'Blazing talent, rare and bold',
    particles: 18,
  },
  SSR: {
    label: 'S·S·RARE', color: '#fbbf24', glow: 'rgba(251,191,36,0.6)',
    bg: 'from-amber-500/25 via-orange-500/15 to-amber-700/20', border: 'border-amber-500/50',
    desc_zh: '天赋卓绝，万众瞩目', desc_en: 'Extraordinary beyond measure',
    particles: 28,
  },
  UR: {
    label: 'ULTRA RARE', color: '#f472b6', glow: 'rgba(244,114,182,0.7)',
    bg: 'from-pink-500/30 via-violet-500/25 to-cyan-500/25', border: 'border-pink-400/60',
    desc_zh: '传奇天才 — 百年一遇', desc_en: 'LEGENDARY · Once in a century',
    particles: 40,
  },
};

export function computeRarity(params: {
  avgTalent: number;
  primaryTalent: number;
  hasForge: boolean;
  bioLength: number;
  subSkillsUsed: number;
  mbti: string;
}): GachaRarity {
  const { avgTalent, primaryTalent, hasForge, bioLength, subSkillsUsed, mbti } = params;
  let score = 0;

  score += Math.min(40, avgTalent * 0.4);
  score += Math.min(20, primaryTalent * 0.2);
  if (hasForge) score += 10;
  if (bioLength > 30) score += 5;
  if (subSkillsUsed >= 12) score += 10;
  if (mbti) score += 5;
  score += Math.random() * 10; // random factor

  if (score >= 90) return 'UR';
  if (score >= 75) return 'SSR';
  if (score >= 55) return 'SR';
  if (score >= 35) return 'R';
  return 'N';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  delay: number;
}

interface DebutCeremonyProps {
  lang: Lang;
  artistName: string;
  artistType: string;
  artistIcon: string;
  forgeImageUrl: string | null;
  rarity: GachaRarity;
  onExport: () => void;
  onShare: () => void;
  onGoToMatrix: () => void;
}

export const DebutCeremony = ({
  lang, artistName, artistType, artistIcon, forgeImageUrl,
  rarity, onExport, onShare, onGoToMatrix,
}: DebutCeremonyProps) => {
  const zh = lang === 'zh';
  const r = RARITY_CONFIG[rarity];
  const [phase, setPhase] = useState(0);
  const [revealedChars, setRevealedChars] = useState(0);
  const scanRef = useRef<HTMLDivElement>(null);

  // Phase timeline
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => setPhase(5), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Name reveal
  useEffect(() => {
    if (phase < 4) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRevealedChars(i);
      if (i >= artistName.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [phase, artistName]);

  // Particles
  const particles: Particle[] = Array.from({ length: r.particles }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
    vx: (Math.random() - 0.5) * 120,
    vy: -(40 + Math.random() * 80),
    size: 2 + Math.random() * 3,
    opacity: 0.6 + Math.random() * 0.4,
    delay: Math.random() * 0.8,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020208] overflow-hidden"
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(${r.color}10 1px, transparent 1px),
          linear-gradient(90deg, ${r.color}10 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Edge glow vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: `inset 0 0 120px ${r.glow}, inset 0 0 60px ${r.glow}60`,
      }} />

      {/* Scanline sweep Phase 1 */}
      {phase >= 1 && (
        <motion.div
          ref={scanRef}
          className="absolute inset-x-0 h-px pointer-events-none z-20"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${r.color} 40%, ${r.color} 60%, transparent 100%)`, opacity: 0.8 }}
          animate={{ top: ['-1%', '101%'] }}
          transition={{ duration: 1.0, ease: 'linear' }}
        />
      )}

      {/* Horizontal scan lines CRT */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,1) 3px, rgba(0,0,0,1) 4px)',
      }} />

      {/* Main content card */}
      <div className="relative z-10 flex flex-col items-center gap-5 p-8 max-w-sm w-full text-center">

        {/* Phase 2: Rarity badge */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ y: -50, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 220 }}
              className={`relative px-6 py-2 rounded-full border-2 bg-gradient-to-r ${r.bg} ${r.border} overflow-hidden`}
              style={{ boxShadow: `0 0 24px ${r.glow}, 0 0 48px ${r.glow}50` }}
            >
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 opacity-30"
                style={{ background: `linear-gradient(105deg, transparent 30%, ${r.color}60 50%, transparent 70%)` }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative text-sm font-black tracking-[0.25em]"
                style={{ color: r.color, fontFamily: 'var(--font-display)', textShadow: `0 0 12px ${r.glow}` }}>
                {r.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 3: Avatar */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 13, stiffness: 180, delay: 0.1 }}
              className="relative"
            >
              {/* Outer ring */}
              <motion.div
                className="absolute -inset-3 rounded-full border-2 border-dashed opacity-40"
                style={{ borderColor: r.color }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              {/* Inner ring */}
              <motion.div
                className="absolute -inset-1.5 rounded-full border opacity-60"
                style={{ borderColor: r.color }}
                animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              {/* Avatar */}
              <div
                className="w-28 h-28 rounded-full overflow-hidden border-4 relative"
                style={{
                  borderColor: r.color,
                  boxShadow: `0 0 32px ${r.glow}, 0 0 64px ${r.glow}50`,
                }}
              >
                {forgeImageUrl ? (
                  <img src={forgeImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl"
                    style={{ background: `radial-gradient(circle, ${r.color}20, ${r.color}05)` }}>
                    {artistIcon}
                  </div>
                )}
                {/* Holographic overlay */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-20"
                  style={{ background: `linear-gradient(135deg, ${r.color}60, transparent, ${r.color}40)` }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 4: Name + type */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="text-3xl font-black tracking-wider min-h-[1.2em]"
                style={{ fontFamily: 'var(--font-display)', color: r.color, textShadow: `0 0 20px ${r.glow}` }}>
                {artistName.split('').map((char, i) => (
                  <motion.span key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: i < revealedChars ? 1 : 0, y: i < revealedChars ? 0 : 12 }}
                    transition={{ duration: 0.15 }}>
                    {char}
                  </motion.span>
                ))}
                {revealedChars < artistName.length && (
                  <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                    className="ml-0.5 inline-block w-0.5 h-6 align-middle" style={{ backgroundColor: r.color }} />
                )}
              </div>
              <div className="text-sm text-gray-400">{artistType}</div>
              <p className="text-xs" style={{ color: r.color + 'CC' }}>
                {zh ? r.desc_zh : r.desc_en}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 5: Action buttons */}
        <AnimatePresence>
          {phase >= 5 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col gap-2.5 w-full mt-2"
            >
              <Button
                onClick={onGoToMatrix}
                className="w-full gap-2 text-sm"
                style={{ background: `linear-gradient(90deg, ${r.color}90, ${r.color}60)`, boxShadow: `0 0 16px ${r.glow}` }}
              >
                <Sparkles className="w-4 h-4" />
                {zh ? '进入MCN矩阵管理' : 'Enter MCN Matrix'} <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm"
                  className="border-white/15 text-gray-300 hover:bg-white/5 gap-1 text-xs"
                  onClick={onExport}>
                  <Download className="w-3.5 h-3.5" /> {zh ? '导出卡片' : 'Export Card'}
                </Button>
                <Button variant="outline" size="sm"
                  className="text-xs gap-1"
                  style={{ borderColor: r.color + '40', color: r.color }}
                  onClick={onShare}>
                  <Share2 className="w-3.5 h-3.5" /> {zh ? '分享艺人' : 'Share'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Burst particles */}
      <AnimatePresence>
        {phase >= 4 && particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: r.color,
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
            animate={{
              x: [0, p.vx, p.vx * 1.5],
              y: [0, p.vy, p.vy * 2 + 60],
              opacity: [p.opacity, p.opacity * 0.8, 0],
              scale: [1, 0.8, 0],
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: 1 + Math.random() * 2,
              ease: 'easeOut',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Glitch blocks */}
      {phase >= 3 && [0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none opacity-20"
          style={{
            backgroundColor: r.color,
            width: 20 + Math.random() * 60,
            height: 3,
            left: `${Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{ opacity: [0, 0.2, 0], scaleX: [0, 1, 0] }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.3, repeat: Infinity, repeatDelay: 2 + Math.random() * 3 }}
        />
      ))}
    </motion.div>
  );
};