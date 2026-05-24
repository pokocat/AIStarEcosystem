// ─────────────────────────────────────────────────────────────────────────────
// product.ts — 商品库领域：可被多次复用于带货视频生成的商品档案。
// 设计源：AI 明星专区 · 第三轮打磨（增加商品库）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type ProductCategory =
  | "美妆"
  | "食品饮料"
  | "数码 3C"
  | "服饰"
  | "日用百货"
  | "母婴"
  | "运动"
  | "其他";

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "美妆",
  "食品饮料",
  "数码 3C",
  "服饰",
  "日用百货",
  "母婴",
  "运动",
  "其他",
];

/** 商品来源：手动录入（用户在商品库主动创建）/ 自动落库（生成视频时由系统补建） */
export type ProductSource = "manual" | "auto-from-generation";

export interface Product {
  id: ID;
  name: string;
  category: ProductCategory;
  /** 商品外部链接（淘宝/京东/天猫/小红书等），可选 */
  link?: string;
  /** 商品图片 URL 列表（至少 1 张占位） */
  images: string[];
  /** 卖点描述（可被 AI 自动抽取覆盖） */
  sellingPoints: string;
  /** 累计被多少条带货视频引用 */
  usageCount: number;
  source: ProductSource;
  /** v0.28+: 售价（人民币分）。空值表示价格未抓到或不展示。 */
  priceCents?: number;
  /** v0.28+: 佣金率（百分比整数，如 18 表示 18%）。 */
  commissionRate?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 创建 / 更新时的入参（id / 用量 / 时间戳由后端生成） */
export interface ProductInput {
  name: string;
  category: ProductCategory;
  link?: string;
  images?: string[];
  sellingPoints?: string;
  /** 默认 manual；自动落库时由后端置为 auto-from-generation */
  source?: ProductSource;
  priceCents?: number;
  commissionRate?: number;
}

/** v0.31+ /admin/products/from-link 解析端的响应 schema（与 /me/products/parse-link 一致）。 */
export interface ProductLinkInfo {
  title?: string;
  imageUrls: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  sales?: number;
  inferredSellingPoints?: string;
  source: string;
}
