import { AccountApi, ApiError } from "@ai-star-eco/api-client";
import { EnterpriseApi } from "./enterprise-api";
import type { EnterpriseBillingDefault, EnterpriseBillingSelection, EnterpriseContext } from "@ai-star-eco/types/enterprise";

export type StudioBillingAccount = { userId: string; context?: EnterpriseContext };

/** Refresh membership before applying a default; an old enterprise is never reused. */
export async function loadStudioBillingAccount(): Promise<StudioBillingAccount> {
  const [user, contexts] = await Promise.all([
    AccountApi.getMe(),
    EnterpriseApi.mine().catch(error => {
      if (error instanceof ApiError && error.status === 404) return [];
      throw error;
    }),
  ]);
  const account = { userId: user.id, context: contexts[0] };
  return { ...account, context: await adoptBrowserDefault(account) };
}

// Before 2026-11-02 the default lived in one browser. It moves to the membership the first time it is read there.
const legacyKey = (userId: string, enterpriseId: string) => `ipstudio:billing-default:${encodeURIComponent(userId)}:${encodeURIComponent(enterpriseId)}`;

async function adoptBrowserDefault(account: StudioBillingAccount): Promise<EnterpriseContext | undefined> {
  const context = account.context;
  if (!context || context.billingDefault) return context;
  let mode: string | null = null;
  try { mode = localStorage.getItem(legacyKey(account.userId, context.enterprise.id)); } catch { return context; }
  if (mode !== "personal" && mode !== "enterprise") return context;
  try {
    const updated = await EnterpriseApi.setBillingDefault(context.enterprise.id, mode);
    try { localStorage.removeItem(legacyKey(account.userId, context.enterprise.id)); } catch { /* Harmless: the server now answers first. */ }
    return updated;
  } catch {
    return context; // Ask again rather than guess; the next read retries the move.
  }
}

/**
 * The saved default, when it can pay right now. A default naming an enterprise the member can no longer spend from
 * asks again (the chooser explains why); it never quietly switches to personal credits.
 */
export function readStudioBillingPreference(account: StudioBillingAccount): EnterpriseBillingSelection | undefined {
  const context = account.context;
  if (!context) return;
  if (context.billingDefault === "personal") return { mode: "personal" };
  if (context.billingDefault === "enterprise" && context.enterprise.status === "active" && context.member.status === "active")
    return { mode: "enterprise", enterpriseId: context.enterprise.id };
}

/** Saved on the membership: one choice holds on every device and in every paid feature. */
export async function saveStudioBillingPreference(account: StudioBillingAccount, mode?: EnterpriseBillingSelection["mode"]): Promise<StudioBillingAccount> {
  if (!account.context) return account;
  const next: EnterpriseBillingDefault = mode ?? null;
  const context = await EnterpriseApi.setBillingDefault(account.context.enterprise.id, next);
  return { ...account, context };
}
