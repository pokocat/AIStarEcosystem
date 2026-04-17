"use client";

/**
 * Extracted from figma/src/App.tsx — role selection splash screen with
 * three sliding panels: Fan / Maker(Producer) / Studio(Coach).
 */

import { Users, Rocket, Briefcase, ChevronRight, Globe as GlobeIcon } from "lucide-react";
import { Button } from "./ui/button";
import { TRANSLATIONS, type Lang } from "@/translations";

export type PortalRole = "fan" | "producer_intro" | "studio";

interface PortalProps {
  onSelectRole: (role: PortalRole) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export function Portal({ onSelectRole, lang, setLang }: PortalProps) {
  const t = TRANSLATIONS[lang].portal;
  return (
    <div className="h-screen w-full flex bg-black overflow-hidden font-sans relative">
      {/* Lang Switch */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          className="bg-black/50 text-white backdrop-blur hover:bg-white/20 rounded-full"
        >
          <GlobeIcon className="w-4 h-4 mr-1" /> {lang === "zh" ? "EN" : "中"}
        </Button>
      </div>

      {/* Fan - 艺人观赏台 */}
      <div
        onClick={() => onSelectRole("fan")}
        className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253440-b393452e2347?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-pink-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Users className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
            {t.fan_title}
          </h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.fan_desc}</p>
            <Button className="bg-white text-pink-900 hover:bg-white/90 rounded-full px-8 font-bold">
              {t.fan_btn} <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Maker - 生态创业者 */}
      <div
        onClick={() => onSelectRole("producer_intro")}
        className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-cyan-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Rocket className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
            {t.maker_title}
          </h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.maker_desc}</p>
            <Button className="bg-white text-cyan-900 hover:bg-white/90 rounded-full px-8 font-bold">
              {t.maker_btn} <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Studio - 专业发行机构 */}
      <div
        onClick={() => onSelectRole("studio")}
        className="relative flex-1 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=80')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-purple-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Briefcase className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
            {t.studio_title}
          </h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{t.studio_desc}</p>
            <Button className="bg-white text-purple-900 hover:bg-white/90 rounded-full px-8 font-bold">
              {t.studio_btn} <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
