/**
 * 激活码兑换面板
 *
 * 有效示例码（可在界面内直接尝试）：
 *   WELCOME2026   → 30天Pro授权
 *   LITE-TRIAL    → 14天Lite试用
 *   PRO30         → 30天Pro授权 + SCN200星币
 *   COINS500      → SCN500星币
 *   COINS2000     → SCN2000星币（赠送）
 *   TRAIN-FREE    → 基础合规课程免费解锁
 *   ELITE7        → 7天Elite体验
 *   NEWMCN2026    → 15天Pro授权 + SCN300星币 + 基础课程
 *   AICREATE      → 1个月Pro授权 + AI创作认证课程
 *   PARTNER888    → 30天Elite授权 + SCN1000星币
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Ticket, X, ChevronRight, Sparkles, Check,
  AlertCircle, Package, Coins, GraduationCap, Crown,
  Zap, ArrowRight, RefreshCw, History, Copy, Eye, EyeOff
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Reward Types ─────────────────────────────────────────────────────────────

type RewardType = 'auth' | 'coins' | 'training' | 'bundle';
type AuthTier = 'lite' | 'pro' | 'elite';

interface Reward {
  type: RewardType;
  auth?: { tier: AuthTier; days: number };
  coins?: number;
  training?: { level: 'basic' | 'commerce' | 'ai'; name: { zh: string; en: string } };
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
}

interface CodeEntry {
  code: string;
  reward: Reward;
  limit: number; // -1 = unlimited, > 0 = usage count
}

// ─── Code Database ────────────────────────────────────────────────────────────

const CODE_DB: CodeEntry[] = [
  {
    code: 'WELCOME2026',
    limit: -1,
    reward: {
      type: 'auth',
      auth: { tier: 'pro', days: 30 },
      title: { zh: 'CEL 新年欢迎礼包', en: 'CEL New Year Welcome Pack' },
      desc: { zh: '感谢加入！已为您激活 30 天 Pro 套餐授权，立即开始探索平台全部功能。', en: 'Welcome! 30-day Pro plan access has been activated — explore all platform features now.' },
    },
  },
  {
    code: 'LITE-TRIAL',
    limit: -1,
    reward: {
      type: 'auth',
      auth: { tier: 'lite', days: 14 },
      title: { zh: 'SPK Lite 体验码', en: 'SPK Lite Trial Code' },
      desc: { zh: '已激活 14 天 Lite 套餐试用，支持 1 位明星合作资质 + 基础切片库。', en: '14-day Lite trial activated — 1 celebrity slot + basic clip library.' },
    },
  },
  {
    code: 'PRO30',
    limit: -1,
    reward: {
      type: 'bundle',
      auth: { tier: 'pro', days: 30 },
      coins: 200,
      title: { zh: 'RKT Pro 月卡 + 赠币', en: 'RKT Pro Monthly + Bonus Coins' },
      desc: { zh: '30 天 Pro 套餐授权 + SCN200 星币已到账，立即解锁 AI 工具与多平台分发。', en: '30-day Pro access + SCN200 star coins credited — unlock AI tools and multi-platform distribution.' },
    },
  },
  {
    code: 'COINS500',
    limit: -1,
    reward: {
      type: 'coins',
      coins: 500,
      title: { zh: 'SCN 星币补给码', en: 'SCN Star Coin Supplement' },
      desc: { zh: 'SCN500 星币已充入账户，可用于 AI 脚本 × 10 次 / AI 配音 × 4 分钟 / AI 视频 × 1 条。', en: 'SCN500 star coins added — use for AI scripts × 10 / AI voice × 4 min / AI video × 1.' },
    },
  },
  {
    code: 'COINS2000',
    limit: -1,
    reward: {
      type: 'coins',
      coins: 2000,
      title: { zh: 'SCN 星币大礼包', en: 'SCN Star Coin Mega Pack' },
      desc: { zh: 'SCN2000 星币 + 额外 20% 赠送（共 SCN2400）已到账！永不过期。', en: 'SCN2000 star coins + 20% bonus (SCN2400 total) added! Never expires.' },
    },
  },
  {
    code: 'TRAIN-FREE',
    limit: -1,
    reward: {
      type: 'training',
      training: { level: 'basic', name: { zh: '基础合规认证', en: 'Compliance Basics' } },
      title: { zh: 'SHD 课程免费兑换', en: 'SHD Free Course Redemption' },
      desc: { zh: '基础合规认证课程（原价 ¥980）已免费解锁，前往培训认证中心开始学习。', en: 'Compliance Basics course (¥980 value) unlocked for free — head to Training Center to start.' },
    },
  },
  {
    code: 'ELITE7',
    limit: -1,
    reward: {
      type: 'auth',
      auth: { tier: 'elite', days: 7 },
      title: { zh: 'CRN Elite 旗舰体验', en: 'CRN Elite Flagship Trial' },
      desc: { zh: '7 天 Elite 旗舰套餐已激活！无限明星资质 + 无限报白账号 + 最低 GMV 费率 1%。', en: '7-day Elite plan activated! Unlimited celebrity slots + accounts + lowest 1% GMV rate.' },
    },
  },
  {
    code: 'NEWMCN2026',
    limit: -1,
    reward: {
      type: 'bundle',
      auth: { tier: 'pro', days: 15 },
      coins: 300,
      training: { level: 'basic', name: { zh: '基础合规认证', en: 'Compliance Basics' } },
      title: { zh: 'MCN 新MCN入驻大礼包', en: 'MCN New MCN Onboarding Bundle' },
      desc: { zh: '15 天 Pro 授权 + SCN300 星币 + 基础合规课程全部解锁，开启您的AI艺人孵化之旅！', en: '15-day Pro access + SCN300 coins + Compliance course unlocked — start your AI artist journey!' },
    },
  },
  {
    code: 'AICREATE',
    limit: -1,
    reward: {
      type: 'bundle',
      auth: { tier: 'pro', days: 30 },
      training: { level: 'ai', name: { zh: 'AI创作认证', en: 'AI Creation Cert' } },
      title: { zh: 'SPK AI创作者大礼', en: 'SPK AI Creator Bundle' },
      desc: { zh: '30 天 Pro 授权 + AI创作认证课程（原价 ¥1,980）已解锁，解锁红区AI工具权限。', en: '30-day Pro access + AI Creation Cert (¥1,980 value) unlocked — Red Zone AI tools access granted.' },
    },
  },
  {
    code: 'PARTNER888',
    limit: -1,
    reward: {
      type: 'bundle',
      auth: { tier: 'elite', days: 30 },
      coins: 1000,
      title: { zh: 'HND 战略合作伙伴码', en: 'HND Strategic Partner Code' },
      desc: { zh: '30 天 Elite 旗舰授权 + SCN1000 星币已到账。感谢成为我们的战略合作伙伴！', en: '30-day Elite access + SCN1000 star coins credited. Thank you for being our strategic partner!' },
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_META: Record<AuthTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
  lite:  { label: 'Lite',  color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/25',   icon: 'LIT' },
  pro:   { label: 'Pro',   color: 'text-purple-400',  bg: 'bg-purple-500/10', border: 'border-purple-500/25', icon: 'PRO' },
  elite: { label: 'Elite', color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  icon: 'ELT' },
};

const TRAINING_META: Record<string, { color: string; icon: string }> = {
  basic:    { color: 'text-cyan-400',   icon: 'SHD' },
  commerce: { color: 'text-purple-400', icon: 'RKT' },
  ai:       { color: 'text-amber-400',  icon: 'SPK' },
};

// ─── Reward Display ────────────────────────────────────────────────────────────

const RewardBadge = ({ reward, zh }: { reward: Reward; zh: boolean }) => (
  <div className="flex flex-wrap gap-2">
    {reward.auth && (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${TIER_META[reward.auth.tier].bg} border ${TIER_META[reward.auth.tier].border} ${TIER_META[reward.auth.tier].color}`}>
        <span>{TIER_META[reward.auth.tier].icon}</span>
        {reward.auth.days}{zh ? '天' : 'd'} {TIER_META[reward.auth.tier].label}
      </div>
    )}
    {reward.coins && reward.coins > 0 && (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400">
        <Coins className="w-3 h-3" />SCN +{reward.coins.toLocaleString()}
      </div>
    )}
    {reward.training && (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 border border-white/10 ${TRAINING_META[reward.training.level].color}`}>
        <span>{TRAINING_META[reward.training.level].icon}</span>
        {zh ? reward.training.name.zh : reward.training.name.en}
      </div>
    )}
  </div>
);

// ─── Redemption History Item ──────────────────────────────────────────────────

interface HistoryEntry {
  code: string;
  reward: Reward;
  time: number;
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ActivationCodePanelProps {
  lang: Lang;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideBanner?: boolean;
}

export const ActivationCodePanel = ({ lang, open: externalOpen, onOpenChange, hideBanner = false }: ActivationCodePanelProps) => {
  const zh = lang === 'zh';
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [internalModalOpen, setInternalModalOpen] = useState(false);

  // Use external control if provided, otherwise use internal state
  const modalOpen = externalOpen !== undefined ? externalOpen : internalModalOpen;
  const setModalOpen = onOpenChange || setInternalModalOpen;
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [successReward, setSuccessReward] = useState<Reward | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const usedCodes = useRef<Set<string>>(new Set());

  // Focus input when modal opens
  useEffect(() => {
    if (modalOpen && state === 'idle') {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [modalOpen, state]);

  const handleRedeem = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    // Check if already used in this session
    if (usedCodes.current.has(trimmed)) {
      setState('error');
      setErrorMsg(zh ? '该激活码已被兑换过，每个码仅限使用一次。' : 'This code has already been redeemed — each code can only be used once.');
      return;
    }

    setState('loading');

    setTimeout(() => {
      const entry = CODE_DB.find(c => c.code === trimmed);
      if (entry) {
        usedCodes.current.add(trimmed);
        setSuccessReward(entry.reward);
        setHistory(prev => [{ code: trimmed, reward: entry.reward, time: Date.now() }, ...prev.slice(0, 9)]);
        setState('success');
      } else {
        setState('error');
        setErrorMsg(
          zh
            ? '无效的激活码，请检查输入是否正确（区分大小写，注意连字符）。'
            : 'Invalid activation code. Check for typos — codes are case-sensitive and may include hyphens.'
        );
      }
    }, 1200);
  };

  const handleReset = () => {
    setState('idle');
    setCode('');
    setSuccessReward(null);
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setModalOpen(false);
    setTimeout(() => { setState('idle'); setCode(''); setSuccessReward(null); setErrorMsg(''); setShowHistory(false); }, 300);
  };

  if (bannerDismissed || hideBanner) {
    // Only render modal when hideBanner is true
    if (!hideBanner) return null;
  }

  return (
    <>
      {/* ── Banner Strip ── */}
      <AnimatePresence>
        {!modalOpen && !hideBanner && (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-3 overflow-hidden"
          >
            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/8 via-cyan-500/6 to-amber-500/6 border border-purple-500/20 group overflow-hidden">
              {/* Animated shimmer */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.06) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
              />

              {/* Gift icon pulse */}
              <div className="relative shrink-0">
                <motion.div
                  className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center"
                  animate={{ boxShadow: ['0 0 0 0 rgba(168,85,247,0)', '0 0 0 6px rgba(168,85,247,0.12)', '0 0 0 0 rgba(168,85,247,0)'] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                </motion.div>
              </div>

              {/* Text */}
              <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-xs font-semibold text-white">{zh ? '有激活码？' : 'Have an activation code?'}</span>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  {zh ? '可兑换套餐授权、星币或培训课程' : 'Redeem for plan access, star coins, or training courses'}
                </span>
                <div className="flex gap-1.5 hidden sm:flex">
                  {['Lite', 'Pro', 'Elite', 'SCN 星币', '培训课'].map((tag, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-gray-600">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 relative z-10">
                {history.length > 0 && (
                  <button
                    onClick={() => { setModalOpen(true); setShowHistory(true); }}
                    className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition"
                  >
                    <History className="w-3 h-3" />{zh ? '兑换记录' : 'History'}
                  </button>
                )}
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200 transition"
                >
                  <Ticket className="w-3 h-3" />{zh ? '立即兑换' : 'Redeem'}
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-white/5 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && handleClose()}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="relative bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.08)' }}
            >
              {/* Header glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #a855f7, #06b6d4)' }} />

              {/* Close */}
              <button onClick={handleClose}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.08] transition z-10">
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="relative z-10 p-6">
                <AnimatePresence mode="wait">
                  {/* ── Idle / Input ── */}
                  {(state === 'idle' || state === 'loading') && !showHistory && (
                    <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="space-y-5">
                      {/* Title */}
                      <div className="flex items-center gap-3 pr-8">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-white">{zh ? '激活码兑换' : 'Redeem Activation Code'}</div>
                          <div className="text-[11px] text-gray-500">{zh ? '输入您的激活码，解锁套餐授权、星币或培训课程' : 'Enter your code to unlock plan access, star coins, or training'}</div>
                        </div>
                      </div>

                      {/* Input */}
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            ref={inputRef}
                            value={code}
                            onChange={e => { setCode(e.target.value.toUpperCase()); setState('idle'); }}
                            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                            placeholder={zh ? '输入激活码（如：WELCOME2026）' : 'Enter code (e.g., WELCOME2026)'}
                            maxLength={32}
                            className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-xl px-4 pr-12 text-sm font-mono text-white placeholder-gray-600 focus:border-purple-500/40 focus:outline-none transition tracking-widest uppercase"
                          />
                          <button
                            onClick={() => setShowHint(!showHint)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition"
                          >
                            {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Hint codes */}
                        <AnimatePresence>
                          {showHint && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden">
                              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
                                <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-2">{zh ? '可用示例码（点击填入）' : 'SAMPLE CODES — click to fill'}</div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {[
                                    { code: 'WELCOME2026', desc: zh ? '30天Pro' : '30d Pro' },
                                    { code: 'COINS500', desc: zh ? 'SCN500星币' : 'SCN500 coins' },
                                    { code: 'ELITE7', desc: zh ? '7天Elite' : '7d Elite' },
                                    { code: 'TRAIN-FREE', desc: zh ? '基础课程' : 'Basic course' },
                                    { code: 'NEWMCN2026', desc: zh ? '新MCN礼包' : 'MCN bundle' },
                                    { code: 'PARTNER888', desc: zh ? '合作伙伴' : 'Partner' },
                                  ].map(h => (
                                    <button key={h.code} onClick={() => { setCode(h.code); setShowHint(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/20 hover:bg-purple-500/5 transition group">
                                      <span className="text-[10px] font-mono text-gray-400 group-hover:text-purple-300 truncate">{h.code}</span>
                                      <span className="text-[9px] text-gray-600 shrink-0">{h.desc}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Redeem button */}
                      <motion.button
                        onClick={handleRedeem}
                        disabled={!code.trim() || state === 'loading'}
                        whileTap={{ scale: 0.97 }}
                        className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
                      >
                        {state === 'loading' ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" />{zh ? '验证中...' : 'Verifying...'}</>
                        ) : (
                          <><Sparkles className="w-4 h-4" />{zh ? '立即兑换' : 'Redeem Now'}</>
                        )}
                      </motion.button>

                      {/* History entry */}
                      {history.length > 0 && (
                        <button onClick={() => setShowHistory(true)}
                          className="w-full flex items-center justify-center gap-2 text-[11px] text-gray-600 hover:text-gray-400 transition py-1">
                          <History className="w-3 h-3" />{zh ? `查看兑换记录（${history.length} 条）` : `View history (${history.length})`}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* ── Error ── */}
                  {state === 'error' && (
                    <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="space-y-5">
                      <motion.div
                        animate={{ x: [0, -8, 8, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center gap-3 py-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                          <AlertCircle className="w-7 h-7 text-red-400" />
                        </div>
                        <div className="text-center">
                          <div className="text-base font-bold text-white">{zh ? '兑换失败' : 'Redemption Failed'}</div>
                          <div className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-xs">{errorMsg}</div>
                        </div>
                      </motion.div>
                      <div className="flex gap-3">
                        <button onClick={handleClose}
                          className="flex-1 h-10 rounded-xl border border-white/8 text-gray-400 text-sm hover:border-white/15 hover:text-white transition">
                          {zh ? '关闭' : 'Close'}
                        </button>
                        <button onClick={handleReset}
                          className="flex-1 h-10 rounded-xl text-white text-sm font-semibold transition"
                          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                          {zh ? '重新输入' : 'Try Again'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Success ── */}
                  {state === 'success' && successReward && !showHistory && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', damping: 20 }}
                      className="space-y-5">

                      {/* Particles burst */}
                      <div className="flex flex-col items-center gap-3 py-2">
                        <motion.div
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 14, delay: 0.1 }}
                          className="relative w-16 h-16 rounded-2xl bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center"
                          style={{ boxShadow: '0 0 30px rgba(34,197,94,0.2)' }}
                        >
                          <Check className="w-8 h-8 text-green-400" />
                          {/* Ring pulse */}
                          <motion.div
                            className="absolute inset-0 rounded-2xl border-2 border-green-500/30"
                            animate={{ scale: [1, 1.5, 1.8], opacity: [0.6, 0.2, 0] }}
                            transition={{ duration: 1.2, delay: 0.3, repeat: 2 }}
                          />
                        </motion.div>

                        <div className="text-center">
                          <div className="text-lg font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                            {zh ? successReward.title.zh : successReward.title.en}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                            {zh ? successReward.desc.zh : successReward.desc.en}
                          </div>
                        </div>
                      </div>

                      {/* Reward badges */}
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                        <div className="text-[9px] uppercase tracking-widest text-gray-600">{zh ? '已解锁内容' : 'UNLOCKED'}</div>
                        <RewardBadge reward={successReward} zh={zh} />
                      </div>

                      {/* Code display */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] font-mono text-gray-600">{zh ? '已兑换：' : 'Redeemed:'} <span className="text-gray-400">{code}</span></span>
                        <span className="text-[9px] text-green-500 flex items-center gap-1"><Check className="w-2.5 h-2.5" />{zh ? '成功' : 'OK'}</span>
                      </div>

                      {/* CTA */}
                      <div className="flex gap-3">
                        <button onClick={() => { handleReset(); }}
                          className="flex-1 h-10 rounded-xl border border-white/8 text-gray-400 text-xs hover:border-white/15 hover:text-white transition flex items-center justify-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5" />{zh ? '再兑一个' : 'Redeem Another'}
                        </button>
                        <button onClick={handleClose}
                          className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition"
                          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                          {zh ? '开始使用 →' : 'Start Using →'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── History ── */}
                  {showHistory && (
                    <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="space-y-4">
                      <div className="flex items-center gap-3 pr-8">
                        <button onClick={() => setShowHistory(false)}
                          className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center text-gray-500 hover:text-white transition">
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                        <div>
                          <div className="text-sm font-bold text-white">{zh ? '兑换记录' : 'Redemption History'}</div>
                          <div className="text-[10px] text-gray-600">{zh ? `本次会话共兑换 ${history.length} 次` : `${history.length} redemption(s) this session`}</div>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {history.length === 0 ? (
                          <div className="text-center py-8 text-gray-600 text-xs">{zh ? '暂无兑换记录' : 'No redemptions yet'}</div>
                        ) : history.map((h, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-gray-400 bg-white/[0.03] px-1.5 py-0.5 rounded">{h.code}</span>
                                <span className="text-[9px] text-gray-600">{new Date(h.time).toLocaleTimeString(zh ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="text-xs text-white mt-1">{zh ? h.reward.title.zh : h.reward.title.en}</div>
                              <div className="mt-1.5">
                                <RewardBadge reward={h.reward} zh={zh} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => setShowHistory(false)}
                        className="w-full h-10 rounded-xl border border-white/8 text-gray-400 text-sm hover:border-white/15 hover:text-white transition">
                        {zh ? '兑换新激活码' : 'Redeem New Code'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ActivationCodePanel;
