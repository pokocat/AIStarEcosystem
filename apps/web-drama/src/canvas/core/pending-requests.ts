// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/pending-requests.ts —— 「未确认请求」表（v0.198，Codex 评审 P1 #1–#3 的统一修法）。
//
// 一次生成从点下去到运行引用存进文档之间，任何一步断掉（响应丢了、离开了页面、保存没成功），钱可能已经冻结、
// 任务可能已经在跑，而文档里没有它的引用 —— 刷新后就找不回来了。所以 core 在发请求**之前**先把
// {幂等键, 请求, 目标, 当时的文档版本} 记进这张表（按画布存 localStorage），运行引用保存成功后才删掉：
//   · 同一目标、同样的请求再点一次（重试）→ 沿用表里的键（服务端按键回原记录，不重复扣费）；
//     判断「同样的请求」只看 kind + 请求体，**不看文档版本**（别的生成完成后文档版本会变，重试不能因此换键）；
//   · 进页时对表里剩下的逐项接回：有运行 id 就直接查，没有就按幂等键 lookup（只查不建）——
//     查到就接回，空数组 = 当初没受理，删掉这一项。**进页绝不重发 POST**（没受理过的请求重发一次 = 用户没点过的扣费）。
//     lookup 为空只说明「查的时候还没查到」（原请求可能还在服务端事务里）：发出不到 10 分钟的先留着、隔一会儿再查，
//     超过 10 分钟仍为空才删；
//   · **不按年龄删**：有运行 id（受理过）的直到运行引用存上才删（或 getRuns 明确说这条不存在 / 画布已删）；
//     没有运行 id 的只在「过了 10 分钟宽限期且 lookup 明确返回 []」时删，lookup 一直失败就一直留着退避再查。
//     防无限增长：每张画布最多 200 项，超出只淘汰最老的、已有运行 id 的项。
// localStorage 读写失败（隐私模式 / 配额满）时这张画布改用内存（见下方「存哪儿」）。
// ─────────────────────────────────────────────────────────────────────────────

import type { CanvasRunRequest } from "./contract";

/**
 * 每张画布最多留几项。超出时只淘汰**最老的、已有明确结论的**项（拿到了运行 id = 知道受理了，只差存引用）；
 * 还没确认受理与否的项一律不淘汰（淘汰它 = 可能丢掉一笔已付费任务的接回入口）。
 */
export const PENDING_MAX_ITEMS = 200;
/** lookup 查不到时，发出不到这么久的项先留着再查（原请求可能还在服务端事务里没提交）。 */
export const PENDING_LOOKUP_GRACE_MS = 10 * 60 * 1000;
const PREFIX = "drama-canvas-pending:";

export interface PendingRequest {
  clientRequestId: string;
  kind: CanvasRunRequest["kind"];
  body: unknown;
  /** 去重用的槽位：单条 = 目标；批量 = 「batch:」+ 各项目标。 */
  slot: string;
  /** kind + 请求体的规范化 JSON（不含文档版本）。 */
  sig: string;
  targets: string[];
  /** 发这次请求时的文档版本（只作记录；接回走 lookup，不重发）。 */
  docVersion: string;
  createdAt: number;
  /** 收到了运行记录（但运行引用还没存进文档）。 */
  runIds?: string[];
}

// 存哪儿（Codex 复审 N2 / N4）：
//   · localStorage 能用时它是**唯一真值**：读到 null = 已经被删了（可能是别的标签页接回后删的），不回落内存；
//   · 某张画布一旦写失败（配额满 / 隐私模式）就进「内存模式」：之后这张画布读写都只用内存，
//     不再读 storage 里那份旧的（否则写不进去的新项会被旧值盖掉，原键就丢了）；
//   · storage 正常时每次读 / 写成功都把结果同步进内存快照（读到 null 就清空快照，保住上一条）：
//     之后 storage 突然读不了、切进内存模式时，已经登记的键还在，重试照样沿用原键；
//   · storage 完全不可用时各标签页的内存互不相通 —— **跨标签页不去重**，只保证同一页会话内沿用原键。
const memory = new Map<string, PendingRequest[]>();
const memoryMode = new Set<string>();

function isItem(v: unknown): v is PendingRequest {
  const o = v as Partial<PendingRequest> | null;
  return (
    !!o &&
    typeof o.clientRequestId === "string" &&
    typeof o.kind === "string" &&
    typeof o.slot === "string" &&
    typeof o.sig === "string" &&
    typeof o.docVersion === "string" &&
    typeof o.createdAt === "number" &&
    Array.isArray(o.targets)
  );
}

