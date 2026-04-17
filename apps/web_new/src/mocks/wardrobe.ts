// ─────────────────────────────────────────────────────────────────────────────
// mocks/wardrobe.ts — 服装数据库样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem } from "@/types/wardrobe";

export const CLOTHING_DATABASE: ClothingItem[] = [
  // 上衣
  { id: "t1", name: "赛博夹克",  category: "top", imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300", rarity: "epic",      price: 299, tags: ["cyberpunk", "jacket"],  isNew: true },
  { id: "t2", name: "霓虹T恤",   category: "top", imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300", rarity: "common",    price: 99,  tags: ["casual", "neon"],       isTrending: true },
  { id: "t3", name: "全息外套",  category: "top", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300", rarity: "legendary", price: 999, tags: ["hologram", "premium"],  isLocked: true },
  { id: "t4", name: "战术背心",  category: "top", imageUrl: "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=300", rarity: "rare",      price: 399, tags: ["tactical", "military"] },
  { id: "t5", name: "发光卫衣",  category: "top", imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300", rarity: "rare",      price: 299, tags: ["led", "hoodie"],        isNew: true },

  // 下装
  { id: "b1", name: "霓虹裤",    category: "bottom", imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300", rarity: "common",    price: 199, tags: ["pants", "neon"] },
  { id: "b2", name: "机械战裤",  category: "bottom", imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300", rarity: "epic",      price: 499, tags: ["mechanical", "combat"] },
  { id: "b3", name: "数据流裙",  category: "bottom", imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300", rarity: "rare",      price: 399, tags: ["skirt", "digital"], isTrending: true },
  { id: "b4", name: "量子短裤",  category: "bottom", imageUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=300", rarity: "legendary", price: 799, tags: ["shorts", "quantum"], isLocked: true },

  // 配饰
  { id: "a1", name: "全息护目镜", category: "accessory", imageUrl: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300", rarity: "epic",      price: 599,  tags: ["goggles", "tech"] },
  { id: "a2", name: "赛博项圈",   category: "accessory", imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300", rarity: "rare",      price: 299,  tags: ["collar", "neon"],   isNew: true },
  { id: "a3", name: "数据耳机",   category: "accessory", imageUrl: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=300", rarity: "legendary", price: 1299, tags: ["headset", "premium"], isLocked: true },
  { id: "a4", name: "发光手环",   category: "accessory", imageUrl: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300", rarity: "common",    price: 99,   tags: ["bracelet", "led"],  isTrending: true },

  // 鞋子
  { id: "s1", name: "霓虹战靴",  category: "shoes", imageUrl: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=300", rarity: "rare",      price: 399,  tags: ["boots", "combat"] },
  { id: "s2", name: "悬浮鞋",    category: "shoes", imageUrl: "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=300", rarity: "legendary", price: 1499, tags: ["hover", "future"],  isLocked: true },
  { id: "s3", name: "数据跑鞋",  category: "shoes", imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300", rarity: "common",    price: 199,  tags: ["sneakers", "casual"], isNew: true },
  { id: "s4", name: "机械战鞋",  category: "shoes", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300", rarity: "epic",      price: 699,  tags: ["mechanical", "heavy"], isTrending: true },

  // 发型
  { id: "h1", name: "霓虹双马尾", category: "hair", imageUrl: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", rarity: "rare",      price: 399, tags: ["twintails", "colorful"] },
  { id: "h2", name: "量子短发",   category: "hair", imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300", rarity: "common",    price: 199, tags: ["short", "modern"],    isNew: true },
  { id: "h3", name: "全息长发",   category: "hair", imageUrl: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300", rarity: "legendary", price: 999, tags: ["long", "hologram"],   isLocked: true },
  { id: "h4", name: "数据马尾",   category: "hair", imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300", rarity: "epic",      price: 499, tags: ["ponytail", "tech"],   isTrending: true },
];
