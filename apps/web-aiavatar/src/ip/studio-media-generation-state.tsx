import { studioTaskLabel, studioTaskQueued } from '@/canvas-bridge/studio-task-status';

type Task = Parameters<typeof studioTaskQueued>[0];

/**
 * 设计稿 Main 画板 · 生成中的节点：灰底上一个 AI 渐变圆环，下面一行字。
 * 只写真实的东西：排队就写真实位次，跑起来有真实进度就写百分比；不写预计时间（v0.221 规约：不编倒计时 / ETA）。
 */
export function StudioMediaGenerationState({ task, confirmed, media }: { task?: Task; confirmed: boolean; media: 'image' | 'video' }) {
  const label = media === 'video' ? '视频' : '图片';
  const queued = studioTaskQueued(task);
  const progress = !queued && confirmed && Number.isFinite(task?.pct)
    ? Math.max(0, Math.min(100, Math.round(task!.pct!))) : undefined;
  const title = queued ? `等待生成${label}` : confirmed ? `正在生成${label}` : '正在确认生成任务';
  const detail = queued ? studioTaskLabel(task, true) : !confirmed ? '请勿重复提交' : undefined;

  return <div className="studio-flow-media-generating nodrag nopan" role="status" aria-live="polite">
    {progress === undefined ? <span className="studio-flow-generation-ring" aria-hidden="true"/>
      : <span className="studio-flow-generation-ring" role="progressbar" aria-label={`${label}任务进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}/>}
    <span className="studio-flow-generation-line">
      <span>{title}</span>
      {detail && <><span aria-hidden="true"> · </span><span>{detail}</span></>}
      {progress !== undefined && <><span aria-hidden="true"> · </span><span>{progress}%</span></>}
    </span>
  </div>;
}
