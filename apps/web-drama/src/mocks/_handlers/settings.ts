// mocks/_handlers/settings.ts — 积分包 / 充值历史 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { CREDIT_PACKS, RECHARGE_HISTORY } from "@/mocks/settings";
import type { CreditPurchaseWire } from "@/api/settings";

// 注：/settings/credit-packs/:packId/purchase mock 已随后端端点一并删除
// （例行 QA 2026-07-05 审计 F-01，见 apps/web-drama/src/api/settings.ts 注释）。

registerMocks([
  { method: "GET", pattern: "/settings/credit-packs", handler: () => mockDelay(CREDIT_PACKS) },
  {
    method: "GET",
    pattern: "/settings/recharge-history",
    handler: () => mockDelay(RECHARGE_HISTORY),
  },
  {
    method: "GET",
    pattern: "/settings/purchases",
    handler: () => mockDelay<CreditPurchaseWire[]>([]),
  },
]);
