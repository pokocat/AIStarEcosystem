/**
 * ContentPlanningBoard — AI内容规划台
 * P2 新增：AI策略建议 · 节点日历规划 · 热点追踪 · 内容矩阵看板
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wand2, Calendar, TrendingUp, Zap, Star, Target,
  ChevronRight, Plus, RefreshCw, MessageSquare, Flame,
  CheckCircle2, Clock, Eye, BarChart3, Sparkles, Globe,
  ArrowUpRight, Music, Video, Image, FileText, Play
} from 'lucide-react';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type ContentType = 'video' | 'image' | 'music' | 'live' | 'article';
type Priority = 'p0' | 'p1' | 'p2';

interface HotTopic {
  id: string; keyword: string; platform: string;
  heatScore: number; trend: 'up' | 'stable' | 'down';
  relevance: number; opportunity: string; opportunityEn: string;
}

interface PlanItem {
  id: string; title: string; type: ContentType; platform: string;
  artist: string; priority: Priority;
  scheduledDate: string; status: 'planned' | 'in_progress' | 'ready' | 'published';
  aiSuggestion?: string; aiSuggestionEn?: string;
  estimatedViews: number;
}

interface AIStrategy {
  id: string; artist: string; title: string; titleEn: string;
  insight: string; insightEn: string;
  actions: string[]; actionsEn: string[];
  urgency: 'high' | 'medium' | 'low'; color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const HOT_TOPICS: HotTopic[] = [
  { id: 'h1', keyword: '#换季护肤攻略', platform: 'XHS', heatScore: 98, trend: 'up',    relevance: 92, opportunity: '林音宝护肤系列最佳植入时机', opportunityEn: 'Best insert for Lin Yin Bao skincare' },
  { id: 'h2', keyword: '#秋装搭配灵感', platform: 'DY',  heatScore: 87, trend: 'up',    relevance: 78, opportunity: '服装品牌合作推广绝佳节点', opportunityEn: 'Perfect brand collab moment' },
  { id: 'h3', keyword: '#周末好物推荐', platform: 'XHS', heatScore: 76, trend: 'stable', relevance: 85, opportunity: '全品类带货通用模板可套用', opportunityEn: 'Universal template applicable' },
  { id: 'h4', keyword: '#跑步减肥打卡', platform: 'KS',  heatScore: 71, trend: 'up',    relevance: 60, opportunity: '健康类艺人差异化机会', opportunityEn: 'Niche opportunity for fitness artists' },
  { id: 'h5', keyword: '#职场穿搭OOTD', platform: 'DY',  heatScore: 68, trend: 'down',  relevance: 72, opportunity: '竞争激烈，建议差异化角度切入', opportunityEn: 'High competition — differentiate angle' },
];

const AI_STRATEGIES: AIStrategy[] = [
  {
    id: 's1', artist: '林音宝', title: '换季护肤窗口期爆款策略', titleEn: 'Skincare Season-Switch Viral Strategy',
    insight: '近7日换季护肤话题在小红书/抖音双端热度同步上升，林音宝护肤精华系列与此高度相关，建议3天内快速推出。',
    insightEn: 'Skincare season-switch topic surging on XHS+DY. Lin Yin Bao\'s skincare series is highly relevant — recommend fast launch within 3 days.',
    actions: ['今日发起口播脚本 AI 生成', '明日完成素材剪辑并提审', '后天06:00发布至XHS+DY，借助早高峰流量'],
    actionsEn: ['Today: Generate AI voiceover script', 'Tomorrow: Complete clip edit & review', 'Day 3 at 06:00: Publish to XHS+DY for morning traffic'],
    urgency: 'high', color: '#ef4444',
  },
  {
    id: 's2', artist: '宋一鸣', title: '《星河》打榜冲顶节点规划', titleEn: 'Xinghe Chart Topping Node Plan',
    insight: '《星河》当前热度91，排名#3，距离榜首差距在周末互动高峰可弥补。建议周六18:00-21:00集中矩阵账号协同冲榜。',
    insightEn: 'Xinghe hot score 91 at #3. Gap to #1 can be closed during weekend peak. Recommend matrix sync attack at Sat 18:00-21:00.',
    actions: ['提前安排24个矩阵账号待命', '准备周末互动话题激活粉丝', '同步启动平台扶持投流申请'],
    actionsEn: ['Prep 24 matrix accounts on standby', 'Prepare weekend fan activation topics', 'Apply for platform grant boost simultaneously'],
    urgency: 'medium', color: '#f59e0b',
  },
  {
    id: 's3', artist: '全体艺人', title: '双十一内容预埋30天行动', titleEn: 'Double 11 Content Pre-seeding 30-day Plan',
    insight: '距双十一还有60天，品牌方已开始提前布局。建议现在启动预热内容规划，覆盖种草→测评→开箱三阶段节奏。',
    insightEn: 'Double 11 in 60 days. Brands already planning. Recommend starting warm-up content plan: seed → review → unbox 3-phase rhythm.',
    actions: ['锁定合作品牌方并确认授权范围', '分配各艺人内容方向与档期', '开始AI辅助批量口播脚本生成'],
    actionsEn: ['Lock brand partners & confirm license scope', 'Assign content direction & schedule per artist', 'Start AI-assisted bulk voiceover script generation'],
    urgency: 'low', color: '#06b6d4',
  },
];

const PLAN_ITEMS: PlanItem[] = [
  { id: 'pi1', title: '林音宝-换季护肤精华测评', type: 'video', platform: 'XHS', artist: '林音宝',
    priority: 'p0', scheduledDate: '2025-09-13', status: 'in_progress', estimatedViews: 450000,
    aiSuggestion: 'AI建议：加入换季护肤话题标签，提升30%曝光概率', aiSuggestionEn: 'AI: Add seasonal skincare hashtag to boost exposure 30%' },
  { id: 'pi2', title: '宋一鸣《星河》挑战赛发起', type: 'video', platform: 'DY', artist: '宋一鸣',
    priority: 'p0', scheduledDate: '2025-09-14', status: 'planned', estimatedViews: 1200000,
    aiSuggestion: 'AI建议：配合周末流量高峰，18:00发布效果最佳', aiSuggestionEn: 'AI: 18:00 publish for weekend peak — optimal' },
  { id: 'pi3', title: '顾然同款穿搭-秋季OOTD', type: 'image', platform: 'XHS', artist: '顾然',
    priority: 'p1', scheduledDate: '2025-09-15', status: 'planned', estimatedViews: 320000 },
  { id: 'pi4', title: '林音宝直播-护肤答疑专场', type: 'live', platform: 'DY', artist: '林音宝',
    priority: 'p1', scheduledDate: '2025-09-16', status: 'ready', estimatedViews: 80000 },
  { id: 'pi5', title: '全员双十一种草内容启动会', type: 'article', platform: '内部', artist: '全体',
    priority: 'p2', scheduledDate: '2025-09-20', status: 'planned', estimatedViews: 0 },
];

const CONTENT_TYPE_CFG: Record<ContentType, { zh: string; en: string; icon: React.ComponentType<any>; color: string }> = {
  video:   { zh: '视频', en: 'Video',    icon: Video,       color: '#ec4899' },
  image:   { zh: '图文', en: 'Image',    icon: Image,       color: '#06b6d4' },
  music:   { zh: '音乐', en: 'Music',    icon: Music,       color: '#f59e0b' },
  live:    { zh: '直播', en: 'Live',     icon: Play,        color: '#ef4444' },
  article: { zh: '文章', en: 'Article',  icon: FileText,    color: '#a855f7' },
};

const PRIORITY_CFG: Record<Priority, { zh: string; en: string; color: string; bg: string; border: string }> = {
  p0: { zh: 'P0紧急', en: 'P0 Critical', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25' },
  p1: { zh: 'P1重要', en: 'P1 High',     color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25' },
  p2: { zh: 'P2计划', en: 'P2 Normal',   color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25' },
};

const STATUS_COLORS: Record<PlanItem['status'], string> = {
  planned: 'text-gray-500', in_progress: 'text-blue-400', ready: 'text-emerald-400', published: 'text-gray-600',
};

interface Props { lang: Lang; }

export const ContentPlanningBoard = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'strategy' | 'board' | 'hotspot'>('strategy');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? 'AI内容规划台' : 'AI Content Planning Board'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{zh ? 'AI策略建议 · 热点追踪 · 节点规划 · 内容矩阵看板' : 'AI strategy · Hot topic tracking · Node planning · Content matrix'}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:border-white/20 transition">
            <RefreshCw className="w-3.5 h-3.5" />{zh ? '刷新热点' : 'Refresh Trends'}
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition">
            <Plus className="w-3.5 h-3.5" />{zh ? '添加内容计划' : 'Add Plan'}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? 'AI策略建议' : 'AI Strategies', value: AI_STRATEGIES.length, color: '#a855f7', icon: Wand2 },
          { label: zh ? '热点追踪' : 'Hot Topics', value: HOT_TOPICS.length, color: '#ef4444', icon: Flame },
          { label: zh ? '本周计划' : 'This Week', value: PLAN_ITEMS.filter(p => p.status !== 'published').length, color: '#06b6d4', icon: Calendar },
          { label: zh ? '预估总曝光' : 'Est. Reach', value: `${(PLAN_ITEMS.reduce((s,p) => s + p.estimatedViews, 0) / 10000).toFixed(0)}万`, color: '#22c55e', icon: Eye },
        ].map((k, i) => {
          const KIcon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                <span className="text-[10px] text-gray-500">{k.label}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {([
          ['strategy', zh ? 'AI策略' : 'AI Strategy', Wand2],
          ['board',    zh ? '内容看板' : 'Content Board', BarChart3],
          ['hotspot',  zh ? '热点追踪' : 'Hot Topics', Flame],
        ] as const).map(([t, label, Ic]) => {
          const TabIc = Ic;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <TabIc className="w-3.5 h-3.5" />{label}
            </button>
          );
        })}
      </div>

      {/* ─── AI Strategy Tab ─── */}
      {tab === 'strategy' && (
        <div className="space-y-4">
          {AI_STRATEGIES.map((strategy, i) => {
            const isExpanded = selectedStrategy === strategy.id;
            return (
              <motion.div key={strategy.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`bg-gray-900/50 border rounded-xl overflow-hidden transition ${
                  strategy.urgency === 'high' ? 'border-red-500/20' :
                  strategy.urgency === 'medium' ? 'border-amber-500/15' : 'border-blue-500/15'
                }`}>
                <div className="flex items-start gap-4 p-5 cursor-pointer" onClick={() => setSelectedStrategy(isExpanded ? null : strategy.id)}>
                  {/* AI badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-purple-500/15 border border-purple-500/25">
                    <Wand2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-white">{zh ? strategy.title : strategy.titleEn}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                        style={{ color: strategy.color, borderColor: `${strategy.color}30`, background: `${strategy.color}10` }}>
                        {strategy.artist}
                      </span>
                      <span className={`text-[9px] font-bold ml-auto ${strategy.urgency === 'high' ? 'text-red-400' : strategy.urgency === 'medium' ? 'text-amber-400' : 'text-blue-400'}`}>
                        {strategy.urgency === 'high' ? (zh ? '高优' : 'HIGH') : strategy.urgency === 'medium' ? (zh ? '中优' : 'MED') : (zh ? '低优' : 'LOW')}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">{zh ? strategy.insight : strategy.insightEn}</p>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 px-5 pb-5">
                      <div className="mt-4 mb-3 text-[10px] text-gray-600 uppercase tracking-wider">{zh ? 'AI建议行动步骤' : 'AI Recommended Action Steps'}</div>
                      <div className="space-y-2">
                        {(zh ? strategy.actions : strategy.actionsEn).map((action, j) => (
                          <div key={j} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                            <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black"
                              style={{ borderColor: strategy.color, color: strategy.color }}>
                              {j + 1}
                            </div>
                            <span className="text-[10px] text-gray-300 leading-relaxed">{action}</span>
                          </div>
                        ))}
                      </div>
                      <button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition"
                        style={{ borderColor: `${strategy.color}30`, color: strategy.color, background: `${strategy.color}10` }}>
                        <Zap className="w-3.5 h-3.5" />{zh ? '立即执行' : 'Execute Now'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Content Board Tab ─── */}
      {tab === 'board' && (
        <div className="space-y-3">
          {/* Status legend */}
          <div className="flex gap-3 flex-wrap text-[10px]">
            {[['planned', zh ? '已规划' : 'Planned', 'text-gray-500'], ['in_progress', zh ? '制作中' : 'In Progress', 'text-blue-400'], ['ready', zh ? '待发布' : 'Ready', 'text-emerald-400']].map(([s, l, c]) => (
              <div key={s} className={`flex items-center gap-1 ${c}`}>
                <div className={`w-2 h-2 rounded-full ${c.replace('text-', 'bg-')}`} />{l}
              </div>
            ))}
          </div>

          {PLAN_ITEMS.map((item, i) => {
            const tCfg = CONTENT_TYPE_CFG[item.type];
            const TIcon = tCfg.icon;
            const pCfg = PRIORITY_CFG[item.priority];
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-gray-900/50 border rounded-xl p-4 hover:border-white/15 transition ${
                  item.priority === 'p0' ? 'border-red-500/15' :
                  item.priority === 'p1' ? 'border-amber-500/10' : 'border-white/5'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tCfg.color}15` }}>
                    <TIcon className="w-4 h-4" style={{ color: tCfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-white">{item.title}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}>
                        {zh ? pCfg.zh : pCfg.en}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                      <span>{item.artist}</span>
                      <span>{item.platform}</span>
                      <span className={STATUS_COLORS[item.status]}>
                        {item.status === 'planned' ? (zh ? '已规划' : 'Planned') :
                         item.status === 'in_progress' ? (zh ? '制作中' : 'In Progress') :
                         item.status === 'ready' ? (zh ? '待发布' : 'Ready') : (zh ? '已发布' : 'Published')}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />{item.scheduledDate}
                      </span>
                      {item.estimatedViews > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <Eye className="w-2.5 h-2.5" />{zh ? '预估' : 'Est.'} {(item.estimatedViews / 10000).toFixed(0)}万
                        </span>
                      )}
                    </div>
                    {item.aiSuggestion && (
                      <div className="flex items-start gap-1.5 mt-2 px-2.5 py-1.5 bg-purple-500/5 border border-purple-500/15 rounded-lg">
                        <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                        <span className="text-[10px] text-purple-300">{zh ? item.aiSuggestion : item.aiSuggestionEn}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {item.status === 'ready' && (
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition">
                        <Play className="w-3 h-3" />{zh ? '发布' : 'Publish'}
                      </button>
                    )}
                    {item.status === 'planned' && (
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition">
                        <Zap className="w-3 h-3" />{zh ? '开始制作' : 'Start'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Hot Topics Tab ─── */}
      {tab === 'hotspot' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <RefreshCw className="w-3 h-3" />
            {zh ? '数据更新时间：2025-09-11 14:30' : 'Data updated: 2025-09-11 14:30'}
          </div>
          {HOT_TOPICS.map((topic, i) => (
            <motion.div key={topic.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-start gap-4 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/15 transition">
              {/* Rank */}
              <div className="w-8 shrink-0 text-center">
                <div className={`text-lg font-black ${i === 0 ? 'text-red-400' : i === 1 ? 'text-amber-400' : i === 2 ? 'text-blue-400' : 'text-gray-600'}`}
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {i + 1}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">{topic.keyword}</span>
                  <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{topic.platform}</span>
                  <span className={`text-[9px] flex items-center gap-0.5 ml-auto ${topic.trend === 'up' ? 'text-emerald-400' : topic.trend === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
                    {topic.trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : ''}
                    {topic.trend === 'up' ? (zh ? '上升' : 'Rising') : topic.trend === 'down' ? (zh ? '下降' : 'Falling') : (zh ? '稳定' : 'Stable')}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mb-2">{zh ? topic.opportunity : topic.opportunityEn}</div>

                <div className="flex items-center gap-3">
                  {/* Heat bar */}
                  <div className="flex-1">
                    <div className="flex justify-between text-[9px] text-gray-600 mb-1">
                      <span>{zh ? '热度' : 'Heat'}</span>
                      <span className="text-red-400 font-bold">{topic.heatScore}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                        style={{ width: `${topic.heatScore}%` }} />
                    </div>
                  </div>
                  {/* Relevance */}
                  <div className="w-24">
                    <div className="flex justify-between text-[9px] text-gray-600 mb-1">
                      <span>{zh ? '相关度' : 'Relevance'}</span>
                      <span className="text-purple-400 font-bold">{topic.relevance}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500"
                        style={{ width: `${topic.relevance}%` }} />
                    </div>
                  </div>

                  <button className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-[9px] font-bold text-purple-400 hover:bg-purple-500/20 transition">
                    <Plus className="w-2.5 h-2.5" />{zh ? '纳入规划' : 'Plan'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
