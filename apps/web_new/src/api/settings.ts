// ─────────────────────────────────────────────────────────────────────────────
// api/settings.ts — 设置（订阅计划 / 账单记录）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriptionPlan, BillingRecord } from "@/types/settings";
import { SUBSCRIPTION_PLANS, BILLING_HISTORY } from "@/mocks/settings";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  if (USE_MOCK) return mockDelay(SUBSCRIPTION_PLANS);
  return apiFetch<SubscriptionPlan[]>("/settings/subscription-plans");
}

export async function listBillingHistory(): Promise<BillingRecord[]> {
  if (USE_MOCK) return mockDelay(BILLING_HISTORY);
  return apiFetch<BillingRecord[]>("/settings/billing-history");
}
