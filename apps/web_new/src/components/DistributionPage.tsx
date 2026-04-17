"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { 
  Rocket, Music, Globe, Globe2, Youtube, CheckCircle2, AlertTriangle, 
  Plus, Settings, Disc, RefreshCw, Activity, ChevronRight, TrendingUp,
  Zap, Music2, Check
} from 'lucide-react';

interface Song {
  id: string;
  title: string;
  date: string;
  status: 'Published' | 'Draft' | 'Processing';
  plays?: string;
}

interface DistributionPageProps {
  songs: Song[];
  lang: 'zh' | 'en';
}

interface AccountStatus {
  connected: boolean;
  email?: string;
}

interface ChannelConfig {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: any;
  iconBg: string;
  requiredAccounts: string[];
  benefits: string[];
  benefitsEn: string[];
}

const accountNames: Record<string, { zh: string; en: string }> = {
  distrokid: { zh: 'DistroKid', en: 'DistroKid' },
  tencent_music: { zh: '腾讯音乐人 (启明星)', en: 'Tencent Music' },
  netease_music: { zh: '网易云音乐人', en: 'NetEase Music' },
  spotify_artists: { zh: 'Spotify for Artists', en: 'Spotify for Artists' },
  douyin_creator: { zh: '抖音创作者平台', en: 'Douyin Creator' },
  tiktok_business: { zh: 'TikTok for Business', en: 'TikTok Business' }
};

