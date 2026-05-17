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
  | "SAFETY_REVIEW"
  | "VIDEO_REF_ANALYSIS"
  | "TEMPLATE_REWRITE"
  | "GENERAL";

/** 列表 / 详情 DTO（apiKey 永远不返回明文，仅 apiKeyMasked）。 */
export interface AiModelProvider {
  id: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKeyMasked: string;
  apiVersion?: string;
  defaultModel?: string;
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
  purposes?: AiModelPurpose[];
  priority?: number;
  enabled?: boolean;
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
