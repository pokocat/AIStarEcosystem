'use client';
// Inline question with candidate answers, and the follow-up suggestions after a turn.
// Both only prepare text in the composer; nothing is sent or approved by a click here.
import { ArrowUp } from 'lucide-react';
import type { DialogueQuestionBlock } from '@/canvas-bridge/studio-dialogue-store';

export function StudioDialogueQuestion({ block, onAnswer }: { block: DialogueQuestionBlock; onAnswer: (text: string) => void }) {
  const answered = !!block.answeredMessageId;
  return <div className="studio-dialogue-question" role="group" aria-label={`问题：${block.text}`} data-answered={answered || undefined}>
    <p>{block.text}{answered && <small> · 已回答</small>}</p>
    {!!block.options?.length && !answered && <div className="studio-dialogue-chips">{block.options.map(option =>
      <button key={option} type="button" title="填进输入框，可以改完再发" onClick={() => onAnswer(option)}><span>{option}</span></button>)}</div>}
  </div>;
}

export function StudioDialogueSuggestions({ items, onUse }: { items: string[]; onUse: (text: string) => void }) {
  if (!items.length) return null;
  return <div className="studio-dialogue-suggestions" role="group" aria-label="接下来可以">
    {items.slice(0, 3).map(item => <button key={item} type="button" title="填进输入框，可以改完再发" onClick={() => onUse(item)}><span>{item}</span><ArrowUp size={13} aria-hidden="true"/></button>)}
  </div>;
}
