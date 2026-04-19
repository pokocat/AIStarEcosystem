"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Sparkles, Upload, Shuffle, Type, Layers, Image as ImageIcon,
  Lock, Unlock, RefreshCw, Download, Save, History,
  Sliders, Palette, Eye, Scissors, Wand2, X, Check, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Lang } from "../../translations";
import { type Artist } from "./ArtistTypes";
import type { ForgeMode, ForgeResult } from "@/types/appearance-forge";
import {
  FORGE_TEMPLATES,
  HAIR_STYLES,
  EYE_COLORS,
  STYLE_TAGS,
  FACE_SLIDERS,
  COLOR_SCHEMES,
  PROMPT_SUGGESTIONS,
  MOCK_APPEARANCES,
} from "@/mocks/appearance-forge";
import {
  MODE_CONFIG,
  FORGE_BUTTON_GRADIENT,
  FORGE_HISTORY_MAX,
  MOCK_FORGE_DURATION_MS,
} from "@/constants/appearance-forge-ui";
import { AppearanceForgeApi } from "@/api";
// generateForge 仍走本地合成（保持无后端场景下的快速预览），保存动作会走真正的
// `AppearanceForgeApi.saveForgeResult`：mock 模式从本地 demo 视频池抽一个 URL
// 写回 MOCK_APPEARANCES；真后端 `POST /api/appearance-forge/save` 行为一致。

interface Props {
  // 保留 lang 形参以与兄弟组件签名一致（web_new 已收敛为中文单语，不读取此值）。
  lang: Lang;
  activeArtist: Artist;
}

