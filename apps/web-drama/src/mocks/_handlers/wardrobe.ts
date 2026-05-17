// mocks/_handlers/wardrobe.ts — 衣橱系统 mock handlers。

import type { ID } from "@ai-star-eco/types/_shared";
import type { ForgeResult } from "@ai-star-eco/types/appearance-forge";
import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import type { SavedOutfitWire, WardrobeLookRequest } from "@/api/wardrobe";

const rarityRank: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

registerMocks([
  { method: "GET", pattern: "/wardrobe/items", handler: () => mockDelay(CLOTHING_DATABASE) },
  { method: "GET", pattern: "/wardrobe/outfits", handler: () => mockDelay<SavedOutfitWire[]>([]) },
  {
    method: "POST",
    pattern: "/wardrobe/outfits",
    handler: ({ body }) => {
      const b = (body ?? {}) as { name: string; slots: Record<string, string> };
      return mockDelay<SavedOutfitWire>({
        id: `mock-${Date.now()}`,
        userId: "mock-user",
        name: b.name,
        slots: b.slots,
        createdAt: new Date().toISOString(),
      });
    },
  },
  {
    method: "DELETE",
    pattern: "/wardrobe/outfits/:id",
    handler: () => mockDelay(undefined),
  },
  {
    method: "POST",
    pattern: "/wardrobe/generate-look",
    handler: ({ body }) => {
      const req = body as WardrobeLookRequest;
      const equippedIds = Object.values(req.equipped).filter((id): id is ID => !!id);
      const equippedItems = CLOTHING_DATABASE.filter((item) => equippedIds.includes(item.id));
      const hero = equippedItems.slice().sort(
        (a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0),
      )[0];
      const imageSource = hero?.imageUrl ?? CLOTHING_DATABASE[0]?.imageUrl ?? "";
      const promptParts = equippedItems.map((i) => i.name);
      const result: ForgeResult = {
        id: `look-${Date.now()}`,
        artistId: req.artistId,
        image: imageSource,
        prompt: promptParts.length ? `衣帽间锻造：${promptParts.join(" / ")}` : "衣帽间锻造",
        mode: "random",
        createdAt: new Date().toISOString(),
        locked: [],
        status: "draft",
        usageCount: 0,
      };
      return mockDelay(result, 1800);
    },
  },
]);
