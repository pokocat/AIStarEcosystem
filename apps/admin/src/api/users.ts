// ─────────────────────────────────────────────────────────────────────────────
// api/users.ts — 用户管理 API。对应 AdminUserController。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser } from "@/types/account";
import type { Wallet } from "@/types/wallet";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { ACCOUNTS } from "@/mocks/accounts";

export async function listUsers(
  page = 0, size = 20, status?: string, kind?: string
): Promise<AepUser[]> {
  if (USE_MOCK) return mockDelay(ACCOUNTS);
  return apiFetch<AepUser[]>("/admin/users", {
    query: { page, size, status, kind },
  });
}

export async function getUser(id: string): Promise<AepUser> {
  if (USE_MOCK) return mockDelay(ACCOUNTS.find((u) => u.id === id)!);
  return apiFetch<AepUser>(`/admin/users/${encodeURIComponent(id)}`);
}

export async function getUserWallet(id: string): Promise<Wallet> {
  return apiFetch<Wallet>(`/admin/users/${encodeURIComponent(id)}/wallet`);
}

/** v0.59：停用账号（reason 必填，写入审计日志；停用后密码 / 短信登录被拒）。 */
export async function suspendUser(id: string, reason: string): Promise<AepUser> {
  if (USE_MOCK) {
    const u = ACCOUNTS.find((a) => a.id === id);
    if (u) u.status = "suspended";
    return mockDelay(u!);
  }
  return apiFetch<AepUser>(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    body: { reason },
  });
}

/** v0.59：恢复已停用账号（reason 选填，写入审计日志）。 */
export async function reactivateUser(id: string, reason?: string): Promise<AepUser> {
  if (USE_MOCK) {
    const u = ACCOUNTS.find((a) => a.id === id);
    if (u) u.status = "active";
    return mockDelay(u!);
  }
  return apiFetch<AepUser>(`/admin/users/${encodeURIComponent(id)}/reactivate`, {
    method: "POST",
    body: { reason },
  });
}
