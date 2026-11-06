import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sparkles, Upload, Shuffle, Type, Layers, Image as ImageIcon,
  ChevronRight, Lock, Unlock, RefreshCw, Download, Save, History,
  Sliders, Palette, Eye, Scissors, Wand2, X, Check, Zap, ArrowLeft,
  Send, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Lang } from '../../translations';
import type { Artist } from './ArtistTypes';
import { ARTIST_TYPE_LABELS, ARTIST_TYPE_CONFIG, type ArtistType } from './ArtistTypes';

// ---- Types ----
type ForgeMode = 'template_photo' | 'prompt_only' | 'template_prompt' | 'random';

interface GeneratedResult {
  id: string;
  image: string;
  prompt: string;
  mode: ForgeMode;
  timestamp: number;
  locked: string[];
}

export interface ForgeResultData {
  image: string;
  hair: string | null;
  eyeColor: string | null;
  styleTags: string[];
  faceValues: Record<string, number>;
  mode: ForgeMode;
  prompt: string;
  templateName: string | null;
}

interface TemplateItem {
  id: string;
  name: { zh: string; en: string };
  image: string;
  tags: string[];
  style: string;
}

// ---- Mock Data ----
const TEMPLATES: TemplateItem[] = [
  { id: 't1', name: { zh: '霓虹偶像', en: 'Neon Idol' }, image: '/images/forge-neon-idol.webp', tags: ['cyberpunk', 'neon', 'idol'], style: 'neon' },
  { id: 't2', name: { zh: '暗黑歌姬', en: 'Dark Diva' }, image: '/images/forge-dark-diva.webp', tags: ['dark', 'gothic', 'singer'], style: 'dark' },
  { id: 't3', name: { zh: '未来超模', en: 'Future Model' }, image: '/images/forge-future-model.webp', tags: ['futuristic', 'fashion', 'elegant'], style: 'future' },
  { id: 't4', name: { zh: '街头叛客', en: 'Street Rebel' }, image: '/images/forge-street-rebel.webp', tags: ['street', 'punk', 'rebel'], style: 'street' },
  { id: 't5', name: { zh: '全息幻影', en: 'Holo Phantom' }, image: '/images/forge-holo-phantom.webp', tags: ['holographic', 'digital', 'ethereal'], style: 'holo' },
  { id: 't6', name: { zh: '哥特暗夜', en: 'Gothic Night' }, image: '/images/forge-gothic-night.webp', tags: ['gothic', 'dark', 'mysterious'], style: 'gothic' },
];

const HAIR_STYLES = [
  { zh: '银色短发', en: 'Silver Short' },
  { zh: '霓虹长发', en: 'Neon Long' },
  { zh: '赛博莫西干', en: 'Cyber Mohawk' },
  { zh: '全息渐变', en: 'Holo Gradient' },
  { zh: '黑色直发', en: 'Black Straight' },
  { zh: '粉色双马尾', en: 'Pink Twintails' },
];

const EYE_COLORS = [
  { zh: '电光蓝', en: 'Electric Blue', color: '#00d4ff' },
  { zh: '烈焰红', en: 'Flame Red', color: '#ff2d55' },
  { zh: '量子紫', en: 'Quantum Purple', color: '#a855f7' },
  { zh: '翡翠绿', en: 'Emerald Green', color: '#22c55e' },
  { zh: '琥珀金', en: 'Amber Gold', color: '#f59e0b' },
  { zh: '虹膜银', en: 'Iris Silver', color: '#94a3b8' },
];

const STYLE_TAGS = [
  { zh: '赛博纹身', en: 'Cyber Tattoo' },
  { zh: '机械义肢', en: 'Mech Limb' },
  { zh: '全息护目镜', en: 'Holo Goggles' },
  { zh: '荧光耳饰', en: 'Neon Earring' },
  { zh: '数据面纹', en: 'Data Facepaint' },
  { zh: '量子项圈', en: 'Quantum Collar' },
  { zh: '光棱翅膀', en: 'Prism Wings' },
  { zh: '暗黑斗篷', en: 'Dark Cloak' },
];

const FACE_SLIDERS = [
  { id: 'jawline', zh: '下颌线', en: 'Jawline' },
  { id: 'cheekbone', zh: '颧骨', en: 'Cheekbone' },
  { id: 'eyeSize', zh: '眼型大小', en: 'Eye Size' },
  { id: 'noseWidth', zh: '鼻翼宽度', en: 'Nose Width' },
  { id: 'lipFull', zh: '唇部丰满', en: 'Lip Fullness' },
  { id: 'skinTone', zh: '肤色色调', en: 'Skin Tone' },
];

const MODE_CONFIG: Record<ForgeMode, { zh: string; en: string; icon: any; desc: { zh: string; en: string }; color: string }> = {
  template_photo: { zh: '模版融合', en: 'Template Fusion', icon: Layers, desc: { zh: '选择模版+上传照片，AI融合生成', en: 'Template + your photo, AI fusion' }, color: 'from-cyan-500 to-blue-500' },
  prompt_only: { zh: '指令驱动', en: 'Prompt Driven', icon: Type, desc: { zh: '纯文本描述，AI自由生成', en: 'Text prompt, AI free generation' }, color: 'from-purple-500 to-pink-500' },
  template_prompt: { zh: '混合锻造', en: 'Hybrid Forge', icon: Wand2, desc: { zh: '模版基底+指令微调', en: 'Template base + prompt fine-tune' }, color: 'from-amber-500 to-red-500' },
  random: { zh: '随机锻造', en: 'Random Forge', icon: Shuffle, desc: { zh: '基于艺人类型随机生成', en: 'Random based on artist type' }, color: 'from-green-500 to-emerald-500' },
};

// Export constants and helper for IncubationWizard integration
export { FACE_SLIDERS as FORGE_FACE_SLIDERS };

