import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2, Check, ChevronUp, Heart, Home, Rocket, Scissors, Shield, Smartphone, Star, X,
} from 'lucide-react';
import type { Lang } from '../translations';
import { getSolutionLabel, type SolutionId } from '../data/ipPlatform';

export type PortId = 'creator' | 'celebrity' | 'fan' | 'brand' | 'admin' | 'miniapp_entrepreneur' | 'miniapp_clip';

interface PortConfig {
  id: PortId;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  name: { zh: string; en: string };
  desc: { zh: string; en: string };
  color: string;
}

const PRIMARY_PORTS: PortConfig[] = [
  { id: 'creator', icon: Rocket, color: '#06b6d4', name: { zh: '生态创业者工作台', en: 'Creator Studio' }, desc: { zh: 'IP 孵化 · 内容生产 · 矩阵运营 · 变现', en: 'Incubate · Produce · Distribute · Monetize' } },
  { id: 'celebrity', icon: Star, color: '#f59e0b', name: { zh: '明星 IP 端', en: 'Celebrity IP Portal' }, desc: { zh: '报白审核 · 授权管理 · 侵权巡查 · 合同', en: 'Whitelist · Licensing · Patrol · Contracts' } },
  { id: 'fan', icon: Heart, color: '#ec4899', name: { zh: '星海粉丝端', en: 'StarSea Fan App' }, desc: { zh: '观看作品 · 互动打赏 · 收藏 · 社区', en: 'Watch · Tip · Collect · Community' } },
];

const MORE_PORTS: PortConfig[] = [
  { id: 'brand', icon: Building2, color: '#a855f7', name: { zh: '品牌端', en: 'Brand Portal' }, desc: { zh: '投放需求 · 艺人匹配 · ROI', en: 'Briefs · Matching · ROI' } },
  { id: 'admin', icon: Shield, color: '#64748b', name: { zh: '运营后台', en: 'Admin Console' }, desc: { zh: '用户 · 内容审核 · 法务 · 数据', en: 'Users · Moderation · Legal · Data' } },
  { id: 'miniapp_entrepreneur', icon: Smartphone, color: '#22d3ee', name: { zh: '创业者小程序', en: 'Entrepreneur App' }, desc: { zh: '运营 · 任务 · 变现', en: 'Ops · Tasks · Revenue' } },
  { id: 'miniapp_clip', icon: Scissors, color: '#f43f5e', name: { zh: '切片小程序', en: 'Clip Mini-App' }, desc: { zh: '明星切片 · 带货任务', en: 'Star clips · Commerce' } },
];

const ALL_PORTS = [...PRIMARY_PORTS, ...MORE_PORTS];

interface Props {
  current: PortId;
  lang: Lang;
  solution: SolutionId;
  onSwitch: (port: PortId) => void;
  onHome: () => void;
  /** Raise the button on pages that have their own bottom bars (e.g. the fan app). */
  raised?: boolean;
  /** Icon-only button for dense pages (consoles) where a wide pill would cover content. */
  compact?: boolean;
}

