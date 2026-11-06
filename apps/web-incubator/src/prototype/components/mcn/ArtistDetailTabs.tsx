import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ExternalLink, RefreshCw, BarChart3, CheckCircle2, AlertCircle, Loader2,
  TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle, DollarSign,
  Calendar, Shield, AlertTriangle, Pause, Search, Filter, Music, Film,
  ShoppingBag, Tv, Video, Flame, Crown, ChevronDown, History, Trash2, MoreVertical, Pencil, Link2Off, X
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Lang } from '../../translations';
import {
  type Artist, type Platform, type ContentType, type AuthorizationStatus,
  type PrivateDomainType, type PrivatePlatformAccount, type PlatformAccount, type FanProfile,
  PLATFORM_CONFIG, PRIVATE_DOMAIN_CONFIG, AUTHORIZATION_TYPE_CONFIG, AUTH_STATUS_CONFIG,
} from './ArtistTypes';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const num = (s: string | undefined) => parseInt((s || '0').replace(/[^0-9.]/g, '')) || 0;

interface SyncLogEntry {
  id: string;
  artistId: string;
  platform: string;
  startedAt: number;
  durationMs: number;
  result: 'ok' | 'error';
  delta?: number;
  error?: string;
}
const SYNC_LOG_LS_KEY = 'mcn:syncLog:v1';
const SYNC_LOG_MAX = 80;

type PlatformCategory = 'all' | 'public' | 'wework' | 'wechat_group' | 'private_summary' | 'short_video' | 'social' | 'video' | 'music' | 'overseas';
const PLATFORM_CATEGORY_MAP: Record<string, Exclude<PlatformCategory, 'all' | 'public' | 'wework' | 'wechat_group' | 'private_summary'>> = {
  douyin: 'short_video', wechat_channels: 'short_video', tiktok: 'short_video',
  xiaohongshu: 'social', weibo: 'social', instagram: 'social',
  bilibili: 'video', youtube: 'video',
  spotify: 'music',
};
const PLATFORM_CATEGORIES: { id: PlatformCategory; zh: string; en: string; icon: string }[] = [
  { id: 'all', zh: '全部', en: 'All', icon: 'ALL' },
  { id: 'public', zh: '公域平台', en: 'Public', icon: 'PUB' },
  { id: 'wework', zh: '企业微信', en: 'WeWork', icon: 'WW' },
  { id: 'wechat_group', zh: '微信群', en: 'WeChat Groups', icon: 'GRP' },
  { id: 'private_summary', zh: '私域合计', en: 'Private Total', icon: 'PRV' },
  { id: 'short_video', zh: '短视频', en: 'Short Video', icon: 'VID' },
  { id: 'social', zh: '社交', en: 'Social', icon: 'SNS' },
  { id: 'video', zh: '视频', en: 'Video', icon: 'TVS' },
  { id: 'music', zh: '音乐', en: 'Music', icon: 'MUS' },
  { id: 'overseas', zh: '海外', en: 'Overseas', icon: 'INT' },
];
const OVERSEAS_PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'spotify']);

const loadSyncLog = (): SyncLogEntry[] => {
  try { return JSON.parse(localStorage.getItem(SYNC_LOG_LS_KEY) || '[]'); } catch { return []; }
};
const persistSyncLog = (log: SyncLogEntry[]) => {
  try { localStorage.setItem(SYNC_LOG_LS_KEY, JSON.stringify(log.slice(0, SYNC_LOG_MAX))); } catch {}
};

