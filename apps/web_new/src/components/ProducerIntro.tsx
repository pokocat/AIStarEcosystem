"use client";

/**
 * Extracted from figma/src/App.tsx — producer onboarding splash.
 */

import { ArrowRight, Globe as GlobeIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { TRANSLATIONS, type Lang } from "@/translations";

interface ProducerIntroProps {
  onEnterApp: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export function ProducerIntro({ onEnterApp, lang, setLang }: ProducerIntroProps) {
  const t = TRANSLATIONS[lang].portal;
  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          className="bg-white/10 text-white backdrop-blur rounded-full"
        >
          <GlobeIcon className="w-4 h-4 mr-1" /> {lang === "zh" ? "EN" : "中"}
        </Button>
      </div>
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="max-w-3xl space-y-8">
          <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-500/30">
            Producer Program Phase 2.0
          </Badge>
          <h1 className="text-6xl font-bold leading-tight">
            {t.maker_title}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
              {lang === "zh" ? "孵化属于你的虚拟偶像矩阵" : "Incubate Your Virtual Idol Matrix"}
            </span>
          </h1>
          <p className="text-xl text-gray-400">{t.maker_desc}</p>
          <Button
            onClick={onEnterApp}
            size="lg"
            className="h-14 px-10 text-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
          >
            {lang === "zh" ? "进入制作人控制台" : "Enter Producer Console"}
            <ArrowRight className="ml-2" />
          </Button>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000')] bg-cover bg-left pointer-events-none mask-linear" />
    </div>
  );
}
