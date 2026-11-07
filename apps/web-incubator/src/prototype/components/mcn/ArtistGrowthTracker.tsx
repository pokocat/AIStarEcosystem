/**
 * ArtistGrowthTracker — 艺人成长档案
 * P4 新增：粉丝增长曲线 · 能力雷达图 · 里程碑时间线 · GMV轨迹 · 综合评级
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, Star, Users, Zap, Award, Calendar, CheckCircle2,
  BarChart3, Music, ShoppingBag, Eye, Heart, ArrowUpRight,
  ChevronRight, Sparkles, Target, Globe, Radio
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, LineChart, Line
} from 'recharts';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type ArtistId = 'zhang' | 'lin' | 'xiao';

interface Artist {
  id: ArtistId; name: string; nameEn: string;
  level: 'S' | 'A' | 'B'; followers: string; followersNum: number;
  joinDate: string; category: string; categoryEn: string;
  overallScore: number; growthRank: number;
  avatarColor: [string, string];
}

interface Milestone {
  date: string; title: string; titleEn: string;
  type: 'fans' | 'collab' | 'video' | 'award' | 'gmv' | 'platform';
  value?: string; icon: React.ComponentType<any>;
}

// ─── Mock Data ────────────────────────────────────────────────────
const ARTISTS: Artist[] = [
  { id: 'zhang', name: '沈亦舟', nameEn: 'Shen Yizhou', level: 'A', followers: '1,280万', followersNum: 12800000, joinDate: '2023-06-01', category: '音乐/时尚', categoryEn: 'Music/Fashion', overallScore: 88, growthRank: 1, avatarColor: ['#ec4899', '#a855f7'] },
  { id: 'lin',   name: '林音宝', nameEn: 'Lin Yin Bao',   level: 'A', followers: '920万',   followersNum: 9200000,  joinDate: '2024-01-15', category: '护肤/生活', categoryEn: 'Skincare/Lifestyle', overallScore: 82, growthRank: 2, avatarColor: ['#10b981', '#06b6d4'] },
  { id: 'xiao',  name: '顾星辰',   nameEn: 'Gu Xingchen',     level: 'S', followers: '4,530万',  followersNum: 45300000, joinDate: '2022-03-10', category: '影视/品牌', categoryEn: 'Film/Brand', overallScore: 96, growthRank: 3, avatarColor: ['#f59e0b', '#ef4444'] },
];

const FAN_GROWTH: Record<ArtistId, { month: string; fans: number; new: number }[]> = {
  zhang: [
    { month: '2025/1', fans: 820, new: 24 }, { month: '2025/2', fans: 880, new: 60 },
    { month: '2025/3', fans: 960, new: 80 }, { month: '2025/4', fans: 1080, new: 120 },
    { month: '2025/5', fans: 1180, new: 100 }, { month: '2025/6', fans: 1280, new: 100 },
  ],
  lin: [
    { month: '2025/1', fans: 580, new: 30 }, { month: '2025/2', fans: 640, new: 60 },
    { month: '2025/3', fans: 720, new: 80 }, { month: '2025/4', fans: 800, new: 80 },
    { month: '2025/5', fans: 860, new: 60 }, { month: '2025/6', fans: 920, new: 60 },
  ],
  xiao: [
    { month: '2025/1', fans: 3800, new: 120 }, { month: '2025/2', fans: 3980, new: 180 },
    { month: '2025/3', fans: 4120, new: 140 }, { month: '2025/4', fans: 4280, new: 160 },
    { month: '2025/5', fans: 4400, new: 120 }, { month: '2025/6', fans: 4530, new: 130 },
  ],
};

const ABILITY_RADAR: Record<ArtistId, { subject: string; value: number; fullMark: number }[]> = {
  zhang: [
    { subject: '演唱力', value: 88, fullMark: 100 },
    { subject: '颜值', value: 92, fullMark: 100 },
    { subject: '口才', value: 75, fullMark: 100 },
    { subject: '带货力', value: 80, fullMark: 100 },
    { subject: '热度', value: 85, fullMark: 100 },
    { subject: '商业价值', value: 82, fullMark: 100 },
  ],
  lin: [
    { subject: '演唱力', value: 62, fullMark: 100 },
    { subject: '颜值', value: 90, fullMark: 100 },
    { subject: '口才', value: 88, fullMark: 100 },
    { subject: '带货力', value: 92, fullMark: 100 },
    { subject: '热度', value: 75, fullMark: 100 },
    { subject: '商业价值', value: 78, fullMark: 100 },
  ],
  xiao: [
    { subject: '演唱力', value: 90, fullMark: 100 },
    { subject: '颜值', value: 96, fullMark: 100 },
    { subject: '口才', value: 88, fullMark: 100 },
    { subject: '带货力', value: 94, fullMark: 100 },
    { subject: '热度', value: 98, fullMark: 100 },
    { subject: '商业价值', value: 96, fullMark: 100 },
  ],
};

const GMV_HISTORY: Record<ArtistId, { month: string; gmv: number }[]> = {
  zhang: [
    { month: '1月', gmv: 28 }, { month: '2月', gmv: 35 }, { month: '3月', gmv: 42 },
    { month: '4月', gmv: 58 }, { month: '5月', gmv: 48 }, { month: '6月', gmv: 62 },
  ],
  lin: [
    { month: '1月', gmv: 18 }, { month: '2月', gmv: 22 }, { month: '3月', gmv: 30 },
    { month: '4月', gmv: 35 }, { month: '5月', gmv: 28 }, { month: '6月', gmv: 38 },
  ],
  xiao: [
    { month: '1月', gmv: 120 }, { month: '2月', gmv: 180 }, { month: '3月', gmv: 160 },
    { month: '4月', gmv: 240 }, { month: '5月', gmv: 200 }, { month: '6月', gmv: 280 },
  ],
};

const MILESTONES: Record<ArtistId, Milestone[]> = {
  zhang: [
    { date: '2025-06-15', title: '抖音粉丝突破1000万', titleEn: 'DY fans hit 10M', type: 'fans', value: '1,000万', icon: Users },
    { date: '2025-05-01', title: '《星河》MV上线48小时破亿播放', titleEn: '"Starry River" MV 100M views in 48h', type: 'video', value: '1亿播放', icon: Eye },
    { date: '2025-04-12', title: '品牌代言·极速数码618专属', titleEn: 'Brand deal: Speed Digital 618', type: 'collab', value: '¥120万', icon: Zap },
    { date: '2025-03-20', title: '入选平台年度成长艺人TOP10', titleEn: 'Listed Top 10 Growth Artists', type: 'award', icon: Award },
    { date: '2025-02-08', title: '单月带货GMV突破50万', titleEn: 'Monthly GMV exceeded ¥500K', type: 'gmv', value: '¥50万', icon: ShoppingBag },
    { date: '2023-06-01', title: '签约MCN，正式开启AI艺人孵化', titleEn: 'Signed with MCN, AI artist incubation begins', type: 'platform', icon: Star },
  ],
  lin: [
    { date: '2025-05-20', title: '护肤品联名爆款单品GMV破百万', titleEn: 'Skincare collab product GMV hit ¥1M', type: 'gmv', value: '¥100万', icon: ShoppingBag },
    { date: '2025-04-01', title: '小红书粉丝突破500万', titleEn: 'XHS fans hit 5M', type: 'fans', value: '500万', icon: Users },
    { date: '2025-03-10', title: 'AI数字人直播首秀，在线峰值10万', titleEn: 'AI Digital Human live debut, 100K peak viewers', type: 'video', value: '10万峰值', icon: Radio },
    { date: '2024-01-15', title: '入驻平台，完成IP授权全套', titleEn: 'Joined platform, completed full IP authorization', type: 'platform', icon: Star },
  ],
  xiao: [
    { date: '2025-06-01', title: '入选全国艺人影响力指数S级', titleEn: 'Ranked S-Class in National Artist Influence Index', type: 'award', icon: Award },
    { date: '2025-04-20', title: '跃锋代言正式落地，合同金额580万', titleEn: 'Yuefeng endorsement signed, ¥5.8M contract', type: 'collab', value: '¥580万', icon: Zap },
    { date: '2025-03-05', title: '全网总粉丝突破4500万', titleEn: 'Total cross-platform fans hit 45M', type: 'fans', value: '4500万', icon: Users },
    { date: '2025-01-18', title: '《星辰大海》电影票房破8亿', titleEn: 'Film "Starry Ocean" gross ¥800M', type: 'video', value: '8亿票房', icon: Music },
    { date: '2022-03-10', title: '签约MCN，S级艺人资质认证', titleEn: 'Signed with MCN, S-class artist certification', type: 'platform', icon: Star },
  ],
};

const MILESTONE_TYPE_COLOR: Record<string, string> = {
  fans: '#06b6d4', collab: '#f59e0b', video: '#a855f7',
  award: '#22c55e', gmv: '#ec4899', platform: '#6366f1',
};

interface Props { lang: Lang; }

export const ArtistGrowthTracker = ({ lang }: Props) => {
  const zh = lang === 'zh';
  const [selectedArtist, setSelectedArtist] = useState<ArtistId>('zhang');
  const [tab, setTab] = useState<'overview' | 'radar' | 'gmv' | 'milestones'>('overview');

  const artist = ARTISTS.find(a => a.id === selectedArtist)!;
  const fanData = FAN_GROWTH[selectedArtist];
  const radarData = ABILITY_RADAR[selectedArtist];
  const gmvData = GMV_HISTORY[selectedArtist];
  const milestones = MILESTONES[selectedArtist];
  const lCfg = { S: '#f59e0b', A: '#06b6d4', B: '#6b7280' }[artist.level];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '艺人成长档案' : 'Artist Growth Tracker'}
        </h1>
        <p className="text-xs text-gray-500 mt-1">{zh ? '粉丝曲线 · 能力雷达 · GMV轨迹 · 里程碑时间线' : 'Fan curve · Ability radar · GMV trail · Milestone timeline'}</p>
      </div>

      {/* Artist Selector */}
      <div className="flex gap-3 flex-wrap">
        {ARTISTS.map(a => {
          const isActive = selectedArtist === a.id;
          const aColor = a.level === 'S' ? '#f59e0b' : a.level === 'A' ? '#06b6d4' : '#6b7280';
          return (
            <motion.button key={a.id} onClick={() => setSelectedArtist(a.id)} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition"
              style={isActive ? { background: `${aColor}10`, borderColor: `${aColor}35` } : { background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                style={{ background: `linear-gradient(135deg, ${a.avatarColor[0]}, ${a.avatarColor[1]})`, color: '#fff' }}>
                {a.name.slice(0, 1)}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color: isActive ? '#0f172a' : '#6b7280' }}>{a.name}</span>
                  <span className="text-[9px] font-black px-1 rounded" style={{ background: `${aColor}20`, color: aColor }}>{a.level}</span>
                </div>
                <div className="text-[9px]" style={{ color: isActive ? aColor : '#4b5563' }}>{a.followers}</div>
              </div>
              {isActive && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: aColor }}>
                  <CheckCircle2 className="w-3 h-3 text-black" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Artist Profile Card */}
      <motion.div key={selectedArtist} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${artist.avatarColor[0]}, ${artist.avatarColor[1]})` }}>
            {artist.name.slice(0, 1)}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xl font-black text-white">{zh ? artist.name : artist.nameEn}</span>
              <span className="text-xs font-black px-2 py-0.5 rounded-lg" style={{ background: `${lCfg}20`, color: lCfg }}>{artist.level}{zh ? '级艺人' : '-Class'}</span>
              <span className="text-xs text-gray-500">{zh ? artist.category : artist.categoryEn}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
              <span>{zh ? '入驻：' : 'Since: '}{artist.joinDate}</span>
              <span>{zh ? '全平台粉丝：' : 'Total fans: '}<span className="text-white font-bold">{artist.followers}</span></span>
              <span>{zh ? '成长排名：' : 'Growth rank: '}<span className="text-amber-400 font-bold">#{artist.growthRank}</span></span>
            </div>
          </div>
          {/* Overall Score */}
          <div className="text-center shrink-0">
            <div className="text-4xl font-black" style={{ color: lCfg, fontFamily: 'var(--font-display)' }}>{artist.overallScore}</div>
            <div className="text-[10px] text-gray-500">{zh ? '综合评分' : 'Overall Score'}</div>
            <div className="mt-1.5 w-20 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${artist.overallScore}%`, background: lCfg }} />
            </div>
          </div>
        </div>

        {/* Ability quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-5">
          {radarData.map((r, i) => (
            <div key={i} className="text-center p-2 bg-black/30 rounded-xl">
              <div className="text-[9px] text-gray-600 mb-1">{r.subject}</div>
              <div className="text-sm font-black" style={{ color: lCfg }}>{r.value}</div>
              <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.value}%`, background: lCfg }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {([
          ['overview',   zh ? '粉丝增长' : 'Fan Growth',  TrendingUp],
          ['radar',      zh ? '能力雷达' : 'Ability Radar', Target],
          ['gmv',        zh ? 'GMV轨迹' : 'GMV Trail',    ShoppingBag],
          ['milestones', zh ? '里程碑' : 'Milestones',    Award],
        ] as const).map(([t, label, Ic]) => {
          const TabIc = Ic;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${tab === t ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <TabIc className="w-3.5 h-3.5" />{label}
            </button>
          );
        })}
      </div>

      {/* ─── Fan Growth ─── */}
      {tab === 'overview' && (
        <motion.div key="fan" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{zh ? '粉丝增长趋势（万）' : 'Fan Growth Trend (10K)'}</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              {zh ? `近6月净增 ${fanData[fanData.length-1].fans - fanData[0].fans}万` : `+${fanData[fanData.length-1].fans - fanData[0].fans}K last 6mo`}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fanData}>
                <defs>
                  <linearGradient id="fanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lCfg} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={lCfg} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                <Area type="monotone" dataKey="fans" stroke={lCfg} fill="url(#fanGrad)" strokeWidth={2} dot={false} name={zh ? '累计粉丝(万)' : 'Total fans(K)'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Monthly new fans */}
          <div className="mt-4 grid grid-cols-6 gap-2">
            {fanData.map((d, i) => (
              <div key={i} className="text-center p-2 bg-black/20 rounded-xl">
                <div className="text-[8px] text-gray-600">{d.month.split('/')[1]}{zh ? '月' : 'M'}</div>
                <div className="text-[10px] font-bold text-emerald-400">+{d.new}</div>
                <div className="text-[9px] text-gray-500">{zh ? '新增' : 'New'}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Ability Radar ─── */}
      {tab === 'radar' && (
        <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">{zh ? '综合能力雷达图' : 'Ability Radar'}</h3>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="h-72 w-full max-w-sm mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 8 }} angle={90} domain={[0, 100]} />
                  <Radar name={artist.name} dataKey="value" stroke={lCfg} fill={lCfg} fillOpacity={0.15} strokeWidth={2} dot={{ fill: lCfg, r: 4 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {radarData.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400 w-16 shrink-0">{r.subject}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${r.value}%` }} transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="h-full rounded-full" style={{ background: lCfg }} />
                  </div>
                  <span className="text-[10px] font-bold w-7 text-right" style={{ color: lCfg }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── GMV Trail ─── */}
      {tab === 'gmv' && (
        <motion.div key="gmv" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-gray-900/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{zh ? 'GMV月度轨迹（万元）' : 'Monthly GMV Trail (¥10K)'}</h3>
            <div className="text-[10px] text-emerald-400">
              {zh ? `近6月总GMV ¥${gmvData.reduce((s, d) => s + d.gmv, 0)}万` : `6-mo total ¥${gmvData.reduce((s, d) => s + d.gmv, 0)}K`}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gmvData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }}
                  formatter={(v: any) => [`¥${v}万`, 'GMV']} />
                <Bar dataKey="gmv" fill={lCfg} radius={[6, 6, 0, 0]} name="GMV(万)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ─── Milestones ─── */}
      {tab === 'milestones' && (
        <motion.div key="ms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">{zh ? '成长里程碑时间线' : 'Growth Milestone Timeline'}</div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/5" />
            <div className="space-y-3">
              {milestones.map((ms, i) => {
                const MIcon = ms.icon;
                const mColor = MILESTONE_TYPE_COLOR[ms.type] || '#6b7280';
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="flex gap-4 pl-2 relative">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2"
                      style={{ background: `${mColor}15`, borderColor: `${mColor}35` }}>
                      <MIcon className="w-3.5 h-3.5" style={{ color: mColor }} />
                    </div>
                    <div className="flex-1 bg-gray-900/50 border border-white/5 rounded-xl p-3 hover:border-white/12 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-white">{zh ? ms.title : ms.titleEn}</div>
                          <div className="text-[9px] text-gray-600 mt-0.5">{ms.date}</div>
                        </div>
                        {ms.value && (
                          <div className="text-[10px] font-black shrink-0" style={{ color: mColor }}>{ms.value}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
