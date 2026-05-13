"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@ai-star-eco/ui/ui/dialog';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Progress } from '@ai-star-eco/ui/ui/progress';
import { 
  Sparkles, ArrowRight, CheckCircle2, Rocket, Music, Users, 
  Zap, X, ChevronLeft, ChevronRight, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingStep {
  id: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  icon: any;
  iconColor: string;
  action?: { zh: string; en: string };
  highlight?: string; // CSS selector for highlighting
}

interface OnboardingGuideProps {
  isOpen: boolean;
  onComplete: () => void;
  lang: 'zh' | 'en';
  onNavigate?: (page: string) => void;
}

export default function OnboardingGuide({ isOpen, onComplete, lang, onNavigate }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: { 
        zh: '欢迎来到 AI Star Eco 🎉', 
        en: 'Welcome to AI Star Eco 🎉' 
      },
      description: { 
        zh: '这是全球首个去中心化虚拟艺人孵化网络。让我们用 60 秒了解如何快速上手，开启你的 AI 音乐帝国！', 
        en: 'The world\'s first decentralized virtual artist incubation network. Let\'s take 60 seconds to learn how to get started and build your AI music empire!' 
      },
      icon: Sparkles,
      iconColor: 'text-purple-400'
    },
    {
      id: 'create_artist',
      title: { 
        zh: '步骤 1：孵化你的首位 AI 歌手', 
        en: 'Step 1: Create Your First AI Artist' 
      },
      description: { 
        zh: '点击"孵化新歌手"按钮，通过文本描述、图像上传或混合模式来定制专属的虚拟艺人。调整甜度、能量、神秘感参数，打造独特人设。', 
        en: 'Click "Create New Artist" to customize your virtual artist using text, images, or hybrid mode. Adjust sweetness, energy, and mystery parameters to create a unique persona.' 
      },
      icon: Users,
      iconColor: 'text-cyan-400',
      action: { zh: '前往孵化页面', en: 'Go to Creation' }
    },
    {
      id: 'create_music',
      title: { 
        zh: '步骤 2：创作音乐作品', 
        en: 'Step 2: Create Music' 
      },
      description: { 
        zh: '在音乐工坊中，选择 11 种创作模式之一（如"纯文本生成"、"旋律哼唱"、"风格迁移"等），AI 将在 30 秒内为你生成专业级音乐。', 
        en: 'In the music studio, choose from 11 creation modes (like "Text-to-Music", "Melody Humming", "Style Transfer", etc.). AI generates professional-grade music in 30 seconds.' 
      },
      icon: Music,
      iconColor: 'text-pink-400',
      action: { zh: '前往创作工坊', en: 'Go to Studio' }
    },
    {
      id: 'distribute',
      title: { 
        zh: '步骤 3：全网发行', 
        en: 'Step 3: Global Distribution' 
      },
      description: { 
        zh: '选择你的作品，配置发行渠道（国内平台/全球流媒体/短视频矩阵），一键发布到 150+ 音乐平台。AI 会自动生成短视频切片，引爆社交媒体！', 
        en: 'Select your track, configure distribution channels (domestic/global/short video), and publish to 150+ platforms with one click. AI auto-generates viral video clips!' 
      },
      icon: Rocket,
      iconColor: 'text-emerald-400',
      action: { zh: '前往发行页面', en: 'Go to Distribution' }
    },
    {
      id: 'monetize',
      title: { 
        zh: '步骤 4：铸造 NFT & 变现', 
        en: 'Step 4: Mint NFTs & Monetize' 
      },
      description: { 
        zh: '将你的音乐铸造为限量 NFT，设置稀有度和专属权益（如空投、见面会、独家内容）。粉丝每次购买，你都能获得收益分成！', 
        en: 'Mint your music as limited NFTs, set rarity and exclusive perks (airdrops, meet-and-greets, exclusive content). Earn revenue from every fan purchase!' 
      },
      icon: Zap,
      iconColor: 'text-yellow-400',
      action: { zh: '前往铸造页面', en: 'Go to Minting' }
    },
    {
      id: 'complete',
      title: { 
        zh: '准备就绪！🚀', 
        en: 'You\'re All Set! 🚀' 
      },
      description: { 
        zh: '现在你已掌握核心流程。记得定期查看收益中心，追踪播放量和分润数据。建议先创建 1-2 个艺人进行测试，找到最适合你的风格！', 
        en: 'You now know the core workflow. Check your earnings center regularly to track plays and revenue. Start with 1-2 test artists to find your style!' 
      },
      icon: Target,
      iconColor: 'text-purple-400'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps([...completedSteps, steps[currentStep].id]);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    localStorage.setItem('onboarding_completed', 'true');
  };

  const handleComplete = () => {
    setCompletedSteps([...completedSteps, steps[currentStep].id]);
    onComplete();
    localStorage.setItem('onboarding_completed', 'true');
  };

  const handleActionClick = () => {
    const step = steps[currentStep];
    const pageMap: Record<string, string> = {
      create_artist: 'persona',
      create_music: 'studio',
      distribute: 'distribution',
      monetize: 'nft_mint'
    };
    
    if (onNavigate && pageMap[step.id]) {
      onNavigate(pageMap[step.id]);
      handleComplete();
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const Icon = step.icon;

  const t = {
    zh: {
      skip: '跳过引导',
      prev: '上一步',
      next: '下一步',
      getStarted: '开始使用',
      stepOf: '步骤'
    },
    en: {
      skip: 'Skip',
      prev: 'Previous',
      next: 'Next',
      getStarted: 'Get Started',
      stepOf: 'Step'
    }
  };

  const text = t[lang];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl bg-[#0c0c0e] border-white/10 text-white p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with Progress */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-gray-400 font-mono">
              {text.stepOf} {currentStep + 1} / {steps.length}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-400 hover:text-white h-8"
            >
              {text.skip}
            </Button>
          </div>
          <Progress value={progress} className="h-1 bg-white/10" />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="px-8 pb-8"
          >
            {/* Icon */}
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-3xl opacity-50" />
              <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-2xl border border-white/10 flex items-center justify-center">
                <Icon className={`w-10 h-10 ${step.iconColor}`} />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-black text-center mb-4">
              {step.title[lang]}
            </h3>

            {/* Description */}
            <p className="text-gray-400 text-center leading-relaxed mb-8 px-4">
              {step.description[lang]}
            </p>

            {/* Action Button (for specific steps) */}
            {step.action && (
              <div className="flex justify-center mb-6">
                <Button
                  onClick={handleActionClick}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 h-12 px-8"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {step.action[lang]}
                </Button>
              </div>
            )}

            {/* Checkpoints */}
            {currentStep === steps.length - 1 && (
              <div className="space-y-2 mb-6">
                {steps.slice(1, -1).map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-gray-300">{s.title[lang]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex-1 h-12 border-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {text.prev}
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  className="flex-1 h-12 bg-purple-600 hover:bg-purple-500"
                >
                  {text.next}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {text.getStarted}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 pb-6">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep 
                  ? 'w-8 bg-purple-500' 
                  : i < currentStep 
                  ? 'w-1.5 bg-emerald-500' 
                  : 'w-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
