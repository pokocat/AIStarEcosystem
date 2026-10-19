"use client";

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { StudioEntry } from './studio-entry';
import { StudioConversationStart } from './studio-conversation-start';

const modes = [['assistant', '全能创作'], ['image', '图片'], ['video', '视频'], ['script', '剧本']] as const;

/** The home CTA opens this creation page before any workspace is created. */
export function StudioCreationBrief({ onStart, creating, pending }: {
  onStart: (entry: StudioEntry, brief: string) => void; creating?: StudioEntry; pending: boolean;
}) {
  const [mode, setMode] = useState<StudioEntry>('assistant');
  const [brief, setBrief] = useState('');
  const locked = creating !== undefined || pending;
  return <div className="studio-creation-brief">
    <div className="studio-creation-modes" role="group" aria-label="创作方式">{modes.map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} disabled={locked} onClick={() => setMode(value)}>{label}</button>)}</div>
    {mode === 'assistant' ? <StudioConversationStart compact creating={creating === 'assistant'} pending={pending} onStart={text => onStart('assistant', text)}/> : <form onSubmit={e => { e.preventDefault(); onStart(mode, brief); }}>
    <label htmlFor="studio-creation-idea">创作想法</label><textarea id="studio-creation-idea" aria-label="创作想法" value={brief} onChange={e => setBrief(e.target.value)} maxLength={4000} rows={3} disabled={locked} placeholder="一个人物、一段故事，或一支商品视频。先写下想法，也可以从下方选择创作入口。"/>
    <div><p>创建画布免费。生成前在画布里确认参考素材、模型和费用。</p><button type="submit" className="ip-brand-button" disabled={creating !== undefined}>{creating ? <Loader2 size={16} className="studio-gallery-spinner"/> : <ArrowRight size={16}/>} {pending ? '继续保存并打开' : '创建并打开画布'}</button></div>
    </form>}
  </div>;
}
