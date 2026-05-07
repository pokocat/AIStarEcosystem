// ─────────────────────────────────────────────────────────────────────────────
// api/products.ts — Admin 商品库 API。对应 AdminProductsController。
// 路径前缀走 /admin/products/*；与用户端 ProductsController 复用同一 ProductService。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductCategory, ProductInput } from "@/types/product";
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
