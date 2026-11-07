/**
 * 发到导演台: put a quick-gen result into the AI 导演台's current project (new shot, replace a
 * shot, or an asset sheet for images) or start a new project from it.
 * Rendered in a portal because result cards clip their overflow.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Clapperboard, FilePlus2, ImageIcon, Plus, Replace } from 'lucide-react';
import type { GenKind } from './sceneData';
import { currentProject, type DirectorTarget, type ProjectOutline } from '../director/handoff';

interface Props {
  zh: boolean;
  kind: GenKind;
  /** AI 导演台 auto-save scope: `${solutionId}:${artistId}`. */
  scope: string;
  onSend: (to: DirectorTarget) => void;
  /** Icon-only trigger for tight spots (image overlays). */
  compact?: boolean;
}

const MENU_W = 272;

export const SendToDirectorMenu = ({ zh, kind, scope, onSend, compact }: Props) => {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<ProjectOutline | null>(null);
  const [section, setSection] = useState<'replace' | 'asset' | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, up: false });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setProject(currentProject(scope));
    setSection(null);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const up = r.bottom + 360 > window.innerHeight && r.top > 360;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - MENU_W - 8, r.right - MENU_W)), top: up ? r.top - 6 : r.bottom + 6, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const send = (to: DirectorTarget) => { setOpen(false); onSend(to); };
  const label = zh ? '发到 AI 导演' : 'Send to AI Director';

  const Row = ({ icon: Icon, children, onClick, expanded }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onClick: () => void; expanded?: boolean }) => (
    <button type="button" onClick={onClick} aria-expanded={expanded}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 transition hover:bg-slate-100">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1">{children}</span>
      {expanded !== undefined && <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${expanded ? 'rotate-90' : ''}`} />}
    </button>
  );

  const Pick = ({ image, title, sub, onClick }: { image?: string; title: string; sub: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-violet-50">
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100">{image && <img src={image} alt="" className="h-full w-full object-cover" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-slate-800">{title}</span>
        <span className="block text-[11px] text-slate-400">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} title={label} aria-label={label}
        className={compact
          ? 'rounded-md p-1'
          : 'flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200'}
        style={compact ? { background: 'rgba(15,23,42,.75)', color: '#ffffff' } : undefined}>
        <Clapperboard className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />{!compact && <span>{zh ? '导演' : 'Director'}</span>}
      </button>
      {open && createPortal(
        <div ref={menu} role="menu" aria-label={label}
          className="fixed z-[200] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl"
          style={{ left: pos.left, top: pos.top, width: MENU_W, transform: pos.up ? 'translateY(-100%)' : undefined }}>
          <div className="px-2.5 pb-1.5 pt-1">
            <div className="text-[12px] font-semibold text-slate-900">{label}</div>
            <div className="truncate text-[11px] text-slate-500">
              {project ? (zh ? `当前项目《${project.name}》` : `Current project "${project.name}"`) : (zh ? '导演台还没有项目' : 'No project open yet')}
            </div>
          </div>
          {project && (
            <div className="border-t border-gray-100 pt-1">
              <Row icon={Plus} onClick={() => send({ type: 'shot' })}>{zh ? '加为新镜头' : 'Add as a new shot'}</Row>
              {project.shots.length > 0 && (
                <>
                  <Row icon={Replace} onClick={() => setSection(s => (s === 'replace' ? null : 'replace'))} expanded={section === 'replace'}>
                    {zh ? '替换某个镜头' : 'Replace a shot'}
                  </Row>
                  {section === 'replace' && (
                    <div className="mb-1 ml-3 max-h-48 overflow-y-auto border-l border-gray-100 pl-1.5">
                      {project.shots.map((s, i) => <Pick key={s.id} image={s.image} title={s.title} sub={zh ? `镜头 ${i + 1}` : `Shot ${i + 1}`} onClick={() => send({ type: 'replace', shotId: s.id })} />)}
                    </div>
                  )}
                </>
              )}
              {kind === 'image' && project.assets.length > 0 && (
                <>
                  <Row icon={ImageIcon} onClick={() => setSection(s => (s === 'asset' ? null : 'asset'))} expanded={section === 'asset'}>
                    {zh ? '设为资产图' : 'Use as an asset sheet'}
                  </Row>
                  {section === 'asset' && (
                    <div className="mb-1 ml-3 max-h-48 overflow-y-auto border-l border-gray-100 pl-1.5">
                      {project.assets.map(a => <Pick key={a.id} image={a.image} title={a.name} sub={zh ? a.typeLabel.zh : a.typeLabel.en} onClick={() => send({ type: 'asset', assetId: a.id })} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <Row icon={FilePlus2} onClick={() => send({ type: 'new' })}>{zh ? '用它新建导演台项目' : 'Start a new project with it'}</Row>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
