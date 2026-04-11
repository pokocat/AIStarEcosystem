"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ArrowLeft, Dna, Eye, Save, Shirt, Sliders, Sparkles, Music, Upload } from "lucide-react";
import { WardrobeSystem } from "./WardrobeSystem";
import { PoseLibrary } from "./PoseLibrary";
import type {
  ExpressionPreset,
  GesturePreset,
  OfficialIpTemplate,
  PersonaPreset,
  PosePreset,
  SingerDetail,
  WardrobeItem
} from "@/types/contracts/singers";

interface SingerEditorProps {
  lang: "zh" | "en";
  singer: SingerDetail;
  officialIpTemplates: OfficialIpTemplate[];
  personaPresets: PersonaPreset[];
  wardrobeCatalog: WardrobeItem[];
  poseCatalog: PosePreset[];
  expressionCatalog: ExpressionPreset[];
  gestureCatalog: GesturePreset[];
  onBack: () => void;
  onSave: (singer: SingerDetail) => Promise<void>;
}

const rarityColors = {
  common: "text-gray-400 border-gray-400/20",
  rare: "text-blue-400 border-blue-400/20",
  epic: "text-purple-400 border-purple-400/20",
  legendary: "text-yellow-400 border-yellow-400/20"
} as const;

export function SingerEditor({
  lang,
  singer,
  officialIpTemplates,
  personaPresets,
  wardrobeCatalog,
  poseCatalog,
  expressionCatalog,
  gestureCatalog,
  onBack,
  onSave
}: SingerEditorProps) {
  const [editedSinger, setEditedSinger] = useState<SingerDetail>(singer);
  const [activeModule, setActiveModule] = useState("params");

  const handleSave = async () => {
    await onSave(editedSinger);
  };

  const applyIPPreset = (template: OfficialIpTemplate) => {
    setEditedSinger((current) => ({
      ...current,
      name: template.name,
      avatarUrl: template.avatarUrl,
      style: template.style,
      tags: template.tags,
      parameters: template.presetParams
    }));
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{lang === "zh" ? "歌手编辑器" : "Singer Editor"}</h2>
            <p className="text-sm text-gray-400">{lang === "zh" ? "编辑" : "Editing"}: {editedSinger.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 hover:bg-white/5">
            <Eye className="w-4 h-4 mr-2" />
            {lang === "zh" ? "预览" : "Preview"}
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold">
            <Save className="w-4 h-4 mr-2" />
            {lang === "zh" ? "保存" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeModule} onValueChange={setActiveModule} className="h-full flex flex-col">
          <TabsList className="bg-black/60 border border-white/5 w-full rounded-xl p-1.5 gap-1.5 mb-6 flex-wrap justify-start h-auto">
            <TabsTrigger value="official" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center gap-2 px-4 py-2">
              <Sparkles className="w-4 h-4" />
              {lang === "zh" ? "官方IP" : "Official IP"}
            </TabsTrigger>
            <TabsTrigger value="params" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 flex items-center gap-2 px-4 py-2">
              <Sliders className="w-4 h-4" />
              {lang === "zh" ? "参数调节" : "Parameters"}
            </TabsTrigger>
            <TabsTrigger value="genetic" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 flex items-center gap-2 px-4 py-2">
              <Dna className="w-4 h-4" />
              {lang === "zh" ? "基因混合" : "Genetic"}
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 flex items-center gap-2 px-4 py-2">
              <Upload className="w-4 h-4" />
              {lang === "zh" ? "图片定制" : "Upload"}
            </TabsTrigger>
            <TabsTrigger value="wardrobe" className="rounded-lg data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 flex items-center gap-2 px-4 py-2">
              <Shirt className="w-4 h-4" />
              {lang === "zh" ? "服装换装" : "Wardrobe"}
            </TabsTrigger>
            <TabsTrigger value="poses" className="rounded-lg data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 flex items-center gap-2 px-4 py-2">
              <Music className="w-4 h-4" />
              {lang === "zh" ? "姿态动作" : "Poses"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="official" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {officialIpTemplates.map((template) => (
                <motion.div key={template.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card className="bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group overflow-hidden">
                    <CardContent className="p-0" onClick={() => applyIPPreset(template)}>
                      <div className="relative aspect-square overflow-hidden">
                        <img src={template.avatarUrl} alt={template.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className={`text-xs ${rarityColors[template.rarity]}`}>
                            {template.rarity.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-white mb-1">{template.name}</h3>
                        <p className="text-sm text-gray-400 mb-3">{template.style}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs border-white/20">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="params" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto space-y-6">
              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === "zh" ? "快速预设" : "Quick Presets"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {personaPresets.map((preset) => (
                      <Button
                        key={preset.id}
                        variant="outline"
                        onClick={() => setEditedSinger((current) => ({ ...current, parameters: preset.values }))}
                        className="h-auto py-4 flex flex-col items-center gap-2 border-white/10 hover:bg-white/5 hover:border-purple-500/30"
                      >
                        <span className="text-3xl">{preset.icon}</span>
                        <span className="text-sm font-bold">{preset.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === "zh" ? "核心人格参数" : "Core Parameters"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { key: "sweetness", label: lang === "zh" ? "甜度 Sweetness" : "Sweetness", badge: "text-pink-400 border-pink-400/30", accent: "accent-pink-500" },
                    { key: "energy", label: lang === "zh" ? "能量 Energy" : "Energy", badge: "text-yellow-400 border-yellow-400/30", accent: "accent-yellow-500" },
                    { key: "mystery", label: lang === "zh" ? "神秘感 Mystery" : "Mystery", badge: "text-purple-400 border-purple-400/30", accent: "accent-purple-500" }
                  ].map((parameter) => (
                    <div key={parameter.key} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-bold">{parameter.label}</Label>
                        <Badge variant="outline" className={`${parameter.badge} font-mono`}>
                          {editedSinger.parameters[parameter.key as keyof typeof editedSinger.parameters]}
                        </Badge>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editedSinger.parameters[parameter.key as keyof typeof editedSinger.parameters]}
                        onChange={(event) =>
                          setEditedSinger((current) => ({
                            ...current,
                            parameters: {
                              ...current.parameters,
                              [parameter.key]: Number.parseInt(event.target.value, 10)
                            }
                          }))
                        }
                        className={`w-full h-3 bg-gray-800 rounded-lg ${parameter.accent}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-[#0c0c0e]/90 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">{lang === "zh" ? "基本信息" : "Basic Info"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{lang === "zh" ? "歌手名称" : "Singer Name"}</Label>
                    <Input value={editedSinger.name} onChange={(event) => setEditedSinger((current) => ({ ...current, name: event.target.value }))} className="bg-black/50 border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === "zh" ? "音乐风格" : "Music Style"}</Label>
                    <Input value={editedSinger.style} onChange={(event) => setEditedSinger((current) => ({ ...current, style: event.target.value }))} className="bg-black/50 border-white/10" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="genetic" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto text-center py-20">
              <Dna className="w-16 h-16 mx-auto mb-4 text-pink-400" />
              <h3 className="text-2xl font-black mb-2">{lang === "zh" ? "基因混合实验室" : "Genetic Lab"}</h3>
              <p className="text-gray-400">{lang === "zh" ? "选择两位歌手进行基因混合，创造全新角色" : "Combine two singers to create a new one"}</p>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-0">
            <div className="max-w-5xl mx-auto text-center py-20">
              <Upload className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
              <h3 className="text-2xl font-black mb-2">{lang === "zh" ? "图片定制系统" : "Image Upload"}</h3>
              <p className="text-gray-400">{lang === "zh" ? "上传参考图片，AI 将生成相似风格的歌手" : "Upload reference images to generate similar style"}</p>
            </div>
          </TabsContent>

          <TabsContent value="wardrobe" className="flex-1 overflow-hidden mt-0">
            <WardrobeSystem lang={lang} onBack={() => setActiveModule("params")} activeSinger={editedSinger} catalog={wardrobeCatalog} />
          </TabsContent>

          <TabsContent value="poses" className="flex-1 overflow-hidden mt-0">
            <PoseLibrary lang={lang} onBack={() => setActiveModule("params")} activeSinger={editedSinger} poses={poseCatalog} expressions={expressionCatalog} gestures={gestureCatalog} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
