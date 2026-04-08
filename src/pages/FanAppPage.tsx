import { type ReactElement, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BarChart3, ChevronDown, Flame, Heart, Home as HomeIcon, LogOut, Music2, Pause, Play, Share2, ShoppingBag, SkipBack, SkipForward, UserCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import type { ChartTrack, Lang, LyricLine } from '../types/app';

interface FanAppPageProps {
  lang: Lang;
  copy: any;
  chartData: ChartTrack[];
  lyrics: LyricLine[];
  onBack: () => void;
  onToggleLang: () => void;
}

function NavButton({ icon, label, active, onClick }: { icon: ReactElement; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${active ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export function FanAppPage({ lang, copy, chartData, lyrics, onBack, onToggleLang }: FanAppPageProps) {
  const [activeTab, setActiveTab] = useState<'discovery' | 'charts' | 'market' | 'me'>('charts');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex justify-center bg-zinc-900">
      <div className="w-full max-w-md bg-black min-h-screen relative shadow-2xl flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between bg-black/80 backdrop-blur-md sticky top-0 z-30 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center"><Music2 className="w-4 h-4 text-white" /></div>
            <span className="font-bold text-lg">{copy.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onToggleLang} className="h-8 w-8 text-xs">{lang.toUpperCase()}</Button>
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
          {activeTab === 'charts' && (
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{copy.title} 🏆</h2><Badge variant="secondary" className="bg-white/10 text-xs">Real-time</Badge></div>
              <div className="flex items-end justify-center gap-4 py-4">
                {[chartData[1], chartData[0], chartData[2]].map((item, index) => {
                  const rank = index === 1 ? 1 : index === 0 ? 2 : 3;
                  const size = rank === 1 ? 'w-24 h-24' : 'w-20 h-20';
                  const border = rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-400' : 'border-orange-700';
                  return (
                    <div key={item.id} className={`flex flex-col items-center gap-2 w-1/3 ${rank === 1 ? '-mt-6' : ''}`}>
                      <div className="relative">
                        {rank === 1 && <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400">👑</div>}
                        <div className={`${size} rounded-full border-2 ${border} p-1 shadow-[0_0_20px_rgba(250,204,21,0.3)]`}>
                          <img src={item.cover} className="w-full h-full rounded-full object-cover" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full border border-black">{rank}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-sm truncate w-24">{item.artist}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {item.votes}</div>
                        {rank === 1 && <Button size="sm" className="h-6 text-xs mt-2 bg-gradient-to-r from-yellow-500 to-orange-500 border-0 rounded-full px-4">{copy.vote}</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3 mt-4">
                {chartData.slice(3).map((item, index) => (
                  <div key={item.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="text-gray-500 font-mono w-4 text-center">{index + 4}</div>
                    <img src={item.cover} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{item.title}</div><div className="text-xs text-gray-400">{item.artist}</div></div>
                    <div className="flex flex-col items-end gap-1"><div className="text-xs font-bold text-gray-300 flex items-center gap-1"><Flame className="w-3 h-3 text-gray-500" /> {item.votes}</div><Button size="icon" variant="ghost" className="h-6 w-6 rounded-full border border-white/10 hover:bg-pink-500/20 hover:text-pink-500"><Heart className="w-3 h-3" /></Button></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className="p-4 space-y-6">
              <h2 className="text-xl font-bold">{copy.market_title} 💎</h2>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="bg-[#121214] border border-white/10 overflow-hidden rounded-xl">
                    <div className="aspect-square bg-gray-800 relative">
                      <img src={`https://images.unsplash.com/photo-${1600000000000 + item * 999}?w=400`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white border border-white/20">{copy.remaining} 12</div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-sm truncate">Neon Genesis #{item}02</h4>
                      <div className="flex justify-between items-center mt-2"><span className="text-cyan-400 font-bold text-sm">¥ 19.9</span><Button size="sm" className="h-6 text-xs bg-white text-black hover:bg-gray-200">{copy.mint}</Button></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'discovery' && (
            <div className="p-4 space-y-6">
              <div className="relative h-48 rounded-2xl overflow-hidden"><img src="https://images.unsplash.com/photo-1514525253440-b393452e2347?w=600" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" /><div className="absolute bottom-4 left-4"><Badge className="bg-pink-600 border-0 mb-2">New Release</Badge><h2 className="text-2xl font-bold">Electric Dreams</h2><p className="text-sm text-gray-300">Project: Zero • EP</p></div></div>
              <div><h3 className="font-bold mb-4">{copy.guess_like}</h3><div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">{[1, 2, 3, 4].map((item) => (<div key={item} className="w-32 flex-shrink-0 space-y-2"><img src={`https://images.unsplash.com/photo-${1500000000000 + item * 5000}?w=300`} className="w-32 h-32 rounded-lg object-cover" /><div className="text-sm font-bold truncate">Song Name {item}</div><div className="text-xs text-gray-500">Artist {item}</div></div>))}</div></div>
            </div>
          )}
        </div>

        <div onClick={() => setShowFullPlayer(true)} className="absolute bottom-16 left-4 right-4 bg-[#1c1c1e]/90 backdrop-blur-md border border-white/10 rounded-full p-2 pr-4 flex items-center justify-between shadow-xl z-20 cursor-pointer hover:scale-105 transition-transform">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-white/10 ${isPlaying ? 'animate-spin-slow' : ''}`}><img src={chartData[0].cover} className="w-full h-full object-cover" /></div>
            <div><div className="text-sm font-bold text-white">{chartData[0].title}</div><div className="text-xs text-gray-400">{chartData[0].artist}</div></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 flex items-center gap-0.5">{[...Array(6)].map((_, index) => (<div key={index} className={`w-0.5 bg-cyan-500 rounded-full ${isPlaying ? 'animate-music-bar' : 'h-1'}`} style={{ animationDelay: `${index * 0.1}s` }} />))}</div>
            <div onClick={(event) => { event.stopPropagation(); setIsPlaying((prev) => !prev); }} className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200">
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showFullPlayer && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#0c0c0e] z-50 flex flex-col">
              <div className="h-16 px-6 flex items-center justify-between">
                <Button size="icon" variant="ghost" onClick={() => setShowFullPlayer(false)} className="text-white"><ChevronDown className="w-6 h-6" /></Button>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Now Playing</div>
                <Button size="icon" variant="ghost" className="text-white"><Share2 className="w-5 h-5" /></Button>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
                <div className={`w-72 h-72 rounded-full border-8 border-[#1c1c1e] shadow-2xl overflow-hidden relative ${isPlaying ? 'animate-spin-slow' : ''}`}><img src={chartData[0].cover} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/20 rounded-full pointer-events-none" /><div className="absolute inset-0 border-[40px] border-black/80 rounded-full pointer-events-none" /></div>
                <div className="text-center space-y-2"><h2 className="text-2xl font-bold text-white">{chartData[0].title}</h2><p className="text-cyan-400 font-medium text-lg">{chartData[0].artist}</p></div>
                <div className="w-full space-y-4">
                  <div className="h-32 overflow-hidden relative mask-linear-y text-center">
                    <div className="space-y-4">{lyrics.map((line, index) => (<p key={`${line.time}-${index}`} className={`text-lg transition-all duration-500 ${index === 1 ? 'text-white font-bold scale-110' : 'text-gray-600'}`}>{line.text}</p>))}</div>
                  </div>
                  <div className="space-y-2"><div className="relative h-1 bg-gray-800 rounded-full overflow-hidden"><div className="absolute h-full w-1/3 bg-white rounded-full" /></div><div className="flex justify-between text-xs text-gray-500 font-mono"><span>1:12</span><span>3:45</span></div></div>
                  <div className="flex justify-between items-center px-4"><SkipBack className="w-8 h-8 text-white" /><div onClick={() => setIsPlaying((prev) => !prev)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-white/20">{isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}</div><SkipForward className="w-8 h-8 text-white" /></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-16 bg-black border-t border-white/10 flex items-center justify-around px-2 absolute bottom-0 w-full z-30">
          <NavButton icon={<HomeIcon className="w-6 h-6" />} label={copy.discovery} active={activeTab === 'discovery'} onClick={() => setActiveTab('discovery')} />
          <NavButton icon={<BarChart3 className="w-6 h-6" />} label={copy.charts} active={activeTab === 'charts'} onClick={() => setActiveTab('charts')} />
          <NavButton icon={<ShoppingBag className="w-6 h-6" />} label={copy.market} active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <NavButton icon={<UserCircle className="w-6 h-6" />} label={copy.me} active={activeTab === 'me'} onClick={() => setActiveTab('me')} />
        </div>
      </div>
    </div>
  );
}
