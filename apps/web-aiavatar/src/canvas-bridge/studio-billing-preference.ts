import { AccountApi, ApiError, EnterpriseApi } from "@ai-star-eco/api-client";
import type { EnterpriseBillingSelection, EnterpriseContext } from "@ai-star-eco/types/enterprise";

export type StudioBillingAccount = { userId: string; context?: EnterpriseContext };

/** Refresh membership before applying a browser preference; an old enterprise is never reused. */
export async function loadStudioBillingAccount(): Promise<StudioBillingAccount> {
  const [user, contexts] = await Promise.all([
    AccountApi.getMe(),
    EnterpriseApi.mine().catch(error => {
      if (error instanceof ApiError && error.status === 404) return [];
      throw error;
    }),
  ]);
  return { userId: user.id, context: contexts[0] };
}

const key = (userId: string, enterpriseId: string) => `ipstudio:billing-default:${encodeURIComponent(userId)}:${encodeURIComponent(enterpriseId)}`;

export function readStudioBillingPreference(account: StudioBillingAccount): EnterpriseBillingSelection | undefined {
  if (!account.context) return;
  try {
    const mode = localStorage.getItem(key(account.userId, account.context.enterprise.id));
    if (mode === "personal") return { mode };
    if (mode === "enterprise") return { mode, enterpriseId: account.context.enterprise.id };
  } catch { /* An unavailable browser store means asking again, never guessing a payer. */ }
}

export function saveStudioBillingPreference(account: StudioBillingAccount, mode?: EnterpriseBillingSelection["mode"]): void {
  if (!account.context) return;
  try {
    const storageKey = key(account.userId, account.context.enterprise.id);
    if (mode) localStorage.setItem(storageKey, mode);
    else localStorage.removeItem(storageKey);
  } catch {
    throw new Error("浏览器暂时无法保存付款偏好，请允许本站存储后重试。");
  }
}
