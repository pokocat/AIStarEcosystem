// 剧本页上每个生成目标（故事大纲 / 分集剧情 / 某一集 / 拆角色场景）当前是什么状态。
//
// 以文档里记着的运行引用为准：runFor(target) 给的是「这个目标最近一次运行」，但集号换过（删集补号）
// 或者引用被清掉之后，它可能是另一件事的旧记录 —— 只有 id 对得上才拿它的细节（失败原因等）。
// 引用在、运行记录还没接回来（刚进页）时，状态先按引用上记的显示。
import type { CanvasRunRef, DramaCanvasRun, DramaCanvasRunStatus } from "@ai-star-eco/types/drama-canvas";

export interface RunView {
  status?: DramaCanvasRunStatus;
  runId?: string;
  /** queued / running */
  pending: boolean;
  /** 还在排队（这时可以停）。 */
  queued: boolean;
  failed: boolean;
  canceled: boolean;
  /** failed 时给用户看的话。 */
  errorMessage?: string;
}

const IDLE: RunView = { pending: false, queued: false, failed: false, canceled: false };

export const DEFAULT_FAILED_MESSAGE = "这次没写出来，积分已退回，可以再试一次。";

export function runView(
  run: DramaCanvasRun | undefined,
  ref: CanvasRunRef | undefined,
  failedFallback: string = DEFAULT_FAILED_MESSAGE,
): RunView {
  if (!ref?.runId) return IDLE;
  const live = run && run.id === ref.runId ? run : undefined;
  const status = live?.status ?? ref.status;
  const failed = status === "failed";
  return {
    status,
    runId: ref.runId,
    pending: status === "queued" || status === "running",
    queued: status === "queued",
    failed,
    canceled: status === "canceled",
    ...(failed ? { errorMessage: live?.errorMessage?.trim() || failedFallback } : {}),
  };
}
