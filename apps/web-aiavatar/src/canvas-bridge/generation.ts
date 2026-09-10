// ─────────────────────────────────────────────────────────────────────────────
// 生成调用层 —— 顶替上游的 `services/api/image.ts`（那 921 行是「浏览器拿用户填的
// API Key 直连模型厂商」）。本仓：模型端点配在后台、积分服务端 hold/commit、产物只落 OSS，
// 所以整层换成调我们自己的服务端。
//
// 画布不用改：它只认这三个函数的签名。
// ─────────────────────────────────────────────────────────────────────────────

import type { AiConfig } from "./config-store";
import { endpointIdFor } from "./models";
import { rememberUploaded } from "./image-storage";
import { recordRun } from "./last-run";
import { cancelRun, generate, readRun, currentProjectId, type IpRun } from "./api";
import { mimeFromKey } from "./download-media";

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

export type RequestOptions = {
  signal?: AbortSignal;
  /**
   * 服务端一受理就把运行号交出来（在等结果之前）。
   *
   * 出图是「已经受理、可能已经开始扣费」的动作，而它要跑几十秒。此前 runId 只活在
   * 这个函数的栈里 —— 刷新 / 关标签页 / 网断，产物就此隐形：服务端跑完、扣了钱、
   * 图躺在 `ip_run.output.candidates` 里没人认领（v0.163 记过的那类事故）。
   * 调用方拿到它写进节点，进画布时就能接着轮询（见 {@link resumeRun}）。
   */
  onAccepted?: (runId: string) => void;
};

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

/**
 * **服务端明确说这次运行结束了**（status=failed，冻结额已按规则释放）。
 *
 * 为什么要单独一个类型：运行号是「这张图还有未了结的事」的唯一凭据，
 * 调用点只有在**运行真的结束**时才可以把它丢掉。网络抖动、前端等超时、用户取消
 * 都不是结束 —— 那时候丢掉运行号，服务端跑完的那张图就永远没人认领了
 * （钱已经扣了）。默认站在「还没结束」这一边。
 */
export class RunFailed extends Error {
  readonly runId: string;
  constructor(runId: string, message: string) {
    super(message);
    this.name = "RunFailed";
    this.runId = runId;
  }
}

