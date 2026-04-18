"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Wand2, Mic, Music, Upload, Play, Sparkles, CheckCircle2,
  Loader2, Download, Share2, Edit3, Volume2, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MusicGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (track: any) => void;
  lang: 'zh' | 'en';
  mode?: 'text' | 'vocal' | 'melody';
}

export default function MusicGenerationDialog({ 
  isOpen, 
  onClose, 
  onSuccess, 
  lang,
  mode = 'text' 
}: MusicGenerationDialogProps) {
  const [step, setStep] = useState<'input' | 'generating' | 'preview' | 'success'>('input');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [duration, setDuration] = useState('120');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState('');
  const [generatedTrack, setGeneratedTrack] = useState<any>(null);

  const t = {
    zh: {
      title: 'AI 音乐创作',
      subtitle: '描述你想要的音乐，AI 将在 30 秒内生成',
      inputTab: '文本生成',
      vocalTab: '哼唱生成',
      melodyTab: '旋律生成',
      promptLabel: '音乐描述',
      promptPlaceholder: '例如：一首赛博朋克风格的电子乐，带有忧郁的旋律和强劲的节奏...',
      styleLabel: '音乐风格',
      stylePlaceholder: 'Cyberpunk, EDM, Synthwave',
      durationLabel: '时长（秒）',
      advancedSettings: '高级设置',
      tempo: '节奏 (BPM)',
      mood: '情绪',
      instruments: '乐器',
      generate: '开始生成',
      cancel: '取消',
      generating: '生成中...',
      stage_analyzing: '分析输入参数',
      stage_composing: '作曲中',
      stage_arranging: '编曲中',
      stage_mixing: '混音中',
      stage_mastering: '母带处理',
      stage_finalizing: '生成完成',
      previewTitle: '试听预览',
      trackTitle: '作品标题',
      download: '下载',
      share: '分享',
      regenerate: '重新生成',
      saveAndUse: '保存并使用',
      success: '创作成功！',
      successDesc: '你的音乐已保存到作品库'
    },
    en: {
      title: 'AI Music Creation',
      subtitle: 'Describe your music, AI generates in 30 seconds',
      inputTab: 'Text-to-Music',
      vocalTab: 'Vocal Input',
      melodyTab: 'Melody Input',
      promptLabel: 'Music Description',
      promptPlaceholder: 'e.g., A cyberpunk electronic track with melancholic melodies and strong beats...',
      styleLabel: 'Music Style',
      stylePlaceholder: 'Cyberpunk, EDM, Synthwave',
      durationLabel: 'Duration (seconds)',
      advancedSettings: 'Advanced Settings',
      tempo: 'Tempo (BPM)',
      mood: 'Mood',
      instruments: 'Instruments',
      generate: 'Generate',
      cancel: 'Cancel',
      generating: 'Generating...',
      stage_analyzing: 'Analyzing parameters',
      stage_composing: 'Composing',
      stage_arranging: 'Arranging',
      stage_mixing: 'Mixing',
      stage_mastering: 'Mastering',
      stage_finalizing: 'Finalizing',
      previewTitle: 'Preview',
      trackTitle: 'Track Title',
      download: 'Download',
      share: 'Share',
      regenerate: 'Regenerate',
      saveAndUse: 'Save & Use',
      success: 'Creation Successful!',
      successDesc: 'Your music has been saved to library'
    }
  };

  const text = t[lang];

  const stages = [
    { key: 'analyzing', label: text.stage_analyzing, duration: 2000 },
    { key: 'composing', label: text.stage_composing, duration: 5000 },
    { key: 'arranging', label: text.stage_arranging, duration: 4000 },
    { key: 'mixing', label: text.stage_mixing, duration: 3000 },
    { key: 'mastering', label: text.stage_mastering, duration: 2000 },
    { key: 'finalizing', label: text.stage_finalizing, duration: 1000 }
  ];

  const handleGenerate = () => {
    setStep('generating');
    setGenerationProgress(0);
    
    // Simulate generation with realistic stages
    let currentProgress = 0;
    let stageIndex = 0;

    const runStage = () => {
      if (stageIndex >= stages.length) {
        // Generation complete
        const newTrack = {
          id: Date.now(),
          title: prompt.slice(0, 30) || 'Untitled Track',
          style: style || 'Electronic',
          duration: `${Math.floor(parseInt(duration) / 60)}:${(parseInt(duration) % 60).toString().padStart(2, '0')}`,
          date: new Date().toISOString().split('T')[0],
          status: 'Draft',
          plays: '-'
        };
        setGeneratedTrack(newTrack);
        setStep('preview');
        return;
      }

      const stage = stages[stageIndex];
      setGenerationStage(stage.label);

      const interval = 50;
      const steps = stage.duration / interval;
      const progressPerStep = (100 / stages.length) / steps;

      let stepCount = 0;
      const timer = setInterval(() => {
        stepCount++;
        currentProgress += progressPerStep;
        setGenerationProgress(Math.min(currentProgress, 100));

        if (stepCount >= steps) {
          clearInterval(timer);
          stageIndex++;
          runStage();
        }
      }, interval);
    };

    runStage();
  };

  const handleSave = () => {
    if (generatedTrack) {
      onSuccess(generatedTrack);
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  };

  const handleClose = () => {
    setStep('input');
    setPrompt('');
    setStyle('');
    setGenerationProgress(0);
    setGeneratedTrack(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden max-h-[90vh]">
        <div className="px-8 pt-8 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Wand2 className="w-6 h-6 text-purple-400" />
              </div>
              {text.title}
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-2">{text.subtitle}</p>
          </DialogHeader>
        </div>

        <AnimatePresence mode="wait">
          {/* Input Step */}
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8 overflow-y-auto max-h-[calc(90vh-140px)]"
            >
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-black/60 rounded-xl p-1 gap-1 mb-6">
                  <TabsTrigger value="text" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
                    <Music className="w-4 h-4 mr-2" />
                    {text.inputTab}
                  </TabsTrigger>
                  <TabsTrigger value="vocal" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                    <Mic className="w-4 h-4 mr-2" />
                    {text.vocalTab}
                  </TabsTrigger>
                  <TabsTrigger value="melody" className="rounded-lg data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300">
                    <Upload className="w-4 h-4 mr-2" />
                    {text.melodyTab}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.promptLabel}</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={text.promptPlaceholder}
                      className="bg-black/50 border-white/10 h-32 resize-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.styleLabel}</Label>
                      <Input
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        placeholder={text.stylePlaceholder}
                        className="bg-black/50 border-white/10 h-12 focus:border-purple-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-400 uppercase tracking-wider">{text.durationLabel}</Label>
                      <Input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="bg-black/50 border-white/10 h-12 focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  {/* Quick Style Tags */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">Quick Styles</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Cyberpunk', 'Lo-fi', 'EDM', 'Synthwave', 'Ambient', 'Rock'].map((tag) => (
                        <Badge
                          key={tag}
                          onClick={() => setStyle(tag)}
                          className={`cursor-pointer transition-all ${
                            style === tag
                              ? 'bg-purple-500 text-white border-purple-500'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                          }`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vocal" className="space-y-6">
                  <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center hover:border-cyan-500/50 transition-all cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Mic className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Record Your Voice</h4>
                    <p className="text-sm text-gray-500 text-center">Hum or sing a melody, AI will create a full track</p>
                  </div>
                </TabsContent>

                <TabsContent value="melody" className="space-y-6">
                  <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center hover:border-pink-500/50 transition-all cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-pink-400" />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Upload Audio File</h4>
                    <p className="text-sm text-gray-500 text-center">Drop MIDI, MP3, or WAV file to generate variations</p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleClose} className="flex-1 h-12 border-white/10">
                  {text.cancel}
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {text.generate}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-8 pb-8"
            >
              <div className="py-12 space-y-8">
                {/* Animated Icon */}
                <div className="relative mx-auto w-32 h-32">
                  <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Wand2 className="w-16 h-16 text-purple-400" />
                    </motion.div>
                  </div>
                </div>

                {/* Stage Label */}
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white mb-2">{text.generating}</h3>
                  <p className="text-gray-400">{generationStage}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-3">
                  <Progress value={generationProgress} className="h-2 bg-white/5" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">AI 正在创作...</span>
                    <span className="text-purple-400 font-mono font-bold">{Math.round(generationProgress)}%</span>
                  </div>
                </div>

                {/* Waveform Animation */}
                <div className="flex items-end justify-center gap-1 h-16">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-full"
                      animate={{
                        height: ['20%', '80%', '30%', '90%', '40%'],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.05,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview Step */}
          {step === 'preview' && generatedTrack && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-8 pb-8"
            >
              <div className="space-y-6">
                {/* Track Info Card */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Music className="w-10 h-10 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={generatedTrack.title}
                        onChange={(e) => setGeneratedTrack({ ...generatedTrack, title: e.target.value })}
                        className="bg-black/50 border-white/10 h-12 text-lg font-bold mb-2"
                      />
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>{generatedTrack.style}</span>
                        <span>•</span>
                        <span>{generatedTrack.duration}</span>
                      </div>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Button size="icon" className="h-12 w-12 rounded-full bg-purple-600 hover:bg-purple-500">
                        <Play className="w-5 h-5" />
                      </Button>
                      <div className="flex-1">
                        <Progress value={0} className="h-2 bg-white/10" />
                      </div>
                      <Button size="icon" variant="outline" className="h-10 w-10 border-white/10">
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" className="h-12 border-white/10">
                    <Download className="w-4 h-4 mr-2" />
                    {text.download}
                  </Button>
                  <Button variant="outline" className="h-12 border-white/10">
                    <Share2 className="w-4 h-4 mr-2" />
                    {text.share}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('input')} className="h-12 border-white/10">
                    <Edit3 className="w-4 h-4 mr-2" />
                    {text.regenerate}
                  </Button>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSave}
                  className="w-full h-14 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {text.saveAndUse}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8"
            >
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="relative mx-auto w-24 h-24 mb-8"
                >
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </motion.div>
                <h3 className="text-3xl font-black text-white mb-3">{text.success}</h3>
                <p className="text-gray-400">{text.successDesc}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
