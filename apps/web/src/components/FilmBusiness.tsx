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
  Film, Tv, ShoppingBag, Mic, Play, DollarSign, Star,
  TrendingUp, Eye, BarChart3, Plus, Zap,
  Download, Share2, CheckCircle2, Trophy,
} from 'lucide-react';
import type { Drama, Movie, Advertisement, VoiceWork } from "@/types/film";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { FILM_STATUS_COLORS, MOVIE_ROLE_BADGE_COLORS } from "@/constants/film-ui";

interface FilmBusinessProps {
  lang: 'zh' | 'en';
  artist: any;
  onBack: () => void;
}

export function FilmBusiness({ lang: _lang, artist, onBack }: FilmBusinessProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const [dramas, setDramas] = useState<Drama[]>(DRAMAS);
  const [movies, setMovies] = useState<Movie[]>(MOVIES);
  const [ads, setAds] = useState<Advertisement[]>(ADS);
  const [voiceWorks, setVoiceWorks] = useState<VoiceWork[]>(VOICE_WORKS);

  // 计算总统计
  const totalStats = {
    dramas: dramas.length,
    movies: movies.length,
    ads: ads.length,
    voiceWorks: voiceWorks.length,
    totalViews: dramas.reduce((sum, d) => sum + d.views, 0) + ads.reduce((sum, a) => sum + a.views, 0),
    totalRevenue: dramas.reduce((sum, d) => sum + d.revenue, 0) + 
                  movies.reduce((sum, m) => sum + m.revenue, 0) +
                  ads.reduce((sum, a) => sum + a.payment, 0) +
                  voiceWorks.reduce((sum, v) => sum + v.payment, 0)
  };

  const statusColors = FILM_STATUS_COLORS;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Tv className="w-5 h-5 text-cyan-400" />
              <Badge variant="outline" className="text-cyan-400 border-cyan-400/30 text-xs">
                +{dramas.filter(d => d.status === 'released').length}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.dramas}</div>
            <div className="text-xs text-gray-400">短剧作品</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border-purple-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Film className="w-5 h-5 text-purple-400" />
              <Badge variant="outline" className="text-purple-400 border-purple-400/30 text-xs">
                +{movies.filter(m => m.status === 'released').length}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.movies}</div>
            <div className="text-xs text-gray-400">电影</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border-orange-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ShoppingBag className="w-5 h-5 text-orange-400" />
              <TrendingUp className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.ads}</div>
            <div className="text-xs text-gray-400">商业广告</div>
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
            <div className="text-xs text-gray-400">影视收入</div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容Tab */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="bg-black/60 border border-white/5 rounded-xl p-1.5 gap-1.5 mb-6 w-full justify-start">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              数据概览
            </TabsTrigger>
            <TabsTrigger value="dramas" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <Tv className="w-4 h-4 mr-2" />
              短剧
            </TabsTrigger>
            <TabsTrigger value="movies" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300">
              <Film className="w-4 h-4 mr-2" />
              电影
            </TabsTrigger>
            <TabsTrigger value="ads" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
              <ShoppingBag className="w-4 h-4 mr-2" />
              广告
            </TabsTrigger>
            <TabsTrigger value="voice" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300">
              <Mic className="w-4 h-4 mr-2" />
              配音
            </TabsTrigger>
          </TabsList>

          {/* 数据概览 */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 收入构成 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    收入构成分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="flex items-center gap-3">
                        <Tv className="w-5 h-5 text-cyan-400" />
                        <div>
                          <div className="text-sm font-bold text-white">短剧收入</div>
                          <div className="text-xs text-gray-400">{dramas.length} 部作品</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-cyan-400">
                          ¥{(dramas.reduce((sum, d) => sum + d.revenue, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((dramas.reduce((sum, d) => sum + d.revenue, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <Film className="w-5 h-5 text-purple-400" />
                        <div>
                          <div className="text-sm font-bold text-white">电影收入</div>
                          <div className="text-xs text-gray-400">{movies.length} 部电影</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-purple-400">
                          ¥{(movies.reduce((sum, m) => sum + m.revenue, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((movies.reduce((sum, m) => sum + m.revenue, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="w-5 h-5 text-orange-400" />
                        <div>
                          <div className="text-sm font-bold text-white">广告收入</div>
                          <div className="text-xs text-gray-400">{ads.length} 个广告</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-orange-400">
                          ¥{(ads.reduce((sum, a) => sum + a.payment, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((ads.reduce((sum, a) => sum + a.payment, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-3">
                        <Mic className="w-5 h-5 text-yellow-400" />
                        <div>
                          <div className="text-sm font-bold text-white">配音收入</div>
                          <div className="text-xs text-gray-400">{voiceWorks.length} 个项目</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-yellow-400">
                          ¥{(voiceWorks.reduce((sum, v) => sum + v.payment, 0) / 10000).toFixed(1)}W
                        </div>
                        <div className="text-xs text-gray-500">
                          {((voiceWorks.reduce((sum, v) => sum + v.payment, 0) / totalStats.totalRevenue) * 100).toFixed(0)}%
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
                    {[...dramas.filter(d => d.status === 'released'), ...movies.filter(m => m.status === 'released')]
                      .sort((a, b) => {
                        const viewsA = 'views' in a ? a.views : 0;
                        const viewsB = 'views' in b ? b.views : 0;
                        return viewsB - viewsA;
                      })
                      .slice(0, 5)
                      .map((work, index) => (
                        <div key={work.id} className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white' :
                            index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white' :
                            'bg-gray-700/50 text-gray-400'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white line-clamp-1">{work.title}</div>
                            <div className="text-xs text-gray-400">{work.genre}</div>
                          </div>
                          <div className="text-right">
                            {'views' in work && (
                              <>
                                <div className="text-sm font-bold text-cyan-400">{(work.views / 10000).toFixed(1)}W</div>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  {work.rating?.toFixed(1)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 短剧 */}
          <TabsContent value="dramas" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 创建新短剧 */}
              <Card className="bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border-cyan-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">接演新短剧</h3>
                      <p className="text-sm text-gray-400">浏览试镜机会，开启影视之旅</p>
                    </div>
                    <Button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      浏览试镜
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 短剧列表 */}
              <div className="grid grid-cols-1 gap-4">
                {dramas.map(drama => (
                  <Card key={drama.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-cyan-500/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <Tv className="w-12 h-12 text-white" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-white mb-1">{drama.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Badge variant="outline" className="text-xs border-white/20">{drama.genre}</Badge>
                                <span>·</span>
                                <span>{drama.episodes} 集</span>
                                <span>·</span>
                                <span>{drama.role}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${statusColors[drama.status]}`}>
                              {drama.status === 'casting' ? '选角中' :
                               drama.status === 'filming' ? '拍摄中' :
                               drama.status === 'post-production' ? '后期制作' :
                               '已上线'}
                            </Badge>
                          </div>

                          {drama.status === 'released' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">播放量</div>
                                <div className="text-sm font-bold text-cyan-400">{(drama.views / 10000).toFixed(1)}W</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">评分</div>
                                <div className="text-sm font-bold text-yellow-400">{drama.rating.toFixed(1)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">收入</div>
                                <div className="text-sm font-bold text-green-400">¥{(drama.revenue / 1000).toFixed(1)}K</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">上线日期</div>
                                <div className="text-sm font-bold text-gray-300">
                                  {drama.releaseDate ? new Date(drama.releaseDate).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            {drama.status === 'released' ? (
                              <>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Play className="w-3 h-3 mr-1" />
                                  观看
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
                              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                                <Zap className="w-3 h-3 mr-1" />
                                查看进度
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

          {/* 电影 */}
          <TabsContent value="movies" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">电影试镜</h3>
                      <p className="text-sm text-gray-400">争取大银幕角色机会</p>
                    </div>
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      查看试镜
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {movies.map(movie => (
                  <Card key={movie.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all overflow-hidden group">
                    <div className="relative h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Film className="w-20 h-20 text-purple-400/50 group-hover:scale-110 transition-transform" />
                      <Badge variant="outline" className={`absolute top-3 right-3 text-xs ${statusColors[movie.status]}`}>
                        {movie.status === 'pre-production' ? '筹备中' :
                         movie.status === 'filming' ? '拍摄中' :
                         movie.status === 'post-production' ? '后期制作' :
                         '已上映'}
                      </Badge>
                    </div>
                    <CardContent className="p-5">
                      <h3 className="text-lg font-bold text-white mb-2">{movie.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                        <Badge variant="outline" className="text-xs border-white/20">{movie.genre}</Badge>
                        <span>·</span>
                        <Badge variant="outline" className={`text-xs ${
                          movie.role === 'lead' ? 'border-yellow-500/30 text-yellow-400' :
                          movie.role === 'supporting' ? 'border-cyan-500/30 text-cyan-400' :
                          'border-gray-500/30 text-gray-400'
                        }`}>
                          {movie.role === 'lead' ? '主角' :
                           movie.role === 'supporting' ? '配角' :
                           '客串'}
                        </Badge>
                      </div>

                      {movie.status === 'released' && (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="text-xs text-gray-400 mb-1">票房</div>
                            <div className="text-sm font-bold text-purple-400">¥{(movie.boxOffice / 10000).toFixed(0)}W</div>
                          </div>
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="text-xs text-gray-400 mb-1">收入</div>
                            <div className="text-sm font-bold text-green-400">¥{(movie.revenue / 10000).toFixed(1)}W</div>
                          </div>
                        </div>
                      )}

                      <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-500 text-white">
                        {movie.status === 'released' ? (
                          <><Eye className="w-3 h-3 mr-1" /> 查看详情</>
                        ) : (
                          <><Zap className="w-3 h-3 mr-1" /> 查看进度</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 广告 */}
          <TabsContent value="ads" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 border-orange-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">商业代言</h3>
                      <p className="text-sm text-gray-400">接洽品牌合作，拍摄商业广告</p>
                    </div>
                    <Button className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      浏览机会
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {ads.map(ad => (
                  <Card key={ad.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-orange-500/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-10 h-10 text-white" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-white mb-1">{ad.brand}</h3>
                              <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span>{ad.product}</span>
                                <span>·</span>
                                <Badge variant="outline" className="text-xs border-white/20">{ad.type}</Badge>
                                <span>·</span>
                                <span>{ad.duration}s</span>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${statusColors[ad.status]}`}>
                              {ad.status === 'negotiating' ? '洽谈中' :
                               ad.status === 'shooting' ? '拍摄中' :
                               '已完成'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">代言费</div>
                              <div className="text-sm font-bold text-orange-400">¥{(ad.payment / 1000).toFixed(0)}K</div>
                            </div>
                            {ad.status === 'completed' && (
                              <>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">曝光量</div>
                                  <div className="text-sm font-bold text-cyan-400">{(ad.views / 10000).toFixed(1)}W</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">CPM</div>
                                  <div className="text-sm font-bold text-green-400">
                                    ¥{((ad.payment / (ad.views / 1000))).toFixed(2)}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {ad.status === 'completed' ? (
                              <>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Play className="w-3 h-3 mr-1" />
                                  观看
                                </Button>
                                <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                  <Download className="w-3 h-3 mr-1" />
                                  下载素材
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white">
                                <Zap className="w-3 h-3 mr-1" />
                                查看进度
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

          {/* 配音 */}
          <TabsContent value="voice" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-yellow-900/30 to-green-900/30 border-yellow-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">配音工作</h3>
                      <p className="text-sm text-gray-400">动画、纪录片、有声书配音</p>
                    </div>
                    <Button className="bg-gradient-to-r from-yellow-600 to-green-600 hover:from-yellow-500 hover:to-green-500 text-white font-bold">
                      <Plus className="w-4 h-4 mr-2" />
                      浏览项目
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {voiceWorks.map(work => (
                  <Card key={work.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-yellow-500/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-yellow-500 to-green-500 flex items-center justify-center">
                          <Mic className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">{work.project}</h3>
                          <Badge variant="outline" className="text-xs border-white/20">
                            {work.type === 'animation' ? '动画' :
                             work.type === 'documentary' ? '纪录片' :
                             work.type === 'audiobook' ? '有声书' :
                             '游戏'}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <div className="text-xs text-gray-500 mb-1">时长</div>
                          <div className="text-sm font-bold text-yellow-400">{work.duration} 分钟</div>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                          <div className="text-xs text-gray-500 mb-1">报酬</div>
                          <div className="text-sm font-bold text-green-400">¥{(work.payment / 1000).toFixed(0)}K</div>
                        </div>
                      </div>

                      <Badge variant="outline" className={`text-xs mb-4 ${statusColors[work.status]}`}>
                        {work.status === 'recording' ? '录制中' :
                         work.status === 'editing' ? '编辑中' :
                         '已交付'}
                      </Badge>

                      <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white">
                        {work.status === 'delivered' ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" /> 查看详情</>
                        ) : (
                          <><Zap className="w-3 h-3 mr-1" /> 继续录制</>
                        )}
                      </Button>
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
