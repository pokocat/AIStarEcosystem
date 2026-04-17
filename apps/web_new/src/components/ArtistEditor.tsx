"use client";

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import {
  Sparkles, Cpu, Sliders, Dna, Upload, Eye, Music, Film, Tv,
  ShoppingBag, Mic2, Theater, Save, ArrowLeft, Shirt, Wand2,
  TrendingUp, Award, Zap, GraduationCap, Target, Briefcase, Megaphone
} from 'lucide-react';
import { WardrobeSystem } from './WardrobeSystem';
import { PoseLibrary } from './PoseLibrary';
import { MusicBusiness } from './MusicBusiness';
import { FilmBusiness } from './FilmBusiness';
import { NoticeBoard } from './NoticeBoard';

interface Artist {
  id: string;
  name: string;
  avatar: string;
  type: 'singer' | 'actor' | 'variety' | 'comedian' | 'host' | 'all-round';
  status: 'trainee' | 'debut' | 'active' | 'rest' | 'retired';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  level: number;
  experience: number;
  createdAt: Date;
  talents: {
    singing: number;
    acting: number;
    dancing: number;
    hosting: number;
    comedy: number;
    variety: number;
  };
  stats: {
    songs: number;
    dramas: number;
    ads: number;
    variety: number;
    stage: number;
    fans: number;
    popularity: number;
    revenue: number;
  };
  commercial: {
    adValue: number;
    monthlyRevenue: number;
    endorsements: number;
  };
  tags: string[];
}

interface ArtistEditorProps {
  lang: 'zh' | 'en';
  artist: Artist;
  onBack: () => void;
  onSave: (artist: Artist) => void;
  personaParams: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
  setPersonaParams: (params: any) => void;
}

