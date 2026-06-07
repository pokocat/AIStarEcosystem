// ─────────────────────────────────────────────────────────────────────────────
// api/ai-models.ts — Admin AI 模型接入端点 + 内嵌网关 Key + AI 应用绑定（v0.41）。
// 对应 AdminAiModelEndpointController + AdminAiAppBindingController。
//   端点 = 固定 {上游密钥 + 单模型 + 地址}，自带网关 Key（sk-aep-*）。
//   AI 应用（用途）经「应用绑定」固定指向一个端点。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export type AiModelProviderType =
  | "OPENAI"
  | "ANTHROPIC"
  | "AZURE_OPENAI"
  | "MOONSHOT"
  | "DEEPSEEK"
  | "BAIDU"
  | "ALIYUN"
  | "TENCENT"
  | "VOLCENGINE"
  | "OPENAI_COMPATIBLE"
  | "CUSTOM";

export type AiModelPurpose =
  | "SCRIPT_DRAFT"
  | "SELLING_POINTS"
  | "VARIABLE_EXTRACT"
  | "VIDEO_GENERATION"
  | "SAFETY_REVIEW"
  | "VIDEO_REF_ANALYSIS"
  | "TEMPLATE_REWRITE"
  | "APPEARANCE_FORGE"
  | "DRAMA_SCRIPT_DRAFT"
  | "DAP_PERSONA"
  | "DAP_IMAGE"
  | "DAP_VIDEO"
  | "GENERAL";

/** 单个可用模型条目（通常由 discover/fetch-models 拉取后写入配置）。 */
export interface AiModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
}

/** 模型接入端点读 DTO（上游 apiKey / 网关 Key 均不返回明文）。 */
export interface AiModelEndpoint {
  id: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  upstreamApiKeyMasked: string;
  apiVersion?: string;
  model?: string;
  models?: AiModelEntry[];
  // 内嵌网关 Key
  keyPrefix?: string;
  keyMasked?: string;
  hasKey: boolean;
  ownerUserId?: string;
  totalTokens: number;
  totalCalls: number;
  lastUsedAt?: string;
  keyRevokedAt?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 写请求（上游 apiKey 走明文，service 端加密落库；PUT 时省略表示不修改）。 */
export interface AdminAiModelEndpointUpsert {
  id?: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey?: string;
  apiVersion?: string;
  model?: string;
  models?: AiModelEntry[];
  /** 计费归属用户；"" 清空为平台级（不计费）；省略 = 不修改。 */
  ownerUserId?: string;
  enabled?: boolean;
}

/** 铸造网关 Key 的响应（plaintext 仅一次）。 */
export interface AiModelEndpointKeyMinted {
  endpoint: AiModelEndpoint;
  plaintext: string;
}

/** AI 应用绑定（用途 → 端点）。 */
export interface AiAppBinding {
  purpose: AiModelPurpose;
  purposeLabel: string;
  endpointId?: string;
  endpointName?: string;
  endpointEnabled?: boolean;
  updatedAt?: string;
}

/** 内置服务商预设（仅模板，不落库）。 */
export interface AiModelProviderPreset {
  code: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  suggestedModel?: string;
  docsUrl?: string;
  apiKeyHint?: string;
}

/** 模型发现结果。 */
export interface ModelDiscoveryResult {
  ok: boolean;
  statusCode?: number;
  models: AiModelEntry[];
  error?: string;
}

/** 用量聚合行（按服务商或模型分组）。v0.41 新增。 */
export interface AiModelUsageStat {
  key: string;
  label: string;
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

/** 用量报表（最近 windowDays 天）。v0.41 新增。 */
export interface AiModelUsageReport {
  windowDays: number;
  since: string;
  totalCalls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  byProvider: AiModelUsageStat[];
  byModel: AiModelUsageStat[];
}

const BASE = "/admin/ai-models";
const BINDINGS = "/admin/ai-app-bindings";

// ── 端点 CRUD ────────────────────────────────────────────────────────────────
export async function list(): Promise<AiModelEndpoint[]> {
  return apiFetch<AiModelEndpoint[]>(BASE);
}
export async function get(id: string): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminAiModelEndpointUpsert): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminAiModelEndpointUpsert): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function remove(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function testConnection(id: string): Promise<{ ok: boolean; statusCode?: number; error?: string; snippet?: string }> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/test`, { method: "POST" });
}

// ── 网关 Key 铸造 / 撤销 ───────────────────────────────────────────────────────
/** 给端点铸造（或重铸）网关 Key —— 唯一返回明文一次。 */
export async function mintKey(id: string): Promise<AiModelEndpointKeyMinted> {
  return apiFetch<AiModelEndpointKeyMinted>(`${BASE}/${encodeURIComponent(id)}/mint-key`, { method: "POST" });
}
/** 撤销端点的网关 Key（不删端点）。 */
export async function revokeKey(id: string): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(`${BASE}/${encodeURIComponent(id)}/revoke-key`, { method: "POST" });
}

// ── 模型发现 ──────────────────────────────────────────────────────────────────
/** 内置常见服务商预设（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI）。 */
export async function listPresets(): Promise<AiModelProviderPreset[]> {
  return apiFetch<AiModelProviderPreset[]>(`${BASE}/presets`);
}
/** 新建前：用表单的 baseUrl + apiKey 调服务商 GET /models 拉取可用模型。 */
export async function discoverModels(body: {
  providerType?: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
}): Promise<ModelDiscoveryResult> {
  return apiFetch<ModelDiscoveryResult>(`${BASE}/discover-models`, { method: "POST", body });
}
/** 已存端点：用落库的 apiKey 重新拉取可用模型（拉回后由保存写入配置）。 */
export async function fetchModels(id: string): Promise<ModelDiscoveryResult> {
  return apiFetch<ModelDiscoveryResult>(`${BASE}/${encodeURIComponent(id)}/fetch-models`, { method: "POST" });
}

// ── 网关用量统计（v0.41） ───────────────────────────────────────────────────────
/** 全局大模型用量报表（days：统计窗口天数，缺省 30，封顶 365）。 */
export async function getUsage(days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(BASE + "/usage", { query: { days } });
}
/** 单端点用量报表。 */
export async function getProviderUsage(id: string, days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(`${BASE}/${encodeURIComponent(id)}/usage`, { query: { days } });
}

// ── AI 应用绑定 ────────────────────────────────────────────────────────────────
/** 列出全部用途（含未绑定）及其绑定端点。 */
export async function listBindings(): Promise<AiAppBinding[]> {
  return apiFetch<AiAppBinding[]>(BINDINGS);
}
/** 把某用途绑定到一个启用端点。 */
export async function bind(purpose: AiModelPurpose, endpointId: string): Promise<AiAppBinding> {
  return apiFetch<AiAppBinding>(`${BINDINGS}/${encodeURIComponent(purpose)}`, {
    method: "PUT",
    body: { endpointId },
  });
}
/** 解绑某用途。 */
export async function unbind(purpose: AiModelPurpose): Promise<void> {
  await apiFetch<void>(`${BINDINGS}/${encodeURIComponent(purpose)}`, { method: "DELETE" });
}
