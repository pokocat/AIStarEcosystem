'use client';
// The thread timeline: earlier pages, the branch note, every message in order and the
// messages still on their way to the server.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { StudioDialogueMessage } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { dialogueSections, isPlaceholderMessage, lastAssistantMessage, messageQueueLabel, messageSuggestions, type DialogueStore } from '@/canvas-bridge/studio-dialogue-store';
import { StudioDialogueMessageView, type DialogueMessageHandlers } from './studio-dialogue-message';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

function ParentThread({ store, nodes, handlers, readThread }: { store: DialogueStore; nodes: CanvasNodeData[]; handlers: DialogueMessageHandlers; readThread: (id: string) => Promise<StudioDialogueMessage[]> }) {
  const [messages, setMessages] = useState<StudioDialogueMessage[]>(), [error, setError] = useStudioErrorState();
  const parent = store.thread?.parentThreadId, from = store.thread?.branchFromMessageId;
  if (!parent) return null;
  const load = () => { if (messages) return; readThread(parent).then(list => {
    const cut = list.find(m => m.id === from);
    setMessages(cut ? list.filter(m => m.seq <= cut.seq) : list);
  }).catch(setError); };
  return <details className="studio-dialogue-branch" onToggle={e => { if (e.currentTarget.open) load(); }}>
    <summary>这是从一条消息新开的对话，原来的对话保持不变。查看原来的对话</summary>
    {!messages && !error && <p className="studio-dialogue-note" role="status">正在读取</p>}
    {error && <p className="studio-assistant-error"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
    {messages?.map(m => <StudioDialogueMessageView key={m.id} message={m} nodes={nodes} readOnly shortfalls={{}} handlers={handlers}/>)}
  </details>;
}

export function StudioDialogueTimeline({ store, nodes, handlers, onRetry, onLoadOlder, readThread, progress }: {
  store: DialogueStore; nodes: CanvasNodeData[]; handlers: DialogueMessageHandlers;
  /** The running plan's step list; it reads as part of the latest reply (before its suggestions), as in the canvas redesign. */
  progress?: ReactNode;
  onRetry: (clientMessageId: string) => void; onLoadOlder: () => Promise<void>; readThread: (id: string) => Promise<StudioDialogueMessage[]>;
}) {
  const { current } = dialogueSections(store);
  const last = lastAssistantMessage(store);
  const [loadingOlder, setLoadingOlder] = useState(false), [error, setError] = useStudioErrorState();
  // Follow streamed text while the reader is at the bottom; leave them alone once they scroll up.
  const root = useRef<HTMLDivElement>(null), stick = useRef(true), sent = useRef(store.outbox.length);
  useEffect(() => {
    const body = root.current?.closest<HTMLElement>('.studio-floating-body');
    if (!body) return;
    const onScroll = () => { stick.current = body.scrollHeight - body.scrollTop - body.clientHeight < 96; };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);
  const tail = `${store.latestSeq}:${store.messages.length}:${store.outbox.length}:${last?.text.length || 0}:${last?.blocks.length || 0}`;
  useLayoutEffect(() => {
    if (store.outbox.length > sent.current) stick.current = true;
    sent.current = store.outbox.length;
    const body = root.current?.closest<HTMLElement>('.studio-floating-body');
    // An empty thread has nothing to follow; scrolling then would push the opening cards out of view.
    if (body && stick.current && (store.messages.length || store.outbox.length)) body.scrollTop = body.scrollHeight;
  }, [tail]);
  // Messages still on their way sit where they were sent, not after a reply that overtook them.
  const entries = [...current.map(m => ({ seq: m.seq, message: m, item: undefined })), ...store.outbox.map(item => ({ seq: (item.afterSeq ?? store.latestSeq) + .5, message: undefined, item }))]
    .sort((a, b) => a.seq - b.seq);
  const older = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true); setError('');
    try { await onLoadOlder(); } catch (e) { setError(e); } finally { setLoadingOlder(false); }
  };
  return <div ref={root} className="studio-dialogue-timeline" role="log" aria-label="创作对话记录">
    {store.hasOlder && <button type="button" className="studio-dialogue-link" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? '正在读取' : '查看更早的消息'}</button>}
    {error && <p className="studio-assistant-error"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
    <ParentThread store={store} nodes={nodes} handlers={handlers} readThread={readThread}/>
    {entries.map(({ message: m, item }) => m ? <StudioDialogueMessageView key={m.id} message={m} layout={store.layouts[m.id]} nodes={nodes} shortfalls={store.shortfalls} queueLabel={messageQueueLabel(store, m)}
      progress={m.id === last?.id ? progress : undefined}
      suggestions={m.id === last?.id && store.activeTurnId !== m.turnId ? messageSuggestions(store, m) : undefined}
      handlers={isPlaceholderMessage(m.id) ? { ...handlers, onBranch: undefined } : handlers}/> : item && <article key={item.clientMessageId} className="studio-dialogue-message is-user" data-status={item.state} aria-label="你的消息">
      <small className="studio-dialogue-author">你</small>
      <p className="studio-dialogue-text">{item.text}</p>
      {item.state === 'sending' ? <small className="studio-dialogue-queue" role="status">发送中</small>
        : <small className="studio-dialogue-queue is-failed" role="status">没有确认送达{item.error ? `：${item.error}` : ''}
          <button type="button" className="studio-dialogue-link" title="用同一条消息重发，服务端只会处理一次" onClick={() => onRetry(item.clientMessageId)}>重新发送</button></small>}
    </article>)}
    {!last && progress}
  </div>;
}
