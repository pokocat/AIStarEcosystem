"use client";

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Music, Play, TrendingUp, DollarSign,
  Calendar, MapPin, Users, Star, Clock, Zap, BarChart3,
  Disc3, Headphones, Share2, Eye, Plus, Trophy
} from 'lucide-react';
import type { Song, Album, Concert } from '@/types/music';
import { SONGS, ALBUMS, CONCERTS, MUSIC_GENRES } from '@/mocks/music';
import { MUSIC_STATUS_COLORS } from '@/constants/music-ui';

interface MusicBusinessProps {
  lang: 'zh' | 'en';
  artist: any;
  onBack: () => void;
}

export function MusicBusiness({ lang, artist, onBack }: MusicBusinessProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // 歌曲库
  const [songs, setSongs] = useState<Song[]>(SONGS);

  // 专辑库
  const [albums, setAlbums] = useState<Album[]>(ALBUMS);

  // 演唱会
  const [concerts, setConcerts] = useState<Concert[]>(CONCERTS);

  // 音乐风格
  const musicGenres = MUSIC_GENRES;

  // 计算总统计
  const totalStats = {
    songs: songs.length,
    albums: albums.length,
    concerts: concerts.length,
    totalPlays: songs.reduce((sum, s) => sum + s.plays, 0),
    totalRevenue: songs.reduce((sum, s) => sum + s.revenue, 0) +
                  albums.reduce((sum, a) => sum + a.revenue, 0) +
                  concerts.reduce((sum, c) => sum + c.revenue, 0),
    avgRating: songs.filter(s => s.rating > 0).reduce((sum, s) => sum + s.rating, 0) / songs.filter(s => s.rating > 0).length || 0
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusColors = MUSIC_STATUS_COLORS;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border-pink-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Music className="w-5 h-5 text-pink-400" />
              <Badge variant="outline" className="text-pink-400 border-pink-400/30 text-xs">
                +{songs.filter(s => s.status === 'released').length}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.songs}</div>
            <div className="text-xs text-gray-400">单曲作品</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border-purple-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Disc3 className="w-5 h-5 text-purple-400" />
              <Badge variant="outline" className="text-purple-400 border-purple-400/30 text-xs">
                +{albums.filter(a => a.status === 'released').length}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.albums}</div>
            <div className="text-xs text-gray-400">专辑</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Headphones className="w-5 h-5 text-cyan-400" />
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {(totalStats.totalPlays / 1000).toFixed(0)}K
            </div>
            <div className="text-xs text-gray-400">总播放量</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <Zap className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              ¥{(totalStats.totalRevenue / 10000).toFixed(1)}W
            </div>
            <div className="text-xs text-gray-400">音乐收入</div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容Tab */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="bg-black/60 border border-white/5 rounded-xl p-1.5 gap-1.5 mb-6 w-full justify-start">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              数据概览
            </TabsTrigger>
            <TabsTrigger value="songs" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <Music className="w-4 h-4 mr-2" />
              歌曲录制
            </TabsTrigger>
            <TabsTrigger value="albums" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Disc3 className="w-4 h-4 mr-2" />
              专辑制作
            </TabsTrigger>
            <TabsTrigger value="concerts" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300">
              <Users className="w-4 h-4 mr-2" />
              演唱会
            </TabsTrigger>
          </TabsList>

          {/* 数据概览 */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 收入趋势 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    收入构成
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
                      <div className="flex items-center gap-3">
                        <Music className="w-5 h-5 text-pink-400" />
                        <div>
                          <div className="text-sm font-bold text-white">单曲收入</div>
                          <div className="text-xs text-gray-400">{songs.length} 首歌曲</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-pink-400">
                          ¥{(songs.reduce((sum, s) => sum + s.revenue, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((songs.reduce((sum, s) => sum + s.revenue, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <Disc3 className="w-5 h-5 text-purple-400" />
                        <div>
                          <div className="text-sm font-bold text-white">专辑收入</div>
                          <div className="text-xs text-gray-400">{albums.length} 张专辑</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-purple-400">
                          ¥{(albums.reduce((sum, a) => sum + a.revenue, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((albums.reduce((sum, a) => sum + a.revenue, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-yellow-400" />
                        <div>
                          <div className="text-sm font-bold text-white">演唱会收入</div>
                          <div className="text-xs text-gray-400">{concerts.length} 场演出</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-yellow-400">
                          ¥{(concerts.reduce((sum, c) => sum + c.revenue, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((concerts.reduce((sum, c) => sum + c.revenue, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 热门作品 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    热门作品 Top 5
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {songs
                      .filter(s => s.status === 'released')
                      .sort((a, b) => b.plays - a.plays)
                      .slice(0, 5)
                      .map((song, index) => (
                        <div key={song.id} className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white' :
                            'bg-gray-700/50 text-gray-400'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white line-clamp-1">{song.title}</div>
                            <div className="text-xs text-gray-400">{song.genre} · {formatDuration(song.duration)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-pink-400">{(song.plays / 1000).toFixed(1)}K</div>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {song.rating.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 歌曲录制 */}
          <TabsContent value="songs" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 创建新歌曲 */}
              <Card className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border-pink-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">录制新歌曲</h3>
                      <p className="text-sm text-gray-400">选择风格，开始创作你的下一首热单</p>
                    </div>
                    <Button className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      开始录制
                    </Button>
                  </div>

                  {/* 音乐风格选择 */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
                    {musicGenres.map(genre => (
                      <Button
                        key={genre.id}
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-center gap-2 border-white/10 hover:bg-white/5 hover:border-pink-500/30"
                      >
                        <span className="text-2xl">{genre.icon}</span>
                        <span className="text-xs">{genre.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 歌曲列表 */}
              <div className="grid grid-cols-1 gap-4">
                {songs.map(song => (
                  <Card key={song.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-pink-500/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* 封面/图标 */}
                        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <Music className="w-10 h-10 text-white" />
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-bold text-white mb-1">{song.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Badge variant="outline" className="text-xs border-white/20">{song.genre}</Badge>
                                <span>·</span>
                                <Clock className="w-3 h-3" />
                                <span>{formatDuration(song.duration)}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${statusColors[song.status]}`}>
                              {song.status === 'recording' ? '录制中' :
                               song.status === 'mixing' ? '混音中' :
                               '已发布'}
                            </Badge>
                          </div>

                          {/* 数据统计 */}
                          {song.status === 'released' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Headphones className="w-3 h-3" />
                                  播放量
                                </div>
                                <div className="text-sm font-bold text-pink-400">{(song.plays / 1000).toFixed(1)}K</div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Star className="w-3 h-3" />
                                  评分
                                </div>
                                <div className="text-sm font-bold text-yellow-400">{song.rating.toFixed(1)}</div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <DollarSign className="w-3 h-3" />
                                  收入
                                </div>
                                <div className="text-sm font-bold text-green-400">¥{(song.revenue / 1000).toFixed(1)}K</div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Calendar className="w-3 h-3" />
                                  发布日期
                                </div>
                                <div className="text-sm font-bold text-gray-300">
                                  {song.releaseDate ? new Date(song.releaseDate).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            {song.status === 'released' ? (
                              <>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Play className="w-3 h-3 mr-1" />
                                  播放
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Share2 className="w-3 h-3 mr-1" />
                                  分享
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <BarChart3 className="w-3 h-3 mr-1" />
                                  数据
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white">
                                  <Zap className="w-3 h-3 mr-1" />
                                  继续制作
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  取消
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 专辑制作 */}
          <TabsContent value="albums" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 创建新专辑 */}
              <Card className="bg-gradient-to-br from-purple-900/30 to-cyan-900/30 border-purple-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">制作新专辑</h3>
                      <p className="text-sm text-gray-400">策划完整专辑，提升艺人商业价值</p>
                    </div>
                    <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      开始制作
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 专辑列表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {albums.map(album => (
                  <Card key={album.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all overflow-hidden group">
                    <div className="relative aspect-square overflow-hidden">
                      <img src={album.cover} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      <Badge variant="outline" className={`absolute top-3 right-3 text-xs ${statusColors[album.status]}`}>
                        {album.status === 'planning' ? '策划中' :
                         album.status === 'recording' ? '录制中' :
                         '已发布'}
                      </Badge>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-xl font-black text-white mb-1">{album.name}</h3>
                        <p className="text-sm text-gray-300">{album.trackCount} 首歌曲</p>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      {album.status === 'released' && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="text-xs text-gray-400 mb-1">销量</div>
                            <div className="text-lg font-bold text-purple-400">{(album.sales / 1000).toFixed(1)}K</div>
                          </div>
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="text-xs text-gray-400 mb-1">收入</div>
                            <div className="text-lg font-bold text-green-400">¥{(album.revenue / 10000).toFixed(1)}W</div>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {album.status === 'released' ? (
                          <>
                            <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white">
                              <Play className="w-3 h-3 mr-1" />
                              播放
                            </Button>
                            <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                              <BarChart3 className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white">
                            <Zap className="w-3 h-3 mr-1" />
                            继续制作
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 演唱会 */}
          <TabsContent value="concerts" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 筹备新演唱会 */}
              <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">筹备演唱会</h3>
                      <p className="text-sm text-gray-400">策划演唱会，与粉丝面对面互动</p>
                    </div>
                    <Button className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      开始筹备
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 演唱会列表 */}
              <div className="space-y-4">
                {concerts.map(concert => (
                  <Card key={concert.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-yellow-500/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                          <Users className="w-12 h-12 text-white" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-white mb-2">{concert.name}</h3>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {concert.venue}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(concert.date).toLocaleDateString('zh-CN')}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${statusColors[concert.status]}`}>
                              {concert.status === 'planning' ? '筹备中' :
                               concert.status === 'selling' ? '售票中' :
                               '已完成'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">票价</div>
                              <div className="text-sm font-bold text-yellow-400">¥{concert.ticketPrice}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">容量</div>
                              <div className="text-sm font-bold text-cyan-400">{concert.capacity}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">已售</div>
                              <div className="text-sm font-bold text-green-400">{concert.soldTickets}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">收入</div>
                              <div className="text-sm font-bold text-pink-400">¥{(concert.revenue / 10000).toFixed(0)}W</div>
                            </div>
                          </div>

                          {/* 售票进度 */}
                          {concert.status === 'selling' && (
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-400 mb-2">
                                <span>售票进度</span>
                                <span>{((concert.soldTickets / concert.capacity) * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
                                  style={{ width: `${(concert.soldTickets / concert.capacity) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            {concert.status === 'completed' ? (
                              <>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Eye className="w-3 h-3 mr-1" />
                                  查看回顾
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <BarChart3 className="w-3 h-3 mr-1" />
                                  数据分析
                                </Button>
                              </>
                            ) : concert.status === 'selling' ? (
                              <>
                                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-500 text-white">
                                  <Zap className="w-3 h-3 mr-1" />
                                  推广售票
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  编辑
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-500 text-white">
                                <Zap className="w-3 h-3 mr-1" />
                                继续筹备
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
