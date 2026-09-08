// ─────────────────────────────────────────────────────────────────────────────
// 视频生成 —— 顶替上游的 `services/api/video.ts`。
//
// 走本仓的通用视频链（服务端 `MaterialVideoJobService`，分区 `ipstudio`），
// **不是** dap 的数字人衍生视频 —— 那条要求先有形象（必须发布之后），
// 而画布上人往往还没发布就想让一张图动起来。
//
// 计费、时长校验、端点白名单、未配置即失败快，都由服务端承担；这里只负责提交与轮询。
// ─────────────────────────────────────────────────────────────────────────────

import { currentProjectId, generateVideo, readVideoJob } from "./api";
import { endpointIdFor } from "./models";
import { inferVideoRatio } from "@/canvas/lib/media-size";
import type { AiConfig } from "./config-store";
import type { UploadedFile } from "./file-storage";
import { GenerationCanceled } from "./generation";

export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string; storageKey?: string };
export type VideoGenerationTask = { id: string; provider: "openai" | "gemini" | "plugin"; model: string };
export type VideoGenerationTaskState =
  | { status: "pending" }
  | { status: "completed"; result: VideoGenerationResult }
  | { status: "failed"; error: string };

export type VideoMediaOptions = {
  seconds?: string;
  aspectRatio?: string;
  model?: string;
  references?: Array<{ storageKey?: string }>;
  /**
   * 画布还会把视频 / 音频参考传进来（它支持多模态参考图）。
   * 本仓的视频链现在只吃首帧图，这两个先收下不用 —— 收着比让调用点报错好，
   * 将来服务端支持了直接在这里接上。
   */
  videos?: unknown[];
  audios?: unknown[];
  signal?: AbortSignal;
};

const POLL_MS = 4000;
/** 视频比出图久得多；上限只防前端无限等，服务端那头有自己的收尾。 */
const POLL_TIMEOUT_MS = 20 * 60_000;

function firstRefKey(options?: VideoMediaOptions): string | undefined {
  return options?.references?.map((r) => r.storageKey).find(Boolean) ?? undefined;
}

/**
 * 视频参数**必须从 config 里读**（v0.176）。
 *
 * 画布是这么调的：`createVideoGenerationTask(config, prompt, images, { signal, videos, audios })`
 * —— 用户在面板上选的清晰度、比例、秒数、模型全都在 **config** 里（`buildGenerationConfig`
 * 已经把「节点上的设置 > 全局设置 > 默认值」合并好了），options 里一个都没有。
 * 而这一层原来只读 options，于是那些选择一路都没送到服务端：
 * 服务端拿不到时长 → 400 `VIDEO_DURATION_REQUIRED`「请提供视频时长」——
 * 用户明明选了，界面还告诉他没选。
 *
 * 上游没这个问题：它那版直接把整个 config 交给厂商 SDK。改成本仓的服务端提交之后
 * 参数要一个个挑出来，就漏了 —— 而 VideoMediaOptions 全是可选字段，类型检查看不出来。
 * options 保留为**显式覆盖**（调用点想临时指定时用），没给就取 config。
 */
function videoParams(config: Partial<AiConfig> | undefined, options?: VideoMediaOptions) {
  const rawSeconds = options?.seconds ?? config?.videoSeconds;
  const seconds = Number(rawSeconds);
  // 比例：面板存的是像素（"720x1280"），服务端要的是比例（"9:16"）。
  // "auto" 表示不指定 —— 交给服务端的默认，不要瞎猜一个塞过去。
  const size = options?.aspectRatio ?? config?.size;
  const ratio = size && size !== "auto" ? inferVideoRatio(size) : "auto";
  return {
    durationSec: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : undefined,
    aspectRatio: ratio === "auto" ? undefined : ratio,
    model: endpointIdFor(options?.model ?? config?.videoModel ?? config?.model),
  };
}

