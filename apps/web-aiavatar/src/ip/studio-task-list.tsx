'use client';
import { useState } from 'react';
import type { IpRun } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { studioTaskLabel, studioTaskQueued } from '@/canvas-bridge/studio-task-status';
import { reportStudioError, studioRunError } from './studio-errors';
import { studioRunRewrites } from '@/canvas-bridge/studio-video-prompt';

type Filter = 'all' | 'active' | 'failed' | 'done';
type Props = {
  runs: IpRun[]; nodes: CanvasNodeData[]; unconfirmed: CanvasNodeData[];
  loading: boolean; busy: boolean; hasMore: boolean; error?: string; refreshErrors: Record<string, boolean>;
  titleFor: (run: IpRun) => string; detailFor?: (run: IpRun) => string; onInput: (run: IpRun) => void; onLocate: (node: CanvasNodeData) => void;
  onCancel: (run: IpRun) => void; onRetry: (node: CanvasNodeData) => void; onReload: () => void; onMore: () => void;
};
const failed = (run: IpRun) => run.status === 'failed' && run.errorCode !== 'IP_RUN_CANCELLED';
export function StudioTaskList({ runs, nodes, unconfirmed, loading, busy, hasMore, error, refreshErrors, titleFor, detailFor, onInput, onLocate, onCancel, onRetry, onReload, onMore }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: runs.length + unconfirmed.length },
    { id: 'active', label: '进行中', count: runs.filter(r => r.status === 'running').length + unconfirmed.length },
    { id: 'failed', label: '失败', count: runs.filter(failed).length },
    { id: 'done', label: '完成', count: runs.filter(r => r.status === 'done').length },
  ];
  const visible = runs.filter(r => filter === 'all' || (filter === 'active' ? r.status === 'running' : filter === 'failed' ? failed(r) : r.status === 'done'));
  return <div className="studio-task-list">
    <nav className="studio-task-filters" aria-label="筛选创作任务">{filters.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.count}</span></button>)}</nav>
    <p className="studio-task-polling">{filters[1].count ? '任务状态自动更新，可继续在画布创作' : '按时间查看每次创作记录'}{hasMore ? ' · 数量仅统计已加载任务' : ''}</p>
    {error && <div className="studio-task-load-error"><span>{error}</span><button type="button" disabled={loading} onClick={onReload}>重试加载任务</button></div>}
    {(filter === 'all' || filter === 'active') && unconfirmed.map(node => <article className="studio-task-item" key={node.id}>
      <div className="studio-task-heading"><strong>{node.title}</strong><span className="studio-task-status" data-status="queued">待确认</span></div>
      <p className="studio-task-note">提交结果尚未确认，先查询原任务</p>
      <div className="studio-task-actions"><button type="button" className="is-primary" disabled={busy} onClick={() => onRetry(node)}>确认原任务</button></div>
    </article>)}
    {visible.map(run => {
      const node = nodes.find(n => n.id === run.nodeId), queued = studioTaskQueued(run), stopped = run.errorCode === 'IP_RUN_CANCELLED';
      const current = node?.metadata?.studio?.runId === run.id;
      const state = run.status === 'running' ? queued ? 'queued' : 'running' : stopped ? 'stopped' : failed(run) ? 'failed' : run.stage === '部分视频生成失败' ? 'partial' : 'done';
      const label = run.status === 'running' ? studioTaskLabel(run, true) : stopped ? '已停止' : state === 'failed' ? '生成失败' : state === 'partial' ? '部分完成' : '已完成';
      const pct = Math.max(0, Math.min(100, Number.isFinite(run.pct) ? run.pct : 0));
      const title = titleFor(run), detail = detailFor?.(run);
      const date = new Date(run.createdAt), timestamp = Number.isNaN(date.getTime()) ? run.createdAt : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return <article className="studio-task-item" key={run.id} data-task-id={run.id}>
        <div className="studio-task-heading"><strong title={title}>{title}</strong><span className="studio-task-status" data-status={state}>{label}</span></div>
        {detail && <p className="studio-task-brief" title={detail}>{detail}</p>}
        <div className="studio-task-meta"><time dateTime={run.createdAt}>{timestamp}</time><span title={run.id}>#{run.id.slice(-6)}</span><span>{run.output.mock ? '测试响应' : run.status === 'running' ? `冻结 ${run.cost} 积分` : `已消耗 ${run.cost} 积分`}</span></div>
        {state === 'running' && <div className="studio-task-progress" role="progressbar" aria-label={`${title}生成进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ transform: `scaleX(${pct / 100})` }}/></div>}
        {queued && run.queue && <p className="studio-task-note">前面还有 {Math.max(0, run.queue.position - 1)} 项 · 有空位后自动开始</p>}
        {run.status === 'running' && refreshErrors[run.id] && <p className="studio-task-note" role="status">任务状态暂未更新，正在重试…</p>}
        {run.kind === 'studio-video' && studioRunRewrites(run).some(take => take.lost.length) && <p className="studio-task-note">出片前模型改写描述时删掉了部分台词，可在「查看输入」里对照</p>}
        {(state === 'failed' || state === 'partial') && <div className="studio-task-failure"><p>{run.errorMessage || run.output.videoCandidates?.find(c => c.status === 'failed')?.errorMessage || '本次创作未完成，可查看错误详情'}</p><button type="button" onClick={() => reportStudioError(studioRunError(run))}>查看错误详情</button></div>}
        <div className="studio-task-actions">
          {node && <button type="button" className={run.status === 'done' && current ? 'is-primary' : ''} onClick={() => onLocate(node)}>{node.metadata?.studio?.conversation ? '打开对话' : run.status === 'done' && current ? '查看结果' : '定位节点'}</button>}
          {failed(run) && current && node && !node.metadata?.studio?.conversation && <button type="button" className="is-primary" disabled={busy} onClick={() => onRetry(node)}>重新生成</button>}
          <button type="button" onClick={() => onInput(run)}>查看输入</button>
          {run.status === 'running' && (run.kind === 'studio-video' && !queued ? <span className="studio-task-note">视频生成中</span> : <button type="button" onClick={() => onCancel(run)}>{queued ? '停止排队' : '停止'}</button>)}
        </div>
      </article>;
    })}
    {!visible.length && (!(filter === 'all' || filter === 'active') || !unconfirmed.length) && !loading && <div className="studio-task-empty">{filter === 'all' ? '还没有创作任务' : filter === 'active' ? '当前没有进行中的任务' : filter === 'failed' ? '没有失败的任务' : '还没有完成的任务'}</div>}
    {loading && <p className="studio-task-note" role="status">正在加载任务…</p>}
    {hasMore && <button type="button" className="studio-task-more" disabled={loading} onClick={onMore}>加载更多任务</button>}
  </div>;
}
