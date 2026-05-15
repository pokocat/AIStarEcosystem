"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@ai-star-eco/ui/ui/card';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Badge } from '@ai-star-eco/ui/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ai-star-eco/ui/ui/tabs';
import {
  Music, Play, Pause, TrendingUp, Coins,
  Calendar, Star, Clock, Zap, BarChart3,
  Disc3, Headphones, Share2, Plus, Trophy, Loader2, AlertCircle,
  Radio, Sparkles, Edit3
} from 'lucide-react';
import type { Song, Album, Concert, MusicGenre, MusicTrendPoint, CreateSongRequest } from '@ai-star-eco/types/music';
import {
  MUSIC_STATUS_COLORS,
  SONG_STATUS_LABEL,
  CONCERT_STATUS_LABEL,
} from '@/constants/music-ui';
import { MusicApi, ApiError } from '@/api';
import { formatCredits, formatCompactNumber } from '@/lib/format';
import MusicGenerationDialog from './MusicGenerationDialog';
import { SongDetailDrawer } from './producer/SongDetailDrawer';
import { MusicTrendChart } from './producer/MusicTrendChart';

interface MusicBusinessProps {
  lang: 'zh' | 'en';
  artist: { id: string; name: string; avatar?: string };
  onBack: () => void;
}

export function MusicBusiness({ lang: _lang, artist, onBack: _onBack }: MusicBusinessProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [musicGenres, setMusicGenres] = useState<MusicGenre[]>([]);
  const [trends, setTrends] = useState<MusicTrendPoint[]>([]);
  const [trendMetric, setTrendMetric] = useState<'plays' | 'revenue'>('plays');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 创作对话框
  const [dialogOpen, setDialogOpen] = useState(false);

  // 详情抽屉
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // 内联播放状态
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      MusicApi.listSongs(),
      MusicApi.listAlbums(),
      MusicApi.listConcerts(),
      MusicApi.listGenres(),
      MusicApi.listTrends30d(),
    ])
      .then(([s, a, c, g, t]) => {
        if (cancelled) return;
        setSongs(s);
        setAlbums(a);
        setConcerts(c);
        setMusicGenres(g);
        setTrends(t);
      })
      .catch(err => {
        if (cancelled) return;
        const msg = err instanceof ApiError
          ? `${err.message}（${err.code}）`
          : err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 仅显示当前艺人的作品（见 product_spec.md §10.1：Song.artistId 绑定 DigitalIp）
  const artistSongs = useMemo(
    () => songs.filter(s => s.artistId === artist.id),
    [songs, artist.id]
  );
  const artistAlbums = useMemo(
    () => albums.filter(a => a.artistId === artist.id),
    [albums, artist.id]
  );
  const artistConcerts = useMemo(
    () => concerts.filter(c => c.artistIds.includes(artist.id)),
    [concerts, artist.id]
  );

  // 统计（基于当前艺人）
  const totalStats = useMemo(() => {
    const songRevenue = artistSongs.reduce((sum, s) => sum + s.revenue, 0);
    const totalPlays = artistSongs.reduce((sum, s) => sum + s.plays, 0);
    const rated = artistSongs.filter(s => s.rating > 0);
    return {
      songs: artistSongs.length,
      albums: artistAlbums.length,
      concerts: artistConcerts.length,
      totalPlays,
      totalRevenue: songRevenue,
      avgRating: rated.length > 0
        ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length
        : 0,
    };
  }, [artistSongs, artistAlbums, artistConcerts]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusColors = MUSIC_STATUS_COLORS;

  // ── 创作：对话框成功回调 → 调 MusicApi.createSong ───────────────────────────
  const handleGenerationSuccess = async (generated: any) => {
    try {
      const req: CreateSongRequest = {
        artistId: artist.id,
        title: generated?.title || '未命名作品',
        genre: generated?.style || generated?.genre || 'Pop',
        duration: typeof generated?.duration === 'string'
          ? parseInt(String(generated.duration).split(':')[0]) * 60 +
            parseInt(String(generated.duration).split(':')[1] || '0')
          : typeof generated?.duration === 'number' ? generated.duration : 180,
        prompt: generated?.prompt,
      };
      const newSong = await MusicApi.createSong(req);
      setSongs(prev => [newSong, ...prev]);
    } catch (err) {
      const msg = err instanceof ApiError
        ? `${err.message}（${err.code}）`
        : err instanceof Error ? err.message : String(err);
      setLoadError(msg);
    }
  };

  // ── 状态流转：recording → mixing → released ──────────────────────────────────
  const advanceStatus = async (song: Song) => {
    const next: Song['status'] =
      song.status === 'recording' ? 'mixing'
      : song.status === 'mixing' ? 'released'
      : 'released';
    try {
      const updated = await MusicApi.advanceSongStatus(song.id, next);
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (err) {
      const msg = err instanceof ApiError
        ? `${err.message}（${err.code}）`
        : err instanceof Error ? err.message : String(err);
      setLoadError(msg);
    }
  };

  // ── 播放 / 暂停 ──────────────────────────────────────────────────────────────
  const togglePlay = (song: Song) => {
    if (!song.audioUrl) return;
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      setPlayingId(song.id);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = song.audioUrl!;
          audioRef.current.play().catch(() => {
            // mock 占位 URL 无法真实播放；保留 UI 反馈
          });
        }
      }, 0);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> 正在加载音乐业务数据...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" /> 加载失败：{loadError}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 隐藏的音频元素，用于 mock 占位播放 */}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {/* 顶部概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border-pink-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Music className="w-5 h-5 text-pink-400" />
              <Badge variant="outline" className="text-pink-400 border-pink-400/30 text-xs">
                {artistSongs.filter(s => s.status === 'released').length} 已发布
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
                {artistAlbums.reduce((sum, a) => sum + a.trackIds.length, 0)} 曲
              </Badge>
            </div>
            <div className="text-2xl font-black text-white mb-1">{totalStats.albums}</div>
            <div className="text-xs text-gray-400">歌单 / 合集</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border-cyan-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Headphones className="w-5 h-5 text-cyan-400" />
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {formatCompactNumber(totalStats.totalPlays)}
            </div>
            <div className="text-xs text-gray-400">总播放量</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-500/20 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Coins className="w-5 h-5 text-green-400" />
              <Zap className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {formatCredits(totalStats.totalRevenue)}
            </div>
            <div className="text-xs text-gray-400">音乐收入（积分）</div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容 Tab */}
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
              歌单 / 合集
            </TabsTrigger>
            <TabsTrigger value="concerts" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300">
              <Radio className="w-4 h-4 mr-2" />
              线上直播
            </TabsTrigger>
          </TabsList>

          {/* 数据概览 */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 近 30 天趋势 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    近 30 天趋势
                  </CardTitle>
                  <div className="flex items-center gap-1 rounded-lg bg-black/60 border border-white/5 p-1">
                    <button
                      onClick={() => setTrendMetric('plays')}
                      className={`text-xs px-3 py-1 rounded-md transition-colors ${
                        trendMetric === 'plays'
                          ? 'bg-pink-500/20 text-pink-300'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      播放量
                    </button>
                    <button
                      onClick={() => setTrendMetric('revenue')}
                      className={`text-xs px-3 py-1 rounded-md transition-colors ${
                        trendMetric === 'revenue'
                          ? 'bg-green-500/20 text-green-300'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      收入
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {trends.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-12">
                      暂无趋势数据
                    </div>
                  ) : (
                    <MusicTrendChart data={trends} metric={trendMetric} />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    热门作品 Top 5
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {artistSongs.filter(s => s.status === 'released').length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-8">
                      {artist.name} 暂无已发布作品。到"歌曲录制"开始创作。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {artistSongs
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
                              <div className="text-sm font-bold text-pink-400">{formatCompactNumber(song.plays)}</div>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {song.rating.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 歌曲录制 */}
          <TabsContent value="songs" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              {/* 创作入口 */}
              <Card className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border-pink-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        为 <span className="text-pink-300">{artist.name}</span> 录制新歌曲
                      </h3>
                      <p className="text-sm text-gray-400">
                        选择模型与深度，AI 将按本次创作消耗相应积分
                      </p>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始创作
                    </Button>
                  </div>

                  {/* 风格提示（仅展示，真实选择在对话框内） */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
                    {musicGenres.map(genre => (
                      <div
                        key={genre.id}
                        className="h-auto py-3 flex flex-col items-center gap-2 border border-white/10 rounded-md bg-black/20"
                      >
                        <span className="text-2xl">{genre.icon}</span>
                        <span className="text-xs text-gray-300">{genre.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 歌曲列表 */}
              {artistSongs.length === 0 ? (
                <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                  <CardContent className="p-12 text-center text-sm text-gray-500">
                    <Music className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    {artist.name} 还没有任何歌曲。点"开始创作"录制第一首。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {artistSongs.map(song => {
                    const isPlaying = playingId === song.id;
                    return (
                      <Card key={song.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-pink-500/30 transition-all">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div
                              className="w-20 h-20 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0 bg-cover bg-center"
                              style={song.coverUrl ? { backgroundImage: `url(${song.coverUrl})` } : undefined}
                            >
                              {!song.coverUrl && <Music className="w-10 h-10 text-white" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-lg font-bold text-white mb-1">{song.title}</h3>
                                  <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Badge variant="outline" className="text-xs border-white/20">{song.genre}</Badge>
                                    <span>·</span>
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDuration(song.duration)}</span>
                                    {song.modelVersion && (
                                      <>
                                        <span>·</span>
                                        <span className="text-xs text-gray-500">{song.modelVersion}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={`text-xs ${statusColors[song.status]}`}>
                                    {SONG_STATUS_LABEL[song.status]}
                                  </Badge>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/5"
                                    onClick={() => setEditingSong(song)}
                                    title="编辑详情"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* 扣费信息：创作消耗 */}
                              {typeof song.creditsSpent === 'number' && (
                                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                  <Coins className="w-3 h-3 text-amber-400" />
                                  本次创作消耗 {formatCredits(song.creditsSpent)} 积分
                                </div>
                              )}

                              {/* 已发布数据统计 */}
                              {song.status === 'released' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 rounded-lg bg-black/40 border border-white/5 mb-3">
                                  <div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                      <Headphones className="w-3 h-3" />
                                      播放量
                                    </div>
                                    <div className="text-sm font-bold text-pink-400">{formatCompactNumber(song.plays)}</div>
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
                                      <Coins className="w-3 h-3" />
                                      收入（积分）
                                    </div>
                                    <div className="text-sm font-bold text-green-400">{formatCredits(song.revenue)}</div>
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
                                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => togglePlay(song)}>
                                      {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                      {isPlaying ? '暂停' : '播放'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/10 hover:bg-white/5"
                                      onClick={() => {
                                        router.push(`/distribution?songId=${encodeURIComponent(song.id)}`);
                                      }}
                                    >
                                      <Share2 className="w-3 h-3 mr-1" />
                                      分发
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
                                      <BarChart3 className="w-3 h-3 mr-1" />
                                      数据
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" className="bg-pink-600 hover:bg-pink-500 text-white" onClick={() => advanceStatus(song)}>
                                      <Zap className="w-3 h-3 mr-1" />
                                      {song.status === 'recording' ? '进入混音' : '发布上架'}
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => togglePlay(song)}>
                                      {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                      试听
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* 歌单 / 合集（Album 降级，见 product_spec.md §10.4） */}
          <TabsContent value="albums" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-purple-900/30 to-cyan-900/30 border-purple-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{artist.name} 的歌单</h3>
                      <p className="text-sm text-gray-400">
                        歌单 = 歌手的作品合集；数字音乐无独立专辑发行
                      </p>
                    </div>
                    <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold" disabled>
                      <Plus className="w-4 h-4 mr-2" />
                      新建歌单（P1）
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {artistAlbums.length === 0 ? (
                <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                  <CardContent className="p-12 text-center text-sm text-gray-500">
                    <Disc3 className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    还没有歌单。多首歌曲发布后可在这里编排合集。
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {artistAlbums.map(album => (
                    <Card key={album.id} className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all overflow-hidden group">
                      <div className="relative aspect-square overflow-hidden">
                        <img src={album.cover} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-xl font-black text-white mb-1">{album.name}</h3>
                          <p className="text-sm text-gray-300">{album.trackIds.length} 首歌曲</p>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white" disabled>
                            <Play className="w-3 h-3 mr-1" />
                            播放合集（P1）
                          </Button>
                          <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5" disabled>
                            编辑
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* 线上直播（Concert 简化骨架，见 product_spec.md §10.5） */}
          <TabsContent value="concerts" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
              <CardContent className="p-12 text-center">
                <Radio className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-bold text-white mb-2">线上直播活动</h3>
                <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
                  数字音乐的演出以线上直播为主。完整的直播筹备 / 排期 / 推广功能将在后续迭代开放。
                </p>
                {artistConcerts.length > 0 && (
                  <div className="max-w-md mx-auto space-y-2 text-left">
                    {artistConcerts.map(c => (
                      <div key={c.id} className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{c.name}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(c.date).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${statusColors[c.status]}`}>
                          {CONCERT_STATUS_LABEL[c.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 创作对话框（已有组件，复用） */}
      <MusicGenerationDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={(track) => {
          setDialogOpen(false);
          handleGenerationSuccess(track);
        }}
        lang={_lang}
      />

      {/* 歌曲详情抽屉 */}
      <SongDetailDrawer
        song={editingSong}
        genres={musicGenres}
        onClose={() => setEditingSong(null)}
        onSaved={(updated) => {
          setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
        }}
      />
    </div>
  );
}
