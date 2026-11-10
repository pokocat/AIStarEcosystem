import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, CheckCircle2, ChevronDown, Clapperboard, FileText, Images, MessageSquarePlus, Zap } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { ChatMessage, LT } from './directorData';
import type { Starter } from './studioModel';
import { PipelineCard } from './BrowseBar';
import type { PipelineStep } from './pipeline';

export interface ChatScopeOption { id: string; label: string }

interface Props {
  lang: Lang;
  messages: ChatMessage[];
  typing: boolean;
  busy: boolean;
  directorName: string;
  scopeLabel: string;
  contextLinks: string;
  scopes: ChatScopeOption[];
  scopeId: string;
  onScope: (id: string) => void;
  starters: Starter[];
  suggestions: LT[];
  onSend: (text: string) => void;
  onReset: () => void;
  /** Increment to move keyboard focus into the input (from the AI buttons in each view). */
  focusSignal?: number;
  /** Left side of the input toolbar: the AI 创作 mode menu and the project template library. */
  toolbar?: React.ReactNode;
  /** Live one-click progress, shown under the latest message that started a run. */
  pipeline?: { steps: PipelineStep[]; onJump: (step: PipelineStep) => void };
  /** 星币 balance shared with AI 图片 / AI 视频. */
  balance?: number;
}

const STARTER_ICONS = [FileText, Images, Clapperboard, Zap];

export const DirectorChat = (p: Props) => {
  const { lang, messages, typing, busy } = p;
  const zh = lang === 'zh';
  const [draft, setDraft] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (p.focusSignal) inputRef.current?.focus(); }, [p.focusSignal]);
  const fresh = messages.filter(m => m.role === 'user').length === 0;

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    p.onSend(value);
    setDraft('');
  };
  const scope = p.scopes.find(s => s.id === p.scopeId) ?? p.scopes[0];
  const liveRunId = [...messages].reverse().find(m => m.pipeline)?.id;

  return (
    <section className="flex flex-col h-[560px] lg:h-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white">
      {/* Context strip: what the director is working on. */}
      <div className="relative shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-[11px] text-gray-500">{zh ? '正在讨论' : 'Discussing'}</span>
            <button type="button" onClick={() => setScopeOpen(o => !o)} aria-expanded={scopeOpen} aria-haspopup="menu"
              className="h-6 min-w-0 rounded-md px-2 text-[11px] font-semibold inline-flex items-center gap-1" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              <span className="truncate">{scope?.label ?? p.scopeLabel}</span><ChevronDown className={`w-3 h-3 shrink-0 transition ${scopeOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-gray-400" title={p.contextLinks}>{zh ? '已关联：' : 'Linked: '}{p.contextLinks}</div>
        </div>
        <button type="button" onClick={p.onReset} disabled={busy} aria-label={zh ? '新对话' : 'New chat'} title={zh ? '新对话' : 'New chat'}
          className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 inline-flex items-center justify-center disabled:opacity-50">
          <MessageSquarePlus className="w-3.5 h-3.5" />
        </button>
        {scopeOpen && (
          <div role="menu" className="absolute left-3 right-3 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {p.scopes.map(s => (
              <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === p.scopeId} onClick={() => { p.onScope(s.id); setScopeOpen(false); }}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs truncate ${s.id === p.scopeId ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(m => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: '#7c3aed', color: '#fff' }}>{m.text}</div>
            ) : (
              <div className="max-w-[94%]">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{m.text}</div>
                {m.id === liveRunId && p.pipeline && m.text && <PipelineCard lang={lang} steps={p.pipeline.steps} onJump={p.pipeline.onJump} />}
                {m.actions?.length && !m.pipeline ? (
                  <div className="mt-2 space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2.5 py-2">
                    {m.actions.map(a => <div key={a} className="flex items-center gap-1.5 text-[11px] text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{a}</div>)}
                  </div>
                ) : null}
              </div>
            )}
          </motion.div>
        ))}

        {typing && (
          <div className="inline-flex items-center gap-1 rounded-2xl bg-gray-100 px-3.5 py-3">
            {[0, 1, 2].map(i => <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />)}
          </div>
        )}

        {fresh && !typing && (
          <div>
            <div className="text-base font-bold text-gray-900 mb-2.5">{zh ? '想做点什么？' : 'What would you like to make?'}</div>
            <div className="grid grid-cols-2 gap-2">
              {p.starters.map((s, i) => {
                const Icon = STARTER_ICONS[i % STARTER_ICONS.length];
                return (
                  <button key={s.title.en} type="button" onClick={() => send(s.prompt[lang])} disabled={busy}
                    className="rounded-xl border border-gray-200 p-3 text-left hover:border-purple-300 hover:bg-purple-50/40 transition disabled:opacity-50">
                    <span className="w-7 h-7 rounded-lg bg-gray-100 inline-flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-gray-700" /></span>
                    <div className="text-[13px] font-semibold text-gray-900 mt-2">{s.title[lang]}</div>
                    <div className="text-[11px] text-gray-500 mt-1 leading-snug">{s.desc[lang]}</div>
                    <div className="text-[10px] text-gray-400 mt-1.5">{zh ? '需要：' : 'Needs: '}{s.need[lang]}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!fresh && !busy && p.suggestions.length > 0 && (
          <div>
            <div className="text-[11px] text-gray-500 mb-1.5">{zh ? '你可以这样说' : 'You could say'}</div>
            <ul className="space-y-1">
              {p.suggestions.map(sg => (
                <li key={sg.en}>
                  <button type="button" onClick={() => send(sg[lang])} className="text-left text-xs text-gray-700 hover:text-purple-700 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />{sg[lang]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 pt-2 border-t border-gray-100">
        <div className="relative rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-purple-300 focus-within:bg-white transition">
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
            placeholder={zh ? `和${p.directorName}说说想法或要怎么改。Enter 发送，Shift+Enter 换行` : `Tell the ${p.directorName} what to make or change. Enter to send`}
            aria-label={zh ? '对 AI 导演说' : 'Message the AI Director'}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none" />
          <div className="flex items-center gap-1.5 px-2 pb-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">{p.toolbar}</div>
            <button type="button" onClick={() => send(draft)} disabled={!draft.trim() || busy} aria-label={zh ? '发送' : 'Send'}
              className="w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0891b2, #7c3aed)', color: '#fff' }}>
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] text-gray-400">
          <span className="truncate">{zh ? '对话和剧本免费 · 出图、视频按量扣星币' : 'Chat and scripts are free · images and video use credits'}</span>
          {p.balance !== undefined && <span className="shrink-0">{zh ? '余额' : 'Balance'} ⬡ {p.balance.toLocaleString()}</span>}
        </div>
      </div>
    </section>
  );
};
