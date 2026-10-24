'use client';
import { useEffect, useRef, useState } from 'react';

/** Inline names edit the document title, independently of content or accepted generation requests. */
export function StudioNodeTitle({ title, onRename }: { title: string; onRename?: (title: string) => void }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const start = () => { cancelled.current = false; setDraft(title); setEditing(true); };
  const finish = () => {
    if (!cancelled.current && draft.trim() && draft.trim() !== title) onRename?.(draft.trim());
    setEditing(false);
  };
  if (!onRename) return <span className="studio-flow-title" title={title}>{title}</span>;
  return editing ? <input ref={input} className="studio-flow-title-input nodrag nopan nowheel" aria-label="节点名称" value={draft} maxLength={128}
    onChange={e => setDraft(e.target.value)} onBlur={finish} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
    onKeyDown={e => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; setEditing(false); }
    }}/>
    : <button type="button" className="studio-flow-title" aria-label={`重命名节点 ${title}`} title={`${title} · 双击修改节点名称`}
      // A single click is a click on the node (select + open its panel, 2026-10-23): the title fills the whole header, so
      // swallowing it left the header dead. Only the double click and the editing input below stay with the title.
      onDoubleClick={e => { e.stopPropagation(); start(); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); start(); } }}>{title}</button>;
}