/** 这个错误代表「那次运行已经结束」吗？只有服务端说 failed 才算。 */
export function isRunEnded(error: unknown): boolean {
  return error instanceof RunFailed;
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
      // 失败这一次同样要留下「发出去的是什么」—— 排查失败原因时最需要看的就是它
      recordRun(run);
      // 服务端已经退过冻结，这里只负责把话说清楚 —— 不吞、不改写成「成功但没图」。
      // 用 RunFailed（而不是普通 Error）：调用点据此知道「这次运行结束了，运行号可以丢」。
      throw new RunFailed(runId, run.errorMessage || "生成失败，请稍后再试");
    }
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      // 别在这儿承诺退款：**前端等超时不等于服务端结束**。那头要么还在跑，要么真的卡住了
      // （由 IpRunReaper 按心跳超时释放冻结）—— 而已经出好的那几张是照价结算的，不退。
      // 所以只给运行号，让人查得到。
      throw new Error(`等太久了（运行号 ${runId}）。这次运行可能还在服务端跑，把运行号报给运维可以查到它的结果；真卡住时冻结的积分由服务端释放`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/**
 * 用户点了「停止」→ 顺手告诉服务端一声。
 *
 * <p>此前「停止」只是 `controller.abort()`：前端不看了，服务端继续把剩下的张数跑完、
 * 逐张 commit 扣费。`POST /runs/{id}/cancel` 一直存在却没有任何调用者。
 *
 * <p>能取消到什么程度由服务端定，界面不许多说：worker 在**每张开跑之前**查一次
 * `cancelRequested`，所以**已经进厂商调用的那些会跑完并计费**，取消释放的是还没开始的部分。
 *
 * <p>注意是「那些」而不是「那一张」：画布出 N 张图是 **N 次并发的 count=1 运行**
 * （见 project.tsx 的图片分支），点一次停止会给每一条都发取消 —— 其中已经进厂商调用的
 * 可能不止一条。所以文案只能说「已经开始的那些会跑完并计费，实际结算以运行记录为准」，
 * 不能承诺只有一张计费。
 *
 * <p>best-effort：取消请求本身失败只记日志 —— 用户点的是「我不等了」，
 * 不该因为这条附带请求失败而看到一个红色报错。
 */
function cancelOnAbort(runId: string, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const onAbort = () => {
    void cancelRun(runId).catch((e: unknown) => {
      console.warn("[ipstudio] 取消运行没送到服务端，它可能会把剩下的张数跑完", runId, e);
    });
  };
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}

function toImages(run: IpRun): GeneratedImage[] {
  const out: GeneratedImage[] = [];
  for (const c of run.output?.candidates ?? []) {
    if (!c.key || !c.url) continue;
    // 类型按**服务端给的 key** 来，别一律写 image/png：服务端 v0.184 起落库时按字节
    // 改正过后缀（厂商常返回 JPEG），而这里写死会让文档里留下「key 是 .jpg、
    // mimeType 写着 image/png」的自相矛盾 —— 线上那条官方示例就是这样，
    // 下载时按它取名就会下出一个打不开的 .png。
    const mime = mimeFromKey(c.key) ?? "image/png";
    const img: GeneratedImage = {
      dataUrl: c.url, storageKey: c.key,
      width: c.width ?? 0, height: c.height ?? 0, bytes: 0, mimeType: mime,
    };
    // 图已经在 OSS 上了。画布随后会拿 dataUrl 去调 uploadImage —— 记一笔，
    // 让那次调用直接命中已有产物，而不是把同一张图下载下来再传一遍。
    rememberUploaded(c.url, { url: c.url, storageKey: c.key, width: img.width, height: img.height, bytes: 0, mimeType: mime });
    out.push(img);
  }
  if (!out.length) {
    // 别替服务端承诺退款：运行是 done 的时候费用已经结算了（这句话此前一直在骗人）。
    // 真正退款的是 failed 分支，那条走的是 run.errorMessage。
    throw new Error(`这次运行没有返回图片（运行号 ${run.id}）—— 把这个号报给运维可以查到原因`);
  }
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
    // 下拉里选的是**模型名**（agnes-image…），服务端认的是 endpointId。
    // 翻不出来就不传 —— 服务端走后台配的默认端点。指定了却悄悄换一个才是不允许的（D-11）。
    //
    // 顺序必须是 model 在前：`buildGenerationConfig` 把「节点上选的 > 全局默认」
    // 合并后放在 **model** 里，而 `imageModel` 永远是全局默认（loadServerModels 灌的）。
    // 反过来写（此前就是 `imageModel || model`）等于**节点选 B、实际跑 A**：
    // 下拉里选中的是 B，服务端按 A 执行并按 A 的单价扣费（单价是后台按端点配的，
    // `creditCostOverride` 可以让两个模型价格不同）。**注意**：界面上目前并没有显示单价
    // —— `creditCostFor` 还没有调用者，所以用户看不到差价，只会发现出来的图不像那个模型
    // （对着账本才对得出来）。`imageModel` 只作为「调用方传的是原始全局 config」时的回落；
    // 用 `||` 而不是 `??` —— 空串也要跳过（后台一个候选都没配时就是空串）。
    model: endpointIdFor(config.model || config.imageModel),
  });
  options?.onAccepted?.(run.id);
  const detach = cancelOnAbort(run.id, options?.signal);
  try {
    const done = await waitForRun(run.id, options?.signal);
    // 先记下真实入参再解图：即使这次没返回候选，顶栏也能告诉用户刚才发出去的是什么
    recordRun(done);
    return toImages(done);
  } finally {
    detach();
  }
}

/**
 * 接回一次**已经受理**的出图。
 *
 * <p>用在「刷新 / 换设备之后画布上还挂着 loading 的候选」上：那次运行的 runId 已经写进
 * 节点（`metadata.images[].runId`，契约里的 `IpNodeMetadata.runId`），这里只是接着轮询。
 *
 * <p><b>绝不重发请求</b>：重发就是再扣一次钱。只读 `GET /runs/{id}`。
 */
export async function resumeRun(runId: string, options?: RequestOptions): Promise<GeneratedImage[]> {
  if (options?.signal?.aborted) throw new GenerationCanceled();
  const detach = cancelOnAbort(runId, options?.signal);
  try {
    const done = await waitForRun(runId, options?.signal);
    recordRun(done);
    return toImages(done);
  } finally {
    detach();
  }
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
