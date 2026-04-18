"use client";

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import {
  Sparkles, Plus, Edit3, Trash2, Star, Crown, Zap, Search,
  Filter, ArrowLeft, Eye, Music, TrendingUp, Award, Users,
  Film, Tv, ShoppingBag, Mic2, Theater, GraduationCap, Gamepad2
} from 'lucide-react';
import { ArtistEditor } from './ArtistEditor';

interface Artist {
  id: string;
  name: string;
  avatar: string;
  type: 'singer' | 'actor' | 'variety' | 'comedian' | 'host' | 'all-round'; // 艺人类型
  status: 'trainee' | 'debut' | 'active' | 'rest' | 'retired';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  level: number; // 艺人等级
  experience: number; // 经验值
  createdAt: Date;
  
  // 才艺能力
  talents: {
    singing: number;    // 唱功 0-100
    acting: number;     // 演技 0-100
    dancing: number;    // 舞蹈 0-100
    hosting: number;    // 主持 0-100
    comedy: number;     // 喜剧 0-100
    variety: number;    // 综艺感 0-100
  };
  
  // 统计数据
  stats: {
    songs: number;      // 歌曲数
    dramas: number;     // 剧集数
    ads: number;        // 广告数
    variety: number;    // 综艺数
    stage: number;      // 舞台数
    fans: number;       // 粉丝数
    popularity: number; // 人气值
    revenue: number;    // 总收入
  };
  
  // 商业数据
  commercial: {
    adValue: number;        // 广告价值
    monthlyRevenue: number; // 月收入
    endorsements: number;   // 代言数
  };
  
  tags: string[];
}

interface AIIncubatorProps {
  lang: 'zh' | 'en';
  onBack: () => void;
  activeSinger: any;
  personaParams: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
  setPersonaParams: (params: any) => void;
}

