import React from 'react';
import { Boxes, Clapperboard, FileText, Film, LayoutDashboard } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { ProjectMode } from './directorData';
import { VIEW_LABELS, type StudioView } from './studioModel';

const ICONS: Record<StudioView, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  canvas: LayoutDashboard, script: FileText, assets: Boxes, storyboard: Clapperboard, final: Film,
};
const ORDER: StudioView[] = ['canvas', 'script', 'assets', 'storyboard', 'final'];

/** Vertical view switcher between the chat and the work area (horizontal on small screens). */
export const ViewRail = ({ lang, mode, view, onView, badges }: { lang: Lang; mode: ProjectMode; view: StudioView; onView: (v: StudioView) => void; badges: Partial<Record<StudioView, number>> }) => {
  const labels = VIEW_LABELS(mode);
  return (
    <nav aria-label={lang === 'zh' ? '导演台视图' : 'Director views'}
      className="shrink-0 flex lg:flex-col gap-1 p-1.5 lg:w-[72px] border-b lg:border-b-0 lg:border-r border-gray-200 bg-white overflow-x-auto">
      {ORDER.map(id => {
        const Icon = ICONS[id];
        const active = id === view;
        const badge = badges[id];
        return (
          <button key={id} type="button" onClick={() => onView(id)} aria-current={active ? 'page' : undefined}
            className={`relative shrink-0 w-16 lg:w-full rounded-xl py-2 flex flex-col items-center gap-1 text-[11px] font-medium transition ${active ? 'text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
            style={active ? { background: '#f5f3ff', boxShadow: 'inset 0 0 0 1.5px #8b5cf6' } : undefined}>
            <Icon className="w-4 h-4" style={active ? { color: '#7c3aed' } : undefined} />
            {labels[id][lang]}
            {badge ? <span className="absolute right-1.5 top-1 min-w-[16px] h-4 rounded-full px-1 text-[9px] font-bold leading-4" style={{ background: '#f59e0b', color: '#fff' }}>{badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
};
