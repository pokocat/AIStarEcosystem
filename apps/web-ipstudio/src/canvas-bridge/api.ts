// 画布 → 本仓服务端的调用层（薄封装）。
//
// 所有请求都走 @ai-star-eco/api-client 的 apiFetch：它带 JWT、带 X-App-Code
// （EnrollmentGuard 少了这个头直接 403 APP_CODE_REQUIRED）、还带账号中心的令牌续期重试。
// 这里不要自己拼 fetch。

import { apiFetch } from "@ai-star-eco/api-client";

export type IpModelOption = {
  endpointId: string;
  name: string;
  isDefault: boolean;
  capability: { maxRefImages?: number | null } | null;
  creditCost: number;
  billingUnit: string;
};

export type IpModels = { image: IpModelOption[]; video: IpModelOption[] };

export type IpUploadResult = {
  key: string;
  url: string;
  width?: number;
  height?: number;
  fileName: string;
};

export type IpRunStatus = "running" | "done" | "failed";

export type IpRun = {
  id: string;
  projectId: string;
  nodeId: string;
  status: IpRunStatus;
  cost: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  outputs?: { candidates?: Array<{ key: string; url: string }> } | null;
};

/**
 * 画布上的模型下拉。候选来自后台配好的端点，**不是用户填的 Key**。
 * 一个都没配时是空数组 —— 前端据此提示「尚未开通」并禁用生成，不假装能跑（§8.0）。
 */
export const fetchModels = () => apiFetch<IpModels>("/v1/ip-studio/models");

/** 上传一张图，落 OSS。返回的 key 是真值，url 是当次派生的签名地址。 */
export function uploadImage(file: File | Blob, fileName = "image.png") {
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], fileName));
  // apiFetch 认得 FormData：不设 Content-Type，让浏览器自己加 boundary
  return apiFetch<IpUploadResult>("/v1/ip-studio/uploads", { method: "POST", body: form });
}

/**
 * 按存储键换一批新的签名地址。
 *
 * 签名有 TTL（默认一小时），而画布是一开就是半天的工具 —— 图在编辑途中过期，
 * 用户看到的是一片破图。前端发现加载失败时拿 key 回来重签。
 */
export const signKeys = (keys: string[]) =>
  apiFetch<Record<string, string>>("/v1/ip-studio/assets/sign", {
    method: "POST",
    body: { keys },
  });

/**
 * 当前打开的是哪个项目。
 *
 * 画布的生成函数签名里没有 projectId（上游是本地工具，没有这个概念），
 * 改那 5 个调用点会让以后跟上游合并变难 —— 所以由路由在打开画布时告诉这里。
 */
let openProjectId: string | null = null;
export const setCurrentProjectId = (id: string | null) => { openProjectId = id; };
export const currentProjectId = () => openProjectId;

export type IpGenerateRequest = {
  nodeId?: string;
  prompt: string;
  refKeys?: string[];
  count?: number;
  size?: string;
  model?: string;
};

/** 画布出图：参考图由画布点名，服务端管归属闸、提示词模板、模型白名单、计价与结算。 */
export const generate = (projectId: string, req: IpGenerateRequest) =>
  apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/generate`, {
    method: "POST",
    body: req,
  });

export type IpVideoRequest = {
  prompt: string;
  refKey?: string;
  durationSec?: number;
  aspectRatio?: string;
  model?: string;
};

/** 画布出视频 —— 走通用视频链，不依赖数字人形象。返回一张「渲染中」的任务卡。 */
export const generateVideo = (projectId: string, req: IpVideoRequest) =>
  apiFetch<IpVideoJob>(
    `/v1/ip-studio/projects/${encodeURIComponent(projectId)}/generate-video`,
    { method: "POST", body: req },
  );

/** 视频任务状态（与带货 / 短剧同一张表，按 app 分区隔离）。 */
export type IpVideoJob = {
  id: string; status: string;
  video_url?: string;
  /** 成片在我方存储里的 key —— 服务端镜像后给出，画布引用它而不是重新上传。 */
  video_key?: string;
  thumbnail_url?: string; error_message?: string;
};

export const readVideoJob = (jobId: string) =>
  apiFetch<IpVideoJob>(
    `/me/material/videos/jobs/${encodeURIComponent(jobId)}`, { query: { app: "ipstudio" } },
  );

/** 跑一个节点。服务端整存整取地收下最新画布，再按这个节点编译、扣费、派发。 */
export const runNode = (projectId: string, nodeId: string, doc: unknown) =>
  apiFetch<IpRun>(
    `/v1/ip-studio/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/run`,
    { method: "POST", body: { doc } },
  );

export const readRun = (runId: string) =>
  apiFetch<IpRun>(`/v1/ip-studio/runs/${encodeURIComponent(runId)}`);

export const cancelRun = (runId: string) =>
  apiFetch<IpRun>(`/v1/ip-studio/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
