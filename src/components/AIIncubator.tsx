import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import {
  Sparkles, Plus, Edit3, Trash2, Star, Crown, Zap, Search,
  Filter, ArrowLeft, Eye, Music, TrendingUp, Award, Users
} from 'lucide-react';
import { SingerEditor } from './SingerEditor';

interface Singer {
  id: string;
  name: string;
  avatar: string;
  style: string;
  status: 'active' | 'draft' | 'archived';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date;
  stats: {
    songs: number;
    fans: number;
    popularity: number;
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
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'archived'>('all');

  // 已孵化的歌手数据
  const [singerGallery, setSingerGallery] = useState<Singer[]>([
    {
      id: '1',
      name: lang === 'zh' ? '霓虹战士' : 'Neon Warrior',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      style: lang === 'zh' ? '电子舞曲' : 'EDM',
      status: 'active',
      quality: 'legendary',
      createdAt: new Date('2026-03-15'),
      stats: { songs: 12, fans: 58200, popularity: 95 },
      tags: ['cyberpunk', 'edm', 'female']
    },
    {
      id: '2',
      name: lang === 'zh' ? '云裳仙子' : 'Cloud Fairy',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      style: lang === 'zh' ? '古风流行' : 'Ancient Pop',
      status: 'active',
      quality: 'epic',
      createdAt: new Date('2026-03-20'),
      stats: { songs: 8, fans: 32100, popularity: 88 },
      tags: ['traditional', 'pop', 'elegant']
    },
    {
      id: '3',
      name: lang === 'zh' ? '星际漂流' : 'Stellar Drift',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
      style: lang === 'zh' ? '太空摇滚' : 'Space Rock',
      status: 'draft',
      quality: 'rare',
      createdAt: new Date('2026-03-28'),
      stats: { songs: 3, fans: 8900, popularity: 72 },
      tags: ['rock', 'space', 'experimental']
    },
    {
      id: '4',
      name: lang === 'zh' ? '午夜DJ' : 'Midnight DJ',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
      style: lang === 'zh' ? '深宅电音' : 'Deep House',
      status: 'active',
      quality: 'epic',
      createdAt: new Date('2026-03-10'),
      stats: { songs: 15, fans: 42300, popularity: 90 },
      tags: ['house', 'electronic', 'party']
    }
  ]);

  // 如果正在编辑，显示编辑器
  if (editingSinger) {
    return (
      <SingerEditor
        lang={lang}
        singer={editingSinger}
        onBack={() => setEditingSinger(null)}
        onSave={(updatedSinger) => {
          setSingerGallery(prev => 
            prev.map(s => s.id === updatedSinger.id ? updatedSinger : s)
          );
          setEditingSinger(null);
        }}
        personaParams={personaParams}
        setPersonaParams={setPersonaParams}
      />
    );
  }

  // 筛选歌手
  const filteredSingers = singerGallery.filter(singer => {
    const matchSearch = singer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       singer.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       singer.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = filterStatus === 'all' || singer.status === filterStatus;
    return matchSearch && matchStatus;
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
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    draft: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    archived: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  };

  // 创建新歌手
  const createNewSinger = () => {
    const newSinger: Singer = {
      id: Date.now().toString(),
      name: lang === 'zh' ? '新歌手' : 'New Singer',
      avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400',
      style: lang === 'zh' ? '未定义' : 'Undefined',
      status: 'draft',
      quality: 'common',
      createdAt: new Date(),
      stats: { songs: 0, fans: 0, popularity: 0 },
      tags: ['new']
    };
    setSingerGallery(prev => [...prev, newSinger]);
    setEditingSinger(newSinger);
  };

  // 删除歌手
  const deleteSinger = (id: string) => {
    setSingerGallery(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Sparkles className="w-3 h-3"/> {lang === 'zh' ? 'AI孵化中心' : 'AI Incubator'}
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">{lang === 'zh' ? 'AI歌手孵化器' : 'AI Singer Incubator'}</h2>
          <p className="text-gray-400 text-sm">{lang === 'zh' ? '已孵化' : 'Incubated'}: {singerGallery.length} {lang === 'zh' ? '位歌手' : 'Singers'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5 h-10 px-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {lang === 'zh' ? '返回' : 'Back'}
          </Button>
          <Button 
            onClick={createNewSinger}
            className="h-10 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            {lang === 'zh' ? '创建新歌手' : 'Create New'}
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border-purple-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{singerGallery.length}</div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '总数' : 'Total'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{singerGallery.filter(s => s.status === 'active').length}</div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '活跃' : 'Active'}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 border-yellow-500/20 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <Music className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                {singerGallery.reduce((sum, s) => sum + s.stats.songs, 0)}
              </div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '作品' : 'Songs'}</div>
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
                {Math.round(singerGallery.reduce((sum, s) => sum + s.stats.fans, 0) / 1000)}K
              </div>
              <div className="text-xs text-gray-400">{lang === 'zh' ? '粉丝' : 'Fans'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder={lang === 'zh' ? '搜索歌手名称、风格、标签...' : 'Search singer, style, tags...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/50 border-white/10 h-12 focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            className={filterStatus === 'all' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'border-white/10 hover:bg-white/5'}
          >
            {lang === 'zh' ? '全部' : 'All'}
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('active')}
            className={filterStatus === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'border-white/10 hover:bg-white/5'}
          >
            {lang === 'zh' ? '活跃' : 'Active'}
          </Button>
          <Button
            variant={filterStatus === 'draft' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('draft')}
            className={filterStatus === 'draft' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'border-white/10 hover:bg-white/5'}
          >
            {lang === 'zh' ? '草稿' : 'Draft'}
          </Button>
        </div>
      </div>

      {/* 歌手网格 */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
          {filteredSingers.map((singer, index) => (
            <motion.div
              key={singer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`relative bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all group overflow-hidden ${qualityGlow[singer.quality]}`}>
                {/* 品质光晕 */}
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${
                  singer.quality === 'legendary' ? 'from-yellow-500/30 to-orange-500/30' :
                  singer.quality === 'epic' ? 'from-purple-500/30 to-pink-500/30' :
                  singer.quality === 'rare' ? 'from-blue-500/30 to-cyan-500/30' :
                  'from-gray-500/30 to-gray-600/30'
                } rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />

                <CardContent className="p-6 relative">
                  {/* 头像和状态 */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-2 border-white/20">
                        <AvatarImage src={singer.avatar} alt={singer.name} />
                        <AvatarFallback>{singer.name[0]}</AvatarFallback>
                      </Avatar>
                      {singer.quality === 'legendary' && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50 flex items-center justify-center animate-pulse">
                          <Crown className="w-4 h-4 text-yellow-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-white mb-1 line-clamp-1">{singer.name}</h3>
                      <p className="text-sm text-gray-400 mb-2">{singer.style}</p>
                      <Badge variant="outline" className={`text-xs ${statusColors[singer.status]}`}>
                        {singer.status === 'active' ? (lang === 'zh' ? '活跃' : 'Active') :
                         singer.status === 'draft' ? (lang === 'zh' ? '草稿' : 'Draft') :
                         (lang === 'zh' ? '归档' : 'Archived')}
                      </Badge>
                    </div>
                  </div>

                  {/* 品质标识 */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {[...Array(singer.quality === 'legendary' ? 5 : singer.quality === 'epic' ? 4 : singer.quality === 'rare' ? 3 : 2)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 fill-current ${qualityColors[singer.quality].split(' ')[0]}`} />
                    ))}
                    <span className={`text-xs font-bold ml-1 ${qualityColors[singer.quality].split(' ')[0]}`}>
                      {singer.quality.toUpperCase()}
                    </span>
                  </div>

                  {/* 统计数据 */}
                  <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-lg bg-black/40 border border-white/5">
                    <div className="text-center">
                      <div className="text-lg font-black text-white">{singer.stats.songs}</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '作品' : 'Songs'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black text-white">{(singer.stats.fans / 1000).toFixed(1)}K</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '粉丝' : 'Fans'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-black text-white">{singer.stats.popularity}</div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '人气' : 'Pop'}</div>
                    </div>
                  </div>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {singer.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs border-white/20 text-gray-400">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setEditingSinger(singer)}
                      className="flex-1 h-9 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      {lang === 'zh' ? '编辑' : 'Edit'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => deleteSinger(singer.id)}
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
        {filteredSingers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full bg-purple-500/10 border-2 border-purple-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-12 h-12 text-purple-400/50" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {lang === 'zh' ? '暂无歌手' : 'No Singers Found'}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {lang === 'zh' ? '点击"创建新歌手"开始孵化你的第一位AI歌手' : 'Click "Create New" to incubate your first AI singer'}
            </p>
            <Button 
              onClick={createNewSinger}
              className="h-12 px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              {lang === 'zh' ? '创建新歌手' : 'Create New Singer'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