export async function createVideoGenerationTask(
  config: Partial<AiConfig> | undefined,
  prompt: string,
  references: Array<{ storageKey?: string }> = [],
  options?: VideoMediaOptions,
): Promise<VideoGenerationTask> {
  const projectId = currentProjectId();
  if (!projectId) throw new Error("画布还没打开，稍等一下再试");
  const params = videoParams(config, options);
  // 「全能参考」画布给得出来，我们的视频链给不出来 —— 它现在只吃**首帧图**。
  // 照样跑等于把用户选的模式悄悄换成另一个（§8.0），所以直接说清楚。
  if ((config?.videoMode ?? "frames") === "reference") {
    throw new Error("这条视频链现在只支持「首帧模式」——参考图会作为视频第一帧。请在参数面板把模式切回首帧");
  }
  if (!params.durationSec) {
    // 到这一步还没有时长，说明面板的值没传进来 —— 说清楚是哪儿的问题，
    // 别让服务端回一句「请提供视频时长」给一个明明已经选过的用户。
    throw new Error("没读到视频时长，请在参数面板里重新选一次时长后再发送");
  }
  const job = await generateVideo(projectId, {
    prompt,
    refKey: firstRefKey({ ...options, references }),
    ...params,
  });
  return { id: job.id, provider: "plugin", model: options?.model ?? config?.videoModel ?? "" };
}

export async function pollVideoGenerationTask(
  _config: unknown,
  task: VideoGenerationTask,
): Promise<VideoGenerationTaskState> {
  const job = await readVideoJob(task.id);
  if (job.status === "ready" || job.status === "done") {
    if (!job.video_url) return { status: "failed", error: "任务说成了，但没有成片地址" };
    return {
      status: "completed",
      // storageKey 由服务端给：成片已经镜像进我方存储了（视频链的既有纪律：
      // 所有时效产物先镜像再交付），画布只需要引用它。
      result: { url: job.video_url, storageKey: job.video_key, mimeType: "video/mp4" },
    };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.error_message || "视频生成失败，积分已退回" };
  }
  return { status: "pending" };
}

export async function waitForVideoGenerationTask(
  config: unknown,
  task: VideoGenerationTask,
  options?: { signal?: AbortSignal },
): Promise<VideoGenerationResult> {
  const started = Date.now();
  for (;;) {
    if (options?.signal?.aborted) throw new GenerationCanceled();
    const state = await pollVideoGenerationTask(config, task);
    if (state.status === "completed") return state.result;
    if (state.status === "failed") throw new Error(state.error);
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      throw new Error("等太久了，任务可能卡住了。刷新看看，积分会自动退回");
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export async function requestVideoGeneration(
  config: Partial<AiConfig> | undefined,
  prompt: string,
  references: Array<{ storageKey?: string }> = [],
  options?: VideoMediaOptions,
): Promise<VideoGenerationResult> {
  const task = await createVideoGenerationTask(config, prompt, references, options);
  return waitForVideoGenerationTask(config, task, options);
}

/** 上游用它区分「任务失败」与「网络错误」——本仓的失败都带明确文案，一律按任务失败处理。 */
export function isVideoTaskFailed(error: unknown): boolean {
  return error instanceof Error && !(error instanceof GenerationCanceled);
}

/**
 * 成片落存储。
 *
 * <p>**不要在这里重新上传。** 服务端的视频链已经把成片镜像进我方存储了
 * （「所有时效产物先镜像我方存储」是 clip 线定下的纪律），这里拿到的
 * `storageKey` 就是那份镜像。再传一遍不但多花一次钱、多一份对象，而且
 * `/uploads` 只收 JPG/PNG —— MP4 会被直接拒掉，表现成「视频跑成了却存不下来」，
 * 而钱已经扣了。
 */
export async function storeGeneratedVideo(result: VideoGenerationResult): Promise<UploadedFile> {
  if (result.storageKey && result.url) {
    return {
      url: result.url,
      storageKey: result.storageKey,
      bytes: 0,
      mimeType: result.mimeType ?? "video/mp4",
    };
  }
  // 服务端没给 key = 成片没有镜像进我方存储。直接把上游的时效地址存进画布文档，
  // 过几小时就播不了 —— 那不如现在就说清楚。
  throw new Error("成片没有落到我方存储，请联系运维检查视频链的镜像配置");
}
