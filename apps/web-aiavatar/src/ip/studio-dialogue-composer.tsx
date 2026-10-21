'use client';
// The always-editable composer. Typing is never locked by streaming, tools or a running
// production; only the send button waits for attachments to finish saving. `@` pins a
// canvas object for this message, attachments are added as ordinary canvas nodes first.
import { forwardRef, useImperativeHandle, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { Button, Input } from 'antd';
import { ArrowUp, AtSign, Square, X } from 'lucide-react';
import type { IpSavedAsset } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { assistantMentionQuery, insertAssistantMention } from '@/canvas-bridge/studio-assistant-context';
import { LibraryReferencePicker } from './library-reference-picker';
import { StudioAttachmentPicker, type AttachmentPickerActions } from './studio-attachment-picker';

/** `mention` opens the @ list at the caret; `attach` / `library` start the same flows as the paperclip (used by guides). */
export type DialogueComposerHandle = { focus: () => void; compose: (text: string) => void; mention: () => void; attach: () => void; library: () => void };
type Props = {
  projectId: string; text: string; onText: (value: string) => void;
  contextNodes: CanvasNodeData[]; pinnedIds: string[]; attachmentIds: string[];
  onPin: (node: CanvasNodeData) => boolean; onUnpin: (id: string) => void; onRemoveAttachment: (id: string) => void;
  onFiles: (files: File[]) => void; onAssets: (assets: IpSavedAsset[]) => Promise<void>;
  reading: boolean; attachmentsUnsaved: boolean; onRetrySave: () => void;
  sendDisabledReason?: string; sending: boolean; onSend: () => void;
  canStop: boolean; stopping: boolean; onStop: () => void;
  /** Demo mode: the send button says nothing is charged. */
  demo?: boolean;
  /** Chips after the @ and attachment buttons (the skill and model choices live here, not in a hidden settings pane). */
  tools?: ReactNode;
  /** One starting row while a conversation is on screen; two on an empty canvas so the invitation reads as a place to write. */
  compact?: boolean; placeholder?: string;
};

const nodeKind = (node?: CanvasNodeData) => node?.type === 'image' ? '图片' : node?.type === 'video' ? '视频' : node?.type === 'audio' ? '音频' : node ? '文字' : '';

export const StudioDialogueComposer = forwardRef<DialogueComposerHandle, Props>(function StudioDialogueComposer(props, handle) {
  const { projectId, text, onText, contextNodes, pinnedIds, attachmentIds, onPin, onUnpin, onRemoveAttachment, onFiles, onAssets, reading, attachmentsUnsaved, onRetrySave,
    sendDisabledReason, sending, onSend, canStop, stopping, onStop, demo = false, tools, compact = false, placeholder } = props;
  const area = useRef<ComponentRef<typeof Input.TextArea>>(null), frame = useRef<HTMLDivElement>(null), picker = useRef<AttachmentPickerActions>(null);
  const [caret, setCaret] = useState(0), [mentionOpen, setMentionOpen] = useState(false), [mentionIndex, setMentionIndex] = useState(0);
  const [libraryQuery, setLibraryQuery] = useState<string>();
  const libraryMention = useRef<ReturnType<typeof assistantMentionQuery>>(undefined);
  const latest = useRef(text); latest.current = text;
  const openMention = () => {
    const current = latest.current, value = current + (current && !/\s$/.test(current) ? ' ' : '') + '@';
    onText(value); setCaret(value.length); setMentionOpen(true); setMentionIndex(0); area.current?.focus();
  };
  useImperativeHandle(handle, () => ({
    focus: () => area.current?.focus({ cursor: 'end' }),
    mention: openMention,
    attach: () => picker.current?.upload(),
    library: () => picker.current?.library(),
    compose: (value: string) => {
      const current = latest.current, line = value.trim();
      const next = current.includes(line) ? current : current.trim() ? `${current}${current.endsWith('\n') ? '' : '\n'}${line}` : line;
      onText(next); setCaret(next.length); setMentionOpen(false);
      area.current?.focus({ cursor: 'end' });
      if (frame.current && typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        gsap.fromTo(frame.current, { backgroundColor: '#e8eaec' }, { backgroundColor: '#f6f6f5', duration: .35, ease: 'expo.out', clearProps: 'backgroundColor', overwrite: 'auto' });
    },
  }), [onText]);
  const query = mentionOpen ? assistantMentionQuery(text, caret) : undefined;
  const suggestions = query ? contextNodes.filter(n => n.title.toLocaleLowerCase().includes(query.query.toLocaleLowerCase())).slice(0, 12) : [];
  const choose = (node: CanvasNodeData) => {
    if (!onPin(node)) return;
    onText(query ? insertAssistantMention(text, query, node.title) : text);
    setMentionOpen(false); area.current?.focus();
  };
  const chip = (id: string, kind: 'pin' | 'attachment') => {
    const node = contextNodes.find(n => n.id === id);
    const type = nodeKind(node);
    return <div key={`${kind}-${id}`} className="studio-assistant-reference" data-kind={kind}>
      <span title={node?.title}>{node?.title || '已删除的画布对象'}{node && <small> · {kind === 'attachment' ? `附件 · ${type}` : type}</small>}</span>
      <button type="button" aria-label={`移除引用 ${node?.title || id}`} onClick={() => kind === 'pin' ? onUnpin(id) : onRemoveAttachment(id)}><X size={14}/></button>
    </div>;
  };
  return <div ref={frame} className="studio-assistant-composer studio-dialogue-composer">
    <div className="studio-assistant-references" aria-label="本次引用">{pinnedIds.map(id => chip(id, 'pin'))}{attachmentIds.filter(id => !pinnedIds.includes(id)).map(id => chip(id, 'attachment'))}</div>
    <Input.TextArea ref={area} aria-label="给创作助手的消息" aria-autocomplete="list" aria-controls={query ? 'studio-dialogue-mentions' : undefined}
      aria-activedescendant={query && suggestions.length ? `studio-dialogue-mention-${suggestions[mentionIndex % suggestions.length].id}` : undefined}
      placeholder={placeholder || '说说要做什么，输入 @ 引用画布内容'} value={text}
      onChange={e => { const value = e.target.value; onText(value); setCaret(e.target.selectionStart); setMentionOpen(mentionOpen || (value.match(/@/g)?.length || 0) > (text.match(/@/g)?.length || 0)); setMentionIndex(0); }}
      onSelect={e => setCaret(e.currentTarget.selectionStart)}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (query && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMentionOpen(false); }
        else if (query && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setMentionIndex(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length); }
        else if (query && suggestions.length && e.key === 'Enter') { e.preventDefault(); choose(suggestions[mentionIndex % suggestions.length]); }
        // Like the home page's conversation box and every chat app: Enter sends, Shift+Enter starts a new line
        // (⌘/Ctrl+Enter still sends). Before this, Enter only added a line and the message seemed not to go.
        else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); if (!sendDisabledReason && !sending) onSend(); }
      }} autoSize={{ minRows: compact ? 1 : 2, maxRows: 6 }} maxLength={4000}/>
    {query && <div id="studio-dialogue-mentions" className="studio-assistant-mentions" role="listbox" aria-label="可引用的画布节点">
      {suggestions.length ? suggestions.map((node, index) => <button key={node.id} id={`studio-dialogue-mention-${node.id}`} type="button" role="option" aria-selected={index === mentionIndex % suggestions.length}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(node)}><span>{node.title}</span><small>{nodeKind(node)}</small></button>) : <p>画布上没有匹配的节点</p>}
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { libraryMention.current = query; setLibraryQuery(query.query); setMentionOpen(false); }}>从个人资产库选择</button>
    </div>}
    <div className="studio-assistant-composer-toolbar">
      <div className="studio-assistant-context-actions">
        <Button icon={<AtSign size={17}/>} aria-label="引用节点" title="引用画布上的内容（@）" onClick={openMention}/>
        <StudioAttachmentPicker projectId={projectId} locked={reading} reading={reading} onFiles={onFiles} onAssets={onAssets} iconOnly actions={picker}/>
        {tools}
      </div>
      <div className="studio-dialogue-send">
        {sendDisabledReason && text.trim() && <span className="studio-dialogue-send-reason" role="status" title={sendDisabledReason}>{sendDisabledReason}</span>}
        {canStop && <Button aria-label="停止" icon={<Square size={13}/>} loading={stopping} title="停止回复和进行中的制作" onClick={onStop}/>}
        <Button aria-label="发送" aria-keyshortcuts="Enter" title={sendDisabledReason || (demo ? '发送（演示，不扣积分）' : '发送（Enter）')} className="studio-assistant-primary studio-dialogue-send-button" type="primary"
          icon={<ArrowUp size={18}/>} loading={sending} disabled={!!sendDisabledReason} onClick={onSend}/>
      </div>
    </div>
    <LibraryReferencePicker open={libraryQuery !== undefined} query={libraryQuery || ''} projectId={projectId} onClose={() => setLibraryQuery(undefined)} onAssets={async assets => {
      await onAssets(assets);
      const mention = libraryMention.current;
      if (mention) onText(insertAssistantMention(latest.current, mention, assets.map(a => a.title).join('、')));
      libraryMention.current = undefined;
    }}/>
    {attachmentsUnsaved && <Button onClick={onRetrySave}>重试保存附件</Button>}
  </div>;
});
