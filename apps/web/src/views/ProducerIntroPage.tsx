import { ArrowRight, Globe as GlobeIcon, Sparkles, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { Lang } from '../types/app';

interface ProducerIntroPageProps {
  lang: Lang;
  copy: any;
  onEnterApp: () => void;
  onToggleLang: () => void;
}

export function ProducerIntroPage({ lang, copy, onEnterApp, onToggleLang }: ProducerIntroPageProps) {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.15),transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.15),transparent_25%)]" />
      <div className="absolute top-4 right-4 z-50">
        <Button variant="ghost" onClick={onToggleLang} className="bg-black/50 text-white backdrop-blur hover:bg-white/20 rounded-full">
          <GlobeIcon className="w-4 h-4 mr-1" /> {lang === 'zh' ? 'EN' : '中'}
        </Button>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 min-h-screen flex items-center">
        <div className="grid lg:grid-cols-2 gap-14 items-center w-full">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-xs uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Producer Workspace
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.92]">
              {lang === 'zh' ? '从 AI 歌手孵化到收益闭环。' : 'From AI incubation to monetization.'}
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed max-w-xl">
              {copy.maker_desc}
            </p>
            <div className="flex gap-4">
              <Button onClick={onEnterApp} className="h-14 px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-full">
                {copy.maker_btn} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: lang === 'zh' ? 'AI 歌手孵化' : 'Incubation', value: '06', color: 'text-cyan-400' },
                { label: lang === 'zh' ? '音乐生成模式' : 'Music Modes', value: '11', color: 'text-purple-400' },
                { label: lang === 'zh' ? '分发渠道' : 'Channels', value: '150+', color: 'text-emerald-400' },
                { label: lang === 'zh' ? '资产化路径' : 'Asset Paths', value: 'NFT', color: 'text-pink-400' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <div className={`text-3xl font-black ${item.color}`}>{item.value}</div>
                  <div className="text-sm text-gray-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <div className="font-bold text-white">{lang === 'zh' ? '生产级迁移后的工作台' : 'Production-ready workspace'}</div>
                <div className="text-sm text-gray-400">{lang === 'zh' ? '数据已与未来 Spring Boot 后端结构对齐。' : 'Data contracts aligned for a future Spring Boot backend.'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
