import React, { useState, useEffect } from 'react';
import {
  Heart, Star, Play, Pause, SkipForward, SkipBack, Search,
  Home, TrendingUp, ShoppingBag, User, Music, Crown, Gem,
  Share2, MessageCircle, ThumbsUp, ChevronLeft, ChevronRight,
  Globe as GlobeIcon, Volume2, Repeat, Shuffle, ArrowUpRight,
  Eye, Flame, Sparkles, Award, Zap, Clock, Gift, Bell,
  ExternalLink, Filter, Grid3X3, List, X, ChevronDown
} from 'lucide-react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { motion, AnimatePresence } from "motion/react";
import type { Lang } from "../translations";
import { DanmakuOverlay } from "./DanmakuLive";

interface FanArtist {
  id: string;
  name: string;
  type: string;
  avatar: string;
  fans: string;
  trending: boolean;
  tags: string[];
}

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  cover: string;
  plays: string;
  duration: string;
  liked: boolean;
}

interface NFTItem {
  id: string;
  name: string;
  artist: string;
  preview: string;
  price: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  holders: number;
}

const TRENDING_ARTISTS: FanArtist[] = [
  { id: '1', name: 'Neon V', type: 'MIC', avatar: '/images/artist-neon-v.webp', fans: '162K', trending: true, tags: ['Cyberpunk', 'Electro'] },
  { id: '2', name: 'Luna Soft', type: 'MIC', avatar: '/images/artist-luna-soft.webp', fans: '89K', trending: true, tags: ['Lo-Fi', 'Pop'] },
  { id: '3', name: 'Blade Runner', type: 'ACT', avatar: '/images/fan-blade-runner.webp', fans: '256K', trending: false, tags: ['Action', 'Sci-Fi'] },
  { id: '4', name: 'Crystal Flow', type: 'DNC', avatar: '/images/fan-crystal-flow.webp', fans: '128K', trending: true, tags: ['Dance', 'K-Pop'] },
  { id: '5', name: 'MC Thunder', type: 'HST', avatar: '/images/fan-mc-thunder.webp', fans: '95K', trending: false, tags: ['Variety', 'Comedy'] },
  { id: '6', name: 'PRISM 7', type: 'IDL', avatar: '/images/fan-prism-7.webp', fans: '310K', trending: true, tags: ['Idol', 'All-Round'] },
];

const HOT_TRACKS: TrackItem[] = [
  { id: 't1', title: 'Neon Tears', artist: 'Neon V', cover: 'MUS', plays: '1.2M', duration: '3:42', liked: true },
  { id: 't2', title: 'Digital Sunset', artist: 'Neon V', cover: 'SUN', plays: '890K', duration: '4:15', liked: false },
  { id: 't3', title: 'Moonlight Lo-Fi', artist: 'Luna Soft', cover: 'MON', plays: '650K', duration: '3:28', liked: true },
  { id: 't4', title: 'Crystal Dance Break', artist: 'Crystal Flow', cover: 'GEM', plays: '420K', duration: '2:58', liked: false },
  { id: 't5', title: 'Cyber City Vibe', artist: 'Neon V', cover: 'CTY', plays: '380K', duration: '3:55', liked: false },
  { id: 't6', title: 'Starlight Protocol', artist: 'PRISM 7', cover: 'STR', plays: '560K', duration: '4:02', liked: true },
  { id: 't7', title: 'Ghost Signal', artist: 'Neon V', cover: 'GST', plays: '320K', duration: '3:12', liked: false },
  { id: 't8', title: 'Soft Rain', artist: 'Luna Soft', cover: 'RAN', plays: '280K', duration: '3:45', liked: false },
];

const NFT_MARKET: NFTItem[] = [
  { id: 'n1', name: 'Neon V Genesis Badge', artist: 'Neon V', preview: 'BGE', price: '0.05 ETH', rarity: 'epic', holders: 487 },
  { id: 'n2', name: 'PRISM 7 Fan Card S1', artist: 'PRISM 7', preview: 'GEM', price: '0.02 ETH', rarity: 'rare', holders: 1200 },
  { id: 'n3', name: 'Cyber City Artwork', artist: 'Neon V', preview: 'ART', price: '0.8 ETH', rarity: 'legendary', holders: 48 },
  { id: 'n4', name: 'Crystal Dance Moment', artist: 'Crystal Flow', preview: 'DNC', price: '0.12 ETH', rarity: 'epic', holders: 195 },
  { id: 'n5', name: 'Luna Lullaby Pass', artist: 'Luna Soft', preview: 'MON', price: '0.03 ETH', rarity: 'rare', holders: 820 },
  { id: 'n6', name: 'Thunder Show Ticket', artist: 'MC Thunder', preview: 'TKT', price: '0.01 ETH', rarity: 'common', holders: 3500 },
];

