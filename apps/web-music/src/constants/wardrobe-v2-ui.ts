// ─────────────────────────────────────────────────────────────────────────────
// wardrobe-v2-ui.ts — 衣帽间 v2（游戏装备风格）的 UI-only 常量。
// 纯前端展示用，未入 types/ 契约：品牌占位、锻造消耗、槽位显示序等。
// 未来商业化落地时，BRAND_OVERLAY 会迁移到服务端作为 ClothingItem 的扩展字段。
// ─────────────────────────────────────────────────────────────────────────────

import type { EquipSlot } from "@ai-star-eco/types/wardrobe";

/** 单次装备锻造消耗的积分（前端常量；后端接入后由 server 下发）。 */
export const WARDROBE_FORGE_COST = 200;

/** 锻造生成时的 mock 延迟（毫秒）。 */
export const WARDROBE_FORGE_MOCK_MS = 1800;

/** 装备槽在右列的展示顺序。 */
export const EQUIP_SLOT_ORDER: EquipSlot[] = ["hair", "top", "bottom", "shoes", "accessory"];

/** 品牌赞助占位：itemId → 品牌信息（UI-only）。 */
export const BRAND_OVERLAY: Record<string, { brand: string; accent: string }> = {
  t3: { brand: "CHANEL",     accent: "#111111" },
  b4: { brand: "DIOR",       accent: "#C8A95C" },
  a3: { brand: "SONY",       accent: "#1EA7FD" },
  s2: { brand: "BALENCIAGA", accent: "#E53935" },
  h3: { brand: "GUCCI",      accent: "#006341" },
};
