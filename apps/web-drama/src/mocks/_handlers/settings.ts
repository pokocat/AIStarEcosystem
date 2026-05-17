// mocks/_handlers/settings.ts — 积分包 / 充值历史 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { CREDIT_PACKS, RECHARGE_HISTORY } from "@/mocks/settings";
import type { CreditPurchaseWire } from "@/api/settings";

registerMocks([
  { method: "GET", pattern: "/settings/credit-packs", handler: () => mockDelay(CREDIT_PACKS) },
  {
    method: "GET",
    pattern: "/settings/recharge-history",
    handler: () => mockDelay(RECHARGE_HISTORY),
  },
  {
    method: "POST",
    pattern: "/settings/credit-packs/:packId/purchase",
    handler: ({ params }) =>
      mockDelay<CreditPurchaseWire>({
        id: `mock-${Date.now()}`,
        userId: "mock-user",
        packId: params.packId,
        priceCents: 9_900,
        creditsAdded: 1_000,
        createdAt: new Date().toISOString(),
      }),
  },
  {
    method: "GET",
    pattern: "/settings/purchases",
    handler: () => mockDelay<CreditPurchaseWire[]>([]),
  },
]);
