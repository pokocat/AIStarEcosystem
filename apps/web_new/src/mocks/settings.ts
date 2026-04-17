// ─────────────────────────────────────────────────────────────────────────────
// mocks/settings.ts — 订阅计划 / 账单历史样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriptionPlan, BillingRecord } from "@/types/settings";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "plan-free", code: "free",       name: "免费版", price: "¥0",      features: ["3个AI艺人", "基础工坊", "5GB存储"],                                    current: false },
  { id: "plan-pro",  code: "pro",        name: "专业版", price: "¥299/月", features: ["20个AI艺人", "全功能工坊", "100GB存储", "优先AI算力"],                current: true  },
  { id: "plan-ent",  code: "enterprise", name: "企业版", price: "¥999/月", features: ["无限AI艺人", "API访问", "1TB存储", "专属客服", "白标方案"],            current: false },
];

export const BILLING_HISTORY: BillingRecord[] = [
  { id: "b-1", date: "2025-04-01", desc: "Pro Plan — April",    amount: "¥299" },
  { id: "b-2", date: "2025-03-01", desc: "Pro Plan — March",    amount: "¥299" },
  { id: "b-3", date: "2025-02-15", desc: "AI算力加购 50h",       amount: "¥99"  },
  { id: "b-4", date: "2025-02-01", desc: "Pro Plan — February", amount: "¥299" },
];
