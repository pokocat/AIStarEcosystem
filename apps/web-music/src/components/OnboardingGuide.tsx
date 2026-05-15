"use client";

import { useState } from 'react';
import { Dialog, DialogContent } from '@ai-star-eco/ui/ui/dialog';
import { Button } from '@ai-star-eco/ui/ui/button';
import { Progress } from '@ai-star-eco/ui/ui/progress';
import {
  Sparkles, CheckCircle2, Rocket, Music, Users,
  Zap, ChevronLeft, ChevronRight, Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ONBOARDING_STORAGE_KEY = "aistareco.music.onboarding_completed";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  /** 当步骤有跳转动作时，CTA 文案 + 目标侧栏 id */
  action?: { label: string; navigateId: string };
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到 AI Star Eco 🎉',
    description: '这是全球首个去中心化虚拟艺人孵化网络。让我们用 60 秒了解如何快速上手，开启你的 AI 音乐帝国！',
    icon: Sparkles,
    iconColor: 'text-purple-400',
  },
  {
    id: 'create_artist',
    title: '步骤 1：孵化你的首位 AI 歌手',
    description: '点击"孵化新歌手"按钮，通过文本描述、图像上传或混合模式来定制专属的虚拟艺人。调整甜度、能量、神秘感参数，打造独特人设。',
    icon: Users,
    iconColor: 'text-cyan-400',
    action: { label: '前往孵化页面', navigateId: 'incubator' },
  },
  {
    id: 'create_music',
    title: '步骤 2：创作音乐作品',
    description: '在音乐工坊中，选择 11 种创作模式之一（如"纯文本生成"、"旋律哼唱"、"风格迁移"等），AI 将在 30 秒内为你生成专业级音乐。',
    icon: Music,
    iconColor: 'text-pink-400',
    action: { label: '前往创作工坊', navigateId: 'studio' },
  },
  {
    id: 'distribute',
    title: '步骤 3：全网发行',
    description: '选择你的作品，配置发行渠道（国内平台/全球流媒体/短视频矩阵），一键发布到 150+ 音乐平台。AI 会自动生成短视频切片，引爆社交媒体！',
    icon: Rocket,
    iconColor: 'text-emerald-400',
    action: { label: '前往发行页面', navigateId: 'distribution' },
  },
  {
    id: 'monetize',
    title: '步骤 4：铸造 NFT & 变现',
    description: '将你的音乐铸造为限量 NFT，设置稀有度和专属权益（如空投、见面会、独家内容）。粉丝每次购买，你都能获得收益分成！',
    icon: Zap,
    iconColor: 'text-yellow-400',
    action: { label: '前往版权与铸造', navigateId: 'copyright' },
  },
  {
    id: 'complete',
    title: '准备就绪！🚀',
    description: '现在你已掌握核心流程。记得定期查看收益中心，追踪播放量和分润数据。建议先创建 1-2 个艺人进行测试，找到最适合你的风格！',
    icon: Target,
    iconColor: 'text-purple-400',
  },
];

interface OnboardingGuideProps {
  isOpen: boolean;
  onComplete: () => void;
  /** 由 Shell 传入，接受侧栏 id（如 "incubator" / "studio"），内部完成路由跳转 */
  onNavigate?: (navigateId: string) => void;
}

export default function OnboardingGuide({ isOpen, onComplete, onNavigate }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps([...completedSteps, STEPS[currentStep].id]);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const finish = () => {
    onComplete();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
  };

  const handleSkip = () => finish();

  const handleComplete = () => {
    setCompletedSteps([...completedSteps, STEPS[currentStep].id]);
    finish();
  };

  const handleActionClick = () => {
    const step = STEPS[currentStep];
    if (step.action && onNavigate) {
      onNavigate(step.action.navigateId);
      handleComplete();
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const step = STEPS[currentStep];
  const Icon = step.icon;

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
              步骤 {currentStep + 1} / {STEPS.length}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-400 hover:text-white h-8"
            >
              跳过引导
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
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-3xl opacity-50" />
              <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-2xl border border-white/10 flex items-center justify-center">
                <Icon className={`w-10 h-10 ${step.iconColor}`} />
              </div>
            </div>

            <h3 className="text-2xl font-black text-center mb-4">{step.title}</h3>
            <p className="text-gray-400 text-center leading-relaxed mb-8 px-4">{step.description}</p>

            {step.action && (
              <div className="flex justify-center mb-6">
                <Button
                  onClick={handleActionClick}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 h-12 px-8"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {step.action.label}
                </Button>
              </div>
            )}

            {currentStep === STEPS.length - 1 && (
              <div className="space-y-2 mb-6">
                {STEPS.slice(1, -1).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-gray-300">{s.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex-1 h-12 border-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />上一步
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  className="flex-1 h-12 bg-purple-600 hover:bg-purple-500"
                >
                  下一步
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  className="flex-1 h-12 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                >
                  <Rocket className="w-4 h-4 mr-2" />开始使用
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2 pb-6">
          {STEPS.map((s, i) => (
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
