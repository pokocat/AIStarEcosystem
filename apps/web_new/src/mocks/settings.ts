// ─────────────────────────────────────────────────────────────────────────────
// mocks/settings.ts — 积分包售卖 / 充值历史样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type { CreditPack, RechargeRecord } from "@/types/settings";

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-starter",  code: "starter",    name: "入门包",  credits: 1_000,    priceCents: 9_900,    highlights: ["1,000 积分", "适合体验"], recommended: false, status: "active" },
  { id: "pack-standard", code: "standard",   name: "标准包",  credits: 10_000,   priceCents: 89_900,   highlights: ["10,000 积分", "性价比之选"], recommended: true, status: "active" },
  { id: "pack-pro",      code: "pro",        name: "专业包",  credits: 50_000,   priceCents: 399_900,  highlights: ["50,000 积分", "重度创作"], recommended: false, status: "active" },
  { id: "pack-ent",      code: "enterprise", name: "企业包",  credits: 500_000,  priceCents: 3_499_900, highlights: ["500,000 积分", "团队/机构使用"], recommended: false, status: "active" },
];

export const RECHARGE_HISTORY: RechargeRecord[] = [
  { id: "r-1", date: "2026-04-10", desc: "标准包",        source: "credit_pack",   creditsAdded: 10_000,  priceCents: 89_900 },
  { id: "r-2", date: "2026-03-22", desc: "License 兑换",  source: "license_redeem", creditsAdded: 5_000,   priceCents: 0       },
  { id: "r-3", date: "2026-02-15", desc: "入门包",        source: "credit_pack",   creditsAdded: 1_000,   priceCents: 9_900   },
  { id: "r-4", date: "2026-01-08", desc: "新春活动赠送",  source: "promo_gift",     creditsAdded: 2_000,   priceCents: 0       },
];
