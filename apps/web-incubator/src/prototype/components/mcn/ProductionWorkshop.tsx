/**
 * 制作工坊 - 整合多种制作工具
 */

import React from 'react';
import { Clapperboard, Scissors, User, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import type { Lang } from '../../translations';
import { ClipStudio } from './ClipStudio';
import { DigitalPersonHub } from './DigitalPersonHub';
import { BatchMixStudio } from './BatchMixStudio';
import { AIDirectorStudio } from './director/AIDirectorStudio';
import type { Artist } from './ArtistTypes';
import { getSolutionLabel, type SolutionId } from '../../data/ipPlatform';
import { getWorkshopProfile } from './director/workshopProfiles';

export type WorkshopTab = 'director' | 'clip' | 'digital_person' | 'batch_mix';
/** One-shot request from elsewhere in the console: open the new-project dialog or the works library. */
export type WorkshopIntent = { kind: 'new' | 'works'; id: number };

interface Props {
  lang: Lang;
  activeArtist: Artist;
  /** Homepage the user came from; drives templates, deliverables and tool order. */
  solutionId: SolutionId;
  tab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  intent?: WorkshopIntent | null;
  onOpenPublish?: () => void;
}

export const ProductionWorkshop = ({ lang, activeArtist, solutionId, tab: activeTab, onTabChange: setActiveTab, intent = null, onOpenPublish }: Props) => {
  const zh = lang === 'zh';
  const profile = getWorkshopProfile(solutionId, activeArtist.type);

  const tools = {
    clip: { id: 'clip' as const, icon: Scissors, labelZh: '切片制作', labelEn: 'Clip Studio', color: '#06b6d4' },
    digital_person: { id: 'digital_person' as const, icon: User, labelZh: 'AI数字人', labelEn: 'Digital Person', color: '#a855f7' },
    batch_mix: { id: 'batch_mix' as const, icon: Layers, labelZh: '混剪批量', labelEn: 'Batch Mix', color: '#f59e0b' },
  };
  // The AI director comes first; the other tools follow the order that suits this solution.
  const tabs = [
    { id: 'director' as const, icon: Clapperboard, labelZh: 'AI 导演台', labelEn: 'AI Director', color: '#8b5cf6' },
    ...profile.tools.map(id => tools[id]),
  ];

  return (
    <div className="lg:h-[calc(100vh-6rem)] lg:min-h-[640px] flex flex-col bg-black rounded-xl lg:overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent"
          style={{ fontFamily: 'var(--font-display)' }}>
          {zh ? '制作工坊' : 'Production Workshop'}
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {getSolutionLabel(solutionId)[lang]} · {profile.focus[lang]}
        </span>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={isActive ? { boxShadow: `0 0 20px ${tab.color}40`, border: `1px solid ${tab.color}30` } : undefined}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{zh ? tab.labelZh : tab.labelEn}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeWorkshopTab"
                    className="absolute inset-0 rounded-xl -z-10 bg-white/5"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {/* Desktop: fixed-height workspace with inner scrolling. Mobile: the page scrolls naturally. */}
      <div className={`flex-1 min-h-0 ${activeTab === 'director' ? 'lg:overflow-hidden' : 'lg:overflow-y-auto'}`}>
        {/* Kept mounted so the canvas survives switching tabs. */}
        <div className={activeTab === 'director' ? 'lg:h-full' : 'hidden'}>
          <AIDirectorStudio key={`${solutionId}-${activeArtist.id}`} lang={lang} activeArtist={activeArtist} solutionId={solutionId} intent={intent} onOpenPublish={onOpenPublish} />
        </div>
        {activeTab === 'clip' && <ClipStudio lang={lang} />}
        {activeTab === 'digital_person' && <DigitalPersonHub lang={lang} />}
        {activeTab === 'batch_mix' && <BatchMixStudio lang={lang} />}
      </div>
    </div>
  );
};
