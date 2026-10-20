'use client';
// 「工作记录」: one line per real tool call, updated in place by toolCallId.
// It shows only what the server reported (stage text, results, actual credits); while
// running it says how long it has been running, never an invented percentage.
// It reads as a log line of what the assistant is doing, not as a button (user feedback
// 2026-10-20: the bordered row looked like something to click). Only the small chevron
// opens the details.
import { useEffect, useId, useState } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { formatCredits } from '@ai-star-eco/api-client';
import { formatDateTime } from '@/lib/datetime';
import type { DialogueToolBlock } from '@/canvas-bridge/studio-dialogue-store';
import { StudioErrorNotice } from './studio-errors';

/** Display names for tool calls whose server title is missing. Never shows the raw tool id. */
const TOOL_NAMES: Record<string, string> = { read_canvas: '读取画布', read_visual: '读取画面', recreation: '拉片', video: '制作视频', image: '制作图片', text: '整理文字',
  check: '检查', assemble: '合成成片', script: '写剧本', storyboard: '拆分镜' };
export const toolTitle = (block: Pick<DialogueToolBlock, 'title' | 'toolName'>) => block.title || TOOL_NAMES[block.toolName] || '处理一项任务';

export function elapsedText(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60), seconds = total % 60;
  if (minutes < 60) return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function toolCreditsText(block: DialogueToolBlock) {
  if (block.status === 'running' || block.settling || block.creditsActual === undefined) return '待结算';
  return `${formatCredits(block.creditsActual)} 积分`;
}

/** `turnEnded`: the turn failed or was stopped; a tool it never closed stops spinning and says so (the server sends no tool.finished then). */
export function StudioDialogueToolCard({ block, turnEnded }: { block: DialogueToolBlock; turnEnded?: 'failed' | 'interrupted' }) {
  const cut = block.status === 'running' && !!turnEnded;
  const running = block.status === 'running' && !cut, failed = block.status === 'failed' || cut;
  const now = useNow(running);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const started = Date.parse(block.startedAt);
  const elapsed = block.durationMs ?? (Number.isFinite(started) ? (running ? now : Date.parse(block.finishedAt || '') || now) - started : undefined);
  const title = toolTitle(block);
  // The seconds tick outside the live region, so a screen reader hears the state change, not every second.
  const state = running ? '进行中' : cut ? (turnEnded === 'interrupted' ? '已停止' : '没有完成') : failed ? '没有完成' : '完成';
  const time = cut || failed || elapsed === undefined ? '' : ` · ${running ? '已用' : '用时'} ${elapsedText(elapsed)}`;
  return <div className="studio-dialogue-tool" data-status={cut ? 'failed' : block.status} data-open={open || undefined} role="group" aria-label={`工作记录：${title}`}>
    <div className="studio-dialogue-tool-row">
      <span className="studio-dialogue-tool-mark" aria-hidden="true">{running ? <i/> : failed ? <AlertCircle size={14}/> : <Check size={14}/>}</span>
      <span className="studio-dialogue-tool-title" title={title}>{title}</span>
      <small className="studio-dialogue-tool-state"><span role={running ? 'status' : undefined}>{state}</span>{time && <span aria-hidden="true">{time}</span>}</small>
      <button type="button" className="studio-dialogue-tool-toggle" aria-expanded={open} aria-controls={bodyId}
        aria-label={`${open ? '收起' : '展开'}详情：${title}`} title={open ? '收起详情' : '展开详情'} onClick={() => setOpen(v => !v)}><ChevronDown size={14} aria-hidden="true"/></button>
    </div>
    {failed && !cut && !open && <p className="studio-dialogue-tool-reason">{block.errorMessage || '这一步没有完成，可以稍后重试'}</p>}
    <dl id={bodyId} className="studio-dialogue-tool-body" hidden={!open}>
      {!!block.safeInputSummary && <><dt>内容</dt><dd>{block.safeInputSummary}</dd></>}
      {!!block.progress && <><dt>进度</dt><dd>{block.progress}</dd></>}
      {!!block.result?.summary && <><dt>结果</dt><dd>{block.result.summary}</dd></>}
      <dt>积分</dt><dd>{toolCreditsText(block)}</dd>
      <dt>开始</dt><dd>{formatDateTime(block.startedAt)}</dd>
      {failed && !cut && <><dt>原因</dt><dd className="studio-dialogue-tool-error">{block.errorMessage || '这一步没有完成，可以稍后重试'}
        {block.errorCode && <StudioErrorNotice error={{ code: block.errorCode, message: block.errorMessage || '这一步没有完成', taskId: block.childRunId }} autoReport={false} label="查看详情"/>}</dd></>}
    </dl>
  </div>;
}
