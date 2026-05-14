// ─────────────────────────────────────────────────────────────────────────────
// api/template-scripts.ts — Admin 模板脚本 CRUD + draft/publish/rollback/dry-run。
// 对应 AdminTemplateScriptController。v0.5 新增。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TemplateScript,
  TemplateScriptStatus,
  TemplateScriptKind,
  DryRunRequest,
  DryRunResponse,
} from "@/types/celebrity-zone";
import { apiFetch, buildQuery } from "./_client";

export interface ScriptFilter {
  templateId?: string;
  status?: TemplateScriptStatus;
  kind?: TemplateScriptKind;
}

/** admin 编辑用 upsert 形状（与 server AdminTemplateScriptUpsertDto 对齐）。 */
export type AdminTemplateScriptUpsert = Partial<Omit<TemplateScript, "id" | "version" | "status" | "createdAt" | "publishedAt" | "publishedBy">> & {
  templateId: string;
};

const BASE = "/admin/template-scripts";

export async function list(filter?: ScriptFilter): Promise<TemplateScript[]> {
  const query: Record<string, unknown> = {};
  if (filter?.templateId?.trim()) query.templateId = filter.templateId.trim();
  if (filter?.status) query.status = filter.status;
  if (filter?.kind) query.kind = filter.kind;
  return apiFetch<TemplateScript[]>(`${BASE}${buildQuery(query)}`);
}
export async function get(id: string): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminTemplateScriptUpsert): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminTemplateScriptUpsert): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function submitReview(id: string): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}/submit-review`, { method: "POST" });
}
export async function publish(id: string): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}/publish`, { method: "POST" });
}
export async function rollback(id: string): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}/rollback`, { method: "POST" });
}
export async function dryRun(id: string, body: DryRunRequest): Promise<DryRunResponse> {
  return apiFetch<DryRunResponse>(`${BASE}/${encodeURIComponent(id)}/dry-run`, { method: "POST", body });
}
export async function draftWithAi(id: string, body: { prompt: string }): Promise<{ draft: string }> {
  return apiFetch<{ draft: string }>(`${BASE}/${encodeURIComponent(id)}/draft-with-ai`, { method: "POST", body });
}
export async function uploadClip(id: string, referenceClip: Record<string, unknown>): Promise<TemplateScript> {
  return apiFetch<TemplateScript>(`${BASE}/${encodeURIComponent(id)}/upload-clip`, { method: "POST", body: referenceClip });
}
