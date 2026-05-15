"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@ai-star-eco/ui/ui/card';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Badge } from '@ai-star-eco/ui/ui/badge';
import { Input } from '@ai-star-eco/ui/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ai-star-eco/ui/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@ai-star-eco/ui/ui/avatar';
import { Progress } from '@ai-star-eco/ui/ui/progress';
import {
  Megaphone, Music, Film, Tv, ShoppingBag, Mic2, Trophy, Calendar,
  Clock, DollarSign, Star, TrendingUp, Zap, Target, Award, CheckCircle2,
  AlertCircle, Filter, Search, ChevronRight, Flame, Crown, Sparkles,
  Users, Eye, Heart, MessageSquare, Share2, Play, Briefcase, Gift,
  Rocket, BarChart3, Timer, MapPin, Tag, ArrowRight, RefreshCw
} from 'lucide-react';
import type { Artist } from "@ai-star-eco/types/artist";

interface Notice {
  id: string;
  type: 'music' | 'film' | 'variety' | 'ad' | 'voice' | 'stage' | 'special';
  title: string;
  client: string;
  description: string;
  requirements: {
    minLevel: number;
    talents: { [key: string]: number };
    experience?: string;
  };
  reward: number;
  bonus?: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  deadline: Date;
  duration: string;
  slots: number;
  slotsLeft: number;
  hot: boolean;
  featured: boolean;
  tags: string[];
}

interface NoticeBoardProps {
  lang: 'zh' | 'en';
  artist: Artist;
  onBack: () => void;
}

