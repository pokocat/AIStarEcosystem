'use client';
// Inline question with candidate answers, and the follow-up suggestions after a turn.
// A click sends that answer as the user's next message through the ordinary send chain
// (like every chat app); the draft in the composer is left alone. Nothing is approved by
// a click here: a confirmation card still needs its own button.
import { ArrowUp } from 'lucide-react';
import type { DialogueQuestionBlock } from '@/canvas-bridge/studio-dialogue-store';

const SEND_TITLE = '直接发出这句';

/** `answered`: the user already said something after this question (it is then closed, so a chip cannot answer it twice). */
export function StudioDialogueQuestion({ block, answered: answeredHere, busy, onAnswer }: {
  block: DialogueQuestionBlock; answered?: boolean; busy?: boolean; onAnswer?: (text: string) => void;
}) {
  const answered = !!block.answeredMessageId || !!answeredHere;
  return <div className="studio-dialogue-question" role="group" aria-label={`问题：${block.text}`} data-answered={answered || undefined}>
    <p>{block.text}{answered && <small> · 已回答</small>}</p>
    {!!block.options?.length && !answered && <div className="studio-dialogue-chips">{block.options.map(option =>
      <button key={option} type="button" title={SEND_TITLE} disabled={busy || !onAnswer} onClick={() => onAnswer?.(option)}><span>{option}</span></button>)}</div>}
  </div>;
}

export function StudioDialogueSuggestions({ items, busy, onUse }: { items: string[]; busy?: boolean; onUse: (text: string) => void }) {
  if (!items.length) return null;
  return <div className="studio-dialogue-suggestions" role="group" aria-label="接下来可以">
    {items.slice(0, 3).map(item => <button key={item} type="button" title={SEND_TITLE} disabled={busy} onClick={() => onUse(item)}><span>{item}</span><ArrowUp size={13} aria-hidden="true"/></button>)}
  </div>;
}
