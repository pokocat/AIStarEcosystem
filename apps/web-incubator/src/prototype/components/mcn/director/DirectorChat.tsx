import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, Bot, CheckCircle2, ChevronDown, Clapperboard, FileText, Images, MessageSquarePlus, Zap } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { ChatMessage, LT } from './directorData';
import type { Starter } from './studioModel';

export interface ChatScopeOption { id: string; label: string }

interface Props {
  lang: Lang;
  messages: ChatMessage[];
  typing: boolean;
  busy: boolean;
  directorName: string;
  focus: string;
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

  return (
    <section className="flex flex-col h-[520px] lg:h-full lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}>
          <Bot className="w-4 h-4" style={{ color: '#fff' }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">{p.directorName}</div>
          <div className="text-[11px] text-gray-500 truncate">{p.focus}</div>
        </div>
        <button type="button" onClick={p.onReset} disabled={busy} className="h-8 px-2.5 rounded-lg border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50">
          <MessageSquarePlus className="w-3.5 h-3.5" />{zh ? '新对话' : 'New chat'}
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
          <div className="text-xs font-semibold text-gray-900">{zh ? '正在讨论：' : 'Discussing: '}{p.scopeLabel}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{zh ? '已关联：' : 'Linked: '}{p.contextLinks}</div>
        </div>

        {messages.map(m => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: '#7c3aed', color: '#fff' }}>{m.text}</div>
            ) : (
              <div className="max-w-[94%]">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{m.text}</div>
                {m.actions?.length ? (
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

      <div className="p-3 pt-2 border-t border-gray-100 space-y-2">
        <div className="relative">
          <button type="button" onClick={() => setScopeOpen(o => !o)} aria-expanded={scopeOpen}
            className="h-7 max-w-full rounded-lg px-2.5 text-[11px] font-semibold inline-flex items-center gap-1" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
            <span className="truncate">{scope?.label}</span><ChevronDown className="w-3 h-3 shrink-0" />
          </button>
          {scopeOpen && (
            <div role="menu" className="absolute bottom-9 left-0 z-20 w-64 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              {p.scopes.map(s => (
                <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === p.scopeId} onClick={() => { p.onScope(s.id); setScopeOpen(false); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs truncate ${s.id === p.scopeId ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>{s.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-purple-300 focus-within:bg-white transition">
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
            placeholder={zh ? '说说你的想法，或者要怎么改。Enter 发送，Shift+Enter 换行' : 'Share an idea or what to change. Enter to send, Shift+Enter for a new line'}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none" />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="pl-1.5 text-[10px] text-gray-400">{zh ? '演示环境 · 不消耗积分' : 'Demo mode · no credits used'}</span>
            <button type="button" onClick={() => send(draft)} disabled={!draft.trim() || busy} aria-label={zh ? '发送' : 'Send'}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
