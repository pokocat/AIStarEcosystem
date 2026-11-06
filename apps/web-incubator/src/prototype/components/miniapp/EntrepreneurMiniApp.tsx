/**
 * 生态创业者小程序端 — 白底黄黑主题
 * Tabs: 首页 / 选品中心(核心) / 我的任务 / 变现 / 我的
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, ClipboardList, Wallet, User,
  ArrowLeft, Bell, Zap, ChevronRight, Plus,
  CheckCircle2, Share2, Clock, BarChart3, Coins, Crown,
  Flame, CircleCheck, Gift, RefreshCw, Eye,
  Smartphone, Sparkles, Send, Check, Copy, Image,
  TrendingUp, Users, Package, AlertCircle, Filter,
  MessageCircle,
} from 'lucide-react';
import type { Lang } from '../../translations';

type Tab = 'messages' | 'products' | 'mytasks' | 'monetize' | 'me';
type PlatformId = '全部' | '抖音' | '小红书' | '视频号' | 'B站' | '快手';

interface Props { lang: Lang; onBack: () => void; }

// ── Color tokens ──
const Y = 'bg-amber-400'; // primary yellow button
const YT = 'text-amber-500'; // yellow text
const YB = 'border-amber-400'; // yellow border

// ── Platform config ──
const PLATFORM_LIST = [
  { id: '全部' as PlatformId,  emoji: '🌐', color: '#78716c', bonus: 0,
    activeClass: 'bg-stone-800 text-white border-stone-800' },
  { id: '抖音' as PlatformId,  emoji: '🎵', color: '#000000', bonus: 3,
    activeClass: 'bg-black text-amber-400 border-black' },
  { id: '小红书' as PlatformId, emoji: '📕', color: '#e11d48', bonus: 5,
    activeClass: 'bg-rose-500 text-white border-rose-500' },
  { id: '视频号' as PlatformId, emoji: '▶️', color: '#16a34a', bonus: 2,
    activeClass: 'bg-green-600 text-white border-green-600' },
  { id: 'B站' as PlatformId,   emoji: '📺', color: '#0ea5e9', bonus: 4,
    activeClass: 'bg-sky-500 text-white border-sky-500' },
  { id: '快手' as PlatformId,  emoji: '⚡', color: '#ea580c', bonus: 3,
    activeClass: 'bg-orange-500 text-white border-orange-500' },
];

const PLATFORM_STATS: Record<PlatformId, { revenue: string; views: string; conversion: string; orders: number; trend: string }> = {
  '全部':  { revenue: '¥1,240', views: '12.4万', conversion: '3.2%', orders: 18, trend: '+12%' },
  '抖音':  { revenue: '¥680',   views: '8.2万',  conversion: '4.1%', orders: 11, trend: '+18%' },
  '小红书':{ revenue: '¥320',   views: '2.4万',  conversion: '5.8%', orders: 5,  trend: '+8%'  },
  '视频号':{ revenue: '¥140',   views: '1.1万',  conversion: '2.4%', orders: 2,  trend: '+3%'  },
  'B站':   { revenue: '¥80',    views: '0.7万',  conversion: '1.8%', orders: 1,  trend: '+5%'  },
  '快手':  { revenue: '¥20',    views: '0.4万',  conversion: '1.2%', orders: 1,  trend: 'NEW'  },
};

interface Product {
  id: string; name: string; nameEn: string; brand: string; image: string;
  commission: number; price: string; quota: number; takenQuota: number;
  bonus: string; bonusEn: string; status: 'available' | 'full';
  platforms: PlatformId[];
  platformLabels: Partial<Record<PlatformId, string>>;
  expectedViews: Partial<Record<PlatformId, string>>;
}

const PRODUCTS: Product[] = [
  {
    id: 'p1', name: '星辰美白精华液', nameEn: 'Star Glow Serum',
    brand: 'LUMÉ', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=200&q=80',
    commission: 18, price: '¥299', quota: 12, takenQuota: 7,
    bonus: '¥50加成', bonusEn: '+¥50', status: 'available',
    platforms: ['抖音', '小红书'],
    platformLabels: { '抖音': '抖音爆款', '小红书': '种草利器' },
    expectedViews: { '抖音': '预计8万播放', '小红书': '预计3万曝光' },
  },
  {
    id: 'p2', name: '赛博蓝牙耳机', nameEn: 'Cyber BT Headphones',
    brand: 'SoundX', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80',
    commission: 22, price: '¥599', quota: 8, takenQuota: 8,
    bonus: '', bonusEn: '', status: 'full',
    platforms: ['抖音', 'B站', '快手'],
    platformLabels: { '抖音': '数码热销', 'B站': 'B站精选', '快手': '快手推荐' },
    expectedViews: { '抖音': '预计5万播放', 'B站': '预计2万播放', '快手': '预计4万播放' },
  },
  {
    id: 'p3', name: '潮流眼影盘', nameEn: 'Trendy Eyeshadow',
    brand: 'ColorPop', image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=200&q=80',
    commission: 15, price: '¥189', quota: 20, takenQuota: 3,
    bonus: '首单双佣', bonusEn: '2x first order', status: 'available',
    platforms: ['小红书', '视频号', '抖音'],
    platformLabels: { '小红书': '美妆爆文', '视频号': '视频号精选', '抖音': '美妆热门' },
    expectedViews: { '小红书': '预计5万曝光', '视频号': '预计1.5万播放', '抖音': '预计6万播放' },
  },
  {
    id: 'p4', name: '人体工学椅垫', nameEn: 'Ergonomic Cushion',
    brand: 'ErgoLife', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=200&q=80',
    commission: 12, price: '¥128', quota: 30, takenQuota: 11,
    bonus: '', bonusEn: '', status: 'available',
    platforms: ['B站', '视频号'],
    platformLabels: { 'B站': 'B站好物', '视频号': '居家必备' },
    expectedViews: { 'B站': '预计1.2万播放', '视频号': '预计0.8万播放' },
  },
  {
    id: 'p5', name: '维C泡腾片', nameEn: 'Vitamin C Tablets',
    brand: 'HealthPlus', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&q=80',
    commission: 20, price: '¥89', quota: 50, takenQuota: 12,
    bonus: '新品+¥20', bonusEn: 'New +¥20', status: 'available',
    platforms: ['快手', '抖音'],
    platformLabels: { '快手': '快手爆品', '抖音': '健康热卖' },
    expectedViews: { '快手': '预计10万播放', '抖音': '预计7万播放' },
  },
  {
    id: 'p6', name: '智能保温杯', nameEn: 'Smart Thermos',
    brand: 'ThermoTech', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&q=80',
    commission: 16, price: '¥238', quota: 25, takenQuota: 8,
    bonus: '', bonusEn: '', status: 'available',
    platforms: ['抖音', '小红书', '视频号', 'B站', '快手'],
    platformLabels: { '抖音': '全平台爆款', '小红书': '生活好物', '视频号': '精选推荐', 'B站': '数码生活', '快手': '实用利器' },
    expectedViews: { '抖音': '预计6万', '小红书': '预计2万', '视频号': '预计1万', 'B站': '预计0.8万', '快手': '预计5万' },
  },
];

const MY_TASKS_DATA = [
  { id: 't1', productName: '星辰美白精华液', platform: '抖音', status: 'done', views: '2.4万', commission: '¥312', doneAt: '14:32' },
  { id: 't2', productName: '潮流眼影盘', platform: '小红书', status: 'pending', views: '-', commission: '-', doneAt: '' },
  { id: 't3', productName: '智能保温杯', platform: 'B站', status: 'review', views: '-', commission: '预计¥88', doneAt: '' },
  { id: 't4', productName: '维C泡腾片', platform: '快手', status: 'pending', views: '-', commission: '-', doneAt: '' },
];

const MOCK_COPIES = [
  '姐妹们！这款精华真的绝了！用了三天就看出皮肤变白变嫩，博主自用好物分享，点击链接下单✨',
  '打工人护肤必备！性价比超高敏感肌也能用，品牌搞活动今天下单还有优惠哦！',
  '发现宝藏护肤品！用了之后皮肤水嫩嫩，素颜也超好看！限时活动地址在主页🌸',
];

const ARTISTS = [
  { id: 'a1', name: '霓虹战士', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80', fans: '128万', revenue: '¥18,400', trend: '+12%' },
  { id: 'a2', name: '月色柔柔', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=100&q=80', fans: '86万', revenue: '¥9,200', trend: '+8%' },
  { id: 'a3', name: 'Zero计划', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&q=80', fans: '43万', revenue: '¥4,800', trend: '-2%' },
];

// ── Shared component ──
const PlatformTabs = ({ active, onChange }: { active: PlatformId; onChange: (p: PlatformId) => void }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
    {PLATFORM_LIST.map((pl) => {
      const isActive = active === pl.id;
      return (
        <button key={pl.id} onClick={() => onChange(pl.id)}
          className={`flex-shrink-0 flex items-center gap-1 rounded-full border text-[11px] font-bold px-3 py-1.5 transition-all active:scale-95 ${isActive ? pl.activeClass : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
          <span>{pl.id}</span>
          {isActive && pl.bonus > 0 && <span className="text-[9px] font-black opacity-80">+{pl.bonus}%</span>}
        </button>
      );
    })}
  </div>
);

// ── Tab: 消息 ──
const TOPICS_DATA = [
  { id: 't1', label: '纯爱战士', labelEn: 'Romance', count: '1.2万', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', sub: 'text-pink-400' },
  { id: 't2', label: '带货攻略', labelEn: 'Commerce Tips', count: '8.4千', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', sub: 'text-amber-400' },
  { id: 't3', label: '平台规则', labelEn: 'Platform Rules', count: '3.1千', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', sub: 'text-sky-400' },
  { id: 't4', label: '爆款密码', labelEn: 'Viral Tips', count: '6.7千', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', sub: 'text-purple-400' },
  { id: 't5', label: '选品实战', labelEn: 'Product Hunt', count: '2.9千', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', sub: 'text-green-400' },
];

const MESSAGES_DATA = [
  {
    id: 'm1', name: '李小鱼', role: '美妆博主', channel: '抖音',
    preview: '收到！我这边明天下午两点可以开始拍摄，素材我已经...',
    time: '刚刚', tag: '合作中', unread: 3,
    avatarBg: 'from-pink-400 to-rose-500',
  },
  {
    id: 'm2', name: '张大厨', role: '美食达人', channel: '小红书',
    preview: '这款锅具真的绝了，我用了一周，效果超出预期，粉丝...',
    time: '2分钟', tag: '待回复', unread: 1,
    avatarBg: 'from-orange-400 to-amber-500',
  },
  {
    id: 'm3', name: '运营小组', role: '内部群', channel: '系统',
    preview: '【通知】本周选品会议时间调整为周四下午3点，请各位...',
    time: '10分钟', tag: '通知', unread: 0,
    avatarBg: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'm4', name: '陈晓晓', role: '穿搭博主', channel: 'B站',
    preview: '视频剪辑完成了，请帮我看下文案是否符合品牌调性...',
    time: '1小时', tag: '审核中', unread: 0,
    avatarBg: 'from-cyan-400 to-sky-500',
  },
  {
    id: 'm5', name: '王萌萌', role: '母婴UP主', channel: '视频号',
    preview: '上期视频数据出来了，播放量破了50万，我们聊下续合...',
    time: '3小时', tag: '数据好', unread: 0,
    avatarBg: 'from-violet-400 to-purple-500',
  },
];

const CHANNEL_COLORS: Record<string, string> = {
  '抖音': 'bg-black text-white',
  '小红书': 'bg-rose-500 text-white',
  '系统': 'bg-gray-200 text-gray-600',
  'B站': 'bg-sky-500 text-white',
  '视频号': 'bg-green-500 text-white',
};

const TAG_COLORS: Record<string, string> = {
  '合作中': 'bg-amber-100 text-amber-700',
  '待回复': 'bg-red-100 text-red-600',
  '通知': 'bg-blue-100 text-blue-600',
  '审核中': 'bg-purple-100 text-purple-600',
  '数据好': 'bg-green-100 text-green-600',
};

const MessagesPage = ({ zh }: { zh: boolean }) => {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center gap-2 px-3 py-2.5">
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <span className="text-[12px] text-gray-300">{zh ? '搜索联系人或消息' : 'Search messages'}</span>
        </div>
      </div>

      {/* Hot topics - card style */}
      <div className="px-4 pb-1">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{zh ? '热门话题' : 'HOT TOPICS'}</div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {TOPICS_DATA.map((t) => {
            const isActive = activeTopic === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTopic(isActive ? null : t.id)}
                className={`flex-shrink-0 border rounded-2xl px-3 py-2.5 text-left transition-all active:scale-95 ${isActive ? `${t.bg} ${t.border} shadow-sm` : 'bg-white border-gray-100'}`}>
                <div className={`text-[11px] font-bold whitespace-nowrap ${isActive ? t.text : 'text-gray-700'}`}>
                  {zh ? t.label : t.labelEn}
                </div>
                <div className={`text-[9px] mt-0.5 ${isActive ? t.sub : 'text-gray-400'}`}>{t.count} {zh ? '讨论' : 'posts'}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{zh ? '最新消息' : 'MESSAGES'}</span>
        <span className="text-[10px] text-amber-500 font-semibold">{MESSAGES_DATA.filter(m => m.unread > 0).length} {zh ? '条未读' : 'unread'}</span>
      </div>

      {/* Flat message list */}
      <div className="bg-white">
        {MESSAGES_DATA.map((m, i) => (
          <button key={m.id}
            className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition text-left ${i < MESSAGES_DATA.length - 1 ? 'border-b border-gray-50' : ''}`}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${m.avatarBg} flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">{m.name[0]}</span>
              </div>
              {m.unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{m.unread}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[13px] font-semibold text-gray-900 truncate">{m.name}</span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${CHANNEL_COLORS[m.channel] ?? 'bg-gray-200 text-gray-600'}`}>{m.channel}</span>
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${TAG_COLORS[m.tag] ?? 'bg-gray-100 text-gray-500'}`}>{m.tag}</span>
              </div>
              <div className="text-[10px] text-gray-400 truncate">{m.role}</div>
              <div className="text-[11px] text-gray-500 truncate mt-0.5">{m.preview}</div>
            </div>

            {/* Time */}
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] text-gray-400">{m.time}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Tab: 首页 ──
const HomePage = ({ zh }: { zh: boolean }) => {
  const [homePlatform, setHomePlatform] = useState<PlatformId>('全部');
  const stats = PLATFORM_STATS[homePlatform];
  const pl = PLATFORM_LIST.find(p => p.id === homePlatform)!;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
      {/* Hero stats card */}
      <div className="bg-black mx-4 mt-3 rounded-2xl p-4">
        <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{zh ? '今日平台绩效' : "Today's Performance"}</div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
          {PLATFORM_LIST.map((p) => (
            <button key={p.id} onClick={() => setHomePlatform(p.id)}
              className={`flex-shrink-0 text-[11px] font-bold tracking-widest px-3 py-1 rounded-sm border transition-all active:scale-95 ${homePlatform === p.id ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}>
              {p.id}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={homePlatform} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="grid grid-cols-4 gap-2">
            {[
              { label: zh ? '今日收益' : 'Revenue', value: stats.revenue, color: 'text-amber-400' },
              { label: zh ? '播放量' : 'Views', value: stats.views, color: 'text-white' },
              { label: zh ? '转化率' : 'CVR', value: stats.conversion, color: 'text-green-400' },
              { label: zh ? '成交' : 'Orders', value: String(stats.orders), color: 'text-white' },
            ].map((k) => (
              <div key={k.label} className="text-center">
                <div className={`text-sm font-extrabold ${k.color}`}>{k.value}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center gap-1 justify-end mt-2">
          <TrendingUp className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-amber-400 font-bold">{stats.trend} {zh ? '较昨日' : 'vs yesterday'}</span>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* Revenue chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-900">{zh ? '7日收益趋势' : '7-Day Revenue'}</span>
            <span className="text-[10px] text-gray-400">¥8,640 {zh ? '本周' : 'this week'}</span>
          </div>
          <div className="flex items-end gap-1 h-14">
            {[40, 65, 45, 80, 55, 90, 72].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 6 ? '#f59e0b' : '#f3f4f6' }} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {['一','二','三','四','五','六','今'].map((d, i) => (
              <span key={d} className={`text-[9px] flex-1 text-center ${i === 6 ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>{d}</span>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: ShoppingBag, label: zh ? '选品' : 'Products', bg: 'bg-amber-400', iconColor: 'text-black' },
            { icon: Sparkles, label: zh ? 'AI生成' : 'AI Gen', bg: 'bg-black', iconColor: 'text-amber-400' },
            { icon: BarChart3, label: zh ? '数据' : 'Analytics', bg: 'bg-gray-100', iconColor: 'text-gray-700' },
            { icon: Gift, label: zh ? '奖励' : 'Rewards', bg: 'bg-gray-100', iconColor: 'text-gray-700' },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${a.bg} active:scale-95 transition`}>
                <Icon className={`w-5 h-5 ${a.iconColor}`} />
                <span className={`text-[10px] font-semibold ${a.iconColor}`}>{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Artist feed */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-900">{zh ? '艺人动态' : 'Artist Feed'}</span>
            <button className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">{zh ? '全部' : 'All'} <ChevronRight className="w-3 h-3" /></button>
          </div>
          {ARTISTS.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <img src={a.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900">{a.name}</div>
                <div className="text-[10px] text-gray-400">{a.fans} {zh ? '粉丝' : 'fans'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-gray-900">{a.revenue}</div>
                <div className={`text-[10px] font-semibold ${a.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{a.trend}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Tab: 选品中心（核心页） ──
const ProductsPage = ({ zh }: { zh: boolean }) => {
  const [platform, setPlatform] = useState<PlatformId>('全部');
  const [checkedIn, setCheckedIn] = useState(false);
  const [taskSteps, setTaskSteps] = useState<Record<string, number>>({});
  const [selPlatforms, setSelPlatforms] = useState<Record<string, Set<string>>>({});
  const [copyIdx, setCopyIdx] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'commission' | 'hot' | 'new'>('commission');

  const getStep = (id: string) => taskSteps[id] ?? 0;
  const setStep = (id: string, step: number) => setTaskSteps(s => ({ ...s, [id]: step }));
  const getPlatforms = (id: string) => selPlatforms[id] ?? new Set<string>();
  const togglePlatform = (id: string, p: string) =>
    setSelPlatforms(s => { const cur = new Set(s[id] ?? []); cur.has(p) ? cur.delete(p) : cur.add(p); return { ...s, [id]: cur }; });
  const getCopy = (id: string) => MOCK_COPIES[copyIdx[id] ?? 0];
  const refreshCopy = (id: string) => setCopyIdx(s => ({ ...s, [id]: ((s[id] ?? 0) + 1) % MOCK_COPIES.length }));
  const doCopy = (id: string) => { setCopied(s => ({ ...s, [id]: true })); setTimeout(() => setCopied(s => ({ ...s, [id]: false })), 1800); };
  const handleGenerate = (id: string) => { setStep(id, 2); setTimeout(() => setStep(id, 3), 1600); };

  const filteredProducts = platform === '全部' ? PRODUCTS : PRODUCTS.filter(p => p.platforms.includes(platform));
  const currentPl = PLATFORM_LIST.find(p => p.id === platform)!;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
      {/* Check-in streak */}
      <div className="px-4 pt-3">
        <div className={`rounded-2xl p-3 mb-3 border ${checkedIn ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-bold text-gray-900">{zh ? '每日签到' : 'Daily Check-in'}</span>
              <span className="text-[10px] text-gray-400">{zh ? '连续5天·+50积分' : '5-day streak·+50 pts'}</span>
            </div>
            <button onClick={() => setCheckedIn(true)} disabled={checkedIn}
              className={`text-[11px] font-bold px-3 py-1 rounded-full transition active:scale-95 ${checkedIn ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-amber-400 text-black'}`}>
              {checkedIn ? <span className="flex items-center gap-1"><Check className="w-3 h-3" />{zh ? '已签到' : 'Done'}</span> : (zh ? '签到' : 'Check In')}
            </button>
          </div>
          <div className="flex gap-1.5">
            {[0,1,2,3,4,5,6].map((i) => {
              const done = i < 5 || (i === 5 && checkedIn);
              return (
                <div key={i} className={`flex-1 rounded-lg py-1.5 flex flex-col items-center gap-0.5 ${done ? 'bg-amber-400' : 'bg-gray-100'}`}>
                  <div className={`text-[8px] font-bold ${done ? 'text-black' : 'text-gray-400'}`}>{done ? '✓' : '·'}</div>
                  <div className={`text-[8px] ${done ? 'text-black' : 'text-gray-400'}`}>{['一','二','三','四','五','六','日'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform filter */}
      <div className="px-4 space-y-2 mb-3">
        <PlatformTabs active={platform} onChange={setPlatform} />
        {platform !== '全部' && (
          <motion.div key={platform} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-black rounded-xl px-3 py-2">
            <span className="text-base">{currentPl.emoji}</span>
            <span className="text-[11px] font-bold text-amber-400">
              {platform} {zh ? '专属加成' : 'exclusive'} +{currentPl.bonus}% {zh ? '佣金' : 'commission'}
            </span>
            <span className="ml-auto text-[10px] text-gray-500">{filteredProducts.length} {zh ? '件' : 'items'}</span>
          </motion.div>
        )}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-gray-400" />
          {[{ id: 'commission', label: zh ? '高佣' : 'Comm%' }, { id: 'hot', label: zh ? '热度' : 'Hot' }, { id: 'new', label: zh ? '最新' : 'New' }].map((s) => (
            <button key={s.id} onClick={() => setSortBy(s.id as any)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition ${sortBy === s.id ? 'bg-black text-amber-400' : 'bg-gray-100 text-gray-500'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <AnimatePresence mode="wait">
        <motion.div key={platform} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="px-4 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <Package className="w-8 h-8 mx-auto mb-2" />
              <div className="text-sm text-gray-400">{zh ? '该平台暂无推荐商品' : 'No products for this platform'}</div>
            </div>
          ) : filteredProducts.map((p) => {
            const step = getStep(p.id);
            const isFull = p.status === 'full';
            const pct = Math.round((p.takenQuota / p.quota) * 100);
            const selPlt = getPlatforms(p.id);
            const platformLabel = platform !== '全部' ? p.platformLabels[platform] : undefined;
            const expectedView = platform !== '全部' ? p.expectedViews[platform] : undefined;
            const bonus = platform !== '全部' ? currentPl.bonus : 0;

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Product header */}
                <div className="flex gap-3 p-3">
                  <div className="relative flex-shrink-0">
                    <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    {step === 5 && <div className="absolute inset-0 bg-green-500/50 rounded-xl flex items-center justify-center"><Check className="w-5 h-5 text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold text-gray-900">{p.name}</span>
                      {p.bonus && <span className="text-[9px] bg-amber-400 text-black px-1.5 py-0.5 rounded-full font-bold">{p.bonus}</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 mb-1">{p.brand} · {p.price}</div>
                    {platformLabel && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[9px] font-bold bg-black text-amber-400 px-1.5 py-0.5 rounded-full">{currentPl.emoji} {platformLabel}</span>
                        {expectedView && <span className="text-[9px] text-gray-400">{expectedView}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-extrabold text-amber-500">佣 {p.commission + bonus}%</span>
                      {bonus > 0 && <span className="text-[9px] text-green-500 font-bold">+{bonus}%加成</span>}
                    </div>
                  </div>
                </div>

                {/* Quota */}
                <div className="px-3 pb-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">名额 {p.takenQuota}/{p.quota}</span>
                    <span className={pct >= 100 ? 'text-red-500 font-bold' : pct >= 70 ? 'text-amber-500 font-bold' : 'text-gray-400'}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#ef4444' : '#f59e0b' }} />
                  </div>
                </div>

                {/* Step flow */}
                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 pb-3">
                      <button disabled={isFull} onClick={() => !isFull && setStep(p.id, 1)}
                        className={`w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${isFull ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-amber-400 text-black'}`}>
                        {isFull ? (zh ? '名额已满' : 'Full') : <><Gift className="w-3.5 h-3.5" />{zh ? '领取任务' : 'Take Task'}</>}
                      </button>
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div key="s1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                      <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-2.5 py-1.5">
                        <CircleCheck className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[11px] text-green-700 font-semibold">{zh ? '已领取！点击AI生成专属素材' : 'Taken! Generate your material'}</span>
                      </div>
                      <button onClick={() => handleGenerate(p.id)} className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-black text-amber-400 active:scale-95 transition">
                        <Sparkles className="w-3.5 h-3.5" />{zh ? 'AI生成推广素材' : 'AI Generate Material'}
                      </button>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3 pb-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-amber-700">{zh ? 'AI正在生成素材...' : 'AI Generating...'}</div>
                          <div className="text-[9px] text-amber-500 mt-0.5">{zh ? '分析商品特性，生成专属文案' : 'Analyzing product, crafting copy...'}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {step === 3 && (
                    <motion.div key="s3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                      <div className="text-[10px] font-bold text-gray-700 flex items-center gap-1.5">
                        <Image className="w-3 h-3 text-gray-400" />{zh ? '素材预览' : 'Material Preview'}
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                        <div className="flex items-start gap-2 mb-2">
                          <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          <p className="text-[11px] text-gray-700 leading-relaxed">{getCopy(p.id)}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => refreshCopy(p.id)} className="flex-1 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-500 font-semibold flex items-center justify-center gap-1 active:scale-95 transition">
                            <RefreshCw className="w-3 h-3" />{zh ? '换一条' : 'Refresh'}
                          </button>
                          <button onClick={() => doCopy(p.id)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition active:scale-95 ${copied[p.id] ? 'bg-green-100 border border-green-200 text-green-600' : 'bg-white border border-gray-200 text-gray-500'}`}>
                            {copied[p.id] ? <><Check className="w-3 h-3" />{zh ? '已复制' : 'Copied!'}</> : <><Copy className="w-3 h-3" />{zh ? '复制文案' : 'Copy'}</>}
                          </button>
                        </div>
                      </div>
                      <button onClick={() => setStep(p.id, 4)} className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-amber-400 text-black active:scale-95 transition">
                        <Share2 className="w-3.5 h-3.5" />{zh ? '选择转发平台' : 'Select Platforms'}
                      </button>
                    </motion.div>
                  )}
                  {step === 4 && (
                    <motion.div key="s4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pb-3 space-y-2">
                      <div className="text-[10px] font-bold text-gray-700">{zh ? '选择发布平台（可多选）' : 'Select platforms'}</div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PLATFORM_LIST.filter(pl => pl.id !== '全部').map((pl) => {
                          const active = selPlt.has(pl.id);
                          return (
                            <button key={pl.id} onClick={() => togglePlatform(p.id, pl.id)}
                              className={`py-2 rounded-xl border text-[9px] font-bold flex flex-col items-center gap-0.5 transition active:scale-95 ${active ? 'bg-black border-black text-amber-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                              <span className="text-base leading-none">{pl.emoji}</span>
                              {pl.id}
                            </button>
                          );
                        })}
                      </div>
                      <button disabled={selPlt.size === 0} onClick={() => selPlt.size > 0 && setStep(p.id, 5)}
                        className={`w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${selPlt.size === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-amber-400'}`}>
                        <Send className="w-3.5 h-3.5" />
                        {selPlt.size === 0 ? (zh ? '请选择平台' : 'Select platform') : (zh ? `转发到 ${selPlt.size} 个平台` : `Share to ${selPlt.size} platform${selPlt.size > 1 ? 's' : ''}`)}
                      </button>
                    </motion.div>
                  )}
                  {step === 5 && (
                    <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-3 pb-3">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-green-700">{zh ? '转发成功！' : 'Published!'}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {zh ? `已同步 ${getPlatforms(p.id).size} 个平台 · 预计佣金 ` : `Synced to ${getPlatforms(p.id).size} platform(s) · Est. `}
                            <span className="text-amber-600 font-bold">+{p.commission + bonus}%</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ── Tab: 我的任务 ──
const MyTasksPage = ({ zh }: { zh: boolean }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  const filtered = filter === 'all' ? MY_TASKS_DATA : MY_TASKS_DATA.filter(t =>
    filter === 'pending' ? t.status !== 'done' : t.status === 'done'
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-4 pb-24 pt-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: zh ? '今日完成' : 'Done', value: '1', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: zh ? '进行中' : 'Active', value: '3', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: zh ? '今日佣金' : 'Commission', value: '¥312', color: 'text-gray-900', bg: 'bg-white border-gray-100 shadow-sm' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-3 ${s.bg}`}>
            <div className={`text-sm font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex bg-white border border-gray-100 rounded-2xl p-1 gap-1 shadow-sm">
        {[{ id: 'all', label: zh ? '全部' : 'All' }, { id: 'pending', label: zh ? '待处理' : 'Pending' }, { id: 'done', label: zh ? '已完成' : 'Done' }].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id as any)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filter === f.id ? 'bg-black text-amber-400' : 'text-gray-400'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.map((t) => {
        const pl = PLATFORM_LIST.find(p => p.id === t.platform);
        return (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-900">{t.productName}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                t.status === 'done' ? 'bg-green-100 text-green-600' :
                t.status === 'review' ? 'bg-amber-100 text-amber-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {t.status === 'done' ? (zh ? '已完成' : 'Done') : t.status === 'review' ? (zh ? '审核中' : 'Review') : (zh ? '待转发' : 'Pending')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span>{pl?.emoji} {t.platform}</span>
              {t.status === 'done' && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{t.views}</span>}
              <span className={`ml-auto font-bold ${t.status === 'done' ? 'text-amber-600' : 'text-gray-300'}`}>{t.commission}</span>
            </div>
            {t.status === 'pending' && (
              <button className="mt-2 w-full py-2 rounded-xl bg-black text-amber-400 text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition">
                <Sparkles className="w-3 h-3" /> {zh ? '立即AI生成转发' : 'AI Generate & Share'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Tab: 变现 ──
const MonetizePage = ({ zh }: { zh: boolean }) => {
  const platformRevenue = [
    { id: '抖音', revenue: 680, pct: 55 },
    { id: '小红书', revenue: 320, pct: 26 },
    { id: '视频号', revenue: 140, pct: 11 },
    { id: 'B站', revenue: 80, pct: 6 },
    { id: '快手', revenue: 20, pct: 2 },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-4 pb-24 pt-3 space-y-3">
      {/* Hero */}
      <div className="bg-black rounded-2xl p-5">
        <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{zh ? '本月累计收益' : 'Monthly Revenue'}</div>
        <div className="text-4xl font-extrabold text-amber-400" style={{ fontFamily: 'var(--font-display)' }}>¥24,680</div>
        <div className="text-xs text-gray-500 mt-1">{zh ? '较上月 +18.4%' : '+18.4% vs last month'}</div>
        <button className="mt-4 w-full py-2.5 rounded-xl bg-amber-400 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition">
          <Wallet className="w-4 h-4" /> {zh ? '申请提现' : 'Withdraw'}
        </button>
      </div>

      {/* Platform breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="text-xs font-bold text-gray-900 mb-3">{zh ? '按平台拆分' : 'By Platform'}</div>
        {platformRevenue.map((r) => {
          const pl = PLATFORM_LIST.find(p => p.id === r.id)!;
          return (
            <div key={r.id} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span>{pl.emoji}</span>
                  <span className="text-[11px] font-semibold text-gray-700">{r.id}</span>
                </div>
                <span className="text-[11px] font-bold text-gray-900">¥{r.revenue}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full rounded-full bg-amber-400" />
              </div>
            </div>
          );
        })}
      </div>

      {[
        { label: zh ? '带货佣金' : 'Affiliate', value: '¥14,200', icon: ShoppingBag },
        { label: zh ? '广告收益' : 'Ad Revenue', value: '¥6,480', icon: Coins },
        { label: zh ? '平台分成' : 'Platform', value: '¥4,000', icon: Users },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 text-xs font-semibold text-gray-600">{item.label}</div>
            <div className="text-base font-extrabold text-gray-900">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Tab: 我的 ──
const MePage = ({ zh }: { zh: boolean }) => (
  <div className="flex-1 overflow-y-auto bg-gray-50 px-4 pb-24 pt-3 space-y-3">
    <div className="bg-black rounded-2xl p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
        <Crown className="w-7 h-7 text-black" />
      </div>
      <div>
        <div className="text-sm font-bold text-white">AI Star MCN</div>
        <div className="text-[10px] text-amber-400 mt-0.5">Pro · {zh ? '生态创业者' : 'Eco Entrepreneur'}</div>
        <div className="text-[9px] text-gray-500 mt-1">{zh ? '邀请码：MCN8899' : 'Invite: MCN8899'}</div>
      </div>
    </div>
    {[
      { icon: Bell, label: zh ? '通知中心' : 'Notifications', value: '3', valueColor: 'text-red-500' },
      { icon: Users, label: zh ? '邀请好友' : 'Invite Friends', value: '', valueColor: '' },
      { icon: Gift, label: zh ? '我的奖励' : 'My Rewards', value: '¥240', valueColor: 'text-amber-600' },
      { icon: Zap, label: zh ? '升级Pro' : 'Upgrade Pro', value: '', valueColor: '' },
      { icon: AlertCircle, label: zh ? '帮助中心' : 'Help', value: '', valueColor: '' },
    ].map((item) => {
      const Icon = item.icon;
      return (
        <button key={item.label} className="w-full flex items-center gap-3 bg-white shadow-sm border border-gray-100 rounded-2xl p-4 active:bg-gray-50 transition">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-600" />
          </div>
          <span className="flex-1 text-sm font-semibold text-gray-900 text-left">{item.label}</span>
          {item.value && <span className={`text-xs font-bold ${item.valueColor}`}>{item.value}</span>}
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
      );
    })}
  </div>
);

// ── Main Component ──
export const EntrepreneurMiniApp = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<Tab>('messages');

  const TABS: { id: Tab; icon: React.ComponentType<any>; labelZh: string; labelEn: string; badge?: number }[] = [
    { id: 'messages', icon: MessageCircle, labelZh: '消息', labelEn: 'Messages' },
    { id: 'products', icon: ShoppingBag, labelZh: '选品', labelEn: 'Products', badge: PRODUCTS.filter(p => p.status === 'available').length },
    { id: 'mytasks', icon: ClipboardList, labelZh: '任务', labelEn: 'Tasks', badge: MY_TASKS_DATA.filter(t => t.status === 'pending').length },
    { id: 'monetize', icon: Wallet, labelZh: '变现', labelEn: 'Revenue' },
    { id: 'me', icon: User, labelZh: '我的', labelEn: 'Me' },
  ];

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="relative w-full max-w-[390px] bg-gray-50 rounded-[44px] border border-gray-200 overflow-hidden flex flex-col"
        style={{ height: '844px', boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 40px 80px rgba(0,0,0,0.25), 0 0 60px rgba(245,158,11,0.12)' }}>

        {/* Status bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3 pb-1 bg-gray-50">
          <span className="text-[11px] font-bold text-gray-900">9:41</span>
          <div className="w-[120px] h-[30px] bg-black rounded-full absolute top-0 left-1/2 -translate-x-1/2" />
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end h-3">
              {[2,3,4,4].map((h, i) => <div key={i} className="w-1 bg-black rounded-sm" style={{ height: `${h * 3}px` }} />)}
            </div>
            <Zap className="w-3 h-3 text-black" />
          </div>
        </div>

        {/* App header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
              {zh ? 'AI Star · 创业者版' : 'AI Star · Entrepreneur'}
            </div>
            <div className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold">
              <Smartphone className="w-2.5 h-2.5" />
              {zh ? '小程序' : 'Mini Program'}
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-amber-500" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">3</span>
          </button>
        </div>

        {/* Page content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'messages' && <MessagesPage zh={zh} />}
            {activeTab === 'products' && <ProductsPage zh={zh} />}
            {activeTab === 'mytasks' && <MyTasksPage zh={zh} />}
            {activeTab === 'monetize' && <MonetizePage zh={zh} />}
            {activeTab === 'me' && <MePage zh={zh} />}
          </motion.div>
        </AnimatePresence>

        {/* Bottom tab bar */}
        <div className="flex-shrink-0 flex items-end bg-white border-t border-gray-100 pb-1">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCenter = idx === 2;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center transition active:scale-90 relative ${isCenter ? 'pb-0' : 'py-2.5'}`}>
                {isCenter ? (
                  <div className="w-[52px] h-[52px] rounded-full bg-amber-400 -mt-7 flex items-center justify-center shadow-lg shadow-amber-200/70 border-4 border-white">
                    <Icon style={{ width: 22, height: 22 }} className="text-black" />
                  </div>
                ) : (
                  <>
                    <div className="relative flex items-center justify-center w-8 h-6">
                      <Icon style={{ width: 18, height: 18 }} className={`transition-colors ${isActive ? 'text-amber-500' : 'text-gray-400'}`} />
                      {tab.badge && tab.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{tab.badge}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold transition-colors mt-0.5 ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>
                      {zh ? tab.labelZh : tab.labelEn}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20" style={{ background: 'radial-gradient(circle,#f59e0b,transparent 70%)' }} />
      </div>
    </div>
  );
};
