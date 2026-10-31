"use client";

import type { ReactNode, Ref } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { studioNavigation, studioNavigationCurrent } from '@/shell/studio-navigation';
import { useUiVersion } from '@/shell/ui-version';
import { Hourglass, Search, X } from 'lucide-react';
import { HubTabBar } from '@/components/hub/ui';
import { UiVersionSwitch } from '@/shell/ui-version-switch';

/** The four workspace routes share one paper surface, heading and mobile navigation. */
export function StudioPage({ title, description, nextDescription, actions, children, className = '', contentRef }: {
  title: string; description: string;
  /** 新版的副标题（2026-10-31 改版，说具体的事）；不给就沿用 description。旧版不变。 */
  nextDescription?: string;
  actions?: ReactNode; children: ReactNode;
  className?: string; contentRef?: Ref<HTMLDivElement>;
}) {
  const pathname = usePathname() || '';
  const version = useUiVersion();
  // 新版页面换成改版后的设计语言（studio-next-pages.css），旧版保持原样。
  return <main className={`ip-brand-surface ip-hub-surface studio-page ${className}${version === 'next' ? ' studio-next-page' : ''}`}>
    <nav className="studio-mobile-navigation" aria-label="工作台导航">{studioNavigation(version).filter(n => n.href !== "/dashboard" && n.href !== "/assets").map(n => <Link key={n.href} href={n.href} aria-current={studioNavigationCurrent(n.href, pathname, version) ? "page" : undefined}>{n.label}</Link>)}</nav>
    <header className="studio-page-heading"><div><h1>{title}</h1><p>{version === 'next' && nextDescription ? nextDescription : description}</p></div>{(actions || version === 'next') && <div className="studio-page-actions">{version === 'next' && <UiVersionSwitch inline/>}{actions}</div>}</header>
    <div ref={contentRef} className="studio-page-body" data-studio-overlay-root>{children}</div>
    <HubTabBar/>
  </main>;
}

/** Category filters use the same underline, counts and keyboard affordance on each route. */
export function StudioPageFilters({ label, items, value, onChange }: {
  label: string; items: { value: string; label: string; count?: number; note?: string }[];
  value: string; onChange: (value: string) => void;
}) {
  return <div className="studio-page-filters" role="group" aria-label={label}>{items.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}><span>{item.label}</span>{item.note ? <small className="studio-page-filter-note">{item.note}</small> : item.count !== undefined && <small>{item.count}</small>}</button>)}</div>;
}

/** Full-width search with a consistent border, clear action and accessible name. */
export function StudioPageSearch({ value, onChange, label, placeholder, inputRef }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return <label className="studio-page-search"><Search size={16} aria-hidden="true"/><input ref={inputRef} type="search" aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>{value && <button type="button" aria-label={`清除${label}`} onClick={() => onChange('')}><X size={15}/></button>}</label>;
}

/** Features that are planned but not open yet: one wording and one mark everywhere (replaces the old 【待建设】). */
export function StudioComingSoon({ children = '敬请期待', className = '' }: { children?: ReactNode; className?: string }) {
  return <span className={`studio-coming-soon ${className}`}><Hourglass size={13} strokeWidth={2} aria-hidden="true"/>{children}</span>;
}
