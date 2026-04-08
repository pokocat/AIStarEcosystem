import { type ReactNode, Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ChevronDown,
  Coins,
  Cpu,
  Fingerprint,
  Globe as GlobeIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Plus,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  Users,
  Wallet,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { themeConfig, useTheme } from '../components/ThemeProvider';
import type { EarningPoint, Lang, MockSinger, ProducerPage, TransactionRecord } from '../types/app';

const AIIncubator = lazy(async () => {
  const module = await import('../components/AIIncubator');
  return { default: module.AIIncubator };
});
const DistributionPage = lazy(() => import('../components/DistributionPage'));
const MusicGenerationDialog = lazy(() => import('../components/MusicGenerationDialog'));
const NFTMintingDialog = lazy(() => import('../components/NFTMintingDialog'));
const OnboardingGuide = lazy(() => import('../components/OnboardingGuide'));
const ArtistSigningDialog = lazy(() => import('../components/ArtistSigningDialog'));
const ArtistDetailDialog = lazy(() => import('../components/ArtistDetailDialog'));
const ArtistListingDialog = lazy(() => import('../components/ArtistListingDialog'));

function SuspenseFallback({ label }: { label: string }) {
  return <div className="min-h-[360px] rounded-2xl border border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl flex items-center justify-center text-sm text-gray-500">{label}</div>;
}

function SidebarItem({
  icon,
  label,
  id,
  active,
  onClick,
  themeStyles,
}: {
  icon: ReactNode;
  label: string;
  id: ProducerPage;
  active: ProducerPage;
  onClick: (id: ProducerPage) => void;
  themeStyles: any;
}) {
  const activeStyles = active === id ? themeStyles.itemActive : themeStyles.itemBase;
  return <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${activeStyles}`}>{icon}<span>{label}</span></button>;
}

function EditorWorkspace({
  song,
  onBack,
}: {
  song: { id: number; title: string; status: string; plays: string; date: string };
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2">NLE Editor</div>
          <h2 className="text-3xl font-black tracking-tight text-white">{song.title}</h2>
          <p className="text-sm text-gray-400 mt-2">多轨道音频与镜头节奏编辑工作区。</p>
        </div>
        <Button variant="outline" onClick={onBack} className="border-white/10 hover:bg-white/5">返回录音棚</Button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-250px)]">
        <Card className="lg:col-span-4 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
          <CardHeader><CardTitle className="text-base">素材与轨道</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {['Vocal', 'Synth', 'Drums', 'FX'].map((track, index) => (
              <div key={track} className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-white">{track}</div>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">{index + 1}</Badge>
                </div>
                <div className="h-14 rounded-lg bg-black border border-white/5 flex items-center gap-1 px-2">
                  {[...Array(24)].map((_, barIndex) => <div key={barIndex} className="flex-1 bg-cyan-500/30 rounded-full" style={{ height: `${20 + ((barIndex + index * 7) % 10) * 6}%` }} />)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 overflow-hidden">
          <CardHeader><CardTitle className="text-base">时间轴</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-black/50 p-6 h-[420px] relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
              <div className="relative z-10 space-y-5">
                {['Lead Vocal', 'Harmony', 'Beat', 'Visual FX'].map((lane, laneIndex) => (
                  <div key={lane} className="space-y-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{lane}</div>
                    <div className="h-14 rounded-xl bg-[#09090b] border border-white/5 p-2 flex items-center gap-2">
                      {[28, 42, 34].map((width, clipIndex) => <div key={`${lane}-${clipIndex}`} className={`h-full rounded-lg border px-2 flex items-center text-xs font-bold ${clipIndex % 2 === 0 ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-purple-500/20 border-purple-500/30 text-purple-300'}`} style={{ width: `${width - laneIndex * 2}%` }}>Clip {clipIndex + 1}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">应用修改</Button>
              <Button variant="outline" className="border-white/10 hover:bg-white/5">导出成片</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ProducerDashboardPageProps {
  lang: Lang;
  copy: any;
  mockSingers: MockSinger[];
  earningData: EarningPoint[];
  transactions: TransactionRecord[];
  onLogout: () => void;
  onToggleLang: () => void;
}

export function ProducerDashboardPage({
  lang,
  copy,
  mockSingers,
  earningData,
  transactions,
  onLogout,
  onToggleLang,
}: ProducerDashboardPageProps) {
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const [activeSinger, setActiveSinger] = useState(mockSingers[0]);
  const [activePage, setActivePage] = useState<ProducerPage>('overview');
  const [personaParams, setPersonaParams] = useState({ sweetness: 50, energy: 80, mystery: 30 });
  const [generatedSongs, setGeneratedSongs] = useState([
    { id: 101, title: 'Neon Tears', status: 'Published', plays: '450k', date: '2024-03-10' },
    { id: 102, title: 'Cyber City Vibe', status: 'Draft', plays: '-', date: '2024-03-12' },
  ]);
  const [editingSong, setEditingSong] = useState<typeof generatedSongs[number] | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMusicGenerator, setShowMusicGenerator] = useState(false);
  const [showNFTMinting, setShowNFTMinting] = useState(false);
  const [signingArtist, setSigningArtist] = useState<any>(null);
  const [viewingArtist, setViewingArtist] = useState<any>(null);
  const [listingArtist, setListingArtist] = useState<any>(null);
  const [selectedTrackForNFT, setSelectedTrackForNFT] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    if (!completed) {
      const timer = window.setTimeout(() => setShowOnboarding(true), 500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  const marketArtists = mockSingers.map((artist, index) => ({
    id: index + 1,
    name: artist.name,
    style: artist.style,
    avatar: artist.avatar,
    price: `¥ ${(8800 + index * 1200).toLocaleString()}`,
    owner: lang === 'zh' ? '原创作者联盟' : 'Creator Guild',
    songs: 12 + index * 3,
    followers: `${25 + index * 8}k`,
  }));

  const navigate = (page: ProducerPage) => {
    startTransition(() => setActivePage(page));
    setMobileMenuOpen(false);
  };

  const overviewStats = [
    { label: copy.overview.metrics[0], value: String(mockSingers.length), accent: 'text-purple-400', bg: 'from-purple-900/30 to-purple-900/10 border-purple-500/20' },
    { label: copy.overview.metrics[1], value: '4.2M', accent: 'text-cyan-400', bg: 'from-cyan-900/30 to-cyan-900/10 border-cyan-500/20' },
    { label: copy.overview.metrics[2], value: '3', accent: 'text-emerald-400', bg: 'from-emerald-900/30 to-emerald-900/10 border-emerald-500/20' },
    { label: copy.overview.metrics[3], value: '¥45k', accent: 'text-pink-400', bg: 'from-pink-900/30 to-pink-900/10 border-pink-500/20' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#09090b] text-white font-sans overflow-hidden">
      <aside className={`hidden md:flex w-64 border-r flex-col z-30 ${themeStyles.bg} ${themeStyles.border}`}>
        <div className={`h-16 flex items-center px-4 border-b gap-2 ${themeStyles.border}`}>
          <div className={`w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center ${themeStyles.glow}`}><Zap className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-lg tracking-tight">AI Studio Pro</span>
        </div>
        <div className={`p-4 border-b ${themeStyles.border}`}>
          <label className="text-[10px] text-gray-500 font-bold mb-3 block uppercase tracking-wider">{copy.sidebar.switch}</label>
          <Dialog>
            <DialogTrigger asChild>
              <button className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="relative"><Avatar className="w-10 h-10 rounded-lg border border-white/10"><AvatarImage src={activeSinger.avatar} /><AvatarFallback>{activeSinger.name[0]}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#18181b] rounded-full" /></div>
                  <div className="text-left"><div className="text-sm font-bold leading-none group-hover:text-cyan-400 transition-colors">{activeSinger.name}</div><div className="text-[10px] text-gray-400 mt-1.5 bg-white/5 px-1.5 py-0.5 rounded inline-block">{activeSinger.style}</div></div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#18181b] border-white/10 text-white w-[90vw] md:w-full rounded-2xl">
              <DialogHeader><DialogTitle>{copy.sidebar.switch}</DialogTitle><DialogDescription>Select Project</DialogDescription></DialogHeader>
              <div className="space-y-2 mt-2">
                {mockSingers.map((singer) => <div key={singer.id} onClick={() => setActiveSinger(singer)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-cyan-500/30 transition-all"><Avatar className="w-12 h-12 rounded-lg"><AvatarImage src={singer.avatar} /></Avatar><div className="flex-1"><div className="font-bold text-base">{singer.name}</div><div className="text-xs text-gray-400 flex items-center gap-2 mt-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />{singer.style} • {singer.status}</div></div>{activeSinger.id === singer.id && <Sparkles className="w-5 h-5 text-cyan-500" />}</div>)}
                <Button variant="outline" className="w-full border-dashed border-white/20 text-gray-400 hover:text-white hover:bg-white/5 h-12 mt-2"><Plus className="w-4 h-4 mr-2" /> {copy.sidebar.new_project}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <ThemeSwitcher lang={lang} />
          <div className="h-2" />
          <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label={copy.sidebar.dashboard} id="overview" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Fingerprint className="w-4 h-4" />} label={copy.sidebar.incubator} id="persona" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Mic2 className="w-4 h-4" />} label={copy.sidebar.studio} id="studio" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Rocket className="w-4 h-4" />} label={copy.sidebar.distribution} id="distribution" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Coins className="w-4 h-4" />} label={copy.sidebar.mint} id="nft_mint" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Wallet className="w-4 h-4" />} label={copy.sidebar.earnings} id="earnings" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          <SidebarItem icon={<Smile className="w-4 h-4" />} label={copy.sidebar.community} id="community" active={activePage} onClick={navigate} themeStyles={themeStyles} />
        </div>
        <div className={`p-4 border-t bg-black/20 space-y-2 ${themeStyles.border}`}>
          <Button variant="ghost" onClick={onToggleLang} className="w-full justify-start text-gray-500 hover:text-white"><GlobeIcon className="w-4 h-4 mr-2" /> {lang === 'zh' ? 'Switch to English' : '切换中文'}</Button>
          <Button variant="ghost" onClick={onLogout} className="w-full justify-start text-gray-500 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4 mr-2" /> {copy.sidebar.logout}</Button>
        </div>
      </aside>

      <div className="md:hidden flex items-center justify-between h-16 px-4 border-b border-white/10 bg-[#0c0c0e]/90 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(8,145,178,0.5)]"><Zap className="w-4 h-4 text-white" /></div><span className="font-bold text-lg tracking-tight">AI Studio</span></div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((prev) => !prev)} className="text-white">{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</Button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="md:hidden fixed inset-x-0 top-16 z-40 bg-[#0c0c0e]/95 backdrop-blur-xl border-b border-white/10 p-4 space-y-2">
            <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label={copy.sidebar.dashboard} id="overview" active={activePage} onClick={navigate} themeStyles={themeStyles} />
            <SidebarItem icon={<Fingerprint className="w-4 h-4" />} label={copy.sidebar.incubator} id="persona" active={activePage} onClick={navigate} themeStyles={themeStyles} />
            <SidebarItem icon={<Mic2 className="w-4 h-4" />} label={copy.sidebar.studio} id="studio" active={activePage} onClick={navigate} themeStyles={themeStyles} />
            <SidebarItem icon={<Rocket className="w-4 h-4" />} label={copy.sidebar.distribution} id="distribution" active={activePage} onClick={navigate} themeStyles={themeStyles} />
            <SidebarItem icon={<Coins className="w-4 h-4" />} label={copy.sidebar.mint} id="nft_mint" active={activePage} onClick={navigate} themeStyles={themeStyles} />
            <SidebarItem icon={<Wallet className="w-4 h-4" />} label={copy.sidebar.earnings} id="earnings" active={activePage} onClick={navigate} themeStyles={themeStyles} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto relative bg-[#09090b] pb-24 md:pb-0">
        <header className="hidden md:flex h-16 border-b border-white/10 items-center justify-between px-8 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-lg font-medium text-white flex items-center gap-3"><span className="text-gray-500">Workspace /</span> <span className="capitalize">{activePage.replace('_', ' ')}</span></h2>
          <div className="flex items-center gap-4"><div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400"><Cpu className="w-3 h-3" /><span>GPU Connected</span></div><div className="w-px h-6 bg-white/10" /><Button size="sm" className="bg-white text-black hover:bg-gray-200 font-bold rounded-full">Export</Button></div>
        </header>

        <div className="p-6 md:p-10 pb-24 max-w-7xl mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              {activePage === 'overview' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                      <div className="text-cyan-500 font-mono text-xs mb-2 tracking-widest uppercase flex items-center gap-2"><div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" /> AI Star Agency</div>
                      <h1 className="text-4xl font-black tracking-tight text-white mb-1">{copy.overview.title}</h1>
                      <p className="text-gray-400 font-medium">{copy.overview.subtitle}</p>
                    </div>
                    <Button onClick={() => navigate('persona')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black tracking-widest h-12 px-6 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.3)]"><Plus className="w-5 h-5 mr-2" /> {copy.overview.create}</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    {overviewStats.map((stat) => <Card key={stat.label} className={`group bg-gradient-to-br ${stat.bg} backdrop-blur-xl`}><CardContent className="p-6"><div className={`text-3xl font-black ${stat.accent} mb-2`}>{stat.value}</div><div className="text-sm text-gray-400">{stat.label}</div></CardContent></Card>)}
                  </div>

                  <div className="grid lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-7 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                      <CardHeader><CardTitle>Revenue & Activity</CardTitle></CardHeader>
                      <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={earningData}>
                            <defs>
                              <linearGradient id="song" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                              <linearGradient id="badge" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <Area type="monotone" dataKey="song" stroke="#06b6d4" fill="url(#song)" />
                            <Area type="monotone" dataKey="badge" stroke="#a855f7" fill="url(#badge)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <div className="lg:col-span-5 space-y-6">
                      <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                        <CardHeader><CardTitle>Market Opportunities</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          {marketArtists.map((artist) => (
                            <div key={artist.id} className="rounded-xl border border-white/10 bg-black/40 p-4 flex items-center gap-4">
                              <Avatar className="w-14 h-14 rounded-xl"><AvatarImage src={artist.avatar} /><AvatarFallback>{artist.name[0]}</AvatarFallback></Avatar>
                              <div className="flex-1 min-w-0"><div className="font-bold text-white">{artist.name}</div><div className="text-xs text-gray-400">{artist.style} • {artist.followers}</div></div>
                              <div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => setViewingArtist(artist)}>详情</Button><Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={() => setSigningArtist(artist)}>签约</Button></div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-xl border-cyan-500/30">
                        <CardContent className="p-6 text-center">
                          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4 border border-cyan-400/30"><ShoppingBag className="w-8 h-8 text-cyan-400" /></div>
                          <h3 className="text-xl font-black text-white mb-2 tracking-wide">{lang === 'zh' ? '快速上架艺人市场' : 'List Artist Fast'}</h3>
                          <p className="text-xs text-cyan-100/70 mb-5 leading-relaxed">{lang === 'zh' ? '把当前艺人打包为可签约资产，验证市场需求。' : 'Turn the current artist into a market-facing listing.'}</p>
                          <Button onClick={() => setListingArtist(marketArtists[0])} className="w-full bg-black/20 hover:bg-black/40 border border-cyan-500/30 text-cyan-200">Open Listing Dialog</Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {activePage === 'persona' && <Suspense fallback={<SuspenseFallback label="Loading AI Incubator..." />}><AIIncubator lang={lang} onBack={() => navigate('overview')} activeSinger={activeSinger} personaParams={personaParams} setPersonaParams={setPersonaParams} /></Suspense>}

              {activePage === 'studio' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div><div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4 uppercase tracking-widest"><Wand2 className="w-3 h-3" /> Studio Core</div><h2 className="text-3xl font-black tracking-tight">{copy.studio.title}</h2><p className="text-gray-400 text-sm mt-2">{copy.studio.subtitle}</p></div>
                    <Button onClick={() => setShowMusicGenerator(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold h-12 px-6 rounded-xl"><Sparkles className="w-4 h-4 mr-2" /> {copy.studio.generate}</Button>
                  </div>

                  <div className="grid lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-5 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                      <CardHeader><CardTitle>{lang === 'zh' ? '当前歌手参数' : 'Persona Snapshot'}</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(personaParams).map(([key, value]) => <div key={key} className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="capitalize">{key}</span><span className="text-cyan-400 font-mono">{value}</span></div><Progress value={value} className="h-2 bg-black/50" /></div>)}
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-7 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                      <CardHeader><CardTitle>{copy.studio.library}</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {generatedSongs.map((song) => <motion.div key={song.id} onClick={() => { setEditingSong(song); navigate('editor'); }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="group flex items-center justify-between p-4 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer"><div><div className="font-bold text-white">{song.title}</div><div className="text-xs text-gray-500 mt-1">{song.date} • {song.status}</div></div><Badge variant="outline" className="border-white/10 text-gray-300">{song.plays}</Badge></motion.div>)}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activePage === 'editor' && editingSong && <EditorWorkspace song={editingSong} onBack={() => { setEditingSong(null); navigate('studio'); }} />}

              {activePage === 'distribution' && <Suspense fallback={<SuspenseFallback label="Loading Distribution..." />}><DistributionPage songs={generatedSongs} lang={lang} /></Suspense>}

              {activePage === 'nft_mint' && (
                <div className="grid lg:grid-cols-2 gap-8">
                  <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                    <CardHeader><CardTitle>{copy.mint.title}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-400">{copy.mint.subtitle}</p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {generatedSongs.map((song) => <div key={song.id} className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3"><div className="font-bold text-white">{song.title}</div><div className="text-xs text-gray-500">{song.status} • {song.date}</div><Button className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500" onClick={() => { setSelectedTrackForNFT(song); setShowNFTMinting(true); }}><Coins className="w-4 h-4 mr-2" /> {copy.mint.open}</Button></div>)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                    <CardHeader><CardTitle>{lang === 'zh' ? '版权保护登记' : 'Copyright Filing'}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300 flex items-start gap-3"><ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5" /><span>{lang === 'zh' ? '把 AI 协同创作声明、母带、封面和授权材料统一建档，为后续全球分发准备合规资产。' : 'Register AI co-creation statements, masters, cover art, and license materials for compliant global release.'}</span></div>
                      <Input placeholder={lang === 'zh' ? '作品名称' : 'Track title'} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50" />
                      <Input placeholder={lang === 'zh' ? 'AI 工具来源' : 'AI tool used'} className="bg-black/50 border-white/10 h-12 focus:border-cyan-500/50" />
                      <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">{lang === 'zh' ? '提交登记' : 'Submit Filing'}</Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activePage === 'earnings' && (
                <div className="space-y-8">
                  <div className="border-b border-white/10 pb-6"><h2 className="text-3xl font-black tracking-tight">{copy.earnings.title}</h2><p className="text-sm text-gray-400 mt-2">{copy.earnings.subtitle}</p></div>
                  <div className="grid lg:grid-cols-12 gap-8">
                    <Card className="lg:col-span-5 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
                      <CardHeader><CardTitle>{lang === 'zh' ? '收入构成' : 'Revenue Mix'}</CardTitle></CardHeader>
                      <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={earningData}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <Bar dataKey="song" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="badge" fill="#a855f7" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-7 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 overflow-hidden">
                      <CardHeader><CardTitle>{lang === 'zh' ? '交易记录' : 'Transactions'}</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white/5 text-gray-500"><tr><th className="p-4 text-left">Date</th><th className="p-4 text-left">Description</th><th className="p-4 text-left">Amount</th><th className="p-4 text-right">Status</th></tr></thead>
                            <tbody className="divide-y divide-white/5">
                              {transactions.map((transaction) => <tr key={transaction.id} className="hover:bg-white/5"><td className="p-4 text-gray-500">{transaction.date}</td><td className="p-4 font-bold text-gray-300">{transaction.desc}</td><td className={`p-4 font-black font-mono ${transaction.amount.startsWith('+') ? 'text-emerald-400' : 'text-white'}`}>{transaction.amount}</td><td className="p-4 text-right"><Badge variant="outline" className={`border-0 px-3 py-1 font-bold ${transaction.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{transaction.status}</Badge></td></tr>)}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activePage === 'community' && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black/0 to-transparent pointer-events-none" />
                  <div className="w-28 h-28 bg-[#0c0c0e] rounded-3xl flex items-center justify-center border-2 border-red-500/30 relative z-10 shadow-[0_0_50px_rgba(239,68,68,0.2)]"><Smile className="w-12 h-12 text-red-500" /></div>
                  <h3 className="text-4xl font-black text-white mb-4 tracking-tight mt-8">{copy.locked.title}</h3>
                  <p className="text-gray-400 mb-10 leading-relaxed max-w-sm text-sm">{copy.locked.desc}</p>
                  <div className="grid grid-cols-2 gap-4 w-full"><Button variant="outline" onClick={() => navigate('overview')} className="h-14 border-white/10 hover:bg-white/5 font-bold tracking-wider rounded-xl">{copy.locked.back}</Button><Button className="h-14 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black tracking-widest border border-red-500/50 rounded-xl">UPGRADE</Button></div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[88px] bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around px-2 pt-2">
        {[
          { id: 'overview' as const, icon: <LayoutDashboard className="w-6 h-6" />, label: lang === 'zh' ? '总览' : 'Home' },
          { id: 'persona' as const, icon: <Fingerprint className="w-6 h-6" />, label: lang === 'zh' ? '孵化' : 'AI' },
          { id: 'studio' as const, icon: <Mic2 className="w-6 h-6" />, label: lang === 'zh' ? '制作' : 'Studio' },
          { id: 'distribution' as const, icon: <Rocket className="w-6 h-6" />, label: lang === 'zh' ? '发行' : 'Release' },
          { id: 'nft_mint' as const, icon: <Coins className="w-6 h-6" />, label: lang === 'zh' ? '铸造' : 'Mint' },
        ].map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={`flex flex-col items-center justify-center w-16 gap-1.5 transition-all ${activePage === item.id ? 'text-cyan-400 scale-110' : 'text-gray-500 hover:text-gray-300'}`}>{item.icon}<span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span></button>)}
      </div>

      <Suspense fallback={null}>
        <ArtistSigningDialog artist={signingArtist} isOpen={!!signingArtist} onClose={() => setSigningArtist(null)} onSuccess={() => setSigningArtist(null)} lang={lang} />
        <ArtistDetailDialog artist={viewingArtist} isOpen={!!viewingArtist} onClose={() => setViewingArtist(null)} lang={lang} onCreateMusic={() => { if (viewingArtist) { setActiveSinger(viewingArtist); navigate('studio'); setViewingArtist(null); } }} />
        <ArtistListingDialog artist={listingArtist} isOpen={!!listingArtist} onClose={() => setListingArtist(null)} onSuccess={() => setListingArtist(null)} lang={lang} />
        <OnboardingGuide isOpen={showOnboarding} onComplete={() => setShowOnboarding(false)} lang={lang} onNavigate={(page) => navigate(page as ProducerPage)} />
        <MusicGenerationDialog isOpen={showMusicGenerator} onClose={() => setShowMusicGenerator(false)} onSuccess={(track) => setGeneratedSongs((prev) => [track, ...prev])} lang={lang} />
        <NFTMintingDialog isOpen={showNFTMinting} onClose={() => setShowNFTMinting(false)} onSuccess={() => setShowNFTMinting(false)} lang={lang} track={selectedTrackForNFT} />
      </Suspense>
    </div>
  );
}
