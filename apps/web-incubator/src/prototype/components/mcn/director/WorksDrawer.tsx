import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play, X } from 'lucide-react';
import type { Lang } from '../../../translations';

export interface Work { id: string | number; title: string; status: string; plays: string; date: string; formats?: string[] }

const STATUS: Record<string, { zh: string; en: string; bg: string; fg: string }> = {
  Published: { zh: '已发布', en: 'Published', bg: '#ecfdf5', fg: '#047857' },
  Draft: { zh: '草稿', en: 'Draft', bg: '#f3f4f6', fg: '#4b5563' },
  Review: { zh: '审核中', en: 'In review', bg: '#fffbeb', fg: '#b45309' },
};

export const WorksDrawer = ({ lang, open, works, onClose }: { lang: Lang; open: boolean; works: Work[]; onClose: () => void }) => {
  const zh = lang === 'zh';
  const [playing, setPlaying] = useState<Work['id'] | null>(null);
  return (
    <AnimatePresence>
      {open && (
        <motion.section initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
          className="absolute right-3 top-3 bottom-3 z-30 w-[300px] max-w-[calc(100%-1.5rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-900">{zh ? '作品库' : 'Works'}</div>
              <div className="text-[11px] text-gray-500">{zh ? `共 ${works.length} 个作品` : `${works.length} works`}</div>
            </div>
            <button type="button" onClick={onClose} aria-label={zh ? '关闭' : 'Close'} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {works.map(w => {
              const st = STATUS[w.status] ?? STATUS.Draft;
              const isPlaying = playing === w.id;
              return (
                <div key={w.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-gray-50">
                  <button type="button" onClick={() => setPlaying(isPlaying ? null : w.id)} aria-label={isPlaying ? (zh ? '暂停' : 'Pause') : (zh ? '播放' : 'Play')}
                    className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center" style={{ background: isPlaying ? '#8b5cf6' : '#f5f3ff', color: isPlaying ? '#fff' : '#7c3aed' }}>
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{w.title}</div>
                    <div className="text-[11px] text-gray-500 truncate">{w.date} · {w.plays} {zh ? '播放' : 'plays'}{w.formats?.length ? ` · ${w.formats.join(' / ')}` : ''}</div>
                    {isPlaying && (
                      <div className="mt-1 flex items-end gap-[2px] h-3">
                        {[0, 1, 2, 3, 4, 5].map(i => <motion.span key={i} className="w-[3px] rounded-full" style={{ background: '#8b5cf6' }} animate={{ height: ['30%', '100%', '45%'] }} transition={{ duration: .7, repeat: Infinity, delay: i * .1 }} />)}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: st.bg, color: st.fg }}>{st[lang]}</span>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