export function NoticeBoard({ lang, artist, onBack }: NoticeBoardProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  // 通告数据
  const notices: Notice[] = [
    {
      id: '1',
      type: 'music',
      title: lang === 'zh' ? '赛博朋克新单曲录制' : 'Cyberpunk Single Recording',
      client: 'Neon Records',
      description: lang === 'zh' 
        ? '需要一位有电子音乐风格的歌手录制一首赛博朋克主题单曲，要求声线有科技感，能够驾驭快节奏。'
        : 'Need a singer with electronic music style to record a cyberpunk themed single. Tech-style voice required, fast tempo.',
      requirements: {
        minLevel: 5,
        talents: { singing: 70, dancing: 50 },
        experience: lang === 'zh' ? '至少1首电子音乐作品' : 'At least 1 electronic music work'
      },
      reward: 35000,
      bonus: 15000,
      difficulty: 'medium',
      deadline: new Date('2026-04-15'),
      duration: '3天',
      slots: 1,
      slotsLeft: 1,
      hot: true,
      featured: true,
      tags: ['电子', '快节奏', '科技感']
    },
    {
      id: '2',
      type: 'film',
      title: lang === 'zh' ? '都市爱情短剧女主' : 'Urban Romance Drama Lead',
      client: 'StarLight Media',
      description: lang === 'zh'
        ? '12集都市爱情短剧招募女主角，需要有清纯甜美的形象，演技自然，档期充足。'
        : '12-episode urban romance drama seeking female lead. Sweet image required, natural acting, sufficient schedule.',
      requirements: {
        minLevel: 8,
        talents: { acting: 75, variety: 60 },
        experience: lang === 'zh' ? '至少2部短剧经验' : 'At least 2 drama series'
      },
      reward: 120000,
      bonus: 50000,
      difficulty: 'hard',
      deadline: new Date('2026-04-20'),
      duration: '15天',
      slots: 1,
      slotsLeft: 1,
      hot: true,
      featured: true,
      tags: ['都市', '甜宠', '女主']
    },
    {
      id: '3',
      type: 'ad',
      title: lang === 'zh' ? 'NeuroTech品牌代言人' : 'NeuroTech Brand Ambassador',
      client: 'NeuroTech Inc.',
      description: lang === 'zh'
        ? '科技品牌寻找年度代言人，需要拍摄TVC广告、平面广告及社交媒体内容，要求形象时尚科技。'
        : 'Tech brand seeking annual ambassador. TVC, print ads, social media content required. Modern tech image.',
      requirements: {
        minLevel: 10,
        talents: { variety: 70 },
        experience: lang === 'zh' ? '至少5个广告作品' : 'At least 5 ad works'
      },
      reward: 280000,
      bonus: 120000,
      difficulty: 'expert',
      deadline: new Date('2026-04-18'),
      duration: '30天',
      slots: 1,
      slotsLeft: 1,
      hot: true,
      featured: true,
      tags: ['年度代言', '科技', '高预算']
    },
    {
      id: '4',
      type: 'variety',
      title: lang === 'zh' ? '《星际选秀》常驻嘉宾' : 'Star Audition Regular Guest',
      client: 'Galaxy TV',
      description: lang === 'zh'
        ? '大型选秀综艺招募常驻嘉宾，需要有综艺感，能够活跃气氛，与选手互动。'
        : 'Major talent show seeking regular guest. Variety sense required, lively atmosphere, interact with contestants.',
      requirements: {
        minLevel: 6,
        talents: { variety: 80, hosting: 65 },
      },
      reward: 95000,
      bonus: 35000,
      difficulty: 'medium',
      deadline: new Date('2026-04-22'),
      duration: '10天',
      slots: 3,
      slotsLeft: 2,
      hot: false,
      featured: false,
      tags: ['综艺', '常驻', '选秀']
    },
    {
      id: '5',
      type: 'voice',
      title: lang === 'zh' ? '科幻动画配音' : 'Sci-Fi Animation Voice',
      client: 'Cosmos Animation',
      description: lang === 'zh'
        ? '120分钟科幻动画需要女主角配音，要求声音清澈有辨识度，能够表达多种情绪。'
        : '120-min sci-fi animation needs female lead voice. Clear, distinctive voice required, multiple emotions.',
      requirements: {
        minLevel: 4,
        talents: { singing: 60 },
      },
      reward: 45000,
      difficulty: 'easy',
      deadline: new Date('2026-04-25'),
      duration: '5天',
      slots: 1,
      slotsLeft: 1,
      hot: false,
      featured: false,
      tags: ['配音', '动画', '科幻']
    },
    {
      id: '6',
      type: 'music',
      title: lang === 'zh' ? '演唱会开场嘉宾' : 'Concert Opening Guest',
      client: 'Live Nation',
      description: lang === 'zh'
        ? '大型演唱会招募开场嘉宾，需要演唱3首歌曲，有舞台经验优先。'
        : 'Major concert seeking opening act. 3 songs required, stage experience preferred.',
      requirements: {
        minLevel: 7,
        talents: { singing: 75, dancing: 70 },
        experience: lang === 'zh' ? '至少1场演唱会经验' : 'At least 1 concert'
      },
      reward: 65000,
      bonus: 25000,
      difficulty: 'medium',
      deadline: new Date('2026-04-12'),
      duration: '1天',
      slots: 2,
      slotsLeft: 1,
      hot: true,
      featured: false,
      tags: ['演唱会', '舞台', '现场']
    },
    {
      id: '7',
      type: 'special',
      title: lang === 'zh' ? '⚡ 限时急单：MV拍摄' : '⚡ Urgent: MV Shooting',
      client: 'Quick Media',
      description: lang === 'zh'
        ? '因演员档期问题，急需一位女歌手完成MV拍摄，风格为清新民谣，明天即可开拍。'
        : 'Due to schedule conflict, urgently need female singer for MV. Fresh folk style, shooting tomorrow.',
      requirements: {
        minLevel: 5,
        talents: { singing: 65, acting: 55 },
      },
      reward: 42000,
      bonus: 18000,
      difficulty: 'medium',
      deadline: new Date('2026-04-09'),
      duration: '2天',
      slots: 1,
      slotsLeft: 1,
      hot: true,
      featured: true,
      tags: ['急单', '2倍奖励', 'MV']
    },
    {
      id: '8',
      type: 'stage',
      title: lang === 'zh' ? '音乐节表演嘉宾' : 'Music Festival Performer',
      client: 'Cyber Fest',
      description: lang === 'zh'
        ? '赛博朋克音乐节招募表演嘉宾，表演时长30分钟，有电子音乐风格优先。'
        : 'Cyberpunk music festival seeking performers. 30-min performance, electronic music style preferred.',
      requirements: {
        minLevel: 6,
        talents: { singing: 70, dancing: 65 },
      },
      reward: 58000,
      bonus: 22000,
      difficulty: 'medium',
      deadline: new Date('2026-04-16'),
      duration: '1天',
      slots: 5,
      slotsLeft: 3,
      hot: false,
      featured: false,
      tags: ['音乐节', '电子', '舞台']
    }
  ];

  // 过滤通告
  const filteredNotices = notices.filter(notice => {
    if (activeTab !== 'all' && notice.type !== activeTab) return false;
    if (searchQuery && !notice.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // 检查是否符合要求
  const checkRequirements = (notice: Notice) => {
    const results = {
      level: artist.level >= notice.requirements.minLevel,
      talents: Object.entries(notice.requirements.talents || {}).map(([key, value]) => ({
        key,
        required: value,
        current: artist.talents[key] || 0,
        passed: (artist.talents[key] || 0) >= value
      }))
    };
    const allPassed = results.level && results.talents.every(t => t.passed);
    return { ...results, allPassed };
  };

  const typeColors: { [key: string]: string } = {
    music: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    film: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    variety: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    ad: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    voice: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    stage: 'bg-green-500/20 text-green-300 border-green-500/30',
    special: 'bg-red-500/20 text-red-300 border-red-500/30'
  };

  const difficultyColors: { [key: string]: string } = {
    easy: 'bg-green-500/20 text-green-300 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    hard: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    expert: 'bg-red-500/20 text-red-300 border-red-500/30'
  };

  const typeIcons: { [key: string]: any } = {
    music: Music,
    film: Film,
    variety: Tv,
    ad: ShoppingBag,
    voice: Mic2,
    stage: Trophy,
    special: Zap
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border-pink-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Megaphone className="w-5 h-5 text-pink-400" />
              <Badge variant="outline" className="text-pink-400 border-pink-400/30 text-xs">
                {lang === 'zh' ? '今日' : 'Today'}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{notices.length}</div>
            <div className="text-xs text-gray-400">{lang === 'zh' ? '全部通告' : 'Total Notices'}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border-orange-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <TrendingUp className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">{notices.filter(n => n.hot).length}</div>
            <div className="text-xs text-gray-400">{lang === 'zh' ? '热门通告' : 'Hot Notices'}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {notices.filter(n => checkRequirements(n).allPassed).length}
            </div>
            <div className="text-xs text-gray-400">{lang === 'zh' ? '可接通告' : 'Available'}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <Sparkles className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              ¥{(notices.reduce((sum, n) => sum + n.reward, 0) / 10000).toFixed(0)}W
            </div>
            <div className="text-xs text-gray-400">{lang === 'zh' ? '总价值' : 'Total Value'}</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={lang === 'zh' ? '搜索通告...' : 'Search notices...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/50 border-white/10"
          />
        </div>
        <Button variant="outline" className="border-white/10 hover:bg-white/5">
          <Filter className="w-4 h-4 mr-2" />
          {lang === 'zh' ? '筛选' : 'Filter'}
        </Button>
        <Button variant="outline" className="border-white/10 hover:bg-white/5">
          <RefreshCw className="w-4 h-4 mr-2" />
          {lang === 'zh' ? '刷新' : 'Refresh'}
        </Button>
      </div>

      {/* 主内容Tab */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="bg-black/60 border border-white/5 rounded-xl p-1.5 gap-1.5 mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white/10 whitespace-nowrap">
              {lang === 'zh' ? '全部' : 'All'} ({notices.length})
            </TabsTrigger>
            <TabsTrigger value="music" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 whitespace-nowrap">
              <Music className="w-3 h-3 mr-1" />
              {lang === 'zh' ? '音乐' : 'Music'}
            </TabsTrigger>
            <TabsTrigger value="film" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 whitespace-nowrap">
              <Film className="w-3 h-3 mr-1" />
              {lang === 'zh' ? '影视' : 'Film'}
            </TabsTrigger>
            <TabsTrigger value="variety" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 whitespace-nowrap">
              <Tv className="w-3 h-3 mr-1" />
              {lang === 'zh' ? '综艺' : 'Variety'}
            </TabsTrigger>
            <TabsTrigger value="ad" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 whitespace-nowrap">
              <ShoppingBag className="w-3 h-3 mr-1" />
              {lang === 'zh' ? '广告' : 'Ads'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredNotices.map((notice, index) => {
                  const Icon = typeIcons[notice.type];
                  const requirements = checkRequirements(notice);
                  
                  return (
                    <motion.div
                      key={notice.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={`bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer ${
                          notice.featured ? 'ring-2 ring-yellow-500/30' : ''
                        }`}
                        onClick={() => setSelectedNotice(notice)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            {/* 左侧图标 */}
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              notice.type === 'music' ? 'bg-gradient-to-br from-pink-500 to-purple-500' :
                              notice.type === 'film' ? 'bg-gradient-to-br from-cyan-500 to-blue-500' :
                              notice.type === 'variety' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                              notice.type === 'ad' ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                              notice.type === 'voice' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                              notice.type === 'stage' ? 'bg-gradient-to-br from-green-500 to-cyan-500' :
                              'bg-gradient-to-br from-red-500 to-pink-500'
                            }`}>
                              <Icon className="w-8 h-8 text-white" />
                            </div>

                            {/* 右侧内容 */}
                            <div className="flex-1 min-w-0">
                              {/* 标题行 */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-white line-clamp-1">{notice.title}</h3>
                                    {notice.hot && (
                                      <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs">
                                        <Flame className="w-3 h-3 mr-1" />
                                        HOT
                                      </Badge>
                                    )}
                                    {notice.featured && (
                                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                                        <Crown className="w-3 h-3 mr-1" />
                                        {lang === 'zh' ? '精选' : 'Featured'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <Badge variant="outline" className={`text-xs ${typeColors[notice.type]}`}>
                                      {notice.type === 'music' ? (lang === 'zh' ? '音乐' : 'Music') :
                                       notice.type === 'film' ? (lang === 'zh' ? '影视' : 'Film') :
                                       notice.type === 'variety' ? (lang === 'zh' ? '综艺' : 'Variety') :
                                       notice.type === 'ad' ? (lang === 'zh' ? '广告' : 'Ad') :
                                       notice.type === 'voice' ? (lang === 'zh' ? '配音' : 'Voice') :
                                       notice.type === 'stage' ? (lang === 'zh' ? '舞台' : 'Stage') :
                                       (lang === 'zh' ? '特殊' : 'Special')}
                                    </Badge>
                                    <span>·</span>
                                    <span>{notice.client}</span>
                                  </div>
                                </div>
                                <Badge variant="outline" className={`text-xs whitespace-nowrap ${difficultyColors[notice.difficulty]}`}>
                                  {notice.difficulty === 'easy' ? (lang === 'zh' ? '简单' : 'Easy') :
                                   notice.difficulty === 'medium' ? (lang === 'zh' ? '中等' : 'Medium') :
                                   notice.difficulty === 'hard' ? (lang === 'zh' ? '困难' : 'Hard') :
                                   (lang === 'zh' ? '专家' : 'Expert')}
                                </Badge>
                              </div>

                              {/* 描述 */}
                              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{notice.description}</p>

                              {/* 标签 */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                {notice.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs border-white/10 text-gray-400">
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>

                              {/* 信息网格 */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">{lang === 'zh' ? '报酬' : 'Reward'}</div>
                                  <div className="text-sm font-bold text-green-400">¥{(notice.reward / 1000).toFixed(1)}K</div>
                                </div>
                                {notice.bonus && (
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">{lang === 'zh' ? '奖金' : 'Bonus'}</div>
                                    <div className="text-sm font-bold text-yellow-400">+¥{(notice.bonus / 1000).toFixed(1)}K</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">{lang === 'zh' ? '周期' : 'Duration'}</div>
                                  <div className="text-sm font-bold text-cyan-400">{notice.duration}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">{lang === 'zh' ? '名额' : 'Slots'}</div>
                                  <div className="text-sm font-bold text-purple-400">{notice.slotsLeft}/{notice.slots}</div>
                                </div>
                              </div>

                              {/* 要求检查 */}
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2">
                                  {requirements.level ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className={`text-xs ${requirements.level ? 'text-green-400' : 'text-red-400'}`}>
                                    {lang === 'zh' ? '等级要求' : 'Level'}: Lv.{notice.requirements.minLevel} 
                                    {requirements.level ? ` ✓` : ` (${lang === 'zh' ? '当前' : 'Current'}: Lv.${artist.level})`}
                                  </span>
                                </div>
                                {requirements.talents.map(talent => (
                                  <div key={talent.key} className="flex items-center gap-2">
                                    {talent.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={`text-xs ${talent.passed ? 'text-green-400' : 'text-red-400'}`}>
                                      {talent.key === 'singing' ? (lang === 'zh' ? '唱功' : 'Singing') :
                                       talent.key === 'acting' ? (lang === 'zh' ? '演技' : 'Acting') :
                                       talent.key === 'dancing' ? (lang === 'zh' ? '舞蹈' : 'Dancing') :
                                       talent.key === 'hosting' ? (lang === 'zh' ? '主持' : 'Hosting') :
                                       talent.key === 'variety' ? (lang === 'zh' ? '综艺感' : 'Variety') :
                                       talent.key}: {talent.required}
                                      {talent.passed ? ` ✓` : ` (${lang === 'zh' ? '当前' : 'Current'}: ${talent.current})`}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* 操作按钮 */}
                              <div className="flex gap-2">
                                {requirements.allPassed ? (
                                  <Button 
                                    className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast.success(lang === 'zh' ? '通告已接取' : 'Notice accepted', { description: notice.title });
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {lang === 'zh' ? '立即接单' : 'Accept'}
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    className="border-white/10"
                                    disabled
                                  >
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    {lang === 'zh' ? '不符合要求' : 'Not Qualified'}
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  className="border-white/10 hover:bg-white/5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  {lang === 'zh' ? '查看详情' : 'Details'}
                                </Button>
                              </div>

                              {/* 截止时间 */}
                              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {lang === 'zh' ? '截止时间' : 'Deadline'}: {notice.deadline.toLocaleDateString('zh-CN')}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredNotices.length === 0 && (
                <div className="text-center py-20">
                  <Megaphone className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-xl font-bold text-gray-400 mb-2">
                    {lang === 'zh' ? '暂无通告' : 'No Notices'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {lang === 'zh' ? '明天会有新的通告发布' : 'New notices will be posted tomorrow'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
