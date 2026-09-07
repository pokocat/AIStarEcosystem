// ─────────────────────────────────────────────────────────────────────────────
// 生成调用层 —— 顶替上游的 `services/api/image.ts`（那 921 行是「浏览器拿用户填的
// API Key 直连模型厂商」）。本仓：模型端点配在后台、积分服务端 hold/commit、产物只落 OSS，
// 所以整层换成调我们自己的服务端。
//
// 画布不用改：它只认这三个函数的签名。
// ─────────────────────────────────────────────────────────────────────────────

import type { AiConfig } from "./config-store";
import { rememberUploaded } from "./image-storage";
import { generate, readRun, currentProjectId, type IpRun } from "./api";

/** 上游的多模态消息形状，画布拼「带图对话」用。保持同名同形，调用点不用改。 */
export type AiTextMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

export type ReferenceImage = {
  id?: string;
  name?: string;
  type?: string;
  dataUrl?: string;
  url?: string;
  storageKey?: string;
};

export type RequestOptions = { signal?: AbortSignal };

/** 画布拿到的一张成图。dataUrl 里放的是签名地址 —— 画布只把它当 img src 用。 */
export type GeneratedImage = {
  dataUrl: string;
  storageKey: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
};

/** 用户主动取消时抛这个，调用点靠它区分「取消」和「失败」。 */
export class GenerationCanceled extends Error {
  constructor() {
    super("已取消");
    this.name = "GenerationCanceled";
  }
}

const POLL_MS = 1500;
/** 兜底上限：worker 那头有 reaper 收尾，这里只防前端无限等下去。 */
const POLL_TIMEOUT_MS = 8 * 60_000;

async function waitForRun(runId: string, signal?: AbortSignal): Promise<IpRun> {
  const started = Date.now();
  for (;;) {
    if (signal?.aborted) throw new GenerationCanceled();
    const run = await readRun(runId);
    if (run.status === "done") return run;
    if (run.status === "failed") {
      // 服务端已经退过冻结，这里只负责把话说清楚 —— 不吞、不改写成「成功但没图」
      throw new Error(run.errorMessage || "生成失败，请稍后再试");
    }
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      throw new Error("等太久了，任务可能卡住了。刷新看看，积分会自动退回");
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function toImages(run: IpRun): GeneratedImage[] {
  const out: GeneratedImage[] = [];
  for (const c of run.outputs?.candidates ?? []) {
    if (!c.key || !c.url) continue;
    const img: GeneratedImage = {
      dataUrl: c.url, storageKey: c.key,
      width: 0, height: 0, bytes: 0, mimeType: "image/png",
    };
    // 图已经在 OSS 上了。画布随后会拿 dataUrl 去调 uploadImage —— 记一笔，
    // 让那次调用直接命中已有产物，而不是把同一张图下载下来再传一遍。
    rememberUploaded(c.url, { url: c.url, storageKey: c.key, width: 0, height: 0, bytes: 0, mimeType: "image/png" });
    out.push(img);
  }
  if (!out.length) throw new Error("这次没有出图，积分已退回");
  return out;
}

function refKeysOf(references: ReferenceImage[] | undefined): string[] {
  return (references ?? []).map((r) => r.storageKey).filter((k): k is string => !!k);
}

/** 纯文生图。 */
export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
  return requestEdit(config, prompt, [], options);
}

/** 图生图 / 文生图统一走这条 —— 服务端按有没有参考图自己决定怎么调模型。 */
export async function requestEdit(
  config: AiConfig,
  prompt: string,
  references: ReferenceImage[],
  options?: RequestOptions,
): Promise<GeneratedImage[]> {
  const projectId = currentProjectId();
  if (!projectId) throw new Error("画布还没打开，稍等一下再试");
  if (options?.signal?.aborted) throw new GenerationCanceled();

  const run = await generate(projectId, {
    prompt,
    refKeys: refKeysOf(references),
    count: Math.max(1, Math.min(4, Number(config.count) || 1)),
    size: config.size,
    model: config.imageModel || config.model || undefined,
  });
  return toImages(await waitForRun(run.id, options?.signal));
}

/**
 * 看图说话（画布的「问这张图」）。
 *
 * 本仓还没开这条 —— §8.0：不能拿一段编出来的话冒充模型输出。
 * 接的时候在这里调服务端的多模态 chat。
 */
export async function requestImageQuestion(
  _config: AiConfig,
  _messages: AiTextMessage[],
  _onDelta: (text: string) => void,
  _options?: RequestOptions,
): Promise<string> {
  throw new Error("看图对话还没开通");
}