function rawRead(canvasId: string): PendingRequest[] {
  if (memoryMode.has(canvasId)) return memory.get(canvasId) ?? [];
  try {
    const raw = window.localStorage.getItem(PREFIX + canvasId);
    if (raw === null) {
      memory.delete(canvasId); // 共享记录已被删（可能是别的标签页）：快照跟着清
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter(isItem) : [];
    memory.set(canvasId, list);
    return list;
  } catch {
    // 读都读不了：这张画布改用内存
    memoryMode.add(canvasId);
    return memory.get(canvasId) ?? [];
  }
}

function rawWrite(canvasId: string, list: PendingRequest[]): void {
  if (!memoryMode.has(canvasId)) {
    try {
      if (list.length) window.localStorage.setItem(PREFIX + canvasId, JSON.stringify(list));
      else window.localStorage.removeItem(PREFIX + canvasId);
      if (list.length) memory.set(canvasId, list);
      else memory.delete(canvasId);
      return;
    } catch {
      memoryMode.add(canvasId); // 写不进去：从现在起这张画布只认内存（内存里是最新的完整一份）
    }
  }
  memory.set(canvasId, list);
}

/** 读这张画布的未确认请求（不按年龄删，见头注释）。 */
export function readPending(canvasId: string): PendingRequest[] {
  return rawRead(canvasId);
}

/** 超过上限时淘汰最老的、已有运行 id 的项；没确认的不动（宁可超一点，不丢接回入口）。 */
function capped(list: PendingRequest[]): PendingRequest[] {
  if (list.length <= PENDING_MAX_ITEMS) return list;
  const evictable = list
    .filter((e) => e.runIds?.length)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, list.length - PENDING_MAX_ITEMS)
    .map((e) => e.clientRequestId);
  if (!evictable.length) return list;
  const drop = new Set(evictable);
  return list.filter((e) => !drop.has(e.clientRequestId));
}

export function upsertPending(canvasId: string, item: PendingRequest): void {
  const list = rawRead(canvasId).filter((e) => e.clientRequestId !== item.clientRequestId);
  rawWrite(canvasId, capped([...list, item]));
}

export function patchPending(canvasId: string, clientRequestId: string, patch: Partial<PendingRequest>): void {
  const list = rawRead(canvasId);
  if (!list.some((e) => e.clientRequestId === clientRequestId)) return;
  rawWrite(
    canvasId,
    list.map((e) => (e.clientRequestId === clientRequestId ? { ...e, ...patch } : e)),
  );
}

export function removePending(canvasId: string, clientRequestId: string): void {
  const list = rawRead(canvasId);
  if (!list.some((e) => e.clientRequestId === clientRequestId)) return;
  rawWrite(
    canvasId,
    list.filter((e) => e.clientRequestId !== clientRequestId),
  );
}

/** 测试用。 */
export function __resetPendingForTest(): void {
  memory.clear();
  memoryMode.clear();
}

// ── 请求 → 目标 / 槽位 / 签名 ────────────────────────────────────────────────

type ImageTargetLike = { kind: "look" | "scene" | "material"; id: string } | { kind: "segment"; episodeNo: number; segmentId: string };

function imageTargetKey(t: ImageTargetLike): string {
  return t.kind === "segment" ? `frame:${t.episodeNo}:${t.segmentId}` : `${t.kind}:${t.id}`;
}

/** 这次请求会产出哪些运行目标（和服务端的 DramaCanvasRunTarget 同一套写法）。 */
export function targetsOf(req: CanvasRunRequest): string[] {
  switch (req.kind) {
    case "script": {
      const b = req.body;
      return [b.stage === "episode" ? `script:episode:${b.episodeNo ?? 0}` : `script:${b.stage}`];
    }
    case "extract":
      return ["extract"];
    case "image":
      return [imageTargetKey(req.body.target)];
    case "image-batch":
      return req.body.items.map((it) => imageTargetKey(it.target));
    case "storyboard":
      return [`storyboard:${req.body.episodeNo}`];
    case "video":
      return [`video:${req.body.episodeNo}:${req.body.segmentId}`];
    case "assemble":
      return [`assemble:${req.body.episodeNo}`];
  }
}

export function slotOf(req: CanvasRunRequest, targets: string[] = targetsOf(req)): string {
  return req.kind === "image-batch" ? `batch:${targets.join("|")}` : targets[0];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** kind + 请求体的规范化签名（键序无关、不含文档版本）。 */
export function sigOf(req: CanvasRunRequest): string {
  return `${req.kind}:${canonical(req.body)}`;
}
