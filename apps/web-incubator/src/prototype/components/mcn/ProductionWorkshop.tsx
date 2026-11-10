/**
 * 制作工坊 — AI 创作（一个入口：左栏在 AI 导演 / AI 图片 / AI 视频 之间切换）与批量工具。
 * AI 图片 / AI 视频按场景出单条内容，结果可直接发到当前导演项目；导演项目里的镜头和资产
 * 也能直接调起同一个生成器。两边共用场景、模型、星币和素材库。
 */
import React, { useState } from 'react';
import { Factory, Layers, Scissors, Sparkles, User } from 'lucide-react';
import type { Lang } from '../../translations';
import { ClipStudio } from './ClipStudio';
import { DigitalPersonHub } from './DigitalPersonHub';
import { BatchMixStudio } from './BatchMixStudio';
import { AIDirectorStudio } from './director/AIDirectorStudio';
import type { CreateMode } from './director/CreateModeMenu';
import type { Artist } from './ArtistTypes';
import { getSolutionLabel, type SolutionId } from '../../data/ipPlatform';
import { getWorkshopProfile } from './director/workshopProfiles';
import type { DirectorImport } from './director/handoff';

/** `director` / `image` / `video` are the three AI 创作 modes; the rest are batch tools. */
export type WorkshopTab = CreateMode | 'clip' | 'digital_person' | 'batch_mix';
/**
 * One-shot request to the AI 导演: open the new-project dialog (optionally prefilled) or the works
 * library. `handoff` on `new` becomes the first shot of the project once created.
 */
export type WorkshopIntent = { kind: 'new' | 'works'; id: number; preset?: { name: string; description: string }; handoff?: DirectorImport };

interface Props {
  lang: Lang;
  activeArtist: Artist;
  /** Homepage the user came from; drives scenes, templates, deliverables and tool order. */
  solutionId: SolutionId;
  tab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  intent?: WorkshopIntent | null;
  onOpenPublish?: () => void;
}

const ACCENT = '#7c3aed';
const isCreate = (t: WorkshopTab): t is CreateMode => t === 'director' || t === 'image' || t === 'video';

export const ProductionWorkshop = ({ lang, activeArtist, solutionId, tab: activeTab, onTabChange: setActiveTab, intent = null, onOpenPublish }: Props) => {
  const zh = lang === 'zh';
  const profile = getWorkshopProfile(solutionId, activeArtist.type);
  // AI 创作 reopens in the mode last used.
  const [lastMode, setLastMode] = useState<CreateMode>(isCreate(activeTab) ? activeTab : 'director');
  const createMode = isCreate(activeTab) ? activeTab : lastMode;
  const setMode = (m: CreateMode) => { setLastMode(m); setActiveTab(m); };

  const tools = {
    clip: { id: 'clip' as const, icon: Scissors, zh: '真人切片', en: 'Clip Studio' },
    digital_person: { id: 'digital_person' as const, icon: User, zh: 'AI 数字人', en: 'Digital Human' },
    batch_mix: { id: 'batch_mix' as const, icon: Layers, zh: '混剪批量', en: 'Batch Mix' },
  };
  const tabs = [
    { id: 'create', icon: Sparkles, zh: 'AI 创作', en: 'AI Create', on: isCreate(activeTab), go: () => setMode(createMode) },
    ...profile.tools.map(id => ({ ...tools[id], on: activeTab === id, go: () => setActiveTab(id) })),
  ];

  return (
    <div className="flex flex-col overflow-visible rounded-2xl border border-gray-200 bg-slate-50 lg:h-[calc(100vh-6rem)] lg:min-h-[640px] lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-200 bg-white px-3 py-2.5 md:px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${ACCENT}14`, color: ACCENT }}><Factory className="h-4 w-4" /></span>
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{zh ? '制作工坊' : 'Workshop'}</h1>
            <div className="text-[11px] text-slate-500">{getSolutionLabel(solutionId)[lang]} · {profile.focus[lang]}</div>
          </div>
        </div>
        <nav role="tablist" aria-label={zh ? '制作工具' : 'Production tools'} className="-mx-1 flex min-w-0 flex-1 basis-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:basis-auto">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <React.Fragment key={tab.id}>
                {i === 1 && <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-gray-200" />}
                {i === 1 && <span className="hidden shrink-0 pr-0.5 text-[11px] text-slate-500 md:inline">{zh ? '批量工具' : 'Batch'}</span>}
                <button type="button" role="tab" aria-selected={tab.on} onClick={tab.go}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${tab.on ? '' : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                  style={tab.on ? { background: `${ACCENT}12`, borderColor: `${ACCENT}33`, color: ACCENT } : undefined}>
                  <Icon className="h-3.5 w-3.5" />{zh ? tab.zh : tab.en}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      </header>

      {/* Desktop: fixed-height workspace with inner scrolling. Mobile: the page scrolls naturally. */}
      <div className="min-h-0 flex-1 lg:overflow-hidden">
        {/* Kept mounted so the project, drafts and renders survive switching to a batch tool. */}
        <div className={isCreate(activeTab) ? 'lg:h-full' : 'hidden'}>
          <AIDirectorStudio key={`${solutionId}-${activeArtist.id}`} lang={lang} activeArtist={activeArtist} solutionId={solutionId}
            intent={intent} onOpenPublish={onOpenPublish} mode={createMode} onMode={setMode} />
        </div>
        {/* Batch tools share the AI 创作 layout and follow the active IP. */}
        {activeTab === 'clip' && <div className="lg:h-full"><ClipStudio key={activeArtist.id} lang={lang} activeArtist={activeArtist} onOpenPublish={onOpenPublish} /></div>}
        {activeTab === 'digital_person' && <div className="lg:h-full"><DigitalPersonHub key={activeArtist.id} lang={lang} activeArtist={activeArtist} onOpenPublish={onOpenPublish} /></div>}
        {activeTab === 'batch_mix' && <div className="lg:h-full"><BatchMixStudio key={activeArtist.id} lang={lang} activeArtist={activeArtist} onOpenPublish={onOpenPublish} /></div>}
      </div>
    </div>
  );
};
