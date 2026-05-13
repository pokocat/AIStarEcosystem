"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Users, Command, CornerDownLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import {
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  type Artist,
} from './ArtistTypes';
import type { Lang } from "../../translations";
import type { CommandItem } from "@ai-star-eco/types/navigation";
import { PAGE_ITEMS, ACTION_ITEMS } from "@/constants/command-items";

export const CommandPalette = ({
  lang, open, onClose, onNavigate, onSwitchArtist, artists
}: {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  onNavigate: (pageId: string) => void;
  onSwitchArtist: (artist: Artist) => void;
  /** 可切换艺人列表；缺省时回退到 mocks（离线演示用）。 */
  artists?: Artist[];
}) => {
  const zh = lang === 'zh';
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build artist items — 优先使用父级真实列表，兜底 MOCK_ARTISTS
  const artistPool = artists && artists.length > 0 ? artists : MOCK_ARTISTS;
  const artistItems: CommandItem[] = useMemo(() =>
    artistPool.map(a => ({
      id: `artist-${a.id}`,
      type: 'artist' as const,
      icon: Users,
      label: a.name,
      desc: `${ARTIST_TYPE_CONFIG[a.type].icon} ${ARTIST_TYPE_LABELS[a.type].zh} · Lv.${a.level}`,
      keywords: [a.name.toLowerCase(), ARTIST_TYPE_LABELS[a.type].zh],
      artist: a,
    })),
  [artistPool]);

  const allItems = useMemo(() => [...ACTION_ITEMS, ...PAGE_ITEMS, ...artistItems], [artistItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q))
    );
  }, [query, allItems]);

  // Group results
  const grouped = useMemo(() => {
    const actions = filtered.filter(i => i.type === 'action');
    const pages = filtered.filter(i => i.type === 'page');
    const artists = filtered.filter(i => i.type === 'artist');
    return { actions, pages, artists };
  }, [filtered]);

  const flatFiltered = useMemo(() => [...grouped.actions, ...grouped.pages, ...grouped.artists], [grouped]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => setSelectedIndex(0), [query]);

  const executeItem = (item: CommandItem) => {
    if (item.type === 'artist' && item.artist) {
      onSwitchArtist(item.artist);
    } else if (item.pageId) {
      onNavigate(item.pageId);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flatFiltered[selectedIndex]) { executeItem(flatFiltered[selectedIndex]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (open) onClose(); else onClose(); /* toggle handled by parent */ }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const renderGroup = (title: string, items: CommandItem[], startIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div key={title}>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest font-medium px-3 py-1.5">{title}</div>
        {items.map((item, i) => {
          const globalIdx = startIdx + i;
          const Icon = item.type === 'artist' && item.artist ? (() => {
            const tc = ARTIST_TYPE_CONFIG[item.artist!.type];
            return () => <span className="text-sm">{tc.icon}</span>;
          })() : item.icon;
          return (
            <button key={item.id}
              onClick={() => executeItem(item)}
              onMouseEnter={() => setSelectedIndex(globalIdx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                globalIdx === selectedIndex ? 'bg-cyan-500/10 text-white' : 'text-gray-400 hover:bg-white/[0.03]'
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                item.type === 'action' ? 'bg-purple-500/10' : item.type === 'artist' ? 'bg-cyan-500/10' : 'bg-white/5'
              }`}>
                {typeof Icon === 'function' && Icon.prototype ? <Icon className="w-3.5 h-3.5" /> : <Icon />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                {item.desc && <div className="text-[10px] text-gray-600 truncate">{item.desc}</div>}
              </div>
              {globalIdx === selectedIndex && (
                <div className="text-[10px] text-gray-600 flex items-center gap-0.5">
                  <CornerDownLeft className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
          <motion.div initial={{ opacity: 0, scale: .95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .95, y: -20 }}
            transition={{ duration: .15 }}
            className="fixed left-1/2 top-[15%] -translate-x-1/2 w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-[61] overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Search className="w-4 h-4 text-gray-500 shrink-0" />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                placeholder={zh ? '搜索页面、艺人、操作...' : 'Search pages, artists, actions...'} />
              <kbd className="text-[10px] text-gray-600 bg-white/5 rounded px-1.5 py-0.5 border border-white/10">ESC</kbd>
            </div>
            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto py-1">
              {flatFiltered.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-600">{zh ? '无匹配结果' : 'No results found'}</div>
              ) : (
                <>
                  {renderGroup(zh ? '快捷操作' : 'Actions', grouped.actions, 0)}
                  {renderGroup(zh ? '页面' : 'Pages', grouped.pages, grouped.actions.length)}
                  {renderGroup(zh ? '艺人' : 'Artists', grouped.artists, grouped.actions.length + grouped.pages.length)}
                </>
              )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-gray-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">↑↓ {zh ? '导航' : 'Navigate'}</span>
                <span className="flex items-center gap-1">↵ {zh ? '选择' : 'Select'}</span>
              </div>
              <span className="flex items-center gap-1"><Command className="w-3 h-3" />K {zh ? '切换' : 'Toggle'}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