export function generateRandomForgeResult(artistType: ArtistType, lang: Lang): ForgeResultData {
  const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const hairIdx = Math.floor(Math.random() * HAIR_STYLES.length);
  const eyeIdx = Math.floor(Math.random() * EYE_COLORS.length);
  const tagCount = 2 + Math.floor(Math.random() * 3);
  const tagIndices = [...new Set(Array.from({ length: tagCount }, () => Math.floor(Math.random() * STYLE_TAGS.length)))];
  const fv: Record<string, number> = {};
  FACE_SLIDERS.forEach(s => { fv[s.id] = 20 + Math.floor(Math.random() * 60); });
  return {
    image: tpl.image,
    hair: HAIR_STYLES[hairIdx][lang],
    eyeColor: EYE_COLORS[eyeIdx][lang],
    styleTags: tagIndices.map(i => STYLE_TAGS[i][lang]),
    faceValues: fv,
    mode: 'random',
    prompt: lang === 'zh' ? `随机锻造 - ${tpl.name.zh}` : `Random forge - ${tpl.name.en}`,
    templateName: tpl.name[lang],
  };
}

// ---- Component ----
export const AppearanceForge = ({ lang, activeArtist }: { lang: Lang; activeArtist: Artist }) => {
  const zh = lang === 'zh';
  const [mode, setMode] = useState<ForgeMode>('template_photo');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [prompt, setPrompt] = useState('');
  const [selectedHair, setSelectedHair] = useState<number | null>(null);
  const [selectedEye, setSelectedEye] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [faceValues, setFaceValues] = useState<Record<string, number>>(() => Object.fromEntries(FACE_SLIDERS.map(s => [s.id, 50])));
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadedPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const toggleTag = (i: number) => {
    setSelectedTags(prev => prev.includes(i) ? prev.filter(t => t !== i) : [...prev, i]);
  };

  const toggleLock = (feature: string) => {
    setLockedFeatures(prev => prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate AI generation
    await new Promise(r => setTimeout(r, 2500));
    const tpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const result: GeneratedResult = {
      id: Date.now().toString(),
      image: tpl.image,
      prompt: prompt || `${zh ? '自动生成' : 'Auto generated'} - ${tpl.name[lang]}`,
      mode,
      timestamp: Date.now(),
      locked: [...lockedFeatures],
    };
    setGeneratedResult(result);
    setHistory(prev => [result, ...prev].slice(0, 12));
    setGenerating(false);
  };

  const handleRandomize = async () => {
    setSelectedTemplate(TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)].id);
    setSelectedHair(Math.floor(Math.random() * HAIR_STYLES.length));
    setSelectedEye(Math.floor(Math.random() * EYE_COLORS.length));
    const randomTags = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => Math.floor(Math.random() * STYLE_TAGS.length));
    setSelectedTags([...new Set(randomTags)]);
    setFaceValues(Object.fromEntries(FACE_SLIDERS.map(s => [s.id, lockedFeatures.includes(s.id) ? faceValues[s.id] : 20 + Math.floor(Math.random() * 60)])));
    handleGenerate();
  };

  const modeConf = MODE_CONFIG[mode];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              {zh ? 'AI形象锻造炉' : 'AI Appearance Forge'}
            </span>
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {zh ? `为 ${activeArtist.name} 设计独一无二的外貌形象` : `Design a unique appearance for ${activeArtist.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-gray-400 hover:text-white hover:bg-white/10">
            <History className="w-4 h-4 mr-1" /> {zh ? '历史' : 'History'} {history.length > 0 && <Badge className="ml-1 bg-white/10 text-[10px]">{history.length}</Badge>}
          </Button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof modeConf][]).map(([key, conf]) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode(key)}
            className={`relative overflow-hidden rounded-xl p-4 text-left transition-all border ${mode === key ? 'border-white/20 bg-white/[0.06]' : 'border-white/5 bg-gray-900/40 hover:bg-white/[0.03]'}`}
          >
            {mode === key && (
              <motion.div layoutId="forge-mode-glow" className={`absolute inset-0 bg-gradient-to-br ${conf.color} opacity-10`} />
            )}
            <div className="relative z-10">
              <conf.icon className={`w-5 h-5 mb-2 ${mode === key ? 'text-white' : 'text-gray-500'}`} />
              <div className={`text-sm font-semibold ${mode === key ? 'text-white' : 'text-gray-400'}`}>{conf[lang === 'zh' ? 'zh' : 'en']}</div>
              <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{conf.desc[lang]}</div>
            </div>
            {mode === key && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r ${conf.color}`} />}
          </motion.button>
        ))}
      </div>

      {/* Main Layout: Left Panel + Preview + Right Panel */}
      <div className="grid lg:grid-cols-[320px_1fr_280px] gap-4">
        {/* Left Panel: Input area depends on mode */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Template Selection (for template_photo, template_prompt) */}
          {(mode === 'template_photo' || mode === 'template_prompt') && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                {zh ? '风格模版' : 'Style Templates'}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map(tpl => (
                  <motion.button
                    key={tpl.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`relative rounded-lg overflow-hidden aspect-[3/4] group ${selectedTemplate === tpl.id ? 'ring-2 ring-cyan-400' : 'ring-1 ring-white/5'}`}
                  >
                    <img src={tpl.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5">
                      <div className="text-[10px] font-medium text-white/90 truncate">{tpl.name[lang]}</div>
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

          {/* Photo Upload (template_photo mode) */}
          {mode === 'template_photo' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                {zh ? '上传照片' : 'Upload Photo'}
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
                  <span className="text-xs">{zh ? '点击或拖拽上传' : 'Click or drag to upload'}</span>
                </button>
              )}
              {/* Fusion ratio slider */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{zh ? '模版' : 'Template'} {100 - fusionRatio}%</span>
                  <span>{zh ? '照片' : 'Photo'} {fusionRatio}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={fusionRatio}
                  onChange={e => setFusionRatio(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </motion.div>
          )}

          {/* Prompt input (prompt_only, template_prompt) */}
          {(mode === 'prompt_only' || mode === 'template_prompt') && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-400" />
                {zh ? '描述指令' : 'Prompt'}
              </h3>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={zh ? '描述你想要的外貌形象，例如：银色短发，电光蓝瞳色，赛博朋克风格纹身，穿着发光夹克...' : 'Describe the appearance, e.g.: Silver short hair, electric blue eyes, cyberpunk tattoos, glowing jacket...'}
                className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-cyan-500/50 transition"
              />
              {/* Quick prompt tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  zh ? '赛博朋克' : 'Cyberpunk',
                  zh ? '未来主义' : 'Futuristic',
                  zh ? '极简优雅' : 'Minimalist',
                  zh ? '暗黑哥特' : 'Dark Gothic',
                  zh ? '复古蒸汽' : 'Steampunk',
                ].map((tag, i) => (
                  <button key={i} onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + tag)}
                    className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition">
                    + {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Hair + Eye Selection */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-pink-400" />
                {zh ? '发型' : 'Hairstyle'}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {HAIR_STYLES.map((h, i) => (
                  <button key={i} onClick={() => setSelectedHair(selectedHair === i ? null : i)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg transition ${selectedHair === i ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent'}`}>
                    {h[lang]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                {zh ? '瞳色' : 'Eye Color'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {EYE_COLORS.map((ec, i) => (
                  <button key={i} onClick={() => setSelectedEye(selectedEye === i ? null : i)}
                    className={`relative w-8 h-8 rounded-full transition ${selectedEye === i ? 'ring-2 ring-offset-2 ring-offset-gray-900' : 'ring-1 ring-white/10'}`}
                    style={{ background: ec.color, ...(selectedEye === i ? { ringColor: ec.color } : {}) }}
                    title={ec[lang]}
                  >
                    {selectedEye === i && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center: Preview Canvas */}
        <div className="order-1 lg:order-2">
          <div className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden relative">
            {/* Holographic border effect */}
            <div className="absolute inset-0 rounded-xl pointer-events-none z-10" style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, transparent 30%, transparent 70%, rgba(168,85,247,0.1) 100%)',
            }} />
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }} />

            <div className="aspect-[3/4] md:aspect-[4/5] relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                    {/* Forge animation */}
                    <div className="relative">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                        className="w-24 h-24 rounded-full border-2 border-t-cyan-400 border-r-purple-500 border-b-red-500 border-l-transparent" />
                      <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="absolute inset-2 rounded-full border border-t-amber-400 border-r-transparent border-b-cyan-400 border-l-transparent" />
                      <Zap className="absolute inset-0 m-auto w-8 h-8 text-amber-400" />
                    </div>
                    <div className="text-center">
                      <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-sm text-gray-400">
                        {zh ? 'AI正在锻造形象...' : 'AI forging appearance...'}
                      </motion.p>
                      <p className="text-[10px] text-gray-600 mt-1">{zh ? '神经网络渲染中' : 'Neural network rendering'}</p>
                    </div>
                  </motion.div>
                ) : generatedResult ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative">
                    <img src={generatedResult.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                    {/* Bottom info bar */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                      <div>
                        <Badge className="bg-white/10 text-[10px] mb-1">{MODE_CONFIG[generatedResult.mode][lang === 'zh' ? 'zh' : 'en']}</Badge>
                        <p className="text-xs text-gray-300 line-clamp-2 max-w-[240px]">{generatedResult.prompt}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition" title={zh ? '保存蓝图' : 'Save Blueprint'}>
                          <Save className="w-4 h-4" />
                        </button>
                        <button className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition" title={zh ? '导出' : 'Export'}>
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
                    <p className="text-sm text-gray-500">{zh ? '选择模式和参数，开始锻造形象' : 'Choose a mode and parameters to start forging'}</p>
                    <p className="text-[10px] text-gray-600">{zh ? '支持模版融合、纯指令、混合模式和随机锻造' : 'Supports template fusion, prompt, hybrid and random modes'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Bar */}
            <div className="p-3 border-t border-white/5 flex items-center gap-2">
              <Button
                onClick={mode === 'random' ? handleRandomize : handleGenerate}
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-0"
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : mode === 'random' ? (
                  <Shuffle className="w-4 h-4 mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {generating
                  ? (zh ? '锻造中...' : 'Forging...')
                  : mode === 'random'
                    ? (zh ? '随机锻造' : 'Random Forge')
                    : (zh ? '开始锻造' : 'Start Forge')
                }
              </Button>
              {generatedResult && (
                <Button variant="ghost" size="sm" onClick={mode === 'random' ? handleRandomize : handleGenerate}
                  className="text-gray-400 hover:text-white hover:bg-white/10" disabled={generating}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Fine-tuning */}
        <div className="space-y-4 order-3">
          {/* Style Tags */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" />
              {zh ? '风格标签' : 'Style Tags'}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_TAGS.map((tag, i) => (
                <button key={i} onClick={() => toggleTag(i)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full transition ${selectedTags.includes(i) ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] border border-transparent'}`}>
                  {selectedTags.includes(i) ? '✓ ' : ''}{tag[lang]}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Face Sliders */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              {zh ? '面部微调' : 'Face Fine-tune'}
            </h3>
            <div className="space-y-3">
              {FACE_SLIDERS.map(slider => (
                <div key={slider.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-400">{slider[lang]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{faceValues[slider.id]}</span>
                      <button onClick={() => toggleLock(slider.id)} className="text-gray-600 hover:text-gray-400 transition">
                        {lockedFeatures.includes(slider.id) ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <input
                    type="range" min={0} max={100} value={faceValues[slider.id]}
                    onChange={e => setFaceValues(prev => ({ ...prev, [slider.id]: Number(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Color Scheme */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              {zh ? '主题配色' : 'Color Scheme'}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: zh ? '霓虹' : 'Neon', colors: ['#00d4ff', '#a855f7'] },
                { name: zh ? '烈焰' : 'Flame', colors: ['#ef4444', '#f59e0b'] },
                { name: zh ? '深海' : 'Ocean', colors: ['#0ea5e9', '#06b6d4'] },
                { name: zh ? '暗夜' : 'Night', colors: ['#6366f1', '#1e1b4b'] },
              ].map((scheme, i) => (
                <button key={i} className="flex flex-col items-center gap-1 group">
                  <div className="w-full aspect-square rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition"
                    style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]})` }} />
                  <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition">{scheme.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              {zh ? '生成历史' : 'Generation History'}
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {history.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setGeneratedResult(item)}
                  className={`shrink-0 w-20 rounded-lg overflow-hidden ring-1 transition ${generatedResult?.id === item.id ? 'ring-cyan-400' : 'ring-white/10 hover:ring-white/20'}`}
                >
                  <img src={item.image} alt="" className="w-full aspect-[3/4] object-cover" />
                  <div className="p-1 bg-black/40">
                    <div className="text-[9px] text-gray-400 truncate">{MODE_CONFIG[item.mode][lang === 'zh' ? 'zh' : 'en']}</div>
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

/* ======== Embedded version for IncubationWizard Step 02 ======== */

// ── Chat types ──
type ChatMsgType = 'welcome' | 'mode_select' | 'template_select' | 'photo_upload' | 'prompt_confirm' | 'forge_start' | 'forge_done' | 'text';
interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  type: ChatMsgType;
  text: string;
  timestamp: number;
}
const chatStorageKey = (name: string, type: string) => `forge_chat_v1_${name}_${type}`;

export const AppearanceForgeEmbed = ({ lang, artistName, artistType, onForgeResult, hideChat }: { lang: Lang; artistName: string; artistType: ArtistType; onForgeResult?: (data: ForgeResultData) => void; hideChat?: boolean }) => {
  const zh = lang === 'zh';
  const typeConf = ARTIST_TYPE_CONFIG[artistType];
  const typeLbl = zh ? ARTIST_TYPE_LABELS[artistType].zh : ARTIST_TYPE_LABELS[artistType].en;

  // ── Core forge state ──
  const [mode, setMode] = useState<ForgeMode>('template_photo');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [prompt, setPrompt] = useState('');
  const [selectedHair, setSelectedHair] = useState<number | null>(null);
  const [selectedEye, setSelectedEye] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [faceValues, setFaceValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(FACE_SLIDERS.map(s => [s.id, 50]))
  );
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  const [lockedFeatures, setLockedFeatures] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Chat state ──
  const storageKey = chatStorageKey(artistName || 'unknown', artistType);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(chatStorageKey(artistName || 'unknown', artistType));
      if (stored) return JSON.parse(stored) as ChatMessage[];
    } catch {}
    return [];
  });
  const [chatInput, setChatInput] = useState('');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview' | 'tune'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-recommend template based on artist type
  const TYPE_TEMPLATE_MAP: Record<ArtistType, string> = {
    idol: 't1', singer: 't2', actor: 't3', entertainer: 't4', dancer: 't5', host: 't6', all_rounder: 't1',
  };
  useEffect(() => {
    if (!selectedTemplate) setSelectedTemplate(TYPE_TEMPLATE_MAP[artistType] || 't1');
  }, [artistType]); // eslint-disable-line

  // Init welcome message if chat is empty
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome_' + Date.now(),
        role: 'ai', type: 'welcome', timestamp: Date.now(),
        text: zh
          ? `你好！我是AI形象顾问 ✦ 将为「${artistName || '新艺人'}」打造专属形象。请先选择创作模式：`
          : `Hi! I'm your AI Appearance Advisor ✦ Let's craft a unique look for "${artistName || 'New Artist'}". Choose a creation mode to start:`,
      }]);
    }
  }, []); // eslint-disable-line

  // Persist chat (last 60 messages)
  useEffect(() => {
    if (chatMessages.length > 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(chatMessages.slice(-60))); } catch {}
    }
  }, [chatMessages]); // eslint-disable-line

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Helpers ──
  const addMsg = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setChatMessages(prev => [...prev, {
      ...msg,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }]);
  }, []);

  const resetChat = () => {
    setChatMessages([{
      id: 'welcome_' + Date.now(),
      role: 'ai', type: 'welcome', timestamp: Date.now(),
      text: zh ? `对话已重置 ✦ 请重新选择创作模式：` : `Chat reset ✦ Please choose a creation mode:`,
    }]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const toggleTag = (i: number) => setSelectedTags(prev => prev.includes(i) ? prev.filter(t => t !== i) : [...prev, i]);
  const toggleLock = (f: string) => setLockedFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setUploadedPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  // ── Chat-driven mode selection ──
  const handleModeSelect = (key: ForgeMode) => {
    setMode(key);
    const conf = MODE_CONFIG[key];
    addMsg({ role: 'user', type: 'mode_select', text: conf[zh ? 'zh' : 'en'] });
    setTimeout(() => {
      const aiTexts: Record<ForgeMode, string> = {
        template_photo: zh ? '模版融合已激活 ✦ 请从下方滑动选择风格模版，并可上传参考照片，AI将智能融合二者。' : 'Template Fusion activated ✦ Swipe to pick a style template below. Optionally upload a photo for AI fusion.',
        prompt_only: zh ? '指令驱动已激活 ✦ 在底部输入框描述你想要的形象特征，支持中英文混合描述。' : 'Prompt Driven activated ✦ Describe the desired appearance in the input box below. Mix Chinese & English freely!',
        template_prompt: zh ? '混合锻造已激活 ✦ 从下方选择一个基础模版，再用文字指令精细调控风格细节。' : 'Hybrid Forge activated ✦ Pick a base template below, then refine with text instructions.',
        random: zh ? '随机锻造已激活 [RND] 无需任何配置，直接点击中间「开始锻造」按钮即可！' : 'Random Forge activated [RND] No config needed — just hit "Start Forge" in the center!',
      };
      addMsg({ role: 'ai', type: 'mode_select', text: aiTexts[key] });
    }, 350);
  };

  const handleTemplateSelectChat = (tplId: string) => {
    const tpl = TEMPLATES.find(t => t.id === tplId)!;
    setSelectedTemplate(tplId);
    addMsg({ role: 'user', type: 'template_select', text: zh ? `选择模版：${tpl.name.zh}` : `Template: ${tpl.name.en}` });
    setTimeout(() => {
      const msg = mode === 'template_photo'
        ? (zh ? `已选「${tpl.name.zh}」✦ 可上传参考照片进行融合，也可直接点击「开始锻造」。` : `"${tpl.name.en}" selected ✦ Upload a reference photo for fusion, or start forging directly.`)
        : (zh ? `已选「${tpl.name.zh}」✦ 在底部输入描述指令可进一步细化风格。` : `"${tpl.name.en}" selected ✦ Add prompt details below to further customize the style.`);
      addMsg({ role: 'ai', type: 'photo_upload', text: msg });
    }, 300);
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setPrompt(prev => prev + (prev ? ', ' : '') + text);
    addMsg({ role: 'user', type: 'prompt_confirm', text });
    setChatInput('');
    setTimeout(() => {
      addMsg({ role: 'ai', type: 'text', text: zh ? `已记录指令 ✦「${text}」已加入形象描述。继续补充，或点击「开始锻造」。` : `Noted ✦ "${text}" added to appearance description. Add more or hit "Start Forge".` });
    }, 320);
  };

  // ── Generation with chat feedback ──
  const handleGenerateWithChat = async () => {
    addMsg({ role: 'ai', type: 'forge_start', text: zh ? '⚡ 神经锻造炉启动，正在生成独特形象...' : '⚡ Neural forge activated, generating unique appearance...' });
    setMobileTab('preview');
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2500));
    const tpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const result: GeneratedResult = {
      id: Date.now().toString(), image: tpl.image,
      prompt: prompt || `${zh ? '自动生成' : 'Auto generated'} - ${tpl.name[lang]}`,
      mode, timestamp: Date.now(), locked: [...lockedFeatures],
    };
    setGeneratedResult(result);
    setHistory(prev => [result, ...prev].slice(0, 8));
    setGenerating(false);
    setTimeout(() => addMsg({ role: 'ai', type: 'forge_done', text: zh ? '✨ 形象锻造完成！可在右侧继续微调参数，或点击刷新重新生成。' : '✨ Appearance forged! Fine-tune on the right, or hit refresh to regenerate.' }), 200);
    if (onForgeResult) {
      onForgeResult({
        image: tpl.image,
        hair: selectedHair !== null ? HAIR_STYLES[selectedHair][lang] : null,
        eyeColor: selectedEye !== null ? EYE_COLORS[selectedEye][lang] : null,
        styleTags: selectedTags.map(i => STYLE_TAGS[i][lang]),
        faceValues, mode,
        prompt: prompt || `${zh ? '自动生成' : 'Auto generated'} - ${tpl.name[lang]}`,
        templateName: tpl.name[lang],
      });
    }
  };

  const handleRandomizeWithChat = async () => {
    const randomTpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const randomHairIdx = Math.floor(Math.random() * HAIR_STYLES.length);
    const randomEyeIdx = Math.floor(Math.random() * EYE_COLORS.length);
    const randomTags = [...new Set(Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => Math.floor(Math.random() * STYLE_TAGS.length)))];
    const randomFaceVals = Object.fromEntries(FACE_SLIDERS.map(s => [s.id, lockedFeatures.includes(s.id) ? faceValues[s.id] : 20 + Math.floor(Math.random() * 60)]));
    setSelectedTemplate(randomTpl.id);
    setSelectedHair(randomHairIdx);
    setSelectedEye(randomEyeIdx);
    setSelectedTags(randomTags);
    setFaceValues(randomFaceVals);
    setMode('random');
    addMsg({ role: 'ai', type: 'forge_start', text: zh ? '[RND] 随机锻造启动，从宇宙中召唤专属形象...' : '[RND] Random forge initiated, summoning a unique look from the cosmos...' });
    setMobileTab('preview');
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2500));
    const result: GeneratedResult = {
      id: Date.now().toString(), image: randomTpl.image,
      prompt: zh ? `随机锻造 - ${randomTpl.name.zh}` : `Random forge - ${randomTpl.name.en}`,
      mode: 'random', timestamp: Date.now(), locked: [...lockedFeatures],
    };
    setGeneratedResult(result);
    setHistory(prev => [result, ...prev].slice(0, 8));
    setGenerating(false);
    setTimeout(() => addMsg({ role: 'ai', type: 'forge_done', text: zh ? '✨ 随机锻造完成！如不满意可再次随机，或在右侧微调参数。' : '✨ Random forge done! Hit random again or fine-tune on the right.' }), 200);
    if (onForgeResult) {
      onForgeResult({
        image: randomTpl.image,
        hair: HAIR_STYLES[randomHairIdx][lang],
        eyeColor: EYE_COLORS[randomEyeIdx][lang],
        styleTags: randomTags.map(i => STYLE_TAGS[i][lang]),
        faceValues: randomFaceVals, mode: 'random',
        prompt: zh ? `随机锻造 - ${randomTpl.name.zh}` : `Random forge - ${randomTpl.name.en}`,
        templateName: randomTpl.name[lang],
      });
    }
  };

  const handleRandomizeTune = () => {
    setFaceValues(Object.fromEntries(
      FACE_SLIDERS.map(s => [s.id, lockedFeatures.includes(s.id) ? faceValues[s.id] : 20 + Math.floor(Math.random() * 60)])
    ));
  };

  const modeConf = MODE_CONFIG[mode];

  const mobileTabs = [
    { key: 'chat' as const, label: zh ? 'AI指令' : 'AI Chat', icon: MessageSquare },
    { key: 'preview' as const, label: zh ? '预览' : 'Preview', icon: ImageIcon },
    { key: 'tune' as const, label: zh ? '微调' : 'Fine-tune', icon: Sliders },
  ];

  return (
    <div className="flex flex-col gap-2.5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <h2
            className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {zh ? 'AI形象锻造炉' : 'AI Appearance Forge'}
          </h2>
          <span className="text-[10px] text-gray-500 hidden sm:inline">
            {artistName || (zh ? '新艺人' : 'New Artist')} · {typeLbl}
          </span>
        </div>
        {history.length > 0 && (
          <span className="text-[10px] text-gray-600">
            {history.length} {zh ? '次历史' : 'generated'}
          </span>
        )}
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="flex md:hidden bg-black/30 border border-white/5 rounded-lg p-0.5 gap-0.5">
        {mobileTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] transition-all ${
              mobileTab === tab.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Three-column grid (two-col when hideChat) ── */}
      <div className={`grid gap-2.5 ${hideChat ? 'md:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]' : 'md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,4fr)]'}`}>

        {/* ═══════════════════════ LEFT – AI Chat (hidden when wizard provides its own) ═══════════════════════ */}
        <div
          className={`${hideChat ? 'hidden' : ''} ${mobileTab !== 'chat' ? 'hidden md:flex' : 'flex'} flex-col bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden`}
          style={{ height: 520 }}
        >
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-black/20 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold text-gray-300">{zh ? 'AI形象顾问' : 'AI Advisor'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            <button
              onClick={resetChat}
              title={zh ? '重置对话' : 'Reset chat'}
              className="text-gray-600 hover:text-gray-400 transition p-1 rounded hover:bg-white/5"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-1.5`}>
                {msg.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                )}
                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%]`}>
                  {/* Bubble */}
                  <div className={`rounded-xl px-2.5 py-2 ${
                    msg.role === 'ai'
                      ? 'bg-white/[0.04] border border-white/[0.06]'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    <p className="text-[11px] text-gray-300 leading-relaxed">{msg.text}</p>
                  </div>

                  {/* Mode selector cards embedded in welcome message */}
                  {msg.type === 'welcome' && msg.role === 'ai' && (
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      {(Object.entries(MODE_CONFIG) as [ForgeMode, typeof modeConf][]).map(([key, conf]) => (
                        <motion.button
                          key={key}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleModeSelect(key)}
                          className={`relative overflow-hidden rounded-lg p-2 text-left border transition-all ${
                            mode === key ? 'border-white/20 bg-white/[0.06]' : 'border-white/5 bg-black/20 hover:bg-white/[0.05]'
                          }`}
                        >
                          {mode === key && (
                            <motion.div
                              layoutId="embed-chat-mode-glow"
                              className={`absolute inset-0 bg-gradient-to-br ${conf.color} opacity-10`}
                            />
                          )}
                          <div className="relative z-10">
                            <conf.icon className={`w-3.5 h-3.5 mb-1 ${mode === key ? 'text-white' : 'text-gray-500'}`} />
                            <div className={`text-[10px] font-semibold leading-tight ${mode === key ? 'text-white' : 'text-gray-400'}`}>
                              {conf[zh ? 'zh' : 'en']}
                            </div>
                            <div className="text-[9px] text-gray-600 line-clamp-1 mt-0.5">{conf.desc[lang]}</div>
                          </div>
                          {mode === key && (
                            <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${conf.color}`} />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Template slider in AI mode_select response */}
                  {msg.type === 'mode_select' && msg.role === 'ai' && (mode === 'template_photo' || mode === 'template_prompt') && (
                    <div className="w-full">
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {TEMPLATES.map(tpl => (
                          <motion.button
                            key={tpl.id}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleTemplateSelectChat(tpl.id)}
                            className={`relative shrink-0 w-[50px] rounded-lg overflow-hidden transition ${
                              selectedTemplate === tpl.id ? 'ring-2 ring-cyan-400' : 'ring-1 ring-white/5 hover:ring-white/20'
                            }`}
                          >
                            <img src={tpl.image} alt="" className="w-full aspect-[3/4] object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-0.5">
                              <div className="text-[8px] text-white/80 truncate text-center">{tpl.name[lang]}</div>
                            </div>
                            {selectedTemplate === tpl.id && (
                              <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-cyan-500 rounded-full flex items-center justify-center">
                                <Check className="w-2 h-2 text-white" />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Photo upload widget in AI photo_upload response */}
                  {msg.type === 'photo_upload' && msg.role === 'ai' && mode === 'template_photo' && (
                    <div className="w-full bg-black/20 border border-white/5 rounded-lg p-2 space-y-1.5">
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                      {uploadedPhoto ? (
                        <div className="relative">
                          <img src={uploadedPhoto} alt="" className="w-full h-14 rounded-md object-cover" />
                          <button
                            onClick={() => setUploadedPhoto(null)}
                            className="absolute top-1 right-1 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/60 transition"
                          >
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-10 rounded-md border border-dashed border-white/10 hover:border-white/25 transition flex items-center justify-center gap-1.5 text-gray-500 hover:text-gray-400"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="text-[10px]">{zh ? '上传参考照片' : 'Upload reference photo'}</span>
                        </button>
                      )}
                      <div className="flex justify-between text-[9px] text-gray-600">
                        <span>{zh ? '模版' : 'Tpl'} {100 - fusionRatio}%</span>
                        <span>{zh ? '照片' : 'Photo'} {fusionRatio}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} value={fusionRatio}
                        onChange={e => setFusionRatio(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                      />
                    </div>
                  )}

                  {/* Forge done mini-result */}
                  {msg.type === 'forge_done' && msg.role === 'ai' && generatedResult && (
                    <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-2 py-1.5">
                      <img
                        src={generatedResult.image} alt=""
                        className="w-7 h-9 rounded object-cover ring-1 ring-cyan-500/40 shrink-0"
                      />
                      <div>
                        <div className="text-[9px] text-cyan-400">{MODE_CONFIG[generatedResult.mode][zh ? 'zh' : 'en']}</div>
                        <div className="text-[9px] text-gray-500 line-clamp-1">{generatedResult.prompt}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 p-2.5 border-t border-white/[0.06] bg-black/20 space-y-2">
            {/* Quick style tags */}
            <div className="flex gap-1 flex-wrap">
              {[
                zh ? '赛博朋克' : 'Cyberpunk',
                zh ? '未来主义' : 'Futuristic',
                zh ? '暗黑哥特' : 'Dark Gothic',
                zh ? '复古蒸汽' : 'Steampunk',
                zh ? '全息梦幻' : 'Holographic',
              ].map((tag, i) => (
                <button
                  key={i}
                  onClick={() => setChatInput(prev => prev + (prev ? ', ' : '') + tag)}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={zh ? '输入形象描述指令...' : 'Describe appearance...'}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition"
              />
              <button
                onClick={handleRandomizeWithChat}
                disabled={generating}
                title={zh ? '随机锻造' : 'Random Forge'}
                className="w-7 h-7 shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 flex items-center justify-center text-amber-400 disabled:opacity-30 transition"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || generating}
                className="w-7 h-7 shrink-0 rounded-lg bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 disabled:opacity-30 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════ CENTER – 合成仓 ═══════════════════════ */}
        <div className={`${mobileTab !== 'preview' ? 'hidden md:flex' : 'flex'} flex-col gap-2`}>
          <div
            className="bg-gray-900/60 border border-white/[0.08] rounded-xl overflow-hidden relative flex flex-col flex-1"
            style={{ boxShadow: '0 0 32px rgba(0,212,255,0.04), 0 0 64px rgba(168,85,247,0.03)' }}
          >
            {/* ── Atmosphere layers ── */}
            <div className="absolute inset-0 rounded-xl pointer-events-none z-10"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, transparent 35%, transparent 65%, rgba(168,85,247,0.07) 100%)' }} />
            <div className="absolute inset-0 pointer-events-none z-10"
              style={{
                backgroundImage: [
                  'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.022) 3px, rgba(255,255,255,0.022) 4px)',
                  'repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,212,255,0.015) 24px, rgba(0,212,255,0.015) 25px)',
                ].join(', '),
              }}
            />
            <div className="absolute inset-0 pointer-events-none z-10 rounded-xl"
              style={{ background: 'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 100%)' }} />
            <div className="absolute inset-0 pointer-events-none z-10 rounded-xl"
              style={{ background: 'radial-gradient(ellipse 80% 25% at 50% 100%, rgba(168,85,247,0.07) 0%, transparent 100%)' }} />
            {/* Corner brackets anchored below header */}
            <div className="absolute top-[38px] left-2 w-3.5 h-3.5 pointer-events-none z-20 border-t border-l border-cyan-400/30" />
            <div className="absolute top-[38px] right-2 w-3.5 h-3.5 pointer-events-none z-20 border-t border-r border-cyan-400/30" />
            <div className="absolute bottom-[88px] left-2 w-3.5 h-3.5 pointer-events-none z-20 border-b border-l border-purple-400/30" />
            <div className="absolute bottom-[88px] right-2 w-3.5 h-3.5 pointer-events-none z-20 border-b border-r border-purple-400/30" />

            {/* ── SYNTH LAB header bar ── */}
            <div className="relative z-20 px-3 py-2 border-b border-white/[0.06] bg-black/25 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"
                />
                <span className="text-[9px] tracking-[0.18em] text-cyan-400/60 uppercase font-mono shrink-0">
                  {zh ? '合成仓' : 'SYNTH LAB'}
                </span>
                <span className="text-[9px] text-white/15 shrink-0">|</span>
                <span className="text-[10px] text-white/55 font-medium truncate">{artistName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-gray-500 font-mono">
                  {typeConf.icon} {typeLbl}
                </span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-mono ${
                  mode === 'random'         ? 'bg-green-500/10 border-green-500/25 text-green-400'   :
                  mode === 'prompt_only'    ? 'bg-purple-500/10 border-purple-500/25 text-purple-400' :
                  mode === 'template_photo' ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'       :
                                              'bg-amber-500/10 border-amber-500/25 text-amber-400'
                }`}>
                  {MODE_CONFIG[mode][zh ? 'zh' : 'en']}
                </span>
              </div>
            </div>

            {/* ── Canvas ── */}
            <div className="flex-1 aspect-[3/4] relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    key="gen"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                        className="w-20 h-20 rounded-full border-2 border-t-cyan-400 border-r-purple-500 border-b-red-500 border-l-transparent"
                      />
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="absolute inset-2 rounded-full border border-t-amber-400 border-r-transparent border-b-cyan-400 border-l-transparent"
                      />
                      <Zap className="absolute inset-0 m-auto w-7 h-7 text-amber-400" />
                    </div>
                    <div className="text-center">
                      <motion.p
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-xs text-gray-400"
                      >
                        {zh ? 'AI锻造中...' : 'AI forging...'}
                      </motion.p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{zh ? '神经网络渲染中' : 'Neural rendering'}</p>
                    </div>
                  </motion.div>
                ) : generatedResult ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="w-full h-full relative group"
                  >
                    <img src={generatedResult.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    {/* Top: artist identity */}
                    <div className="absolute top-0 left-0 right-0 px-3 pt-3 pb-2 flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-white/90 leading-none">{artistName}</div>
                        <div className="text-[9px] text-white/40 mt-0.5 font-mono">{typeLbl}</div>
                      </div>
                      <Badge className="bg-black/40 backdrop-blur-sm text-[8px] border border-white/10 text-gray-300">
                        {MODE_CONFIG[generatedResult.mode][zh ? 'zh' : 'en']}
                      </Badge>
                    </div>
                    {/* Bottom: prompt + actions */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-[9px] text-gray-400 line-clamp-1 mb-2 font-mono">{generatedResult.prompt}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1 flex-wrap min-w-0">
                          {selectedHair !== null && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 truncate">
                              {HAIR_STYLES[selectedHair][lang]}
                            </span>
                          )}
                          {selectedEye !== null && (
                            <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EYE_COLORS[selectedEye].color }} />
                              {EYE_COLORS[selectedEye][lang]}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button className="w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition border border-white/10">
                            <Save className="w-3 h-3" />
                          </button>
                          <button className="w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition border border-white/10">
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2 text-center px-4"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center"
                    >
                      <span className="text-2xl">{typeConf.icon}</span>
                    </motion.div>
                    <p className="text-xs text-gray-500">{zh ? '在左侧配置参数后开始锻造' : 'Configure on the left to start forging'}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{zh ? `模式 · ${modeConf[zh ? 'zh' : 'en']}` : `Mode · ${modeConf.en}`}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Config summary tag strip ── */}
            <div className="relative z-20 px-3 py-2 border-t border-white/[0.06] bg-black/20">
              <div className="flex flex-wrap gap-1 min-h-[20px] items-center">
                {selectedHair !== null && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/80">
                    ✦ {HAIR_STYLES[selectedHair][lang]}
                  </span>
                )}
                {selectedEye !== null && (
                  <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/80">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EYE_COLORS[selectedEye].color }} />
                    {EYE_COLORS[selectedEye][lang]}
                  </span>
                )}
                {selectedTags.slice(0, 3).map(i => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-gray-500">
                    {STYLE_TAGS[i][lang]}
                  </span>
                ))}
                {selectedTags.length > 3 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-gray-600">
                    +{selectedTags.length - 3}
                  </span>
                )}
                {lockedFeatures.length > 0 && (
                  <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400/80">
                    <Lock className="w-2.5 h-2.5" /> {lockedFeatures.length}
                  </span>
                )}
                {selectedHair === null && selectedEye === null && selectedTags.length === 0 && (
                  <span className="text-[9px] text-gray-700 font-mono">{zh ? '// 外观参数待配置' : '// params pending'}</span>
                )}
              </div>
            </div>

            {/* ── Action bar ── */}
            <div className="relative z-20 p-2.5 border-t border-white/[0.06] bg-black/10 flex items-center gap-2">
              <Button
                onClick={mode === 'random' ? handleRandomizeWithChat : handleGenerateWithChat}
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-0 h-9 text-xs"
              >
                {generating
                  ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : mode === 'random'
                    ? <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                    : <Zap className="w-3.5 h-3.5 mr-1.5" />
                }
                {generating
                  ? (zh ? '锻造中...' : 'Forging...')
                  : mode === 'random'
                    ? (zh ? '随机锻造' : 'Random')
                    : (zh ? '开始锻造' : 'Start Forge')
                }
              </Button>
              {generatedResult && !generating && (
                <Button
                  variant="ghost" size="sm"
                  onClick={mode === 'random' ? handleRandomizeWithChat : handleGenerateWithChat}
                  className="text-gray-400 hover:text-white hover:bg-white/10 h-9 w-9 p-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* ── History strip ── */}
          {history.length > 0 && (
            <div className="bg-gray-900/30 border border-white/[0.04] rounded-lg p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] tracking-[0.12em] text-gray-600 uppercase font-mono">
                  {zh ? '历史版本' : 'Versions'}
                </span>
                <span className="text-[9px] text-gray-700 font-mono">{history.length}/12</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {history.slice(0, 8).map((item, i) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setGeneratedResult(item)}
                    title={item.prompt}
                    className={`relative shrink-0 w-11 rounded-lg overflow-hidden transition ${
                      generatedResult?.id === item.id
                        ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-gray-900'
                        : 'ring-1 ring-white/10 hover:ring-white/25'
                    }`}
                  >
                    <img src={item.image} alt="" className="w-full aspect-[3/4] object-cover" />
                    {generatedResult?.id === item.id && (
                      <div className="absolute inset-0 bg-cyan-400/10" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════ RIGHT – Fine-tune ═══════════════════════ */}
        <div
          className={`${mobileTab !== 'tune' ? 'hidden md:flex' : 'flex'} flex-col gap-2 overflow-y-auto`}
          style={{ maxHeight: 520 }}
        >
          {/* Random tune button */}
          <button
            onClick={handleRandomizeTune}
            className="w-full h-8 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 transition shrink-0"
          >
            <Shuffle className="w-3 h-3" />
            {zh ? '随机微调' : 'Random Tune'}
          </button>

          {/* Face sliders */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 shrink-0">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-gray-300">
              <Sliders className="w-3 h-3 text-cyan-400" />
              {zh ? '面部微调' : 'Face Tune'}
            </h3>
            <div className="space-y-2">
              {FACE_SLIDERS.map(slider => (
                <div key={slider.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-400">{slider[lang]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-600 tabular-nums w-5 text-right">{faceValues[slider.id]}</span>
                      <button onClick={() => toggleLock(slider.id)} className="text-gray-600 hover:text-gray-400 transition">
                        {lockedFeatures.includes(slider.id)
                          ? <Lock className="w-2.5 h-2.5 text-amber-400" />
                          : <Unlock className="w-2.5 h-2.5" />
                        }
                      </button>
                    </div>
                  </div>
                  <input
                    type="range" min={0} max={100} value={faceValues[slider.id]}
                    onChange={e => setFaceValues(prev => ({ ...prev, [slider.id]: Number(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Fusion ratio (template_photo only) */}
          {mode === 'template_photo' && (
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 shrink-0">
              <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-gray-300">
                <Layers className="w-3 h-3 text-purple-400" />
                {zh ? '融合比例' : 'Fusion Ratio'}
              </h3>
              <div className="flex justify-between text-[9px] text-gray-600 mb-1">
                <span>{zh ? '模版' : 'Template'} {100 - fusionRatio}%</span>
                <span>{zh ? '照片' : 'Photo'} {fusionRatio}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={fusionRatio}
                onChange={e => setFusionRatio(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400"
              />
            </div>
          )}

          {/* Hair styles */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 shrink-0">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-gray-300">
              <Scissors className="w-3 h-3 text-pink-400" />
              {zh ? '发型' : 'Hairstyle'}
            </h3>
            <div className="grid grid-cols-2 gap-1">
              {HAIR_STYLES.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedHair(selectedHair === i ? null : i)}
                  className={`text-[10px] px-2 py-1 rounded-md transition text-left ${
                    selectedHair === i
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                      : 'bg-white/[0.02] text-gray-500 border border-transparent hover:bg-white/[0.05]'
                  }`}
                >
                  {h[lang]}
                </button>
              ))}
            </div>
          </div>

          {/* Eye colors */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 shrink-0">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-gray-300">
              <Eye className="w-3 h-3 text-blue-400" />
              {zh ? '瞳色' : 'Eye Color'}
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              {EYE_COLORS.map((ec, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedEye(selectedEye === i ? null : i)}
                  className={`relative w-6 h-6 rounded-full transition ${
                    selectedEye === i ? 'ring-2 ring-offset-1 ring-offset-gray-900' : 'ring-1 ring-white/10 hover:ring-white/25'
                  }`}
                  style={{ background: ec.color }}
                  title={ec[lang]}
                >
                  {selectedEye === i && <Check className="w-2.5 h-2.5 text-white absolute inset-0 m-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Style tags */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-3 shrink-0">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-gray-300">
              <Palette className="w-3 h-3 text-amber-400" />
              {zh ? '风格标签' : 'Style Tags'}
            </h3>
            <div className="flex flex-wrap gap-1">
              {STYLE_TAGS.map((tag, i) => (
                <button
                  key={i}
                  onClick={() => toggleTag(i)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition ${
                    selectedTags.includes(i)
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/[0.02] text-gray-500 border border-transparent hover:bg-white/[0.05]'
                  }`}
                >
                  {selectedTags.includes(i) ? '✓ ' : ''}{tag[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};