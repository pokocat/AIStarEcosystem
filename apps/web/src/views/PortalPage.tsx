"use client";

import type { CSSProperties } from "react";
import { Award, ChevronRight, Globe as GlobeIcon, Heart, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { Lang } from '../types/app';

interface PortalPageProps {
  lang: Lang;
  copy: any;
  onSelectRole: (role: 'fan' | 'producer_intro' | 'coach') => void;
  onToggleLang: () => void;
}

export function PortalPage({ lang, copy, onSelectRole, onToggleLang }: PortalPageProps) {
  const buildBackgroundStyle = (backgroundUrl: string): CSSProperties => ({
    backgroundImage: `url(${backgroundUrl})`,
  });

  return (
    <div className="h-screen w-full flex bg-black overflow-hidden font-sans relative">
      <div className="absolute top-4 right-4 z-50">
        <Button variant="ghost" onClick={onToggleLang} className="bg-black/50 text-white backdrop-blur hover:bg-white/20 rounded-full">
          <GlobeIcon className="w-4 h-4 mr-1" /> {lang === 'zh' ? 'EN' : '中'}
        </Button>
      </div>

      <div onClick={() => onSelectRole('fan')} className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
        <div
          style={buildBackgroundStyle("https://images.unsplash.com/photo-1514525253440-b393452e2347?w=1200&q=80")}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-pink-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Heart className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{copy.fan_title}</h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{copy.fan_desc}</p>
            <Button className="bg-white text-pink-900 hover:bg-white/90 rounded-full px-8 font-bold">{copy.fan_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </div>
      </div>

      <div onClick={() => onSelectRole('producer_intro')} className="relative flex-1 border-r border-white/10 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
        <div
          style={buildBackgroundStyle("https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80")}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-cyan-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Zap className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{copy.maker_title}</h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{copy.maker_desc}</p>
            <Button className="bg-white text-cyan-900 hover:bg-white/90 rounded-full px-8 font-bold">{copy.maker_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </div>
      </div>

      <div onClick={() => onSelectRole('coach')} className="relative flex-1 transition-all duration-700 ease-in-out hover:flex-[2.5] group cursor-pointer overflow-hidden">
        <div
          style={buildBackgroundStyle("https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80")}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/70 group-hover:bg-purple-900/60 transition-colors duration-500" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
          <Award className="w-16 h-16 text-white/50 group-hover:text-white mb-6 transition-colors duration-300 transform group-hover:-translate-y-4" />
          <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">{copy.coach_title}</h2>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
            <p className="text-sm text-white/70 max-w-xs mx-auto mb-8 leading-relaxed">{copy.coach_desc}</p>
            <Button className="bg-white text-purple-900 hover:bg-white/90 rounded-full px-8 font-bold">{copy.coach_btn} <ChevronRight className="w-4 h-4 ml-2" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
