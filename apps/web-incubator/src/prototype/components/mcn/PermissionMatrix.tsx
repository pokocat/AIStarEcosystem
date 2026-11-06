/**
 * PermissionMatrix — 权限矩阵
 * 5角色 × 全功能模块 权限对照表
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2, XCircle, Eye, Edit3, Trash2, Shield,
  Users, Mic2, Film, Search, Star, Lock, Info
} from 'lucide-react';
import type { Lang } from '../../translations';

type Role = 'operator' | 'celebrity' | 'studio' | 'reviewer' | 'brand';
type PermLevel = 'full' | 'view' | 'limited' | 'none';

interface ModulePerms {
  module: string; moduleEn: string; group: string; groupEn: string;
  perms: Record<Role, PermLevel>;
  note?: string; noteEn?: string;
}

const ROLES: { id: Role; zh: string; en: string; icon: React.ComponentType<any>; color: string; desc: string; descEn: string }[] = [
  { id: 'operator',  zh: 'MCN掌门人', en: 'Operator',    icon: Users,    color: '#06b6d4', desc: '平台最高权限', descEn: 'Full platform access' },
  { id: 'celebrity', zh: '艺人/明星端', en: 'Celebrity',  icon: Star,     color: '#f59e0b', desc: '本人相关数据', descEn: 'Own data only' },
  { id: 'studio',    zh: '制作/剪辑端', en: 'Studio',    icon: Film,     color: '#a855f7', desc: '生产相关功能', descEn: 'Production modules' },
  { id: 'reviewer',  zh: '审核/法务端', en: 'Reviewer',  icon: Shield,   color: '#ef4444', desc: '合规审核功能', descEn: 'Compliance & review' },
  { id: 'brand',     zh: '品牌方端',   en: 'Brand',      icon: Search,   color: '#22c55e', desc: '合作投放管理', descEn: 'Campaign management' },
];

const PERM_CFG: Record<PermLevel, { zh: string; en: string; icon: React.ComponentType<any>; color: string; bg: string }> = {
  full:    { zh: '完全', en: 'Full',    icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  view:    { zh: '只读', en: 'View',    icon: Eye,          color: 'text-blue-400',    bg: 'bg-blue-500/8'     },
  limited: { zh: '部分', en: 'Limited', icon: Edit3,        color: 'text-amber-400',   bg: 'bg-amber-500/8'    },
  none:    { zh: '禁止', en: 'None',    icon: XCircle,      color: 'text-red-400/60',  bg: 'bg-red-500/5'      },
};

const MODULES: ModulePerms[] = [
  // ─── 授权管理 ───
  { module: '授权台账',   moduleEn: 'License Vault',   group: '授权管理', groupEn: 'Authorization',
    perms: { operator: 'full', celebrity: 'view', studio: 'view', reviewer: 'full', brand: 'view' },
    note: '艺人仅查看自己授权', noteEn: 'Celebrity views own licenses only' },
  { module: '水印管理',   moduleEn: 'Watermark Mgmt',  group: '授权管理', groupEn: 'Authorization',
    perms: { operator: 'full', celebrity: 'none', studio: 'view', reviewer: 'view', brand: 'none' } },
  { module: '侵权巡查',   moduleEn: 'Infringement Patrol', group: '授权管理', groupEn: 'Authorization',
    perms: { operator: 'full', celebrity: 'view', studio: 'none', reviewer: 'full', brand: 'none' } },

  // ─── 数字资产 ───
  { module: '数字资产库', moduleEn: 'Asset Vault',     group: '数字资产', groupEn: 'Digital Assets',
    perms: { operator: 'full', celebrity: 'view', studio: 'full', reviewer: 'view', brand: 'none' } },
  { module: '文案库',     moduleEn: 'Copy Vault',      group: '数字资产', groupEn: 'Digital Assets',
    perms: { operator: 'full', celebrity: 'view', studio: 'full', reviewer: 'view', brand: 'none' } },

  // ─── 内容生产 ───
  { module: '切片制作台', moduleEn: 'Clip Studio',     group: '内容生产', groupEn: 'Production',
    perms: { operator: 'full', celebrity: 'none', studio: 'full', reviewer: 'none', brand: 'none' } },
  { module: 'AI数字人',   moduleEn: 'Digital Person',  group: '内容生产', groupEn: 'Production',
    perms: { operator: 'full', celebrity: 'view', studio: 'full', reviewer: 'none', brand: 'none' } },
  { module: '混剪批量台', moduleEn: 'Batch Mix',       group: '内容生产', groupEn: 'Production',
    perms: { operator: 'full', celebrity: 'none', studio: 'full', reviewer: 'none', brand: 'none' } },
  { module: 'AI孵化器',   moduleEn: 'AI Incubator',   group: '内容生产', groupEn: 'Production',
    perms: { operator: 'full', celebrity: 'limited', studio: 'none', reviewer: 'none', brand: 'none' },
    note: '艺人仅可查看/编辑自己的档案', noteEn: 'Celebrity edits own profile only' },

  // ─── 发布管控 ───
  { module: '发布池',     moduleEn: 'Publish Pool',    group: '发布管控', groupEn: 'Publishing',
    perms: { operator: 'full', celebrity: 'view', studio: 'limited', reviewer: 'view', brand: 'view' },
    note: '制作端可提交，审核端可放行', noteEn: 'Studio submits; Reviewer approves' },
  { module: '内容日历',   moduleEn: 'Content Calendar',group: '发布管控', groupEn: 'Publishing',
    perms: { operator: 'full', celebrity: 'view', studio: 'limited', reviewer: 'view', brand: 'view' } },
  { module: '投流管理',   moduleEn: 'Traffic Boost',   group: '发布管控', groupEn: 'Publishing',
    perms: { operator: 'full', celebrity: 'none', studio: 'none', reviewer: 'none', brand: 'limited' },
    note: '品牌方可管理自己的定向投流', noteEn: 'Brand manages own brand-initiated boosts' },

  // ─── 合规安全 ───
  { module: '内容审核',   moduleEn: 'Content Review',  group: '合规安全', groupEn: 'Compliance',
    perms: { operator: 'full', celebrity: 'view', studio: 'view', reviewer: 'full', brand: 'none' } },
  { module: 'MCN佣金',    moduleEn: 'MCN Commission',  group: '合规安全', groupEn: 'Compliance',
    perms: { operator: 'full', celebrity: 'view', studio: 'none', reviewer: 'view', brand: 'none' } },

  // ─── 数据与收益 ───
  { module: '数据看板',   moduleEn: 'Analytics',       group: '数据与收益', groupEn: 'Data & Revenue',
    perms: { operator: 'full', celebrity: 'limited', studio: 'view', reviewer: 'view', brand: 'limited' },
    note: '艺人/品牌仅看与自己相关的数据', noteEn: 'Celebrity/Brand see own data only' },
  { module: '账号管理',   moduleEn: 'Account Mgmt',    group: '数据与收益', groupEn: 'Data & Revenue',
    perms: { operator: 'full', celebrity: 'limited', studio: 'none', reviewer: 'view', brand: 'none' } },
  { module: '商业变现',   moduleEn: 'Monetization',    group: '数据与收益', groupEn: 'Data & Revenue',
    perms: { operator: 'full', celebrity: 'view', studio: 'none', reviewer: 'none', brand: 'view' } },
  { module: '版权资产',   moduleEn: 'Copyright',       group: '数据与收益', groupEn: 'Data & Revenue',
    perms: { operator: 'full', celebrity: 'view', studio: 'none', reviewer: 'full', brand: 'none' } },

  // ─── 品牌合作 ───
  { module: '品牌代理中心',moduleEn: 'Brand Agency',    group: '品牌合作', groupEn: 'Brand Partnership',
    perms: { operator: 'full', celebrity: 'none', studio: 'none', reviewer: 'none', brand: 'full' } },
  { module: '明星签约中心',moduleEn: 'Celebrity Sign',  group: '品牌合作', groupEn: 'Brand Partnership',
    perms: { operator: 'full', celebrity: 'view', studio: 'none', reviewer: 'view', brand: 'view' } },
];

// Group modules by group
const GROUPS = Array.from(new Set(MODULES.map(m => m.group)));

interface Props { lang: Lang; }

export const PermissionMatrix = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [highlightRole, setHighlightRole] = useState<Role | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [showLegend, setShowLegend] = useState(false);

  const filteredModules = filterGroup === 'all'
    ? MODULES
    : MODULES.filter(m => (zh ? m.group : m.groupEn) === filterGroup || m.group === filterGroup);

  const filteredGroups = filterGroup === 'all' ? GROUPS : GROUPS.filter(g => {
    const match = MODULES.find(m => m.group === g);
    return match && (match.group === filterGroup || match.groupEn === filterGroup);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '权限矩阵' : 'Permission Matrix'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '5大角色 × 全功能模块权限对照 — 授权链驱动的角色隔离' : '5 Roles × All Module Permissions — License-chain driven role isolation'}</p>
        </div>
        <button onClick={() => setShowLegend(!showLegend)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition">
          <Info className="w-3.5 h-3.5" />{zh ? '图例说明' : 'Legend'}
        </button>
      </div>

      {/* Legend */}
      {showLegend && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-gray-900/50 border border-white/5 rounded-xl">
          {(Object.entries(PERM_CFG) as [PermLevel, typeof PERM_CFG[PermLevel]][]).map(([key, cfg]) => {
            const CfgIcon = cfg.icon;
            return (
              <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg ${cfg.bg}`}>
                <CfgIcon className={`w-4 h-4 ${cfg.color}`} />
                <div>
                  <div className={`text-xs font-bold ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</div>
                  <div className="text-[9px] text-gray-600">
                    {key === 'full' ? (zh ? '创建/编辑/删除/查看' : 'Create/Edit/Delete/View') :
                     key === 'view' ? (zh ? '只可查看，不可修改' : 'View only, no modifications') :
                     key === 'limited' ? (zh ? '部分功能，受条件限制' : 'Partial, condition-gated') :
                     (zh ? '完全禁止访问' : 'No access')}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Role Cards */}
      <div className="grid grid-cols-5 gap-2">
        {ROLES.map(role => {
          const RIcon = role.icon;
          const isHighlit = highlightRole === role.id;
          return (
            <motion.button key={role.id}
              onClick={() => setHighlightRole(isHighlit ? null : role.id)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition text-center ${
                isHighlit
                  ? 'text-white'
                  : 'border-white/5 bg-gray-900/40 text-gray-400 hover:border-white/15'
              }`}
              style={isHighlit ? { borderColor: `${role.color}40`, background: `${role.color}10` } : {}}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${role.color}15` }}>
                <RIcon className="w-4.5 h-4.5" style={{ color: role.color }} />
              </div>
              <div className="text-[10px] font-bold leading-tight">{zh ? role.zh : role.en}</div>
              <div className="text-[8px] text-gray-600 leading-tight">{zh ? role.desc : role.descEn}</div>
              {isHighlit && (
                <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: role.color }} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Group Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterGroup('all')}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${filterGroup === 'all' ? 'bg-white/10 text-white border-white/20' : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'}`}>
          {zh ? '全部' : 'All'}
        </button>
        {GROUPS.map(g => {
          const gModule = MODULES.find(m => m.group === g);
          const label = zh ? g : (gModule?.groupEn || g);
          return (
            <button key={g} onClick={() => setFilterGroup(g === filterGroup ? 'all' : g)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition ${filterGroup === g ? 'bg-white/10 text-white border-white/20' : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Matrix Table */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left text-[10px] text-gray-600 uppercase tracking-wider px-4 py-3 w-44">
                  {zh ? '功能模块' : 'Module'}
                </th>
                {ROLES.map(role => {
                  const RIcon = role.icon;
                  const isHighlit = highlightRole === role.id;
                  return (
                    <th key={role.id} className="text-center px-3 py-3">
                      <div className={`flex flex-col items-center gap-1 transition ${isHighlit ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}>
                        <RIcon className="w-4 h-4" style={{ color: role.color }} />
                        <span className="text-[10px] font-bold" style={{ color: isHighlit ? role.color : undefined }}>{zh ? role.zh : role.en}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="text-left text-[10px] text-gray-600 uppercase tracking-wider px-3 py-3">
                  {zh ? '备注' : 'Notes'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, gi) => {
                const groupModules = filteredModules.filter(m => m.group === group);
                if (groupModules.length === 0) return null;
                const groupLabel = zh ? group : (groupModules[0]?.groupEn || group);
                return (
                  <React.Fragment key={group}>
                    <tr className="bg-black/20">
                      <td colSpan={ROLES.length + 2} className="px-4 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{groupLabel}</span>
                      </td>
                    </tr>
                    {groupModules.map((mod, mi) => (
                      <motion.tr key={mod.module}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: gi * 0.05 + mi * 0.02 }}
                        className="border-b border-white/3 hover:bg-white/[0.015] transition">
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-white">{zh ? mod.module : mod.moduleEn}</div>
                        </td>
                        {ROLES.map(role => {
                          const level = mod.perms[role.id];
                          const cfg = PERM_CFG[level];
                          const PIcon = cfg.icon;
                          const isHighlit = highlightRole === role.id;
                          return (
                            <td key={role.id} className={`text-center px-3 py-3 transition ${isHighlit ? 'bg-white/3' : ''}`}>
                              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${cfg.bg} transition ${isHighlit ? 'ring-1 ring-white/15' : ''}`}>
                                <PIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                              </div>
                              {isHighlit && (
                                <div className={`text-[8px] mt-0.5 ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3">
                          {(mod.note || mod.noteEn) && (
                            <div className="flex items-start gap-1 text-[10px] text-gray-600">
                              <Info className="w-3 h-3 text-gray-700 shrink-0 mt-0.5" />
                              {zh ? mod.note : mod.noteEn}
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards per role */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{zh ? '各角色权限总览' : 'Permission Summary by Role'}</div>
        <div className="grid grid-cols-5 gap-3">
          {ROLES.map(role => {
            const RIcon = role.icon;
            const fullCount = MODULES.filter(m => m.perms[role.id] === 'full').length;
            const viewCount = MODULES.filter(m => m.perms[role.id] === 'view').length;
            const limCount = MODULES.filter(m => m.perms[role.id] === 'limited').length;
            const noneCount = MODULES.filter(m => m.perms[role.id] === 'none').length;
            return (
              <div key={role.id} className="bg-gray-900/50 border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <RIcon className="w-4 h-4 shrink-0" style={{ color: role.color }} />
                  <span className="text-[10px] font-bold text-white leading-tight">{zh ? role.zh : role.en}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { count: fullCount, label: zh ? '完全' : 'Full', color: '#22c55e' },
                    { count: viewCount, label: zh ? '只读' : 'View', color: '#3b82f6' },
                    { count: limCount,  label: zh ? '部分' : 'Ltd',  color: '#f59e0b' },
                    { count: noneCount, label: zh ? '禁止' : 'None', color: '#ef4444' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between text-[9px]">
                      <span className="text-gray-600">{row.label}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(row.count / MODULES.length) * 100}%`, background: row.color }} />
                        </div>
                        <span style={{ color: row.color }} className="font-bold w-4 text-right">{row.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrix;
