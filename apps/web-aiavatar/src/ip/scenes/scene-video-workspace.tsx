'use client';

import { Button } from 'antd';
import { observePortraitReviews, requestPortraitReview } from '../portrait-review-events';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, Check, ChevronRight, Clock3, Download, Film, Image as ImageIcon, Layers, ListVideo, Loader2, Play, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { IpRun, IpProjectDoc } from '@ai-star-eco/types';
import type { StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
import type { StudioVideoTask, StudioVideoTaskCreate } from '@ai-star-eco/types/ip-studio-video-task';
import { videoTask, videoTasks, videoTaskLabel, videoTaskStatus, videoTaskCanvasHref, videoTaskNeedsAction, videoTaskResumeLabel, videoTaskProblemStep, videoTaskProblemText, videoTaskProblemTitle, videoTaskSegmentRetry } from '@/canvas-bridge/studio-video-tasks';
import { cancelRun, readRun, readVideoJob, signKeys } from '@/canvas-bridge/api';
import { dialogFocus } from '@/ip/dialog-focus';
import { normalizeStudioError, StudioErrorNotice, useStudioFailure } from '@/ip/studio-errors';
import { useCanvasDelete } from '@/ip/studio-canvas-delete';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { downloadMedia } from '@/canvas-bridge/download-media';
import { cancelStudioPlanExecution, executionRestoreUpserts, projectCanvasOps, resumeStudioPlanExecution, stepNodeId, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import { formatDateTime } from '@/lib/datetime';
import { AiMark } from '../studio-ai-icon';
import { groupTakes, sameTakes, takeTag } from './scene-video-takes';
import { FissionIcon } from './fission-icon';
import type { CanvasNodeData } from '@/canvas/types/canvas';

export const VIDEO_TASK_SELECTION = 'studio:video:selected-task';
/** 最近任务怎么排：按批次（同一份草稿一行）或按时间（每条一行）。只是本浏览器的偏好。 */
export const VIDEO_TASK_GROUPING = 'studio:video:task-grouping';
type Grouping = 'batch' | 'time';
/** 进度只写真实的东西：所处阶段和真实数量。阶段名与制作记录里的步骤名保持一致。 */
export function videoTaskPhases(task: StudioVideoTask) {
  const groups = [
    { key: 'study', label: '分析参考视频', match: (s: StudioPlanExecutionStep) => s.operation === 'recreation' },
    { key: 'script', label: '写分镜脚本', match: (s: StudioPlanExecutionStep) => s.operation === 'text' },
    { key: 'depth', label: '提取动作', match: (s: StudioPlanExecutionStep) => s.operation === 'video-control' },
    { key: 'boards', label: '生成分镜图', match: (s: StudioPlanExecutionStep) => s.operation === 'image' },
    { key: 'videos', label: task.kind === 'direct' ? '生成视频' : '生成片段', match: (s: StudioPlanExecutionStep) => s.operation === 'video' },
    { key: 'review', label: '检查画面', match: (s: StudioPlanExecutionStep) => s.operation === 'check' },
    { key: 'film', label: '导出成片', match: (s: StudioPlanExecutionStep) => s.operation === 'assemble' },
  ];
  if (!task.execution) return [{ key: 'videos', label: '生成视频', done: task.run?.status === 'done' ? 1 : 0, total: 1, state: task.run?.status === 'done' ? 'done' : task.run?.status === 'failed' ? 'failed' : 'running' }];
  return groups.flatMap(group => {
    const all = task.execution!.steps.filter(group.match);
    if (!all.length) return [];
    const used = all.filter(s => s.status !== 'skipped');
    const counted = group.key === 'boards' ? used.filter(s => s.operation === 'image') : used;
    const done = counted.filter(s => s.status === 'done').length;
    const state = all.some(s => s.status === 'failed' || s.status === 'needs_user') ? 'failed'
      : used.length && used.every(s => s.status === 'done') ? 'done'
      : used.some(s => s.status === 'running' || s.status === 'submitted' || s.attempt > 1 && s.status === 'pending') ? 'running' : 'waiting';
    return [{ key: group.key, label: group.label, done, total: counted.length, state }];
  });
}

/** 打开最近任务：没选中任务时放在结果区标题栏，选中任务时放在任务标题栏；只在任务栏收起时显示。 */
export function VideoHistoryToggle({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="video-history-toggle" onClick={onOpen} aria-label="打开最近任务"><ListVideo size={15} strokeWidth={1.5}/>任务</button>;
}

/** Data loading never submits work. A stale response cannot replace a more recently selected task. */
export function SceneVideoWorkspace({ enabled, taskId, draftId, sceneId, restoreLastTask, selected, onSelect, onDraft, drafts, draftsError, onRetryDrafts, railOpen, onRail, onNew, onDeleted, children, persist, listRevision = 0 }: {
  enabled: boolean; taskId?: string; draftId?: string; sceneId?: string; restoreLastTask?: boolean; selected?: StudioVideoTask;
  /** 变了就重读任务列表（视频裂变之后，新任务要马上排进「本批视频」）。 */
  listRevision?: number;
  onSelect: (task: StudioVideoTask) => void;
  onDraft: (id: string) => void; drafts: { id: string; name: string; updatedAt: string }[]; draftsError?: string; onRetryDrafts?: () => void;
  railOpen: boolean; onRail: (open: boolean) => void; onNew?: () => void;
  /** 删掉了这些草稿（进回收站）：页面上开着的是其中之一就回到新建。 */
  onDeleted?: (projectIds: string[]) => void;
  children: ReactNode;
  persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<unknown>;
}) {
  const [items, setItems] = useState<StudioVideoTask[]>([]), [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [reload, setReload] = useState(0);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const remembered = useRef(false);
  // The scene page adds its default URL while the list is loading. Preserve the user's original bare-page entry.
  const restoreRemembered = useRef(restoreLastTask ?? (!draftId && !sceneId));
  useEffect(() => {
    if (!enabled) return;
    let alive = true, firstRead = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      if (!firstRead && document.visibilityState === 'hidden') { timer = setTimeout(read, 5000); return; }
      firstRead = false;
      try {
        const result = await videoTasks(page);
        if (!alive) return;
        setItems(old => {
          const merged = new Map((page ? old : []).map(t => [t.id, t]));
          result.items.forEach(t => merged.set(t.id, t));
          if (selected && !merged.has(selected.id)) merged.set(selected.id, selected);
          return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
        setMore(result.hasMore); setError('');
        if (!taskId && !remembered.current) {
          remembered.current = true;
          let prior: string | null = null;
          try { prior = restoreRemembered.current ? sessionStorage.getItem(VIDEO_TASK_SELECTION) : null; } catch { /* UI preference only */ }
          const task = draftId ? result.items.find(t => t.projectId === draftId) : prior ? result.items.find(t => t.id === prior) ?? await videoTask(prior).catch(() => undefined) : undefined;
          if (alive && task) onSelectRef.current(task);
        }
      } catch { if (alive) setError('最近任务加载失败'); }
      finally { if (alive) { setLoading(false); timer = setTimeout(read, 10000); } }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // selected is included directly on submission; polling must not restart every time its timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page, reload, listRevision]);
  useEffect(() => {
    if (!taskId || !enabled) return;
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await videoTask(taskId);
        if (!alive) return;
        onSelectRef.current(next); setError('');
        setItems(old => [next, ...old.filter(t => t.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch { if (alive) setError('连接中断，正在重新连接'); }
      finally { if (alive) timer = setTimeout(read, 5000); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [enabled, taskId, reload]);
  const choose = (task: StudioVideoTask) => { onRail(false); onSelect(task); };
  // 删除（2026-11-10 用户：不想要的删不掉）：删的是这条任务所在的草稿，同一份草稿里的几条视频一起进回收站。
  const removal = useCanvasDelete();
  const removeDraft = (projectId: string, name: string) => {
    const inDraft = items.filter(t => t.projectId === projectId);
    removal.ask({ targets: [{ id: projectId, name }], noun: '草稿',
      detail: inDraft.length > 1 ? `这份草稿里的 ${inDraft.length} 条视频会一起删除。` : undefined,
      blocked: inDraft.some(t => videoTaskStatus(t) === 'running') ? '这份草稿里还有视频在生成，生成结束或停止后才能删除。' : undefined,
      onDeleted: ids => { setItems(old => old.filter(t => !ids.includes(t.projectId))); onDeleted?.(ids); setReload(n => n + 1); } });
  };
  const shown = selected?.id === taskId ? selected : undefined;
  const openDrafts = drafts.filter(d => !items.some(t => t.projectId === d.id));
  const today = new Date().toDateString();
  // 按批次：同一份草稿（原视频、改了再出的、裂变出的）只占一行，打开后在结果区并排看；按时间：每条一行，新的在前。
  // 读偏好放在挂载之后，服务端渲染和首帧一致。
  const [grouping, setGrouping] = useState<Grouping>('batch');
  useEffect(() => { try { if (localStorage.getItem(VIDEO_TASK_GROUPING) === 'time') setGrouping('time'); } catch { /* 读不到就按批次 */ } }, []);
  const pickGrouping = (next: Grouping) => { setGrouping(next); try { localStorage.setItem(VIDEO_TASK_GROUPING, next); } catch { /* 只是偏好 */ } };
  const takeGroups = grouping === 'batch' ? groupTakes(items)
    : [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(task => ({ latest: task, tasks: [task] }));
  const groups = [{ label: '今天', takes: takeGroups.filter(g => new Date(g.latest.createdAt).toDateString() === today) }, { label: '更早', takes: takeGroups.filter(g => new Date(g.latest.createdAt).toDateString() !== today) }].filter(g => g.takes.length);
  return <>
    <section className="scene-card video-workspace" aria-label="作品">
      {shown && <header className="video-workspace-head"><h2 title={shown.title}>{shown.title}</h2>
        <div>{!videoTaskNeedsAction(shown) && <Link className="scene-text-button" href={videoTaskCanvasHref(shown)}>在画布上查看<ArrowUpRight size={14} strokeWidth={1.5}/></Link>}
          {onNew && <button type="button" className="video-head-new" onClick={onNew} aria-label="新建"><Plus size={15} strokeWidth={1.6}/>新建</button>}
          <VideoHistoryToggle onOpen={() => onRail(true)}/></div></header>}
      {error && <div className="video-connection-note" role="status">{error}<button type="button" onClick={() => setReload(n => n + 1)}>重试</button></div>}
      {taskId && !shown ? <div className="video-task-loading" role="status"><div className="video-loading-frame"/>正在加载任务…</div>
        : shown ? <VideoTaskView key={shown.id} task={shown} takes={sameTakes(items, shown)} onOpen={onSelect} persist={persist} onRefresh={() => setReload(n => n + 1)}/>
        : children}
    </section>
    {railOpen && <button type="button" className="video-history-backdrop" aria-label="关闭最近任务" onClick={() => onRail(false)}/>}
    <aside className={`scene-card video-task-history${railOpen ? ' is-open' : ''}`} aria-label="最近任务"
      role={railOpen ? 'dialog' : undefined} aria-modal={railOpen || undefined} tabIndex={railOpen ? -1 : undefined}
      ref={railOpen ? dialogFocus : undefined} onKeyDown={event => { if (event.key === 'Escape' && railOpen) { event.preventDefault(); event.stopPropagation(); onRail(false); } }}>
      <header><h2>最近任务</h2><button type="button" className="video-history-close" aria-label="关闭最近任务" onClick={() => onRail(false)}><X size={16}/></button></header>
      <div className="video-history-grouping" role="group" aria-label="排列方式">
        <button type="button" aria-pressed={grouping === 'batch'} onClick={() => pickGrouping('batch')}><Layers size={13} strokeWidth={1.6}/>按批次</button>
        <button type="button" aria-pressed={grouping === 'time'} onClick={() => pickGrouping('time')}><Clock3 size={13} strokeWidth={1.6}/>按时间</button>
      </div>
      <div className="video-task-history-scroll">
        {loading && !items.length && <p role="status">正在加载任务…</p>}
        {!loading && !items.length && <p>生成视频后，任务会保存在这里。</p>}
        {groups.map(group => <div key={group.label} role="group" aria-label={group.label}><h4>{group.label}</h4>{group.takes.map(({ latest, tasks }) => {
          const current = tasks.find(t => t.id === taskId), busy = tasks.find(t => videoTaskStatus(t) === 'running') ?? latest;
          const batch = tasks.length > 1, tag = takeTag(latest);
          return <div className="video-history-row" key={latest.id}><button type="button" className={`video-history-item${batch ? ' is-batch' : ''}`} title={latest.title} aria-current={current ? 'true' : undefined} onClick={() => choose(current ?? latest)}>
            <span className="video-history-thumb-wrap"><TaskThumb task={latest}/>{batch && <i className="video-history-count" aria-label={`本批 ${tasks.length} 条`}>{tasks.length}</i>}</span>
            <span><strong>{latest.title}</strong><small data-state={videoTaskStatus(busy)}>{videoTaskLabel(busy)}{batch && ` · 共 ${tasks.length} 条`}</small>
              <span className="video-history-meta">{grouping === 'time' && tag.label && <i className="video-take-tag" title={tag.detail}>{tag.label}</i>}
                <time dateTime={latest.createdAt}>{formatDateTime(latest.createdAt)}</time></span></span>
          </button><button type="button" className="video-history-delete" aria-label="删除" title={`删除「${latest.title}」所在的草稿`} onClick={() => removeDraft(latest.projectId, latest.title)}><Trash2 size={14} strokeWidth={1.6}/></button></div>;
        })}</div>)}
        {(!!openDrafts.length || !!draftsError) && <h3>草稿</h3>}
        {draftsError && <p role="status">草稿加载失败{onRetryDrafts && <button type="button" className="video-history-retry" onClick={onRetryDrafts}>重试</button>}</p>}
        {openDrafts.map(d => <div className="video-history-row" key={d.id}><button type="button" className="video-history-draft" title={d.name} onClick={() => { onRail(false); onDraft(d.id); }}><Film size={15} strokeWidth={1.5}/><span>{d.name}</span><ChevronRight size={13}/></button>
          <button type="button" className="video-history-delete" aria-label="删除" title={`删除草稿「${d.name}」`} onClick={() => removeDraft(d.id, d.name)}><Trash2 size={14} strokeWidth={1.6}/></button></div>)}
      </div>
      {more && <button type="button" className="video-history-more" onClick={() => setPage(n => n + 1)}>加载更多<ChevronRight size={13}/></button>}
    </aside>
    {removal.dialog}
  </>;
}

function TaskThumb({ task, className = 'video-history-thumb' }: { task: StudioVideoTask; className?: string }) {
  const [cover, setCover] = useState<string>(), job = useRef<string | undefined>(undefined), retried = useRef(false);
  const done = videoTaskStatus(task) === 'done';
  useEffect(() => {
    let alive = true; retried.current = false; setCover(undefined); job.current = undefined;
    if (done) void (async () => {
      const video = task.execution?.steps.find(step => step.operation === 'video' && step.status === 'done');
      const run = task.run ?? (video && stepRunCandidates(video)[0] ? await readRun(stepRunCandidates(video)[0]) : undefined);
      const id = run?.output?.videoCandidates?.find(candidate => candidate.status === 'done')?.jobId;
      if (!id || !alive) return;
      job.current = id;
      const native = await readVideoJob(id);
      if (alive) setCover(native.thumbnail_url);
    })().catch(() => { /* Fall back to the task's own input image. */ });
    return () => { alive = false; };
    // A completed result is immutable; history polling need not reload its cover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, done]);
  const refreshCover = async () => {
    if (!job.current || retried.current) { setCover(undefined); return; }
    retried.current = true;
    try { const native = await readVideoJob(job.current); setCover(native.thumbnail_url); }
    catch { setCover(undefined); }
  };
  const image = task.input?.nodes?.find(n => n.type === 'image' && n.metadata?.storageKey);
  return <span className={className}>{cover ? <img src={cover} alt="" onError={() => void refreshCover()}/>
    : image ? <SignedImage storageKey={image.metadata!.storageKey!} alt=""/> : <Film size={18} strokeWidth={1.4}/>}</span>;
}

const outputKey = (run?: IpRun) => run?.output?.videoCandidates?.find(c => c.status === 'done')?.storageKey ?? run?.output?.candidates?.[0]?.key ?? run?.output?.storageKey;
const stepStateText = (step: StudioPlanExecutionStep) => step.status === 'done' ? '已完成' : step.status === 'pending' ? step.attempt > 1 ? '等待重试' : '等待'
  : step.status === 'running' || step.status === 'submitted' ? '生成中' : step.status === 'skipped' ? '已跳过' : '需处理';
const MAX_PREVIEWS = 4;
const pad = (n: number) => String(n).padStart(2, '0');

/** 已用时是页面上唯一能写的真实时间：不猜「还剩多久」。 */
function useElapsed(since: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}` : `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function VideoTaskView({ task, takes, onOpen, persist, onRefresh }: {
  task: StudioVideoTask; persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<unknown>;
  /** 内容相同的全部任务（含这一条），先提交的在前。 */
  takes: StudioVideoTask[]; onOpen: (task: StudioVideoTask) => void;
  onRefresh: () => void;
}) {
  const showFailure = useStudioFailure();
  const [runs, setRuns] = useState<Record<string, IpRun>>({}), [urls, setUrls] = useState<Record<string, string>>({});
  const [acting, setActing] = useState(false), [previewError, setPreviewError] = useState(false), [details, setDetails] = useState(false), [allPreviews, setAllPreviews] = useState(false);
  const [poll, setPoll] = useState(0);
  const cache = useRef<Record<string, IpRun>>({}), projection = useRef(new Set<string>());
  const execution = task.execution, status = videoTaskStatus(task), phases = videoTaskPhases(task);
  const portraitReview = task.run?.output?.assetReviews ?? (execution?.steps ?? []).flatMap(step => stepRunCandidates(step).flatMap(id => runs[id]?.output?.assetReviews || []));
  useEffect(() => { observePortraitReviews(portraitReview); }, [JSON.stringify(portraitReview)]);
  const running = status === 'running';
  const elapsed = useElapsed(task.createdAt, running);
  const key = JSON.stringify(execution?.steps.map(s => [s.id, s.status, s.runIds, s.acceptedRunId]) ?? task.run?.id);
  // 排队位次只在运行记录上：制作中定时读一次，位次才是当前的。
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') setPoll(n => n + 1); }, 5000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = { ...cache.current };
      if (task.run) next[task.run.id] = task.run;
      for (const step of execution?.steps ?? []) for (const id of stepRunCandidates(step)) {
        if (next[id]?.status !== 'done') next[id] = await readRun(id);
      }
      if (!alive) return;
      cache.current = next; setRuns(next); setPreviewError(false);
      const keys = [...new Set(Object.values(next).flatMap(run => outputKey(run) ?? []))];
      if (keys.length) { const signed = await signKeys(keys); if (alive) setUrls(signed); }
      if (!execution) return;
      // 整理方案和检查是给执行器看的结果，不摆到画布上。
      const fresh = execution.steps.filter(s => s.status === 'done' && s.id !== 'compile' && s.operation !== 'check' && !projection.current.has(`${s.id}:${s.acceptedRunId ?? s.runIds.join()}`));
      if (!fresh.length) return;
      const ids = new Set(fresh.map(s => stepNodeId(execution, s)));
      const ops = executionRestoreUpserts(execution, next, ids).map(data => ({ kind: 'node' as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
      if (ops.length) await persist(doc => {
        const result = projectCanvasOps({ nodes: doc.nodes as CanvasNodeData[], connections: doc.connections as never }, ops);
        return { ...doc, nodes: result.doc.nodes as never, connections: result.doc.connections as never };
      }, task.projectId);
      if (alive) fresh.forEach(s => projection.current.add(`${s.id}:${s.acceptedRunId ?? s.runIds.join()}`));
    })().catch(() => { if (alive) setPreviewError(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, task.id, execution?.updatedAt, poll]);
  const videos = execution?.steps.filter(s => s.operation === 'video') ?? [];
  const final = execution?.steps.find(s => s.operation === 'assemble') ?? (videos.length === 1 ? videos[0] : undefined);
  const finalRun = task.run ?? (final ? stepRunCandidates(final).map(id => runs[id]).find(run => run?.status === 'done') : undefined);
  const result = outputKey(finalRun), completed = status === 'done' && !!result;
  const failed = videoTaskProblemStep(task);
  const retry = execution?.steps.find(s => s.id === task.retryStepId);
  const active = phases.find(p => p.state === 'running' || p.state === 'failed') ?? phases.find(p => p.state === 'waiting');
  const needsAction = videoTaskNeedsAction(task), resumeLabel = videoTaskResumeLabel(task);
  // 停下来等人的任务也能停止：不停的话这张草稿里没法再生成（同一张画布一次只跑一条）
  const stoppable = !!execution && (execution.status === 'needs_user' || execution.status === 'paused');
  const segmentRetry = videoTaskSegmentRetry(task);
  const runningStep = execution?.steps.find(s => s.status === 'running' || s.status === 'submitted');
  const activeRun = task.run ?? (runningStep ? stepRunCandidates(runningStep).map(id => runs[id]).find(Boolean) : undefined);
  const queuePosition = running && activeRun?.queue && activeRun.queue.position > 0 ? activeRun.queue.position : undefined;
  const heading = portraitReview.length ? '参考人像待核验' : completed ? '视频已完成' : status === 'done' ? '正在加载视频…' : failed ? videoTaskProblemTitle(failed) : needsAction ? '生成没有完成'
    : status === 'canceled' ? '已停止生成' : status === 'paused' ? '已暂停' : retry ? '等待重试' : queuePosition ? '排队中' : active ? `正在${active.label}` : '正在准备';
  const progress = active && active.total > 1 && active.key === 'boards' ? `分镜图 ${active.done} / ${active.total} 张已完成` : active && active.total > 1 && active.key === 'videos' ? `片段 ${active.done} / ${active.total} 段已完成` : '';
  const failure = failed?.reason ?? execution?.needsUserReason ?? (task.run?.status === 'failed' ? task.run.errorMessage : undefined);
  const failureError = failure ? normalizeStudioError(failure) : undefined;
  const reader = (text: string) => <p role="status">{text}</p>;
  const stop = async () => {
    setActing(true);
    try { if (execution) await cancelStudioPlanExecution(task.projectId, execution.id, { clientRequestId: nanoid(), expectedStatus: execution.status }); else if (task.run) await cancelRun(task.run.id); onRefresh(); }
    catch (error) { showFailure({ action: '停止生成', error, next: '状态可能已变化，请刷新页面后重试。' }); } finally { setActing(false); }
  };
  const resume = async () => {
    if (!execution || !resumeLabel) return;
    setActing(true);
    try {
      await resumeStudioPlanExecution(task.projectId, execution.id, { clientRequestId: nanoid(), expectedStatus: execution.status,
        ...(segmentRetry && { retryStepId: segmentRetry.retryStepId, retryAttempt: segmentRetry.retryAttempt }) });
      onRefresh();
    }
    catch (error) { showFailure({ action: resumeLabel, error }); } finally { setActing(false); }
  };
  const download = () => void downloadMedia(urls[result!], task.title, 'video/mp4', result!).catch(error => showFailure({ action: '下载视频', error }));
  const spent = execution?.budgets.reduce((n, b) => n + b.spent, 0) ?? task.run?.cost;
  // Only this task's adopted checks: the run cache also contains previously visited tasks.
  const reviewNotes = [...new Map((execution?.steps ?? []).filter(s => s.operation === 'check' && s.status === 'done').flatMap(step => {
    const check = stepRunCandidates(step).map(id => runs[id]?.output?.check).find(Boolean);
    return (check?.items ?? []).filter(item => item.status !== 'pass' && (item.reason || item.suggestion));
  }).map(item => [`${item.reason}\n${item.suggestion ?? ''}`, item])).values()];
  // 有分镜图就只摆图：视频那一步做好之前只是一个空框，成片出来后整片在上面播（2026-11-07 用户：有图就够了）。没有图的任务（直接出视频）才摆视频。
  const steps = (execution?.steps ?? []).filter(s => s.status !== 'skipped');
  const images = steps.filter(s => s.operation === 'image');
  const media = images.length ? images : steps.filter(s => s.operation === 'video');
  const reached = media.filter(s => s.status !== 'pending');
  // 还没轮到的步骤只在生成中占位；停下来之后不留一排空框。步骤多时只露最近的进度，其余收起。
  const candidates = running ? media : reached;
  const previews = allPreviews || candidates.length <= MAX_PREVIEWS ? candidates
    : running ? [...reached.slice(-(MAX_PREVIEWS - 1)), ...media.filter(s => s.status === 'pending')].slice(0, MAX_PREVIEWS) : reached.slice(-MAX_PREVIEWS);
  const ratio = task.input?.sceneVideoState?.ratio ?? task.request?.configuration?.ratio ?? '9:16';
  const portrait = ratio === '9:16';
  // 状态、进度条和操作在上面，做出来的图在下面（2026-11-07 用户要求）；进度条下面那一行只写已消耗的积分，不折行。
  const actionNote = running ? '可离开此页面，制作将在后台继续。' : spent ? `已消耗 ${spent} 积分` : '';
  return <div className={`video-task-view is-${status}${takes.length > 1 ? ' has-takes' : ''}`}>
    {completed ? <div className="video-final-player"><SignedVideo src={urls[result]} storageKey={result} controls playsInline preload="metadata" aria-label={task.title}/></div>
      : <div className="video-production-head">
        <div className="video-state-heading"><span className={`video-state-symbol${running ? ' is-active' : failed || needsAction ? ' is-problem' : ''}`} aria-hidden="true">{failed || needsAction ? <AlertCircle size={24} strokeWidth={1.35}/> : running ? <AiMark size={22}/> : <Layers size={24} strokeWidth={1.35}/>}</span>
          <h2>{heading}</h2>{portraitReview.length > 0 && <Button onClick={() => void requestPortraitReview(portraitReview)}>处理人像</Button>}
          {retry ? reader(`「${retry.title}」失败，稍后自动重试（第 ${retry.attempt} 次，共 3 次）。`)
            : queuePosition ? reader(`${queuePosition > 1 ? `前面还有 ${queuePosition - 1} 个任务` : '即将开始'} · 已用时 ${elapsed}`)
            : running ? reader([progress, `已用时 ${elapsed}`].filter(Boolean).join(' · ')) : null}
          {needsAction && failureError && <p className="video-problem-note">{videoTaskProblemText(task)}{failed && failed.attempt >= 3 && !resumeLabel && ' 请在画布上查看这一步，处理后继续生成。'}
            {failureError.logId && <StudioErrorNotice error={failure} autoReport={false} label="查看错误详情"/>}</p>}
          {status === 'paused' && reader('已提交的步骤会继续完成。')}
        </div>
        <div className="video-production-tracker" aria-label="生成步骤">{phases.map(phase => <div key={phase.key} data-state={phase.state}><span aria-hidden="true">{phase.state === 'done' ? <Check size={12}/> : phase.state === 'failed' ? '!' : null}</span><strong>{phase.label}</strong></div>)}</div>
        {status !== 'done' && <footer className="video-production-actions">
          <p title={actionNote || undefined}>{actionNote}</p>
          {running ? <button type="button" disabled={acting} onClick={() => void stop()}><Square size={12}/>停止生成</button>
            : resumeLabel ? <div className="video-footer-actions"><Link className="video-task-link" href={videoTaskCanvasHref(task)}>在画布上查看</Link>
              {stoppable && <button type="button" disabled={acting} onClick={() => void stop()}><Square size={12}/>停止生成</button>}
              <button type="button" className="is-primary" disabled={acting} onClick={() => void resume()}>{resumeLabel === '继续生成' ? <Play size={12}/> : <RefreshCw size={12}/>} {resumeLabel}</button></div>
            : <div className="video-footer-actions"><Link className={needsAction ? 'video-task-link is-primary' : 'video-task-link'} href={videoTaskCanvasHref(task)}>在画布上查看<ArrowUpRight size={14} strokeWidth={1.5}/></Link>
              {stoppable && <button type="button" disabled={acting} onClick={() => void stop()}><Square size={12}/>停止生成</button>}</div>}
        </footer>}
      </div>}
    {!completed && !!previews.length && <div className="video-production-stage">
        <div className={`video-production-previews${portrait ? ' is-portrait' : ''}${allPreviews ? ' is-all' : ''}`}>{previews.map(step => {
          const run = stepRunCandidates(step).map(id => runs[id]).find(r => r?.status === 'done');
          const asset = outputKey(run), Placeholder = step.operation === 'image' ? ImageIcon : Film;
          return <figure key={`${step.stage}-${step.id}`} data-state={step.status}><div className={!asset && (step.status === 'running' || step.status === 'submitted') ? 'scene-row-placeholder' : undefined} style={{ aspectRatio: ratio.replace(':', ' / '), '--tile-ratio': ratio.replace(':', ' / ') } as CSSProperties}>{asset ? step.operation === 'image'
            ? <SignedImage src={urls[asset]} storageKey={asset} alt={step.title}/>
            : <SignedVideo src={urls[asset]} storageKey={asset} controls playsInline preload="metadata" aria-label={step.title}/>
            : <><Placeholder size={26} strokeWidth={1.1}/></>}
            {step.status === 'done' && <span className="video-preview-done"><Check size={13}/></span>}</div>
            <figcaption>{media.length > 1 && step.title}<span>{stepStateText(step)}</span></figcaption></figure>;
        })}</div>
        {candidates.length > MAX_PREVIEWS && <button type="button" className="video-preview-more" aria-expanded={allPreviews} onClick={() => setAllPreviews(v => !v)}>{allPreviews ? '收起' : `查看全部（共 ${candidates.length} 项）`}</button>}
      </div>}
    <div className="video-production-bottom">
      {completed && <div className="video-final-actions"><div><h2>视频已完成</h2>{spent !== undefined && <p>本次消耗 {spent} 积分</p>}</div>
        <button type="button" className="is-primary" onClick={download}><Download size={14} strokeWidth={1.6}/>下载视频</button></div>}
      {takes.length > 1 && <VideoTakes takes={takes} current={task.id} onOpen={onOpen}/>}
      {completed && !!reviewNotes.length && <details className="video-quality-notes">
        <summary>AI 检查建议（{reviewNotes.length} 项）</summary>
        <p>成片已保留。以下为 AI 根据采样画面给出的建议，请结合视频判断。</p>
        <ul>{reviewNotes.map((item, i) => <li key={i}><p>{item.reason}</p>{item.suggestion && <p>{item.suggestion}</p>}</li>)}</ul>
      </details>}
      {previewError && <p className="video-connection-note" role="status">部分预览加载失败<button type="button" onClick={() => { setPreviewError(false); onRefresh(); setPoll(n => n + 1); }}>重试</button></p>}
      <div className="video-process-row">
        {!!execution?.steps.length && <button type="button" className="video-process-toggle" aria-expanded={details} onClick={() => setDetails(v => !v)}>{details ? '收起生成记录' : '查看生成记录'}</button>}
        {!needsAction && <Link className="video-process-canvas" href={videoTaskCanvasHref(task)}>在画布上查看<ArrowUpRight size={13} strokeWidth={1.5}/></Link>}
      </div>
      {details && <ol className="video-process-details">{execution?.steps.map(step => <li key={`${step.stage}-${step.id}`}><span>{step.title}</span><span>{stepStateText(step)}{step.attempt > 1 ? ` · 重试 ${step.attempt - 1} 次` : ''}</span>{step.reason && <p>{normalizeStudioError(step.reason).message}</p>}</li>)}</ol>}
    </div>
  </div>;
}

/** 结果区下方：内容相同的几条并排，点哪条看哪条。只读任务列表，不发起任何生成。 */
function VideoTakes({ takes, current, onOpen }: { takes: StudioVideoTask[]; current: string; onOpen: (task: StudioVideoTask) => void }) {
  return <section className="video-takes" aria-label="本批视频">
    <h3>本批视频<span>{takes.length} 条</span></h3>
    <div className="video-takes-list">{takes.map((take, i) => { const tag = takeTag(take);
      return <button type="button" key={take.id} aria-current={take.id === current ? 'true' : undefined}
        title={[`第 ${i + 1} 条 · ${formatDateTime(take.createdAt)}`, tag.detail].filter(Boolean).join('\n')} onClick={() => { if (take.id !== current) onOpen(take); }}>
        <TaskThumb task={take} className="video-take-thumb"/>
        <span>第 {i + 1} 条{tag.label && <i className="video-take-tag">{tag.label}</i>}</span><small data-state={videoTaskStatus(take)}>{videoTaskLabel(take)}</small>
      </button>; })}</div>
  </section>;
}

/**
 * 左侧「本次设置」：按提交时的快照显示，顶上是当时选的场景（和编辑时同一个位置，2026-11-09 用户要求对齐参考站）。
 * 底部两个按钮（2026-11-10 用户要求，取代 11-09 合成一个入口的做法）：「再次生成」把这条的脚本、素材和设置原样放回编辑页，
 * 「裂变生成」打开视频裂变（原样、换变量、AI 改写）。都只新建任务，已有视频都保留。
 */
export function VideoTaskSettings({ task, head, modelName, onMore, onEdit, busy, pending = [], onConfirm }: {
  task: StudioVideoTask; head: ReactNode; modelName?: string;
  /** 打开「视频裂变」（原样、换变量、AI 改写）。没有提交记录的旧任务不给。 */
  onMore?: () => void;
  /** 「再次生成」：把这条的设置放回编辑页。没有保存设置的旧任务不给。 */
  onEdit?: () => void; busy?: boolean;
  /** 这份草稿里提交结果还没确认的请求：同一个请求编号再交一次会拿回原来那次。 */
  pending?: StudioVideoTaskCreate[]; onConfirm?: (request: StudioVideoTaskCreate) => void;
}) {
  const state = task.input?.sceneVideoState, nodes = task.input?.nodes ?? [];
  const reference = nodes.find(n => n.type === 'video');
  const ratio = state?.ratio ?? task.request?.configuration?.ratio;
  const duration = state?.duration ?? task.request?.configuration?.duration;
  const tier = state?.tier ?? task.request?.configuration?.tier;
  const rows: [string, string][] = [...(modelName ? [['模型', modelName] as [string, string]] : []), ...(ratio ? [['画面', ratio] as [string, string]] : []),
    ...(duration ? [['时长', `${duration} 秒`] as [string, string]] : []), ...(tier ? [['清晰度', tier.toUpperCase()] as [string, string]] : [])];
  const tag = takeTag(task);
  // 裂变按提交记录再交，再次生成放回保存的设置：缺哪样就不给哪个按钮。
  const canMore = !!onMore && !!task.request?.configuration;
  const canEdit = !!onEdit && !!task.input;
  return <section className="scene-card video-task-settings" aria-label="本次设置">
    {head}
    <div className="video-task-settings-body">
      <p className="video-task-settings-caption">提交时的设置{tag.label && <span className="video-take-tag" title={tag.detail}>{tag.label}</span>}</p>
      {reference?.metadata?.storageKey && <div className="video-input-reference"><h3>参考视频</h3><SignedVideo storageKey={reference.metadata.storageKey} controls preload="metadata" playsInline aria-label="本次参考视频"/></div>}
      {nodes.some(n => n.type === 'image') && <div><h3>素材</h3><div className="video-input-images">{nodes.filter(n => n.type === 'image').map(n => <figure key={n.id}><SignedImage storageKey={n.metadata?.storageKey} alt={n.title}/><figcaption>{n.title}</figcaption></figure>)}</div></div>}
      {nodes.filter(n => n.type === 'audio').map(n => <div key={n.id}><h3>{n.title || '声音'}</h3><SignedAudio storageKey={n.metadata?.storageKey} controls preload="none" aria-label={n.title || '本次声音'}/></div>)}
      {state && <div className="video-input-brief"><h3>{state.edit ? '脚本' : '补充要求'}</h3><p>{state.edit?.prompt ?? state.text ?? '使用所选素材生成'}</p></div>}
      {!!rows.length && <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value}</dd></div>)}</dl>}
    </div>
    {(canMore || canEdit || pending.length > 0) && <footer>
      {pending.map(request => <p key={request.clientRequestId} className="video-take-pending" role="status">提交结果待确认。
        <button type="button" disabled={busy} onClick={() => onConfirm?.(request)}>确认原任务</button></p>)}
      {(canMore || canEdit) && <div className="video-task-settings-actions">
        {canEdit && <button type="button" className="video-task-regenerate" disabled={busy} onClick={onEdit}><RefreshCw size={15} strokeWidth={1.6}/>再次生成</button>}
        {canMore && <button type="button" className="scene-go is-compact video-more-open" disabled={busy} onClick={onMore}><FissionIcon size={17}/><span>裂变生成</span></button>}
      </div>}
      {(canMore || canEdit) && <p className="video-task-settings-note">新视频和这条在同一批，已生成的视频保留。</p>}
    </footer>}
  </section>;
}
