/**
 * CopyVault — 文案库
 * P0 新增页面：文案录入 + 三阶段双审流程 + 版本锁定 + 禁用词检测
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Search, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, MessageSquare, Shield, Lock, Hash, Users, Star,
  Building2, Eye, Edit3, CornerDownRight, Filter, Layers
} from 'lucide-react';
import type { Lang } from '../../translations';

type CopyType = 'title' | 'script' | 'caption' | 'comment' | 'selling_point';
type ApprovalStage = 'draft' | 'ops_review' | 'partner_review' | 'legal_review' | 'approved' | 'rejected';

interface CopyItem {
  id: string; title: string; type: CopyType; content: string;
  stage: ApprovalStage; partnerScope: string; platformScope: string[];
  productScope: string; validFrom: string; validTo: string;
  version: number; author: string; createdAt: string;
  comments: { stage: string; author: string; text: string; time: string; passed: boolean }[];
  riskFlags: string[];
}

const MOCK_COPIES: CopyItem[] = [
  {
    id: 'cp1', title: '宋一鸣×极速数码618主推文案-V3', type: 'script', partnerScope: '宋一鸣',
    content: '姐妹们，今天给大家带来一个我自己用了三个月的手机，性能真的绝了！618期间限时优惠，比官网便宜800元，而且还有赠品...',
    stage: 'approved', platformScope: ['DY', 'KS'], productScope: '极速数码旗舰手机X12',
    validFrom: '2025-06-01', validTo: '2025-07-31', version: 3, author: '运营小王', createdAt: '2025-05-20',
    comments: [
      { stage: '运营初审', author: '运营小王', text: '整体方向OK，已去掉极限词', time: '2025-05-21 14:30', passed: true },
      { stage: '合作方复审', author: '宋一鸣团队', text: '口吻符合人设，无异议', time: '2025-05-22 10:00', passed: true },
      { stage: '法务终审', author: '法务张', text: '无违规用词，已通过', time: '2025-05-22 16:45', passed: true },
    ],
    riskFlags: [],
  },
  {
    id: 'cp2', title: '林音宝护肤产品口播稿-效果版', type: 'script', partnerScope: '林音宝',
    content: '大家好，今天来测评一下这款最新的精华液，我坚持使用了两周，皮肤确实有明显的变化，毛孔看起来收缩了很多...',
    stage: 'partner_review', platformScope: ['XHS', 'DY'], productScope: '轻奢护肤精华液',
    validFrom: '2025-09-01', validTo: '2025-10-31', version: 1, author: '运营李梅', createdAt: '2025-08-28',
    comments: [
      { stage: '运营初审', author: '运营李梅', text: '已检查禁用词，通过', time: '2025-08-29 11:00', passed: true },
      { stage: '合作方复审', author: '林音宝团队', text: '待审阅...', time: '', passed: false },
    ],
    riskFlags: [],
  },
  {
    id: 'cp3', title: '清洁卫士评论区引导话术-夏季版', type: 'comment', partnerScope: '清洁卫士品牌方',
    content: '家人们，这款清洁产品真的是夏天必备，去油污效果一级棒，而且无残留，厨房打扫再也不费劲了！想了解的直接评论区找我~',
    stage: 'ops_review', platformScope: ['DY', 'KS', 'XHS'], productScope: '多效厨房清洁剂',
    validFrom: '2025-07-01', validTo: '2025-08-31', version: 2, author: '运营小陈', createdAt: '2025-06-25',
    comments: [
      { stage: '运营初审', author: '运营小陈', text: '正在审核...', time: '', passed: false },
    ],
    riskFlags: [],
  },
  {
    id: 'cp4', title: '宋一鸣商品卖点文案-数码周', type: 'selling_point', partnerScope: '宋一鸣',
    content: '全球首发！最强拍照旗舰！史上最低价！三重大礼包免费送！',
    stage: 'rejected', platformScope: ['DY'], productScope: '极速数码旗舰手机',
    validFrom: '2025-06-10', validTo: '2025-06-18', version: 1, author: '运营小赵', createdAt: '2025-06-05',
    comments: [
      { stage: '运营初审', author: '运营小赵', text: '"全球首发"、"史上最低价"属于极限词，需修改', time: '2025-06-06 09:00', passed: false },
    ],
    riskFlags: ['全球首发', '史上最低价'],
  },
  {
    id: 'cp5', title: '林音宝短视频标题库-日常系列', type: 'title', partnerScope: '林音宝',
    content: '被这款精华"救"了！|测了20款终于找到它|素颜也能出门的秘密|',
    stage: 'approved', platformScope: ['XHS', 'DY', 'VCH'], productScope: '轻奢护肤系列',
    validFrom: '2025-08-01', validTo: '2025-12-31', version: 2, author: '运营李梅', createdAt: '2025-07-15',
    comments: [
      { stage: '运营初审', author: '运营李梅', text: '标题吸引力强，无违规', time: '2025-07-16 10:00', passed: true },
      { stage: '合作方复审', author: '林音宝团队', text: '认可，符合人设调性', time: '2025-07-17 14:00', passed: true },
      { stage: '法务终审', author: '法务张', text: '无问题', time: '2025-07-17 17:00', passed: true },
    ],
    riskFlags: [],
  },
];

const TYPE_CFG: Record<CopyType, { zh: string; en: string; color: string; bg: string }> = {
  title:         { zh: '标题', en: 'Title', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  script:        { zh: '口播稿', en: 'Script', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  caption:       { zh: '字幕稿', en: 'Caption', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  comment:       { zh: '评论引导', en: 'Comment', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  selling_point: { zh: '商品卖点', en: 'Selling Pt.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const STAGE_CFG: Record<ApprovalStage, { zh: string; color: string; bg: string; border: string; step: number }> = {
  draft:          { zh: '草稿', color: 'text-gray-500', bg: 'bg-gray-800/60', border: 'border-white/10', step: 0 },
  ops_review:     { zh: '运营初审', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25', step: 1 },
  partner_review: { zh: '合作方复审', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', step: 2 },
  legal_review:   { zh: '法务终审', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', step: 3 },
  approved:       { zh: '已通过', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', step: 4 },
  rejected:       { zh: '已驳回', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25', step: -1 },
};

const APPROVAL_STEPS = [
  { key: 'ops_review', zh: '运营初审', en: 'Ops Review', icon: Users, color: '#3b82f6' },
  { key: 'partner_review', zh: '合作方复审', en: 'Partner Review', icon: Star, color: '#f59e0b' },
  { key: 'legal_review', zh: '法务终审', en: 'Legal Review', icon: Shield, color: '#a855f7' },
];

interface Props { lang: Lang; }

export const CopyVault = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<ApprovalStage | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CopyType | 'all'>('all');
  const [selectedCopy, setSelectedCopy] = useState<CopyItem | null>(MOCK_COPIES[0]);

  const filtered = MOCK_COPIES.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || c.stage === stageFilter;
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchStage && matchType;
  });

  const stats = [
    { label: zh ? '总文案' : 'Total', value: MOCK_COPIES.length, color: 'text-white' },
    { label: zh ? '已通过' : 'Approved', value: MOCK_COPIES.filter(c => c.stage === 'approved').length, color: 'text-emerald-400' },
    { label: zh ? '审核中' : 'In Review', value: MOCK_COPIES.filter(c => ['ops_review', 'partner_review', 'legal_review'].includes(c.stage)).length, color: 'text-amber-400' },
    { label: zh ? '已驳回' : 'Rejected', value: MOCK_COPIES.filter(c => c.stage === 'rejected').length, color: 'text-red-400' },
  ];

  const getStepStatus = (copy: CopyItem, stepKey: string) => {
    const cfg = STAGE_CFG[copy.stage];
    const stepIdx = APPROVAL_STEPS.findIndex(s => s.key === stepKey);
    const comment = copy.comments.find(c => {
      if (stepKey === 'ops_review') return c.stage === '运营初审';
      if (stepKey === 'partner_review') return c.stage === '合作方复审';
      if (stepKey === 'legal_review') return c.stage === '法务终审';
      return false;
    });
    if (copy.stage === 'rejected' && comment && !comment.passed) return 'rejected';
    if (comment?.passed) return 'passed';
    if (copy.stage === stepKey) return 'current';
    if (cfg.step > stepIdx + 1) return 'passed';
    return 'pending';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '文案库' : 'Copy Vault'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? '文案录入 · 三阶段双审 · 版本锁定 · 禁用词检测' : 'Copy entry · 3-stage review · Version lock · Risk detection'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition">
          <Plus className="w-3.5 h-3.5" />
          {zh ? '新增文案' : 'New Copy'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-black ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Main split panel */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-4" style={{ minHeight: 520 }}>
        {/* Left: Copy list */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={zh ? '搜索文案...' : 'Search copies...'}
                className="w-full bg-black/30 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/40 transition" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'approved', 'partner_review', 'ops_review', 'rejected'] as const).map(s => {
                const scfg = s === 'all' ? null : STAGE_CFG[s];
                return (
                  <button key={s} onClick={() => setStageFilter(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition border ${stageFilter === s ? (s === 'all' ? 'bg-white/10 text-white border-white/20' : `${scfg!.bg} ${scfg!.color} ${scfg!.border}`) : 'bg-white/3 text-gray-500 border-white/5 hover:border-white/15'}`}>
                    {s === 'all' ? (zh ? '全部' : 'All') : (zh ? scfg!.zh : s)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.map((c, i) => {
              const tCfg = TYPE_CFG[c.type];
              const sCfg = STAGE_CFG[c.stage];
              const isSelected = selectedCopy?.id === c.id;
              return (
                <motion.button key={c.id} onClick={() => setSelectedCopy(c)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`w-full text-left p-3 rounded-xl transition border ${isSelected ? 'bg-amber-500/5 border-amber-500/25' : 'bg-black/20 border-white/5 hover:border-white/15'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${tCfg.bg} ${tCfg.color}`}>{zh ? tCfg.zh : tCfg.en}</span>
                    <span className="text-xs font-semibold text-white truncate">{c.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">{c.partnerScope} · V{c.version}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                      {zh ? sCfg.zh : c.stage}
                    </span>
                  </div>
                  {c.riskFlags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] text-red-400">{zh ? '含风险词：' : 'Risk: '}{c.riskFlags.join('、')}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Detail */}
        {selectedCopy ? (
          <motion.div key={selectedCopy.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-bold text-white">{selectedCopy.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {selectedCopy.partnerScope} · {selectedCopy.productScope} · V{selectedCopy.version} · {selectedCopy.author}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {selectedCopy.stage === 'approved' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold">
                      <Lock className="w-3 h-3" />{zh ? '已锁定版本' : 'Version Locked'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {selectedCopy.platformScope.map(p => (
                  <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">{p}</span>
                ))}
                <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                  {selectedCopy.validFrom} ~ {selectedCopy.validTo}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Content preview */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '文案内容' : 'Copy Content'}</div>
                <div className="bg-black/30 border border-white/8 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                  {selectedCopy.content}
                  {selectedCopy.riskFlags.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] text-red-400 font-bold mb-1">{zh ? '检测到风险词' : 'Risk Words Detected'}</div>
                        <div className="flex gap-1 flex-wrap">
                          {selectedCopy.riskFlags.map(f => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">"{f}"</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3-stage approval tracker */}
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{zh ? '三阶段审批流程' : '3-Stage Approval'}</div>
                <div className="space-y-2">
                  {APPROVAL_STEPS.map((step, si) => {
                    const StepIcon = step.icon;
                    const stepStatus = getStepStatus(selectedCopy, step.key);
                    const comment = selectedCopy.comments.find(c => {
                      if (step.key === 'ops_review') return c.stage === '运营初审';
                      if (step.key === 'partner_review') return c.stage === '合作方复审';
                      return c.stage === '法务终审';
                    });
                    return (
                      <div key={step.key} className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                        stepStatus === 'passed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                        stepStatus === 'current' ? 'bg-amber-500/5 border-amber-500/25' :
                        stepStatus === 'rejected' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-black/20 border-white/5 opacity-40'
                      }`}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${step.color}15` }}>
                          {stepStatus === 'passed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                           stepStatus === 'rejected' ? <XCircle className="w-4 h-4 text-red-400" /> :
                           stepStatus === 'current' ? <Clock className="w-4 h-4 text-amber-400 animate-pulse" /> :
                           <StepIcon className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{zh ? step.zh : step.en}</span>
                            {stepStatus === 'current' && <span className="text-[9px] text-amber-400 font-bold animate-pulse">{zh ? '审核中' : 'In Review'}</span>}
                          </div>
                          {comment && (
                            <div className="mt-1">
                              <div className="text-[10px] text-gray-500">{comment.author} · {comment.time || (zh ? '处理中...' : 'Processing...')}</div>
                              {comment.text && (
                                <div className="flex items-start gap-1 mt-0.5">
                                  <CornerDownRight className="w-2.5 h-2.5 text-gray-600 mt-0.5 shrink-0" />
                                  <span className="text-[10px] text-gray-400">{comment.text}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedCopy.stage !== 'approved' && selectedCopy.stage !== 'rejected' && (
              <div className="p-4 border-t border-white/5 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition">
                  <CheckCircle2 className="w-3.5 h-3.5" />{zh ? '通过' : 'Approve'}
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition">
                  <XCircle className="w-3.5 h-3.5" />{zh ? '驳回' : 'Reject'}
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
                  <Edit3 className="w-3.5 h-3.5" />{zh ? '修改' : 'Edit'}
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-gray-900/50 border border-white/5 rounded-xl flex items-center justify-center text-gray-600 text-sm">
            {zh ? '选择文案查看详情' : 'Select a copy to view details'}
          </div>
        )}
      </div>
    </div>
  );
};
