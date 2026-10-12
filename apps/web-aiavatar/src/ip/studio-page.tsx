"use client";

import type { ReactNode, Ref } from 'react';
import { Search, X } from 'lucide-react';
import { HubTabBar } from '@/components/hub/ui';

/** The four workspace routes share one paper surface, heading and mobile navigation. */
export function StudioPage({ title, description, actions, children, className = '', contentRef }: {
  title: string; description: string; actions?: ReactNode; children: ReactNode;
  className?: string; contentRef?: Ref<HTMLDivElement>;
}) {
  return <main className={`ip-brand-surface ip-hub-surface studio-page ${className}`}>
    <header className="studio-page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="studio-page-actions">{actions}</div>}</header>
    <div ref={contentRef} className="studio-page-body" data-studio-overlay-root>{children}</div>
    <HubTabBar/>
  </main>;
}

/** Category filters use the same underline, counts and keyboard affordance on each route. */
export function StudioPageFilters({ label, items, value, onChange }: {
  label: string; items: { value: string; label: string; count?: number; note?: string }[];
  value: string; onChange: (value: string) => void;
}) {
  return <div className="studio-page-filters" role="group" aria-label={label}>{items.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}><span>{item.label}</span>{item.note ? <small className="studio-page-filter-note">{item.note}</small> : <small>{item.count ?? '—'}</small>}</button>)}</div>;
}

/** Full-width search with a consistent border, clear action and accessible name. */
export function StudioPageSearch({ value, onChange, label, placeholder, inputRef }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return <label className="studio-page-search"><Search size={16} aria-hidden="true"/><input ref={inputRef} type="search" aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>{value && <button type="button" aria-label={`清除${label}`} onClick={() => onChange('')}><X size={15}/></button>}</label>;
}