export default function DistributionPage({ songs, lang }: DistributionPageProps) {
  const [selectedTrack, setSelectedTrack] = useState<Song | null>(songs[0] || null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['domestic', 'global']);
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  const [preSaveEnabled, setPreSaveEnabled] = useState(false);

  // 模拟账号绑定状态
  const [accountStatus, setAccountStatus] = useState<Record<string, AccountStatus>>({
    distrokid: { connected: true, email: 'artist@demo.com' },
    tencent_music: { connected: false },
    netease_music: { connected: false },
    spotify_artists: { connected: false },
    douyin_creator: { connected: false },
    tiktok_business: { connected: false }
  });

  const channels: ChannelConfig[] = [
    {
      id: 'domestic',
      name: '国内AI专属通道',
      nameEn: 'Domestic AI Channel',
      description: '腾讯音乐「启明星」/ 网易云音乐人',
      icon: Globe,
      iconBg: 'from-cyan-500 to-blue-600',
      requiredAccounts: ['tencent_music', 'netease_music'],
      benefits: [
        '✓ 自动标记「AI创作」标签',
        '✓ QQ音乐、酷狗、酷我同步上架',
        '✓ 平台播放激励金（每万次播放约¥30-80）',
        '✓ 支持纯AI生成作品发行'
      ],
      benefitsEn: [
        '✓ Auto-tag "AI Created"',
        '✓ QQ Music, Kugou, Kuwo sync',
        '✓ Platform play incentives',
        '✓ Pure AI works supported'
      ]
    },
    {
      id: 'global',
      name: '全球流媒体发行',
      nameEn: 'Global DSPs',
      description: 'DistroKid / TuneCore / CD Baby',
      icon: Globe2,
      iconBg: 'from-emerald-500 to-teal-600',
      requiredAccounts: ['distrokid', 'spotify_artists'],
      benefits: [
        '✓ Spotify, Apple Music, YouTube Music, Amazon',
        '✓ 150+ 平台同步发行',
        '✓ 赚取流媒体版税（需商业授权）',
        '✓ 支持 ISRC 与 UPC 国际标准码'
      ],
      benefitsEn: [
        '✓ Spotify, Apple Music, YouTube Music, Amazon',
        '✓ 150+ platforms sync',
        '✓ Earn streaming royalties',
        '✓ ISRC & UPC support'
      ]
    },
    {
      id: 'shortVideo',
      name: '短视频矩阵打歌',
      nameEn: 'Short Video Matrix',
      description: '抖音 / TikTok / 快手 / Instagram Reels',
      icon: Youtube,
      iconBg: 'from-pink-500 to-rose-600',
      requiredAccounts: ['douyin_creator', 'tiktok_business'],
      benefits: [
        '✓ AI 自动生成 15s/30s/60s 竖屏切片',
        '✓ 批量发布至多平台矩阵账号',
        '✓ 算法优化标题、话题标签',
        '✓ 引流至完整版 & NFT 购买页'
      ],
      benefitsEn: [
        '✓ Auto-generate 15s/30s/60s vertical clips',
        '✓ Batch post to matrix accounts',
        '✓ Algorithm-optimized titles & hashtags',
        '✓ Drive traffic to full version & NFT'
      ]
    }
  ];

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleConnectAccount = (accountKey: string) => {
    // 模拟OAuth授权流程
    console.log('Connecting account:', accountKey);
    setAccountStatus(prev => ({
      ...prev,
      [accountKey]: { connected: true, email: 'user@demo.com' }
    }));
  };

  const handleDisconnectAccount = (accountKey: string) => {
    setAccountStatus(prev => ({
      ...prev,
      [accountKey]: { connected: false }
    }));
  };

  const getRequiredAccountsForSelectedChannels = () => {
    const accounts = new Set<string>();
    selectedChannels.forEach(channelId => {
      const channel = channels.find(c => c.id === channelId);
      channel?.requiredAccounts.forEach(acc => accounts.add(acc));
    });
    return Array.from(accounts);
  };

  const getUnconnectedAccounts = () => {
    return getRequiredAccountsForSelectedChannels().filter(
      acc => !accountStatus[acc]?.connected
    );
  };

  const getTotalPlatforms = () => {
    let total = 0;
    if (selectedChannels.includes('domestic')) total += 4; // QQ音乐、酷狗、酷我、网易云
    if (selectedChannels.includes('global')) total += 150;
    if (selectedChannels.includes('shortVideo')) total += 6;
    return total;
  };

  const canSubmit = () => {
    return selectedTrack && selectedChannels.length > 0 && getUnconnectedAccounts().length === 0;
  };

  const t = lang === 'zh' ? {
    title: '全网发行 & 多平台分发',
    subtitle: '选择作品、配置发行渠道、绑定平台账号，一键提交至全球流媒体',
    step1: '选择要发行的作品',
    step2: '选择发行渠道 & 绑定账号',
    step3: '发行设置',
    preview: '发行预览',
    selectedTrack: '选中作品',
    selectedChannels: '已选渠道',
    coverage: '覆盖平台',
    pendingAccounts: '待绑定账号',
    requiredAccounts: '所需平台账号',
    connected: '已连接',
    notConnected: '未连接',
    authorize: '立即授权',
    disconnect: '解绑',
    optional: '可选',
    releaseSchedule: '发行时间设置',
    preSaveCampaign: 'Pre-save 活动',
    enablePreSave: '开启预存活动',
    preSaveDesc: '提前15天开启预约，积累首发热度',
    submit: '提交发行审核',
    allReady: '所有账号已就绪',
    needsAuth: '需授权账号',
    firstRelease: '首次发行',
    reRelease: '可重新发行',
    published: '已发布',
    draft: '草稿',
    platforms: '个平台'
  } : {
    title: 'Global Distribution',
    subtitle: 'Select track, configure channels, connect accounts, distribute globally',
    step1: 'Select Track to Distribute',
    step2: 'Select Channels & Connect Accounts',
    step3: 'Release Settings',
    preview: 'Release Preview',
    selectedTrack: 'Selected Track',
    selectedChannels: 'Selected Channels',
    coverage: 'Platform Coverage',
    pendingAccounts: 'Pending Accounts',
    requiredAccounts: 'Required Accounts',
    connected: 'Connected',
    notConnected: 'Not Connected',
    authorize: 'Authorize',
    disconnect: 'Disconnect',
    optional: 'Optional',
    releaseSchedule: 'Release Schedule',
    preSaveCampaign: 'Pre-save Campaign',
    enablePreSave: 'Enable Pre-save',
    preSaveDesc: 'Start 15 days early to build momentum',
    submit: 'Submit for Review',
    allReady: 'All Accounts Ready',
    needsAuth: 'Needs Authorization',
    firstRelease: 'First Release',
    reRelease: 'Re-release',
    published: 'Published',
    draft: 'Draft',
    platforms: ' platforms'
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8 h-[calc(100vh-180px)]">
      {/* Left Column: Configuration */}
      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-4 custom-scrollbar">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4 uppercase tracking-widest">
            <Rocket className="w-3 h-3"/> Distribution Engine
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">{t.title}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{t.subtitle}</p>
        </div>

        {/* Step 1: Select Track */}
        <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-200">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-black">1</div>
              {t.step1}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            {songs.filter(s => s.status !== 'Processing').slice(0, 3).map((song) => (
              <label 
                key={song.id} 
                className={`flex items-center gap-4 p-4 rounded-xl bg-black/40 border transition-all cursor-pointer ${
                  selectedTrack?.id === song.id 
                    ? 'border-cyan-500 bg-cyan-500/10' 
                    : 'border-white/5 hover:border-cyan-500/50'
                }`}
              >
                <input 
                  type="radio" 
                  name="release-track" 
                  checked={selectedTrack?.id === song.id}
                  onChange={() => setSelectedTrack(song)}
                  className="w-4 h-4 accent-cyan-500" 
                />
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Music className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white mb-1">{song.title}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-3 font-mono">
                    <span>{song.date}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    <span>{song.status === 'Published' ? t.published : t.draft}</span>
                  </div>
                </div>
                <Badge className={`${
                  song.status === 'Published' 
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                } border text-[10px]`}>
                  {song.status === 'Published' ? t.reRelease : t.firstRelease}
                </Badge>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Step 2: Select Channels & Bind Accounts */}
        <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50" />
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-200">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black">2</div>
              {t.step2}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            {channels.map((channel) => {
              const isSelected = selectedChannels.includes(channel.id);
              const Icon = channel.icon;
              
              return (
                <div 
                  key={channel.id}
                  className={`rounded-xl border transition-all ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-500/10' 
                      : 'border-white/10 bg-black/40'
                  }`}
                >
                  {/* Channel Header */}
                  <label className="flex items-start gap-4 p-5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleChannel(channel.id)}
                      className="w-5 h-5 accent-purple-500 mt-0.5" 
                    />
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${channel.iconBg} flex items-center justify-center shadow-lg shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm mb-1">
                        {lang === 'zh' ? channel.name : channel.nameEn}
                      </div>
                      <div className="text-[10px] text-gray-500">{channel.description}</div>
                    </div>
                  </label>

                  {/* Required Accounts - Show when selected */}
                  {isSelected && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="pt-3 border-t border-white/10">
                        <Label className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                          <Settings className="w-3 h-3" />
                          {t.requiredAccounts}
                        </Label>
                        <div className="space-y-2">
                          {channel.requiredAccounts.map((accountKey) => {
                            const account = accountStatus[accountKey];
                            const accountName = accountNames[accountKey];
                            const isConnected = account?.connected;
                            const isOptional = accountKey === 'spotify_artists';

                            return (
                              <div 
                                key={accountKey}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  isConnected 
                                    ? 'bg-emerald-500/5 border-emerald-500/20' 
                                    : 'bg-yellow-500/5 border-yellow-500/20'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                  )}
                                  <div>
                                    <div className="text-sm font-bold text-white">
                                      {lang === 'zh' ? accountName.zh : accountName.en}
                                      {isOptional && (
                                        <Badge className="ml-2 bg-gray-500/20 text-gray-400 border-0 text-[9px]">
                                          {t.optional}
                                        </Badge>
                                      )}
                                    </div>
                                    {isConnected && account.email && (
                                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                                        {account.email}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isConnected ? (
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleDisconnectAccount(accountKey)}
                                    className="text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 h-8"
                                  >
                                    {t.disconnect}
                                  </Button>
                                ) : (
                                  <Button 
                                    size="sm"
                                    onClick={() => handleConnectAccount(accountKey)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-3 text-xs font-bold"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    {t.authorize}
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Channel Benefits */}
                      <div className="text-xs text-gray-400 leading-relaxed border-l-2 border-purple-500/20 pl-4 space-y-1">
                        {(lang === 'zh' ? channel.benefits : channel.benefitsEn).map((benefit, i) => (
                          <div key={i}>{benefit}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Step 3: Release Settings */}
        <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-200">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-black">3</div>
              {t.step3}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <div className="space-y-3">
              <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.releaseSchedule}</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  type="date" 
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="bg-black/50 border-white/10 h-12 focus:border-blue-500/50 transition-colors" 
                />
                <Input 
                  type="time" 
                  value={releaseTime}
                  onChange={(e) => setReleaseTime(e.target.value)}
                  className="bg-black/50 border-white/10 h-12 focus:border-blue-500/50 transition-colors" 
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] text-gray-400 uppercase tracking-widest">{t.preSaveCampaign}</Label>
              <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    <Zap className="w-5 h-5"/>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-200 mb-1">{t.enablePreSave}</div>
                    <div className="text-[10px] text-gray-500">{t.preSaveDesc}</div>
                  </div>
                </div>
                <Switch 
                  checked={preSaveEnabled}
                  onCheckedChange={setPreSaveEnabled}
                  className="data-[state=checked]:bg-purple-500" 
                />
              </div>
            </div>

            <Button 
              disabled={!canSubmit()}
              className={`w-full h-14 font-black tracking-wider text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)] border border-purple-500/50 hover:scale-[1.02] transition-all duration-300 rounded-xl ${
                canSubmit() 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500' 
                  : 'bg-gray-800 border-gray-700 cursor-not-allowed opacity-50'
              }`}
            >
              <Rocket className="w-5 h-5 mr-2" /> {t.submit}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Preview */}
      <div className="lg:col-span-1 space-y-6">
        {/* Release Preview Card */}
        <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden sticky top-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-200">
              <Activity className="w-4 h-4 text-cyan-400" />
              {t.preview}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            {/* Selected Track */}
            {selectedTrack && (
              <div>
                <Label className="text-[10px] text-gray-400 uppercase tracking-widest mb-3 block">
                  {t.selectedTrack}
                </Label>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Music className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white mb-1">{selectedTrack.title}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{selectedTrack.date}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="h-px bg-white/10" />

            {/* Selected Channels */}
            <div>
              <Label className="text-[10px] text-gray-400 uppercase tracking-widest mb-3 block">
                {t.selectedChannels} ({selectedChannels.length})
              </Label>
              <div className="space-y-2">
                {selectedChannels.map(channelId => {
                  const channel = channels.find(c => c.id === channelId);
                  if (!channel) return null;
                  
                  const unconnected = channel.requiredAccounts.filter(
                    acc => !accountStatus[acc]?.connected
                  );
                  
                  return (
                    <div key={channelId} className="p-3 rounded-lg bg-black/40 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-xs text-white">
                          {lang === 'zh' ? channel.name : channel.nameEn}
                        </div>
                        {unconnected.length === 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border text-[9px]">
                            {t.allReady}
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 border text-[9px]">
                            {unconnected.length} {t.needsAuth}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Coverage Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <div className="text-xs text-gray-400 mb-1">{t.coverage}</div>
                <div className="text-2xl font-black text-cyan-400 font-mono">{getTotalPlatforms()}+</div>
                <div className="text-[10px] text-gray-500 mt-1">{t.platforms}</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                <div className="text-xs text-gray-400 mb-1">{t.pendingAccounts}</div>
                <div className="text-2xl font-black text-yellow-400 font-mono">{getUnconnectedAccounts().length}</div>
                <div className="text-[10px] text-gray-500 mt-1">{lang === 'zh' ? '个账号' : 'accounts'}</div>
              </div>
            </div>

            {/* Progress Indicator */}
            {getUnconnectedAccounts().length > 0 && (
              <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div className="text-xs text-yellow-200">
                    {lang === 'zh' 
                      ? `请先绑定所需账号才能提交发行` 
                      : `Please connect required accounts before submitting`}
                  </div>
                </div>
                <Progress 
                  value={(1 - getUnconnectedAccounts().length / getRequiredAccountsForSelectedChannels().length) * 100} 
                  className="h-2 bg-black/50"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}