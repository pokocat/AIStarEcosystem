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

let cache: Promise<DramaCatalog> | null = null;

export function getCatalog(): Promise<DramaCatalog> {
  if (!cache) {
    const source = USE_MOCK
      ? mockDelay<Partial<CatalogWire>>({}, 60)
      : apiFetch<CatalogWire>("/me/drama/catalog");
    cache = source
      .then(merge)
      .catch(() => {
        cache = null; // 失败不缓存，下次重试
        return CATALOG_DEFAULTS; // 拉取失败回退默认，不阻塞页面
      });
  }
  return cache;
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
