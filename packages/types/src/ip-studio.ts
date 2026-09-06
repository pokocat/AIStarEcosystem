// ─────────────────────────────────────────────────────────────────────────────
// ip-studio.ts — AI IP 工作台（apps/web-ipstudio）类型契约真源。
//
// 设计真源：docs/ip-studio-plan.md §2。server 侧 `com.aistareco.aep.ipstudio.dto.*`
// 的 record 字段名必须与本文件 1:1（AGENTS.md §4.1）。
//
// 画布文档（IpProjectDoc）由客户端拥有、服务端整存整取；运行结果另存 IpRun，
// 避免「前端保存 doc」与「后端写运行产物」互相覆盖。
// ─────────────────────────────────────────────────────────────────────────────

export type IpNodeType =
  | "source"      // 用户照片（身份来源）
  | "identity"    // 人物特征卡（AI 抽取 / 手写，中文可读 + 英文提示词）
  | "style"       // 风格预设（内置 6 套或自定义）
  | "look"        // 形象卡（服装 / 姿势 / 表情 / 细节 / 道具）
  | "generate"    // 生成节点（出 N 张候选，选一张；可标记为主形象）
  | "reference"   // 局部参考图（如「帽子款式参考图 2」）
  | "publish";    // 发布到资产库

export interface IpPosition { x: number; y: number }

export interface IpSourceData   { assetKey?: string; imageUrl?: string; fileName?: string; width?: number; height?: number }
export interface IpIdentityData { text: string; promptEn: string; locked: boolean; fromRunId?: string }
export interface IpStyleData    { presetId?: string; name: string; promptEn: string; negativeEn?: string; custom: boolean }
export interface IpLookData     { title: string; outfit: string; pose: string; expression: string; details: string; props?: string }
export interface IpGenerateData {
  count: 1 | 2 | 4;
  size: "768x1024" | "1024x1024" | "768x1365";
  isMaster: boolean;              // 主形象：其选中图成为下游所有 generate 的身份锁参考
  selectedRunId?: string;         // 用户选定的候选来自哪次运行
  selectedIndex?: number;         // 选定候选下标
}
export interface IpReferenceData { assetKey?: string; imageUrl?: string; note: string }
export interface IpPublishData   { avatarName: string; avatarId?: string; publishedAt?: string }

export type IpNodeData =
  | { type: "source"; data: IpSourceData }
  | { type: "identity"; data: IpIdentityData }
  | { type: "style"; data: IpStyleData }
  | { type: "look"; data: IpLookData }
  | { type: "generate"; data: IpGenerateData }
  | { type: "reference"; data: IpReferenceData }
  | { type: "publish"; data: IpPublishData };

export type IpNode = IpNodeData & { id: string; position: IpPosition; label?: string };
export interface IpEdge { id: string; source: string; target: string }
export interface IpViewport { x: number; y: number; zoom: number }

/** 画布文档 —— 客户端拥有；服务端整存整取、不改内容（运行结果另存 IpRun，避免并发覆盖）。 */
export interface IpProjectDoc { nodes: IpNode[]; edges: IpEdge[]; viewport: IpViewport }

export type IpRunStatus = "running" | "done" | "failed";
export type IpRunKind = "identity" | "generate";

export interface IpCandidate { key: string; url: string }
export interface IpRunOutput {
  text?: string;                  // identity：中文特征卡
  promptEn?: string;              // identity：英文身份提示词
  candidates?: IpCandidate[];     // generate：候选图（签名 URL，短期）
}
export interface IpRunInputs {
  prompt?: string;                // generate：实际送入模型的完整英文提示词（透明可查）
  refs?: { role: "master" | "source" | "reference"; applied: boolean; reason?: string }[];
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
  doc: IpProjectDoc;
  runs: Record<string, IpRun>;    // nodeId → 该节点最近一次运行（服务端投影）
  runsById: Record<string, IpRun>; // runId → 运行；含 runs 全部 + 被 generate 节点 selectedRunId 指向但已非最新的运行
}

export interface IpTemplate {
  id: string; name: string; summary: string; coverUrl?: string;
  stylePresetId?: string; lookCount: number; estimatedCredits: number;
  doc: IpProjectDoc;              // 预排好的节点图（照片 / 参考图为空待填）
}
export interface IpStylePreset { id: string; name: string; summary: string; promptEn: string; negativeEn?: string; coverUrl?: string }

export interface IpPricing { identityCredits: number; imageCredits: number }  // 后台可配，前端展示预估用

// ── 请求体 ───────────────────────────────────────────────────────────────────

export interface IpCreateProjectRequest { name?: string; templateId?: string }
export interface IpUpdateProjectRequest { name?: string; doc?: IpProjectDoc }
export interface IpRunNodeRequest { doc?: IpProjectDoc }   // 运行前顺手保存最新文档（可选，避免「先 PUT 再 POST」竟态）
export interface IpPublishRequest { avatarName: string; masterNodeId: string; lookNodeIds: string[] }
export interface IpPublishResult { avatarId: string; lookIds: string[] }
export interface IpUploadResult { key: string; url: string; width?: number; height?: number; fileName: string }