/** Floating switcher for moving between the three ports (plus brand portal and mini-apps) without returning to a chooser page. */
export const PortSwitcher = ({ current, lang, solution, onSwitch, onHome, raised, compact }: Props) => {
  const zh = lang === 'zh';
  const [open, setOpen] = useState(false);
  const active = ALL_PORTS.find(port => port.id === current) ?? PRIMARY_PORTS[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = (port: PortId) => {
    setOpen(false);
    if (port !== current) onSwitch(port);
  };

  const renderPort = (port: PortConfig, compact = false) => {
    const Icon = port.icon;
    const isActive = port.id === current;
    return (
      <button
        key={port.id}
        type="button"
        onClick={() => choose(port.id)}
        className={`w-full flex items-center gap-3 rounded-xl text-left transition ${compact ? 'p-2.5' : 'p-3'} ${isActive ? '' : 'hover:bg-white/[0.05]'}`}
        style={isActive ? { background: `${port.color}18`, boxShadow: `inset 0 0 0 1px ${port.color}45` } : undefined}
      >
        <span className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} shrink-0 rounded-xl flex items-center justify-center`} style={{ background: `${port.color}1f`, border: `1px solid ${port.color}40` }}>
          <Icon className="w-4 h-4" style={{ color: port.color }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white truncate">{port.name[lang]}</span>
          {!compact && <span className="block text-xs text-gray-500 mt-0.5 truncate">{port.desc[lang]}</span>}
        </span>
        {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: port.color }} />}
      </button>
    );
  };

  return (
    <div className="keep-dark">
      <AnimatePresence>
        {open && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[185] bg-black/30" onClick={() => setOpen(false)} />
        )}
      </AnimatePresence>

      <div className={`fixed right-5 z-[190] flex flex-col items-end gap-3 ${raised ? 'bottom-36' : 'bottom-5'}`}>
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              role="dialog"
              aria-label={zh ? '切换系统端口' : 'Switch portal'}
              initial={{ opacity: 0, y: 14, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: .97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-[300px] max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#080b12]/95 backdrop-blur-xl p-3 text-white"
              style={{ boxShadow: '0 24px 60px rgba(0,0,0,.55)' }}
            >
              <div className="flex items-center justify-between px-1.5 pb-2">
                <div>
                  <div className="text-xs text-gray-500">{zh ? '当前方案' : 'Current solution'}</div>
                  <div className="text-sm font-semibold">{getSolutionLabel(solution)[lang]}</div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label={zh ? '关闭' : 'Close'} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-gray-500 px-1.5 pt-2 pb-1.5">{zh ? '三端切换' : 'Portals'}</div>
              <div className="space-y-1">{PRIMARY_PORTS.map(port => renderPort(port))}</div>
              <div className="text-xs text-gray-500 px-1.5 pt-4 pb-1.5">{zh ? '更多入口' : 'More'}</div>
              <div className="space-y-0.5">{MORE_PORTS.map(port => renderPort(port, true))}</div>
              <button type="button" onClick={() => { setOpen(false); onHome(); }}
                className="mt-3 w-full h-10 rounded-xl border border-white/10 text-sm text-gray-300 hover:text-white hover:border-white/25 inline-flex items-center justify-center gap-2 transition">
                <Home className="w-4 h-4" /> {zh ? '返回方案首页' : 'Back to Homepage'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-label={zh ? `切换系统端口（当前：${active.name.zh}）` : `Switch portal (current: ${active.name.en})`}
          title={compact ? `${zh ? '切换端口' : 'Switch portal'} · ${active.name[lang]}` : undefined}
          whileHover={{ y: -2 }}
          whileTap={{ scale: .96 }}
          className={`flex items-center gap-2.5 rounded-full border bg-black/85 backdrop-blur-xl p-1.5 text-white ${compact ? '' : 'sm:pr-4'}`}
          style={{ borderColor: `${active.color}55`, boxShadow: `0 12px 36px rgba(0,0,0,.45), 0 0 24px ${active.color}25` }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${active.color}, ${active.color}aa)` }}>
            <ActiveIcon className="w-4 h-4 text-white" />
          </span>
          <span className={`${compact ? 'hidden' : 'hidden sm:block'} text-left leading-tight`}>
            <span className="block text-xs text-gray-400">{zh ? '切换端口' : 'Switch portal'}</span>
            <span className="block text-sm font-semibold max-w-[150px] truncate">{active.name[lang]}</span>
          </span>
          <ChevronUp className={`${compact ? 'hidden' : 'hidden sm:block'} w-4 h-4 text-gray-400 transition-transform ${open ? '' : 'rotate-180'}`} />
        </motion.button>
      </div>
    </div>
  );
};

export default PortSwitcher;
