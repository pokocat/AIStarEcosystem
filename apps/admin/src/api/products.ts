// ─────────────────────────────────────────────────────────────────────────────
// api/products.ts — Admin 商品库 API。对应 AdminProductsController（/api/admin/products/**）。
//
// v0.31 起新增三条写入辅助：
//   - parseLink             — 仅解析，不写库（用于 fromLink dialog 的预览）
//   - fromLink              — 抖音链接解析 + 落 Product + 登记 MixcutAsset
//   - refreshImages         — 已存在商品重新抓图
//   - extractSellingPoints  — Mock LLM 卖点建议
//
// 所有端点仅 SUPER_ADMIN / OPERATOR 可调（server 端 /api/admin/** 强制 hasAnyRole）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductCategory, ProductInput, ProductLinkInfo } from "@/types/product";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";
import { ADMIN_PRODUCTS } from "@/mocks/products";

export interface ProductFilter {
  category?: ProductCategory | "全部";
  q?: string;
}

export async function listProducts(filter?: ProductFilter): Promise<Product[]> {
  if (USE_MOCK) {
    let list = [...ADMIN_PRODUCTS];
    if (filter?.category && filter.category !== "全部") {
      list = list.filter((p) => p.category === filter.category);
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sellingPoints.toLowerCase().includes(q),
      );
    }
    return mockDelay(list);
  }
  const query: Record<string, unknown> = {};
  if (filter?.category && filter.category !== "全部") query.category = filter.category;
  if (filter?.q?.trim()) query.q = filter.q.trim();
  return apiFetch<Product[]>(`/admin/products${buildQuery(query)}`);
}

export async function getProduct(id: string): Promise<Product | null> {
  if (USE_MOCK) return mockDelay(ADMIN_PRODUCTS.find((p) => p.id === id) ?? null);
  return apiFetch<Product | null>(`/admin/products/${encodeURIComponent(id)}`);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (USE_MOCK) {
    const today = new Date().toISOString().slice(0, 10);
    const created: Product = {
      id: `prod-${Date.now().toString(36)}`,
      name: input.name,
      category: input.category,
      link: input.link,
      images: input.images ?? [],
      sellingPoints: input.sellingPoints ?? "",
      usageCount: 0,
      source: input.source ?? "manual",
      priceCents: input.priceCents,
      commissionRate: input.commissionRate,
      createdAt: today,
      updatedAt: today,
    };
    return mockDelay(created);
  }
  return apiFetch<Product>("/admin/products", { method: "POST", body: input });
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  if (USE_MOCK) {
    const found = ADMIN_PRODUCTS.find((p) => p.id === id);
    if (!found) throw new Error(`Product ${id} not found`);
    return mockDelay({ ...found, ...patch, updatedAt: new Date().toISOString().slice(0, 10) });
  }
  return apiFetch<Product>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteProduct(id: string): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── v0.31+ 链接解析 + 落库 + 补图 ──────────────────────────────────────────

/** 仅解析，不写库；与 /api/me/products/parse-link 同。Mock 模式返回 null。 */
export async function parseLink(url: string): Promise<ProductLinkInfo | null> {
  if (USE_MOCK) return mockDelay(null);
  try {
    return await apiFetch<ProductLinkInfo>("/me/products/parse-link", {
      method: "POST",
      body: { url },
    });
  } catch {
    return null;
  }
}

/** 解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)。 */
export async function fromLink(url: string): Promise<Product> {
  if (USE_MOCK) {
    const today = new Date().toISOString().slice(0, 10);
    return mockDelay<Product>({
      id: `prod-${Date.now().toString(36)}`,
      name: "（mock）抖音链接解析占位",
      category: "日用百货",
      link: url,
      images: [],
      sellingPoints: "",
      usageCount: 0,
      source: "manual",
      createdAt: today,
      updatedAt: today,
    });
  }
  return apiFetch<Product>("/admin/products/from-link", {
    method: "POST",
    body: { url },
  });
}

/** 已存在商品的补图通道，返回新增 MixcutAsset 数量。 */
export async function refreshImages(productId: string): Promise<number> {
  if (USE_MOCK) return mockDelay(0);
  const res = await apiFetch<{ registered: number }>(
    `/admin/products/${encodeURIComponent(productId)}/refresh-images`,
    { method: "POST", body: {} },
  );
  return res.registered;
}

/** Mock LLM 卖点抽取（建档辅助）。 */
export async function extractSellingPoints(input: {
  name: string;
  link: string;
}): Promise<{ sellingPoints: string }> {
  if (USE_MOCK) {
    return mockDelay({
      sellingPoints: `${input.name.trim()}：精选优质原料，工艺细节考究；上身/上脸效果显著，用户好评 95%+。`,
    });
  }
  return apiFetch<{ sellingPoints: string }>("/admin/products/extract-selling-points", {
    method: "POST",
    body: input,
  });
}
