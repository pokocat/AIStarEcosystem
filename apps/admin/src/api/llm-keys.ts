// ─────────────────────────────────────────────────────────────────────────────
// api/llm-keys.ts — Admin 管理 LLM gateway 业务侧 sk-aep-* key。
// 对应 AdminLlmApiKeyController（v0.6 §LLM 新增）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export interface LlmApiKey {
  id: string;
  keyPrefix: string;
  keyMasked: string;
  userId: string;
  name: string;
  enabled: boolean;
  totalTokens: number;
  totalCalls: number;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LlmApiKeyCreated {
  key: LlmApiKey;
  /** 仅创建时返回的明文 key——必须立即复制保存，server 不存明文。 */
  plaintext: string;
}

export interface LlmApiKeyUpsert {
  userId: string;
  name: string;
  enabled?: boolean;
}

const BASE = "/admin/llm-keys";

export async function list(): Promise<LlmApiKey[]> {
  return apiFetch<LlmApiKey[]>(BASE);
}
export async function get(id: string): Promise<LlmApiKey> {
  return apiFetch<LlmApiKey>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: LlmApiKeyUpsert): Promise<LlmApiKeyCreated> {
  return apiFetch<LlmApiKeyCreated>(BASE, { method: "POST", body });
}
export async function update(id: string, body: LlmApiKeyUpsert): Promise<LlmApiKey> {
  return apiFetch<LlmApiKey>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function revoke(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
