'use client';
// The always-editable composer. Typing is never locked by streaming, tools or a running
// production; only the send button waits for attachments to finish saving. `@` pins a
// canvas object for this message, attachments are added as ordinary canvas nodes first.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { gsap } from 'gsap';
import { Button, Input } from 'antd';
import { AtSign, Square, X } from 'lucide-react';
import type { IpSavedAsset } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { assistantMentionQuery, insertAssistantMention } from '@/canvas-bridge/studio-assistant-context';
import { LibraryReferencePicker } from './library-reference-picker';
import { StudioAttachmentPicker } from './studio-attachment-picker';

export type DialogueComposerHandle = { focus: () => void; compose: (text: string) => void };
type Props = {
  projectId: string; text: string; onText: (value: string) => void;
  contextNodes: CanvasNodeData[]; pinnedIds: string[]; attachmentIds: string[];
  onPin: (node: CanvasNodeData) => boolean; onUnpin: (id: string) => void; onRemoveAttachment: (id: string) => void;
  onFiles: (files: File[]) => void; onAssets: (assets: IpSavedAsset[]) => Promise<void>;
  reading: boolean; attachmentsUnsaved: boolean; onRetrySave: () => void;
  sendDisabledReason?: string; sending: boolean; onSend: () => void;
  canStop: boolean; stopping: boolean; onStop: () => void; costHint?: string;
};

export const StudioDialogueComposer = forwardRef<DialogueComposerHandle, Props>(function StudioDialogueComposer(props, handle) {
  const { projectId, text, onText, contextNodes, pinnedIds, attachmentIds, onPin, onUnpin, onRemoveAttachment, onFiles, onAssets, reading, attachmentsUnsaved, onRetrySave,
    sendDisabledReason, sending, onSend, canStop, stopping, onStop, costHint } = props;
  const area = useRef<ComponentRef<typeof Input.TextArea>>(null), frame = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0), [mentionOpen, setMentionOpen] = useState(false), [mentionIndex, setMentionIndex] = useState(0);
  const [libraryQuery, setLibraryQuery] = useState<string>();
  const libraryMention = useRef<ReturnType<typeof assistantMentionQuery>>(undefined);
  const [shortcut, setShortcut] = useState('Ctrl Enter');
  useEffect(() => { if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) setShortcut('⌘ Enter'); }, []);
  const latest = useRef(text); latest.current = text;
  useImperativeHandle(handle, () => ({
    focus: () => area.current?.focus({ cursor: 'end' }),
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
    const type = node?.type === 'image' ? '图片' : node?.type === 'video' ? '视频' : node?.type === 'audio' ? '音频' : node ? '文字' : '';
    return <div key={`${kind}-${id}`} className="studio-assistant-reference" data-kind={kind}>
      <span title={node?.title}>{node?.title || '已删除的画布对象'}{node && <small> · {kind === 'attachment' ? `附件 · ${type}` : type}</small>}</span>
      <button type="button" aria-label={`移除引用 ${node?.title || id}`} onClick={() => kind === 'pin' ? onUnpin(id) : onRemoveAttachment(id)}><X size={14}/></button>
    </div>;
  };
  return <div ref={frame} className="studio-assistant-composer studio-dialogue-composer">
    <div className="studio-assistant-references" aria-label="本次引用">{pinnedIds.map(id => chip(id, 'pin'))}{attachmentIds.filter(id => !pinnedIds.includes(id)).map(id => chip(id, 'attachment'))}</div>
    <Input.TextArea ref={area} aria-label="给创作助手的消息" aria-autocomplete="list" aria-controls={query ? 'studio-dialogue-mentions' : undefined}
      aria-activedescendant={query && suggestions.length ? `studio-dialogue-mention-${suggestions[mentionIndex % suggestions.length].id}` : undefined}
      placeholder="想做什么？可以随时补充或改主意，输入 @ 指定画布内容" value={text}
      onChange={e => { const value = e.target.value; onText(value); setCaret(e.target.selectionStart); setMentionOpen(mentionOpen || (value.match(/@/g)?.length || 0) > (text.match(/@/g)?.length || 0)); setMentionIndex(0); }}
      onSelect={e => setCaret(e.currentTarget.selectionStart)}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !query) { e.preventDefault(); if (!sendDisabledReason && !sending) onSend(); return; }
        if (query && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMentionOpen(false); }
        else if (query && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setMentionIndex(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length); }
        else if (query && suggestions.length && e.key === 'Enter') { e.preventDefault(); choose(suggestions[mentionIndex % suggestions.length]); }
      }} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={4000}/>
    {query && <div id="studio-dialogue-mentions" className="studio-assistant-mentions" role="listbox" aria-label="可引用的画布节点">
      {suggestions.length ? suggestions.map((node, index) => <button key={node.id} id={`studio-dialogue-mention-${node.id}`} type="button" role="option" aria-selected={index === mentionIndex % suggestions.length}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(node)}><span>{node.title}</span><small>{node.type === 'text' ? '文字' : '素材设定'}</small></button>) : <p>当前画布没有匹配节点</p>}
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { libraryMention.current = query; setLibraryQuery(query.query); setMentionOpen(false); }}>从个人资产库选择</button>
    </div>}
    <div className="studio-assistant-composer-toolbar">
      <div className="studio-assistant-context-actions">
        <Button icon={<AtSign size={16}/>} onClick={() => { const value = text + (text && !/\s$/.test(text) ? ' ' : '') + '@'; onText(value); setCaret(value.length); setMentionOpen(true); setMentionIndex(0); area.current?.focus(); }}>引用节点</Button>
        <StudioAttachmentPicker projectId={projectId} locked={reading} reading={reading} onFiles={onFiles} onAssets={onAssets}/>
      </div>
      <div className="studio-dialogue-send">
        {canStop && <Button aria-label="停止" icon={<Square size={13}/>} loading={stopping} title="停止回复和进行中的制作，不再提交新任务；已经交给厂商的任务会照常完成并结算" onClick={onStop}>停止</Button>}
        <Button aria-label="发送" aria-keyshortcuts="Control+Enter Meta+Enter" title={sendDisabledReason || '发送（⌘ / Ctrl + Enter）；回复按实际用量扣积分'} className="studio-assistant-primary" type="primary"
          loading={sending} disabled={!!sendDisabledReason} onClick={onSend}><span className="studio-assistant-send-label">发送<kbd className="studio-assistant-send-shortcut" aria-hidden="true">{shortcut}</kbd></span></Button>
      </div>
    </div>
    <LibraryReferencePicker open={libraryQuery !== undefined} query={libraryQuery || ''} projectId={projectId} onClose={() => setLibraryQuery(undefined)} onAssets={async assets => {
      await onAssets(assets);
      const mention = libraryMention.current;
      if (mention) onText(insertAssistantMention(latest.current, mention, assets.map(a => a.title).join('、')));
      libraryMention.current = undefined;
    }}/>
    {attachmentsUnsaved && <Button onClick={onRetrySave}>重试保存附件</Button>}
    {sendDisabledReason && text.trim() && <p className="studio-dialogue-note" role="status">{sendDisabledReason}</p>}
    {costHint && <p className="studio-assistant-send-hint">{costHint}</p>}
  </div>;
});