export const AppearanceForge: React.FC<Props> = ({ activeArtist }) => {
  const [mode, setMode] = useState<ForgeMode>("template_photo");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [prompt, setPrompt] = useState("");
  const [selectedHair, setSelectedHair] = useState<string | null>(null);
  const [selectedEye, setSelectedEye] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
  const [faceValues, setFaceValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(FACE_SLIDERS.map(s => [s.id, 50])),
  );
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [history, setHistory] = useState<ForgeResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templates = FORGE_TEMPLATES;
  const hairs = HAIR_STYLES;
  const eyes = EYE_COLORS;
  const tags = STYLE_TAGS;
  const sliders = FACE_SLIDERS;
  const schemes = COLOR_SCHEMES;
  const suggestions = PROMPT_SUGGESTIONS;

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setUploadedPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleLock = (feature: string) => {
    setLockedFeatures(prev => prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]);
  };

  const runGenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, MOCK_FORGE_DURATION_MS));
    const tpl =
      FORGE_TEMPLATES.find(t => t.id === selectedTemplate) ??
      FORGE_TEMPLATES[Math.floor(Math.random() * FORGE_TEMPLATES.length)];
    const r: ForgeResult = {
      id: Date.now().toString(),
      artistId: activeArtist.id,
      image: tpl.image,
      prompt: prompt || `自动生成 - ${tpl.name}`,
      mode,
      createdAt: new Date().toISOString(),
      locked: [...lockedFeatures],
      status: "draft",
      usageCount: 0,
    };
    setResult(r);
    setHistory(prev => [r, ...prev].slice(0, FORGE_HISTORY_MAX));
    setSaveNote(null);
    // 让本地 mock 列表也看到这次生成，方便保存接口按 id 查到。
    // USE_MOCK=0 走真后端时这步是无副作用的预热（save 接口会按 id 查 DB）。
    if (!MOCK_APPEARANCES.some(a => a.id === r.id)) {
      MOCK_APPEARANCES.unshift(r);
    }
    setGenerating(false);
  };

  /** 点击「保存到艺人画廊」：落库 + 分配 demo 视频资产。 */
  const handleSave = async () => {
    if (!result || saving) return;
    setSaving(true);
    setSaveNote(null);
    try {
      const saved = await AppearanceForgeApi.saveForgeResult(result);
      setResult(saved);
      setHistory(prev => prev.map(h => (h.id === saved.id ? saved : h)));
      setSaveNote("已保存 · 已为该形象关联 AI 视频资产");
    } catch (err) {
      setSaveNote((err as Error).message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const runRandomize = () => {
    if (templates.length) {
      setSelectedTemplate(templates[Math.floor(Math.random() * templates.length)].id);
    }
    if (hairs.length) setSelectedHair(hairs[Math.floor(Math.random() * hairs.length)].id);
    if (eyes.length)  setSelectedEye(eyes[Math.floor(Math.random() * eyes.length)].id);
    const count = 2 + Math.floor(Math.random() * 3);
    const randomTagIds: string[] = [];
    for (let i = 0; i < count && tags.length; i++) {
      randomTagIds.push(tags[Math.floor(Math.random() * tags.length)].id);
    }
    setSelectedTags(Array.from(new Set(randomTagIds)));
    setFaceValues(
      Object.fromEntries(
        sliders.map(s => [
          s.id,
          lockedFeatures.includes(s.id)
            ? (faceValues[s.id] ?? 50)
            : 20 + Math.floor(Math.random() * 60),
        ]),
      ),
    );
    runGenerate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3" style={{ fontFamily: "var(--font-display)" }}>
            <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              AI 形象锻造炉
            </span>
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </h1>
          <p className="text-gray-500 text-sm mt-1">为 {activeArtist.name} 设计独一无二的外貌形象</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(v => !v)} className="text-gray-400 hover:text-white hover:bg-white/10">
            <History className="w-4 h-4 mr-1" /> 历史
            {history.length > 0 && <Badge className="ml-1 bg-white/10 text-[10px]">{history.length}</Badge>}
          </Button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof MODE_CONFIG[ForgeMode]][]).map(([key, conf]) => {
          const Icon = conf.icon;
          const active = mode === key;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode(key)}
              className={`relative overflow-hidden rounded-xl p-4 text-left transition-all border ${active ? "border-white/20 bg-white/[0.06]" : "border-white/5 bg-gray-900/40 hover:bg-white/[0.03]"}`}
            >
              {active && (
                <motion.div layoutId="forge-mode-glow" className={`absolute inset-0 bg-gradient-to-br ${conf.gradient} opacity-10`} />
              )}
              <div className="relative z-10">
                <Icon className={`w-5 h-5 mb-2 ${active ? "text-white" : "text-gray-500"}`} />
                <div className={`text-sm font-semibold ${active ? "text-white" : "text-gray-400"}`}>{conf.label}</div>
                <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{conf.desc}</div>
              </div>
              {active && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r ${conf.gradient}`} />}
            </motion.button>
          );
        })}
      </div>

      {/* Main Layout */}
      <div className="grid lg:grid-cols-[320px_1fr_280px] gap-4">
        {/* Left Panel */}
        <div className="space-y-4 order-2 lg:order-1">
          {(mode === "template_photo" || mode === "template_prompt") && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> 风格模版
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {templates.map(tpl => (
                  <motion.button
                    key={tpl.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`relative rounded-lg overflow-hidden aspect-[3/4] group ${selectedTemplate === tpl.id ? "ring-2 ring-cyan-400" : "ring-1 ring-white/5"}`}
                  >
                    <img src={tpl.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="text-[10px] font-medium text-white/90 truncate">{tpl.name}</div>
                    </div>
                    {selectedTemplate === tpl.id && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {mode === "template_photo" && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" /> 上传照片
              </h3>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploadedPhoto ? (
                <div className="relative">
                  <img src={uploadedPhoto} alt="" className="w-full aspect-square rounded-lg object-cover" />
                  <button onClick={() => setUploadedPhoto(null)} className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-white/10 hover:border-white/20 transition flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-400"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">点击或拖拽上传</span>
                </button>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>模版 {100 - fusionRatio}%</span>
                  <span>照片 {fusionRatio}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={fusionRatio}
                  onChange={e => setFusionRatio(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </motion.div>
          )}

          {(mode === "prompt_only" || mode === "template_prompt") && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-400" /> 描述指令
              </h3>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="描述你想要的外貌形象，例如：银色短发，电光蓝瞳色，赛博朋克风格纹身，穿着发光夹克..."
                className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-cyan-500/50 transition"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((tag, i) => (
                  <button key={i} onClick={() => setPrompt(prev => prev + (prev ? ", " : "") + tag)}
                    className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition">
                    + {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-pink-400" /> 发型
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {hairs.map(h => (
                  <button key={h.id} onClick={() => setSelectedHair(selectedHair === h.id ? null : h.id)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg transition ${selectedHair === h.id ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent"}`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" /> 瞳色
              </h3>
              <div className="flex flex-wrap gap-2">
                {eyes.map(ec => (
                  <button key={ec.id} onClick={() => setSelectedEye(selectedEye === ec.id ? null : ec.id)}
                    className={`relative w-8 h-8 rounded-full transition ${selectedEye === ec.id ? "ring-2 ring-offset-2 ring-offset-gray-900" : "ring-1 ring-white/10"}`}
                    style={{ background: ec.color }}
                    title={ec.label}
                  >
                    {selectedEye === ec.id && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center: Preview Canvas */}
        <div className="order-1 lg:order-2">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 rounded-xl pointer-events-none z-10" style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.1) 0%, transparent 30%, transparent 70%, rgba(168,85,247,0.1) 100%)",
            }} />
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]" style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
            }} />

            <div className="aspect-[3/4] md:aspect-[4/5] relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="w-24 h-24 rounded-full border-2 border-t-cyan-400 border-r-purple-500 border-b-red-500 border-l-transparent" />
                      <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="absolute inset-2 rounded-full border border-t-amber-400 border-r-transparent border-b-cyan-400 border-l-transparent" />
                      <Zap className="absolute inset-0 m-auto w-8 h-8 text-amber-400" />
                    </div>
                    <div className="text-center">
                      <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-sm text-gray-400">
                        AI 正在锻造形象...
                      </motion.p>
                      <p className="text-[10px] text-gray-600 mt-1">神经网络渲染中</p>
                    </div>
                  </motion.div>
                ) : result ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative">
                    <img src={result.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                      <div>
                        <Badge className="bg-white/10 text-[10px] mb-1">{MODE_CONFIG[result.mode].label}</Badge>
                        <p className="text-xs text-gray-300 line-clamp-2 max-w-[240px]">{result.prompt}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className={`h-8 px-3 rounded-lg bg-black/40 backdrop-blur flex items-center gap-1.5 text-xs transition ${result.videoUrl ? "text-emerald-300" : "text-gray-300 hover:text-white hover:bg-white/10"} disabled:opacity-60`}
                          title={result.videoUrl ? "已保存（再次点击可重抽视频）" : "保存到艺人画廊"}
                        >
                          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : result.videoUrl ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          {saving ? "保存中..." : result.videoUrl ? "已保存" : "保存"}
                        </button>
                        <button className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition" title="导出">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">选择模式和参数，开始锻造形象</p>
                    <p className="text-[10px] text-gray-600">支持模版融合、纯指令、混合模式和随机锻造</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {saveNote && (
              <div className="px-3 pt-2 text-[11px] text-emerald-300">{saveNote}</div>
            )}

            <div className="p-3 border-t border-white/5 flex items-center gap-2">
              <Button
                onClick={mode === "random" ? runRandomize : runGenerate}
                disabled={generating}
                className={`flex-1 bg-gradient-to-r ${FORGE_BUTTON_GRADIENT} text-white border-0`}
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : mode === "random" ? (
                  <Shuffle className="w-4 h-4 mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {generating ? "锻造中..." : mode === "random" ? "随机锻造" : "开始锻造"}
              </Button>
              {result && (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={saving || generating}
                    className={`shrink-0 border-0 ${result.videoUrl ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-white/10 text-white hover:bg-white/15"}`}
                  >
                    {saving ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : result.videoUrl ? <Check className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                    {saving ? "保存中..." : result.videoUrl ? "已保存" : "保存到艺人画廊"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={mode === "random" ? runRandomize : runGenerate}
                    className="text-gray-400 hover:text-white hover:bg-white/10" disabled={generating}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4 order-3">
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" /> 风格标签
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-full transition ${active ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent"}`}>
                    {active ? "✓ " : ""}{tag.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> 面部微调
            </h3>
            <div className="space-y-3">
              {sliders.map(s => (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-400">{s.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{faceValues[s.id] ?? 50}</span>
                      <button onClick={() => toggleLock(s.id)} className="text-gray-600 hover:text-gray-400 transition">
                        {lockedFeatures.includes(s.id) ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <input
                    type="range" min={0} max={100} value={faceValues[s.id] ?? 50}
                    onChange={e => setFaceValues(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" /> 主题配色
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {schemes.map(sc => {
                const active = selectedScheme === sc.id;
                return (
                  <button key={sc.id} onClick={() => setSelectedScheme(active ? null : sc.id)} className="flex flex-col items-center gap-1 group">
                    <div className={`w-full aspect-square rounded-lg overflow-hidden ring-1 transition ${active ? "ring-white/40" : "ring-white/10 group-hover:ring-white/20"}`}
                      style={{ background: `linear-gradient(135deg, ${sc.colors[0]}, ${sc.colors[1]})` }} />
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition">{sc.name}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" /> 生成历史
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {history.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setResult(item)}
                  className={`shrink-0 w-20 rounded-lg overflow-hidden ring-1 transition ${result?.id === item.id ? "ring-cyan-400" : "ring-white/10 hover:ring-white/20"}`}
                >
                  <img src={item.image} alt="" className="w-full aspect-[3/4] object-cover" />
                  <div className="p-1 bg-black/40">
                    <div className="text-[9px] text-gray-400 truncate">{MODE_CONFIG[item.mode].label}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppearanceForge;
