/**
 * ReviewerWorkbench — 审核/法务端工作台 · P3深化
 * 文案双审流水线 · 合规检查清单 · 侵权工单追踪 · 合同文件快速查阅
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, Eye, ChevronRight, ArrowLeft, BarChart3,
  Search, AlertCircle, Zap, FileCheck, Scale,
  Download, Plus, RefreshCw, TrendingUp, List,
  Lock, Star, Building2, Layers
} from 'lucide-react';
import type { Lang } from '../../translations';

interface Props { lang: Lang; onBack: () => void; }

type ReviewStage = 'ops_first' | 'partner_review' | 'legal_final' | 'qc_check' | 'compliance';
type Verdict = 'approved' | 'rejected' | 'pending' | 'needs_revision';

interface ReviewItem {
  id: string; title: string; type: '文案' | '成片' | '标题库';
  stage: ReviewStage; urgency: 'high' | 'normal';
  submittedBy: string; submittedAt: string;
  partnerName: string; content?: string;
  checklistScore?: number;
}

interface InfringementTicket {
  id: string; content: string; platform: string;
  confidence: number; status: 'open' | 'processing' | 'resolved' | 'rejected';
  discoveredAt: string; assignedTo?: string;
  evidenceCount: number;
}

interface DecisionRecord {
  id: string; title: string;
  verdict: Verdict; stage: ReviewStage;
  time: string; by: string; comment?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const REVIEW_QUEUE: ReviewItem[] = [
  { id: 'r1', title: '林音宝护肤产品口播稿-效果版', type: '文案', stage: 'partner_review', urgency: 'high',
    submittedBy: '运营李梅', submittedAt: '2小时前', partnerName: '林音宝',
    content: '大家好！今天测评这款网红护肤精华，用了28天，皮肤真的白了！', checklistScore: 72 },
  { id: 'r2', title: '清洁卫士评论区引导话术-夏季版', type: '文案', stage: 'ops_first', urgency: 'normal',
    submittedBy: '运营小陈', submittedAt: '4小时前', partnerName: '清洁卫士品牌方',
    content: '夏天来了！清洁卫士帮你解决厨房油污难题，效果100%好！', checklistScore: 58 },
  { id: 'r3', title: '林音宝数字人口播-护肤精华评测版', type: '成片', stage: 'qc_check', urgency: 'high',
    submittedBy: '制作小李', submittedAt: '1小时前', partnerName: '林音宝', checklistScore: 85 },
  { id: 'r4', title: '宋一鸣采访切片-年度规划精华#4', type: '成片', stage: 'compliance', urgency: 'normal',
    submittedBy: '剪辑小陈', submittedAt: '6小时前', partnerName: '宋一鸣', checklistScore: 91 },
  { id: 'r5', title: '顾然护肤联名商品卖点文案', type: '文案', stage: 'legal_final', urgency: 'high',
    submittedBy: '运营小赵', submittedAt: '30分钟前', partnerName: '顾然', checklistScore: 78 },
];

const INFRINGEMENT_TICKETS: InfringementTicket[] = [
  { id: 'it1', content: '宋一鸣618切片-极速数码手机开箱（未授权使用肖像）', platform: 'KS',
    confidence: 89, status: 'processing', discoveredAt: '3天前', assignedTo: '法务张', evidenceCount: 4 },
  { id: 'it2', content: '林音宝日常Vlog混剪-护肤晨间routine（疑似搬运）', platform: 'DY',
    confidence: 72, status: 'open', discoveredAt: '1周前', evidenceCount: 2 },
  { id: 'it3', content: '苏枝美妆测评-侵权背景音乐', platform: 'XHS',
    confidence: 95, status: 'resolved', discoveredAt: '2周前', assignedTo: '法务王', evidenceCount: 6 },
];

const DECISIONS: DecisionRecord[] = [
  { id: 'd1', title: '宋一鸣×极速数码618主推文案-V3', verdict: 'approved', stage: 'legal_final', time: '昨日 16:45', by: '法务张', comment: '已确认授权范围，可发布' },
  { id: 'd2', title: '林音宝短视频标题库-日常系列', verdict: 'approved', stage: 'legal_final', time: '昨日 17:00', by: '法务张' },
  { id: 'd3', title: '宋一鸣商品卖点文案-数码周', verdict: 'rejected', stage: 'ops_first', time: '前日 09:00', by: '运营小赵', comment: '含"全网最低价"违禁词，需修改' },
  { id: 'd4', title: '林音宝护肤产品口播稿-V1', verdict: 'needs_revision', stage: 'partner_review', time: '前日 14:00', by: '法务张', comment: '明星认可内容需林音宝本人确认后再签发' },
];

// ─── Compliance Checklist ─────────────────────────────────────────
const COMPLIANCE_ITEMS = [
  { id: 'cl1', zh: '无违禁词汇', en: 'No prohibited words', category: '法律', weight: 20 },
  { id: 'cl2', zh: '授权已核实', en: 'License verified', category: '授权', weight: 25 },
  { id: 'cl3', zh: '无虚假宣传', en: 'No false advertising', category: '法律', weight: 15 },
  { id: 'cl4', zh: '合规声明完整', en: 'Disclosure complete', category: '平台', weight: 15 },
  { id: 'cl5', zh: '艺人形象合规', en: 'Artist image compliant', category: '授权', weight: 10 },
  { id: 'cl6', zh: '价格表述规范', en: 'Price claims proper', category: '法律', weight: 15 },
];

const STAGE_CFG: Record<ReviewStage, { zh: string; en: string; color: string; bg: string }> = {
  ops_first:      { zh: '运营初审', en: 'Ops First',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  partner_review: { zh: '合作方复审', en: 'Partner Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  legal_final:    { zh: '法务终审', en: 'Legal Final',    color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  qc_check:       { zh: '质量审核', en: 'QC Check',       color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  compliance:     { zh: '内容合规', en: 'Compliance',     color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
};

const TICKET_STATUS_CFG = {
  open:       { zh: '待处理', en: 'Open',       color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  processing: { zh: '处理中', en: 'Processing', color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/25' },
  resolved:   { zh: '已解决', en: 'Resolved',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  rejected:   { zh: '已驳回', en: 'Rejected',   color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
};

export const ReviewerWorkbench = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'queue' | 'infringement' | 'decisions'>('queue');
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  const highUrgent = REVIEW_QUEUE.filter(r => r.urgency === 'high').length;
  const passRate = Math.round((DECISIONS.filter(d => d.verdict === 'approved').length / DECISIONS.length) * 100);
  const openTickets = INFRINGEMENT_TICKETS.filter(t => t.status === 'open' || t.status === 'processing').length;

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/10 transition">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-bold">{zh ? '审核/法务工作台' : 'Review Workbench'}</div>
              <div className="text-[10px] text-orange-400">{zh ? '审核·法务端' : 'Reviewer Role'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {highUrgent > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-[10px] font-bold animate-pulse">
                <AlertCircle className="w-3 h-3" />{highUrgent} {zh ? '紧急待审' : 'urgent'}
              </div>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-6">
          {([['queue', zh ? '审核队列' : 'Review Queue', Shield], ['infringement', zh ? '侵权工单' : 'Infringement', AlertTriangle], ['decisions', zh ? '决策记录' : 'Decisions', FileCheck]] as const).map(([t, label, Ic]) => {
            const TabIc = Ic;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-orange-400 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <TabIc className="w-3.5 h-3.5" />{label}
                {t === 'infringement' && openTickets > 0 && (
                  <span className="ml-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{openTickets}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: zh ? '待审总量' : 'Pending', value: REVIEW_QUEUE.length, color: '#f59e0b', icon: Clock },
            { label: zh ? '今日已审' : "Today's Done", value: 8, color: '#22c55e', icon: CheckCircle2 },
            { label: zh ? '侵权预警' : 'IP Alerts', value: openTickets, color: '#ef4444', icon: AlertTriangle },
            { label: zh ? '通过率' : 'Pass Rate', value: `${passRate}%`, color: '#06b6d4', icon: TrendingUp },
          ].map((s, i) => {
            const SIcon = s.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <SIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Review Queue Tab ─── */}
        {tab === 'queue' && (
          <div className="grid lg:grid-cols-[1fr_340px] gap-5">
            <div className="space-y-2">
              {REVIEW_QUEUE.map((item, i) => {
                const stageCfg = STAGE_CFG[item.stage];
                const isActive = activeReview === item.id;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`bg-gray-900/50 border rounded-xl overflow-hidden transition cursor-pointer ${isActive ? 'border-orange-500/30' : item.urgency === 'high' ? 'border-red-500/15' : 'border-white/5 hover:border-white/12'}`}
                    onClick={() => setActiveReview(isActive ? null : item.id)}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: stageCfg.bg, border: `1px solid ${stageCfg.color}30` }}>
                          {item.type === '文案' ? <FileText className="w-4 h-4" style={{ color: stageCfg.color }} /> :
                           item.type === '成片' ? <Eye className="w-4 h-4" style={{ color: stageCfg.color }} /> :
                           <List className="w-4 h-4" style={{ color: stageCfg.color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate mb-1">{item.title}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: stageCfg.bg, color: stageCfg.color }}>{zh ? stageCfg.zh : stageCfg.en}</span>
                            <span className={`text-[9px] font-bold ${item.urgency === 'high' ? 'text-red-400' : 'text-gray-600'}`}>
                              {item.urgency === 'high' ? (zh ? '紧急' : 'URGENT') : (zh ? '普通' : 'Normal')}
                            </span>
                            <span className="text-[10px] text-gray-500">{item.partnerName}</span>
                            <span className="text-[10px] text-gray-700">{item.submittedAt}</span>
                          </div>
                          {/* Checklist Score */}
                          {item.checklistScore !== undefined && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="text-[9px] text-gray-600">{zh ? '合规评分' : 'Compliance'}</div>
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${item.checklistScore}%`, background: item.checklistScore >= 80 ? '#22c55e' : item.checklistScore >= 60 ? '#f59e0b' : '#ef4444' }} />
                              </div>
                              <span className="text-[9px] font-bold" style={{ color: item.checklistScore >= 80 ? '#22c55e' : item.checklistScore >= 60 ? '#f59e0b' : '#ef4444' }}>{item.checklistScore}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 p-4" onClick={e => e.stopPropagation()}>
                          {/* Content preview */}
                          {item.content && (
                            <div className="mb-3 p-3 bg-black/30 rounded-xl border border-white/5">
                              <div className="text-[10px] text-gray-600 mb-1">{zh ? '内容预览' : 'Content Preview'}</div>
                              <p className="text-[10px] text-gray-300 leading-relaxed">{item.content}</p>
                            </div>
                          )}
                          {/* Compliance checklist quick view */}
                          <div className="mb-3 space-y-1.5">
                            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '合规检查项' : 'Compliance Checks'}</div>
                            {COMPLIANCE_ITEMS.slice(0, 4).map(check => (
                              <label key={check.id} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox"
                                  checked={!!checklistState[`${item.id}_${check.id}`]}
                                  onChange={e => setChecklistState(prev => ({ ...prev, [`${item.id}_${check.id}`]: e.target.checked }))}
                                  className="w-3.5 h-3.5 rounded border-gray-600 accent-orange-400" />
                                <span className="text-[10px] text-gray-300">{zh ? check.zh : check.en}</span>
                                <span className="text-[9px] text-gray-600 ml-auto">{check.weight}%</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition">
                              <CheckCircle2 className="w-3.5 h-3.5" />{zh ? '通过' : 'Approve'}
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition">
                              <RefreshCw className="w-3.5 h-3.5" />{zh ? '要求修改' : 'Revise'}
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition">
                              <XCircle className="w-3.5 h-3.5" />{zh ? '驳回' : 'Reject'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Right: Full compliance checklist + stage guide */}
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold text-white">{zh ? '合规检查清单' : 'Compliance Checklist'}</span>
                </div>
                <div className="space-y-2">
                  {COMPLIANCE_ITEMS.map(check => (
                    <div key={check.id} className="flex items-center gap-2 p-2 rounded-lg border border-white/5 hover:border-white/10 transition">
                      <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                        activeReview && checklistState[`${activeReview}_${check.id}`] ? 'bg-orange-400 border-orange-400' : 'border-gray-600'
                      }`}>
                        {activeReview && checklistState[`${activeReview}_${check.id}`] && (
                          <CheckCircle2 className="w-2 h-2 text-black" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-300 flex-1">{zh ? check.zh : check.en}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-600">{check.category}</span>
                      <span className="text-[9px] text-gray-600">{check.weight}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage pipeline */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{zh ? '审核流水线' : 'Review Pipeline'}</div>
                <div className="space-y-1.5">
                  {(Object.entries(STAGE_CFG) as [ReviewStage, typeof STAGE_CFG[ReviewStage]][]).map(([stage, cfg], i) => {
                    const count = REVIEW_QUEUE.filter(r => r.stage === stage).length;
                    return (
                      <div key={stage} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                        <span className="text-[10px] text-gray-400 flex-1">{zh ? cfg.zh : cfg.en}</span>
                        {count > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Infringement Tab ─── */}
        {tab === 'infringement' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{zh ? '侵权处置工单' : 'IP Complaint Tickets'}</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] font-bold hover:bg-orange-500/20 transition">
                <Plus className="w-3 h-3" />{zh ? '新建工单' : 'New Ticket'}
              </button>
            </div>
            {INFRINGEMENT_TICKETS.map((ticket, i) => {
              const stCfg = TICKET_STATUS_CFG[ticket.status];
              return (
                <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/15 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white leading-snug mb-1">{ticket.content}</div>
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        <span className="text-gray-500">{ticket.platform}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border text-[9px] ${stCfg.bg} ${stCfg.color}`}>
                          {zh ? stCfg.zh : stCfg.en}
                        </span>
                        <span className={`font-bold ${ticket.confidence >= 90 ? 'text-red-400' : ticket.confidence >= 70 ? 'text-amber-400' : 'text-gray-500'}`}>
                          {zh ? `置信度 ${ticket.confidence}%` : `${ticket.confidence}% confidence`}
                        </span>
                        <span className="text-gray-700">{ticket.discoveredAt}</span>
                        {ticket.assignedTo && <span className="text-cyan-400">{zh ? '负责人：' : 'Assigned: '}{ticket.assignedTo}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] text-gray-600">{ticket.evidenceCount}{zh ? '条证据' : ' evidence'}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {ticket.status === 'open' && (
                        <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/25 text-[9px] font-bold text-orange-400 hover:bg-orange-500/20 transition">
                          <Zap className="w-3 h-3" />{zh ? '接手处理' : 'Take Over'}
                        </button>
                      )}
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400 hover:border-white/20 transition">
                        <Eye className="w-3 h-3" />{zh ? '详情' : 'Detail'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ─── Decisions Tab ─── */}
        {tab === 'decisions' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap text-[10px]">
              {[
                { verdict: 'approved', zh: '已通过', en: 'Approved', color: 'text-emerald-400' },
                { verdict: 'rejected', zh: '已驳回', en: 'Rejected', color: 'text-red-400' },
                { verdict: 'needs_revision', zh: '要求修改', en: 'Revision', color: 'text-amber-400' },
              ].map(v => (
                <div key={v.verdict} className={`flex items-center gap-1 ${v.color}`}>
                  <div className={`w-2 h-2 rounded-full ${v.color.replace('text-', 'bg-')}`} />
                  {zh ? v.zh : v.en}: {DECISIONS.filter(d => d.verdict === v.verdict).length}
                </div>
              ))}
            </div>
            {DECISIONS.map((dec, i) => {
              const stageCfg = STAGE_CFG[dec.stage];
              return (
                <motion.div key={dec.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/12 transition">
                  <div className="mt-0.5 shrink-0">
                    {dec.verdict === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                     dec.verdict === 'rejected' ? <XCircle className="w-4 h-4 text-red-400" /> :
                     <RefreshCw className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate mb-0.5">{dec.title}</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: stageCfg.bg, color: stageCfg.color }}>{zh ? stageCfg.zh : stageCfg.en}</span>
                      <span className="text-gray-500">{dec.by}</span>
                      <span className="text-gray-700">{dec.time}</span>
                    </div>
                    {dec.comment && (
                      <div className="mt-1.5 text-[10px] text-gray-500 italic">{zh ? '备注：' : 'Note: '}{dec.comment}</div>
                    )}
                  </div>
                  <button className="shrink-0 p-1.5 rounded-lg border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
