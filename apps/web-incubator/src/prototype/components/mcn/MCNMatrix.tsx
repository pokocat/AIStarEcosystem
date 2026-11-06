import React, { useState, useMemo } from 'react';
import {
  Users, Plus, Search, Grid3X3, List, ChevronDown, Eye, Edit, Copy,
  Star, Music, Film, ShoppingBag, Tv, Mic, GraduationCap, Gamepad,
  X, Mic2, Video, Sparkles, Headphones, Zap, Award, TrendingUp, TrendingDown,
  BarChart3, Heart, Crown, ArrowUpRight, Flame, Activity, DollarSign, Package,
  FileText, Globe, Handshake, Gem, Factory
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Lang } from "../../translations";
import {
  type Artist, type ArtistType, type Quality, type DesignStyle, type ProfessionBackground, type CustomTag,
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  QUALITY_CONFIG, STATUS_CONFIG, TALENT_LABELS,
  DESIGN_STYLE_CONFIG, DESIGN_STYLE_ORDER,
  PROFESSION_CONFIG, PROFESSION_ORDER,
  DEFAULT_CUSTOM_TAGS, TAG_COLORS
} from './ArtistTypes';
import { PlatformMatrixTab, AuthorizedTab, ContentLibraryTab } from './ArtistDetailTabs';

