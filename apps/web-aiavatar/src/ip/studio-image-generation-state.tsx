import { ImagePlus } from 'lucide-react';
import { studioQueueNotice, studioTaskQueued } from '@/canvas-bridge/studio-task-status';

type Task = Parameters<typeof studioTaskQueued>[0];

export function StudioImageGenerationState({ task, confirmed }: { task?: Task; confirmed: boolean }) {
  const queued = studioTaskQueued(task);
  const progress = !queued && confirmed && Number.isFinite(task?.pct)
    ? Math.max(0, Math.min(100, Math.round(task!.pct))) : undefined;
  const title = queued ? '等待生成图片' : confirmed ? '正在生成图片' : '正在确认生成任务';
  const detail = queued ? studioQueueNotice(task?.queue)
    : confirmed ? '可继续编辑画布，完成后图片会自动显示' : '正在确认原任务，请勿重复提交';

  return <div className="studio-flow-image-generating nodrag nopan" role="status" aria-live="polite">
    <div className="studio-flow-generation-visual" aria-hidden="true">
      <span className="studio-flow-generation-orbit"/>
      <span className="studio-flow-generation-icon"><ImagePlus size={28} strokeWidth={1.6}/></span>
    </div>
    <strong>{title}</strong>
    <span className="studio-flow-generation-detail">{detail}</span>
    {progress !== undefined && <div className="studio-flow-generation-progress">
      <div className="studio-flow-generation-track" role="progressbar" aria-label="图片任务进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }}/>
      </div>
      <span className="studio-flow-generation-percent">{progress}%</span>
    </div>}
  </div>;
}
