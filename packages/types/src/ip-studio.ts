// ─────────────────────────────────────────────────────────────────────────────
// ip-studio.ts — AI IP 工作台类型契约真源（前端 v0.190 起并入 apps/web-aiavatar）。
//
// 设计真源：docs/ip-studio-plan.md §2。server 侧 `com.aistareco.aep.ipstudio.dto.*`
// 的 record 字段名必须与本文件 1:1（AGENTS.md §4.1）。
//
// 画布文档（IpProjectDoc）由客户端拥有、服务端整存整取；运行结果另存 IpRun，
// 避免「前端保存 doc」与「后端写运行产物」互相覆盖。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 画布节点 —— 与画布实现（`apps/web-aiavatar/src/canvas/types/canvas.ts`）同形。
 *
 * v0.157 起画布换成了通用节点：图 / 文字 / 视频 / 音频 / 配置 / 分组，
 * 而不是此前「照片 / 特征卡 / 风格 / 形象卡 / 出图」那套定型节点。
 * **要生成什么写在节点自己的 `metadata.prompt` 里，参考图就是连进来的上游图。**
 *
 * 这里只声明服务端会读到的那部分：服务端整存整取这份文档、不改内容，
 * 只在运行与发布时读 type / metadata / connections。画布自己用的字段（选中态、
 * 历史记录等）不必在这儿重复声明。
 */
export type IpNodeType = "image" | "text" | "video" | "audio" | "config" | "group" | (string & {});

export interface IpPosition { x: number; y: number }
export interface IpViewport { x: number; y: number; k: number }

/** 一张图（候选图集里的一项）。真值是 storageKey，`content` 是出 wire 时派生的签名地址。 */
export interface IpNodeImage {
  id: string;
  storageKey?: string;
  content?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  bytes?: number;
  mimeType?: string;
}

export interface IpNodeMetadata {
  /** 要生成什么 —— 用户自己写的那段话。 */
  prompt?: string;
  /** 节点级的图：真值是 storageKey，`url` 出 wire 时按 key 重签。 */
  storageKey?: string;
  url?: string;
  /** 多候选：`primaryImageId` 指定用哪张。 */
  images?: IpNodeImage[];
  primaryImageId?: string;
  /** 这张图是哪次运行出来的 —— 用来回看当时的提示词与花费。 */
  runId?: string;
  /** 出几张 / 多大 / 用哪个模型（模型 id 来自服务端候选，不是用户填的 Key）。 */
  count?: number;
  size?: string;
  model?: string;
  content?: string;
  [key: string]: unknown;
}

export interface IpNode {
  id: string;
  type: IpNodeType;
  title: string;
  position: IpPosition;
  width: number;
  height: number;
  metadata?: IpNodeMetadata;
}

export interface IpConnection { id: string; fromNodeId: string; toNodeId: string }

/** 画布文档 —— **客户端拥有**：服务端整存整取、不改内容。 */
export interface IpProjectDoc {
  nodes: IpNode[];
  connections: IpConnection[];
  viewport: IpViewport;
}

export type IpRunStatus = "running" | "done" | "failed";
export type IpRunKind = "identity" | "generate";

// width / height 是**出图的真实像素**（服务端从文件头读，不整图解码）。
// 画布拿它算节点尺寸；缺了只能按上限铺成正方形，竖图会被撑成方框。
export interface IpCandidate { key: string; url: string; width?: number; height?: number }
export interface IpRunOutput {
  text?: string;                  // identity：中文特征卡
  promptEn?: string;              // identity：英文身份提示词
  candidates?: IpCandidate[];     // generate：候选图（签名 URL，短期）
}
export interface IpRunInputs {
  prompt?: string;                // generate：实际送入模型的完整英文提示词（透明可查）
  refs?: { role: "master" | "source" | "reference"; note?: string; applied: boolean; reason?: string }[];
  size?: string; count?: number;
}
export interface IpRun {
  id: string; projectId: string; nodeId: string; kind: IpRunKind;
  status: IpRunStatus; stage: string; pct: number;
  cost: number;                   // 实际提交（commit）的积分；running 时为冻结额
  errorCode?: string; errorMessage?: string;
  inputs: IpRunInputs; output: IpRunOutput;
  createdAt: string; finishedAt?: string;
}

export type IpProjectStatus = "draft" | "published";
export interface IpProjectSummary {
  id: string; name: string; templateId?: string; status: IpProjectStatus;
  coverUrl?: string; publishedAvatarId?: string; createdAt: string; updatedAt: string;
}
export interface IpProject extends IpProjectSummary {
  /** 文档指纹 —— 保存时回传，服务端据此判断「我读到的那版还在不在」。 */
  docVersion?: string;
  doc: IpProjectDoc;
  runs: Record<string, IpRun>;    // nodeId → 该节点最近一次运行（服务端投影）
  runsById: Record<string, IpRun>; // runId → 运行；含 runs 全部 + 被 generate 节点 selectedRunId 指向但已非最新的运行
}

export interface IpTemplate {
  id: string; name: string; summary: string; coverUrl?: string;
  stylePresetId?: string; lookCount: number; estimatedCredits: number;
  doc: IpProjectDoc;              // 预排好的节点图（照片 / 参考图为空待填）
}
/**
 * 全局内容的**管理**视图（运营后台 `GET /v1/ip-studio/demos`）。
 *
 * 与 {@link IpTemplate} 的区别：不带 `doc`（整份画布文档几百 KB，管理列表用不上），
 * 但带上目录里看不到的那几样 —— 启不启用、排第几、谁在什么时候发的。
 * `nodeCount` / `assetCount` 是服务端从 doc 现算的概览数字。
 */
export interface IpDemoAdmin {
  id: string; name: string; summary: string;
  kind: "template" | "example";
  enabled: boolean; sortOrder: number;
  coverUrl?: string; sourceProjectId?: string; createdBy?: string;
  createdAt?: string; updatedAt?: string;
  nodeCount: number; assetCount: number;
}

export interface IpStylePreset { id: string; name: string; summary: string; promptEn: string; negativeEn?: string; coverUrl?: string }

/** 内置提示词模板 —— 装扮按性别分（服装品类不同），表情 / 短动作不分。 */
export interface IpPromptPreset { id: string; name: string; gender: "female" | "male" | "any"; prompt: string; durationSec?: number }
export interface IpPromptGroup { id: string; name: string; summary: string; presets: IpPromptPreset[] }

export interface IpPricing { identityCredits: number; imageCredits: number }  // 后台可配，前端展示预估用

// ── 请求体 ───────────────────────────────────────────────────────────────────

export interface IpCreateProjectRequest { name?: string; templateId?: string }
export interface IpUpdateProjectRequest {
  name?: string;
  doc?: IpProjectDoc;
  /**
   * 客户端加载这份文档时的 `updatedAt`。服务端据此拒绝覆盖别处的编辑（多标签页 / 多设备）——
   * 画布文档是整存整取的，覆盖掉的不是一个字段，是那边一整份工作。
   * 冲突时 409 `IP_PROJECT_STALE`。不传 = 不参与并发控制。
   */
  baseDocVersion?: string;
}
export interface IpRunNodeRequest { doc?: IpProjectDoc }   // 运行前顺手保存最新文档（可选，避免「先 PUT 再 POST」竟态）
export interface IpPublishRequest { avatarName: string; masterNodeId: string; lookNodeIds: string[] }
export interface IpPublishResult { avatarId: string; lookIds: string[] }
export interface IpUploadResult { key: string; url: string; width?: number; height?: number; fileName: string }
