'use client';
// What the assistant is doing right now, under the turn it belongs to: 「正在思考」 until something comes back,
// 「正在回复」 while text streams, 「正在查看画布」 while a reported tool runs. The phase comes from the stream
// (dialogueActivity), never from a guess; it shows no invented thoughts and no progress percentage. A finished,
// failed or stopped turn ends it.
import { useRef } from 'react';
import type { DialogueActivity } from '@/canvas-bridge/studio-dialogue-store';
import { AiMark } from './studio-ai-icon';
import { elapsedText, toolTitle, useNow } from './studio-dialogue-tool';

export function activityLabel(activity: DialogueActivity) {
  if (activity.phase === 'writing') return '正在回复';
  if (activity.phase === 'tool') {
    const title = toolTitle(activity.tool);
    return title.startsWith('正在') ? title : `正在${title}`;
  }
  return '正在思考';
}

export function StudioDialogueActivity({ activity }: { activity: DialogueActivity }) {
  const phase = activity.phase === 'tool' ? `tool:${activity.tool.toolCallId}` : activity.phase;
  // Seconds in this phase as seen here; a long silence then reads as waiting, not as a stuck page.
  const since = useRef({ phase, at: Date.now() });
  if (since.current.phase !== phase) since.current = { phase, at: Date.now() };
  const timed = activity.phase === 'waiting' || activity.phase === 'continuing';
  const now = useNow(timed);
  const waited = now - since.current.at;
  const label = activityLabel(activity);
  return <div className="studio-dialogue-activity" data-phase={activity.phase}>
    <span className="studio-dialogue-activity-mark" aria-hidden="true"><AiMark size={12}/></span>
    <span className="studio-dialogue-activity-label" role="status">{label}</span>
    <span className="studio-dialogue-activity-dots" aria-hidden="true"><i/><i/><i/></span>
    {timed && waited >= 3000 && <small className="studio-dialogue-activity-time" aria-hidden="true">{elapsedText(waited)}</small>}
  </div>;
}
