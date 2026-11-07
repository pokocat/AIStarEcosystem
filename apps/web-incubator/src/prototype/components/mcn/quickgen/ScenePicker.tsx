/**
 * 场景选择：当前场景卡片 → 分类 + 缩略图浮层；“全部场景”打开带搜索的分组列表。
 * 第一个分类是按首页方案给出的“推荐”。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, PanelLeft, Search, Sparkles, X } from 'lucide-react';
import { FREE_IMAGE, groupsOf, scenesOf, type GenKind, type Scene } from './sceneData';

interface Props {
  zh: boolean;
  kind: GenKind;
  scene: Scene;
  recommended: Scene[];
  onPick: (scene: Scene) => void;
  /**
   * `pill`: compact trigger for the AI 创作 input toolbar; the popover opens upwards across the
   * nearest positioned ancestor (the input box).
   */
  variant?: 'card' | 'pill';
}

const t = (zh: boolean, v: { zh: string; en: string }) => (zh ? v.zh : v.en);

export const ScenePicker = ({ zh, kind, scene, recommended, onPick, variant = 'card' }: Props) => {
  const pill = variant === 'pill';
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [chip, setChip] = useState('rec');
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const groups = groupsOf(kind);
  const all = scenesOf(kind);
  const recIds = new Set(recommended.map(s => s.id));

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', h); window.addEventListener('keydown', k);
    return () => { window.removeEventListener('mousedown', h); window.removeEventListener('keydown', k); };
  }, [open]);
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [sheet]);

  const grid = chip === 'rec'
    ? (kind === 'image' ? [FREE_IMAGE, ...recommended] : recommended)
    : all.filter(s => s.group === chip);

  const pick = (s: Scene) => { onPick(s); setOpen(false); setSheet(false); };

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return all;
    return all.filter(s => [s.name.zh, s.name.en, s.tagline.zh, s.tagline.en].some(x => x.toLowerCase().includes(k)));
  }, [q, all]);

  return (
    <div ref={ref} className={pill ? 'min-w-0' : 'min-w-0 flex-1'}>
      {pill ? (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" title={zh ? '场景模板库' : 'Scene templates'}
          className="flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white pl-1 pr-2 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50">
          <img src={scene.cover} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
          <span className="truncate">{t(zh, scene.name)}</span>
          <ChevronDown className={`h-3 w-3 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl p-1.5 pr-3 text-left transition ${open ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
        <img src={scene.cover} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[15px] font-semibold text-slate-900">
            <span className="truncate">{t(zh, scene.name)}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
          </div>
          <div className="truncate text-xs text-slate-500">{t(zh, scene.tagline)}</div>
        </div>
      </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: pill ? 4 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: pill ? 4 : -4 }} transition={{ duration: .15 }}
            className={`absolute inset-x-0 z-40 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl ${pill ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
            {pill && <div className="mb-2 text-[12px] font-semibold text-slate-900">{kind === 'video' ? (zh ? '视频场景模板库' : 'Video scene templates') : (zh ? '图片场景模板库' : 'Image scene templates')}</div>}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
              {[{ id: 'rec', name: { zh: '推荐', en: 'For you' } }, ...groups].map(g => (
                <button key={g.id} type="button" onClick={() => setChip(g.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] transition ${chip === g.id ? '' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  style={chip === g.id ? { background: '#0f172a', color: '#ffffff' } : undefined}>
                  {g.id === 'rec' && <Sparkles className="h-3.5 w-3.5" />}{t(zh, g.name)}
                </button>
              ))}
            </div>
            <div className={`grid gap-3 overflow-y-auto pt-1 ${pill ? 'max-h-[44vh] grid-cols-3' : 'max-h-[52vh] grid-cols-2 sm:grid-cols-3'}`}>
              {grid.map(s => {
                const on = s.id === scene.id;
                return (
                  <button key={s.id} type="button" onClick={() => pick(s)} className="group text-left">
                    <div className={`relative aspect-square overflow-hidden rounded-xl ${on ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}>
                      <img src={s.cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                      {chip !== 'rec' && recIds.has(s.id) && (
                        <span className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(124,58,237,.92)', color: '#ffffff' }}>
                          {zh ? '推荐' : 'Pick'}
                        </span>
                      )}
                    </div>
                    <div className={`mt-1.5 flex items-center gap-1 text-slate-800 ${pill ? 'text-[12px] leading-tight' : 'text-[13px]'}`}>
                      {t(zh, s.name)}{on && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end border-t border-gray-100 pt-2.5">
              <button type="button" onClick={() => { setOpen(false); setSheet(true); }}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-slate-600 hover:bg-slate-100">
                <PanelLeft className="h-4 w-4" />{zh ? '全部场景' : 'All scenes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-[150] flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,.35)' }} onClick={() => setSheet(false)} />
            <motion.aside role="dialog" aria-modal="true" aria-label={zh ? '全部场景' : 'All scenes'}
              initial={{ x: -24 }} animate={{ x: 0 }} exit={{ x: -24 }}
              className="relative flex h-full w-[min(380px,92vw)] flex-col rounded-r-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <h2 className="text-base font-semibold text-slate-900">{kind === 'video' ? (zh ? 'AI 视频场景' : 'AI video scenes') : (zh ? 'AI 图片场景' : 'AI image scenes')}</h2>
                <button type="button" onClick={() => setSheet(false)} aria-label={zh ? '关闭' : 'Close'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
              <label className="mx-5 mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={zh ? '搜索场景，如“带货”“表情包”' : 'Search scenes'}
                  className="w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
              <div className="flex-1 overflow-y-auto px-3 pb-4">
                {[...(kind === 'image' ? [{ id: 'free', name: { zh: '自由创作', en: 'Free' } }] : []), ...groups].map(g => {
                  const items = filtered.filter(s => s.group === g.id);
                  if (!items.length) return null;
                  return (
                    <section key={g.id} className="mt-2">
                      <div className="px-2 py-1.5 text-[12px] text-slate-400">{t(zh, g.name)}</div>
                      {items.map(s => (
                        <button key={s.id} type="button" onClick={() => pick(s)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${s.id === scene.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                          <img src={s.cover} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[14px] text-slate-900">
                              {t(zh, s.name)}
                              {recIds.has(s.id) && <span className="rounded px-1 text-[10px] font-medium text-violet-700" style={{ background: '#ede9fe' }}>{zh ? '推荐' : 'Pick'}</span>}
                            </div>
                            <div className="truncate text-[12px] text-slate-500">{t(zh, s.tagline)}</div>
                          </div>
                          {s.id === scene.id && <Check className="h-4 w-4 text-slate-700" />}
                        </button>
                      ))}
                    </section>
                  );
                })}
                {!filtered.length && <p className="px-2 py-8 text-center text-[13px] text-slate-400">{zh ? '没有匹配的场景' : 'No matching scenes'}</p>}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
