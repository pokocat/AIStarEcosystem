// ─────────────────────────────────────────────────────────────────────────────
// api/prompts.ts — Prompt 模板管理（素材运营文本三件的 system + user 模板）。
// 对应 server AdminPromptController（/api/admin/prompts/*）。
// 运营改 prompt / 灰度 / 回滚，无需改代码或重启（server PromptService 1min 缓存，PUT 立即失效）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export interface PromptParams {
  temperature?: number | null;
  maxTokens?: number | null;
  jsonMode?: boolean | null;
}

export interface PromptTemplate {
  id: string | null;
  promptKey: string;
  systemPrompt: string;
  userTemplate: string;
  params: PromptParams | null;
  variables: string[];
  version: number;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PromptUpsert {
  systemPrompt?: string;
  userTemplate?: string;
  params?: PromptParams | null;
  enabled?: boolean;
  changeNote?: string;
}

export interface PromptDryRun {
  promptKey: string;
  system: string;
  user: string;
  params: PromptParams | null;
  variables: string[];
  missingVariables: string[];
  sampleVars: Record<string, string>;
}

export interface PromptTemplateVersion {
  id: string;
  promptKey: string;
  version: number;
  systemPrompt: string;
  userTemplate: string;
  params: PromptParams | null;
  enabled: boolean;
  createdAt: string;
  createdBy?: string;
  changeNote?: string;
}

export interface PromptTestRun extends PromptDryRun {
  output: string;
  finishReason?: string;
  tokensUsed?: number;
  endpointUsed?: string;
  modelUsed?: string;
}

/** GET /admin/prompts */
export async function listPrompts(): Promise<PromptTemplate[]> {
  return apiFetch<PromptTemplate[]>("/admin/prompts");
}

/** GET /admin/prompts/{key} */
export async function getPrompt(key: string): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>(`/admin/prompts/${encodeURIComponent(key)}`);
}

/** PUT /admin/prompts/{key} */
export async function upsertPrompt(key: string, body: PromptUpsert): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>(`/admin/prompts/${encodeURIComponent(key)}`, { method: "PUT", body });
}

/** POST /admin/prompts/{key}/dry-run — 用样例参数填出最终 messages（不真调模型）。 */
export async function dryRunPrompt(key: string, sampleVars: Record<string, string>): Promise<PromptDryRun> {
  return apiFetch<PromptDryRun>(`/admin/prompts/${encodeURIComponent(key)}/dry-run`, {
    method: "POST",
    body: sampleVars,
  });
}
export async function testRunPrompt(
  key: string,
  body: { vars: Record<string, string>; endpointId?: string },
): Promise<PromptTestRun> {
  return apiFetch<PromptTestRun>(`/admin/prompts/${encodeURIComponent(key)}/test-run`, {
    method: "POST",
    body,
  });
}
export async function listPromptVersions(key: string): Promise<PromptTemplateVersion[]> {
  return apiFetch<PromptTemplateVersion[]>(`/admin/prompts/${encodeURIComponent(key)}/versions`);
}
export async function rollbackPrompt(key: string, version: number): Promise<PromptTemplate> {
  return apiFetch<PromptTemplate>(`/admin/prompts/${encodeURIComponent(key)}/versions/${version}/rollback`, {
    method: "POST",
  });
}
