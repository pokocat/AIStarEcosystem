/**
 * Shared frame for the console's hub pages: title, description and the sub-tab bar,
 * all read from consoleNav so labels never drift between sidebar, tabs and ⌘K search.
 */
import React, { useState } from 'react';
import type { Lang } from '../../translations';
import { NAV_GROUPS, defaultTab, findPage, tabsOf } from './consoleNav';

/** Tab state for a hub, seeded from a deep link (e.g. 发布中心 › 内容日历). */
export const useHubTab = (pageId: string, initialTab?: string) =>
  useState<string>(() => (initialTab && tabsOf(pageId).some(t => t.id === initialTab) ? initialTab : defaultTab(pageId) ?? ''));

interface Props {
  lang: Lang;
  pageId: string;
  active: string;
  onChange: (tab: string) => void;
  /** Small counters shown next to tab labels. */
  badges?: Record<string, string | number | undefined>;
  /** Extra controls on the right of the title row. */
  actions?: React.ReactNode;
  /** Optional strip between the header and the tab content. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

export const HubShell = ({ lang, pageId, active, onChange, badges, actions, banner, children }: Props) => {
  const zh = lang === 'zh';
  const page = findPage(pageId);
  const accent = page?.accent ?? '#7c3aed';
  const tabs = tabsOf(pageId);
  const PageIcon = page?.icon;
  // Numbered group eyebrow, matching the sidebar ("04 · 发布与增长").
  const gi = NAV_GROUPS.findIndex(g => g.pages.some(p => p.id === pageId));
  const group = gi >= 0 ? NAV_GROUPS[gi].title : null;
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-[#ffffff] px-4 pt-4 pb-3 md:px-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(520px 180px at 0% 0%, ${accent}1c, transparent 70%)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {PageIcon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}14`, color: accent }}>
                <PageIcon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              {group && (
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                  <span className="eyebrow-mono text-slate-400">{String(gi + 1).padStart(2, '0')} · {zh ? group.zh : group.en}</span>
                </div>
              )}
              <h1 className="text-xl font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
                {page ? (zh ? page.zh : page.en) : pageId}
              </h1>
              {page && <p className="mt-0.5 text-xs text-slate-500">{zh ? page.desc.zh : page.desc.en}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {tabs.length > 1 && (
          <nav role="tablist" aria-label={page ? (zh ? page.zh : page.en) : undefined}
            className="relative -mx-1 mt-3 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {tabs.map(tab => {
              const on = tab.id === active;
              const Icon = tab.icon;
              const badge = badges?.[tab.id];
              return (
                <button key={tab.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${on ? '' : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                  style={on ? { background: `${accent}12`, borderColor: `${accent}33`, color: accent } : undefined}>
                  <Icon className="h-3.5 w-3.5" />
                  {zh ? tab.zh : tab.en}
                  {badge !== undefined && badge !== '' && (
                    <span className="rounded-full px-1.5 text-[10px] font-semibold leading-4"
                      style={on ? { background: accent, color: '#ffffff' } : { background: '#e2e8f0', color: '#475569' }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>
      {banner}
      <div role="tabpanel" className="min-w-0">{children}</div>
    </div>
  );
};
