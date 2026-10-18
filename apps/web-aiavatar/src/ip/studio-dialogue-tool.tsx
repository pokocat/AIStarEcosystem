'use client';
// 「工作记录」: one folded card per real tool call, updated in place by toolCallId.
// It shows only what the server reported (stage text, results, actual credits); while
// running it says how long it has been running, never an invented percentage.
import { useEffect, useState } from 'react';
import { AlertCircle, Check, CircleDot } from 'lucide-react';
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

function useNow(active: boolean) {
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

export function StudioDialogueToolCard({ block }: { block: DialogueToolBlock }) {
  const running = block.status === 'running';
  const now = useNow(running);
  const started = Date.parse(block.startedAt);
  const elapsed = block.durationMs ?? (Number.isFinite(started) ? (running ? now : Date.parse(block.finishedAt || '') || now) - started : undefined);
  const title = toolTitle(block);
  const state = running ? `进行中${elapsed !== undefined ? ` · 已用 ${elapsedText(elapsed)}` : ''}` : block.status === 'failed' ? '没有完成' : `完成${elapsed !== undefined ? ` · 用时 ${elapsedText(elapsed)}` : ''}`;
  const Icon = running ? CircleDot : block.status === 'failed' ? AlertCircle : Check;
  return <details className="studio-dialogue-tool" data-status={block.status} aria-label={`工作记录：${title}`}>
    <summary>
      <Icon size={15} aria-hidden="true"/>
      <span className="studio-dialogue-tool-title" title={title}>{title}</span>
      <small className="studio-dialogue-tool-state" role={running ? 'status' : undefined}>{state}</small>
    </summary>
    <dl className="studio-dialogue-tool-body">
      {!!block.safeInputSummary && <><dt>内容</dt><dd>{block.safeInputSummary}</dd></>}
      {!!block.progress && <><dt>进度</dt><dd>{block.progress}</dd></>}
      {!!block.result?.summary && <><dt>结果</dt><dd>{block.result.summary}</dd></>}
      <dt>积分</dt><dd>{toolCreditsText(block)}</dd>
      <dt>开始</dt><dd>{formatDateTime(block.startedAt)}</dd>
      {block.status === 'failed' && <><dt>原因</dt><dd className="studio-dialogue-tool-error">{block.errorMessage || '这一步没有完成，可以稍后重试'}
        {block.errorCode && <StudioErrorNotice error={{ code: block.errorCode, message: block.errorMessage || '这一步没有完成', taskId: block.childRunId }} autoReport={false} label="查看详情"/>}</dd></>}
    </dl>
  </details>;
}