export function ArtistEditor({ lang, artist, onBack, onSave, personaParams, setPersonaParams }: ArtistEditorProps) {
  const [editedArtist, setEditedArtist] = useState<Artist>(artist);
  const [activeModule, setActiveModule] = useState<string>('talents');
  const [businessType, setBusinessType] = useState<'music' | 'film' | 'notice'>('notice');

  const handleSave = () => {
    onSave(editedArtist);
  };

  // 艺人类型选项
  const artistTypeOptions = [
    { value: 'singer', label: lang === 'zh' ? '歌手' : 'Singer', icon: Music },
    { value: 'actor', label: lang === 'zh' ? '演员' : 'Actor', icon: Film },
    { value: 'variety', label: lang === 'zh' ? '综艺咖' : 'Variety', icon: Tv },
    { value: 'comedian', label: lang === 'zh' ? '喜剧人' : 'Comedian', icon: Mic2 },
    { value: 'host', label: lang === 'zh' ? '主持人' : 'Host', icon: Mic2 },
    { value: 'all-round', label: lang === 'zh' ? '全能艺人' : 'All-Round', icon: Sparkles }
  ];

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-white/20">
              <AvatarImage src={editedArtist.avatar} alt={editedArtist.name} />
              <AvatarFallback>{editedArtist.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {lang === 'zh' ? '艺人编辑器' : 'Artist Editor'}
              </h2>
              <p className="text-sm text-gray-400">{editedArtist.name} · Lv.{editedArtist.level}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 hover:bg-white/5">
            <Eye className="w-4 h-4 mr-2" />
            {lang === 'zh' ? '预览' : 'Preview'}
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold">
            <Save className="w-4 h-4 mr-2" />
            {lang === 'zh' ? '保存' : 'Save'}
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeModule} onValueChange={setActiveModule} className="h-full flex flex-col">
          {/* 模块选择器 */}
          <TabsList className="bg-black/60 border border-white/5 w-full rounded-xl p-1.5 gap-1.5 mb-6 flex-wrap justify-start h-auto">
            <TabsTrigger value="talents" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center gap-2 px-4 py-2">
              <GraduationCap className="w-4 h-4" />
              {lang === 'zh' ? '能力培养' : 'Talents'}
            </TabsTrigger>
            <TabsTrigger value="persona" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 flex items-center gap-2 px-4 py-2">
              <Sliders className="w-4 h-4" />
              {lang === 'zh' ? '人格参数' : 'Persona'}
            </TabsTrigger>
            <TabsTrigger value="wardrobe" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 flex items-center gap-2 px-4 py-2">
              <Shirt className="w-4 h-4" />
              {lang === 'zh' ? '造型系统' : 'Wardrobe'}
            </TabsTrigger>
            <TabsTrigger value="poses" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 flex items-center gap-2 px-4 py-2">
              <Wand2 className="w-4 h-4" />
              {lang === 'zh' ? '动作姿态' : 'Poses'}
            </TabsTrigger>
            <TabsTrigger value="business" className="rounded-lg data-[state=active]:bg-green-500/20 data-[state=active]:text-green-300 flex items-center gap-2 px-4 py-2">
              <Briefcase className="w-4 h-4" />
              {lang === 'zh' ? '业务中心' : 'Business'}
            </TabsTrigger>
            <TabsTrigger value="genetic" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 flex items-center gap-2 px-4 py-2">
              <Dna className="w-4 h-4" />
              {lang === 'zh' ? '高级设定' : 'Advanced'}
            </TabsTrigger>
          </TabsList>

          {/* 能力培养 */}
          <TabsContent value="talents" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* 基础信息 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    {lang === 'zh' ? '基础设定' : 'Basic Settings'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{lang === 'zh' ? '艺人名称' : 'Artist Name'}</Label>
                      <Input
                        value={editedArtist.name}
                        onChange={(e) => setEditedArtist({ ...editedArtist, name: e.target.value })}
                        className="bg-black/50 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'zh' ? '艺人类型' : 'Artist Type'}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {artistTypeOptions.map(option => {
                          const Icon = option.icon;
                          return (
                            <Button
                              key={option.value}
                              variant={editedArtist.type === option.value ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setEditedArtist({ ...editedArtist, type: option.value as any })}
                              className={editedArtist.type === option.value 
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                                : 'border-white/10 hover:bg-white/5'
                              }
                            >
                              <Icon className="w-3 h-3 mr-1" />
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 才艺能力 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-400" />
                    {lang === 'zh' ? '才艺能力' : 'Talent Skills'}
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-1">{lang === 'zh' ? '通过训练提升各项能力，解锁更多业务机会' : 'Train to improve skills and unlock more opportunities'}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 唱功 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-pink-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '唱功 Singing' : 'Singing'}</Label>
                      </div>
                      <Badge variant="outline" className="text-pink-400 border-pink-400/30 font-mono">
                        {editedArtist.talents.singing}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.singing}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, singing: parseInt(e.target.value) }
                      })}
                      className="w-full accent-pink-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：流行歌曲、单曲录制' : 'Suitable for: Pop songs, singles'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>

                  {/* 演技 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-cyan-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '演技 Acting' : 'Acting'}</Label>
                      </div>
                      <Badge variant="outline" className="text-cyan-400 border-cyan-400/30 font-mono">
                        {editedArtist.talents.acting}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.acting}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, acting: parseInt(e.target.value) }
                      })}
                      className="w-full accent-cyan-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：短剧、电影、网剧' : 'Suitable for: Dramas, movies'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>

                  {/* 舞蹈 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '舞蹈 Dancing' : 'Dancing'}</Label>
                      </div>
                      <Badge variant="outline" className="text-purple-400 border-purple-400/30 font-mono">
                        {editedArtist.talents.dancing}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.dancing}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, dancing: parseInt(e.target.value) }
                      })}
                      className="w-full accent-purple-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：舞台表演、MV拍摄' : 'Suitable for: Stage, MV'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>

                  {/* 主持 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Mic2 className="w-4 h-4 text-yellow-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '主持 Hosting' : 'Hosting'}</Label>
                      </div>
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 font-mono">
                        {editedArtist.talents.hosting}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.hosting}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, hosting: parseInt(e.target.value) }
                      })}
                      className="w-full accent-yellow-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：综艺主持、晚会主持' : 'Suitable for: Variety, events'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>

                  {/* 喜剧 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Theater className="w-4 h-4 text-orange-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '喜剧 Comedy' : 'Comedy'}</Label>
                      </div>
                      <Badge variant="outline" className="text-orange-400 border-orange-400/30 font-mono">
                        {editedArtist.talents.comedy}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.comedy}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, comedy: parseInt(e.target.value) }
                      })}
                      className="w-full accent-orange-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：相声、小品、脱口秀' : 'Suitable for: Comedy shows'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>

                  {/* 综艺感 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Tv className="w-4 h-4 text-green-400" />
                        <Label className="text-sm font-bold">{lang === 'zh' ? '综艺感 Variety' : 'Variety'}</Label>
                      </div>
                      <Badge variant="outline" className="text-green-400 border-green-400/30 font-mono">
                        {editedArtist.talents.variety}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedArtist.talents.variety}
                      onChange={(e) => setEditedArtist({ 
                        ...editedArtist, 
                        talents: { ...editedArtist.talents, variety: parseInt(e.target.value) }
                      })}
                      className="w-full accent-green-500 h-3 bg-gray-800 rounded-lg"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{lang === 'zh' ? '适合：真人秀、游戏综艺' : 'Suitable for: Reality shows'}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5">
                        {lang === 'zh' ? '开始训练' : 'Train'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 综合评分 */}
              <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/20 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{lang === 'zh' ? '综合评分' : 'Overall Score'}</h3>
                      <p className="text-sm text-gray-400">{lang === 'zh' ? '基于所有才艺能力的综合评估' : 'Based on all talent skills'}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {Math.round((editedArtist.talents.singing + editedArtist.talents.acting + editedArtist.talents.dancing + editedArtist.talents.hosting + editedArtist.talents.comedy + editedArtist.talents.variety) / 6)}
                      </div>
                      <div className="text-xs text-gray-500">{lang === 'zh' ? '满分100' : 'Out of 100'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 人格参数 */}
          <TabsContent value="persona" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto space-y-6">
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'zh' ? '人格特质' : 'Personality'}</CardTitle>
                  <p className="text-sm text-gray-400 mt-1">{lang === 'zh' ? '定义艺人的性格和气质' : 'Define artist personality and temperament'}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-bold">{lang === 'zh' ? '甜度 Sweetness' : 'Sweetness'}</Label>
                      <Badge variant="outline" className="text-pink-400 border-pink-400/30 font-mono">
                        {personaParams.sweetness}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={personaParams.sweetness}
                      onChange={(e) => setPersonaParams({ ...personaParams, sweetness: parseInt(e.target.value) })}
                      className="w-full accent-pink-500 h-3 bg-gray-800 rounded-lg"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-bold">{lang === 'zh' ? '能量 Energy' : 'Energy'}</Label>
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 font-mono">
                        {personaParams.energy}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={personaParams.energy}
                      onChange={(e) => setPersonaParams({ ...personaParams, energy: parseInt(e.target.value) })}
                      className="w-full accent-yellow-500 h-3 bg-gray-800 rounded-lg"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-bold">{lang === 'zh' ? '神秘感 Mystery' : 'Mystery'}</Label>
                      <Badge variant="outline" className="text-purple-400 border-purple-400/30 font-mono">
                        {personaParams.mystery}
                      </Badge>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={personaParams.mystery}
                      onChange={(e) => setPersonaParams({ ...personaParams, mystery: parseInt(e.target.value) })}
                      className="w-full accent-purple-500 h-3 bg-gray-800 rounded-lg"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 造型系统 */}
          <TabsContent value="wardrobe" className="flex-1 overflow-hidden mt-0">
            <WardrobeSystem 
              lang={lang}
              onBack={() => setActiveModule('talents')} 
              activeSinger={editedArtist}
            />
          </TabsContent>

          {/* 动作姿态 */}
          <TabsContent value="poses" className="flex-1 overflow-hidden mt-0">
            <PoseLibrary 
              lang={lang}
              onBack={() => setActiveModule('talents')}
              activeSinger={editedArtist}
            />
          </TabsContent>

          {/* 业务中心 */}
          <TabsContent value="business" className="flex-1 overflow-hidden mt-0">
            <div className="h-full flex flex-col">
              {/* 业务类型选择 */}
              <div className="flex gap-3 mb-6">
                <Button
                  variant={businessType === 'music' ? 'default' : 'outline'}
                  onClick={() => setBusinessType('music')}
                  className={businessType === 'music' 
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' 
                    : 'border-white/10 hover:bg-white/5'
                  }
                >
                  <Music className="w-4 h-4 mr-2" />
                  {lang === 'zh' ? '音乐业务' : 'Music Business'}
                </Button>
                <Button
                  variant={businessType === 'film' ? 'default' : 'outline'}
                  onClick={() => setBusinessType('film')}
                  className={businessType === 'film' 
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' 
                    : 'border-white/10 hover:bg-white/5'
                  }
                >
                  <Film className="w-4 h-4 mr-2" />
                  {lang === 'zh' ? '影视业务' : 'Film Business'}
                </Button>
                <Button
                  variant={businessType === 'notice' ? 'default' : 'outline'}
                  onClick={() => setBusinessType('notice')}
                  className={businessType === 'notice' 
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                    : 'border-white/10 hover:bg-white/5'
                  }
                >
                  <Megaphone className="w-4 h-4 mr-2" />
                  {lang === 'zh' ? '通告墙' : 'Notices'}
                </Button>
              </div>

              {/* 业务内容 */}
              <div className="flex-1 overflow-hidden">
                {businessType === 'music' ? (
                  <MusicBusiness 
                    lang={lang}
                    artist={editedArtist}
                    onBack={() => setActiveModule('talents')}
                  />
                ) : businessType === 'film' ? (
                  <FilmBusiness 
                    lang={lang}
                    artist={editedArtist}
                    onBack={() => setActiveModule('talents')}
                  />
                ) : (
                  <NoticeBoard 
                    lang={lang}
                    artist={editedArtist}
                    onBack={() => setActiveModule('talents')}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* 高级设定 */}
          <TabsContent value="genetic" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto text-center py-20">
              <Dna className="w-16 h-16 mx-auto mb-4 text-pink-400" />
              <h3 className="text-2xl font-black mb-2">{lang === 'zh' ? '高级设定' : 'Advanced Settings'}</h3>
              <p className="text-gray-400">{lang === 'zh' ? '基因混合、声音定制、外貌微调' : 'Genetic mix, voice, appearance'}</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}