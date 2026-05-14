// ─────────────────────────────────────────────────────────────────────────────
// api/celebrity-authorizations.ts — Admin 授权关系 CRUD + 状态机。
// 对应 AdminCelebrityAuthorizationController（/api/admin/celebrity/star-authorizations/*）。
// v0.5 新增。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, buildQuery } from "./_client";

export interface AdminCelebrityAuthorization {
  id: string;
  userId: string;
  starId: string;
  status: "unauthorized" | "pending" | "authorized" | "expired";
  scenes: string[];
  expireDate?: string;
  availableStyles?: number;
  pendingNote?: string;
  applyUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCelebrityAuthorizationUpsert {
  userId: string;
  starId: string;
  status?: AdminCelebrityAuthorization["status"];
  scenes?: string[];
  expireDate?: string;
  availableStyles?: number;
  pendingNote?: string;
  applyUrl?: string;
}

export interface AdminCelebrityAuthorizationTransition {
  to: AdminCelebrityAuthorization["status"];
  reason: string;
}

export interface AuthFilter {
  userId?: string;
  starId?: string;
  status?: AdminCelebrityAuthorization["status"];
}

const BASE = "/admin/celebrity/star-authorizations";

export async function list(filter?: AuthFilter): Promise<AdminCelebrityAuthorization[]> {
  const query: Record<string, unknown> = {};
  if (filter?.userId?.trim()) query.userId = filter.userId.trim();
  if (filter?.starId?.trim()) query.starId = filter.starId.trim();
  if (filter?.status) query.status = filter.status;
  return apiFetch<AdminCelebrityAuthorization[]>(`${BASE}${buildQuery(query)}`);
}
export async function get(id: string): Promise<AdminCelebrityAuthorization> {
  return apiFetch<AdminCelebrityAuthorization>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminCelebrityAuthorizationUpsert): Promise<AdminCelebrityAuthorization> {
  return apiFetch<AdminCelebrityAuthorization>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminCelebrityAuthorizationUpsert): Promise<AdminCelebrityAuthorization> {
  return apiFetch<AdminCelebrityAuthorization>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function remove(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function transition(
  id: string,
  body: AdminCelebrityAuthorizationTransition,
): Promise<AdminCelebrityAuthorization> {
  return apiFetch<AdminCelebrityAuthorization>(
    `${BASE}/${encodeURIComponent(id)}/transition`,
    { method: "POST", body },
  );
}
