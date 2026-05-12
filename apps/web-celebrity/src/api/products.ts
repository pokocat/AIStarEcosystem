// ─────────────────────────────────────────────────────────────────────────────
// api/products.ts — 商品库领域：增删改查 + 自动落库 + 卖点抽取。
// USE_MOCK 模式下使用模块级数组 + localStorage write-through，刷新后仍可见。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductCategory, ProductInput } from "@ai-star-eco/types/product";
import type { ID } from "@ai-star-eco/types/_shared";
import { SEED_PRODUCTS } from "@/mocks/products";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

const STORAGE_KEY = "aistareco.web.products.v1";

// ── 内存缓存 + 持久化 ───────────────────────────────────────────────────────
let memoryStore: Product[] | null = null;

function loadStore(): Product[] {
  if (memoryStore) return memoryStore;
  if (typeof window === "undefined") {
    memoryStore = [...SEED_PRODUCTS];
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryStore = parsed;
        return memoryStore;
      }
    }
  } catch {
    /* 隐私模式 / parse 失败 → 走 seed */
  }
  memoryStore = [...SEED_PRODUCTS];
  saveStore();
  return memoryStore;
}

function saveStore() {
  if (typeof window === "undefined" || !memoryStore) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    /* storage 满，静默失败；下次启动恢复 seed */
  }
}

function nextId() {
  return `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── 公共 API ────────────────────────────────────────────────────────────────
export interface ProductFilter {
  category?: ProductCategory | "全部";
  q?: string;
}

export async function listProducts(filter?: ProductFilter): Promise<Product[]> {
  if (USE_MOCK) {
    let list = [...loadStore()];
    if (filter?.category && filter.category !== "全部") {
      const cat = filter.category;
      list = list.filter((p) => p.category === cat);
    }
    if (filter?.q?.trim()) {
      const q = filter.q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sellingPoints ?? "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return mockDelay(list);
  }
  const qs = new URLSearchParams();
  if (filter?.category && filter.category !== "全部") qs.set("category", filter.category);
  if (filter?.q?.trim()) qs.set("q", filter.q.trim());
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<Product[]>(`/products${suffix}`);
}

export async function getProduct(id: ID): Promise<Product | null> {
  if (USE_MOCK) return mockDelay(loadStore().find((p) => p.id === id) ?? null);
  return apiFetch<Product | null>(`/products/${id}`);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  if (USE_MOCK) {
    const now = today();
    const created: Product = {
      id: nextId(),
      name: input.name.trim(),
      category: input.category,
      link: input.link?.trim() || undefined,
      images: input.images?.length ? input.images : [],
      sellingPoints: (input.sellingPoints ?? "").trim(),
      usageCount: 0,
      source: input.source ?? "manual",
      createdAt: now,
      updatedAt: now,
    };
    const store = loadStore();
    store.unshift(created);
    saveStore();
    return mockDelay(created);
  }
  return apiFetch<Product>("/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  id: ID,
  patch: Partial<ProductInput>,
): Promise<Product> {
  if (USE_MOCK) {
    const store = loadStore();
    const idx = store.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error(`Product ${id} not found`);
    const merged: Product = {
      ...store[idx],
      ...patch,
      name: (patch.name ?? store[idx].name).trim(),
      images: patch.images ?? store[idx].images,
      sellingPoints: (patch.sellingPoints ?? store[idx].sellingPoints).trim(),
      updatedAt: today(),
    };
    store[idx] = merged;
    saveStore();
    return mockDelay(merged);
  }
  return apiFetch<Product>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteProduct(id: ID): Promise<void> {
  if (USE_MOCK) {
    const store = loadStore();
    const next = store.filter((p) => p.id !== id);
    memoryStore = next;
    saveStore();
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}

/**
 * 视频生成时调用：按 link/name 匹配已有商品 → +usageCount；找不到则自动建档。
 */
export async function upsertFromGeneration(
  input: { name: string; link?: string; sellingPoints?: string; images?: string[] },
): Promise<Product> {
  if (USE_MOCK) {
    const store = loadStore();
    const trimmedName = input.name.trim();
    const trimmedLink = input.link?.trim();
    if (!trimmedName) throw new Error("商品名称不能为空");

    const existing = store.find(
      (p) =>
        (trimmedLink && p.link && p.link.trim() === trimmedLink) ||
        p.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (existing) {
      existing.usageCount += 1;
      existing.updatedAt = today();
      saveStore();
      return mockDelay(existing);
    }
    return createProduct({
      name: trimmedName,
      category: "其他",
      link: trimmedLink,
      sellingPoints: input.sellingPoints,
      images: input.images,
      source: "auto-from-generation",
    });
  }
  return apiFetch<Product>("/products/upsert-from-generation", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** mock LLM 卖点抽取：根据商品名 + 链接产出一段固定模板的卖点。 */
export async function extractSellingPoints(input: {
  name: string;
  link: string;
}): Promise<{ sellingPoints: string }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    const trimmed = input.name.trim();
    return {
      sellingPoints:
        `${trimmed}：精选优质原料，工艺细节考究；上身/上脸效果显著，` +
        `用户好评 95%+。日常通勤 / 节日送礼 / 自用囤货皆宜，下单立享平台保障。`,
    };
  }
  return apiFetch<{ sellingPoints: string }>("/products/extract-selling-points", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
