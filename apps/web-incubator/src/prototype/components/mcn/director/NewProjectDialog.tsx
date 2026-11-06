import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Film, LayoutDashboard, Music, Sparkles, X } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { ProjectMode } from './directorData';

export interface DialogTemplate { name: string; mode: ProjectMode; formats: string[]; blank?: boolean }

export interface NewProjectInput { template: string; name: string; description: string; formats: string[] }

interface Props {
  lang: Lang;
  open: boolean;
  workshopName: string;
  templates: DialogTemplate[];
  briefPlaceholder?: string;
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
}

export const NewProjectDialog = ({ lang, open, workshopName, templates, briefPlaceholder, onClose, onCreate }: Props) => {
  const zh = lang === 'zh';
  const [template, setTemplate] = useState(templates[0]?.name ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const formats = templates.find(t => t.name === template)?.formats ?? [];
  const [picked, setPicked] = useState<string[]>(formats.slice(0, 2));
  const pickTemplate = (name: string) => { setTemplate(name); setPicked((templates.find(t => t.name === name)?.formats ?? []).slice(0, 2)); };

  // Reset the form each time the dialog opens (only on open, so typing is never clobbered).
  useEffect(() => {
    if (!open) return;
    setTemplate(templates[0]?.name ?? ''); setName(''); setDescription(''); setPicked((templates[0]?.formats ?? []).slice(0, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggle = (f: string) => setPicked(p => (p.includes(f) ? p.filter(x => x !== f) : [...p, f]));
  const submit = () => onCreate({ template, name: name.trim() || template, description: description.trim(), formats: picked.length ? picked : formats.slice(0, 1) });

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,.45)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={zh ? '新建创作项目' : 'New project'}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-2xl"
            initial={{ y: 16, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: .98 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 pt-5">
              <div>
                <div className="text-lg font-bold text-gray-900">{zh ? '新建创作项目' : 'New project'}</div>
                <p className="text-xs text-gray-500 mt-1">{zh ? `${workshopName} · 选择模板后由 AI 导演台搭好画布` : `${workshopName} · pick a template and the AI Director sets up the canvas`}</p>
              </div>
              <button type="button" onClick={onClose} aria-label={zh ? '关闭' : 'Close'} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">{zh ? '选择模板' : 'Template'}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {templates.map(({ name: t, mode, blank }) => {
                    const music = mode === 'music';
                    const active = t === template;
                    const color = blank ? '#06b6d4' : music ? '#ec4899' : '#8b5cf6';
                    return (
                      <button key={t} type="button" onClick={() => pickTemplate(t)} aria-pressed={active}
                        className="rounded-xl border p-3 text-left transition"
                        style={active ? { borderColor: color, background: `${color}0f`, boxShadow: `0 0 0 1px ${color}` } : { borderColor: '#e5e7eb' }}>
                        {blank ? <LayoutDashboard className="w-4 h-4" style={{ color }} /> : music ? <Music className="w-4 h-4" style={{ color }} /> : <Film className="w-4 h-4" style={{ color }} />}
                        <div className="text-sm font-semibold text-gray-900 mt-2">{t}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{blank ? (zh ? '从空白画布自由创作' : 'Free-form from an empty canvas') : music ? (zh ? '歌词 · 编曲 · 人声 · MV' : 'Lyrics · arrangement · vocals · MV') : (zh ? '剧本 · 分镜 · 配乐 · 成片' : 'Script · shots · music · cut')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-500">{zh ? '作品名称' : 'Title'}</span>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder={template}
                    className="mt-1.5 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-purple-300" />
                </label>
                <div>
                  <span className="text-xs font-medium text-gray-500">{zh ? '交付格式' : 'Deliverables'}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {formats.map(f => {
                      const on = picked.includes(f);
                      return <button key={f} type="button" onClick={() => toggle(f)} aria-pressed={on} className="rounded-lg border px-2.5 py-1 text-xs transition"
                        style={on ? { borderColor: '#06b6d4', background: '#ecfeff', color: '#0e7490' } : { borderColor: '#e5e7eb', color: '#4b5563' }}>{f}</button>;
                    })}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-gray-500">{zh ? '创作描述（交给 AI 导演）' : 'Brief for the AI Director'}</span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder={`${zh ? '例如：' : 'e.g. '}${briefPlaceholder ?? (zh ? '一句话讲清楚你想做什么' : 'what you want to make, in one line')}`}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-300 resize-none" />
              </label>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-5">
              <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-gray-600 hover:bg-gray-100">{zh ? '取消' : 'Cancel'}</button>
              <button type="button" onClick={submit} className="h-10 px-5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
                <Sparkles className="w-4 h-4" />{zh ? '创建并交给 AI 导演' : 'Create with AI Director'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