/* ======== Artist Detail Dialog ======== */
const ArtistDetailDialog = ({ artist, lang, onClose }: { artist: Artist; lang: Lang; onClose: () => void }) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'basic' | 'platforms' | 'authorized' | 'content' | 'talents' | 'stats' | 'works' | 'commercial'>('basic');
  const typeConf = ARTIST_TYPE_CONFIG[artist.type];
  const qualConf = QUALITY_CONFIG[artist.quality];
  const statusConf = STATUS_CONFIG[artist.status];

  const radarData = Object.entries(TALENT_LABELS).map(([key, lbl]) => ({
    subject: zh ? lbl.zh : lbl.en,
    value: artist.talents[key as keyof typeof artist.talents],
    cap: typeConf.talentCaps[key as keyof typeof artist.talents],
  }));

  const tabs = [
    { id: 'basic' as const, label: zh ? '基本信息' : 'Basic', icon: FileText },
    { id: 'platforms' as const, label: zh ? '平台矩阵' : 'Platforms', icon: Globe },
    { id: 'authorized' as const, label: zh ? '授权创作' : 'Authorized', icon: Handshake },
    { id: 'content' as const, label: zh ? '内容库' : 'Content', icon: Film },
    { id: 'talents' as const, label: zh ? '才艺能力' : 'Talents', icon: Star },
    { id: 'stats' as const, label: zh ? '数据统计' : 'Stats', icon: BarChart3 },
    { id: 'works' as const, label: zh ? '专属工坊' : 'Workshop', icon: Factory },
    { id: 'commercial' as const, label: zh ? '商业价值' : 'Commercial', icon: Gem },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Left: Artist Summary Sidebar */}
        <div className="md:w-72 md:shrink-0 border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-black/40 to-gray-950/60 flex flex-col">
          <div className="relative aspect-[4/5] md:aspect-auto md:h-72 overflow-hidden">
            <img src={artist.portrait || artist.avatar} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-gray-300 hover:text-white flex items-center justify-center transition">
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-0 inset-x-0 p-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>{artist.name}</h3>
                <span className="text-[10px] font-mono font-black" style={{ color: typeConf.color.replace('text-', '') }}>{typeConf.icon}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge className={`text-[10px] ${qualConf.color} ${qualConf.bg} ${qualConf.border}`}>{zh ? qualConf.zh : qualConf.en}</Badge>
                <Badge className="text-[10px] bg-black/60 border-white/10 text-gray-300 flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />{zh ? statusConf.zh : statusConf.en}</Badge>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3 flex-1">
            <div className="grid grid-cols-3 gap-2">
              <div><div className="text-[9px] text-gray-500 uppercase">{zh ? '等级' : 'Level'}</div><div className="text-sm font-bold text-cyan-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>Lv.{artist.level}</div></div>
              <div><div className="text-[9px] text-gray-500 uppercase">{zh ? '粉丝' : 'Fans'}</div><div className="text-sm font-bold text-rose-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.fans}</div></div>
              <div><div className="text-[9px] text-gray-500 uppercase">{zh ? '人气' : 'Pop'}</div><div className="text-sm font-bold text-orange-300 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.popularity}</div></div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-[9px] text-gray-500 uppercase mb-0.5">{zh ? '商业价值' : 'Commercial Value'}</div>
              <div className="text-lg font-extrabold text-amber-400 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{artist.commercialValue}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-[9px] text-gray-500 uppercase mb-1">{zh ? '月收益' : 'Monthly'}</div>
              <div className="text-base font-bold tabular-nums bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.monthlyRevenue}</div>
            </div>
            <div>
              <div className="text-[9px] text-gray-500 uppercase mb-1.5">{zh ? '简介' : 'Bio'}</div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">{artist.bio}</p>
            </div>
          </div>
        </div>

        {/* Right: Tabs + Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex border-b border-white/5 px-2 overflow-x-auto scrollbar-none">
            {tabs.map(t => {
              const TabIcon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-3 text-xs whitespace-nowrap transition relative flex items-center gap-1.5 ${tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  <TabIcon className="w-3 h-3" />
                  {t.label}
                  {tab === t.id && <motion.div layoutId="detail-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
          {tab === 'basic' && (
            <div className="space-y-6">
              <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                <p className="text-sm text-gray-300 leading-relaxed">{artist.bio}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{zh ? '创建日期' : 'Created'}</div>
                  <div className="text-sm font-semibold">{artist.createdAt}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{zh ? '最后活跃' : 'Last Active'}</div>
                  <div className="text-sm font-semibold">{artist.lastActive}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">{zh ? '活跃领域' : 'Active Domains'}</div>
                <div className="flex flex-wrap gap-2">
                  {artist.domains.map(d => <Badge key={d} className="text-xs bg-white/5 text-gray-300 border-white/10">{d}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">{zh ? '等级进度' : 'Level Progress'}</div>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold" style={{ fontFamily: "var(--font-display)" }}>Lv.{artist.level}</span>
                  <div className="flex-1"><Progress value={(artist.exp / artist.maxExp) * 100} className="h-2" /></div>
                  <span className="text-xs text-gray-500">{artist.exp}/{artist.maxExp} EXP</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'platforms' && <PlatformMatrixTab artist={artist} lang={lang} />}
          {tab === 'authorized' && <AuthorizedTab artist={artist} lang={lang} />}
          {tab === 'content' && <ContentLibraryTab artist={artist} lang={lang} />}

          {tab === 'talents' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Value" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
                    <Radar name="Cap" dataKey="cap" stroke="#a855f7" fill="none" strokeWidth={1} strokeDasharray="4 4" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {Object.entries(TALENT_LABELS).map(([key, lbl]) => {
                  const val = artist.talents[key as keyof typeof artist.talents];
                  const cap = typeConf.talentCaps[key as keyof typeof artist.talents];
                  const isPrimary = typeConf.primaryTalents.includes(key as any);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          {zh ? lbl.zh : lbl.en}
                          {isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        </span>
                        <span className="font-semibold" style={{ color: lbl.color }}>{val}<span className="text-gray-600">/{cap}</span></span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                        <div className="h-full rounded-full" style={{ width: `${val}%`, background: lbl.color }} />
                        <div className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${cap}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/5 text-xs text-gray-500">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline mr-1" />
                  {zh ? '主属性 — 成长速度+50%，可达满值' : 'Primary — +50% growth, can reach max'}
                  <br />
                  <span className="inline-block w-2 h-px bg-purple-400 mr-1 align-middle" style={{ borderTop: '1px dashed #a855f7' }} />
                  {zh ? '虚线 = 天赋上限' : 'Dashed = Talent Cap'}
                </div>
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: zh ? '歌曲' : 'Songs', value: artist.stats.songs, icon: Music, color: 'text-cyan-400' },
                  { label: zh ? '影视' : 'Dramas', value: artist.stats.dramas, icon: Film, color: 'text-purple-400' },
                  { label: zh ? '广告' : 'Ads', value: artist.stats.ads, icon: ShoppingBag, color: 'text-pink-400' },
                  { label: zh ? '综艺' : 'Shows', value: artist.stats.variety, icon: Tv, color: 'text-amber-400' },
                  { label: zh ? '粉丝' : 'Fans', value: artist.stats.fans, icon: Heart, color: 'text-red-400' },
                  { label: zh ? '人气值' : 'Popularity', value: artist.stats.popularity, icon: TrendingUp, color: 'text-green-400' },
                ].map((s, i) => {
                  const SIcon = s.icon;
                  return (
                  <div key={i} className="bg-black/30 rounded-lg p-4 border border-white/5 text-center">
                    <SIcon className={`w-4 h-4 mx-auto mb-2 ${s.color} opacity-60`} />
                    <div className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                  );
                })}
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                <div className="text-xs text-gray-500 mb-2">{zh ? '总收益' : 'Total Revenue'}</div>
                <div className="text-2xl font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>{artist.stats.revenue}</div>
                <div className="text-xs text-gray-500 mt-1">{zh ? '月均' : 'Monthly'}: {artist.stats.monthlyRevenue}</div>
              </div>
            </div>
          )}

          {tab === 'works' && (
            <div className="space-y-4">
              <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{typeConf.icon}</span>
                  <h4 className="font-bold">{zh ? typeConf.workshop.zh : typeConf.workshop.en}</h4>
                </div>
                <p className="text-xs text-gray-500 mb-4">{zh ? '该艺人类型的专属创作工坊和内容模板' : 'Exclusive workshop and content templates for this artist type'}</p>
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">{zh ? '可用模板' : 'Templates'}</div>
                  <div className="flex flex-wrap gap-2">
                    {(zh ? typeConf.templates.zh : typeConf.templates.en).map(t => (
                      <Badge key={t} className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">{zh ? '内容格式' : 'Content Formats'}</div>
                  <div className="flex flex-wrap gap-2">
                    {(zh ? typeConf.contentFormats.zh : typeConf.contentFormats.en).map(f => (
                      <Badge key={f} className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">{f}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-2">{zh ? '主要领域' : 'Primary Domains'}</div>
                  <div className="flex flex-wrap gap-2">
                    {(zh ? typeConf.primaryDomains.zh : typeConf.primaryDomains.en).map(d => (
                      <Badge key={d} className="text-xs bg-pink-500/10 text-pink-400 border-pink-500/20">{d}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'commercial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{zh ? '商业价值' : 'Commercial Value'}</div>
                  <div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>{artist.commercialValue}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{zh ? '代言数' : 'Endorsements'}</div>
                  <div className="text-2xl font-bold text-pink-400" style={{ fontFamily: "var(--font-display)" }}>{artist.endorsements}</div>
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-4 border border-white/5">
                <div className="text-xs text-gray-500 mb-3">{zh ? '变现路径' : 'Monetization Paths'}</div>
                <div className="space-y-2">
                  {(zh ? typeConf.monetization.zh : typeConf.monetization.en).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="text-gray-300">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ======== Main MCN Matrix Component ======== */
export const MCNMatrix = ({ lang, onNavigateWorkshop }: { lang: Lang; onNavigateWorkshop?: (domain: 'music' | 'film' | 'endorsement' | 'variety') => void }) => {
  const zh = lang === 'zh';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'dual' | 'profession' | 'tags'>('tags'); // 筛选模式：双维度/职业主导/多标签（默认多标签）
  const [styleFilter, setStyleFilter] = useState<DesignStyle | 'all'>('all');
  const [professionFilter, setProfessionFilter] = useState<ProfessionBackground | 'all'>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'revenue' | 'commercial' | 'fans' | 'views'>('level');
  const [density, setDensity] = useState<'compact' | 'standard' | 'large'>('standard');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [syncLog24h, setSyncLog24h] = useState<{ ok: number; err: number; total: number; deltaSum: number; perArtist: Record<string, { ok: number; err: number }> }>({ ok: 0, err: 0, total: 0, deltaSum: 0, perArtist: {} });

  // 标签管理状态
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [artistTagMap, setArtistTagMap] = useState<Record<string, string[]>>({}); // artistId -> tagIds[]
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [confirmDeleteTagId, setConfirmDeleteTagId] = useState<string | null>(null);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set()); // 用于批量操作
  const [filterPanelOpen, setFilterPanelOpen] = useState(false); // 筛选面板折叠状态

  // 初始化标签数据
  React.useEffect(() => {
    try {
      const savedTags = localStorage.getItem('mcn:customTags:v1');
      const savedArtistTagMap = localStorage.getItem('mcn:artistTags:v1');

      if (savedTags) {
        setCustomTags(JSON.parse(savedTags));
      } else {
        setCustomTags(DEFAULT_CUSTOM_TAGS);
        localStorage.setItem('mcn:customTags:v1', JSON.stringify(DEFAULT_CUSTOM_TAGS));
      }

      if (savedArtistTagMap) {
        setArtistTagMap(JSON.parse(savedArtistTagMap));
      } else {
        // 从 MOCK_ARTISTS 中初始化映射
        const initialMap: Record<string, string[]> = {};
        MOCK_ARTISTS.forEach(a => {
          if (a.customTagIds && a.customTagIds.length > 0) {
            initialMap[a.id] = a.customTagIds;
          }
        });
        setArtistTagMap(initialMap);
        localStorage.setItem('mcn:artistTags:v1', JSON.stringify(initialMap));
      }
    } catch {}
  }, []);

  // 保存标签数据到 localStorage
  React.useEffect(() => {
    if (customTags.length > 0) {
      localStorage.setItem('mcn:customTags:v1', JSON.stringify(customTags));
    }
  }, [customTags]);

  React.useEffect(() => {
    localStorage.setItem('mcn:artistTags:v1', JSON.stringify(artistTagMap));
  }, [artistTagMap]);

  React.useEffect(() => {
    const compute = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('mcn:syncLog:v1') || '[]');
        const cutoff = Date.now() - 86400000;
        const recent = raw.filter((l: any) => l.startedAt >= cutoff);
        const ok = recent.filter((l: any) => l.result === 'ok').length;
        const err = recent.filter((l: any) => l.result === 'error').length;
        const deltaSum = recent.filter((l: any) => l.result === 'ok').reduce((s: number, l: any) => s + (l.delta || 0), 0);
        const perArtist: Record<string, { ok: number; err: number }> = {};
        recent.forEach((l: any) => {
          perArtist[l.artistId] = perArtist[l.artistId] || { ok: 0, err: 0 };
          perArtist[l.artistId][l.result === 'ok' ? 'ok' : 'err']++;
        });
        setSyncLog24h({ ok, err, total: recent.length, deltaSum, perArtist });
      } catch {}
    };
    compute();
    const t = setInterval(compute, 4000);
    return () => clearInterval(t);
  }, []);

  // 标签管理函数
  const createTag = (name: string, color: string, description?: string) => {
    const newTag: CustomTag = {
      id: `tag-${Date.now()}`,
      name,
      color,
      createdAt: new Date().toISOString(),
      description,
    };
    setCustomTags(prev => [...prev, newTag]);
    return newTag;
  };

  const updateTag = (tagId: string, updates: Partial<CustomTag>) => {
    setCustomTags(prev => prev.map(t => t.id === tagId ? { ...t, ...updates } : t));
  };

  const deleteTag = (tagId: string) => {
    setCustomTags(prev => prev.filter(t => t.id !== tagId));
    // 同时从所有艺人中移除该标签
    setArtistTagMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(artistId => {
        updated[artistId] = updated[artistId].filter(id => id !== tagId);
      });
      return updated;
    });
    setSelectedTagIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagId);
      return newSet;
    });
  };

  const addTagToArtist = (artistId: string, tagId: string) => {
    setArtistTagMap(prev => {
      const current = prev[artistId] || [];
      if (current.includes(tagId)) return prev;
      return { ...prev, [artistId]: [...current, tagId] };
    });
  };

  const removeTagFromArtist = (artistId: string, tagId: string) => {
    setArtistTagMap(prev => {
      const current = prev[artistId] || [];
      return { ...prev, [artistId]: current.filter(id => id !== tagId) };
    });
  };

  const addTagToArtists = (artistIds: string[], tagId: string) => {
    setArtistTagMap(prev => {
      const updated = { ...prev };
      artistIds.forEach(artistId => {
        const current = updated[artistId] || [];
        if (!current.includes(tagId)) {
          updated[artistId] = [...current, tagId];
        }
      });
      return updated;
    });
  };

  const filtered = useMemo(() => {
    let list = [...MOCK_ARTISTS];

    // 搜索过滤
    if (searchQuery) {
      list = list.filter(a => {
        const nameMatch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
        const tagMatch = artistTagMap[a.id]?.some(tagId => {
          const tag = customTags.find(t => t.id === tagId);
          return tag && tag.name.toLowerCase().includes(searchQuery.toLowerCase());
        });
        return nameMatch || tagMatch;
      });
    }

    // 根据筛选模式应用不同的过滤逻辑
    if (filterMode === 'dual') {
      // 模式1：双维度（职业 + 风格）
      if (professionFilter !== 'all') list = list.filter(a => a.profession === professionFilter);
      if (styleFilter !== 'all') list = list.filter(a => a.designStyle === styleFilter);
    } else if (filterMode === 'profession') {
      // 模式2：职业主导
      if (professionFilter !== 'all') list = list.filter(a => a.profession === professionFilter);
    } else if (filterMode === 'tags') {
      // 模式3：多标签
      if (selectedTagIds.size > 0) {
        list = list.filter(a => {
          const artistTags = artistTagMap[a.id] || [];
          return artistTags.some(tagId => selectedTagIds.has(tagId));
        });
      }
    }

    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);

    list.sort((a, b) => {
      const num = (s: string | undefined) => parseInt((s || '0').replace(/[^0-9.]/g, '')) || 0;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'level') return b.level - a.level;
      if (sortBy === 'commercial') return num(b.commercialValue) - num(a.commercialValue);
      if (sortBy === 'fans') return num(b.stats.fans) - num(a.stats.fans);
      if (sortBy === 'views') return num(b.stats.views24h) - num(a.stats.views24h);
      return num(b.stats.revenue) - num(a.stats.revenue);
    });
    return list;
  }, [searchQuery, filterMode, styleFilter, professionFilter, selectedTagIds, statusFilter, sortBy, artistTagMap, customTags]);

  const styleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MOCK_ARTISTS.length };
    MOCK_ARTISTS.forEach(a => { counts[a.designStyle] = (counts[a.designStyle] || 0) + 1; });
    return counts;
  }, []);

  const professionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MOCK_ARTISTS.length };
    MOCK_ARTISTS.forEach(a => {
      if (a.profession) counts[a.profession] = (counts[a.profession] || 0) + 1;
    });
    return counts;
  }, []);

  const tagUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(artistTagMap).forEach(tagIds => {
      tagIds.forEach(tagId => {
        counts[tagId] = (counts[tagId] || 0) + 1;
      });
    });
    return counts;
  }, [artistTagMap]);

  const matrixSummary = useMemo(() => {
    const num = (s: string | undefined) => parseInt((s || '0').replace(/[^0-9.]/g, '')) || 0;
    // Filter artists based on current filter mode
    let filteredArtists = [...MOCK_ARTISTS];

    if (filterMode === 'dual') {
      if (professionFilter !== 'all') filteredArtists = filteredArtists.filter(a => a.profession === professionFilter);
      if (styleFilter !== 'all') filteredArtists = filteredArtists.filter(a => a.designStyle === styleFilter);
    } else if (filterMode === 'profession') {
      if (professionFilter !== 'all') filteredArtists = filteredArtists.filter(a => a.profession === professionFilter);
    } else if (filterMode === 'tags') {
      if (selectedTagIds.size > 0) {
        filteredArtists = filteredArtists.filter(a => {
          const artistTags = artistTagMap[a.id] || [];
          return artistTags.some(tagId => selectedTagIds.has(tagId));
        });
      }
    }

    const totalFans = filteredArtists.reduce((sum, a) => sum + num(a.stats.fans), 0);
    const totalRevenue = filteredArtists.reduce((sum, a) => sum + num(a.stats.monthlyRevenue), 0);
    const totalWorks = filteredArtists.reduce((sum, a) => sum + a.stats.songs + a.stats.dramas + a.stats.ads + a.stats.variety, 0);
    const totalViews = filteredArtists.reduce((sum, a) => sum + num(a.stats.views24h), 0);
    const totalPlatforms = filteredArtists.reduce((sum, a) => sum + (a.platforms?.length || 0), 0);
    const totalComments = filteredArtists.reduce((sum, a) => sum + num(a.stats.comments24h), 0);
    const topStar = [...filteredArtists].sort((a, b) => num(b.commercialValue) - num(a.commercialValue))[0];
    const maxCommercial = Math.max(...MOCK_ARTISTS.map(a => num(a.commercialValue)));
    const avgGrowth = filteredArtists.length > 0 ? filteredArtists.reduce((s, a) => s + (a.stats.growth7d ?? 0), 0) / filteredArtists.length : 0;
    const activeCount = filteredArtists.filter(a => a.status === 'active').length;
    const revenueMoM = 12.4;
    return { totalFans, totalRevenue, totalWorks, totalViews, totalPlatforms, totalComments, topStar, maxCommercial, avgGrowth, activeCount, revenueMoM, artistCount: filteredArtists.length };
  }, [filterMode, styleFilter, professionFilter, selectedTagIds, artistTagMap]);

  const gridCols = density === 'compact' ? 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : density === 'large' ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <div className="space-y-4">
      {/* Header */}

      {/* Collapsible Filter Panel */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
        {/* Filter Toggle Header with Tabs */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">{zh ? '筛选器' : 'Filters'}</span>
              {(filterMode !== 'tags' || selectedTagIds.size > 0 || professionFilter !== 'all' || styleFilter !== 'all') && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                  {zh ? '已启用' : 'Active'}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Mode Tabs inline */}
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              {[
                { mode: 'dual' as const, label_zh: '双维度', label_en: 'Dual' },
                { mode: 'profession' as const, label_zh: '职业', label_en: 'Prof' },
                { mode: 'tags' as const, label_zh: '标签', label_en: 'Tags' },
              ].map(m => (
                <button key={m.mode} onClick={(e) => { e.stopPropagation(); setFilterMode(m.mode); }}
                  className={`px-2.5 py-1 rounded-lg border transition text-xs font-bold ${filterMode === m.mode ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}>
                  {zh ? m.label_zh : m.label_en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Content */}
        <AnimatePresence>
          {filterPanelOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-3">
                {/* Mobile Filter Mode Tabs */}
                <div className="flex sm:hidden items-center gap-2 pb-3 border-b border-white/5 mb-3">
                  {[
                    { mode: 'dual' as const, label_zh: '双维度', label_en: 'Dual' },
                    { mode: 'profession' as const, label_zh: '职业主导', label_en: 'Profession' },
                    { mode: 'tags' as const, label_zh: '多标签', label_en: 'Tags' },
                  ].map(m => (
                    <button key={m.mode} onClick={() => setFilterMode(m.mode)}
                      className={`px-3 py-1.5 rounded-lg border transition text-xs font-bold ${filterMode === m.mode ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'}`}>
                      {zh ? m.label_zh : m.label_en}
                    </button>
                  ))}
                </div>

                {/* Mode-specific Filter UI */}
                <AnimatePresence mode="wait">
                  <motion.div key={filterMode} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            {/* Mode 1: Dual Dimension */}
            {filterMode === 'dual' && (
              <>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{zh ? '职业背景' : 'Profession'}</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setProfessionFilter('all')}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${professionFilter === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                      {zh ? '全部职业' : 'All'} ({professionCounts.all})
                    </button>
                    {PROFESSION_ORDER.map(p => {
                      const conf = PROFESSION_CONFIG[p];
                      const count = professionCounts[p] || 0;
                      const active = professionFilter === p;
                      return (
                        <button key={p} onClick={() => setProfessionFilter(p)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-1 ${active ? `${conf.color} ${conf.bg} border-white/20` : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                          <span className="font-mono text-[9px]">{conf.emoji}</span> {zh ? conf.zh : conf.en}
                          {count > 0 && <span className="opacity-60">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{zh ? '艺人风格' : 'Design Style'}</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setStyleFilter('all')}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${styleFilter === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                      {zh ? '全部风格' : 'All Styles'} ({styleCounts.all})
                    </button>
                    {DESIGN_STYLE_ORDER.map(s => {
                      const conf = DESIGN_STYLE_CONFIG[s];
                      const count = styleCounts[s] || 0;
                      const active = styleFilter === s;
                      return (
                        <button key={s} onClick={() => setStyleFilter(s)}
                          style={active ? { borderColor: conf.accent + '60', color: conf.accent, background: conf.accent + '15' } : undefined}
                          className={`px-3 py-1.5 text-xs rounded-full border transition flex items-center gap-1 ${active ? '' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                          <span className="font-mono text-[9px]">{conf.emoji}</span> {zh ? conf.zh : conf.en}
                          {count > 0 && <span className="opacity-60">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Mode 2: Profession Primary */}
            {filterMode === 'profession' && (
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">职业身份</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setProfessionFilter('all')}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${professionFilter === 'all' ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                    全部职业 ({professionCounts.all})
                  </button>
                  {PROFESSION_ORDER.map(p => {
                    const conf = PROFESSION_CONFIG[p];
                    const count = professionCounts[p] || 0;
                    const active = professionFilter === p;
                    return (
                      <button key={p} onClick={() => setProfessionFilter(p)}
                        className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${active ? `${conf.color} ${conf.bg} border-white/20` : 'text-gray-500 border-white/5 hover:border-white/15'}`}>
                        <span className="text-base">{conf.emoji}</span>
                        <span className="text-xs font-bold">{conf.zh} ({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: Multi Tags */}
            {filterMode === 'tags' && (
              <div>
                {customTags.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <div className="mb-2">{zh ? '暂无标签' : 'No tags yet'}</div>
                    <button onClick={() => setShowTagManager(true)}
                      className="text-cyan-400 hover:text-cyan-300">
                      {zh ? '创建第一个标签' : 'Create your first tag'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
                    {/* All Tags Button */}
                    <button 
                      onClick={() => setSelectedTagIds(new Set())}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all font-medium whitespace-nowrap flex items-center gap-2 ${selectedTagIds.size === 0 ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-300'}`}>
                      <span>{zh ? '全部' : 'All'}</span>
                      <span className="text-xs opacity-60">{MOCK_ARTISTS.length}</span>
                    </button>
                    
                    {/* Custom Tags */}
                    {customTags.map(tag => {
                      const active = selectedTagIds.has(tag.id);
                      const count = tagUsageCounts[tag.id] || 0;
                      return (
                        <button key={tag.id} onClick={() => {
                          const newSet = new Set(selectedTagIds);
                          if (active) newSet.delete(tag.id);
                          else newSet.add(tag.id);
                          setSelectedTagIds(newSet);
                        }}
                          className={`px-4 py-2 text-sm rounded-lg border transition-all font-medium whitespace-nowrap flex items-center gap-2 ${active ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-300'}`}
                          title={tag.description}>
                          <span>{tag.name}</span>
                          <span className="text-xs opacity-60">{count}</span>
                        </button>
                      );
                    })}
                    
                    {/* Manage Tags Button */}
                    <button onClick={() => setShowTagManager(true)}
                      className="px-4 py-2 text-sm rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition border border-cyan-500/40 font-medium whitespace-nowrap ml-2">
                      {zh ? '+ 管理标签' : '+ Manage Tags'}
                    </button>
                  </div>
                )}
              </div>
            )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Matrix Summary KPI - Compact 2x4 Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: zh ? '艺人总数' : 'Artists', value: matrixSummary.artistCount.toString(), color: 'text-cyan-400', sub: zh ? `${matrixSummary.activeCount}活跃` : `${matrixSummary.activeCount} active`, subTone: 'positive' as const },
          { icon: Heart, label: zh ? '总粉丝' : 'Fans', value: matrixSummary.totalFans >= 10000 ? `${(matrixSummary.totalFans / 10000).toFixed(1)}万` : matrixSummary.totalFans.toString(), color: 'text-rose-400', sub: `${matrixSummary.avgGrowth >= 0 ? '+' : ''}${matrixSummary.avgGrowth.toFixed(1)}%`, subTone: (matrixSummary.avgGrowth >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' },
          { icon: Activity, label: zh ? '平台账号' : 'Platforms', value: matrixSummary.totalPlatforms.toString(), color: 'text-purple-400', sub: zh ? `${matrixSummary.artistCount}位` : `${matrixSummary.artistCount}`, subTone: 'neutral' as const },
          { icon: Eye, label: zh ? '总曝光' : 'Views', value: matrixSummary.totalViews >= 10000 ? `${(matrixSummary.totalViews / 10000).toFixed(1)}万` : matrixSummary.totalViews.toString(), color: 'text-indigo-400', sub: zh ? '24h' : '24h', subTone: 'neutral' as const },
          { icon: BarChart3, label: zh ? '总评论' : 'Comments', value: matrixSummary.totalComments >= 10000 ? `${(matrixSummary.totalComments / 10000).toFixed(1)}万` : matrixSummary.totalComments.toString(), color: 'text-sky-400', sub: zh ? '24h' : '24h', subTone: 'neutral' as const },
          { icon: Package, label: zh ? '内容总量' : 'Works', value: matrixSummary.totalWorks.toString(), color: 'text-fuchsia-400', sub: zh ? '全部' : 'total', subTone: 'neutral' as const },
          { icon: DollarSign, label: zh ? '月收益' : 'Revenue', value: `${matrixSummary.totalRevenue >= 10000 ? (matrixSummary.totalRevenue / 10000).toFixed(1) + '万' : matrixSummary.totalRevenue}`, color: 'text-emerald-400', sub: `+${matrixSummary.revenueMoM}%`, subTone: 'positive' as const },
          { icon: Crown, label: zh ? '头部艺人' : 'Top Star', value: matrixSummary.topStar?.name || '—', color: 'text-amber-400', onClick: () => matrixSummary.topStar && setSelectedArtist(matrixSummary.topStar), sub: matrixSummary.topStar ? matrixSummary.topStar.commercialValue : '', subTone: 'neutral' as const },
        ].map((s, i) => {
          const SIcon = s.icon;
          const Tag: any = s.onClick ? 'button' : 'div';
          const subColor = s.subTone === 'positive' ? 'text-green-400' : s.subTone === 'negative' ? 'text-red-400' : 'text-gray-500';
          return (
            <Tag key={i} onClick={s.onClick}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm p-3 flex flex-col gap-2 text-left ${s.onClick ? 'cursor-pointer hover:border-white/20 hover:from-white/[0.08] transition' : ''}`}>
              <div className="flex items-center justify-between">
                <SIcon className={`w-4 h-4 ${s.color} opacity-70`} />
                {s.onClick && <ArrowUpRight className="w-3 h-3 text-gray-500 opacity-50" />}
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums text-white mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</div>
                  {s.sub && (
                    <div className={`text-[10px] tabular-nums font-medium flex items-center gap-0.5 ${subColor}`}>
                      {s.subTone === 'positive' && <TrendingUp className="w-2.5 h-2.5" />}
                      {s.subTone === 'negative' && <TrendingDown className="w-2.5 h-2.5" />}
                      {s.sub}
                    </div>
                  )}
                </div>
              </div>
            </Tag>
          );
        })}
      </div>

      {/* 24h Global Sync Health */}
      {syncLog24h.total > 0 && (() => {
        const successRate = (syncLog24h.ok / syncLog24h.total) * 100;
        const tone = successRate >= 95 ? { color: 'text-green-400', bar: 'from-green-500 to-emerald-500', bg: 'from-green-500/10 to-emerald-500/5', label: zh ? '健康' : 'Healthy' }
                   : successRate >= 80 ? { color: 'text-amber-400', bar: 'from-amber-500 to-orange-500', bg: 'from-amber-500/10 to-orange-500/5', label: zh ? '关注' : 'Warn' }
                                       : { color: 'text-red-400',   bar: 'from-red-500 to-rose-500',     bg: 'from-red-500/10 to-rose-500/5',   label: zh ? '告警' : 'Alert' };
        const topArtists = Object.entries(syncLog24h.perArtist).sort((a, b) => (b[1].ok + b[1].err) - (a[1].ok + a[1].err)).slice(0, 4);
        const idToName = Object.fromEntries(MOCK_ARTISTS.map(a => [a.id, a.name]));
        return (
          <div className={`rounded-xl border border-white/5 bg-gradient-to-r ${tone.bg} p-4`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone.color}`} style={{ borderColor: 'currentColor' }}>{tone.label}</span>
                <span className="text-sm font-bold text-gray-200">{zh ? '24h 全网同步健康度' : '24h Global Sync Health'}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] tabular-nums">
                <span className={tone.color}><span className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>{successRate.toFixed(1)}%</span> <span className="opacity-60">{zh ? '成功率' : 'success'}</span></span>
                <span className="text-gray-400">{syncLog24h.total} {zh ? '次同步' : 'syncs'}</span>
                <span className="text-green-400">+{syncLog24h.deltaSum.toLocaleString()} {zh ? '粉丝' : 'fans'}</span>
                {syncLog24h.err > 0 && <span className="text-red-400">{syncLog24h.err} {zh ? '失败' : 'failed'}</span>}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
              <div className={`h-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${successRate}%` }} />
            </div>
            {topArtists.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topArtists.map(([id, s]) => {
                  const total = s.ok + s.err;
                  const rate = total > 0 ? (s.ok / total) * 100 : 0;
                  return (
                    <button key={id} onClick={() => { const a = MOCK_ARTISTS.find(x => x.id === id); if (a) setSelectedArtist(a); }}
                      className="text-[10px] px-2 py-1 rounded-md bg-black/30 border border-white/5 hover:border-white/15 transition flex items-center gap-1.5">
                      <span className="text-gray-300 font-semibold">{idToName[id] || id}</span>
                      <span className={`tabular-nums ${rate >= 95 ? 'text-green-400' : rate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{rate.toFixed(0)}%</span>
                      <span className="text-gray-600">· {total}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Search + Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Enhanced Search Box */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500/50 focus:bg-gray-900/70 focus:outline-none transition"
            placeholder={zh ? '搜索艺人姓名或标签...' : 'Search artists or tags...'} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* Compact Controls */}
        <div className="flex gap-2 shrink-0">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-gray-300 focus:outline-none hover:border-white/20 transition cursor-pointer">
            <option value="level">{zh ? '等级' : 'Level'}</option>
            <option value="name">{zh ? '名称' : 'Name'}</option>
            <option value="revenue">{zh ? '收益' : 'Revenue'}</option>
            <option value="commercial">{zh ? '价值' : 'Value'}</option>
            <option value="fans">{zh ? '粉丝' : 'Fans'}</option>
            <option value="views">{zh ? '曝光' : 'Views'}</option>
          </select>
          {viewMode === 'grid' && (
            <div className="flex border border-white/10 rounded-lg overflow-hidden">
              {(['compact', 'standard', 'large'] as const).map(d => (
                <button key={d} onClick={() => setDensity(d)}
                  title={zh ? ({ compact: '紧凑', standard: '标准', large: '大图' })[d] : d}
                  className={`px-3 py-2.5 text-[11px] font-bold transition ${density === d ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {d === 'compact' ? '▦' : d === 'standard' ? '▥' : '▢'}
                </button>
              ))}
            </div>
          )}
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`px-3 py-2.5 transition ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-2.5 transition ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Grid View — Portrait + commercial data layered cards */}
      {viewMode === 'grid' && (
        <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
          {filtered.map((artist, i) => {
            const styleConf = DESIGN_STYLE_CONFIG[artist.designStyle];
            const qualConf = QUALITY_CONFIG[artist.quality];
            const statusConf = STATUS_CONFIG[artist.status];
            const isCompact = density === 'compact';
            const isLarge = density === 'large';
            const totalWorks = artist.stats.songs + artist.stats.dramas + artist.stats.ads + artist.stats.variety;
            const lastActiveDays = (() => {
              const d = new Date(artist.lastActive);
              return Math.floor((Date.now() - d.getTime()) / 86400000);
            })();
            const isHot = !isNaN(lastActiveDays) && lastActiveDays <= 7;
            const growth = artist.stats.growth7d ?? 0;
            // Deterministic 7-point spark series seeded from id + growth
            const sparkSeries = (() => {
              const seed = artist.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
              const pts: number[] = [];
              for (let k = 0; k < 7; k++) {
                const noise = Math.sin(seed * 0.7 + k * 1.3) * 0.5 + Math.cos(seed * 0.3 + k * 0.7) * 0.3;
                pts.push(50 + (growth / 7) * k + noise * 8);
              }
              return pts;
            })();
            const sparkMin = Math.min(...sparkSeries);
            const sparkMax = Math.max(...sparkSeries);
            const sparkRange = sparkMax - sparkMin || 1;
            const sparkPath = sparkSeries.map((v, idx) => {
              const x = (idx / 6) * 40;
              const y = 14 - ((v - sparkMin) / sparkRange) * 12;
              return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            const sparkColor = growth >= 0 ? '#34d399' : '#f87171';
            // Quality gradient bar
            const qualGrad = artist.quality === 'legendary'
              ? 'from-amber-500/30 via-yellow-400/20 to-amber-500/30'
              : artist.quality === 'epic'
                ? 'from-purple-500/30 via-fuchsia-500/20 to-purple-500/30'
                : artist.quality === 'rare'
                  ? 'from-blue-500/25 via-cyan-500/15 to-blue-500/25'
                  : 'from-gray-600/20 via-gray-500/10 to-gray-600/20';
            const works = [
              { key: 'music' as const,       icon: Music,       count: artist.stats.songs,   label_zh: '歌曲', label_en: 'Songs',  color: 'text-cyan-400' },
              { key: 'film' as const,        icon: Film,        count: artist.stats.dramas,  label_zh: '短剧', label_en: 'Dramas', color: 'text-purple-400' },
              { key: 'endorsement' as const, icon: ShoppingBag, count: artist.stats.ads,     label_zh: '代言', label_en: 'Ads',    color: 'text-pink-400' },
              { key: 'variety' as const,     icon: Tv,          count: artist.stats.variety, label_zh: '综艺', label_en: 'Variety',color: 'text-amber-400' },
            ];
            return (
              <motion.div key={artist.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }}
                onClick={() => setSelectedArtist(artist)}
                className={`relative rounded-xl overflow-hidden border border-white/5 bg-gray-900/60 cursor-pointer group hover:${styleConf.ring} hover:ring-2 hover:border-transparent transition-all flex flex-col`}>
                {/* ===== Layer 1: Portrait hero ===== */}
                <div className={`relative ${isCompact ? 'aspect-[3/4]' : 'aspect-[4/5]'} overflow-hidden bg-black flex-shrink-0`}>
                  <img
                    src={artist.portrait || artist.avatar}
                    alt={artist.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  <div className={`absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b ${styleConf.gradient} opacity-30 mix-blend-overlay pointer-events-none`} />

                  {/* Top-right: status + active dot */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isHot && (
                      <Badge className="bg-green-500/20 backdrop-blur-md border-green-500/40 text-[9px] flex items-center gap-1 px-1.5 py-0.5 text-green-300">
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
                        {zh ? '活跃' : 'Live'}
                      </Badge>
                    )}
                    <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] flex items-center gap-1 px-2 py-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      <span className="text-gray-200">{zh ? statusConf.zh : statusConf.en}</span>
                    </Badge>
                  </div>
                  {/* Top-left: quality */}
                  {(artist.quality === 'legendary' || artist.quality === 'epic') && (
                    <div className="absolute top-3 left-3">
                      <Badge className={`text-[10px] backdrop-blur-md border-0 flex items-center gap-1 px-2 py-0.5 ${qualConf.bg}`}>
                        <Crown className={`w-3 h-3 ${qualConf.color}`} />
                        <span className={qualConf.color}>{zh ? qualConf.zh : qualConf.en}</span>
                      </Badge>
                    </div>
                  )}

                  {/* Bottom: name + style/type tags */}
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <div className="flex items-end justify-between gap-2 mb-1.5">
                      <h3 className="text-white truncate" style={{ fontFamily: 'var(--font-display)', fontSize: isCompact ? '1.05rem' : '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>
                        {artist.name}
                      </h3>
                      <span className="text-[10px] text-cyan-300 font-bold tabular-nums shrink-0" style={{ fontFamily: 'var(--font-display)' }}>Lv.{artist.level}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        style={{ background: styleConf.accent + '25', color: styleConf.accent, borderColor: styleConf.accent + '40' }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border backdrop-blur-sm">
                        <span className="font-mono text-[8px]">{styleConf.emoji}</span>
                        <span>#{zh ? styleConf.zh : styleConf.en}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-white/15 bg-white/5 text-gray-300 backdrop-blur-sm">
                        <span className="font-mono text-[8px]">{ARTIST_TYPE_CONFIG[artist.type].icon}</span>
                        {zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}
                      </span>
                      {/* Custom Tags */}
                      {(artistTagMap[artist.id] || []).slice(0, 2).map(tagId => {
                        const tag = customTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        const colorConfig = TAG_COLORS.find(c => c.hex === tag.color) || TAG_COLORS[0];
                        return (
                          <span key={tagId}
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] border backdrop-blur-sm ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
                            TAG {tag.name}
                          </span>
                        );
                      })}
                      {(artistTagMap[artist.id]?.length || 0) > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-white/15 bg-white/5 text-gray-400 backdrop-blur-sm">
                          +{(artistTagMap[artist.id]?.length || 0) - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ===== Compact mode: minimal stats only ===== */}
                {isCompact && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-black/40 border-t border-white/5">
                    <div className="flex items-center gap-1 text-rose-400">
                      <Heart className="w-3 h-3 fill-current" />
                      <span className="text-[11px] tabular-nums">{artist.stats.fans}</span>
                    </div>
                    <span className="text-[11px] text-cyan-400 tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.monthlyRevenue}/mo</span>
                  </div>
                )}

                {/* ===== Standard / Large mode: full data layers ===== */}
                {!isCompact && (
                  <>
                    {/* Layer 2: Key metrics 2x2 */}
                    <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
                      <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '月收益' : 'Monthly'}</div>
                          <div className="text-xs font-bold tabular-nums truncate bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.monthlyRevenue}</div>
                        </div>
                      </div>
                      <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '人气' : 'Popularity'}</div>
                          <div className="text-xs font-bold tabular-nums text-orange-300" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.popularity}</div>
                        </div>
                      </div>
                      <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            {zh ? '粉丝' : 'Fans'}
                            {growth !== 0 && (
                              <span className={`flex items-center gap-px text-[8px] ${growth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {growth > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                {Math.abs(growth).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-xs font-bold tabular-nums text-rose-300" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.fans}</div>
                            <svg width="40" height="14" viewBox="0 0 40 14" className="opacity-80 shrink-0">
                              <defs>
                                <linearGradient id={`sg-${artist.id}`} x1="0" x2="0" y1="0" y2="1">
                                  <stop key={`sg-${artist.id}-stop-1`} offset="0%" stopColor={sparkColor} stopOpacity="0.4" />
                                  <stop key={`sg-${artist.id}-stop-2`} offset="100%" stopColor={sparkColor} stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d={`${sparkPath} L40,14 L0,14 Z`} fill={`url(#sg-${artist.id})`} />
                              <path d={sparkPath} stroke={sparkColor} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '24h曝光' : '24h Views'}</div>
                          <div className="text-xs font-bold tabular-nums text-emerald-300" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.views24h || '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Layer 3: Works matrix (4 grid, clickable to workshop) */}
                    <div className="grid grid-cols-4 gap-px bg-white/5">
                      {works.map(w => {
                        const Icon = w.icon;
                        return (
                          <button
                            key={w.key}
                            onClick={(e) => { e.stopPropagation(); onNavigateWorkshop?.(w.key); }}
                            disabled={!onNavigateWorkshop}
                            title={onNavigateWorkshop ? (zh ? `打开${w.label_zh}工坊` : `Open ${w.label_en} workshop`) : undefined}
                            className="bg-gray-950/80 px-2 py-2 flex flex-col items-center gap-0.5 transition group/work hover:bg-white/5 disabled:cursor-default disabled:hover:bg-gray-950/80">
                            <Icon className={`w-3.5 h-3.5 ${w.color} opacity-70 group-hover/work:opacity-100 transition`} />
                            <span className="text-xs font-bold tabular-nums text-gray-200" style={{ fontFamily: 'var(--font-display)' }}>{w.count}</span>
                            <span className="text-[9px] text-gray-500 leading-none">{zh ? w.label_zh : w.label_en}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Large-only: live commerce GMV + total works */}
                    {isLarge && (
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-gray-950/80 border-t border-white/5 text-[10px]">
                        <span className="flex items-center gap-1 text-fuchsia-300">
                          <Package className="w-3 h-3" />
                          <span className="text-gray-500">{zh ? '带货GMV' : 'GMV'}</span>
                          <span className="font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>{artist.stats.liveCommerceGMV || '—'}</span>
                        </span>
                        <span className="text-gray-500">
                          {zh ? '总作品' : 'Total'} <span className="text-gray-200 font-bold tabular-nums">{totalWorks}</span>
                        </span>
                      </div>
                    )}

                    {/* Layer 4: Commercial value progress (relative to matrix max) */}
                    {(() => {
                      const cv = parseInt((artist.commercialValue || '0').replace(/[^0-9.]/g, '')) || 0;
                      const pct = matrixSummary.maxCommercial > 0 ? Math.min(100, (cv / matrixSummary.maxCommercial) * 100) : 0;
                      const isTop = cv === matrixSummary.maxCommercial && cv > 0;
                      return (
                        <div className="relative px-3.5 py-2.5 bg-gray-950/80 border-t border-white/5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Crown className={`w-3.5 h-3.5 shrink-0 ${qualConf.color}`} />
                              <span className="text-[10px] uppercase tracking-wider text-gray-300">{zh ? '商业价值' : 'Commercial Value'}</span>
                              {isTop && <Badge className="text-[9px] bg-amber-500/15 text-amber-300 border-amber-500/30 px-1.5 py-0">TOP</Badge>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-sm font-extrabold tabular-nums ${qualConf.color}`} style={{ fontFamily: 'var(--font-display)' }}>{artist.commercialValue}</span>
                              <span className="text-[9px] text-gray-500 tabular-nums">/{matrixSummary.maxCommercial.toLocaleString()}</span>
                              <ArrowUpRight className={`w-3.5 h-3.5 ${qualConf.color} opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition`} />
                            </div>
                          </div>
                          <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .8, delay: i * .03 }}
                              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${qualGrad}`} />
                            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, boxShadow: `0 0 8px ${qualConf.color === 'text-amber-400' ? '#f59e0b' : qualConf.color === 'text-purple-400' ? '#a855f7' : '#06b6d4'}40` }} />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {([
                  { label: zh ? '艺人' : 'Artist', sort: 'name' as const },
                  { label: zh ? '设计风格' : 'Style' },
                  { label: zh ? '类型' : 'Type' },
                  { label: zh ? '等级' : 'Level', sort: 'level' as const },
                  { label: zh ? '品质' : 'Quality' },
                  { label: zh ? '状态' : 'Status' },
                  { label: zh ? '粉丝' : 'Fans', sort: 'fans' as const },
                  { label: zh ? '月收益' : 'Monthly', sort: 'revenue' as const },
                  { label: zh ? '商业价值' : 'CV', sort: 'commercial' as const },
                  { label: '' },
                ]).map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">
                    {h.sort ? (
                      <button onClick={() => setSortBy(h.sort!)}
                        className={`flex items-center gap-1 transition ${sortBy === h.sort ? 'text-cyan-400' : 'hover:text-gray-300'}`}>
                        {h.label}
                        {sortBy === h.sort && <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((artist, i) => {
                const typeConf = ARTIST_TYPE_CONFIG[artist.type];
                const qualConf = QUALITY_CONFIG[artist.quality];
                const statusConf = STATUS_CONFIG[artist.status];
                const styleConf = DESIGN_STYLE_CONFIG[artist.designStyle];
                return (
                  <motion.tr key={artist.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .03 }}
                    onClick={() => setSelectedArtist(artist)}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={artist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                        <span className="text-sm font-semibold">{artist.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: styleConf.accent }}>{styleConf.emoji} {zh ? styleConf.zh : styleConf.en}</span></td>
                    <td className="px-4 py-3"><span className={`text-xs ${typeConf.color}`}>{typeConf.icon} {zh ? ARTIST_TYPE_LABELS[artist.type].zh : ARTIST_TYPE_LABELS[artist.type].en}</span></td>
                    <td className="px-4 py-3"><span className="text-sm font-bold text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>Lv.{artist.level}</span></td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] ${qualConf.color} ${qualConf.bg} border-0`}>{zh ? qualConf.zh : qualConf.en}</Badge></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs"><div className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />{zh ? statusConf.zh : statusConf.en}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-400">{artist.stats.fans}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{artist.stats.monthlyRevenue}</td>
                    <td className="px-4 py-3"><span className={`text-sm font-bold tabular-nums ${qualConf.color}`} style={{ fontFamily: 'var(--font-display)' }}>{artist.commercialValue}</span></td>
                    <td className="px-4 py-3"><Eye className="w-4 h-4 text-gray-500 hover:text-cyan-400 transition" /></td>
                  </motion.tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (() => {
              const num = (s: string | undefined) => parseInt((s || '0').replace(/[^0-9.]/g, '')) || 0;
              const sumFans = filtered.reduce((s, a) => s + num(a.stats.fans), 0);
              const sumRev = filtered.reduce((s, a) => s + num(a.stats.monthlyRevenue), 0);
              const sumCV = filtered.reduce((s, a) => s + num(a.commercialValue), 0);
              const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString();
              return (
                <tfoot>
                  <tr className="border-t-2 border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-transparent">
                    <td className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-cyan-300" colSpan={6}>
                      {zh ? `合计 · ${filtered.length} 位艺人` : `Total · ${filtered.length} artists`}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-rose-300" style={{ fontFamily: 'var(--font-display)' }}>{fmt(sumFans)}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-emerald-300" style={{ fontFamily: 'var(--font-display)' }}>{fmt(sumRev)}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-amber-300" style={{ fontFamily: 'var(--font-display)' }}>{fmt(sumCV)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-400">{zh ? '暂无匹配艺人' : 'No Artists Found'}</h3>
          <p className="text-sm text-gray-500 mt-1">{zh ? '尝试调整筛选条件' : 'Try adjusting your filters'}</p>
        </div>
      )}

      {/* Tag Manager Dialog */}
      <AnimatePresence>
        {showTagManager && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowTagManager(false); setEditingTag(null); }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">

              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {zh ? '标签管理' : 'Tag Manager'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{zh ? '创建和管理艺人标签' : 'Create and manage artist tags'}</p>
                </div>
                <button onClick={() => { setShowTagManager(false); setEditingTag(null); }}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Create/Edit Tag Form */}
                <div className="mb-6 p-4 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-sm font-semibold mb-3">{editingTag ? (zh ? '编辑标签' : 'Edit Tag') : (zh ? '新建标签' : 'New Tag')}</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{zh ? '标签名称' : 'Tag Name'}</label>
                      <input
                        type="text"
                        placeholder={zh ? '例如：重点培养、合作中' : 'e.g. Priority, In Collaboration'}
                        value={editingTag?.name || ''}
                        onChange={e => setEditingTag(prev => prev ? { ...prev, name: e.target.value } : { id: '', name: e.target.value, color: TAG_COLORS[0].hex, createdAt: '' })}
                        className="w-full bg-gray-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{zh ? '标签颜色' : 'Tag Color'}</label>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLORS.map(colorConfig => (
                          <button key={colorConfig.hex}
                            onClick={() => setEditingTag(prev => prev ? { ...prev, color: colorConfig.hex } : { id: '', name: '', color: colorConfig.hex, createdAt: '' })}
                            className={`w-8 h-8 rounded-full border-2 transition ${editingTag?.color === colorConfig.hex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: colorConfig.hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{zh ? '描述（可选）' : 'Description (optional)'}</label>
                      <input
                        type="text"
                        placeholder={zh ? '标签的用途说明' : 'What this tag is for'}
                        value={editingTag?.description || ''}
                        onChange={e => setEditingTag(prev => prev ? { ...prev, description: e.target.value } : { id: '', name: '', color: TAG_COLORS[0].hex, createdAt: '', description: e.target.value })}
                        className="w-full bg-gray-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (!editingTag?.name.trim()) return;
                          if (editingTag.id) {
                            updateTag(editingTag.id, { name: editingTag.name, color: editingTag.color, description: editingTag.description });
                          } else {
                            createTag(editingTag.name, editingTag.color || TAG_COLORS[0].hex, editingTag.description);
                          }
                          setEditingTag(null);
                        }}
                        disabled={!editingTag?.name.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        {editingTag?.id ? (zh ? '保存' : 'Save') : (zh ? '创建' : 'Create')}
                      </Button>
                      {editingTag && (
                        <Button onClick={() => setEditingTag(null)} className="bg-white/5 hover:bg-white/10">
                          {zh ? '取消' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tag List */}
                <div>
                  <div className="text-sm font-semibold mb-3">{zh ? '现有标签' : 'Existing Tags'} ({customTags.length})</div>
                  {customTags.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      {zh ? '还没有标签，创建一个吧' : 'No tags yet, create one above'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customTags.map(tag => {
                        const colorConfig = TAG_COLORS.find(c => c.hex === tag.color) || TAG_COLORS[0];
                        const count = tagUsageCounts[tag.id] || 0;
                        return (
                          <div key={tag.id}
                            className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5 hover:border-white/10 transition">
                            <div className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{tag.name}</div>
                              {tag.description && (
                                <div className="text-xs text-gray-500 truncate">{tag.description}</div>
                              )}
                              <div className="text-xs text-gray-600 mt-0.5">
                                {zh ? '使用' : 'Used'}: {count} {zh ? '次' : 'times'}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setEditingTag(tag)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {confirmDeleteTagId === tag.id ? (
                                <>
                                  <button onClick={() => { deleteTag(tag.id); setConfirmDeleteTagId(null); }}
                                    title={zh ? '从所有艺人中移除该标签' : 'Removes it from all artists'}
                                    className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs whitespace-nowrap transition">
                                    {zh ? '确认删除' : 'Delete'}
                                  </button>
                                  <button onClick={() => setConfirmDeleteTagId(null)}
                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs whitespace-nowrap transition">
                                    {zh ? '取消' : 'Cancel'}
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDeleteTagId(tag.id)}
                                  aria-label={zh ? `删除标签 ${tag.name}` : `Delete tag ${tag.name}`}
                                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Dialog */}
      <AnimatePresence>
        {selectedArtist && <ArtistDetailDialog artist={selectedArtist} lang={lang} onClose={() => setSelectedArtist(null)} />}
      </AnimatePresence>
    </div>
  );
};
