import { CircleAlert } from 'lucide-react';
import { studioImageReviewNotice, studioTaskLabel, studioTaskNeedsReview, studioTaskQueued } from '@/canvas-bridge/studio-task-status';

type Task = Parameters<typeof studioTaskQueued>[0];

/**
 * 设计稿 Main 画板 · 生成中的节点：灰底上一个 AI 渐变圆环，下面一行字。
 * 图片仅显示阶段，未知受理显示待核对；视频有真实进度才写百分比。不编预计时间。
 */
export function StudioMediaGenerationState({ task, confirmed, media }: { task?: Task; confirmed: boolean; media: 'image' | 'video' }) {
  const label = media === 'video' ? '视频' : '图片';
  const queued = studioTaskQueued(task);
  const review = studioTaskNeedsReview(task);
  const progress = media !== 'image' && !review && !queued && confirmed && Number.isFinite(task?.pct)
    ? Math.max(0, Math.min(100, Math.round(task!.pct!))) : undefined;
  const imageTitle = task?.stage?.startsWith('image.') || task?.stage === 'storage.persist' ? studioTaskLabel(task) : '正在生成图片';
  const title = review ? '受理结果待核对' : queued ? `等待生成${label}` : confirmed ? media === 'image' ? imageTitle : `正在生成${label}` : '正在确认生成任务';
  const detail = queued ? studioTaskLabel(task, true) : !confirmed ? '请勿重复提交' : undefined;

  return <div className="studio-flow-media-generating nodrag nopan" role="status" aria-live="polite">
    {review ? <CircleAlert size={28} aria-hidden="true"/> : progress === undefined ? <span className="studio-flow-generation-ring" aria-hidden="true"/>
      : <span className="studio-flow-generation-ring" role="progressbar" aria-label={`${label}任务进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}/>}
    <span className="studio-flow-generation-line">
      <span>{title}</span>
      {detail && <><span aria-hidden="true"> · </span><span>{detail}</span></>}
      {progress !== undefined && <><span aria-hidden="true"> · </span><span>{progress}%</span></>}
    </span>
    {review && <p className="studio-flow-generation-review">{studioImageReviewNotice}</p>}
  </div>;
}
