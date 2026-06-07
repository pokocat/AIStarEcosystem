// ─────────────────────────────────────────────────────────────────────────────
// api/aep-users.ts — v0.31+ admin 端「平台运营 · celebrity」管理 API。
// 对应 server AdminAepUsersController（/api/admin/aep-users/**）。
// 用于在 admin 后台维护 aep_users 表的 operatorRole 字段（内嵌运营角色）。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, OperatorRole, SubProduct } from "@/types/account";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";

export interface AepUserFilter {
  q?: string;
  hasOperator?: boolean;
}

const MOCK_USERS: AepUser[] = [
  {
    id: "u-celebrity-operator",
    username: "celebrity_operator",
    email: "celebrity-operator@aistareco.com",
    displayName: "平台运营 · 商品库",
    kind: "studio",
    status: "active",
    operatorRole: "operator",
    emailVerified: true,
    phoneVerified: false,
    langPreference: "zh",
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-24T00:00:00Z",
  },
  {
    id: "u-luna",
    username: "creator_luna",
    email: "luna@example.com",
    displayName: "Luna 个人创作者",
    kind: "studio",
    status: "active",
    operatorRole: null,
    emailVerified: true,
    phoneVerified: false,
    langPreference: "zh",
    createdAt: "2026-05-17T00:00:00Z",
    updatedAt: "2026-05-20T00:00:00Z",
  },
];

export async function listAepUsers(filter?: AepUserFilter): Promise<AepUser[]> {
  if (USE_MOCK) {
    let list = [...MOCK_USERS];
    if (filter?.q?.trim()) {
      const needle = filter.q.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(needle) ||
          u.displayName.toLowerCase().includes(needle) ||
          (u.phone ?? "").toLowerCase().includes(needle) ||
          (u.email ?? "").toLowerCase().includes(needle),
      );
    }
    if (filter?.hasOperator === true) list = list.filter((u) => !!u.operatorRole);
    if (filter?.hasOperator === false) list = list.filter((u) => !u.operatorRole);
    return mockDelay(list);
  }
  const q: Record<string, unknown> = {};
  if (filter?.q?.trim()) q.q = filter.q.trim();
  if (filter?.hasOperator !== undefined) q.hasOperator = filter.hasOperator;
  return apiFetch<AepUser[]>(`/admin/aep-users${buildQuery(q)}`);
}

/**
 * v0.53：改某账号的子产品平台访问授权。
 * 空数组 / null = 全平台（清空显式配置）；仅 SUPER_ADMIN 可调。
 * 注意：用户旧 JWT 仍有效，平台门禁读 /api/me 实时值，刷新页面即生效。
 */
export async function updatePlatforms(
  id: string,
  platforms: SubProduct[] | null,
): Promise<AepUser> {
  if (USE_MOCK) {
    const found = MOCK_USERS.find((u) => u.id === id);
    if (!found) throw new Error(`AepUser ${id} not found`);
    return mockDelay({
      ...found,
      platforms: platforms && platforms.length > 0 ? platforms : undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  return apiFetch<AepUser>(`/admin/aep-users/${encodeURIComponent(id)}/platforms`, {
    method: "PATCH",
    body: { platforms },
  });
}

/** 改某账号的 operatorRole。传 null 收回运营身份。 */
export async function updateOperatorRole(
  id: string,
  operatorRole: OperatorRole | null,
): Promise<AepUser> {
  if (USE_MOCK) {
    const found = MOCK_USERS.find((u) => u.id === id);
    if (!found) throw new Error(`AepUser ${id} not found`);
    return mockDelay({ ...found, operatorRole, updatedAt: new Date().toISOString() });
  }
  return apiFetch<AepUser>(`/admin/aep-users/${encodeURIComponent(id)}/operator-role`, {
    method: "PATCH",
    body: { operatorRole },
  });
}
