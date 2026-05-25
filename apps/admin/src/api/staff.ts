// ─────────────────────────────────────────────────────────────────────────────
// api/staff.ts — 后台管理员（admin_users 表）CRUD。
// 对应 AdminStaffController (/api/admin/staff)。
// 服务端要求 SUPER_ADMIN（AepSecurityConfig.requestMatchers("/api/admin/staff/**")）。
// ─────────────────────────────────────────────────────────────────────────────

import type { AdminUser, AdminRole, AdminStatus } from "@/types/account";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { ADMIN_STAFF_MOCKS } from "@/mocks/staff";

export interface CreateAdminInput {
  /** 用户名（登录用，唯一） */
  username: string;
  /** 明文密码；server 用 bcrypt 哈希存储 */
  password: string;
  email?: string;
  displayName?: string;
  /** 默认 OPERATOR */
  role?: AdminRole;
}

export interface UpdateAdminInput {
  email?: string;
  displayName?: string;
  role?: AdminRole;
  status?: AdminStatus;
  /** 非空字符串时重置密码；空 / undefined 不动 */
  password?: string;
}

/**
 * server 端 AdminUserDto.role 用 `.toLowerCase()` 序列化为 "super_admin" / "operator"，
 * 但本前端约定 AdminRole = "SUPER_ADMIN" | "OPERATOR"（大写），在 API 边界归一化。
 */
function normalize(raw: Omit<AdminUser, "role"> & { role: string }): AdminUser {
  return { ...raw, role: raw.role.toUpperCase() as AdminRole };
}

export async function listStaff(page = 0, size = 100): Promise<AdminUser[]> {
  if (USE_MOCK) return mockDelay(ADMIN_STAFF_MOCKS);
  const rows = await apiFetch<(Omit<AdminUser, "role"> & { role: string })[]>("/admin/staff", {
    query: { page, size },
  });
  return rows.map(normalize);
}

export async function createStaff(data: CreateAdminInput): Promise<AdminUser> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    const created: AdminUser = {
      id: `mock-${Date.now()}`,
      username: data.username,
      email: data.email ?? "",
      displayName: data.displayName ?? data.username,
      role: data.role ?? "OPERATOR",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    ADMIN_STAFF_MOCKS.push(created);
    return mockDelay(created);
  }
  const row = await apiFetch<Omit<AdminUser, "role"> & { role: string }>("/admin/staff", {
    method: "POST",
    body: data,
  });
  return normalize(row);
}

export async function updateStaff(id: string, data: UpdateAdminInput): Promise<AdminUser> {
  if (USE_MOCK) {
    const idx = ADMIN_STAFF_MOCKS.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error(`AdminUser ${id} not found`);
    const merged: AdminUser = {
      ...ADMIN_STAFF_MOCKS[idx],
      ...data,
      role: (data.role ?? ADMIN_STAFF_MOCKS[idx].role) as AdminRole,
      status: (data.status ?? ADMIN_STAFF_MOCKS[idx].status) as AdminStatus,
      updatedAt: new Date().toISOString(),
    };
    ADMIN_STAFF_MOCKS[idx] = merged;
    return mockDelay(merged);
  }
  const row = await apiFetch<Omit<AdminUser, "role"> & { role: string }>(
    `/admin/staff/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: data,
    },
  );
  return normalize(row);
}

export async function deleteStaff(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = ADMIN_STAFF_MOCKS.findIndex((u) => u.id === id);
    if (idx >= 0) ADMIN_STAFF_MOCKS.splice(idx, 1);
    return mockDelay(undefined as unknown as void);
  }
  await apiFetch<void>(`/admin/staff/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
