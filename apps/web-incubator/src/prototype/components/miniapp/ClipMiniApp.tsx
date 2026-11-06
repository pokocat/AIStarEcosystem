/**
 * 明星切片专用小程序端 — 白底圆角赛博朋克风
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film, Scissors, ShoppingBag, BarChart3, ShieldCheck,
  ArrowLeft, Bell, Zap, ChevronRight, Plus,
  Play, CheckCircle2, Share2, Clock,
  Flame, AlertCircle, CircleCheck, Gift, RefreshCw, Eye,
  Smartphone, Lock, BadgeCheck, Sparkles, Send, Check, Filter,
  TrendingUp, Wallet,
} from 'lucide-react';
import type { Lang } from '../../translations';

type Tab = 'plaza' | 'brand' | 'myclips' | 'revenue' | 'compliance';
type PlatformId = '全部' | '抖音' | '小红书' | '视频号' | 'B站' | '快手';

interface Props { lang: Lang; onBack: () => void; }

const PLATFORM_LIST = [
  { id: '全部' as PlatformId,  color: '#374151', bonus: 0,
    accentBg: 'bg-gray-100', accentBorder: 'border-gray-200' },
  { id: '抖音' as PlatformId,  color: '#92400e', bonus: 3,
    accentBg: 'bg-amber-50', accentBorder: 'border-amber-200' },
  { id: '小红书' as PlatformId, color: '#991b1b', bonus: 5,
    accentBg: 'bg-red-50', accentBorder: 'border-red-200' },
  { id: '视频号' as PlatformId, color: '#166534', bonus: 2,
    accentBg: 'bg-green-50', accentBorder: 'border-green-200' },
  { id: 'B站' as PlatformId,   color: '#0c4a6e', bonus: 4,
    accentBg: 'bg-sky-50', accentBorder: 'border-sky-200' },
  { id: '快手' as PlatformId,  color: '#7c2d12', bonus: 3,
    accentBg: 'bg-orange-50', accentBorder: 'border-orange-200' },
];

const PLATFORM_CLIP_STATS: Record<PlatformId, { clips: string; views: string; revenue: string; trend: string }> = {
  '全部':  { clips: '24', views: '1,240万', revenue: '¥9,840', trend: '+15%' },
  '抖音':  { clips: '12', views: '780万',   revenue: '¥5,200', trend: '+22%' },
  '小红书':{ clips: '6',  views: '240万',   revenue: '¥2,100', trend: '+10%' },
  '视频号':{ clips: '4',  views: '140万',   revenue: '¥1,200', trend: '+6%'  },
  'B站':   { clips: '2',  views: '80万',    revenue: '¥1,340', trend: '+8%'  },
  '快手':  { clips: '0',  views: '-',       revenue: '-',      trend: 'NEW'  },
};

const CELEBRITIES = [
  {
    id: 'c1', name: '陈屿',
    avatar: '/images/star-chen-yu.webp',
    authType: '切片授权', clips: 24, views: '1,240万', status: 'active', expiry: '2026-08-30',
    platforms: ['抖音', 'B站', '快手'],
  },
  {
    id: 'c2', name: '苏枝',
    avatar: '/images/star-su-zhi.webp',
    authType: 'AI形象授权', clips: 18, views: '890万', status: 'active', expiry: '2026-06-15',
    platforms: ['小红书', '视频号', '抖音'],
  },
  {
    id: 'c3', name: '顾然',
    avatar: '/images/star-gu-ran.webp',
    authType: '切片授权', clips: 31, views: '2,100万', status: 'pending', expiry: '审核中',
    platforms: ['抖音', 'B站'],
  },
];

interface BrandTask {
  id: string; productName: string;
  celebrity: string; brand: string; image: string;
  commission: number; price: string; quota: number; takenQuota: number;
  bonus: string; status: 'available' | 'locked';
  requirement: string;
  platforms: PlatformId[];
  platformLabels: Partial<Record<PlatformId, string>>;
  expectedViews: Partial<Record<PlatformId, string>>;
}

const BRAND_TASKS: BrandTask[] = [
  {
    id: 'bt1', productName: '同款护肤套装',
    celebrity: '苏枝', brand: 'SK-II',
    image: '/images/task-skincare-set.webp',
    commission: 20, price: '¥899', quota: 15, takenQuota: 9,
    bonus: '明星同款+8%', status: 'available',
    requirement: '需含苏枝同款场景切片，时长≥15s',
    platforms: ['小红书', '视频号', '抖音'],
    platformLabels: { '小红书': '种草爆文', '视频号': '明星同款', '抖音': '带货热门' },
    expectedViews: { '小红书': '预计5万曝光', '视频号': '预计2万播放', '抖音': '预计8万播放' },
  },
  {
    id: 'bt2', productName: '剧中同款汉服',
    celebrity: '陈屿', brand: '汉唐文化',
    image: '/images/task-hanfu.webp',
    commission: 25, price: '¥388', quota: 10, takenQuota: 4,
    bonus: '首单双倍佣金', status: 'available',
    requirement: '需使用陈屿古装剧授权素材',
    platforms: ['抖音', 'B站', '快手'],
    platformLabels: { '抖音': '国风爆款', 'B站': 'B站国风', '快手': '快手热销' },
    expectedViews: { '抖音': '预计6万播放', 'B站': '预计1.5万播放', '快手': '预计8万播放' },
  },
  {
    id: 'bt3', productName: '明星联名零食礼盒',
    celebrity: '顾然', brand: '三只松鼠',
    image: '/images/task-snack-box.webp',
    commission: 18, price: '¥128', quota: 25, takenQuota: 6,
    bonus: '', status: 'locked',
    requirement: '需先完成顾然授权报白',
    platforms: ['抖音', '小红书'],
    platformLabels: { '抖音': '联名热卖', '小红书': '明星同款' },
    expectedViews: { '抖音': '预计10万播放', '小红书': '预计4万曝光' },
  },
  {
    id: 'bt4', productName: '女主同款香水',
    celebrity: '苏枝', brand: 'Jo Malone',
    image: '/images/task-perfume.webp',
    commission: 22, price: '¥660', quota: 8, takenQuota: 2,
    bonus: '高客单+¥60', status: 'available',
    requirement: '需含苏枝剧中香水使用场景',
    platforms: ['小红书', '视频号'],
    platformLabels: { '小红书': '香水种草', '视频号': '轻奢推荐' },
    expectedViews: { '小红书': '预计3万曝光', '视频号': '预计1万播放' },
  },
];

const MY_CLIPS = [
  { id: 'cl1', title: '陈屿·热血片段精剪', celebrity: '陈屿', platform: '抖音', status: 'live', views: '12.4万', commission: '¥680', duration: '1:24' },
  { id: 'cl2', title: '苏枝·甜宠混剪合集', celebrity: '苏枝', platform: '小红书', status: 'review', views: '-', commission: '预计¥240', duration: '2:10' },
  { id: 'cl3', title: '顾然·古装名场面', celebrity: '顾然', platform: 'B站', status: 'draft', views: '-', commission: '-', duration: '3:05' },
];

// ── Shared: platform tabs ──
const PlatformTabs = ({ active, onChange, compact = false }: { active: PlatformId; onChange: (p: PlatformId) => void; compact?: boolean }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
    {PLATFORM_LIST.map((pl) => {
      const isActive = active === pl.id;
      return (
        <button key={pl.id} onClick={() => onChange(pl.id)}
          className={`flex-shrink-0 text-[11px] font-bold tracking-widest rounded-xl border transition-all active:scale-95 ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'} ${isActive ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
          {pl.id}
          {!compact && pl.bonus > 0 && isActive && (
            <span className="ml-1 text-[9px] font-black text-black/60">+{pl.bonus}%</span>
          )}
        </button>
      );
    })}
  </div>
);

// ── Shared: section label ──
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">{children}</div>
);

// ── Tab: 切片广场 ──
const PlazaPage = ({ zh }: { zh: boolean }) => {
  const [plazaPlatform, setPlazaPlatform] = useState<PlatformId>('全部');
  const stats = PLATFORM_CLIP_STATS[plazaPlatform];
  const pl = PLATFORM_LIST.find(p => p.id === plazaPlatform)!;

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 space-y-4">
      {/* Platform stats */}
      <div className={`rounded-2xl border p-4 ${pl.accentBg} ${pl.accentBorder}`}>
        <SectionLabel>{zh ? '平台切片数据' : 'Platform Stats'}</SectionLabel>
        <PlatformTabs active={plazaPlatform} onChange={setPlazaPlatform} compact />
        <AnimatePresence mode="wait">
          <motion.div key={plazaPlatform} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="grid grid-cols-4 gap-2 mt-3">
            {[
              { label: zh ? '切片数' : 'Clips', value: stats.clips, hi: false },
              { label: zh ? '总播放' : 'Views', value: stats.views, hi: true },
              { label: zh ? '月收益' : 'Revenue', value: stats.revenue, hi: true },
              { label: zh ? '趋势' : 'Trend', value: stats.trend, hi: false },
            ].map((k) => (
              <div key={k.label} className="text-center">
                <div className={`text-sm font-extrabold tracking-tight ${k.hi ? 'text-amber-600' : 'text-gray-900'}`}>{k.value}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 tracking-wider">{k.label}</div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="mt-2.5 flex items-center gap-1 justify-end border-t border-gray-200 pt-2">
          <TrendingUp className="w-3 h-3 text-green-600" />
          <span className="text-[10px] text-green-600 font-bold tracking-wider">{stats.trend} {zh ? '较上月' : 'vs last month'}</span>
        </div>
      </div>

      {/* Authorized stars */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>{zh ? '授权明星' : 'Licensed Stars'}</SectionLabel>
          <button className="text-[10px] text-amber-600 tracking-wider flex items-center gap-0.5 font-bold">{zh ? '申请更多' : 'APPLY'} <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="space-y-2.5">
          {CELEBRITIES.map((c) => {
            const matchPlatform = plazaPlatform === '全部' || c.platforms.includes(plazaPlatform as any);
            return (
              <div key={c.id} className={`bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm transition-all ${!matchPlatform ? 'opacity-30' : ''}`}>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="relative flex-shrink-0">
                    <img src={c.avatar} alt="" className="w-11 h-11 rounded-xl object-cover" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${c.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`}>
                      {c.status === 'active' ? <BadgeCheck className="w-2.5 h-2.5 text-white" /> : <Clock className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 tracking-wide">{c.name}</span>
                      <span className="text-[9px] border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full tracking-wider bg-amber-50">{c.authType}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5 tracking-widest">{c.platforms.join(' / ')}</div>
                  </div>
                  <button className="text-[10px] font-bold tracking-wider text-black bg-amber-400 px-2.5 py-1.5 rounded-xl active:scale-95 transition shadow-[0_0_6px_rgba(251,191,36,0.3)]">
                    {zh ? '制作' : 'CREATE'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: zh ? '切片数' : 'Clips', value: c.clips, hi: false },
                    { label: zh ? '总播放' : 'Views', value: c.views, hi: true },
                    { label: zh ? '状态' : 'Status', value: c.status === 'active' ? (zh ? '授权中' : 'Active') : (zh ? '审核中' : 'Review'), hi: false },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl py-2">
                      <div className={`text-[11px] font-bold ${s.hi ? 'text-amber-600' : 'text-gray-900'}`}>{s.value}</div>
                      <div className="text-[9px] text-gray-400 tracking-wider mt-0.5">{s.label}</div>
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

// ── Tab: 品牌任务 ──
const BrandTasksPage = ({ zh }: { zh: boolean }) => {
  const [platform, setPlatform] = useState<PlatformId>('全部');
  const [checkedIn, setCheckedIn] = useState(false);
  const [taskSteps, setTaskSteps] = useState<Record<string, number>>({});
  const [selPlatforms, setSelPlatforms] = useState<Record<string, Set<string>>>({});
  const [sortBy, setSortBy] = useState<'commission' | 'hot' | 'new'>('commission');

  const getStep = (id: string) => taskSteps[id] ?? 0;
  const setStep = (id: string, step: number) => setTaskSteps(s => ({ ...s, [id]: step }));
  const getPlatforms = (id: string) => selPlatforms[id] ?? new Set<string>();
  const togglePlatform = (id: string, p: string) =>
    setSelPlatforms(s => { const cur = new Set(s[id] ?? []); cur.has(p) ? cur.delete(p) : cur.add(p); return { ...s, [id]: cur }; });
  const handleCompose = (id: string) => { setStep(id, 2); setTimeout(() => setStep(id, 3), 2000); };

  const filtered = platform === '全部' ? BRAND_TASKS : BRAND_TASKS.filter(t => t.platforms.includes(platform));
  const currentPl = PLATFORM_LIST.find(p => p.id === platform)!;

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <div className="px-4 pt-3 space-y-3">

        {/* Daily check-in */}
        <div className={`border rounded-2xl p-3 shadow-sm transition-all ${checkedIn ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-bold tracking-widest text-amber-600">{zh ? '每日签到' : 'DAILY CHECK-IN'}</span>
              <span className="text-[10px] text-gray-400 tracking-wider">{zh ? '连续3天 +30积分' : '3-day +30pts'}</span>
            </div>
            <button onClick={() => setCheckedIn(true)} disabled={checkedIn}
              className={`text-[11px] font-bold tracking-wider px-3 py-1 rounded-full transition active:scale-95 ${checkedIn ? 'border border-green-300 text-green-600 bg-green-50' : 'bg-amber-400 text-black shadow-[0_0_6px_rgba(251,191,36,0.3)]'}`}>
              {checkedIn ? <span className="flex items-center gap-1"><Check className="w-3 h-3" />{zh ? '已签到' : 'DONE'}</span> : (zh ? '签到' : 'CHECK IN')}
            </button>
          </div>
          <div className="flex gap-1">
            {[0,1,2,3,4].map((i) => {
              const done = i < 3 || (i === 3 && checkedIn);
              return (
                <div key={i} className={`flex-1 rounded-lg py-1.5 flex flex-col items-center gap-0.5 ${done ? 'bg-amber-100 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className={`text-[9px] font-bold ${done ? 'text-amber-600' : 'text-gray-300'}`}>{done ? '✓' : '—'}</div>
                  <div className="text-[8px] text-gray-400 tracking-widest">{zh ? ['一','二','三','四','五'][i] : ['M','T','W','T','F'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform filter */}
        <PlatformTabs active={platform} onChange={setPlatform} />

        {/* Platform bonus banner */}
        {platform !== '全部' && (
          <motion.div key={platform} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 border px-3 py-2 rounded-2xl ${currentPl.accentBg} ${currentPl.accentBorder}`}>
            <span className="text-[11px] font-bold tracking-widest" style={{ color: currentPl.color }}>
              {platform} +{currentPl.bonus}% {zh ? '佣金加成' : 'COMMISSION BONUS'}
            </span>
            <span className="ml-auto text-[10px] text-gray-400 tracking-wider">{filtered.length} {zh ? '件' : 'tasks'}</span>
          </motion.div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-gray-400" />
          {[{ id: 'commission', label: zh ? '高佣' : 'TOP%' }, { id: 'hot', label: zh ? '热度' : 'HOT' }, { id: 'new', label: zh ? '最新' : 'NEW' }].map((s) => (
            <button key={s.id} onClick={() => setSortBy(s.id as any)}
              className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border transition ${sortBy === s.id ? 'bg-amber-400 text-black border-amber-400' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <AnimatePresence mode="wait">
          <motion.div key={platform} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3 pb-4">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="text-sm tracking-widest">{zh ? '该平台暂无品牌任务' : 'NO TASKS'}</div>
              </div>
            ) : filtered.map((t) => {
              const step = getStep(t.id);
              const isLocked = t.status === 'locked';
              const pct = Math.round((t.takenQuota / t.quota) * 100);
              const selPlt = getPlatforms(t.id);
              const platformLabel = platform !== '全部' ? t.platformLabels[platform] : undefined;
              const expectedView = platform !== '全部' ? t.expectedViews[platform] : undefined;
              const bonus = platform !== '全部' ? currentPl.bonus : 0;
              const celInfo = CELEBRITIES.find(c => c.name === t.celebrity);

              return (
                <div key={t.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${isLocked ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                  {/* Product header */}
                  <div className="flex gap-3 p-3">
                    <div className="relative flex-shrink-0">
                      <img src={t.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      {isLocked && (
                        <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                          <Lock className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      {step === 5 && (
                        <div className="absolute inset-0 bg-green-500/30 rounded-xl flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 tracking-wide">{t.productName}</span>
                        {t.bonus && <span className="text-[9px] border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full tracking-wider bg-amber-50">{t.bonus}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        {celInfo && <img src={celInfo.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />}
                        <span className="text-[10px] text-amber-600 font-bold tracking-wider">{t.celebrity}</span>
                        <span className="text-[10px] text-gray-400">/ {t.brand} / {t.price}</span>
                      </div>
                      {platformLabel && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-bold tracking-wider border px-1.5 py-0.5 rounded-full" style={{ color: currentPl.color, borderColor: currentPl.color + '50', backgroundColor: currentPl.color + '10' }}>{platformLabel}</span>
                          {expectedView && <span className="text-[9px] text-gray-400 tracking-wide">{expectedView}</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-green-700 tracking-wider">佣金 {t.commission + bonus}%</span>
                        {bonus > 0 && <span className="text-[9px] text-green-500">(+{bonus}%)</span>}
                      </div>
                    </div>
                  </div>

                  {/* Requirement */}
                  <div className="mx-3 mb-2 text-[9px] text-gray-400 border-l-2 border-amber-400 pl-2 tracking-wide">
                    {t.requirement}
                  </div>

                  {/* Quota bar */}
                  <div className="px-3 pb-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-400 tracking-wider">名额 {t.takenQuota}/{t.quota}</span>
                      <span className={pct >= 80 ? 'text-red-500' : 'text-gray-400'}>{pct}%</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(pct, 100)}%`, boxShadow: '0 0 4px rgba(251,191,36,0.5)' }} />
                    </div>
                  </div>

                  {/* Step flow */}
                  {isLocked ? (
                    <div className="px-3 pb-3">
                      <button className="w-full py-2.5 border border-gray-100 text-gray-400 text-[11px] font-bold tracking-widest flex items-center justify-center gap-1.5 cursor-not-allowed rounded-2xl bg-gray-50">
                        <Lock className="w-3 h-3" /> {zh ? '需先完成明星授权报白' : 'AUTHORIZATION REQUIRED'}
                      </button>
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      {step === 0 && (
                        <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 pb-3">
                          <button onClick={() => setStep(t.id, 1)}
                            className="w-full py-2.5 rounded-2xl text-[12px] font-bold tracking-widest flex items-center justify-center gap-1.5 bg-amber-400 text-black active:scale-95 transition shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                            <Gift className="w-3.5 h-3.5" />{zh ? '领取品牌任务' : 'TAKE TASK'}
                          </button>
                        </motion.div>
                      )}

                      {step === 1 && (
                        <motion.div key="s1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                          <div className="flex items-center gap-1.5 border border-green-200 bg-green-50 px-2.5 py-1.5 rounded-xl">
                            <CircleCheck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            <span className="text-[11px] text-green-700 font-bold tracking-wider">{zh ? '已领取 — AI合成明星切片' : 'TAKEN — AI COMPOSE CLIP'}</span>
                          </div>
                          <button onClick={() => handleCompose(t.id)}
                            className="w-full py-2.5 rounded-2xl text-[12px] font-bold tracking-widest flex items-center justify-center gap-1.5 bg-black text-amber-400 active:scale-95 transition">
                            <Sparkles className="w-3.5 h-3.5" />{zh ? 'AI合成带货切片' : 'AI COMPOSE'}
                          </button>
                        </motion.div>
                      )}

                      {step === 2 && (
                        <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 pb-3">
                          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-3 flex items-center gap-3">
                            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                            <div>
                              <div className="text-[11px] font-bold text-amber-700 tracking-widest">{zh ? 'AI合成中...' : 'AI PROCESSING...'}</div>
                              <div className="text-[9px] text-gray-500 mt-0.5 tracking-wide">{zh ? '截取授权片段 · 嵌入商品素材' : 'Extracting clips · Embedding product'}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {step === 3 && (
                        <motion.div key="s3" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                          <div className="text-[10px] font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
                            <Film className="w-3 h-3 text-amber-500" />{zh ? '切片预览' : 'CLIP PREVIEW'}
                          </div>
                          <div className="border border-gray-100 bg-gray-900 overflow-hidden rounded-xl">
                            <div className="relative h-20 flex items-center justify-center">
                              <img src={t.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale" />
                              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                              <div className="relative flex items-center gap-2 border border-white/20 bg-black/60 rounded-full px-3 py-1.5">
                                <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[11px] text-white font-bold tracking-widest">{zh ? '预览' : 'PREVIEW'}</span>
                              </div>
                              {celInfo && (
                                <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 rounded-full px-1.5 py-0.5">
                                  <img src={celInfo.avatar} alt="" className="w-2.5 h-2.5 rounded-full object-cover" />
                                  <span className="text-[8px] font-bold text-black tracking-wider">{t.celebrity}</span>
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 border border-gray-600 bg-black/80 rounded px-1.5 py-0.5 text-[9px] text-gray-400 font-mono">0:28</div>
                              <div className="absolute bottom-2 left-2 bg-amber-400 rounded px-1.5 py-0.5 text-[9px] text-black font-bold">{t.price}</div>
                            </div>
                          </div>
                          <button onClick={() => setStep(t.id, 4)}
                            className="w-full py-2.5 rounded-2xl text-[12px] font-bold tracking-widest flex items-center justify-center gap-1.5 bg-black text-amber-400 active:scale-95 transition">
                            <Share2 className="w-3.5 h-3.5" />{zh ? '选择发布平台' : 'SELECT PLATFORMS'}
                          </button>
                        </motion.div>
                      )}

                      {step === 4 && (
                        <motion.div key="s4" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                          <div className="text-[10px] font-bold text-gray-500 tracking-widest">{zh ? '选择发布平台' : 'SELECT PLATFORMS'}</div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {PLATFORM_LIST.filter(p => p.id !== '全部').map((p) => {
                              const isActive = selPlt.has(p.id);
                              return (
                                <button key={p.id} onClick={() => togglePlatform(t.id, p.id)}
                                  className={`py-2 rounded-xl border text-[9px] font-bold tracking-wider flex flex-col items-center gap-0.5 transition active:scale-95 ${isActive ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]' : 'bg-white border-gray-200 text-gray-500'}`}>
                                  {p.id}
                                </button>
                              );
                            })}
                          </div>
                          <button disabled={selPlt.size === 0} onClick={() => selPlt.size > 0 && setStep(t.id, 5)}
                            className={`w-full py-2.5 rounded-2xl text-[12px] font-bold tracking-widest flex items-center justify-center gap-1.5 transition active:scale-95 ${selPlt.size === 0 ? 'border border-gray-100 text-gray-400 cursor-not-allowed bg-gray-50' : 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.3)]'}`}>
                            <Send className="w-3.5 h-3.5" />
                            {selPlt.size === 0 ? (zh ? '请选择平台' : 'SELECT PLATFORM') : (zh ? `发布到 ${selPlt.size} 个平台` : `PUBLISH × ${selPlt.size}`)}
                          </button>
                        </motion.div>
                      )}

                      {step === 5 && (
                        <motion.div key="s5" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="px-3 pb-3">
                          <div className="border border-green-200 bg-green-50 rounded-2xl p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-green-700 tracking-widest">{zh ? '发布成功' : 'PUBLISHED'}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 tracking-wide">
                                {zh ? `${getPlatforms(t.id).size} 个平台 · 佣金 ` : `${getPlatforms(t.id).size} platforms · `}
                                <span className="text-amber-600 font-bold">+{t.commission + bonus}%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Tab: 我的切片 ──
const MyClipsPage = ({ zh }: { zh: boolean }) => {
  const [status, setStatus] = useState<'all' | 'live' | 'review' | 'draft'>('all');
  const filtered = status === 'all' ? MY_CLIPS : MY_CLIPS.filter(c => c.status === status);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{zh ? '切片项目' : 'MY CLIPS'}</SectionLabel>
        <button className="flex items-center gap-1 text-[11px] font-bold tracking-widest text-black bg-amber-400 px-2.5 py-1 rounded-full active:scale-95 transition">
          <Plus className="w-3 h-3" /> {zh ? '新建' : 'NEW'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'live', label: zh ? '发布中' : 'LIVE', value: '1', color: 'text-green-700', border: 'border-green-200', bg: 'bg-green-50' },
          { id: 'review', label: zh ? '审核中' : 'REVIEW', value: '1', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50' },
          { id: 'draft', label: zh ? '草稿' : 'DRAFT', value: '1', color: 'text-gray-500', border: 'border-gray-200', bg: 'bg-gray-50' },
        ].map((s) => (
          <button key={s.id} onClick={() => setStatus(s.id as any)}
            className={`border rounded-2xl p-3 text-left shadow-sm transition ${status === s.id ? `${s.bg} ${s.border}` : 'bg-white border-gray-100 opacity-50'}`}>
            <div className={`text-xl font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 tracking-widest mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      <button onClick={() => setStatus('all')} className="text-[10px] text-gray-400 tracking-wider text-center w-full">{zh ? '显示全部' : 'SHOW ALL'}</button>

      {filtered.map((c) => (
        <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 tracking-wide truncate">{c.title}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5 tracking-wider">
                <span className="text-amber-600 font-bold">{c.celebrity}</span>
                <span>/</span>
                <span>{c.platform}</span>
                <span>/</span>
                <span className="font-mono">{c.duration}</span>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full tracking-widest ml-2 flex-shrink-0 ${
              c.status === 'live' ? 'border-green-300 text-green-700 bg-green-50' :
              c.status === 'review' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-gray-200 text-gray-500 bg-gray-50'
            }`}>
              {c.status === 'live' ? (zh ? '发布中' : 'LIVE') : c.status === 'review' ? (zh ? '审核中' : 'REVIEW') : (zh ? '草稿' : 'DRAFT')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 text-gray-400 tracking-wider"><Eye className="w-3 h-3" />{c.views}</span>
            <span className={c.status === 'live' ? 'text-amber-600 font-bold' : 'text-gray-400'}>{c.commission}</span>
          </div>
          {c.status === 'draft' && (
            <button className="mt-2.5 w-full py-2 rounded-2xl bg-amber-400 text-black text-[11px] font-bold tracking-widest flex items-center justify-center gap-1 active:scale-95 transition">
              <Share2 className="w-3 h-3" /> {zh ? '提交发布' : 'SUBMIT'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Tab: 收益 ──
const RevenuePage = ({ zh }: { zh: boolean }) => {
  const platformRevenue = [
    { id: '抖音', revenue: 5200, pct: 53 },
    { id: '小红书', revenue: 2100, pct: 21 },
    { id: 'B站', revenue: 1340, pct: 14 },
    { id: '视频号', revenue: 1200, pct: 12 },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 space-y-4">
      {/* Revenue hero — dark accent block */}
      <div className="bg-black rounded-2xl p-5">
        <div className="text-[10px] text-amber-500/80 uppercase tracking-[0.25em] mb-1">{zh ? '本月总收益' : 'MONTHLY TOTAL'}</div>
        <div className="text-4xl font-extrabold text-amber-400 tracking-tight" style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 16px rgba(251,191,36,0.35)' }}>¥9,840</div>
        <div className="flex items-center gap-5 mt-3 border-t border-gray-800 pt-3">
          {[
            { label: zh ? '带货佣金' : 'COMMERCE', value: '¥6,200' },
            { label: zh ? '任务奖励' : 'BONUS', value: '¥2,400' },
            { label: zh ? '流量分成' : 'AD SHARE', value: '¥1,240' },
          ].map((r) => (
            <div key={r.label}>
              <div className="text-[9px] text-gray-600 tracking-widest">{r.label}</div>
              <div className="text-xs font-bold text-white mt-0.5">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <SectionLabel>{zh ? '平台收益分布' : 'REVENUE BY PLATFORM'}</SectionLabel>
        {platformRevenue.map((r) => (
          <div key={r.id} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-500 tracking-wider">{r.id}</span>
              <span className="text-[11px] font-bold text-gray-900">¥{r.revenue.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                className="h-full rounded-full bg-amber-400" style={{ boxShadow: '0 0 4px rgba(251,191,36,0.5)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div>
        <SectionLabel>{zh ? '切片收益排行' : 'CLIP LEADERBOARD'}</SectionLabel>
        {[
          { rank: 1, title: zh ? '陈屿·热血片段精剪' : 'Chen Yu Action', views: '12.4万', revenue: '¥680' },
          { rank: 2, title: zh ? '苏枝·甜宠混剪合集' : 'Su Zhi Romance', views: '8.2万', revenue: '¥420' },
          { rank: 3, title: zh ? '顾然·古装名场面' : 'Gu Ran Ancient', views: '6.1万', revenue: '¥310' },
        ].map((r) => (
          <div key={r.rank} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 mb-2 shadow-sm">
            <div className={`w-6 text-center text-[11px] font-black tracking-wider font-mono ${r.rank === 1 ? 'text-amber-500' : 'text-gray-400'}`}>{String(r.rank).padStart(2, '0')}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 tracking-wide truncate">{r.title}</div>
              <div className="text-[10px] text-gray-400 tracking-wider flex items-center gap-1"><Eye className="w-2.5 h-2.5" />{r.views}</div>
            </div>
            <div className={`text-xs font-bold ${r.rank === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{r.revenue}</div>
          </div>
        ))}
      </div>

      <button className="w-full py-3.5 rounded-2xl bg-amber-400 text-black font-bold tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[0_0_12px_rgba(251,191,36,0.25)]">
        <Wallet className="w-4 h-4" /> {zh ? '申请提现' : 'WITHDRAW'}
      </button>
    </div>
  );
};

// ── Tab: 合规 ──
const CompliancePage = ({ zh }: { zh: boolean }) => (
  <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 space-y-3">
    <div className="border border-green-200 bg-green-50 rounded-2xl p-3.5 flex items-center gap-3">
      <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
      <div>
        <div className="text-xs font-bold text-green-700 tracking-widest">{zh ? '合规状态正常' : 'COMPLIANCE OK'}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 tracking-wide">{zh ? '所有授权在有效期内，无违规记录' : 'All authorizations valid'}</div>
      </div>
    </div>

    <div>
      <SectionLabel>{zh ? '授权有效期' : 'AUTH EXPIRY'}</SectionLabel>
      {CELEBRITIES.map((c) => {
        const isExpiringSoon = c.expiry !== '审核中' && c.expiry < '2026-07-01';
        return (
          <div key={c.id} className={`flex items-center gap-3 border rounded-2xl p-3 mb-2 shadow-sm ${isExpiringSoon ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}>
            <img src={c.avatar} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 tracking-wide">{c.name}</div>
              <div className="text-[9px] text-gray-400 tracking-widest">{c.authType} / {c.platforms.join(' / ')}</div>
            </div>
            <div className="text-right">
              <div className={`text-[11px] font-bold tracking-wide ${isExpiringSoon ? 'text-amber-600' : c.expiry === '审核中' ? 'text-gray-400' : 'text-green-600'}`}>
                {c.expiry === '审核中' ? (zh ? '审核中' : 'REVIEW') : c.expiry}
              </div>
              {isExpiringSoon && <div className="text-[9px] text-amber-500 tracking-wider">{zh ? '即将到期' : 'EXPIRING'}</div>}
            </div>
          </div>
        );
      })}
    </div>

    <div>
      <SectionLabel>{zh ? '系统提醒' : 'ALERTS'}</SectionLabel>
      {[
        { icon: AlertCircle, text: zh ? '苏枝授权将于45天后到期，请及时续签' : 'Su Zhi auth expires in 45 days', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50' },
        { icon: ShieldCheck, text: zh ? '顾然授权报白审核中，预计3个工作日完成' : 'Gu Ran whitelist under review, ETA 3 days', color: 'text-sky-700', border: 'border-sky-200', bg: 'bg-sky-50' },
      ].map((a, i) => {
        const Icon = a.icon;
        return (
          <div key={i} className={`flex items-start gap-2.5 border rounded-2xl p-3 mb-2 ${a.bg} ${a.border}`}>
            <Icon className={`w-3.5 h-3.5 ${a.color} flex-shrink-0 mt-0.5`} />
            <span className="text-[11px] text-gray-600 tracking-wide leading-relaxed">{a.text}</span>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Main Component ──
export const ClipMiniApp = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<Tab>('plaza');

  const pendingBrand = BRAND_TASKS.filter(t => t.status === 'available').length;

  const TABS: { id: Tab; icon: React.ComponentType<any>; labelZh: string; labelEn: string; badge?: number }[] = [
    { id: 'plaza', icon: Film, labelZh: '广场', labelEn: 'PLAZA' },
    { id: 'brand', icon: ShoppingBag, labelZh: '品牌任务', labelEn: 'BRAND', badge: pendingBrand },
    { id: 'myclips', icon: Scissors, labelZh: '切片', labelEn: 'CLIPS' },
    { id: 'revenue', icon: BarChart3, labelZh: '收益', labelEn: 'REVENUE' },
    { id: 'compliance', icon: ShieldCheck, labelZh: '合规', labelEn: 'COMPLY' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="relative w-full max-w-[390px] bg-gray-50 rounded-[44px] border border-gray-200 overflow-hidden flex flex-col"
        style={{ height: '844px', boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 40px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)' }}>

        {/* Status bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3 pb-1">
          <span className="text-[11px] font-bold text-gray-700 font-mono tracking-widest">09:41</span>
          <div className="w-[120px] h-[30px] bg-gray-900 rounded-full absolute top-0 left-1/2 -translate-x-1/2" />
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end h-3">
              {[2,3,4,4].map((h, i) => <div key={i} className="w-1 bg-gray-600 rounded-sm" style={{ height: `${h * 3}px` }} />)}
            </div>
            <Zap className="w-3 h-3 text-amber-500" />
          </div>
        </div>

        {/* App header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-gray-900 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
              AI STAR <span className="text-amber-500">//</span> {zh ? '切片专版' : 'CLIP'}
            </div>
            <div className="text-[10px] text-gray-400 tracking-[0.15em] flex items-center gap-1">
              <Smartphone className="w-2.5 h-2.5" />
              {zh ? '明星切片小程序' : 'CELEBRITY CLIP MINI-APP'}
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] font-bold text-black flex items-center justify-center">2</span>
          </button>
        </div>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'plaza' && <PlazaPage zh={zh} />}
            {activeTab === 'brand' && <BrandTasksPage zh={zh} />}
            {activeTab === 'myclips' && <MyClipsPage zh={zh} />}
            {activeTab === 'revenue' && <RevenuePage zh={zh} />}
            {activeTab === 'compliance' && <CompliancePage zh={zh} />}
          </motion.div>
        </AnimatePresence>

        {/* Bottom tab bar */}
        <div className="flex-shrink-0 flex items-center bg-white border-t border-gray-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition active:scale-90 relative">
                <div className={`relative flex items-center justify-center w-8 h-6 rounded-full transition-all ${isActive ? 'bg-amber-400' : ''}`}>
                  <Icon style={{ width: 17, height: 17 }} className={`transition-colors ${isActive ? 'text-black' : 'text-gray-400'}`} />
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full text-[8px] font-bold text-black flex items-center justify-center">{tab.badge}</span>
                  )}
                </div>
                <span className={`text-[9px] font-bold tracking-widest transition-colors ${isActive ? 'text-amber-600' : 'text-gray-400'}`}>
                  {zh ? tab.labelZh : tab.labelEn}
                </span>
                {isActive && <motion.div layoutId="clipTabIndicator" className="absolute bottom-0 w-8 h-0.5 bg-amber-400 rounded-full" style={{ boxShadow: '0 0 4px rgba(251,191,36,0.8)' }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
