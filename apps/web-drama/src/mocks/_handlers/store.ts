// mocks/_handlers/store.ts — 统一商店与用户库存 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import type { StoreItemWire, UserInventoryWire, StoreItemType } from "@/api/store";

registerMocks([
  {
    method: "GET",
    pattern: "/store/catalog",
    handler: () => mockDelay<StoreItemWire[]>([]),
  },
  {
    method: "POST",
    pattern: "/store/items/:type/:itemId/redeem",
    handler: ({ params }) =>
      mockDelay<UserInventoryWire>({
        id: `mock-inv-${Date.now()}`,
        userId: "mock-user",
        itemType: params.type as StoreItemType,
        itemId: params.itemId,
        source: "PURCHASE",
        creditsSpent: 0,
        ledgerEntryId: null,
        acquiredAt: new Date().toISOString(),
      }),
  },
  {
    method: "GET",
    pattern: "/me/inventory",
    handler: () => mockDelay<UserInventoryWire[]>([]),
  },
]);
