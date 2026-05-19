// ─────────────────────────────────────────────────────────────────────────────
// api/social-account.ts — Admin 社交账号读 API。对应 AdminSocialAccountController。
// 仅读：禁用 / 解绑等写操作走用户自身路径或 v0.6 审批接口。
// ─────────────────────────────────────────────────────────────────────────────

import type { SocialAccount } from "@/types/social-account";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { SOCIAL_ACCOUNTS } from "@/mocks/social-account";

export async function listSocialAccounts(): Promise<SocialAccount[]> {
  if (USE_MOCK) return mockDelay(SOCIAL_ACCOUNTS);
  return apiFetch<SocialAccount[]>("/admin/social-accounts");
}
