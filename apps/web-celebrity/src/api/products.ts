// ─────────────────────────────────────────────────────────────────────────────
// api/products.ts — 商品库领域：增删改查 + 自动落库 + 卖点抽取。
// USE_MOCK 模式下使用模块级数组 + localStorage write-through，刷新后仍可见。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductCategory, ProductInput } from "@ai-star-eco/types/product";
import type { ProductLinkInfo } from "@ai-star-eco/types/product-link";
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
      priceCents: input.priceCents,
      commissionRate: input.commissionRate,
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
    body: input,
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
    body: patch,
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
    body: input,
  });
}

// ── v0.26+ 商品链接解析 ─────────────────────────────────────────────────────

/**
 * 仅解析，不写库。用于 ProductFormDialog 的「📋 从抖音链接解析」按钮预览。
 * Mock 模式：纯前端 URL parse（仅支持形态 A 长链 query 内嵌 goods_detail）。
 * 真后端：POST /api/me/products/parse-link，命中策略链 handler 之一。
 *
 * 解析失败统一返回 null（前端 toast「未能从链接解析」），不抛错。
 */
export async function parseProductLink(url: string): Promise<ProductLinkInfo | null> {
  if (USE_MOCK) {
    return mockDelay(parseProductLinkInBrowser(url));
  }
  try {
    return await apiFetch<ProductLinkInfo>("/me/products/parse-link", {
      method: "POST",
      body: { url },
    });
  } catch {
    return null;
  }
}

/**
 * 解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)。
 * Mock 模式：复用 parseProductLinkInBrowser → 走 createProduct（不模拟 MixcutAsset 端，
 * 这条只是 happy-path 占位；真演示需 REAL_BACKEND）。
 */
export async function parseAndCreateProduct(url: string): Promise<Product> {
  if (USE_MOCK) {
    const info = parseProductLinkInBrowser(url);
    if (!info) throw new Error("未能从链接解析，请改用「快速录入」手动填");
    return createProduct({
      name: info.title || "未命名商品",
      category: "日用百货",
      link: url,
      images: info.imageUrls,
      sellingPoints: info.inferredSellingPoints,
      source: "manual",
      priceCents: info.minPriceCents,
    });
  }
  return apiFetch<Product>("/me/products/from-link", {
    method: "POST",
    body: { url },
  });
}

/**
 * 纯前端兜底：仅处理「分享长链含 goods_detail JSON」的形态。Mock 模式才走。
 * 真后端模式由 server handler 统一处理（含 PC 选品库短链）。
 */
function parseProductLinkInBrowser(rawUrl: string): ProductLinkInfo | null {
  try {
    const url = new URL(rawUrl);
    const host = url.host;
    if (!host.endsWith("jinritemai.com") && !host.endsWith("douyin.com")) return null;
    const goodsDetailRaw = url.searchParams.get("goods_detail");
    if (!goodsDetailRaw) return null;
    const decoded = JSON.parse(goodsDetailRaw) as {
      title?: string;
      sales?: number;
      img?: { url_list?: string[] };
      min_price?: number;
      max_price?: number;
    };
    const urlList = (decoded.img?.url_list ?? []).filter(Boolean);
    const p3 = urlList.filter((u) => u.includes("//p3-"));
    const others = urlList.filter((u) => !u.includes("//p3-"));
    const imageUrls = Array.from(new Set([...p3, ...others]));
    const minPriceCents = typeof decoded.min_price === "number" ? decoded.min_price : undefined;
    const maxPriceCents = typeof decoded.max_price === "number" ? decoded.max_price : undefined;
    const sales = typeof decoded.sales === "number" ? decoded.sales : undefined;
    return {
      title: decoded.title,
      imageUrls,
      minPriceCents,
      maxPriceCents,
      sales,
      inferredSellingPoints: composeInferredSellingPoints(minPriceCents, maxPriceCents, sales),
      source: "douyin-query-embedded",
    };
  } catch {
    return null;
  }
}

function composeInferredSellingPoints(min?: number, max?: number, sales?: number): string | undefined {
  const parts: string[] = [];
  if (min != null && max != null) {
    parts.push(min === max ? `价格 ${formatYuan(min)}` : `价格 ${formatYuan(min)}-${formatYuan(max)}`);
  } else if (min != null) {
    parts.push(`价格 ${formatYuan(min)}`);
  }
  if (sales != null && sales > 0) {
    parts.push(sales >= 10000 ? `销量 ${(sales / 10000).toFixed(1)}w+` : `销量 ${sales}`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

function formatYuan(cents: number): string {
  const yuan = Math.floor(cents / 100);
  const cs = cents % 100;
  if (cs === 0) return `¥${yuan}`;
  return `¥${yuan}.${String(cs).padStart(2, "0")}`;
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
    body: input,
  });
}