/* ============== Platform Matrix Tab ============== */
type CardDensity = 'compact' | 'normal' | 'detailed';
export const PlatformMatrixTab = ({ artist, lang }: { artist: Artist; lang: Lang }) => {
  const zh = lang === 'zh';
  const platforms = artist.platforms || [];
  const privatePlatforms = artist.privatePlatforms || [];
  const [filter, setFilter] = useState<'all' | 'verified' | 'syncing'>('all');
  const [syncing, setSyncing] = useState<Record<string, { progress: number; phase: 'pull' | 'parse' | 'merge' | 'done' | 'error'; error?: string } | undefined>>({});
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const [density, setDensity] = useState<CardDensity>('normal');
  const [recentSuccess, setRecentSuccess] = useState<Record<string, { delta: number; at: number } | undefined>>({});
  const [batchSync, setBatchSync] = useState<{ total: number; done: number; failed: number; deltaSum: number } | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>(() => loadSyncLog());
  const [showLog, setShowLog] = useState(false);
  const [groupByDay, setGroupByDay] = useState(true);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [exportFlash, setExportFlash] = useState<'copied' | 'downloaded' | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState<'all' | 'public' | 'wework' | 'wechat_group' | 'private_summary'>('all');
  const [secondaryCategory, setSecondaryCategory] = useState<'short_video' | 'social' | 'video' | 'music' | 'overseas' | null>(null);
  const [specificPlatform, setSpecificPlatform] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const EXTRA_LS_KEY = `mcn:extraAccounts:${artist.id}`;
  const [extraAccounts, setExtraAccounts] = useState<typeof platforms>(() => {
    try { return JSON.parse(localStorage.getItem(EXTRA_LS_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(EXTRA_LS_KEY, JSON.stringify(extraAccounts)); } catch {}
  }, [extraAccounts, EXTRA_LS_KEY]);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; handle: string; verified: boolean; url: string } | null>(null);
  const [confirmUnbind, setConfirmUnbind] = useState<typeof platforms[number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [showDataOverview, setShowDataOverview] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['platform', 'handle', 'fans', 'growth', 'engagement', 'views', 'status', 'actions']));
  const [statsDrawerPlatform, setStatsDrawerPlatform] = useState<typeof platforms[number] | null>(null);
  const isExtra = (p: typeof platforms[number]) => extraAccounts.some(e => e.platform === p.platform && e.handle === p.handle);
  const unbindAccount = (p: typeof platforms[number]) => {
    setExtraAccounts(prev => prev.filter(e => !(e.platform === p.platform && e.handle === p.handle)));
    setMenuOpenFor(null);
    setToast({ msg: zh ? `已解绑 ${PLATFORM_CONFIG[p.platform].zh} @${p.handle}` : `Unbound ${PLATFORM_CONFIG[p.platform].en} @${p.handle}`, tone: 'ok' });
    setTimeout(() => setToast(null), 2400);
  };
  const saveEdit = () => {
    if (!editing) return;
    setExtraAccounts(prev => prev.map(e => {
      const k = `${e.platform}::${e.handle}`;
      const nu = normalizeUrl(editing.url);
      return k === editing.key ? { ...e, handle: editing.handle.trim() || e.handle, verified: editing.verified, url: nu.ok ? nu.url : e.url } : e;
    }));
    setEditing(null);
    setMenuOpenFor(null);
  };
  const [draft, setDraft] = useState<{ platform: string; handle: string; verified: boolean; url: string }>({ platform: 'douyin', handle: '', verified: false, url: '' });

  const allPlatforms = useMemo(() => [...platforms, ...extraAccounts], [platforms, extraAccounts]);
  const allPrivatePlatforms = privatePlatforms;
  const inCategory = (platformKey: string, isPrivate: boolean = false) => {
    // 如果选择了具体平台，优先匹配
    if (specificPlatform) {
      return !isPrivate && platformKey === specificPlatform;
    }
    
    // 一级分类筛选
    if (primaryCategory === 'all') {
      // 如果选了二级分类，则筛选该二级分类
      if (secondaryCategory) {
        if (isPrivate) return false;
        const cat = PLATFORM_CATEGORY_MAP[platformKey];
        if (secondaryCategory === 'overseas') return OVERSEAS_PLATFORMS.has(platformKey);
        return cat === secondaryCategory;
      }
      return true;
    }
    if (primaryCategory === 'public') {
      if (isPrivate) return false;
      // 如果选了二级分类，则筛选该二级分类
      if (secondaryCategory) {
        const cat = PLATFORM_CATEGORY_MAP[platformKey];
        if (secondaryCategory === 'overseas') return OVERSEAS_PLATFORMS.has(platformKey);
        return cat === secondaryCategory;
      }
      return true; // 未选二级分类时显示所有公域
    }
    if (primaryCategory === 'wework' || primaryCategory === 'wechat_group') {
      return isPrivate && platformKey === primaryCategory;
    }
    if (primaryCategory === 'private_summary') {
      return isPrivate;
    }
    return false;
  };
  const categoryCounts = useMemo(() => {
    const totalPrivate = allPrivatePlatforms.length;
    const weworkCount = allPrivatePlatforms.filter(p => p.type === 'wework').length;
    const wechatGroupCount = allPrivatePlatforms.filter(p => p.type === 'wechat_group').length;
    const m: Record<PlatformCategory, number> = { 
      all: allPlatforms.length + totalPrivate, 
      public: allPlatforms.length,
      wework: weworkCount,
      wechat_group: wechatGroupCount,
      private_summary: totalPrivate,
      short_video: 0, social: 0, video: 0, music: 0, overseas: 0 
    };
    allPlatforms.forEach(p => {
      const c = PLATFORM_CATEGORY_MAP[p.platform];
      if (c) m[c]++;
      if (OVERSEAS_PLATFORMS.has(p.platform)) m.overseas++;
    });
    return m;
  }, [allPlatforms]);
  const occupiedKeys = new Set(allPlatforms.map(p => p.platform));
  const availablePlatformsToAdd = (Object.keys(PLATFORM_CONFIG) as Array<keyof typeof PLATFORM_CONFIG>).filter(k => !occupiedKeys.has(k));
  const normalizeUrl = (raw: string): { ok: boolean; url?: string; error?: string } => {
    const v = raw.trim();
    if (!v) return { ok: true };
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withProto);
      if (!u.hostname.includes('.')) return { ok: false, error: zh ? '链接格式不正确' : 'Invalid URL' };
      return { ok: true, url: u.toString() };
    } catch { return { ok: false, error: zh ? '链接格式不正确' : 'Invalid URL' }; }
  };
  const draftUrlCheck = useMemo(() => normalizeUrl(draft.url), [draft.url, zh]);
  const addAccount = () => {
    if (!draft.handle.trim() || !draft.platform) return;
    if (!draftUrlCheck.ok) {
      setToast({ msg: draftUrlCheck.error!, tone: 'err' });
      setTimeout(() => setToast(null), 2400);
      return;
    }
    const newAcc = {
      platform: draft.platform as Platform, handle: draft.handle.trim(), verified: draft.verified,
      url: draftUrlCheck.url,
      fans: '0', growth7d: 0, engagement: 0, posts: 0, views30d: '0',
      latestTitle: zh ? '尚无内容' : 'No content yet', latestAt: zh ? '刚刚' : 'Just now', syncStatus: 'manual' as const,
    };
    setExtraAccounts(prev => [...prev, newAcc]);
    setDraft({ platform: availablePlatformsToAdd[1] || 'douyin', handle: '', verified: false, url: '' });
    setToast({ msg: zh ? `已添加 ${PLATFORM_CONFIG[newAcc.platform].zh} @${newAcc.handle}` : `Added ${PLATFORM_CONFIG[newAcc.platform].en} @${newAcc.handle}`, tone: 'ok' });
    setTimeout(() => setToast(null), 2400);
  };

  const downloadLogJSON = () => {
    if (artistLog.length === 0) return;
    const payload = { artistId: artist.id, artistName: artist.name, exportedAt: new Date().toISOString(), entries: artistLog };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sync-log-${artist.id}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    setExportFlash('downloaded'); setTimeout(() => setExportFlash(null), 1800);
  };
  const copyLogJSON = async () => {
    if (artistLog.length === 0) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(artistLog, null, 2));
      setExportFlash('copied'); setTimeout(() => setExportFlash(null), 1800);
    } catch {}
  };

  const appendLog = (entry: SyncLogEntry) => {
    setSyncLog(prev => {
      const next = [entry, ...prev].slice(0, SYNC_LOG_MAX);
      persistSyncLog(next);
      return next;
    });
  };
  const artistLog = useMemo(() => syncLog.filter(l => l.artistId === artist.id), [syncLog, artist.id]);
  const clearArtistLog = () => {
    const remaining = syncLog.filter(l => l.artistId !== artist.id);
    setSyncLog(remaining);
    persistSyncLog(remaining);
  };

  const runSync = (platformKey: string) => {
    if (syncing[platformKey]) return;
    const phases: Array<'pull' | 'parse' | 'merge' | 'done'> = ['pull', 'parse', 'merge', 'done'];
    const startTime = Date.now();
    let step = 0;
    const tick = () => {
      step++;
      const phase = phases[Math.min(step, phases.length - 1)];
      const progress = Math.min(100, step * 25 + Math.random() * 15);
      // 8% chance of error per run
      if (Math.random() > 0.92 && step === 2) {
        const errs = [zh ? '授权令牌已过期' : 'Auth token expired', zh ? '平台 API 限流' : 'API rate limited', zh ? '网络超时' : 'Network timeout'];
        const error = errs[Math.floor(Math.random() * errs.length)];
        setSyncing(s => ({ ...s, [platformKey]: { progress, phase: 'error', error } }));
        setBatchSync(b => b ? { ...b, failed: b.failed + 1 } : b);
        appendLog({ id: `${startTime}-${platformKey}`, artistId: artist.id, platform: platformKey, startedAt: startTime, durationMs: Date.now() - startTime, result: 'error', error });
        setToast({ msg: zh ? `${platformKey} 同步失败 · ${error}` : `${platformKey} failed · ${error}`, tone: 'err' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setSyncing(s => ({ ...s, [platformKey]: { progress, phase } }));
      if (step < phases.length) setTimeout(tick, 600 + Math.random() * 400);
      else {
        const delta = Math.floor(20 + Math.random() * 480);
        setRecentSuccess(s => ({ ...s, [platformKey]: { delta, at: Date.now() } }));
        setBatchSync(b => b ? { ...b, done: b.done + 1, deltaSum: b.deltaSum + delta } : b);
        appendLog({ id: `${startTime}-${platformKey}`, artistId: artist.id, platform: platformKey, startedAt: startTime, durationMs: Date.now() - startTime, result: 'ok', delta });
        setToast({ msg: zh ? `${platformKey} 同步完成 · +${delta} 粉丝` : `${platformKey} synced · +${delta} fans`, tone: 'ok' });
        setTimeout(() => setSyncing(s => ({ ...s, [platformKey]: undefined })), 1400);
        setTimeout(() => setToast(null), 2400);
        setTimeout(() => setRecentSuccess(s => ({ ...s, [platformKey]: undefined })), 4500);
      }
    };
    setSyncing(s => ({ ...s, [platformKey]: { progress: 5, phase: 'pull' } }));
    setTimeout(tick, 400);
  };

  const filtered = allPlatforms.filter(p => {
    const matchCategory = inCategory(p.platform, false);
    const matchFilter = filter === 'verified' ? p.verified : filter === 'syncing' ? p.syncStatus !== 'synced' : true;
    const matchSearch = !searchQuery ||
      p.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      PLATFORM_CONFIG[p.platform][zh ? 'zh' : 'en'].toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchFilter && matchSearch;
  });

  const filteredPrivate = allPrivatePlatforms.filter(p => {
    const matchCategory = inCategory(p.type, true);
    const matchFilter = filter === 'verified' ? p.verified : filter === 'syncing' ? p.syncStatus !== 'synced' : true;
    const matchSearch = !searchQuery ||
      p.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      PRIVATE_DOMAIN_CONFIG[p.type][zh ? 'zh' : 'en'].toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchFilter && matchSearch;
  });

  const totalFans = allPlatforms.reduce((s, p) => s + num(p.fans) * (p.fans.includes('M') ? 1000 : 1), 0);
  const verifiedCount = allPlatforms.filter(p => p.verified).length;
  const topPlatform = [...allPlatforms].sort((a, b) => num(b.fans) * (b.fans.includes('M') ? 1000 : 1) - num(a.fans) * (a.fans.includes('M') ? 1000 : 1))[0];

  const summaries = [
    { label: zh ? '平台总粉丝' : 'Total Fans', value: totalFans >= 1000 ? `${(totalFans / 1000).toFixed(1)}M` : `${totalFans}K`, color: 'text-rose-400', icon: Users },
    { label: zh ? '活跃平台' : 'Active', value: `${platforms.length}`, color: 'text-cyan-400', icon: BarChart3 },
    { label: zh ? '已认证' : 'Verified', value: `${verifiedCount}`, color: 'text-blue-400', icon: CheckCircle2 },
    { label: zh ? '最强平台' : 'Top', value: topPlatform ? PLATFORM_CONFIG[topPlatform.platform][zh ? 'zh' : 'en'] : '—', color: 'text-amber-400', icon: Crown },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaries.map((s, i) => (
          <div key={i} className="bg-black/30 rounded-lg border border-white/5 px-3 py-2.5 flex items-center gap-2.5">
            <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
              <div className={`text-sm font-bold tabular-nums truncate ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {/* 一级分类 */}
        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2 overflow-x-auto whitespace-nowrap [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          <button onClick={() => { setPrimaryCategory('all'); setSecondaryCategory(null); setSpecificPlatform(null); }}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${primaryCategory === 'all' && !specificPlatform ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 text-cyan-200' : 'border border-transparent text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
            <span className="font-mono text-[9px] font-bold">ALL</span><span>{zh ? '全部' : 'All'}</span>
            <span className={`text-[10px] tabular-nums px-1.5 rounded ${primaryCategory === 'all' && !specificPlatform ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/5 text-gray-500'}`}>{categoryCounts.all}</span>
          </button>
          
          {/* 公私域一级分类 */}
          {[
            { id: 'public' as const, icon: 'PUB', label: zh ? '公域平台' : 'Public' },
            { id: 'wework' as const, icon: 'WW', label: zh ? '企业微信' : 'WeWork' },
            { id: 'wechat_group' as const, icon: 'GRP', label: zh ? '微信群' : 'Groups' },
            { id: 'private_summary' as const, icon: 'PRV', label: zh ? '私域合计' : 'Private' },
          ].map(cat => {
            const count = categoryCounts[cat.id];
            if (count === 0) return null;
            const active = primaryCategory === cat.id && !specificPlatform;
            return (
              <button key={cat.id} onClick={() => { 
                setPrimaryCategory(cat.id); 
                setSecondaryCategory(null); 
                setSpecificPlatform(null); 
              }}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${active ? 'bg-gradient-to-r from-blue-500/20 to-green-500/20 border border-blue-500/40 text-blue-200' : 'border border-transparent text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
                <span className="font-mono text-[9px] font-bold">{cat.icon}</span><span>{cat.label}</span>
                <span className={`text-[10px] tabular-nums px-1.5 rounded ${active ? 'bg-blue-500/30 text-blue-100' : 'bg-white/5 text-gray-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* 二级分类 - 仅在选择公域平台时显示 */}
        {primaryCategory === 'public' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 pl-6 overflow-x-auto whitespace-nowrap [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            <span className="text-[10px] text-gray-600 mr-1">{zh ? '细分：' : 'Categories:'}</span>
            {[
              { id: 'short_video' as const, zh: '短视频', en: 'Short Video', icon: 'VID' },
              { id: 'social' as const, zh: '社交', en: 'Social', icon: 'SNS' },
              { id: 'video' as const, zh: '视频', en: 'Video', icon: 'TVS' },
              { id: 'music' as const, zh: '音乐', en: 'Music', icon: 'MUS' },
              { id: 'overseas' as const, zh: '海外', en: 'Overseas', icon: 'INT' },
            ].map(cat => {
              const count = categoryCounts[cat.id];
              if (count === 0) return null;
              const active = secondaryCategory === cat.id && !specificPlatform;
              return (
                <button key={cat.id} onClick={() => { setSecondaryCategory(cat.id); setSpecificPlatform(null); }}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${active ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-200' : 'border border-white/10 text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
                  <span className="text-[9px] font-mono font-bold">{cat.icon}</span><span>{zh ? cat.zh : cat.en}</span>
                  <span className={`text-[9px] tabular-nums px-1 rounded ${active ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/5 text-gray-500'}`}>{count}</span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* 具体平台标签 */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {(() => {
            const PLATFORM_ORDER = ['douyin', 'wechat_channels', 'xiaohongshu', 'bilibili', 'weibo', 'tiktok', 'youtube', 'instagram', 'spotify'];
            const counts = allPlatforms.reduce<Record<string, number>>((m, p) => { m[p.platform] = (m[p.platform] || 0) + 1; return m; }, {});
            const keys = Object.keys(counts).sort((a, b) => {
              const ai = PLATFORM_ORDER.indexOf(a); const bi = PLATFORM_ORDER.indexOf(b);
              return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            });
            return keys.map(k => {
              const cfg = PLATFORM_CONFIG[k as keyof typeof PLATFORM_CONFIG];
              if (!cfg) return null;
              const active = specificPlatform === k;
              const count = counts[k];
              const hasUserAdded = extraAccounts.some(e => e.platform === k);
              return (
                <div key={k} className={`group/tab shrink-0 inline-flex items-center text-xs rounded-lg transition ${active ? `${cfg.bg} border ${cfg.color} border-white/30` : 'border border-transparent hover:bg-white/5'}`}>
                  <button onClick={() => { setSpecificPlatform(k); setPrimaryCategory('public'); setSecondaryCategory(null); }}
                    title={zh ? `查看 ${cfg.zh} 账号` : `View ${cfg.en} accounts`}
                    className={`pl-3 pr-1.5 py-1.5 flex items-center gap-1.5 ${active ? '' : 'text-gray-500 hover:text-gray-200'}`}>
                    <span className={`font-mono text-[9px] font-bold ${cfg.color}`}>{cfg.emoji}</span><span>{zh ? cfg.zh : cfg.en}</span>
                    <span className={`text-[10px] tabular-nums px-1.5 rounded ${active ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'}`}>{count}</span>
                  </button>
                  {hasUserAdded && (
                    <button onClick={(e) => {
                        e.stopPropagation();
                        setExtraAccounts(prev => prev.filter(a => a.platform !== k));
                        if (specificPlatform === k) setSpecificPlatform(null);
                        setToast({ msg: zh ? `已移除 ${cfg.zh} 自添加账号` : `Removed user-added ${cfg.en} accounts`, tone: 'ok' });
                        setTimeout(() => setToast(null), 2200);
                      }}
                      title={zh ? '移除自添加账号' : 'Remove user-added accounts'}
                      className="opacity-0 group-hover/tab:opacity-100 focus:opacity-100 px-1.5 py-1.5 text-gray-500 hover:text-red-400 transition">×</button>
                  )}
                </div>
              );
            });
          })()}
          <button onClick={() => { setShowAddAccount(true); setDraft({ platform: availablePlatformsToAdd[0] || 'douyin', handle: '', verified: false, url: '' }); }}
            disabled={availablePlatformsToAdd.length === 0}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ml-1">
            <span className="text-sm leading-none">+</span> {zh ? '添加平台' : 'Add Platform'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={zh ? '搜索平台或账号...' : 'Search platform or handle...'}
              className="w-[180px] bg-black/40 border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                ×
              </button>
            )}
          </div>
          {(['all', 'verified', 'syncing'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${filter === f ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'border-white/10 text-gray-500 hover:border-white/20'}`}>
              {f === 'all' ? (zh ? '全部' : 'All') : f === 'verified' ? (zh ? '已认证' : 'Verified') : (zh ? '同步异常' : 'Sync Issues')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/30 rounded-full border border-white/10 p-0.5">
            {(['compact', 'normal', 'detailed'] as const).map(d => (
              <button key={d} onClick={() => setDensity(d)}
                title={d === 'compact' ? (zh ? '紧凑视图' : 'Compact') : d === 'normal' ? (zh ? '标准视图' : 'Normal') : (zh ? '详细视图' : 'Detailed')}
                className={`text-[10px] px-2 py-0.5 rounded-full transition ${density === d ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 hover:text-gray-300'}`}>
                {d === 'compact' ? '紧凑' : d === 'normal' ? '标准' : '详细'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowDataOverview(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${showDataOverview ? 'border-amber-500/40 bg-amber-500/15 text-amber-200' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
            <BarChart3 className="w-3 h-3" /> {zh ? '数据概览' : 'Overview'}
          </button>
          <button onClick={() => setShowLog(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${showLog ? 'border-purple-500/40 bg-purple-500/15 text-purple-200' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
            <History className="w-3 h-3" /> {zh ? '同步日志' : 'Log'}
            {artistLog.length > 0 && <span className="text-[10px] tabular-nums opacity-70">({artistLog.length})</span>}
          </button>
          {selectedPlatforms.size > 0 ? (
            <button onClick={() => {
                const toSync = Array.from(selectedPlatforms);
                setBatchSync({ total: toSync.length, done: 0, failed: 0, deltaSum: 0 });
                toSync.forEach((p, idx) => setTimeout(() => runSync(p), idx * 220));
                setSelectedPlatforms(new Set());
              }}
              disabled={Object.values(syncing).some(s => s && s.phase !== 'error' && s.phase !== 'done')}
              className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className="w-3 h-3" /> {zh ? `同步选中 (${selectedPlatforms.size})` : `Sync Selected (${selectedPlatforms.size})`}
            </button>
          ) : (
            <button onClick={() => {
                setBatchSync({ total: platforms.length, done: 0, failed: 0, deltaSum: 0 });
                platforms.forEach((p, idx) => setTimeout(() => runSync(p.platform), idx * 220));
              }}
              disabled={Object.values(syncing).some(s => s && s.phase !== 'error' && s.phase !== 'done')}
              className="text-xs px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className="w-3 h-3" /> {zh ? '一键同步全部' : 'Sync All'}
            </button>
          )}
        </div>
      </div>

      {showDataOverview && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">{zh ? '平台数据对比' : 'Platform Data Comparison'}</span>
            </div>
            <button onClick={() => setShowDataOverview(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              const platforms = allPlatforms.slice(0, 8);
              const maxFans = Math.max(...platforms.map(p => num(p.fans) * (p.fans.includes('M') ? 1000 : 1)));
              const maxGrowth = Math.max(...platforms.map(p => Math.abs(p.growth7d)));
              const maxEngagement = Math.max(...platforms.map(p => p.engagement));
              return (
                <>
                  <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">{zh ? '粉丝数对比' : 'Fans Comparison'}</div>
                    <div className="space-y-2">
                      {platforms.map(p => {
                        const cfg = PLATFORM_CONFIG[p.platform];
                        const fansNum = num(p.fans) * (p.fans.includes('M') ? 1000 : 1);
                        const percent = (fansNum / maxFans) * 100;
                        return (
                          <div key={p.platform} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`flex items-center gap-1 ${cfg.color}`}>
                                <span className="font-mono text-[9px] font-bold">{cfg.emoji}</span> {zh ? cfg.zh : cfg.en}
                              </span>
                              <span className="tabular-nums text-gray-400">{p.fans}</span>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${cfg.bg.replace('/10', '/40')}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">{zh ? '增长率对比' : 'Growth Rate'}</div>
                    <div className="space-y-2">
                      {platforms.map(p => {
                        const cfg = PLATFORM_CONFIG[p.platform];
                        const percent = (Math.abs(p.growth7d) / maxGrowth) * 100;
                        return (
                          <div key={p.platform} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`flex items-center gap-1 ${cfg.color}`}>
                                <span className="font-mono text-[9px] font-bold">{cfg.emoji}</span> {zh ? cfg.zh : cfg.en}
                              </span>
                              <span className={`tabular-nums ${p.growth7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {p.growth7d >= 0 ? '+' : ''}{p.growth7d.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${p.growth7d >= 0 ? 'bg-green-500/40' : 'bg-red-500/40'}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">{zh ? '互动率对比' : 'Engagement Rate'}</div>
                    <div className="space-y-2">
                      {platforms.map(p => {
                        const cfg = PLATFORM_CONFIG[p.platform];
                        const percent = (p.engagement / maxEngagement) * 100;
                        return (
                          <div key={p.platform} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`flex items-center gap-1 ${cfg.color}`}>
                                <span className="font-mono text-[9px] font-bold">{cfg.emoji}</span> {zh ? cfg.zh : cfg.en}
                              </span>
                              <span className="tabular-nums text-orange-300">{p.engagement}%</span>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-orange-500/40" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>
      )}

      {showLog && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-purple-500/20 bg-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-bold text-purple-200">{zh ? '同步历史' : 'Sync History'}</span>
              <span className="text-gray-500 tabular-nums">· {artistLog.length} {zh ? '条' : 'entries'}</span>
              {(() => {
                const ok = artistLog.filter(l => l.result === 'ok').length;
                const err = artistLog.filter(l => l.result === 'error').length;
                return (
                  <>
                    {ok > 0 && <span className="text-green-400 tabular-nums">· {ok} ok</span>}
                    {err > 0 && <span className="text-red-400 tabular-nums">· {err} err</span>}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setGroupByDay(v => !v)}
                className={`text-[10px] px-2 py-0.5 rounded border transition ${groupByDay ? 'border-purple-500/40 bg-purple-500/10 text-purple-200' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                {zh ? '按日分组' : 'Group by day'}
              </button>
              {artistLog.length > 0 && (
                <>
                  <button onClick={copyLogJSON}
                    className={`text-[10px] px-2 py-0.5 rounded border transition ${exportFlash === 'copied' ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/30'}`}>
                    {exportFlash === 'copied' ? (zh ? '已复制 ✓' : 'Copied ✓') : (zh ? '复制 JSON' : 'Copy JSON')}
                  </button>
                  <button onClick={downloadLogJSON}
                    className={`text-[10px] px-2 py-0.5 rounded border transition ${exportFlash === 'downloaded' ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/30'}`}>
                    {exportFlash === 'downloaded' ? (zh ? '已下载 ✓' : 'Saved ✓') : (zh ? '导出 JSON' : 'Export JSON')}
                  </button>
                </>
              )}
              {artistLog.length > 0 && (
                <button onClick={clearArtistLog} className="text-[10px] text-gray-500 hover:text-red-400 transition flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> {zh ? '清空' : 'Clear'}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {artistLog.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">{zh ? '尚无同步记录' : 'No sync history yet'}</div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-black/80 backdrop-blur">
                  <tr className="border-b border-white/5 text-[9px] uppercase tracking-wider text-gray-500">
                    <th className="text-left px-3 py-1.5 font-medium">{zh ? '时间' : 'Time'}</th>
                    <th className="text-left px-3 py-1.5 font-medium">{zh ? '平台' : 'Platform'}</th>
                    <th className="text-left px-3 py-1.5 font-medium">{zh ? '耗时' : 'Duration'}</th>
                    <th className="text-left px-3 py-1.5 font-medium">{zh ? '结果' : 'Result'}</th>
                    <th className="text-right px-3 py-1.5 font-medium">{zh ? '增量/原因' : 'Delta / Reason'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const renderRow = (e: SyncLogEntry) => {
                      const cfg = PLATFORM_CONFIG[e.platform as keyof typeof PLATFORM_CONFIG];
                      const d = new Date(e.startedAt);
                      const ago = Math.round((Date.now() - e.startedAt) / 1000);
                      const agoLabel = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.round(ago / 60)}m` : `${Math.round(ago / 3600)}h`;
                      return (
                        <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-3 py-1.5 text-gray-400 tabular-nums">{d.toLocaleTimeString()} <span className="text-gray-600">· {agoLabel} ago</span></td>
                          <td className="px-3 py-1.5">{cfg ? <span className={`${cfg.color} flex items-center gap-1`}><span className="font-mono text-[9px] font-bold">{cfg.emoji}</span>{zh ? cfg.zh : cfg.en}</span> : e.platform}</td>
                          <td className="px-3 py-1.5 tabular-nums text-gray-400">{(e.durationMs / 1000).toFixed(1)}s</td>
                          <td className="px-3 py-1.5">
                            {e.result === 'ok' ? (
                              <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{zh ? '成功' : 'OK'}</span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{zh ? '失败' : 'Error'}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {e.result === 'ok' ? <span className="text-green-300">+{e.delta}</span> : <span className="text-red-300">{e.error}</span>}
                          </td>
                        </tr>
                      );
                    };
                    if (!groupByDay) return artistLog.map(renderRow);
                    const groups: Record<string, SyncLogEntry[]> = {};
                    artistLog.forEach(e => {
                      const d = new Date(e.startedAt);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      (groups[key] = groups[key] || []).push(e);
                    });
                    const today = new Date();
                    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const yKey = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`; })();
                    return Object.entries(groups).map(([key, entries]) => {
                      const ok = entries.filter(e => e.result === 'ok').length;
                      const err = entries.filter(e => e.result === 'error').length;
                      const deltaSum = entries.filter(e => e.result === 'ok').reduce((s, e) => s + (e.delta || 0), 0);
                      const collapsed = collapsedDays[key];
                      const label = key === todayKey ? (zh ? '今天' : 'Today') : key === yKey ? (zh ? '昨天' : 'Yesterday') : key;
                      return (
                        <React.Fragment key={key}>
                          <tr className="bg-purple-500/5 border-b border-purple-500/10 sticky top-[26px]">
                            <td colSpan={5} className="px-3 py-1">
                              <button onClick={() => setCollapsedDays(s => ({ ...s, [key]: !s[key] }))}
                                className="w-full flex items-center justify-between text-[10px] hover:text-purple-200 transition">
                                <span className="flex items-center gap-1.5">
                                  <ChevronDown className={`w-3 h-3 transition ${collapsed ? '-rotate-90' : ''}`} />
                                  <span className="font-bold text-purple-200 uppercase tracking-wider">{label}</span>
                                  <span className="text-gray-500 tabular-nums">· {entries.length}</span>
                                </span>
                                <span className="flex items-center gap-2 tabular-nums">
                                  {ok > 0 && <span className="text-green-400">{ok} ok</span>}
                                  {err > 0 && <span className="text-red-400">{err} err</span>}
                                  {deltaSum > 0 && <span className="text-cyan-300">+{deltaSum.toLocaleString()}</span>}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {!collapsed && entries.map(renderRow)}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {batchSync && (() => {
        const settled = batchSync.done + batchSync.failed;
        const pct = (settled / batchSync.total) * 100;
        const finished = settled >= batchSync.total;
        return (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${!finished ? 'animate-spin' : ''}`} />
                <span className="font-bold text-cyan-300">{finished ? (zh ? '同步完成' : 'Sync Complete') : (zh ? '批量同步中' : 'Syncing all platforms')}</span>
                <span className="text-gray-500">·</span>
                <span className="tabular-nums text-gray-400">{settled}/{batchSync.total}</span>
                {batchSync.failed > 0 && <span className="text-red-400 tabular-nums">· {batchSync.failed} {zh ? '失败' : 'failed'}</span>}
                {batchSync.deltaSum > 0 && <span className="text-green-400 tabular-nums">· +{batchSync.deltaSum.toLocaleString()} {zh ? '粉丝' : 'fans'}</span>}
              </div>
              {finished && (
                <button onClick={() => setBatchSync(null)} className="text-[10px] text-gray-500 hover:text-white transition">{zh ? '关闭' : 'Dismiss'}</button>
              )}
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div className={`h-full rounded-full ${batchSync.failed > 0 ? 'bg-gradient-to-r from-amber-500 to-cyan-500' : 'bg-gradient-to-r from-cyan-500 to-purple-500'}`}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .3 }} />
            </div>
          </motion.div>
        );
      })()}

{(() => {
        const renderCard = (p: typeof filtered[number], i: number) => {
          const cfg = PLATFORM_CONFIG[p.platform];
          const liveSync = syncing[p.platform];
          const effStatus = liveSync ? (liveSync.phase === 'error' ? 'error' : liveSync.phase === 'done' ? 'synced' : 'syncing') : p.syncStatus;
          const SyncIcon = effStatus === 'syncing' ? Loader2 : effStatus === 'error' ? AlertCircle : CheckCircle2;
          const phaseLabel = liveSync && liveSync.phase !== 'error' ? ({ pull: zh ? '拉取数据' : 'Pulling', parse: zh ? '解析中' : 'Parsing', merge: zh ? '合并写入' : 'Merging', done: zh ? '完成' : 'Done' }[liveSync.phase]) : null;

          if (density === 'compact') {
            return null;
          }

          return (
            <motion.div key={p.platform} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }}
              className="bg-black/30 rounded-xl border border-white/5 p-3.5 hover:border-white/15 transition group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}><span className={`font-mono text-[10px] font-bold ${cfg.color}`}>{cfg.emoji}</span></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</span>
                      {p.verified && <Shield className="w-3 h-3 text-blue-400" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{p.handle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge className={`text-[9px] border-0 px-1.5 flex items-center gap-1 ${effStatus === 'error' ? 'bg-red-500/15 text-red-300' : effStatus === 'syncing' ? 'bg-amber-500/15 text-amber-300' : 'bg-green-500/15 text-green-300'}`}>
                    <SyncIcon className={`w-2.5 h-2.5 ${effStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    {phaseLabel || (effStatus === 'synced' ? (zh ? '已同步' : 'Synced') : effStatus === 'syncing' ? (zh ? '同步中' : 'Syncing') : (zh ? '错误' : 'Error'))}
                  </Badge>
                  {isExtra(p) && (() => {
                    const mk = `${p.platform}::${p.handle}`;
                    return (
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === mk ? null : mk); }}
                          className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {menuOpenFor === mk && (
                          <div className="absolute right-0 top-7 z-20 min-w-[140px] rounded-lg border border-white/10 bg-black/95 backdrop-blur shadow-xl overflow-hidden">
                            <button onClick={() => { setEditing({ key: mk, handle: p.handle, verified: p.verified, url: p.url || '' }); setMenuOpenFor(null); }}
                              className="w-full text-left text-[11px] px-3 py-2 text-gray-300 hover:bg-cyan-500/15 hover:text-cyan-200 flex items-center gap-2">
                              <Pencil className="w-3 h-3" /> {zh ? '编辑账号' : 'Edit'}
                            </button>
                            <button onClick={() => { setConfirmUnbind(p); setMenuOpenFor(null); }}
                              className="w-full text-left text-[11px] px-3 py-2 text-red-300 hover:bg-red-500/15 flex items-center gap-2 border-t border-white/5">
                              <Link2Off className="w-3 h-3" /> {zh ? '解绑账号' : 'Unbind'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {editing && editing.key === `${p.platform}::${p.handle}` && (
                <div className="mb-3 p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-2">
                  <div className="text-[10px] text-cyan-300 uppercase tracking-wider">{zh ? '编辑账号' : 'Edit account'}</div>
                  <input value={editing.handle} onChange={e => setEditing(s => s && { ...s, handle: e.target.value })}
                    placeholder={zh ? '账号 / 昵称' : 'Handle'}
                    className="w-full text-xs px-2 py-1.5 rounded bg-black/40 border border-white/10 focus:border-cyan-500/40 outline-none" />
                  <input value={editing.url} onChange={e => setEditing(s => s && { ...s, url: e.target.value })}
                    placeholder={zh ? '主页链接（可选，如 https://...）' : 'Profile URL (optional)'}
                    className="w-full text-xs px-2 py-1.5 rounded bg-black/40 border border-white/10 focus:border-cyan-500/40 outline-none" />
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-400 flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={editing.verified} onChange={e => setEditing(s => s && { ...s, verified: e.target.checked })} className="accent-cyan-500" />
                      {zh ? '已认证' : 'Verified'}
                    </label>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditing(null)} className="text-[10px] px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-white">{zh ? '取消' : 'Cancel'}</button>
                      <button onClick={saveEdit} className="text-[10px] px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30">{zh ? '保存' : 'Save'}</button>
                    </div>
                  </div>
                </div>
              )}

              {liveSync && liveSync.phase !== 'error' && (
                <div className="mb-3">
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" initial={{ width: 0 }} animate={{ width: `${liveSync.progress}%` }} transition={{ duration: .4 }} />
                  </div>
                  <div className="text-[9px] text-gray-500 mt-1 tabular-nums flex justify-between">
                    <span>{phaseLabel}</span><span>{Math.round(liveSync.progress)}%</span>
                  </div>
                </div>
              )}

              {liveSync?.phase === 'error' && (
                <div className="mb-3 p-2 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-red-300 min-w-0">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{liveSync.error}</span>
                  </div>
                  <button onClick={() => { setSyncing(s => ({ ...s, [p.platform]: undefined })); setTimeout(() => runSync(p.platform), 100); }}
                    className="text-[10px] px-2 py-0.5 rounded border border-red-500/40 text-red-200 hover:bg-red-500/15 transition flex items-center gap-1 shrink-0">
                    <RefreshCw className="w-2.5 h-2.5" /> {zh ? '重试' : 'Retry'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="relative">
                  <div className="text-[9px] text-gray-500 uppercase">{zh ? '粉丝' : 'Fans'}</div>
                  <motion.div
                    key={recentSuccess[p.platform]?.at || 'static'}
                    animate={recentSuccess[p.platform] ? { scale: [1, 1.15, 1], color: ['#fff', '#34d399', '#fff'] } : {}}
                    transition={{ duration: 1.2 }}
                    className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{p.fans}</motion.div>
                  {recentSuccess[p.platform] && (
                    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: [0, 1, 1, 0], y: [-2, -10, -14, -18] }} transition={{ duration: 2.2 }}
                      className="absolute -top-1 left-8 text-[10px] font-bold text-green-400 tabular-nums pointer-events-none">+{recentSuccess[p.platform]!.delta}</motion.span>
                  )}
                  <div className={`text-[9px] tabular-nums flex items-center gap-px ${p.growth7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.growth7d >= 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                    {Math.abs(p.growth7d).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase">{zh ? '互动' : 'Engage'}</div>
                  <div className="text-sm font-bold tabular-nums text-orange-300" style={{ fontFamily: 'var(--font-display)' }}>{p.engagement}%</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase">{zh ? '30天曝光' : '30d Views'}</div>
                  <div className="text-sm font-bold tabular-nums text-emerald-300" style={{ fontFamily: 'var(--font-display)' }}>{p.views30d}</div>
                </div>
              </div>

              {density === 'detailed' && (p.totalPlays || p.totalLikes || p.liveStreamRevenue || p.adRevenue) && (
                <div className="mb-3 rounded-lg border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-cyan-500/5 to-transparent p-3 space-y-2">
                  <div className="text-[9px] text-purple-300 uppercase tracking-wider font-bold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> {zh ? '商业数据' : 'Business Metrics'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {p.totalPlays && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '累计播放' : 'Total Plays'}</div>
                        <div className="text-xs font-bold text-cyan-300 tabular-nums">{p.totalPlays}</div>
                      </div>
                    )}
                    {p.totalLikes && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '累计点赞' : 'Total Likes'}</div>
                        <div className="text-xs font-bold text-rose-300 tabular-nums">{p.totalLikes}</div>
                      </div>
                    )}
                    {p.avgPlays && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '平均播放' : 'Avg Plays'}</div>
                        <div className="text-xs font-bold text-emerald-300 tabular-nums">{p.avgPlays}</div>
                      </div>
                    )}
                    {p.peakViews24h && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '24h峰值' : '24h Peak'}</div>
                        <div className="text-xs font-bold text-amber-300 tabular-nums">{p.peakViews24h}</div>
                      </div>
                    )}
                    {p.liveStreamRevenue && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '直播收入' : 'Live Revenue'}</div>
                        <div className="text-xs font-bold text-green-300 tabular-nums">{p.liveStreamRevenue}</div>
                      </div>
                    )}
                    {p.adRevenue && (
                      <div className="bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="text-[9px] text-gray-500">{zh ? '广告分成' : 'Ad Revenue'}</div>
                        <div className="text-xs font-bold text-orange-300 tabular-nums">{p.adRevenue}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {density === 'detailed' && p.recentPosts && p.recentPosts.length > 0 && (
                <div className="mb-3 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent p-3 space-y-2">
                  <div className="text-[9px] text-cyan-300 uppercase tracking-wider font-bold flex items-center gap-1">
                    <Video className="w-3 h-3" /> {zh ? '最近内容' : 'Recent Posts'} ({p.recentPosts.length})
                  </div>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {p.recentPosts.map(post => (
                      <div key={post.id} className="bg-black/40 rounded-lg p-2 border border-white/5 hover:border-white/10 transition">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-xs text-gray-200 truncate flex-1 flex items-center gap-1">
                            {post.isViral && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                            {post.title}
                          </div>
                          <div className="text-[9px] text-gray-500 tabular-nums shrink-0">{post.publishedAt}</div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          {post.plays && (
                            <span className="flex items-center gap-0.5 text-emerald-400 tabular-nums">
                              <Eye className="w-2.5 h-2.5" /> {post.plays}
                            </span>
                          )}
                          {post.likes && (
                            <span className="flex items-center gap-0.5 text-rose-400 tabular-nums">
                              <Heart className="w-2.5 h-2.5" /> {post.likes}
                            </span>
                          )}
                          {post.comments && (
                            <span className="flex items-center gap-0.5 text-blue-400 tabular-nums">
                              <MessageCircle className="w-2.5 h-2.5" /> {post.comments}
                            </span>
                          )}
                          {post.duration && (
                            <span className="text-gray-500 tabular-nums ml-auto">{post.duration}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-black/40 rounded-lg p-2 mb-3 border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase mb-0.5">{zh ? '最新发布' : 'Latest'}</div>
                <div className="text-xs text-gray-200 truncate">{p.latestTitle}</div>
                <div className="text-[10px] text-gray-500">{p.latestAt} · {p.posts} {zh ? '条' : 'posts'}</div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { if (p.url) window.open(p.url, '_blank', 'noopener'); }}
                  disabled={!p.url}
                  title={p.url || (zh ? '未设置主页链接' : 'No profile URL set')}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40 transition flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ExternalLink className="w-3 h-3" /> {zh ? '打开' : 'Open'}
                </button>
                <button onClick={() => runSync(p.platform)} disabled={!!liveSync && liveSync.phase !== 'error'}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded border border-white/10 text-gray-400 hover:text-purple-300 hover:border-purple-500/40 transition flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  <RefreshCw className={`w-3 h-3 ${liveSync && liveSync.phase !== 'error' && liveSync.phase !== 'done' ? 'animate-spin' : ''}`} /> {liveSync && liveSync.phase !== 'error' ? (zh ? '同步中' : 'Syncing') : (zh ? '同步' : 'Sync')}
                </button>
                <button onClick={() => setStatsDrawerPlatform(p)} className="flex-1 text-[11px] px-2 py-1.5 rounded border border-white/10 text-gray-400 hover:text-amber-300 hover:border-amber-500/40 transition flex items-center justify-center gap-1">
                  <BarChart3 className="w-3 h-3" /> {zh ? '数据' : 'Stats'}
                </button>
              </div>
            </motion.div>
          );
        };

        if (density === 'compact') {
          const columns = [
            { id: 'select', label: '', align: 'center', render: (p: typeof filtered[number]) => (
              <input type="checkbox" checked={selectedPlatforms.has(p.platform)}
                onChange={(e) => {
                  const newSet = new Set(selectedPlatforms);
                  if (e.target.checked) newSet.add(p.platform);
                  else newSet.delete(p.platform);
                  setSelectedPlatforms(newSet);
                }}
                className="accent-cyan-500 cursor-pointer" />
            )},
            { id: 'platform', label: zh ? '平台' : 'Platform', align: 'left', render: (p: typeof filtered[number]) => {
              const cfg = PLATFORM_CONFIG[p.platform];
              return (
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded ${cfg.bg} flex items-center justify-center shrink-0`}><span className={`font-mono text-[8px] font-bold ${cfg.color}`}>{cfg.emoji}</span></div>
                  <span className={`font-semibold ${cfg.color}`}>{zh ? cfg.zh : cfg.en}</span>
                  {p.verified && <Shield className="w-2.5 h-2.5 text-blue-400" />}
                </div>
              );
            }},
            { id: 'handle', label: zh ? '账号' : 'Handle', align: 'left', render: (p: typeof filtered[number]) => p.handle },
            { id: 'fans', label: zh ? '粉丝' : 'Fans', align: 'right', render: (p: typeof filtered[number]) => p.fans },
            { id: 'growth', label: zh ? '7日增长' : 'Growth', align: 'right', render: (p: typeof filtered[number]) => `${p.growth7d >= 0 ? '+' : ''}${p.growth7d.toFixed(1)}%` },
            { id: 'engagement', label: zh ? '互动率' : 'Engage', align: 'right', render: (p: typeof filtered[number]) => `${p.engagement}%` },
            { id: 'views', label: zh ? '30天曝光' : '30d Views', align: 'right', render: (p: typeof filtered[number]) => p.views30d },
            { id: 'totalPlays', label: zh ? '总播放' : 'Total Plays', align: 'right', render: (p: typeof filtered[number]) => p.totalPlays || '—' },
            { id: 'totalLikes', label: zh ? '总点赞' : 'Total Likes', align: 'right', render: (p: typeof filtered[number]) => p.totalLikes || '—' },
            { id: 'avgPlays', label: zh ? '平均播放' : 'Avg Plays', align: 'right', render: (p: typeof filtered[number]) => p.avgPlays || '—' },
            { id: 'liveRev', label: zh ? '直播收入' : 'Live Rev', align: 'right', render: (p: typeof filtered[number]) => p.liveStreamRevenue || '—' },
            { id: 'adRev', label: zh ? '广告分成' : 'Ad Rev', align: 'right', render: (p: typeof filtered[number]) => p.adRevenue || '—' },
            { id: 'status', label: zh ? '状态' : 'Status', align: 'center', render: (p: typeof filtered[number]) => {
              const liveSync = syncing[p.platform];
              const effStatus = liveSync ? (liveSync.phase === 'error' ? 'error' : liveSync.phase === 'done' ? 'synced' : 'syncing') : p.syncStatus;
              const SyncIcon = effStatus === 'syncing' ? Loader2 : effStatus === 'error' ? AlertCircle : CheckCircle2;
              return (
                <Badge className={`text-[9px] border-0 px-1.5 inline-flex items-center gap-1 ${effStatus === 'error' ? 'bg-red-500/15 text-red-300' : effStatus === 'syncing' ? 'bg-amber-500/15 text-amber-300' : 'bg-green-500/15 text-green-300'}`}>
                  <SyncIcon className={`w-2 h-2 ${effStatus === 'syncing' ? 'animate-spin' : ''}`} />
                </Badge>
              );
            }},
            { id: 'actions', label: zh ? '操作' : 'Actions', align: 'center', render: (p: typeof filtered[number]) => {
              const liveSync = syncing[p.platform];
              return (
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => { if (p.url) window.open(p.url, '_blank', 'noopener'); }}
                    disabled={!p.url}
                    title={p.url || (zh ? '未设置主页链接' : 'No profile URL')}
                    className="p-1 rounded text-gray-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button onClick={() => runSync(p.platform)} disabled={!!liveSync && liveSync.phase !== 'error'}
                    className="p-1 rounded text-gray-500 hover:text-purple-300 hover:bg-purple-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    <RefreshCw className={`w-3 h-3 ${liveSync && liveSync.phase !== 'error' && liveSync.phase !== 'done' ? 'animate-spin' : ''}`} />
                  </button>
                  {isExtra(p) && (
                    <button onClick={() => setConfirmUnbind(p)}
                      className="p-1 rounded text-gray-500 hover:text-red-300 hover:bg-red-500/10 transition">
                      <Link2Off className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            }},
          ];
          const visibleCols = columns.filter(c => c.id === 'select' || visibleColumns.has(c.id));
          return (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {filtered.length > 0 && (
                    <button onClick={() => {
                      if (selectedPlatforms.size === filtered.length) setSelectedPlatforms(new Set());
                      else setSelectedPlatforms(new Set(filtered.map(p => p.platform)));
                    }}
                    className="text-xs px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40 transition">
                      {selectedPlatforms.size === filtered.length ? (zh ? '取消全选' : 'Deselect All') : (zh ? '全选' : 'Select All')}
                    </button>
                  )}
                  {selectedPlatforms.size > 0 && (
                    <span className="text-xs text-gray-500">{zh ? `已选中 ${selectedPlatforms.size} 项` : `${selectedPlatforms.size} selected`}</span>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpenFor(menuOpenFor === 'columns' ? null : 'columns')}
                    className="text-xs px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition flex items-center gap-1">
                    <Filter className="w-3 h-3" /> {zh ? '列设置' : 'Columns'}
                  </button>
                  {menuOpenFor === 'columns' && (
                    <div className="absolute right-0 top-8 z-20 min-w-[160px] max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-black/95 backdrop-blur shadow-xl p-2">
                      {columns.filter(c => c.id !== 'select').map(col => (
                        <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded cursor-pointer">
                          <input type="checkbox" checked={visibleColumns.has(col.id)}
                            onChange={e => {
                              const newSet = new Set(visibleColumns);
                              if (e.target.checked) newSet.add(col.id);
                              else newSet.delete(col.id);
                              setVisibleColumns(newSet);
                            }}
                            className="accent-cyan-500" />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden" onClick={() => { if (menuOpenFor === 'columns') setMenuOpenFor(null); }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-black/50 border-b border-white/5">
                      <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                        {visibleCols.map(col => (
                          <th key={col.id} className={`px-3 py-2 font-medium text-${col.align}`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <motion.tr key={p.platform} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .02 }}
                          className={`border-b border-white/5 hover:bg-white/[0.02] transition ${selectedPlatforms.has(p.platform) ? 'bg-cyan-500/5' : ''}`}>
                          {visibleCols.map(col => {
                            const content = col.render(p);
                            const colorClass = col.id === 'fans' ? 'font-bold' :
                              col.id === 'growth' ? (p.growth7d >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold') :
                              col.id === 'engagement' ? 'text-orange-300' :
                              col.id === 'views' ? 'text-emerald-300' :
                              col.id === 'totalPlays' ? 'text-cyan-300' :
                              col.id === 'totalLikes' ? 'text-rose-300' :
                              col.id === 'avgPlays' ? 'text-purple-300' :
                              col.id === 'liveRev' ? 'text-green-300' :
                              col.id === 'adRev' ? 'text-amber-300' :
                              col.id === 'handle' ? 'text-gray-400' : '';
                            return (
                              <td key={col.id} className={`px-3 py-2 text-${col.align} ${colorClass} ${['fans', 'growth', 'engagement', 'views', 'totalPlays', 'totalLikes', 'avgPlays', 'liveRev', 'adRev'].includes(col.id) ? 'tabular-nums' : ''}`}
                                style={col.id === 'fans' ? { fontFamily: 'var(--font-display)' } : {}}>
                                {content}
                              </td>
                            );
                          })}
                        </motion.tr>
                      ))}
                      </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p, i) => renderCard(p, i))}
            {filteredPrivate.map((p, i) => {
              const cfg = PRIVATE_DOMAIN_CONFIG[p.type];
              return (
                <motion.div key={p.handle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (filtered.length + i) * .03 }}
                  className={`bg-gradient-to-br ${cfg.bg.replace('/10', '/5')} border ${cfg.bg.replace('bg-', 'border-').replace('/10', '/20')} rounded-xl p-3.5 hover:${cfg.bg.replace('/10', '/15')} transition`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center text-lg shrink-0`}>{cfg.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-sm font-bold ${cfg.color} truncate`}>{p.name}</span>
                          {p.verified && <Shield className="w-3 h-3 text-blue-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">{p.handle}</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase">{zh ? '成员' : 'Members'}</div>
                      <div className="text-sm font-bold tabular-nums text-blue-300" style={{ fontFamily: 'var(--font-display)' }}>{p.members}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase">{zh ? '活跃' : 'Active'}</div>
                      <div className="text-sm font-bold tabular-nums text-emerald-300" style={{ fontFamily: 'var(--font-display)' }}>{p.activeMembers}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase">{zh ? '互动' : 'Engage'}</div>
                      <div className="text-sm font-bold tabular-nums text-orange-300" style={{ fontFamily: 'var(--font-display)' }}>{p.engagement}%</div>
                    </div>
                  </div>
                  {p.sourceBreakdown && p.sourceBreakdown.length > 0 && (
                    <div className="mb-3 p-2 rounded-lg bg-black/30 border border-white/5">
                      <div className="text-[9px] text-gray-500 uppercase mb-1.5">{zh ? '来源渠道' : 'Source'}</div>
                      <div className="space-y-1">
                        {p.sourceBreakdown.slice(0, 3).map((s, idx) => (
                          <div key={`card-source-${idx}-${s.platform}`} className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">{s.platform}</span>
                            <span className="text-cyan-300 tabular-nums">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.totalRevenue && (
                    <div className="mb-3 p-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                      <div className="text-[10px] text-amber-400 uppercase">{zh ? '私域GMV' : 'Revenue'} <span className="font-bold text-amber-300 tabular-nums float-right">{p.totalRevenue}</span></div>
                      {p.purchaseRate && <div className="text-[10px] text-gray-500 mt-0.5">{zh ? '转化率' : 'Rate'}: <span className="text-green-300 font-semibold">{p.purchaseRate}%</span></div>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { if (p.url) window.open(p.url, '_blank', 'noopener'); }} disabled={!p.url}
                      className="flex-1 text-[11px] px-2 py-1.5 rounded border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40 transition flex items-center justify-center gap-1 disabled:opacity-40">
                      <ExternalLink className="w-3 h-3" /> {zh ? '后台' : 'Panel'}
                    </button>
                    <button onClick={() => setStatsDrawerPlatform(p as any)} className="flex-1 text-[11px] px-2 py-1.5 rounded border border-white/10 text-gray-400 hover:text-amber-300 hover:border-amber-500/40 transition flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" /> {zh ? '粉丝CRM' : 'Fans'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        );
      })()}
      {filtered.length === 0 && filteredPrivate.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">{zh ? '暂无匹配账号' : 'No accounts match'}</div>
      )}

      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddAccount(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl border border-emerald-500/30 p-5 max-w-md w-[90%] shadow-2xl">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-emerald-300 mb-1">{zh ? '添加新平台账号' : 'Add New Platform Account'}</h3>
              <p className="text-xs text-gray-500">{zh ? '为该艺人添加新的社交媒体平台账号' : 'Add a new social media platform account for this artist'}</p>
            </div>

            {availablePlatformsToAdd.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-xs text-gray-500 mb-4">{zh ? '所有支持的平台均已添加' : 'All supported platforms are already added'}</div>
                <button onClick={() => setShowAddAccount(false)}
                  className="text-xs px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white">
                  {zh ? '关闭' : 'Close'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">{zh ? '选择平台' : 'Select Platform'}</label>
                  <div className="flex flex-wrap gap-2">
                    {availablePlatformsToAdd.map(k => {
                      const cfg = PLATFORM_CONFIG[k];
                      const sel = draft.platform === k;
                      return (
                        <button key={k} onClick={() => setDraft(d => ({ ...d, platform: k }))}
                          className={`text-xs px-3 py-2 rounded-lg border transition flex items-center gap-1.5 ${sel ? `${cfg.bg} border-white/30 ${cfg.color}` : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                          <span className="text-sm">{cfg.emoji}</span>
                          <span>{zh ? cfg.zh : cfg.en}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">{zh ? '账号名称' : 'Account Handle'}</label>
                  <input value={draft.handle} onChange={e => setDraft(d => ({ ...d, handle: e.target.value }))}
                    placeholder={zh ? '如 @starlight_v' : 'e.g. @starlight_v'}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-cyan-500/40 outline-none placeholder-gray-600 text-white" />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">{zh ? '主页链接 (可选)' : 'Profile URL (Optional)'}</label>
                  <input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
                    placeholder={zh ? '如 douyin.com/user/xxx' : 'e.g. douyin.com/user/xxx'}
                    className={`w-full text-xs px-3 py-2 rounded-lg bg-black/40 border outline-none placeholder-gray-600 text-white ${draft.url && !draftUrlCheck.ok ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/10 focus:border-cyan-500/40'}`} />
                  {draft.url && !draftUrlCheck.ok && (
                    <div className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{draftUrlCheck.error}
                    </div>
                  )}
                  {draft.url && draftUrlCheck.ok && draftUrlCheck.url !== draft.url.trim() && (
                    <div className="text-[10px] text-cyan-400 mt-1.5">{zh ? '将自动补全为: ' : 'Will normalize to: '}{draftUrlCheck.url}</div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={draft.verified} onChange={e => setDraft(d => ({ ...d, verified: e.target.checked }))} className="accent-cyan-500" />
                    <Shield className="w-3 h-3 text-blue-400" />
                    {zh ? '已认证账号' : 'Verified account'}
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowAddAccount(false)}
                    className="text-xs px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white">
                    {zh ? '取消' : 'Cancel'}
                  </button>
                  <button onClick={() => { addAccount(); setShowAddAccount(false); }} disabled={!draft.handle.trim()}
                    className="text-xs px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                    <span className="text-sm leading-none">+</span> {zh ? '添加' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {statsDrawerPlatform && (() => {
        const p = statsDrawerPlatform as PlatformAccount | PrivatePlatformAccount;
        const isPrivate = 'type' in p;
        const cfg = isPrivate ? PRIVATE_DOMAIN_CONFIG[(p as PrivatePlatformAccount).type] : PLATFORM_CONFIG[(p as PlatformAccount).platform];
        
        // Generate mock trend data
        const days = Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
        });
        const fansBase = isPrivate ? num((p as PrivatePlatformAccount).members) : num((p as PlatformAccount).fans);
        const growthRate = p.growth7d / 700; // Daily rate
        const fansTrend = days.map((day, i) => ({
          id: `day-${i}`,
          day,
          fans: Math.round(fansBase * (1 - (29 - i) * growthRate)),
          engagement: Math.max(0, p.engagement + (Math.random() - 0.5) * 2),
          views: isPrivate ? 0 : Math.round(num((p as PlatformAccount).views30d) / 30 * (0.8 + Math.random() * 0.4)),
        }));
        const topPosts = isPrivate ? [] : ((p as PlatformAccount).recentPosts?.slice(0, 5) || []);
        
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setStatsDrawerPlatform(null)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-gradient-to-br from-gray-900 via-black to-gray-900 border-l border-white/10 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center text-2xl`}>{cfg.emoji}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${cfg.color}`} style={{ fontFamily: 'var(--font-display)' }}>
                        {isPrivate ? (p as PrivatePlatformAccount).name : (zh ? cfg.zh : cfg.en)}
                      </span>
                      {p.verified && <Shield className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="text-sm text-gray-400">{p.handle}</div>
                  </div>
                </div>
                <button onClick={() => setStatsDrawerPlatform(null)} className="p-2 rounded-lg hover:bg-white/10 transition">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                
                {/* Stats Overview */}
                {isPrivate ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-xl border border-blue-500/20 p-4">
                      <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">{zh ? '成员数' : 'Members'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PrivatePlatformAccount).members}</div>
                      <div className={`text-xs tabular-nums flex items-center gap-1 mt-1 ${p.growth7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.growth7d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(p.growth7d).toFixed(1)}% (7d)
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/20 p-4">
                      <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">{zh ? '活跃成员' : 'Active'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PrivatePlatformAccount).activeMembers}</div>
                      <div className="text-xs text-gray-500 mt-1">{((Number((p as PrivatePlatformAccount).activeMembers.replace(/[^0-9.]/g, '')) / Number((p as PrivatePlatformAccount).members.replace(/[^0-9.]/g, ''))) * 100).toFixed(0)}% {zh ? '活跃度' : 'rate'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500/10 to-transparent rounded-xl border border-orange-500/20 p-4">
                      <div className="text-xs text-orange-400 uppercase tracking-wider mb-1">{zh ? '互动率' : 'Engagement'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{p.engagement}%</div>
                      <div className="text-xs text-gray-500 mt-1">{zh ? '私域平均 42%' : 'Avg 42%'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl border border-cyan-500/20 p-4">
                      <div className="text-xs text-cyan-400 uppercase tracking-wider mb-1">{zh ? '粉丝' : 'Fans'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).fans}</div>
                      <div className={`text-xs tabular-nums flex items-center gap-1 mt-1 ${p.growth7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.growth7d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(p.growth7d).toFixed(1)}% (7d)
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500/10 to-transparent rounded-xl border border-orange-500/20 p-4">
                      <div className="text-xs text-orange-400 uppercase tracking-wider mb-1">{zh ? '互动率' : 'Engagement'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{p.engagement}%</div>
                      <div className="text-xs text-gray-500 mt-1">{zh ? '行业平均 4.2%' : 'Avg 4.2%'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/20 p-4">
                      <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">{zh ? '30天曝光' : '30d Views'}</div>
                      <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).views30d}</div>
                      <div className="text-xs text-gray-500 mt-1">{(p as PlatformAccount).posts} {zh ? '条内容' : 'posts'}</div>
                    </div>
                  </div>
                )}

                {/* Fans Growth Trend */}
                <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold text-white">{isPrivate ? (zh ? '成员增长趋势' : 'Members Growth Trend') : (zh ? '粉丝增长趋势' : 'Fans Growth Trend')}</div>
                    <Badge className="text-[10px] bg-cyan-500/15 text-cyan-300 border-0">{zh ? '30天' : '30 Days'}</Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={fansTrend}>
                      <defs>
                        <linearGradient id="colorFans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="day" stroke="#666" style={{ fontSize: '10px' }} tick={{ fill: '#888' }} />
                      <YAxis stroke="#666" style={{ fontSize: '10px' }} tick={{ fill: '#888' }} />
                      <Tooltip contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="fans" stroke="#06b6d4" strokeWidth={2} fill="url(#colorFans)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Engagement & Views */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                    <div className="text-sm font-bold text-white mb-3">{zh ? '互动率趋势' : 'Engagement Trend'}</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={fansTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis dataKey="day" stroke="#666" style={{ fontSize: '9px' }} tick={{ fill: '#888' }} interval={6} />
                        <YAxis stroke="#666" style={{ fontSize: '9px' }} tick={{ fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                        <Line type="monotone" dataKey="engagement" stroke="#fb923c" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                    <div className="text-sm font-bold text-white mb-3">{zh ? '日均曝光' : 'Daily Views'}</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={fansTrend.slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis dataKey="day" stroke="#666" style={{ fontSize: '9px' }} tick={{ fill: '#888' }} />
                        <YAxis stroke="#666" style={{ fontSize: '9px' }} tick={{ fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                        <Bar dataKey="views" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Posts */}
                {topPosts.length > 0 && (
                  <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <div className="text-sm font-bold text-white">{zh ? '热门内容 TOP 5' : 'Top 5 Posts'}</div>
                    </div>
                    <div className="space-y-2">
                      {topPosts.map((post, idx) => (
                        <div key={post.id} className="bg-white/5 rounded-lg p-3 border border-white/5 hover:border-white/10 transition">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                                {idx + 1}
                              </div>
                              <div className="text-xs text-gray-200 truncate flex-1">{post.title}</div>
                            </div>
                            <div className="text-[10px] text-gray-500 tabular-nums shrink-0">{post.publishedAt}</div>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] pl-8">
                            {post.plays && (
                              <span className="flex items-center gap-1 text-emerald-400 tabular-nums">
                                <Eye className="w-3 h-3" /> {post.plays}
                              </span>
                            )}
                            {post.likes && (
                              <span className="flex items-center gap-1 text-rose-400 tabular-nums">
                                <Heart className="w-3 h-3" /> {post.likes}
                              </span>
                            )}
                            {post.comments && (
                              <span className="flex items-center gap-1 text-blue-400 tabular-nums">
                                <MessageCircle className="w-3 h-3" /> {post.comments}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Business Metrics */}
                {((p as PlatformAccount).totalPlays || (p as PlatformAccount).totalLikes || (p as PlatformAccount).liveStreamRevenue || (p as PlatformAccount).adRevenue) && (
                  <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-xl border border-purple-500/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-purple-400" />
                      <div className="text-sm font-bold text-white">{zh ? '商业数据' : 'Business Metrics'}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(p as PlatformAccount).totalPlays && (
                        <div className="bg-black/40 rounded-lg px-3 py-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">{zh ? '累计播放' : 'Total Plays'}</div>
                          <div className="text-lg font-bold text-cyan-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).totalPlays}</div>
                        </div>
                      )}
                      {(p as PlatformAccount).totalLikes && (
                        <div className="bg-black/40 rounded-lg px-3 py-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">{zh ? '累计点赞' : 'Total Likes'}</div>
                          <div className="text-lg font-bold text-rose-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).totalLikes}</div>
                        </div>
                      )}
                      {(p as PlatformAccount).liveStreamRevenue && (
                        <div className="bg-black/40 rounded-lg px-3 py-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">{zh ? '直播收入' : 'Live Revenue'}</div>
                          <div className="text-lg font-bold text-green-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).liveStreamRevenue}</div>
                        </div>
                      )}
                      {(p as PlatformAccount).adRevenue && (
                        <div className="bg-black/40 rounded-lg px-3 py-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-500 uppercase">{zh ? '广告分成' : 'Ad Revenue'}</div>
                          <div className="text-lg font-bold text-orange-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PlatformAccount).adRevenue}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 私域专属：来源渠道分析 */}
                {isPrivate && (p as PrivatePlatformAccount).sourceBreakdown && (p as PrivatePlatformAccount).sourceBreakdown!.length > 0 && (
                  <div className="bg-gradient-to-br from-cyan-500/10 to-transparent rounded-xl border border-cyan-500/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <div className="text-sm font-bold text-white">{zh ? '来源渠道分析' : 'Source Breakdown'}</div>
                    </div>
                    <div className="space-y-3">
                      {(p as PrivatePlatformAccount).sourceBreakdown!.map((s, idx) => (
                        <div key={`source-${idx}-${s.platform}`}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-300">{s.platform}</span>
                            <span className="text-cyan-300 font-bold tabular-nums">{s.count} ({s.percent.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${s.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 私域专属：转化漏斗 */}
                {isPrivate && (p as PrivatePlatformAccount).conversionRate && (
                  <div className="bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl border border-amber-500/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <div className="text-sm font-bold text-white">{zh ? '公私域转化漏斗' : 'Conversion Funnel'}</div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <span className="text-sm text-gray-300">{zh ? '公域曝光' : 'Public Reach'}</span>
                        <span className="text-lg font-bold text-blue-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>100%</span>
                      </div>
                      <div className="pl-4 border-l-2 border-dashed border-white/10">
                        <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                          <span className="text-sm text-gray-300">{zh ? '私域转化' : 'Private Conv.'}</span>
                          <span className="text-lg font-bold text-cyan-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PrivatePlatformAccount).conversionRate}%</span>
                        </div>
                      </div>
                      {(p as PrivatePlatformAccount).purchaseRate && (
                        <div className="pl-8 border-l-2 border-dashed border-white/10">
                          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                            <span className="text-sm text-gray-300">{zh ? '购买转化' : 'Purchase Conv.'}</span>
                            <span className="text-lg font-bold text-green-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PrivatePlatformAccount).purchaseRate}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {(p as PrivatePlatformAccount).totalRevenue && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">{zh ? '累计GMV' : 'Total GMV'}</span>
                          <span className="text-xl font-bold text-amber-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{(p as PrivatePlatformAccount).totalRevenue}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Audience Insights (Mock Data) */}
                <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-400" />
                    <div className="text-sm font-bold text-white">{zh ? '受众画像' : 'Audience Insights'}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '性别分布' : 'Gender'}</div>
                      <div className="text-sm font-bold text-white">58% {zh ? '女' : 'F'} / 42% {zh ? '男' : 'M'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '主力年龄' : 'Age'}</div>
                      <div className="text-sm font-bold text-white">18-24 (45%)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{zh ? '活跃时段' : 'Peak Time'}</div>
                      <div className="text-sm font-bold text-white">20:00-22:00</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        );
      })()}

      {confirmUnbind && (() => {
        const cfg = PLATFORM_CONFIG[confirmUnbind.platform];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmUnbind(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-xl border border-red-500/30 p-5 max-w-sm w-[90%] shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">{zh ? '确认解绑该账号？' : 'Unbind this account?'}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {zh ? '此操作只移除该账号绑定关系，平台数据不会被删除。' : 'This only removes the binding; platform data is not deleted.'}
                  </div>
                  <div className={`mt-2 inline-flex items-center gap-1.5 text-xs ${cfg.color}`}>
                    {cfg.emoji} {zh ? cfg.zh : cfg.en} <span className="text-gray-400">@{confirmUnbind.handle}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmUnbind(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white">
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button onClick={() => { unbindAccount(confirmUnbind); setConfirmUnbind(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 flex items-center gap-1.5">
                  <Link2Off className="w-3 h-3" /> {zh ? '确认解绑' : 'Unbind'}
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {toast && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg backdrop-blur-md border text-xs shadow-2xl flex items-center gap-2 ${toast.tone === 'ok' ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-red-500/15 border-red-500/40 text-red-300'}`}>
          {toast.tone === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
};

/* ============== Authorized Accounts Tab ============== */
export const AuthorizedTab = ({ artist, lang }: { artist: Artist; lang: Lang }) => {
  const zh = lang === 'zh';
  const auths = artist.authorizations || [];
  const [selectedId, setSelectedId] = useState<string | null>(auths[0]?.id || null);
  const selected = auths.find(a => a.id === selectedId);

  const totalRevenue = auths.reduce((s, a) => s + num(a.totalRevenue), 0);
  const activeCount = auths.filter(a => a.status === 'active').length;

  const daysToExpiry = (s: string) => Math.round((new Date(s).getTime() - Date.now()) / 86400000);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? '授权总数' : 'Total Licenses', value: auths.length, color: 'text-cyan-400' },
          { label: zh ? '生效中' : 'Active', value: activeCount, color: 'text-green-400' },
          { label: zh ? '累计产出' : 'Total Works', value: auths.reduce((s, a) => s + a.totalProduced, 0), color: 'text-purple-400' },
          { label: zh ? '累计分成' : 'Revenue', value: `¥${totalRevenue}K`, color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="bg-black/30 rounded-lg border border-white/5 px-3 py-2.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
            <div className={`text-base font-bold tabular-nums ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-2 space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {auths.map((a, i) => {
            const tCfg = AUTHORIZATION_TYPE_CONFIG[a.type];
            const sCfg = AUTH_STATUS_CONFIG[a.status];
            const days = daysToExpiry(a.expiresAt);
            const active = selectedId === a.id;
            return (
              <motion.button key={a.id} onClick={() => setSelectedId(a.id)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .04 }}
                className={`w-full text-left rounded-xl border p-3 transition ${active ? 'bg-white/5 border-cyan-500/40' : 'bg-black/30 border-white/5 hover:border-white/15'}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold truncate">{a.granteeName}</span>
                  <Badge className={`text-[9px] border-0 px-1.5 flex items-center gap-1 ${sCfg.color}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className={`w-1 h-1 rounded-full ${sCfg.dot}`} />
                    {zh ? sCfg.zh : sCfg.en}
                  </Badge>
                </div>
                <Badge className={`text-[10px] ${tCfg.bg} ${tCfg.color} border-0`}>{zh ? tCfg.zh : tCfg.en}</Badge>
                <div className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {days < 0 ? (zh ? '已过期' : 'Expired') : days < 30 ? (zh ? `${days}天到期` : `${days}d left`) : a.expiresAt}
                </div>
              </motion.button>
            );
          })}
          {auths.length === 0 && <div className="text-sm text-gray-500 text-center py-8">{zh ? '暂无授权' : 'No licenses'}</div>}
        </div>

        <div className="md:col-span-3">
          {selected ? (() => {
            const tCfg = AUTHORIZATION_TYPE_CONFIG[selected.type];
            const sCfg = AUTH_STATUS_CONFIG[selected.status];
            const days = daysToExpiry(selected.expiresAt);
            return (
              <div className="bg-black/30 rounded-xl border border-white/10 p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>{selected.granteeName}</h4>
                    <Badge className={`text-[10px] ${tCfg.bg} ${tCfg.color} border-0`}>{zh ? tCfg.zh : tCfg.en}</Badge>
                  </div>
                  <div className={`text-xs flex items-center gap-1.5 ${sCfg.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                    {zh ? sCfg.zh : sCfg.en}
                    {selected.violations ? <span className="text-red-400 ml-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{selected.violations} {zh ? '次违规' : 'violations'}</span> : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{zh ? '合同期限' : 'Period'}</div>
                    <div className="text-xs text-gray-300">{selected.startedAt}</div>
                    <div className="text-xs text-gray-300">→ {selected.expiresAt}</div>
                    {days > 0 && days < 30 && <div className="text-[10px] text-amber-400 mt-1">{zh ? `${days} 天到期` : `${days}d to expiry`}</div>}
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{zh ? '收益分成' : 'Revenue Share'}</div>
                    <div className="text-2xl font-bold text-cyan-400 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{selected.revenueShare}%</div>
                    <div className="text-[10px] text-gray-500">{zh ? '归艺人方' : 'to artist'}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{zh ? '累计产出' : 'Produced'}</div>
                    <div className="text-2xl font-bold text-purple-400 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{selected.totalProduced}</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{zh ? '累计收益' : 'Revenue'}</div>
                    <div className="text-2xl font-bold text-amber-400 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{selected.totalRevenue}</div>
                  </div>
                </div>

                <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{zh ? '授权范围' : 'License Scope'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.scope.map(s => <Badge key={s} className="text-[10px] bg-white/5 text-gray-300 border-white/10">{s}</Badge>)}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30">{zh ? '查看合同' : 'View Contract'}</Button>
                  <Button size="sm" variant="outline" className="flex-1 border-white/10">{zh ? '续约' : 'Renew'}</Button>
                  {selected.status === 'active' && <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-300"><Pause className="w-3 h-3 mr-1" />{zh ? '暂停' : 'Pause'}</Button>}
                </div>
              </div>
            );
          })() : (
            <div className="bg-black/20 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
              {zh ? '选择授权查看详情' : 'Select a license to view details'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============== Content Library Tab ============== */
const TYPE_ICONS: Record<ContentType, any> = { music: Music, drama: Film, ad: ShoppingBag, variety: Tv, live_clip: Video };
const TYPE_COLORS: Record<ContentType, string> = { music: 'text-cyan-400', drama: 'text-purple-400', ad: 'text-pink-400', variety: 'text-amber-400', live_clip: 'text-emerald-400' };
const TYPE_LABELS: Record<ContentType, { zh: string; en: string }> = {
  music: { zh: '音乐', en: 'Music' },
  drama: { zh: '短剧', en: 'Drama' },
  ad: { zh: '广告', en: 'Ad' },
  variety: { zh: '综艺', en: 'Variety' },
  live_clip: { zh: '直播切片', en: 'Live Clip' },
};

export const ContentLibraryTab = ({ artist, lang }: { artist: Artist; lang: Lang }) => {
  const zh = lang === 'zh';
  const items = artist.contentLibrary || [];
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'date' | 'plays' | 'revenue'>('date');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    let list = items.filter(c =>
      (typeFilter === 'all' || c.type === typeFilter) &&
      (platformFilter === 'all' || c.platform === platformFilter) &&
      (!search || c.title.toLowerCase().includes(search.toLowerCase()))
    );
    if (sort === 'plays') list = list.sort((a, b) => num(b.plays) - num(a.plays));
    else if (sort === 'revenue') list = list.sort((a, b) => num(b.revenue) - num(a.revenue));
    else list = list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return list;
  }, [items, typeFilter, platformFilter, search, sort]);

  const stats = useMemo(() => ({
    total: items.length,
    viral: items.filter(i => i.isViral).length,
    plays: items.reduce((s, i) => s + num(i.plays), 0),
    revenue: items.reduce((s, i) => s + num(i.revenue), 0),
  }), [items]);

  const types: (ContentType | 'all')[] = ['all', 'music', 'drama', 'ad', 'variety', 'live_clip'];
  const platforms = Array.from(new Set(items.map(i => i.platform)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: zh ? '作品总数' : 'Works', value: stats.total, color: 'text-cyan-400' },
          { label: zh ? '爆款' : 'Viral', value: stats.viral, color: 'text-orange-400', icon: Flame },
          { label: zh ? '累计播放' : 'Plays', value: stats.plays >= 10000 ? `${(stats.plays / 10000).toFixed(1)}万` : stats.plays, color: 'text-emerald-400' },
          { label: zh ? '累计收益' : 'Revenue', value: `¥${stats.revenue >= 10000 ? `${(stats.revenue / 10000).toFixed(1)}万` : stats.revenue}`, color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="bg-black/30 rounded-lg border border-white/5 px-3 py-2.5 flex items-center gap-2">
            {s.icon && <s.icon className={`w-4 h-4 ${s.color}`} />}
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
              <div className={`text-base font-bold tabular-nums truncate ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={zh ? '搜索作品...' : 'Search...'}
            className="w-full bg-gray-900/50 border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${typeFilter === t ? 'bg-white/10 border-white/30 text-white' : 'border-white/5 text-gray-500 hover:border-white/15'}`}>
              {t === 'all' ? (zh ? '全部' : 'All') : (zh ? TYPE_LABELS[t].zh : TYPE_LABELS[t].en)}
            </button>
          ))}
        </div>
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value as any)}
          className="bg-gray-900/50 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-gray-400 focus:outline-none">
          <option value="all">{zh ? '全部平台' : 'All Platforms'}</option>
          {platforms.map(p => <option key={p} value={p}>{PLATFORM_CONFIG[p][zh ? 'zh' : 'en']}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as any)}
          className="bg-gray-900/50 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-gray-400 focus:outline-none">
          <option value="date">{zh ? '按时间' : 'Date'}</option>
          <option value="plays">{zh ? '按播放' : 'Plays'}</option>
          <option value="revenue">{zh ? '按收益' : 'Revenue'}</option>
        </select>
        <div className="flex border border-white/10 rounded-md overflow-hidden">
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2 py-1 text-[10px] uppercase ${view === v ? 'bg-white/10 text-white' : 'text-gray-500'}`}>{v}</button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => {
            const Icon = TYPE_ICONS[c.type];
            const pCfg = PLATFORM_CONFIG[c.platform];
            const sparkMin = Math.min(...c.trend), sparkMax = Math.max(...c.trend), range = (sparkMax - sparkMin) || 1;
            const path = c.trend.map((v, idx) => `${idx === 0 ? 'M' : 'L'}${(idx / (c.trend.length - 1)) * 60},${20 - ((v - sparkMin) / range) * 18}`).join(' ');
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .03 }}
                className="bg-black/30 rounded-xl border border-white/5 p-3 hover:border-white/15 transition">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 ${TYPE_COLORS[c.type]} shrink-0`} />
                    <span className="text-sm font-semibold truncate">{c.title}</span>
                    {c.isViral && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2.5 text-[10px] text-gray-500">
                  <Badge className={`text-[9px] ${pCfg.bg} ${pCfg.color} border-0 px-1.5`}>{pCfg.emoji} {zh ? pCfg.zh : pCfg.en}</Badge>
                  <span>{c.publishedAt}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center">
                    <Eye className="w-3 h-3 text-emerald-400 mx-auto mb-0.5" />
                    <div className="text-xs font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{c.plays}</div>
                  </div>
                  <div className="text-center">
                    <Heart className="w-3 h-3 text-rose-400 mx-auto mb-0.5" />
                    <div className="text-xs font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{c.likes}</div>
                  </div>
                  <div className="text-center">
                    <DollarSign className="w-3 h-3 text-amber-400 mx-auto mb-0.5" />
                    <div className="text-xs font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{c.revenue}</div>
                  </div>
                </div>
                <svg width="100%" height="22" viewBox="0 0 60 22" className="opacity-70">
                  <path d={path} stroke={c.isViral ? '#f97316' : '#06b6d4'} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-500">
                {[zh ? '标题' : 'Title', zh ? '类型' : 'Type', zh ? '平台' : 'Platform', zh ? '日期' : 'Date', zh ? '播放' : 'Plays', zh ? '点赞' : 'Likes', zh ? '收益' : 'Revenue'].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const Icon = TYPE_ICONS[c.type];
                const pCfg = PLATFORM_CONFIG[c.platform];
                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-xs flex items-center gap-1.5">
                      {c.isViral && <Flame className="w-3 h-3 text-orange-400" />}
                      <span className="truncate">{c.title}</span>
                    </td>
                    <td className="px-3 py-2"><span className={`flex items-center gap-1 text-[10px] ${TYPE_COLORS[c.type]}`}><Icon className="w-3 h-3" />{zh ? TYPE_LABELS[c.type].zh : TYPE_LABELS[c.type].en}</span></td>
                    <td className="px-3 py-2"><span className={`text-[10px] ${pCfg.color}`}>{pCfg.emoji} {zh ? pCfg.zh : pCfg.en}</span></td>
                    <td className="px-3 py-2 text-[10px] text-gray-400">{c.publishedAt}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-emerald-300">{c.plays}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-rose-300">{c.likes}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-amber-300">{c.revenue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && <div className="text-center py-12 text-sm text-gray-500">{zh ? '暂无匹配作品' : 'No content matches'}</div>}
    </div>
  );
};
