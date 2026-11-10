/**
 * Input-toolbar controls for AI 创作: the mode menu (AI 导演 · AI 图片 · AI 视频) and the AI 导演
 * project template library. Both open upwards across the input box (their nearest positioned
 * ancestor), since they sit at the bottom of a narrow column.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Clapperboard, Film, ImageIcon, LayoutTemplate } from 'lucide-react';

export type CreateMode = 'director' | 'image' | 'video';

export const MODE_META: Record<CreateMode, { icon: React.ComponentType<{ className?: string }>; zh: string; en: string; short: { zh: string; en: string }; hint: { zh: string; en: string } }> = {
  director: { icon: Clapperboard, zh: 'AI 导演', en: 'AI Director', short: { zh: '导演', en: 'Director' }, hint: { zh: '对话做完整项目：剧本、资产、分镜到成片', en: 'Chat a whole project from script to final cut' } },
  image: { icon: ImageIcon, zh: 'AI 图片', en: 'AI Image', short: { zh: '图片', en: 'Image' }, hint: { zh: '选场景、放素材，出写真、商品图、表情包', en: 'Scene-based photos, product shots, stickers' } },
  video: { icon: Film, zh: 'AI 视频', en: 'AI Video', short: { zh: '视频', en: 'Video' }, hint: { zh: '选场景、写几句想法，出一条完整视频', en: 'Pick a scene, get a complete video' } },
};

export const PILL = 'h-8 min-w-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50';

/** Closes a popover on outside click or Escape. */
export const useDismiss = (open: boolean, close: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
  }, [open, close]);
  return ref;
};

const Pop = ({ children }: { children: React.ReactNode }) => (
  <motion.div role="menu" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.14 }}
    className="absolute inset-x-0 bottom-full z-40 mb-2 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl">
    {children}
  </motion.div>
);

interface ModeProps {
  zh: boolean;
  mode: CreateMode;
  onMode: (mode: CreateMode) => void;
  /** Modes that cannot be picked right now (e.g. video while generating an asset sheet). */
  disabled?: CreateMode[];
}

export const CreateModeMenu = ({ zh, mode, onMode, disabled = [] }: ModeProps) => {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const Icon = MODE_META[mode].icon;
  return (
    <div ref={ref} className="shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={zh ? `创作模式：${MODE_META[mode].zh}，点击切换` : `Mode: ${MODE_META[mode].en}, click to switch`} title={zh ? MODE_META[mode].zh : MODE_META[mode].en}
        className="h-8 inline-flex items-center gap-1 rounded-lg px-2 text-[12px] font-semibold transition"
        style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
        <Icon className="h-3.5 w-3.5" />{zh ? MODE_META[mode].short.zh : MODE_META[mode].short.en}
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <Pop>
            <div className="px-2.5 pb-1 pt-1 text-[11px] text-gray-400">{zh ? '创作模式' : 'Mode'}</div>
            {(Object.keys(MODE_META) as CreateMode[]).map(id => {
              const m = MODE_META[id];
              const MIcon = m.icon;
              const off = disabled.includes(id);
              return (
                <button key={id} type="button" role="menuitemradio" aria-checked={id === mode} disabled={off}
                  onClick={() => { setOpen(false); if (id !== mode) onMode(id); }}
                  className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${id === mode ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${id === mode ? 'bg-white text-violet-600' : 'bg-gray-100 text-gray-600'}`}><MIcon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[13px] font-semibold text-gray-900">{zh ? m.zh : m.en}{id === mode && <Check className="h-3.5 w-3.5 text-violet-600" />}</span>
                    <span className="block text-[11px] leading-snug text-gray-500">{off ? (zh ? '当前目标不支持' : 'Not available for this target') : (zh ? m.hint.zh : m.hint.en)}</span>
                  </span>
                </button>
              );
            })}
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
};

interface TemplateProps {
  zh: boolean;
  current: string;
  templates: Array<{ name: string; formats: string[]; blank?: boolean }>;
  /** Opens the new-project dialog on the chosen template. */
  onPick: (name: string) => void;
}

/** AI 导演's template library: picking one starts a new project from it. */
export const ProjectTemplateMenu = ({ zh, current, templates, onPick }: TemplateProps) => {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} title={zh ? '项目模板库' : 'Project templates'} className={`${PILL} max-w-full`}>
        <LayoutTemplate className="h-3.5 w-3.5 shrink-0 text-gray-500" /><span className="truncate">{current}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <Pop>
            <div className="px-2.5 pb-1 pt-1">
              <div className="text-[12px] font-semibold text-gray-900">{zh ? '项目模板库' : 'Project templates'}</div>
              <div className="text-[11px] text-gray-500">{zh ? '选一个模板新建项目，当前项目会保留' : 'Start a new project; the current one is kept'}</div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {templates.map(t => (
                <button key={t.name} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(t.name); }}
                  className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition ${t.name === current ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[13px] font-medium text-gray-900">
                      {t.name}{t.name === current && <span className="rounded px-1 text-[10px] font-medium text-violet-700" style={{ background: '#ede9fe' }}>{zh ? '当前' : 'Current'}</span>}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500">{t.formats.join(' · ')}</span>
                  </span>
                </button>
              ))}
            </div>
          </Pop>
        )}
      </AnimatePresence>
    </div>
  );
};
