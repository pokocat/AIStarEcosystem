/**
 * RoleSwitcherFAB — 右下角浮动身份切换器
 * 三端：运营端 / 明星IP端 / 品牌端
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Star, Building2, ChevronUp, X, Zap, Scissors, ShieldCheck, Radio } from 'lucide-react';
import type { Lang } from '../../translations';

export type PortalRole = 'operator' | 'celebrity' | 'brand';

interface RoleConfig {
  id: PortalRole;
  icon: React.ComponentType<any>;
  emoji: string;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const ROLES: RoleConfig[] = [
  {
    id: 'operator',
    icon: LayoutDashboard,
    emoji: '',
    labelZh: 'MCN运营端',
    labelEn: 'MCN Operator',
    descZh: 'IP孵化·内容创作·矩阵宣发·制作剪辑·审核法务',
    descEn: 'IP incubation · creation · distribution · review',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.25)',
    glow: 'rgba(6,182,212,0.35)',
  },
  {
    id: 'celebrity',
    icon: Star,
    emoji: '',
    labelZh: '明星IP端',
    labelEn: 'Celebrity IP',
    descZh: '报白审核·授权管理·侵权巡查·合同管理',
    descEn: 'Whitelist · authorization · infringement · contracts',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    glow: 'rgba(245,158,11,0.35)',
  },
  {
    id: 'brand',
    icon: Building2,
    emoji: '',
    labelZh: '品牌端',
    labelEn: 'Brand Portal',
    descZh: '投放需求·艺人匹配·效果追踪·ROI分析',
    descEn: 'Campaign briefs · artist matching · ROI tracking',
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.25)',
    glow: 'rgba(168,85,247,0.35)',
  },
];

interface Props {
  currentRole: PortalRole;
  lang: Lang;
  onSwitch: (role: PortalRole) => void;
}

export const RoleSwitcherFAB = ({ currentRole, lang, onSwitch }: Props) => {
  const zh = lang === 'zh';
  const [open, setOpen] = useState(false);

  const current = ROLES.find(r => r.id === currentRole)!;
  const CurrentIcon = current.icon;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
        {/* Role cards (expand upward) */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="flex flex-col gap-2 mb-1"
            >
              {/* Header label */}
              <div className="text-[9px] text-gray-500 uppercase tracking-widest text-right pr-1">
                {zh ? '切换身份' : 'Switch Role'}
              </div>

              {ROLES.map((role, i) => {
                const Icon = role.icon;
                const isActive = role.id === currentRole;
                return (
                  <motion.button
                    key={role.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ delay: (ROLES.length - 1 - i) * 0.04 }}
                    onClick={() => { onSwitch(role.id); setOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[220px] text-left transition-all active:scale-[0.97]"
                    style={{
                      background: isActive ? role.bg : 'rgba(15,15,15,0.92)',
                      border: `1px solid ${isActive ? role.border : 'rgba(255,255,255,0.08)'}`,
                      backdropFilter: 'blur(16px)',
                      boxShadow: isActive ? `0 0 20px ${role.glow}` : '0 4px 24px rgba(0,0,0,0.5)',
                    }}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: role.bg, border: `1px solid ${role.border}` }}>
                      <Icon className="w-4 h-4" style={{ color: role.color }} />
                    </div>

                    {/* Labels */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: isActive ? role.color : '#e5e7eb' }}>
                          {zh ? role.labelZh : role.labelEn}
                        </span>
                        {isActive && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${role.color}20`, color: role.color }}>
                            {zh ? '当前' : 'NOW'}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-0.5 truncate">
                        {zh ? role.descZh : role.descEn}
                      </div>
                    </div>

                    {/* Arrow */}
                    {!isActive && (
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${role.color}15` }}>
                        <Zap className="w-2.5 h-2.5" style={{ color: role.color }} />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB button */}
        <motion.button
          onClick={() => setOpen(v => !v)}
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.05 }}
          className="relative flex items-center gap-2.5 pl-3 pr-4 h-12 rounded-2xl text-sm font-bold shadow-2xl transition-all"
          style={{
            background: open
              ? 'rgba(30,30,30,0.98)'
              : `linear-gradient(135deg, ${current.color}cc 0%, ${current.color}77 100%)`,
            border: `1.5px solid ${open ? 'rgba(255,255,255,0.12)' : current.border}`,
            backdropFilter: 'blur(20px)',
            boxShadow: open ? '0 8px 32px rgba(0,0,0,0.6)' : `0 4px 24px ${current.glow}, 0 0 0 4px ${current.glow}40`,
          }}
        >
          {/* Pulse ring */}
          {!open && (
            <span className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ background: current.color }} />
          )}

          {/* Icon */}
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: open ? `${current.color}20` : 'rgba(255,255,255,0.2)' }}>
            <AnimatePresence mode="wait">
              {open ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-3.5 h-3.5" style={{ color: current.color }} />
                </motion.div>
              ) : (
                <motion.div key="icon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <CurrentIcon className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Label */}
          <span style={{ color: open ? current.color : '#fff' }}>
            {open ? (zh ? '关闭' : 'Close') : (zh ? current.labelZh : current.labelEn)}
          </span>

          {/* Chevron */}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronUp className="w-3.5 h-3.5" style={{ color: open ? current.color : 'rgba(255,255,255,0.7)' }} />
          </motion.div>
        </motion.button>
      </div>
    </>
  );
};