// ─────────────────────────────────────────────────────────────────────────────
// api/tenants.ts — 机构 / 归属关系管理 API。
// 对应后端 AdminTenantController (/api/admin/tenants)、
// AdminMembershipController (/api/admin/memberships)。
// ─────────────────────────────────────────────────────────────────────────────

import type { Tenant, Membership } from "@/types/account";
import type { ID } from "@/types/_shared";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { TENANTS, MEMBERSHIPS } from "@/mocks/accounts";

export async function listTenants(page = 0, size = 200): Promise<Tenant[]> {
  if (USE_MOCK) return mockDelay(TENANTS);
  return apiFetch<Tenant[]>("/admin/tenants", {
    query: { page, size },
  });
}

export async function getTenant(id: ID): Promise<Tenant> {
  if (USE_MOCK) return mockDelay(TENANTS.find((t) => t.id === id)!);
  return apiFetch<Tenant>(`/admin/tenants/${encodeURIComponent(id)}`);
}

export async function listMemberships(
  tenantId?: ID, userId?: ID, page = 0, size = 500
): Promise<Membership[]> {
  if (USE_MOCK) {
    let rows = MEMBERSHIPS;
    if (tenantId) rows = rows.filter((m) => m.tenantId === tenantId);
    if (userId) rows = rows.filter((m) => m.userId === userId);
    return mockDelay(rows);
  }
  return apiFetch<Membership[]>("/admin/memberships", {
    query: { tenantId, userId, page, size },
  });
}