export function AIIncubator({ lang, onBack, activeSinger, personaParams, setPersonaParams }: AIIncubatorProps) {
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'singer' | 'actor' | 'variety' | 'comedian' | 'host' | 'all-round'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'trainee' | 'debut' | 'active' | 'rest'>('all');

  // 已孵化的艺人数据
  const [artistGallery, setArtistGallery] = useState<Artist[]>([
    {
      id: '1',
      name: lang === 'zh' ? '霓虹战士' : 'Neon Warrior',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      type: 'all-round',
      status: 'active',
      quality: 'legendary',
      level: 45,
      experience: 8900,
      createdAt: new Date('2026-03-15'),
      talents: { singing: 95, acting: 88, dancing: 92, hosting: 80, comedy: 75, variety: 90 },
      stats: { songs: 12, dramas: 3, ads: 8, variety: 15, stage: 20, fans: 582000, popularity: 95, revenue: 2580000 },
      commercial: { adValue: 850000, monthlyRevenue: 180000, endorsements: 5 },
      tags: ['全能', '顶流', 'EDM']
    },
    {
      id: '2',
      name: lang === 'zh' ? '云裳仙子' : 'Cloud Fairy',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      type: 'singer',
      status: 'active',
      quality: 'epic',
      level: 32,
      experience: 5200,
      createdAt: new Date('2026-03-20'),
      talents: { singing: 92, acting: 65, dancing: 78, hosting: 55, comedy: 40, variety: 60 },
      stats: { songs: 18, dramas: 1, ads: 4, variety: 8, stage: 12, fans: 321000, popularity: 88, revenue: 1200000 },
      commercial: { adValue: 450000, monthlyRevenue: 95000, endorsements: 3 },
      tags: ['歌手', '古风', '治愈系']
    },
    {
      id: '3',
      name: lang === 'zh' ? '午夜DJ' : 'Midnight DJ',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
      type: 'variety',
      status: 'active',
      quality: 'epic',
      level: 38,
      experience: 6800,
      createdAt: new Date('2026-03-10'),
      talents: { singing: 70, acting: 75, dancing: 80, hosting: 95, comedy: 88, variety: 98 },
      stats: { songs: 5, dramas: 2, ads: 12, variety: 28, stage: 8, fans: 423000, popularity: 90, revenue: 1850000 },
      commercial: { adValue: 680000, monthlyRevenue: 145000, endorsements: 7 },
      tags: ['综艺咖', '主持人', '搞笑']
    },
    {
      id: '4',
      name: lang === 'zh' ? '星际漂流' : 'Stellar Drift',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
      type: 'actor',
      status: 'debut',
      quality: 'rare',
      level: 18,
      experience: 2100,
      createdAt: new Date('2026-03-28'),
      talents: { singing: 55, acting: 85, dancing: 60, hosting: 45, comedy: 50, variety: 55 },
      stats: { songs: 2, dramas: 5, ads: 2, variety: 4, stage: 3, fans: 89000, popularity: 72, revenue: 380000 },
      commercial: { adValue: 120000, monthlyRevenue: 28000, endorsements: 1 },
      tags: ['演员', '新人', '潜力股']
    }
  ]);

  // 如果正在编辑，显示编辑器
  if (editingArtist) {
    return (
      <ArtistEditor
        lang={lang}
        artist={editingArtist}
        onBack={() => setEditingArtist(null)}
        onSave={(updatedArtist) => {
          setArtistGallery(prev => 
            prev.map(a => a.id === updatedArtist.id ? updatedArtist : a)
          );
          setEditingArtist(null);
        }}
        personaParams={personaParams}
        setPersonaParams={setPersonaParams}
      />
    );
  }

  // 筛选艺人
  const filteredArtists = artistGallery.filter(artist => {
    const matchSearch = artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       artist.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filterType === 'all' || artist.type === filterType;
    const matchStatus = filterStatus === 'all' || artist.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // 品质颜色
  const qualityColors = {
    common: 'text-gray-400 border-gray-400/30',
    rare: 'text-blue-400 border-blue-400/30',
    epic: 'text-purple-400 border-purple-400/30',
    legendary: 'text-yellow-400 border-yellow-400/30'
  };

  const qualityGlow = {
    common: 'shadow-gray-500/10',
    rare: 'shadow-blue-500/20',
    epic: 'shadow-purple-500/30',
    legendary: 'shadow-yellow-500/40'
  };

  // 状态颜色
  const statusColors = {
    trainee: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    debut: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    rest: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    retired: 'bg-red-500/20 text-red-300 border-red-500/30'
  };

  // 艺人类型
  const artistTypes = [
    { id: 'all', label: lang === 'zh' ? '全部' : 'All', icon: Users },
    { id: 'singer', label: lang === 'zh' ? '歌手' : 'Singer', icon: Music },
    { id: 'actor', label: lang === 'zh' ? '演员' : 'Actor', icon: Film },
    { id: 'variety', label: lang === 'zh' ? '综艺咖' : 'Variety', icon: Tv },
    { id: 'comedian', label: lang === 'zh' ? '喜剧人' : 'Comedian', icon: Mic2 },
    { id: 'host', label: lang === 'zh' ? '主持人' : 'Host', icon: Mic2 },
    { id: 'all-round', label: lang === 'zh' ? '全能艺人' : 'All-Round', icon: Crown }
  ];

  // 创建新艺人
  const createNewArtist = () => {
    const newArtist: Artist = {
      id: Date.now().toString(),
      name: lang === 'zh' ? '新艺人' : 'New Artist',
      avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400',
      type: 'singer',
      status: 'trainee',
      quality: 'common',
      level: 1,
      experience: 0,
      createdAt: new Date(),
      talents: { singing: 50, acting: 50, dancing: 50, hosting: 50, comedy: 50, variety: 50 },
      stats: { songs: 0, dramas: 0, ads: 0, variety: 0, stage: 0, fans: 0, popularity: 0, revenue: 0 },
      commercial: { adValue: 0, monthlyRevenue: 0, endorsements: 0 },
      tags: ['新人']
    };
    setArtistGallery(prev => [...prev, newArtist]);
    setEditingArtist(newArtist);
  };

  // 删除艺人
  const deleteArtist = (id: string) => {
    setArtistGallery(prev => prev.filter(a => a.id !== id));
  };

  // 艺人类型中文
  const getTypeLabel = (type: string) => {
    if (lang === 'en') return type;
    const map: any = {
      'singer': '歌手',
      'actor': '演员',
      'variety': '综艺咖',
      'comedian': '喜剧人',
      'host': '主持人',
      'all-round': '全能艺人'
    };
    return map[type] || type;
  };

  // 计算总统计
  const totalStats = {
    artists: artistGallery.length,
    active: artistGallery.filter(a => a.status === 'active').length,
    works: artistGallery.reduce((sum, a) => sum + a.stats.songs + a.stats.dramas + a.stats.ads + a.stats.variety, 0),
    fans: artistGallery.reduce((sum, a) => sum + a.stats.fans, 0),
    revenue: artistGallery.reduce((sum, a) => sum + a.stats.revenue, 0)
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold mb-4 uppercase tracking-widest">
            <Sparkles className="w-3 h-3"/> {lang === 'zh' ? 'AI艺人孵化中心' : 'AI Artist Incubator'}
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            {lang === 'zh' ? 'AI艺人孵化器' : 'AI Artist Incubator'}
          </h2>
          <p className="text-gray-400 text-sm">{lang === 'zh' ? '全能艺人培养平台 · 音乐 · 影视 · 综艺 · 商业' : 'All-Round Artist Platform · Music · Film · Variety · Commercial'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5 h-10 px-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {lang === 'zh' ? '返回' : 'Back'}
          </Button>
          <Button 
            onClick={createNewArtist}
            className="h-10 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            {lang === 'zh' ? '孵化新艺人' : 'Create New'}
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border-purple-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{totalStats.artists}</div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '总艺人' : 'Artists'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{totalStats.active}</div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '活跃中' : 'Active'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Award className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{totalStats.works}</div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '作品数' : 'Works'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border-pink-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                {(totalStats.fans / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '总粉丝' : 'Fans'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 border-yellow-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                ¥{(totalStats.revenue / 10000).toFixed(0)}W
              </div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '总收入' : 'Revenue'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder={lang === 'zh' ? '搜索艺���名称、标签...' : 'Search artist, tags...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/50 border-white/10 h-12 focus:border-purple-500/50"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
              size="sm"
              className={filterStatus === 'all' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'border-white/10 hover:bg-white/5'}
            >
              {lang === 'zh' ? '全部' : 'All'}
            </Button>
            <Button
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('active')}
              size="sm"
              className={filterStatus === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'border-white/10 hover:bg-white/5'}
            >
              {lang === 'zh' ? '活跃' : 'Active'}
            </Button>
            <Button
              variant={filterStatus === 'trainee' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('trainee')}
              size="sm"
              className={filterStatus === 'trainee' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'border-white/10 hover:bg-white/5'}
            >
              {lang === 'zh' ? '练习生' : 'Trainee'}
            </Button>
          </div>
        </div>

        {/* 艺人类型筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {artistTypes.map(type => {
            const Icon = type.icon;
            return (
              <Button
                key={type.id}
                variant={filterType === type.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type.id as any)}
                className={`flex-shrink-0 ${
                  filterType === type.id 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {type.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 艺人网格 */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
          {filteredArtists.map((artist, index) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`relative bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all group overflow-hidden ${qualityGlow[artist.quality]}`}>
                {/* 品质光晕 */}
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${
                  artist.quality === 'legendary' ? 'from-yellow-500/30 to-orange-500/30' :
                  artist.quality === 'epic' ? 'from-purple-500/30 to-pink-500/30' :
                  artist.quality === 'rare' ? 'from-blue-500/30 to-cyan-500/30' :
                  'from-gray-500/30 to-gray-600/30'
                } rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />

                <CardContent className="p-6 relative">
                  {/* 头像和基础信息 */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-2 border-white/20">
                        <AvatarImage src={artist.avatar} alt={artist.name} />
                        <AvatarFallback>{artist.name[0]}</AvatarFallback>
                      </Avatar>
                      {/* 等级标识 */}
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-[#0c0c0e] flex items-center justify-center">
                        <span className="text-xs font-black text-white">{artist.level}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-white mb-1 line-clamp-1">{artist.name}</h3>
                      <p className="text-sm text-gray-400 mb-2">{getTypeLabel(artist.type)}</p>
                      <Badge variant="outline" className={`text-xs ${statusColors[artist.status]}`}>
                        {artist.status === 'trainee' ? (lang === 'zh' ? '练习生' : 'Trainee') :
                         artist.status === 'debut' ? (lang === 'zh' ? '出道' : 'Debut') :
                         artist.status === 'active' ? (lang === 'zh' ? '活跃' : 'Active') :
                         (lang === 'zh' ? '休息' : 'Rest')}
                      </Badge>
                    </div>
                  </div>

                  {/* 品质星级 */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {[...Array(artist.quality === 'legendary' ? 5 : artist.quality === 'epic' ? 4 : artist.quality === 'rare' ? 3 : 2)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 fill-current ${qualityColors[artist.quality].split(' ')[0]}`} />
                    ))}
                  </div>

                  {/* 能力雷达 */}
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-black/40 border border-white/5">
                    <div className="text-center">
                      <div className="text-sm font-bold text-pink-400">{artist.talents.singing}</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '唱功' : 'Sing'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-cyan-400">{artist.talents.acting}</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '演技' : 'Act'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-purple-400">{artist.talents.variety}</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '综艺' : 'Variety'}</div>
                    </div>
                  </div>

                  {/* 业务统计 */}
                  <div className="grid grid-cols-4 gap-2 mb-4 p-3 rounded-lg bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/10">
                    <div className="text-center">
                      <div className="text-sm font-black text-white">{artist.stats.songs}</div>
                      <div className="text-xs text-gray-500"><Music className="w-3 h-3 mx-auto" /></div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-white">{artist.stats.dramas}</div>
                      <div className="text-xs text-gray-500"><Film className="w-3 h-3 mx-auto" /></div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-white">{artist.stats.ads}</div>
                      <div className="text-xs text-gray-500"><ShoppingBag className="w-3 h-3 mx-auto" /></div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-white">{artist.stats.variety}</div>
                      <div className="text-xs text-gray-500"><Tv className="w-3 h-3 mx-auto" /></div>
                    </div>
                  </div>

                  {/* 粉丝和收入 */}
                  <div className="flex justify-between items-center mb-4 p-2 rounded-lg bg-black/20">
                    <div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '粉丝' : 'Fans'}</div>
                      <div className="text-sm font-bold text-pink-400">{(artist.stats.fans / 1000).toFixed(1)}K</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '人气' : 'Pop'}</div>
                      <div className="text-sm font-bold text-yellow-400">{artist.stats.popularity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '月收入' : 'Revenue'}</div>
                      <div className="text-sm font-bold text-green-400">¥{(artist.commercial.monthlyRevenue / 1000).toFixed(0)}K</div>
                    </div>
                  </div>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {artist.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs border-white/20 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setEditingArtist(artist)}
                      className="flex-1 h-9 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      {lang === 'zh' ? '编辑' : 'Edit'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => deleteArtist(artist.id)}
                      className="h-9 px-3 border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-9 px-3 border-white/10 hover:bg-white/5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 空状态 */}
        {filteredArtists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full bg-purple-500/10 border-2 border-purple-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-12 h-12 text-purple-400/50" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {lang === 'zh' ? '暂无艺人' : 'No Artists Found'}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {lang === 'zh' ? '点击"孵化新艺人"开始培养你的第一位AI艺人' : 'Click "Create New" to incubate your first AI artist'}
            </p>
            <Button 
              onClick={createNewArtist}
              className="h-12 px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              {lang === 'zh' ? '孵化新艺人' : 'Create New Artist'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
