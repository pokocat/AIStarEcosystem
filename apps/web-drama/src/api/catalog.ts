// ─────────────────────────────────────────────────────────────────────────────
// api/catalog.ts — 短剧「平台目录 / 灵感」内容（v0.67）。
// 平台提供、运营可维护：内容类型 / 模板库 / 短视频格式 / 近期热点 / 创意推荐。
// 后端：/api/me/drama/catalog（读：任意已登录；写：仅运营 OPERATOR/SUPER_ADMIN）。
// 内置 mock 作为默认值（后端未配某项时回退），不在后端重复一份；运营改了即覆盖。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  CONTENT_TYPES,
  HOT_TOPICS,
  IDEA_POOL,
  SHORT_FORMATS,
  TEMPLATES,
  type ContentType,
  type IdeaRec,
  type ShortFormat,
  type Template,
} from "@/mocks/drama-workshop";

export type HotTopic = { label: string; idea: string };

export interface DramaCatalog {
  contentTypes: ContentType[];
  templates: Record<string, Template[]>;
  formats: ShortFormat[];
  hotTopics: HotTopic[];
  ideas: IdeaRec[];
}

/** 内置默认目录（= 当前 mock）。后端未配置对应项时用它。 */
export const CATALOG_DEFAULTS: DramaCatalog = {
  contentTypes: CONTENT_TYPES,
  templates: TEMPLATES,
  formats: SHORT_FORMATS,
  hotTopics: HOT_TOPICS,
  ideas: IDEA_POOL,
};

export type CatalogField = keyof DramaCatalog;

/** 后端 wire：每项为运营已配的值，未配则 null。 */
type CatalogWire = { [K in CatalogField]: DramaCatalog[K] | null };

function merge(w: CatalogWire | Partial<CatalogWire>): DramaCatalog {
  return {
    contentTypes: w.contentTypes ?? CATALOG_DEFAULTS.contentTypes,
    templates: w.templates ?? CATALOG_DEFAULTS.templates,
    formats: w.formats ?? CATALOG_DEFAULTS.formats,
    hotTopics: w.hotTopics ?? CATALOG_DEFAULTS.hotTopics,
    ideas: w.ideas ?? CATALOG_DEFAULTS.ideas,
  };
}

/** 进程内缓存：进行中或已成功的那次读取。缓存的是「原样」结果 —— 失败时它是 reject 的，
 *  回落默认值在 getCatalog 里按调用方要求再做，这样严格读和普通读可以共用同一次请求。 */
let cache: Promise<DramaCatalog> | null = null;

function loadCatalog(): Promise<DramaCatalog> {
  if (!cache) {
    const source = USE_MOCK
      ? mockDelay<Partial<CatalogWire>>({}, 60)
      : apiFetch<CatalogWire>("/me/drama/catalog");
    const p = source.then(merge);
    cache = p;
    // 失败不缓存，下次重试（只清自己：期间被 invalidateCatalog 换成新请求的，不去动它）。
    p.catch(() => {
      if (cache === p) cache = null;
    });
  }
  return cache;
}

export interface GetCatalogOptions {
  /**
   * 严格读：读失败直接抛原始错误，不回落 CATALOG_DEFAULTS。
   * 要把读到的内容再写回去的页面（运营「热点与推荐」）必须用它 —— 否则读失败时编辑区里是默认值，
   * 一点发布就把线上内容盖成默认。只是展示的页面用默认读法（失败回落默认，不阻塞页面）。
   *
   * 注意「后端某项没配（wire 里是 null）」不算读失败：那一项线上用的本来就是默认值，严格读也照样补上。
   */
  strict?: boolean;
}

export function getCatalog(opts?: GetCatalogOptions): Promise<DramaCatalog> {
  const p = loadCatalog();
  if (opts?.strict) return p;
  return p.catch(() => CATALOG_DEFAULTS); // 拉取失败回退默认，不阻塞页面
}

export function invalidateCatalog(): void {
  cache = null;
}

/** 运营写入某个目录（整体覆盖）。成功后清缓存让下次拉到新值。 */
export async function saveCatalog<K extends CatalogField>(
  field: K,
  value: DramaCatalog[K],
): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined, 120);
    invalidateCatalog();
    return;
  }
  await apiFetch<unknown>(`/me/drama/catalog/${field}`, { method: "PUT", body: value });
  invalidateCatalog();
}

/**
 * 运营手动触发：后端抓抖音热搜 → LLM 蒸馏成短剧选题钩子，返回候选（不落库）。
 * 运营审核后再经 saveCatalog("hotTopics", ...) 采用。USE_MOCK 下返回少量示例。
 */
export async function generateHotspots(max = 12): Promise<string[]> {
  if (USE_MOCK) {
    return mockDelay(
      ["闪婚老公竟是隐藏首富", "重生后我把渣男一家送进局子", "实习生身份曝光：我是集团董事长"],
      600,
    );
  }
  const res = await apiFetch<{ candidates: string[] }>("/me/drama/catalog/generate-hotspots", {
    method: "POST",
    body: { max },
  });
  return Array.isArray(res?.candidates) ? res.candidates : [];
}

/** 运营恢复某目录为内置默认（删除后端 override）。 */
export async function resetCatalog(field: CatalogField): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined, 100);
    invalidateCatalog();
    return;
  }
  await apiFetch<unknown>(`/me/drama/catalog/${field}`, { method: "DELETE" });
  invalidateCatalog();
}