const RARITY_STYLES = {
  common: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-600/30' },
  rare: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  epic: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  legendary: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

type FanTab = 'home' | 'charts' | 'market' | 'profile';

export const FanAppFull = ({ onBack, lang, setLang }: { onBack: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const zh = lang === 'zh';
  const [activeTab, setActiveTab] = useState<FanTab>('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(HOT_TRACKS[0]);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set(['t1', 't3', 't6']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlayer, setShowPlayer] = useState(true);
  const [progress, setProgress] = useState(35);
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set(['1', '6']));

  // Mock fan profile
  const fanProfile = {
    name: 'CyberFan_01',
    level: 12,
    exp: 3400,
    maxExp: 5000,
    badges: 8,
    nfts: 5,
    following: followedArtists.size,
    totalListens: '12.4K',
    joinDate: '2024-08-15',
  };

  const toggleLike = (id: string) => {
    setLikedTracks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFollow = (id: string) => {
    setFollowedArtists(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const playTrack = (track: TrackItem) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setProgress(0);
  };

  // Simulate progress
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => setProgress(p => p >= 100 ? 0 : p + 0.5), 200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const NAV_ITEMS: { id: FanTab; icon: any; zh: string; en: string }[] = [
    { id: 'home', icon: Home, zh: '发现', en: 'Discover' },
    { id: 'charts', icon: TrendingUp, zh: '排行', en: 'Charts' },
    { id: 'market', icon: Gem, zh: 'NFT', en: 'NFT' },
    { id: 'profile', icon: User, zh: '我的', en: 'Profile' },
  ];

  return (
    <div className="h-screen w-full flex flex-col bg-gradient-to-b from-black via-gray-950 to-black text-white overflow-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/80 backdrop-blur-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition"><ChevronLeft className="w-5 h-5 text-gray-400" /></button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '艺人观赏台' : 'Fan Stage'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-1.5 rounded-lg hover:bg-white/10 transition text-gray-400">
            <Bell className="w-4 h-4" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-36 relative">
        {/* Danmaku overlay - visible when playing */}
        {isPlaying && activeTab === 'home' && (
          <DanmakuOverlay lang={lang} isPlaying={isPlaying} artistName={currentTrack.artist} />
        )}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .2 }}>

            {/* HOME / DISCOVER */}
            {activeTab === 'home' && (
              <div className="space-y-6 p-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:border-pink-500/40 focus:outline-none transition"
                    placeholder={zh ? '搜索艺人、歌曲、NFT...' : 'Search artists, tracks, NFTs...'} />
                </div>

                {/* Featured banner */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  className="relative bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl p-6 overflow-hidden border border-white/5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
                  <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-[10px] mb-2">HOT {zh ? '本周热门' : 'Hot This Week'}</Badge>
                  <h2 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "var(--font-display)" }}>Neon Tears</h2>
                  <p className="text-sm text-gray-400 mb-3">by Neon V · 1.2M {zh ? '播放' : 'plays'}</p>
                  <Button onClick={() => playTrack(HOT_TRACKS[0])} size="sm" className="bg-white text-black hover:bg-gray-200 gap-1 rounded-full px-4">
                    <Play className="w-3.5 h-3.5" /> {zh ? '立即收听' : 'Listen Now'}
                  </Button>
                </motion.div>

                {/* Trending Artists */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '热门艺人' : 'Trending Artists'}</h3>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {TRENDING_ARTISTS.map((artist, i) => (
                      <motion.div key={artist.id} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .05 }}
                        className="shrink-0 w-28 text-center group cursor-pointer">
                        <div className="relative mb-2 mx-auto w-20 h-20">
                          <img src={artist.avatar} alt="" className="w-full h-full rounded-full object-cover border-2 border-white/10 group-hover:border-pink-500/40 transition" />
                          {artist.trending && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center text-[8px]">HOT</div>}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-sm">{artist.type}</div>
                        </div>
                        <div className="text-xs font-semibold truncate">{artist.name}</div>
                        <div className="text-[10px] text-gray-500">{artist.fans}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Hot tracks list */}
                <div>
                  <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-display)" }}>{zh ? '热播歌曲' : 'Hot Tracks'}</h3>
                  <div className="space-y-1">
                    {HOT_TRACKS.slice(0, 5).map((track, i) => (
                      <motion.div key={track.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .04 }}
                        onClick={() => playTrack(track)}
                        className={`flex items-center gap-3 p-3 rounded-xl transition cursor-pointer ${currentTrack.id === track.id ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5'}`}>
                        <span className="text-xs text-gray-500 w-5 text-center font-bold">{i + 1}</span>
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg">{track.cover}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{track.title}</div>
                          <div className="text-[10px] text-gray-500">{track.artist} · {track.plays}</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); toggleLike(track.id); }}
                          className={`p-1.5 rounded-full transition ${likedTracks.has(track.id) ? 'text-pink-400' : 'text-gray-600 hover:text-gray-400'}`}>
                          <Heart className={`w-4 h-4 ${likedTracks.has(track.id) ? 'fill-current' : ''}`} />
                        </button>
                        <span className="text-xs text-gray-600">{track.duration}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CHARTS */}
            {activeTab === 'charts' && (
              <div className="space-y-4 p-4">
                <h2 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{zh ? '实时排行榜' : 'Live Charts'}</h2>
                <div className="flex gap-2 mb-2">
                  {[zh ? '播放量' : 'Plays', zh ? '涨粉榜' : 'Growth', zh ? '新人榜' : 'Newcomer'].map((tab, i) => (
                    <button key={i} className={`px-3 py-1.5 text-xs rounded-full border transition ${i === 0 ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : 'text-gray-500 border-white/5'}`}>{tab}</button>
                  ))}
                </div>
                <div className="space-y-1">
                  {HOT_TRACKS.map((track, i) => (
                    <motion.div key={track.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
                      onClick={() => playTrack(track)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                        i < 3 ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white' : 'bg-white/5 text-gray-500'
                      }`} style={{ fontFamily: "var(--font-display)" }}>{i + 1}</div>
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg">{track.cover}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{track.title}</div>
                        <div className="text-[10px] text-gray-500">{track.artist}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{track.plays}</div>
                        <div className="text-[10px] text-green-400">+{Math.floor(Math.random() * 50 + 10)}K</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleLike(track.id); }}
                        className={`p-1 ${likedTracks.has(track.id) ? 'text-pink-400' : 'text-gray-600'}`}>
                        <Heart className={`w-3.5 h-3.5 ${likedTracks.has(track.id) ? 'fill-current' : ''}`} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* NFT MARKET */}
            {activeTab === 'market' && (
              <div className="space-y-4 p-4">
                <h2 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{zh ? 'NFT 市场' : 'NFT Market'}</h2>
                <div className="flex gap-2 mb-2">
                  {[zh ? '全部' : 'All', zh ? '徽章' : 'Badge', zh ? '时刻' : 'Moment', zh ? '艺术品' : 'Art'].map((tab, i) => (
                    <button key={i} className={`px-3 py-1.5 text-xs rounded-full border transition ${i === 0 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'text-gray-500 border-white/5'}`}>{tab}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {NFT_MARKET.map((nft, i) => {
                    const rs = RARITY_STYLES[nft.rarity];
                    return (
                      <motion.div key={nft.id} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .06 }}
                        className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer hover:border-purple-500/30 transition ${rs.border}`}>
                        {nft.rarity === 'legendary' && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />}
                        <div className={`w-full aspect-square rounded-lg ${rs.bg} flex items-center justify-center mb-3`}>
                          <span className="text-4xl">{nft.preview}</span>
                        </div>
                        <div className="text-xs font-semibold truncate mb-0.5">{nft.name}</div>
                        <div className="text-[10px] text-gray-500 mb-2">{nft.artist}</div>
                        <div className="flex items-center justify-between">
                          <Badge className={`text-[10px] ${rs.color} ${rs.bg} border-0 capitalize`}>{nft.rarity}</Badge>
                          <span className="text-[10px] text-cyan-400 font-bold">{nft.price}</span>
                        </div>
                        <div className="text-[10px] text-gray-600 mt-1">{nft.holders} {zh ? '持有人' : 'holders'}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4 p-4">
                {/* Profile card */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-cyan-500/20 border-2 border-pink-500/30 flex items-center justify-center text-3xl mx-auto mb-3">USR</div>
                  <h3 className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{fanProfile.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-pink-500/10 text-pink-400 border-0">Lv.{fanProfile.level}</Badge>
                    <span className="text-xs text-gray-500">{zh ? '加入于' : 'Joined'} {fanProfile.joinDate}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>EXP</span><span>{fanProfile.exp}/{fanProfile.maxExp}</span></div>
                    <Progress value={(fanProfile.exp / fanProfile.maxExp) * 100} className="h-1.5" />
                  </div>
                </motion.div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: zh ? '关注' : 'Following', value: fanProfile.following, icon: Heart, color: 'text-pink-400' },
                    { label: zh ? '收听' : 'Listens', value: fanProfile.totalListens, icon: Music, color: 'text-cyan-400' },
                    { label: zh ? '徽章' : 'Badges', value: fanProfile.badges, icon: Award, color: 'text-amber-400' },
                    { label: zh ? 'NFT' : 'NFT', value: fanProfile.nfts, icon: Gem, color: 'text-purple-400' },
                  ].map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
                      className="bg-white/5 rounded-xl p-3 text-center">
                      <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                      <div className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
                      <div className="text-[10px] text-gray-500">{s.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Followed artists */}
                <div>
                  <h3 className="text-sm font-bold mb-3">{zh ? '已关注艺人' : 'Following'}</h3>
                  <div className="space-y-2">
                    {TRENDING_ARTISTS.filter(a => followedArtists.has(a.id)).map((artist, i) => (
                      <div key={artist.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <img src={artist.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{artist.name}</div>
                          <div className="text-[10px] text-gray-500">{artist.type} · {artist.fans} fans</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => toggleFollow(artist.id)} className="text-[10px] h-7 border-pink-500/20 text-pink-400">{zh ? '已关注' : 'Following'}</Button>
                      </div>
                    ))}
                    {followedArtists.size === 0 && <p className="text-xs text-gray-500 text-center py-4">{zh ? '还没有关注任何艺人' : 'Not following any artists yet'}</p>}
                  </div>
                </div>

                {/* Liked tracks */}
                <div>
                  <h3 className="text-sm font-bold mb-3">{zh ? '喜欢的歌曲' : 'Liked Tracks'}</h3>
                  <div className="space-y-1">
                    {HOT_TRACKS.filter(t => likedTracks.has(t.id)).map(track => (
                      <div key={track.id} onClick={() => playTrack(track)}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition cursor-pointer">
                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-sm">{track.cover}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{track.title}</div>
                          <div className="text-[10px] text-gray-500">{track.artist}</div>
                        </div>
                        <span className="text-[10px] text-gray-600">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mini Player */}
      {showPlayer && (
        <div className="fixed bottom-16 left-0 right-0 z-30">
          <div className="mx-3 bg-gray-900/95 border border-white/10 rounded-2xl backdrop-blur-xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-0.5 bg-gray-800">
              <motion.div className="h-full bg-gradient-to-r from-pink-500 to-purple-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg shrink-0">{currentTrack.cover}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{currentTrack.title}</div>
                <div className="text-[10px] text-gray-500">{currentTrack.artist}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); toggleLike(currentTrack.id); }}
                  className={`p-1.5 ${likedTracks.has(currentTrack.id) ? 'text-pink-400' : 'text-gray-500'}`}>
                  <Heart className={`w-4 h-4 ${likedTracks.has(currentTrack.id) ? 'fill-current' : ''}`} />
                </button>
                <button className="p-1.5 text-gray-500"><SkipBack className="w-4 h-4" /></button>
                <button onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button className="p-1.5 text-gray-500"><SkipForward className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/90 border-t border-white/5 backdrop-blur-xl">
        <div className="flex">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition ${activeTab === item.id ? 'text-pink-400' : 'text-gray-600'}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{zh ? item.zh : item.en}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};