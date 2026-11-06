'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowUpRight, Check, ChevronRight, Download, Film, Image as ImageIcon, Layers, ListVideo, Plus, RefreshCw, Square, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { IpRun, IpProjectDoc } from '@ai-star-eco/types';
import type { StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
import type { StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
import { videoTask, videoTasks, videoTaskLabel, videoTaskStatus, videoTaskCanvasHref } from '@/canvas-bridge/studio-video-tasks';
import { cancelRun, readRun, readVideoJob, signKeys } from '@/canvas-bridge/api';
import { dialogFocus } from '@/ip/dialog-focus';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { SignedAudio } from '@/canvas-bridge/signed-audio';
import { downloadMedia } from '@/canvas-bridge/download-media';
import { cancelStudioPlanExecution, executionRestoreUpserts, projectCanvasOps, stepNodeId, stepRunCandidates } from '@/canvas-bridge/studio-plan-execution';
import type { CanvasNodeData } from '@/canvas/types/canvas';

export const VIDEO_TASK_SELECTION = 'studio:video:selected-task';
export function videoTaskPhases(task: StudioVideoTask) {
  const groups = [
    { key: 'study', label: '看参考片', match: (s: StudioPlanExecutionStep) => s.operation === 'recreation' },
    { key: 'script', label: '整理分镜', match: (s: StudioPlanExecutionStep) => s.operation === 'text' },
    { key: 'boards', label: '准备画面', match: (s: StudioPlanExecutionStep) => s.operation === 'image' || s.operation === 'check' },
    { key: 'videos', label: task.kind === 'direct' ? '生成视频' : '生成片段', match: (s: StudioPlanExecutionStep) => s.operation === 'video' },
    { key: 'film', label: '合成视频', match: (s: StudioPlanExecutionStep) => s.operation === 'assemble' },
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

/** Data loading never submits work. A stale response cannot replace a more recently selected task. */
export function SceneVideoWorkspace({ enabled, taskId, draftId, sceneId, restoreLastTask, selected, onSelect, onReuse, onDraft, drafts, children, persist }: {
  enabled: boolean; taskId?: string; draftId?: string; sceneId?: string; restoreLastTask?: boolean; selected?: StudioVideoTask;
  onSelect: (task: StudioVideoTask) => void; onReuse: (task: StudioVideoTask) => void;
  onDraft: (id: string) => void; drafts: { id: string; name: string; updatedAt: string }[];
  children: ReactNode;
  persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<unknown>;
}) {
  const [items, setItems] = useState<StudioVideoTask[]>([]), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [railOpen, setRailOpen] = useState(false);
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
      } catch { if (alive) setError('最近任务暂时没读出来'); }
      finally { if (alive) { setLoading(false); timer = setTimeout(read, 10000); } }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // selected is included directly on submission; polling must not restart every time its timestamp changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page, reload]);
  useEffect(() => {
    if (!taskId || !enabled) return;
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await videoTask(taskId);
        if (!alive) return;
        onSelectRef.current(next); setError('');
        setItems(old => [next, ...old.filter(t => t.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch { if (alive) setError('暂时没读到最新状态，正在重新连接。'); }
      finally { if (alive) timer = setTimeout(read, 5000); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [enabled, taskId, reload]);
  const choose = (task: StudioVideoTask) => { setRailOpen(false); onSelect(task); };
  const shown = selected?.id === taskId ? selected : undefined;
  return <>
    <section className="scene-card video-workspace" aria-label="作品">
      <header className="video-workspace-head"><div><strong>作品</strong>{shown && <span>{shown.title}</span>}</div>
        <div>{shown && <Link className="scene-text-button" href={videoTaskCanvasHref(shown)}>在画布中查看<ArrowUpRight size={14}/></Link>}
          <button type="button" className="video-history-toggle" onClick={() => setRailOpen(true)} aria-label="打开最近任务"><ListVideo size={16}/>任务</button></div></header>
      {error && <div className="video-connection-note" role="status">{error}<button type="button" onClick={() => setReload(n => n + 1)}>重试读取</button></div>}
      {taskId && !shown ? <div className="video-task-loading" role="status"><div className="video-loading-frame"/>正在读取这条任务</div>
        : shown ? <VideoTaskView key={shown.id} task={shown} persist={persist} onReuse={() => onReuse(shown)} onRefresh={() => setReload(n => n + 1)}/>
        : children}
    </section>
    {railOpen && <button type="button" className="video-history-backdrop" aria-label="关闭最近任务" onClick={() => setRailOpen(false)}/>}
    <aside className={`scene-card video-task-history${railOpen ? ' is-open' : ''}`} aria-label="最近任务"
      role={railOpen ? 'dialog' : undefined} aria-modal={railOpen || undefined} tabIndex={railOpen ? -1 : undefined}
      ref={railOpen ? dialogFocus : undefined} onKeyDown={event => { if (event.key === 'Escape' && railOpen) { event.preventDefault(); event.stopPropagation(); setRailOpen(false); } }}>
      <header><h2>最近任务</h2><button type="button" className="video-history-close" aria-label="关闭最近任务" onClick={() => setRailOpen(false)}><X size={16}/></button></header>
      <div className="video-task-history-scroll">
        {loading && !items.length && <p role="status">正在读取任务</p>}
        {!loading && !items.length && <p>开始制作后，任务会保存在这里。</p>}
        {items.map(task => <button type="button" className="video-history-item" key={task.id} aria-current={taskId === task.id ? 'true' : undefined} onClick={() => choose(task)}>
          <TaskThumb task={task}/><span><strong>{task.title}</strong><small data-state={videoTaskStatus(task)}>{videoTaskLabel(task)}</small>
            <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time></span>
        </button>)}
        {!!drafts.length && <><h3>未开始 / 草稿</h3>{drafts.filter(d => !items.some(t => t.projectId === d.id)).map(d => <button type="button" className="video-history-draft" key={d.id} onClick={() => { setRailOpen(false); onDraft(d.id); }}><Film size={17}/><span>{d.name}</span><ChevronRight size={13}/></button>)}</>}
      </div>
      {more && <button type="button" className="video-history-more" onClick={() => setPage(n => n + 1)}>查看更多任务<ChevronRight size={13}/></button>}
    </aside>
  </>;
}

function TaskThumb({ task }: { task: StudioVideoTask }) {
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
  return <span className="video-history-thumb">{cover ? <img src={cover} alt="" onError={() => void refreshCover()}/>
    : image ? <SignedImage storageKey={image.metadata!.storageKey!} alt=""/> : <Film size={20} strokeWidth={1.4}/>}</span>;
}

const outputKey = (run?: IpRun) => run?.output?.videoCandidates?.find(c => c.status === 'done')?.storageKey ?? run?.output?.candidates?.[0]?.key ?? run?.output?.storageKey;

function VideoTaskView({ task, persist, onReuse, onRefresh }: {
  task: StudioVideoTask; persist: (mutate: (doc: IpProjectDoc) => IpProjectDoc, projectId?: string) => Promise<unknown>;
  onReuse: () => void; onRefresh: () => void;
}) {
  const [runs, setRuns] = useState<Record<string, IpRun>>({}), [urls, setUrls] = useState<Record<string, string>>({});
  const [acting, setActing] = useState(false), [actionError, setActionError] = useState(''), [details, setDetails] = useState(false);
  const cache = useRef<Record<string, IpRun>>({}), projection = useRef(new Set<string>());
  const execution = task.execution, status = videoTaskStatus(task), phases = videoTaskPhases(task);
  const key = JSON.stringify(execution?.steps.map(s => [s.id, s.status, s.runIds, s.acceptedRunId]) ?? task.run?.id);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = { ...cache.current };
      if (task.run) next[task.run.id] = task.run;
      for (const step of execution?.steps ?? []) for (const id of stepRunCandidates(step)) {
        if (next[id]?.status !== 'done') next[id] = await readRun(id);
      }
      if (!alive) return;
      cache.current = next; setRuns(next);
      const keys = [...new Set(Object.values(next).flatMap(run => outputKey(run) ?? []))];
      if (keys.length) { const signed = await signKeys(keys); if (alive) setUrls(signed); }
      if (!execution) return;
      const fresh = execution.steps.filter(s => s.status === 'done' && !projection.current.has(`${s.id}:${s.acceptedRunId ?? s.runIds.join()}`));
      if (!fresh.length) return;
      const ids = new Set(fresh.map(s => stepNodeId(execution, s)));
      const ops = executionRestoreUpserts(execution, next, ids).map(data => ({ kind: 'node' as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
      if (ops.length) await persist(doc => {
        const result = projectCanvasOps({ nodes: doc.nodes as CanvasNodeData[], connections: doc.connections as never }, ops);
        return { ...doc, nodes: result.doc.nodes as never, connections: result.doc.connections as never };
      }, task.projectId);
      if (alive) fresh.forEach(s => projection.current.add(`${s.id}:${s.acceptedRunId ?? s.runIds.join()}`));
    })().catch(() => { if (alive) setActionError('部分预览暂时没读出来，可以重新读取。'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, task.id, execution?.updatedAt]);
  const mediaSteps = execution?.steps.filter(s => s.operation === 'image' || s.operation === 'video') ?? [];
  const videos = execution?.steps.filter(s => s.operation === 'video') ?? [];
  const final = execution?.steps.find(s => s.operation === 'assemble') ?? (videos.length === 1 ? videos[0] : undefined);
  const finalRun = task.run ?? (final ? stepRunCandidates(final).map(id => runs[id]).find(run => run?.status === 'done') : undefined);
  const result = outputKey(finalRun), completed = status === 'done' && !!result;
  const failed = execution?.steps.find(s => s.status === 'failed' || s.status === 'needs_user');
  const retry = execution?.steps.find(s => s.id === task.retryStepId);
  const active = phases.find(p => p.state === 'running' || p.state === 'failed') ?? phases.find(p => p.state === 'waiting');
  const heading = completed ? '视频已完成' : status === 'done' ? '正在读取视频' : status === 'needs_user' || status === 'failed' || status === 'partial' ? '这一步需要处理'
    : status === 'canceled' ? '已停止制作' : status === 'paused' ? '已暂停' : retry ? '准备再试一次' : active ? `正在${active.label}` : '正在准备制作';
  const stop = async () => {
    setActing(true); setActionError('');
    try { if (execution) await cancelStudioPlanExecution(task.projectId, execution.id, { clientRequestId: nanoid(), expectedStatus: execution.status }); else if (task.run) await cancelRun(task.run.id); onRefresh(); }
    catch { setActionError('没能停止，请重新读取状态后再试。'); } finally { setActing(false); }
  };
  const spent = execution?.budgets.reduce((n, b) => n + b.spent, 0) ?? task.run?.cost;
  return <div className={`video-task-view is-${status}`}>
    {completed ? <div className="video-final-player"><SignedVideo src={urls[result]} storageKey={result} controls playsInline preload="metadata" aria-label={task.title}/></div>
      : <div className="video-production-stage">
        <div className="video-state-heading"><span className="video-state-symbol" aria-hidden="true">{status === 'needs_user' || status === 'failed' ? <AlertCircle size={32} strokeWidth={1.35}/> : <Layers size={32} strokeWidth={1.35}/>}</span>
          <h2>{heading}</h2>
          {retry ? <p role="status">{retry.title}没做成，准备再试一次。第 {retry.attempt}/3 次尝试。</p>
            : status === 'running' && active ? <p role="status">{active.total > 1 ? `${active.done} / ${active.total} ${active.key === 'boards' ? '张' : '步'}完成` : '任务正在后台继续'}</p> : null}
          {failed && <p className="video-problem-note">{failed.attempt >= 3 ? `${failed.title}已尝试 3 次，仍未完成。请到画布查看这一步，处理后继续。` : execution?.needsUserReason || failed.reason} 做好的内容都保留了。</p>}
          {status === 'canceled' && <p>做好的内容已保留，可以在画布中查看。</p>}
        </div>
        {!!mediaSteps.length && <div className="video-production-previews">{mediaSteps.slice(0, 4).map(step => {
          const run = stepRunCandidates(step).map(id => runs[id]).find(r => r?.status === 'done');
          const asset = outputKey(run);
          return <figure key={step.id} data-state={step.status}><div>{asset ? step.operation === 'image'
            ? <SignedImage src={urls[asset]} storageKey={asset} alt={step.title}/>
            : <SignedVideo src={urls[asset]} storageKey={asset} controls playsInline preload="metadata" aria-label={step.title}/>
            : <><ImageIcon size={30} strokeWidth={1.1}/>{(step.status === 'running' || step.status === 'submitted') && <span className="video-stage-motion"/>}</>}
            {step.status === 'done' && <span className="video-preview-done"><Check size={13}/></span>}</div>
            <figcaption>{step.title}<span>{step.status === 'done' ? '已完成' : step.status === 'failed' || step.status === 'needs_user' ? '需处理' : step.status === 'running' || step.status === 'submitted' ? '制作中' : '等待'}</span></figcaption></figure>;
        })}</div>}
      </div>}
    <div className="video-production-bottom">
      {completed && <div className="video-final-actions"><div><h2>视频已完成</h2>{spent !== undefined && <p>本次消耗 {spent} 积分</p>}</div>
        <button type="button" className="is-primary" onClick={() => void downloadMedia(urls[result], task.title, 'video/mp4', result).catch(() => setActionError('下载没有开始，请再试一次。'))}><Download size={15}/>下载视频</button>
        {task.input?.sceneVideoState && <button type="button" onClick={onReuse}>改一版</button>}</div>}
      <div className="video-production-tracker" aria-label="制作步骤">{phases.map(phase => <div key={phase.key} data-state={phase.state}><span aria-hidden="true">{phase.state === 'done' ? <Check size={12}/> : phase.state === 'failed' ? <AlertCircle size={12}/> : null}</span><strong>{phase.label}</strong></div>)}</div>
      <footer><p>{status === 'running' ? '可以离开，任务会继续制作。' : completed ? '视频已保存到这条任务。' : status === 'paused' ? '已提交的步骤会继续完成。' : '做好的内容已保留。'}</p>
        {status === 'running' ? <button type="button" disabled={acting} onClick={() => void stop()}><Square size={12}/>停止制作</button> : status !== 'done' ? <Link className="video-task-primary-link" href={videoTaskCanvasHref(task)}>去画布查看<ArrowUpRight size={14}/></Link> : null}
      </footer>
      {actionError && <p className="video-connection-note" role="status">{actionError}<button type="button" onClick={onRefresh}><RefreshCw size={12}/>重新读取</button></p>}
      <button type="button" className="video-process-toggle" aria-expanded={details} onClick={() => setDetails(v => !v)}>{details ? '收起制作记录' : '查看制作记录'}</button>
      {details && <ol className="video-process-details">{execution?.steps.map(step => <li key={`${step.stage}-${step.id}`}><span>{step.title}</span><span>{step.attempt}/3 次 · {step.status === 'done' ? '已完成' : step.status === 'pending' ? '等待' : step.status === 'running' || step.status === 'submitted' ? '制作中' : step.status === 'skipped' ? '已跳过' : '需处理'}</span>{step.reason && <p>{step.reason}</p>}</li>)}</ol>}
    </div>
  </div>;
}

export function VideoTaskSettings({ task, onNew, onReuse }: { task: StudioVideoTask; onNew: () => void; onReuse: () => void }) {
  const state = task.input?.sceneVideoState, nodes = task.input?.nodes ?? [];
  const reference = nodes.find(n => n.type === 'video');
  return <section className="scene-card video-task-settings" aria-label="本次设置">
    <header><div><h2>{task.title}</h2><p>本次设置</p></div><button type="button" onClick={onNew}><Plus size={13}/>新建</button></header>
    <div className="video-task-settings-body">
      {reference?.metadata?.storageKey && <div className="video-input-reference"><h3>参考视频</h3><SignedVideo storageKey={reference.metadata.storageKey} controls preload="metadata" playsInline aria-label="本次参考视频"/></div>}
      {nodes.some(n => n.type === 'image') && <div><h3>素材</h3><div className="video-input-images">{nodes.filter(n => n.type === 'image').map(n => <figure key={n.id}><SignedImage storageKey={n.metadata?.storageKey} alt={n.title}/><figcaption>{n.title}</figcaption></figure>)}</div></div>}
      {nodes.filter(n => n.type === 'audio').map(n => <div key={n.id}><h3>{n.title || '声音'}</h3><SignedAudio storageKey={n.metadata?.storageKey} controls preload="none" aria-label={n.title || '本次声音'}/></div>)}
      {state && <div className="video-input-brief"><h3>{state.edit ? '脚本' : '补充要求'}</h3><p>{state.edit?.prompt ?? state.text ?? '使用所选素材制作'}</p></div>}
      <dl><div><dt>画面</dt><dd>{state?.ratio ?? task.request?.configuration?.ratio ?? '见制作记录'}</dd></div><div><dt>时长</dt><dd>{state?.duration ?? task.request?.configuration?.duration ?? '—'} 秒</dd></div><div><dt>清晰度</dt><dd>{(state?.tier ?? task.request?.configuration?.tier)?.toUpperCase() ?? '见制作记录'}</dd></div></dl>
    </div>
    <footer>{state && <button type="button" className="is-primary" onClick={onReuse}>用这些设置改一版<ArrowLeft size={14}/></button>}<p>原任务的设置和结果会保留。</p></footer>
  </section>;
}
