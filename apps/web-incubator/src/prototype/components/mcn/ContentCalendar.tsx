/**
 * 内容日历 · 发布任务计划
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Plus, Clock, CheckCircle2, AlertCircle, Play,
  Video, Image, Mic2, ChevronLeft, ChevronRight, Filter,
  Edit3, Trash2, Zap, Globe, Target, TrendingUp, X,
  Sparkles, Users, ShoppingBag, Rocket, Eye
} from 'lucide-react';
import type { Lang } from '../../translations';

type TaskStatus = 'draft' | 'producing' | 'review' | 'scheduled' | 'published' | 'failed';
type ContentType = 'clip' | 'live_clip' | 'graphic' | 'voiceover';

interface PublishTask {
  id: string;
  title: string;
  platform: string;
  account: string;
  artist: string;
  celebrity?: string;
  contentType: ContentType;
  status: TaskStatus;
  scheduledAt: string;
  dayOfMonth: number;
  month: number;
  gmvTarget?: string;
  notes?: string;
}

const STATUS_CFG: Record<TaskStatus, { zh: string; en: string; color: string; bg: string; icon: any }> = {
  draft:      { zh: '待制作', en: 'Draft',      color: 'text-gray-400',   bg: 'bg-gray-500/15 border-gray-500/25',   icon: Edit3 },
  producing:  { zh: '制作中', en: 'Producing',  color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/25',   icon: Zap },
  review:     { zh: '审核中', en: 'In Review',  color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/25', icon: Eye },
  scheduled:  { zh: '待发布', en: 'Scheduled',  color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/25',icon: Clock },
  published:  { zh: '已发布', en: 'Published',  color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/25', icon: CheckCircle2 },
  failed:     { zh: '发布失败',en: 'Failed',    color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/25',     icon: AlertCircle },
};

const TYPE_CFG: Record<ContentType, { zh: string; en: string; icon: any; color: string }> = {
  clip:       { zh: '切片视频', en: 'Clip Video',  icon: Video, color: '#a855f7' },
  live_clip:  { zh: '直播切片', en: 'Live Clip',   icon: Play,  color: '#ef4444' },
  graphic:    { zh: '图文内容', en: 'Graphic',     icon: Image, color: '#06b6d4' },
  voiceover:  { zh: 'AI配音',  en: 'AI Voiceover',icon: Mic2,  color: '#f59e0b' },
};

const PLATFORM_ICONS: Record<string, string> = {
  '抖音': 'DYN', '快手': 'KSH', '视频号': 'WCH', '小红书': 'XHS', 'B站': 'BLB',
};

const MOCK_TASKS: PublishTask[] = [
  { id: 't1', title: '陆承远《烽火长歌》切片 · 战术刀具带货', platform: '抖音', account: '@neon_v_official', artist: 'Neon V', celebrity: '陆承远', contentType: 'clip', status: 'scheduled', scheduledAt: '2026-05-08 18:00', dayOfMonth: 8, month: 5, gmvTarget: '¥8,000' },
  { id: 't2', title: '顾星辰同款护肤套装 · AI口播脚本', platform: '快手', account: '@luna_soft_ks', artist: 'Luna Soft', celebrity: '顾星辰', contentType: 'voiceover', status: 'producing', scheduledAt: '2026-05-09 20:00', dayOfMonth: 9, month: 5 },
  { id: 't3', title: '苏念美妆推荐 · 图文种草', platform: '小红书', account: '@project_zero_xhs', artist: 'Project Zero', celebrity: '苏念', contentType: 'graphic', status: 'review', scheduledAt: '2026-05-10 12:00', dayOfMonth: 10, month: 5, gmvTarget: '¥5,500' },
  { id: 't4', title: '江野联名球鞋 · 直播切片', platform: '视频号', account: '@neonv_channel', artist: 'Neon V', celebrity: '江野', contentType: 'live_clip', status: 'draft', scheduledAt: '2026-05-12 19:30', dayOfMonth: 12, month: 5 },
  { id: 't5', title: '陆承远古装剧切片 · 茶叶品牌', platform: '抖音', account: '@neon_v_official', artist: 'Neon V', celebrity: '陆承远', contentType: 'clip', status: 'published', scheduledAt: '2026-05-05 18:00', dayOfMonth: 5, month: 5, gmvTarget: '¥12,800' },
  { id: 't6', title: 'AI艺人孵化宣传片 · 无明星', platform: 'B站', account: '@luna_soft_bili', artist: 'Luna Soft', contentType: 'clip', status: 'draft', scheduledAt: '2026-05-15 20:00', dayOfMonth: 15, month: 5 },
  { id: 't7', title: '顾星辰同款腕表 · 视频脚本', platform: '微博', account: '@neon_official', artist: 'Neon V', celebrity: '顾星辰', contentType: 'clip', status: 'scheduled', scheduledAt: '2026-05-13 16:00', dayOfMonth: 13, month: 5, gmvTarget: '¥18,000' },
];

const DAYS_IN_MAY = Array.from({ length: 31 }, (_, i) => i + 1);
const TODAY = 7;

export const ContentCalendar = ({ lang }: { lang: Lang }) => {
  const zh = lang === 'zh';
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const filtered = MOCK_TASKS.filter(t => filterStatus === 'all' || t.status === filterStatus);
  const tasksForDay = (day: number) => MOCK_TASKS.filter(t => t.dayOfMonth === day);
  const selectedDayTasks = selectedDay ? tasksForDay(selectedDay) : [];

  const stats = {
    total: MOCK_TASKS.length,
    published: MOCK_TASKS.filter(t => t.status === 'published').length,
    scheduled: MOCK_TASKS.filter(t => t.status === 'scheduled').length,
    draft: MOCK_TASKS.filter(t => ['draft', 'producing'].includes(t.status)).length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {zh ? '内容日历' : 'Content Calendar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{zh ? '发布任务规划 · 多平台分发管理' : 'Publishing task planning · Multi-platform distribution'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.03] border border-white/5 rounded-xl p-1">
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === v ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
                {v === 'calendar' ? (zh ? '日历' : 'Calendar') : (zh ? '列表' : 'List')}
              </button>
            ))}
          </div>
          <button onClick={() => setNewTaskOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
            <Plus className="w-4 h-4" />{zh ? '新建任务' : 'New Task'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: { zh: '本月任务', en: 'This Month' }, value: stats.total, color: '#06b6d4' },
          { label: { zh: '已发布', en: 'Published' },    value: stats.published, color: '#22c55e' },
          { label: { zh: '待发布', en: 'Scheduled' },    value: stats.scheduled, color: '#a855f7' },
          { label: { zh: '制作中', en: 'In Progress' },   value: stats.draft, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-900/50 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{zh ? s.label.zh : s.label.en}</div>
          </div>
        ))}
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-bold text-white">2026年5月</span>
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition text-gray-500"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setNewTaskOpen(true)} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition">
              <Sparkles className="w-3.5 h-3.5" />{zh ? 'AI批量生成本月计划' : 'AI Auto-generate Monthly Plan'}
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-600 mb-1">
            {(zh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days grid — May 2026 starts on Friday (index 5) */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 5 }).map((_, i) => <div key={`pre-${i}`} />)}
            {DAYS_IN_MAY.map(day => {
              const dayTasks = tasksForDay(day);
              const isToday = day === TODAY;
              const isSelected = selectedDay === day;
              return (
                <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[64px] p-1.5 rounded-xl border text-left transition ${isSelected ? 'border-purple-500/50 bg-purple-500/10' : isToday ? 'border-cyan-500/30 bg-cyan-500/8' : 'border-white/5 hover:border-white/10 bg-gray-900/30'}`}>
                  <div className={`text-xs font-bold mb-1 ${isToday ? 'text-cyan-400' : 'text-gray-400'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => {
                      const cfg = STATUS_CFG[t.status];
                      const platIcon = PLATFORM_ICONS[t.platform] || 'PLT';
                      return (
                        <div key={t.id} className={`text-[8px] px-1 py-0.5 rounded truncate border ${cfg.bg} ${cfg.color}`}>
                          {platIcon} {t.title.slice(0, 10)}...
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && <div className="text-[8px] text-gray-600">+{dayTasks.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day detail */}
          <AnimatePresence>
            {selectedDay && selectedDayTasks.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="border border-purple-500/20 bg-purple-500/5 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-white">5月{selectedDay}日 · {selectedDayTasks.length}个任务</div>
                  {selectedDayTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                      <span className="text-xl">{PLATFORM_ICONS[t.platform] || 'PLT'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{t.title}</div>
                        <div className="text-[10px] text-gray-500">{t.scheduledAt.split(' ')[1]} · {t.account}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${STATUS_CFG[t.status].bg} ${STATUS_CFG[t.status].color}`}>
                        {zh ? STATUS_CFG[t.status].zh : STATUS_CFG[t.status].en}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilterStatus('all')}
              className={`text-[10px] px-3 py-1.5 rounded-lg border transition ${filterStatus === 'all' ? 'border-white/20 bg-white/10 text-white' : 'border-white/8 text-gray-500 hover:border-white/15'}`}>
              {zh ? '全部' : 'All'} ({MOCK_TASKS.length})
            </button>
            {Object.entries(STATUS_CFG).map(([key, cfg]) => {
              const count = MOCK_TASKS.filter(t => t.status === key).length;
              if (!count) return null;
              return (
                <button key={key} onClick={() => setFilterStatus(key as TaskStatus)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition ${filterStatus === key ? `${cfg.bg} ${cfg.color}` : 'border-white/8 text-gray-500 hover:border-white/15'}`}>
                  {zh ? cfg.zh : cfg.en} ({count})
                </button>
              );
            })}
          </div>

          {filtered.map((task, i) => {
            const sCfg = STATUS_CFG[task.status];
            const tCfg = TYPE_CFG[task.contentType];
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tCfg.color}15` }}>
                  <tCfg.icon className="w-4 h-4" style={{ color: tCfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{task.title}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                    <span>{PLATFORM_ICONS[task.platform] || 'PLT'} {task.platform} · {task.account}</span>
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{task.scheduledAt}</span>
                    {task.celebrity && <span className="text-purple-400">STR {task.celebrity}</span>}
                    {task.gmvTarget && <span className="text-green-400">目标 {task.gmvTarget}</span>}
                  </div>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium shrink-0 ${sCfg.bg} ${sCfg.color}`}>
                  {zh ? sCfg.zh : sCfg.en}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      <AnimatePresence>
        {newTaskOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setNewTaskOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{zh ? '新建发布任务' : 'New Publishing Task'}</h3>
                <button onClick={() => setNewTaskOpen(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                <input placeholder={zh ? '任务标题（视频名称）' : 'Task title (video name)'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:border-purple-500/30 focus:outline-none transition" />
                <div className="grid grid-cols-2 gap-2">
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '选择平台' : 'Select platform'}</option>
                    <option>抖音</option><option>快手</option><option>视频号</option><option>小红书</option><option>B站</option>
                  </select>
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '选择账号' : 'Select account'}</option>
                    <option>@neon_v_official</option><option>@luna_soft_ks</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '关联明星' : 'Link celebrity'}</option>
                    <option>陆承远</option><option>顾星辰</option><option>苏念</option><option>江野</option>
                  </select>
                  <select className="h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                    <option>{zh ? '内容类型' : 'Content type'}</option>
                    <option>{zh ? '切片视频' : 'Clip Video'}</option>
                    <option>{zh ? '直播切片' : 'Live Clip'}</option>
                    <option>{zh ? '图文内容' : 'Graphic'}</option>
                    <option>{zh ? 'AI配音' : 'AI Voiceover'}</option>
                  </select>
                </div>
                <input type="datetime-local" className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none" />
                <input placeholder={zh ? 'GMV目标（可选，如：¥8,000）' : 'GMV target (optional)'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none transition" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNewTaskOpen(false)} className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">{zh ? '取消' : 'Cancel'}</button>
                <button onClick={() => setNewTaskOpen(false)} className="flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #a855f7)' }}>
                  <Sparkles className="w-3.5 h-3.5" />{zh ? 'AI生成脚本' : 'AI Generate Script'}
                </button>
                <button onClick={() => setNewTaskOpen(false)} className="flex-1 h-10 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>{zh ? '创建任务' : 'Create Task'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContentCalendar;
