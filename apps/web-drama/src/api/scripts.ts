// ─────────────────────────────────────────────────────────────────────────────
// api/scripts.ts — 脚本工坊 API（network-only）。
// USE_MOCK 模式下由 src/mocks/_handlers/scripts.ts 在 apiFetch 网络层拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID } from "@ai-star-eco/types/_shared";
import type { Script, ScriptVersion, ScriptKind, ScriptStatus } from "@ai-star-eco/types/script";
import { apiFetch } from "./_client";

export async function listScripts(): Promise<Script[]> {
  return apiFetch<Script[]>("/me/scripts");
}

export async function getScript(id: ID): Promise<Script | null> {
  return apiFetch<Script | null>(`/me/scripts/${encodeURIComponent(id)}`);
}

export async function listVersionsByScript(scriptId: ID): Promise<ScriptVersion[]> {
  return apiFetch<ScriptVersion[]>(`/me/scripts/${encodeURIComponent(scriptId)}/versions`);
}

export async function getVersion(versionId: ID): Promise<ScriptVersion | null> {
  return apiFetch<ScriptVersion | null>(`/me/script-versions/${encodeURIComponent(versionId)}`);
}

export interface CreateScriptInput {
  title: string;
  kind: ScriptKind;
  series?: string;
  episode?: string;
  dramaId?: ID;
  initialContent?: string;
  authorName?: string;
}

export async function createScript(input: CreateScriptInput): Promise<Script> {
  return apiFetch<Script>("/me/scripts", { method: "POST", body: input });
}

export interface CommitVersionInput {
  content: string;
  note?: string;
  authorName?: string;
  aiAssisted?: boolean;
}

export async function commitVersion(scriptId: ID, input: CommitVersionInput): Promise<ScriptVersion> {
  return apiFetch<ScriptVersion>(`/me/scripts/${encodeURIComponent(scriptId)}/versions`, {
    method: "POST",
    body: input,
  });
}

export async function setScriptStatus(scriptId: ID, status: ScriptStatus): Promise<Script> {
  return apiFetch<Script>(`/me/scripts/${encodeURIComponent(scriptId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function archiveScript(scriptId: ID): Promise<Script> {
  return setScriptStatus(scriptId, "archived");
}

export async function deleteScript(scriptId: ID): Promise<void> {
  await apiFetch<void>(`/me/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" });
}

export async function cloneScript(scriptId: ID): Promise<Script> {
  return apiFetch<Script>(`/me/scripts/${encodeURIComponent(scriptId)}/clone`, { method: "POST" });
}

/** AI 续写 / 改写：后端调用模型 API。 */
export async function generateDraft(scriptId: ID, prompt: string): Promise<{ content: string }> {
  return apiFetch<{ content: string }>(`/me/scripts/${encodeURIComponent(scriptId)}/generate`, {
    method: "POST",
    body: { prompt },
  });
}
