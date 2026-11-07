/**
 * Project switcher on the AI 导演 project bar: every saved project of this solution + IP, newest
 * first, with open, delete (not the open one) and 新建项目. New projects never overwrite old ones.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Film, Plus, Trash2 } from 'lucide-react';
import { orderedShots } from './directorData';
import { listProjects } from './studioStorage';

interface Props {
  zh: boolean;
  /** `${solutionId}:${artistId}` */
  base: string;
  current: string;
  title: string;
  onOpen: (scope: string) => void;
  onNew: () => void;
  onDelete: (scope: string) => void;
}

export const ProjectSwitcher = ({ zh, base, current, title, onOpen, onNew, onDelete }: Props) => {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, refresh] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) { setConfirm(null); return; }
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
  }, [open]);

  // Read on open so the list reflects the latest auto-saves.
  const projects = open ? listProjects(base) : [];
  const when = (ts: number) => new Date(ts).toLocaleString(zh ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} title={zh ? '切换项目' : 'Switch project'}
        className="-ml-1.5 flex max-w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-left transition hover:bg-gray-100">
        <span className="truncate text-sm font-semibold text-gray-900">{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-50 mt-1.5 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl">
            <div className="px-2.5 pb-1.5 pt-1 text-[11px] text-gray-500">{zh ? `这个 IP 的项目 · ${projects.length}` : `Projects for this IP · ${projects.length}`}</div>
            <ul className="max-h-80 overflow-y-auto">
              {projects.map(({ scope, snap }) => {
                const isCurrent = scope === current;
                const shots = orderedShots(snap.nodes);
                const thumb = shots.find(s => s.image)?.image ?? snap.nodes.find(n => n.kind === 'character')?.image ?? snap.spec.artistAvatar;
                const done = snap.nodes.filter(n => n.status === 'done').length;
                return (
                  <li key={scope} className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 ${isCurrent ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                    <button type="button" role="menuitem" onClick={() => { setOpen(false); if (!isCurrent) onOpen(scope); }} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {thumb && !thumb.startsWith('blob:') ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-gray-400"><Film className="h-4 w-4" /></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-gray-900">{zh ? `《${snap.spec.name}》` : snap.spec.name}</span>
                          {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
                        </span>
                        <span className="block truncate text-[11px] text-gray-500">
                          {snap.spec.template} · {snap.exported ? (zh ? '已导出' : 'Exported') : `${done}/${snap.nodes.length}`} · {when(snap.savedAt)}
                        </span>
                      </span>
                    </button>
                    {!isCurrent && (confirm === scope ? (
                      <button type="button" onClick={() => { onDelete(scope); setConfirm(null); refresh(n => n + 1); }}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#b91c1c' }}>{zh ? '确认删除' : 'Delete'}</button>
                    ) : (
                      <button type="button" onClick={() => setConfirm(scope)} aria-label={zh ? '删除项目' : 'Delete project'} title={zh ? '删除项目' : 'Delete project'}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 border-t border-gray-100 pt-1">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onNew(); }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-gray-700 hover:bg-gray-50">
                <Plus className="h-4 w-4 text-gray-500" />{zh ? '新建项目' : 'New project'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
