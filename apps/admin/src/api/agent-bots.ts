// ─────────────────────────────────────────────────────────────────────────────
// api/agent-bots.ts — Admin Agent 平台 bot 配置（Coze 等）。
// 对应 AdminAgentBotController。v0.39 新增。
// 把「形象锻造」这类挂在 agent 平台上的会话能力做成后台可配；一个 sceneKey 对应一个 bot。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export type AgentPlatform = "coze" | "dify" | "custom";

/** 可绑定的业务场景。 */
export interface AgentScene {
  key: string;
  label: string;
  description?: string;
}

/** 列表 / 详情 DTO（token 永远不返回明文，仅 tokenMasked）。 */
export interface AgentBotProvider {
  id: string;
  name: string;
  platform: AgentPlatform;
  sceneKey: string;
  apiBase: string;
  tokenMasked: string;
  botId: string;
  userIdPrefix?: string;
  readTimeoutMs?: number;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 写请求（token 走明文，service 端加密落库；PUT 时 token 缺省表示不修改）。 */
export interface AgentBotProviderUpsert {
  id?: string;
  name: string;
  platform: AgentPlatform;
  sceneKey: string;
  apiBase?: string;
  token?: string;
  botId: string;
  userIdPrefix?: string;
  readTimeoutMs?: number;
  description?: string;
  enabled?: boolean;
}

const BASE = "/admin/agent-bots";

export async function list(): Promise<AgentBotProvider[]> {
  return apiFetch<AgentBotProvider[]>(BASE);
}
export async function listScenes(): Promise<AgentScene[]> {
  return apiFetch<AgentScene[]>(`${BASE}/scenes`);
}
export async function get(id: string): Promise<AgentBotProvider> {
  return apiFetch<AgentBotProvider>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AgentBotProviderUpsert): Promise<AgentBotProvider> {
  return apiFetch<AgentBotProvider>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AgentBotProviderUpsert): Promise<AgentBotProvider> {
  return apiFetch<AgentBotProvider>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function remove(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
