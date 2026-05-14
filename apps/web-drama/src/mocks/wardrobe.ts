// ─────────────────────────────────────────────────────────────────────────────
// mocks/wardrobe.ts — 短剧服装库样本数据。
// 按 drama 主线（都市 / 古风 / 民国 / 校园 / 商务）组织五类服装；
// rarity 不再是「霓虹 / 全息」，而是「常用 / 特定剧组 / 限定授权 / 顶级合作」。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClothingItem } from "@ai-star-eco/types/wardrobe";

export const CLOTHING_DATABASE: ClothingItem[] = [
  // ── 上衣 ──────────────────────────────────────────────────────────────────
  { id: "t1", name: "经典白衬衫",       category: "top", imageUrl: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300", rarity: "common",    price: 220, tags: ["都市", "通勤"],     isNew: true },
  { id: "t2", name: "米色针织开衫",     category: "top", imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=300", rarity: "common",    price: 320, tags: ["都市", "校园"],     isTrending: true },
  { id: "t3", name: "都市西装马甲",     category: "top", imageUrl: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=300", rarity: "rare",      price: 680, tags: ["商务", "都市"] },
  { id: "t4", name: "法式茶歇衫",       category: "top", imageUrl: "https://images.unsplash.com/photo-1485518882345-15568b007407?w=300", rarity: "rare",      price: 460, tags: ["都市", "约会"],     isNew: true },
  { id: "t5", name: "国风立领上衣",     category: "top", imageUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=300", rarity: "epic",      price: 980, tags: ["古风", "国风"] },
  { id: "t6", name: "民国学生袄",       category: "top", imageUrl: "https://images.unsplash.com/photo-1551803091-e20673f15770?w=300", rarity: "epic",      price: 1080, tags: ["民国", "年代"], isLocked: true },

  // ── 下装 ──────────────────────────────────────────────────────────────────
  { id: "b1", name: "高腰阔腿西裤",     category: "bottom", imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300", rarity: "common",    price: 380, tags: ["都市", "通勤"] },
  { id: "b2", name: "A 字伞裙",         category: "bottom", imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300", rarity: "rare",      price: 420, tags: ["都市", "约会"], isTrending: true },
  { id: "b3", name: "牛仔直筒长裤",     category: "bottom", imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300", rarity: "common",    price: 320, tags: ["校园", "都市"] },
  { id: "b4", name: "古风马面裙",       category: "bottom", imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300", rarity: "legendary", price: 1480, tags: ["古风", "国风"], isLocked: true },
  { id: "b5", name: "民国月华裙",       category: "bottom", imageUrl: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=300", rarity: "epic",      price: 980, tags: ["民国", "年代"] },

  // ── 配饰 ──────────────────────────────────────────────────────────────────
  { id: "a1", name: "珍珠耳钉",         category: "accessory", imageUrl: "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=300", rarity: "common",    price: 180, tags: ["都市", "约会"] },
  { id: "a2", name: "简约金链项链",     category: "accessory", imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300", rarity: "rare",      price: 460, tags: ["商务", "都市"], isNew: true },
  { id: "a3", name: "复古玳瑁眼镜",     category: "accessory", imageUrl: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300", rarity: "rare",      price: 280, tags: ["民国", "校园"], isTrending: true },
  { id: "a4", name: "刺绣手帕",         category: "accessory", imageUrl: "https://images.unsplash.com/photo-1582142306909-195724d33d18?w=300", rarity: "epic",      price: 320, tags: ["民国", "年代"] },
  { id: "a5", name: "古风发簪",         category: "accessory", imageUrl: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300", rarity: "legendary", price: 1280, tags: ["古风", "国风"], isLocked: true },

  // ── 鞋子 ──────────────────────────────────────────────────────────────────
  { id: "s1", name: "尖头细高跟",       category: "shoes", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300", rarity: "common",    price: 480, tags: ["都市", "通勤"] },
  { id: "s2", name: "复古玛丽珍",       category: "shoes", imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=300", rarity: "rare",      price: 580, tags: ["民国", "校园"], isTrending: true },
  { id: "s3", name: "老北京布鞋",       category: "shoes", imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300", rarity: "rare",      price: 380, tags: ["古风", "年代"] },
  { id: "s4", name: "牛津商务皮鞋",     category: "shoes", imageUrl: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=300", rarity: "epic",      price: 980, tags: ["商务", "都市"], isNew: true },

  // ── 发型 ──────────────────────────────────────────────────────────────────
  { id: "h1", name: "低马尾",           category: "hair", imageUrl: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300", rarity: "common",    price: 120, tags: ["都市", "通勤"] },
  { id: "h2", name: "内扣短发",         category: "hair", imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300", rarity: "common",    price: 160, tags: ["都市", "校园"], isNew: true },
  { id: "h3", name: "中分及腰长发",     category: "hair", imageUrl: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300", rarity: "rare",      price: 320, tags: ["古风", "都市"], isTrending: true },
  { id: "h4", name: "古装高髻",         category: "hair", imageUrl: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=300", rarity: "legendary", price: 1080, tags: ["古风", "国风"], isLocked: true },
];
