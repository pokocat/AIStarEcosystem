import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import {
  Sparkles, Cpu, Sliders, Dna, Upload, Eye, Users, Star, Zap,
  ChevronDown, Plus, Wand2, FileText, RefreshCw, Check, Crown,
  Award, FolderOpen, Download, Save, ArrowLeft, Edit3, Layers, Shirt, Music
} from 'lucide-react';
import { WardrobeSystem } from './WardrobeSystem';
import { PoseLibrary } from './PoseLibrary';

interface Singer {
  id: string;
  name: string;
  avatar: string;
  style: string;
  status: 'active' | 'draft' | 'archived';
  quality: 'common' | 'rare' | 'epic' | 'legendary';
  createdAt: Date;
  stats: {
    songs: number;
    fans: number;
    popularity: number;
  };
  tags: string[];
}

interface SingerEditorProps {
  lang: 'zh' | 'en';
  singer: Singer;
  onBack: () => void;
  onSave: (singer: Singer) => void;
  personaParams: {
    sweetness: number;
    energy: number;
    mystery: number;
  };
  setPersonaParams: (params: any) => void;
}

export function SingerEditor({ lang, singer, onBack, onSave, personaParams, setPersonaParams }: SingerEditorProps) {
  const [editedSinger, setEditedSinger] = useState<Singer>(singer);
  const [activeModule, setActiveModule] = useState<string>('params');

  // 官方IP库数据
  const officialIPs = [
    { 
      id: '1', 
      name: lang === 'zh' ? '霓虹战士' : 'Neon Warrior', 
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      style: lang === 'zh' ? '电子舞曲' : 'EDM',
      rarity: 'legendary' as const,
      tags: ['cyberpunk', 'edm'],
      preset: { sweetness: 40, energy: 95, mystery: 80 }
    },
    { 
      id: '2', 
      name: lang === 'zh' ? '云裳仙子' : 'Cloud Fairy',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      style: lang === 'zh' ? '古风流行' : 'Ancient Pop',
      rarity: 'epic' as const,
      tags: ['traditional', 'elegant'],
      preset: { sweetness: 90, energy: 60, mystery: 70 }
    },
    { 
      id: '3', 
      name: lang === 'zh' ? '机械核心' : 'Mech Core',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
      style: lang === 'zh' ? '工业摇滚' : 'Industrial Rock',
      rarity: 'epic' as const,
      tags: ['rock', 'mechanical'],
      preset: { sweetness: 30, energy: 90, mystery: 85 }
    },
    { 
      id: '4', 
      name: lang === 'zh' ? '星辰歌者' : 'Star Singer',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
      style: lang === 'zh' ? '梦幻流行' : 'Dream Pop',
      rarity: 'rare' as const,
      tags: ['dreamy', 'pop'],
      preset: { sweetness: 85, energy: 70, mystery: 75 }
    },
  ];

  // 快速参数预设
  const quickPresets = [
    { id: '1', name: lang === 'zh' ? '甜美少女' : 'Sweet Girl', icon: '🌸', values: { sweetness: 95, energy: 75, mystery: 40 } },
    { id: '2', name: lang === 'zh' ? '冷酷女王' : 'Cool Queen', icon: '👑', values: { sweetness: 30, energy: 85, mystery: 90 } },
    { id: '3', name: lang === 'zh' ? '活力青春' : 'Energetic Youth', icon: '⚡', values: { sweetness: 70, energy: 95, mystery: 50 } },
    { id: '4', name: lang === 'zh' ? '神秘精灵' : 'Mystic Elf', icon: '🌙', values: { sweetness: 60, energy: 55, mystery: 95 } },
  ];

  const rarityColors = {
    common: 'text-gray-400 border-gray-400/20',
    rare: 'text-blue-400 border-blue-400/20',
    epic: 'text-purple-400 border-purple-400/20',
    legendary: 'text-yellow-400 border-yellow-400/20'
  };

  const handleSave = () => {
    onSave(editedSinger);
  };

  const applyIPPreset = (ip: any) => {
    setEditedSinger({
      ...editedSinger,
      name: ip.name,
      avatar: ip.avatar,
      style: ip.style,
      tags: ip.tags
    });
    setPersonaParams(ip.preset);
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{lang === 'zh' ? '歌手编辑器' : 'Singer Editor'}</h2>
            <p className="text-sm text-gray-400">{lang === 'zh' ? '编辑' : 'Editing'}: {editedSinger.name}</p>
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
            <TabsTrigger value="official" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center gap-2 px-4 py-2">
              <Sparkles className="w-4 h-4" />
              {lang === 'zh' ? '官方IP' : 'Official IP'}
            </TabsTrigger>
            <TabsTrigger value="params" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 flex items-center gap-2 px-4 py-2">
              <Sliders className="w-4 h-4" />
              {lang === 'zh' ? '参数调节' : 'Parameters'}
            </TabsTrigger>
            <TabsTrigger value="genetic" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 flex items-center gap-2 px-4 py-2">
              <Dna className="w-4 h-4" />
              {lang === 'zh' ? '基因混合' : 'Genetic'}
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 flex items-center gap-2 px-4 py-2">
              <Upload className="w-4 h-4" />
              {lang === 'zh' ? '图片定制' : 'Upload'}
            </TabsTrigger>
            <TabsTrigger value="wardrobe" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 flex items-center gap-2 px-4 py-2">
              <Shirt className="w-4 h-4" />
              {lang === 'zh' ? '服装换装' : 'Wardrobe'}
            </TabsTrigger>
            <TabsTrigger value="poses" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 flex items-center gap-2 px-4 py-2">
              <Music className="w-4 h-4" />
              {lang === 'zh' ? '姿态动作' : 'Poses'}
            </TabsTrigger>
          </TabsList>

          {/* 官方IP库 */}
          <TabsContent value="official" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {officialIPs.map((ip) => (
                <motion.div key={ip.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group overflow-hidden">
                    <CardContent className="p-0" onClick={() => applyIPPreset(ip)}>
                      <div className="relative aspect-square overflow-hidden">
                        <img src={ip.avatar} alt={ip.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className={`text-xs ${rarityColors[ip.rarity]}`}>
                            {ip.rarity.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-white mb-1">{ip.name}</h3>
                        <p className="text-sm text-gray-400 mb-3">{ip.style}</p>
                        <div className="flex flex-wrap gap-1">
                          {ip.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs border-white/20">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* 参数调节器 */}
          <TabsContent value="params" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* 快速预设 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'zh' ? '快速预设' : 'Quick Presets'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {quickPresets.map(preset => (
                      <Button
                        key={preset.id}
                        variant="outline"
                        onClick={() => setPersonaParams(preset.values)}
                        className="h-auto py-4 flex flex-col items-center gap-2 border-white/10 hover:bg-white/5 hover:border-purple-500/30"
                      >
                        <span className="text-3xl">{preset.icon}</span>
                        <span className="text-sm font-bold">{preset.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 核心人格参数 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'zh' ? '核心人格参数' : 'Core Parameters'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 甜度 */}
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

                  {/* 能量 */}
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

                  {/* 神秘感 */}
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

              {/* 基本信息 */}
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === 'zh' ? '基本信息' : 'Basic Info'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{lang === 'zh' ? '歌手名称' : 'Singer Name'}</Label>
                    <Input
                      value={editedSinger.name}
                      onChange={(e) => setEditedSinger({ ...editedSinger, name: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'zh' ? '音乐风格' : 'Music Style'}</Label>
                    <Input
                      value={editedSinger.style}
                      onChange={(e) => setEditedSinger({ ...editedSinger, style: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 基因混合 */}
          <TabsContent value="genetic" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto text-center py-20">
              <Dna className="w-16 h-16 mx-auto mb-4 text-pink-400" />
              <h3 className="text-2xl font-black mb-2">{lang === 'zh' ? '基因混合实验室' : 'Genetic Lab'}</h3>
              <p className="text-gray-400">{lang === 'zh' ? '选择两位歌手进行基因混合，创造全新角色' : 'Combine two singers to create a new one'}</p>
            </div>
          </TabsContent>

          {/* 图片定制 */}
          <TabsContent value="upload" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto text-center py-20">
              <Upload className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
              <h3 className="text-2xl font-black mb-2">{lang === 'zh' ? '图片定制系统' : 'Image Upload'}</h3>
              <p className="text-gray-400">{lang === 'zh' ? '上传参考图片，AI将生成相似风格的歌手' : 'Upload reference images to generate similar style'}</p>
            </div>
          </TabsContent>

          {/* 服装换装 */}
          <TabsContent value="wardrobe" className="flex-1 overflow-hidden mt-0">
            <WardrobeSystem 
              lang={lang}
              onBack={() => setActiveModule('params')} 
              activeSinger={editedSinger}
            />
          </TabsContent>

          {/* 姿态动作 */}
          <TabsContent value="poses" className="flex-1 overflow-hidden mt-0">
            <PoseLibrary 
              lang={lang}
              onBack={() => setActiveModule('params')}
              activeSinger={editedSinger}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
