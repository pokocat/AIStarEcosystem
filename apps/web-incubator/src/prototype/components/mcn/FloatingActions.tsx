/**
 * Quick-create menu in the console top bar (formerly a floating action button that covered the sidebar).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Clapperboard, Film, Image as ImageIcon, Plus, Upload, Wand2 } from 'lucide-react';
import type { Lang } from '../../translations';

const ACTIONS: Array<{ id: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; zh: string; en: string; descZh: string; descEn: string; color: string }> = [
  { id: 'production_workshop/video', icon: Film, zh: 'AI 视频', en: 'AI video', descZh: '选场景，几句话出一条视频', descEn: 'Pick a scene, get a video', color: '#7c3aed' },
  { id: 'production_workshop/image', icon: ImageIcon, zh: 'AI 图片', en: 'AI image', descZh: 'IP 写真、商品图、表情包', descEn: 'IP photos, product shots, stickers', color: '#db2777' },
  { id: 'studio', icon: Clapperboard, zh: '导演台项目', en: 'Director project', descZh: '多镜头、分集与精修', descEn: 'Multi-shot, episodes, fine-tuning', color: '#0891b2' },
  { id: 'incubation', icon: Wand2, zh: '孵化角色 IP', en: 'New role IP', descZh: '形象、人设与技能', descEn: 'Look, persona and skills', color: '#8b5cf6' },
  { id: 'distribution', icon: Upload, zh: '发布分发', en: 'Distribute', descZh: '多平台一键分发', descEn: 'Publish to every platform', color: '#22c55e' },
];

export const QuickCreateMenu = ({ lang, onNavigate }: { lang: Lang; onNavigate: (page: string) => void }) => {
  const zh = lang === 'zh';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"
        className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
        style={{ background: 'linear-gradient(90deg, #0891b2, #7c3aed)', color: '#fff' }}>
        <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">{zh ? '快速创建' : 'Create'}</span>
        <ChevronDown className={`hidden sm:block w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .15 }}
            className="absolute right-0 top-10 z-50 w-60 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-900/10">
            {ACTIONS.map(a => (
              <button key={a.id} type="button" role="menuitem" onClick={() => { setOpen(false); onNavigate(a.id); }}
                className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 flex items-center gap-2.5">
                <span className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center" style={{ background: `${a.color}14` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{zh ? a.zh : a.en}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{zh ? a.descZh : a.descEn}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
