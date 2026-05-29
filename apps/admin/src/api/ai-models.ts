// ─────────────────────────────────────────────────────────────────────────────
// api/ai-models.ts — Admin AI 模型 provider 配置（OpenAI 兼容 API token 接入）。
// 对应 AdminAiModelProviderController。v0.5 §D8 新增。
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
  | "SAFETY_REVIEW"
  | "VIDEO_REF_ANALYSIS"
  | "TEMPLATE_REWRITE"
  | "GENERAL";

/** 单个可用模型条目（通常由 discover/fetch-models 拉取后写入配置）。 */
export interface AiModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
}

/** 列表 / 详情 DTO（apiKey 永远不返回明文，仅 apiKeyMasked）。 */
export interface AiModelProvider {
  id: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKeyMasked: string;
  apiVersion?: string;
  defaultModel?: string;
  models?: AiModelEntry[];
  purposes: AiModelPurpose[];
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 写请求（apiKey 走明文，service 端加密落库；PUT 时 apiKey 缺省表示不修改）。 */
export interface AdminAiModelProviderUpsert {
  id?: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey?: string;
  apiVersion?: string;
  defaultModel?: string;
  models?: AiModelEntry[];
  purposes?: AiModelPurpose[];
  priority?: number;
  enabled?: boolean;
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

export async function list(): Promise<AiModelProvider[]> {
  return apiFetch<AiModelProvider[]>(BASE);
}
export async function get(id: string): Promise<AiModelProvider> {
  return apiFetch<AiModelProvider>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminAiModelProviderUpsert): Promise<AiModelProvider> {
  return apiFetch<AiModelProvider>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminAiModelProviderUpsert): Promise<AiModelProvider> {
  return apiFetch<AiModelProvider>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function remove(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function testConnection(id: string): Promise<{ ok: boolean; statusCode?: number; error?: string; snippet?: string }> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/test`, { method: "POST" });
}

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
/** 已存 provider：用落库的 apiKey 重新拉取可用模型（拉回后由保存写入配置）。 */
export async function fetchModels(id: string): Promise<ModelDiscoveryResult> {
  return apiFetch<ModelDiscoveryResult>(`${BASE}/${encodeURIComponent(id)}/fetch-models`, { method: "POST" });
}

/** 全局大模型用量报表（days：统计窗口天数，缺省 30，封顶 365）。v0.41 新增。 */
export async function getUsage(days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(BASE + "/usage", { query: { days } });
}
/** 单服务商用量报表。v0.41 新增。 */
export async function getProviderUsage(id: string, days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(`${BASE}/${encodeURIComponent(id)}/usage`, { query: { days } });
}
