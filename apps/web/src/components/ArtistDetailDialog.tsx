"use client";

import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  Music, TrendingUp, Users, Calendar, Award, BarChart3, 
  Play, Heart, Share2, X, Disc, Sparkles 
} from 'lucide-react';
import { motion } from 'motion/react';

interface Artist {
  id: number;
  name: string;
  style: string;
  avatar: string;
  songs?: number;
  followers?: string;
}

interface ArtistDetailDialogProps {
  artist: Artist | null;
  isOpen: boolean;
  onClose: () => void;
  lang: 'zh' | 'en';
  onCreateMusic?: () => void;
}

export default function ArtistDetailDialog({ artist, isOpen, onClose, lang, onCreateMusic }: ArtistDetailDialogProps) {
  if (!artist) return null;

  const t = {
    zh: {
      overview: '概览',
      works: '作品',
      analytics: '数据',
      totalSongs: '总作品数',
      totalPlays: '总播放量',
      totalRevenue: '总收益',
      avgPlayRate: '平均播放率',
      recentWorks: '近期作品',
      plays: '播放',
      fanGrowth: '粉丝增长',
      playTrend: '播放趋势',
      createMusic: '开始创作',
      share: '分享',
      favorite: '收藏',
      days: '天',
      active: '活跃'
    },
    en: {
      overview: 'Overview',
      works: 'Works',
      analytics: 'Analytics',
      totalSongs: 'Total Songs',
      totalPlays: 'Total Plays',
      totalRevenue: 'Total Revenue',
      avgPlayRate: 'Avg. Play Rate',
      recentWorks: 'Recent Works',
      plays: 'Plays',
      fanGrowth: 'Fan Growth',
      playTrend: 'Play Trend',
      createMusic: 'Start Creating',
      share: 'Share',
      favorite: 'Favorite',
      days: 'Days',
      active: 'Active'
    }
  };

  const text = t[lang];

  // Mock data
  const stats = {
    songs: artist.songs || 12,
    plays: '1.5M',
    revenue: '¥15.2k',
    playRate: '85%'
  };

  const recentSongs = [
    { id: 1, title: 'Neon Dreams', plays: '450K', date: '2026-03-20', duration: '3:45' },
    { id: 2, title: 'Cyber Lullaby', plays: '380K', date: '2026-03-15', duration: '4:12' },
    { id: 3, title: 'Digital Horizon', plays: '320K', date: '2026-03-10', duration: '3:58' },
    { id: 4, title: 'Synthwave Nights', plays: '290K', date: '2026-03-05', duration: '4:30' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden">
        {/* Hero Section */}
        <div className="relative h-64 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-[#0c0c0e]" />
          <img 
            src={artist.avatar} 
            alt={artist.name} 
            className="w-full h-full object-cover blur-xl scale-110 opacity-50" 
          />
          
          <div className="absolute inset-0 flex items-end p-8">
            <div className="flex items-end gap-6 w-full">
              {/* Artist Avatar */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-cyan-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                <img 
                  src={artist.avatar} 
                  alt={artist.name}
                  className="relative w-40 h-40 rounded-2xl object-cover border-4 border-white/10 shadow-2xl"
                />
                <Badge className="absolute top-3 right-3 bg-emerald-500 text-white border-0 shadow-lg">
                  {text.active}
                </Badge>
              </div>

              {/* Artist Info */}
              <div className="flex-1 pb-2">
                <h2 className="text-4xl font-black text-white mb-2 drop-shadow-lg">{artist.name}</h2>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 mb-4">
                  {artist.style}
                </Badge>
                <div className="flex gap-4 mt-4">
                  <div>
                    <div className="text-2xl font-black text-white">{stats.songs}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{text.totalSongs}</div>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <div className="text-2xl font-black text-cyan-400">{stats.plays}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{text.totalPlays}</div>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <div className="text-2xl font-black text-emerald-400">{stats.revenue}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{text.totalRevenue}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pb-2">
                <Button 
                  onClick={onCreateMusic}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 h-12 px-6"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {text.createMusic}
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 border-white/10">
                  <Heart className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 border-white/10">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="px-8 pb-8">
          <TabsList className="bg-black/60 border border-white/5 rounded-xl p-1.5 gap-1.5 mb-6">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              {text.overview}
            </TabsTrigger>
            <TabsTrigger value="works" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Music className="w-4 h-4 mr-2" />
              {text.works}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
              <TrendingUp className="w-4 h-4 mr-2" />
              {text.analytics}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: text.totalSongs, value: stats.songs, icon: Music, color: 'text-purple-400' },
                { label: text.totalPlays, value: stats.plays, icon: Play, color: 'text-cyan-400' },
                { label: text.totalRevenue, value: stats.revenue, icon: Award, color: 'text-emerald-400' },
                { label: text.avgPlayRate, value: stats.playRate, icon: TrendingUp, color: 'text-pink-400' }
              ].map((stat, i) => (
                <Card key={i} className="bg-black/40 border-white/5 hover:bg-white/5 transition-colors">
                  <CardContent className="p-4">
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
                    <div className="text-2xl font-black text-white mb-1">{stat.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-black/40 border-white/5">
              <CardContent className="p-6">
                <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                  {text.recentWorks}
                </h4>
                <div className="space-y-3">
                  {recentSongs.slice(0, 3).map((song, i) => (
                    <div 
                      key={song.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Disc className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white mb-1 truncate">{song.title}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {song.date}
                          </span>
                          <span>{song.duration}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-cyan-400">{song.plays}</div>
                        <div className="text-xs text-gray-500">{text.plays}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Works Tab */}
          <TabsContent value="works" className="space-y-3">
            {recentSongs.map((song, i) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-black/40 border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Music className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">{song.title}</h4>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {song.date}
                          </span>
                          <span>•</span>
                          <span>{song.duration}</span>
                          <span>•</span>
                          <span className="text-cyan-400">{song.plays} {text.plays}</span>
                        </div>
                      </div>
                      <Button 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 hover:bg-purple-500"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-black/40 border-white/5">
              <CardContent className="p-6">
                <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                  {text.fanGrowth} (30 {text.days})
                </h4>
                <div className="space-y-3">
                  {[
                    { week: 'Week 1', growth: '+2.5K', percentage: 85 },
                    { week: 'Week 2', growth: '+3.2K', percentage: 95 },
                    { week: 'Week 3', growth: '+2.8K', percentage: 88 },
                    { week: 'Week 4', growth: '+4.1K', percentage: 100 }
                  ].map((data, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">{data.week}</span>
                        <span className="text-emerald-400 font-bold">{data.growth}</span>
                      </div>
                      <Progress value={data.percentage} className="h-2 bg-white/5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/5">
              <CardContent className="p-6">
                <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">
                  {text.playTrend} (7 {text.days})
                </h4>
                <div className="flex items-end justify-between h-32 gap-2">
                  {[45, 62, 55, 78, 90, 85, 95].map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t hover:from-cyan-500 hover:to-cyan-300 transition-colors cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">D{i + 1}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
