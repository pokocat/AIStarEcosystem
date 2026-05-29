// ─────────────────────────────────────────────────────────────────────────────
// api/products.ts — 商品库（v0.31 起：所有人可读；写操作仅运营角色可调）。
//
// 读路径（任意已登录用户）：
//   - listProducts / getProduct → GET /api/products(/{id})
//   - extractSellingPoints      → POST /api/products/extract-selling-points（不写库）
//   - parseProductLink          → POST /api/me/products/parse-link（不写库）
//
// 写路径（仅 operatorRole ∈ {operator, super_admin} 的账号可调；server 端
// /api/admin/** 的 hasAnyRole 门禁会兜底，前端再做角色条件渲染避免误点）：
//   - createProduct / updateProduct / deleteProduct
//   - parseAndCreateProduct   → POST /api/admin/products/from-link
//   - refreshProductImages    → POST /api/admin/products/{id}/refresh-images
//
// USE_MOCK 模式下走模块级数组（仅本地无 server 演示）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, ProductCategory, ProductInput } from "@ai-star-eco/types/product";
import type { ProductLinkInfo } from "@ai-star-eco/types/product-link";
import type { ID } from "@ai-star-eco/types/_shared";
import { SEED_PRODUCTS } from "@/mocks/products";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

const STORAGE_KEY = "aistareco.web.products.v2";
const LEGACY_STORAGE_KEYS = ["aistareco.web.products.v1"] as const;

let memoryStore: Product[] | null = null;

function loadStore(): Product[] {
  if (memoryStore) return memoryStore;
  if (typeof window === "undefined") {
    memoryStore = [...SEED_PRODUCTS];
    return memoryStore;
  }
  try {
    for (const legacy of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(legacy);
    }
  } catch {
    /* 隐私模式静默 */
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
    /* 解析失败 → 走 seed */
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
    /* storage 满，静默失败 */
  }
}

function nextId() {
  return `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── 公共读 API ─────────────────────────────────────────────────────────────
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

// ── 运营写 API（调 /admin/products/**；前端再做角色条件渲染） ───────────
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
  return apiFetch<Product>("/admin/products", { method: "POST", body: input });
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
  return apiFetch<Product>(`/admin/products/${encodeURIComponent(id)}`, {
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
  await apiFetch<void>(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * 仅解析，不写库。任意已登录用户均可调（dialog 预览用）；server 端 /api/me/**
 * authenticated 守门，防 SSRF。
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
 * 仅运营角色可调（server 端 /api/admin/** hasAnyRole 门禁）。
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
  return apiFetch<Product>("/admin/products/from-link", {
    method: "POST",
    body: { url },
  });
}

/**
 * 给已存在的商品「刷新图片」。仅运营角色可调。
 * @returns 新登记的 MixcutAsset 数量（0 = 解析失败 / 无图）
 */
export async function refreshProductImages(productId: string): Promise<number> {
  if (USE_MOCK) {
    const store = loadStore();
    const idx = store.findIndex((p) => p.id === productId);
    if (idx < 0) return mockDelay(0);
    const p = store[idx];
    if (!p.link) return mockDelay(0);
    const info = parseProductLinkInBrowser(p.link);
    if (!info || info.imageUrls.length === 0) return mockDelay(0);
    store[idx] = { ...p, images: info.imageUrls, updatedAt: today() };
    saveStore();
    return mockDelay(info.imageUrls.length);
  }
  const res = await apiFetch<{ registered: number }>(
    `/admin/products/${encodeURIComponent(productId)}/refresh-images`,
    { method: "POST", body: {} },
  );
  return res.registered;
}

/** LLM 卖点抽取。任意登录用户可调；只返回文本，不直接写商品库。 */
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

// ── 内部 helpers ───────────────────────────────────────────────────────────

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
