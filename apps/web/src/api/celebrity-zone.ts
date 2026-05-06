// ─────────────────────────────────────────────────────────────────────────────
// api/celebrity-zone.ts — 明星专区：模板/盲盒生成 + 浏览/项目/数据 API 封装。
// 当前阶段（前端原型）所有调用走 mock；接入后端时按 specs/openapi.yaml 接 /api/celebrity/*。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityEngine,
  CelebrityProject,
  CelebrityProjectStatus,
  CelebrityProjectVideo,
  CelebrityShowcase,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityZoneOverview,
  CelebrityCategory,
  CelebrityGenerationRequest,
} from "@/types/celebrity-zone";
import type { AsyncJobStarted, ID } from "@/types/_shared";
import {
  ACTIVE_STAR,
  BLINDBOX_SHOWCASES,
  CELEBRITY_PROJECTS,
  CELEBRITY_TEMPLATES,
  MARKET_STARS,
  PROJECT_VIDEOS_MAP,
  STAR_DETAIL_MAP,
  TEMPLATE_SHOWCASES,
  ZONE_OVERVIEW,
} from "@/mocks/celebrity-zone";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";

// ── 明星市场 ────────────────────────────────────────────────────────────────
export interface StarFilter {
  category?: "全部" | CelebrityCategory;
  /** 排序字段 */
  sort?: "hot" | "price-asc" | "price-desc";
}

export async function listStars(filter?: StarFilter): Promise<CelebrityStar[]> {
  if (USE_MOCK) {
    let stars = [...MARKET_STARS];
    if (filter?.category && filter.category !== "全部") {
      const cat = filter.category;
      stars = stars.filter(
        (s) => s.category === cat || s.subCategories?.includes(cat),
      );
    }
    if (filter?.sort === "hot") {
      stars.sort((a, b) => Number(b.isHot) - Number(a.isHot));
    } else if (filter?.sort === "price-asc" || filter?.sort === "price-desc") {
      stars.sort((a, b) => {
        const pa = parseInt(a.startingPrice.replace(/[^\d]/g, ""), 10) || 0;
        const pb = parseInt(b.startingPrice.replace(/[^\d]/g, ""), 10) || 0;
        return filter.sort === "price-asc" ? pa - pb : pb - pa;
      });
    }
    return mockDelay(stars);
  }
  const qs = new URLSearchParams();
  if (filter?.category && filter.category !== "全部") qs.set("category", filter.category);
  if (filter?.sort) qs.set("sort", filter.sort);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<CelebrityStar[]>(`/celebrity/stars${suffix}`);
}

export async function getStar(id: ID): Promise<CelebrityStar | null> {
  if (USE_MOCK) return mockDelay(STAR_DETAIL_MAP[id] ?? null);
  return apiFetch<CelebrityStar | null>(`/celebrity/stars/${id}`);
}

/** 旧接口：保留兼容（部分组件直接使用 ACTIVE_STAR fallback） */
export async function getActiveStar(): Promise<CelebrityStar> {
  if (USE_MOCK) return mockDelay(ACTIVE_STAR);
  return apiFetch<CelebrityStar>("/celebrity/active-star");
}

// ── 模板 / 案例 ─────────────────────────────────────────────────────────────
export async function listTemplates(): Promise<CelebrityTemplate[]> {
  if (USE_MOCK) return mockDelay(CELEBRITY_TEMPLATES);
  return apiFetch<CelebrityTemplate[]>("/celebrity/templates");
}

export async function listTemplateShowcases(): Promise<CelebrityShowcase[]> {
  if (USE_MOCK) return mockDelay(TEMPLATE_SHOWCASES);
  return apiFetch<CelebrityShowcase[]>("/celebrity/showcases?mode=template");
}

export async function listBlindboxShowcases(): Promise<CelebrityShowcase[]> {
  if (USE_MOCK) return mockDelay(BLINDBOX_SHOWCASES);
  return apiFetch<CelebrityShowcase[]>("/celebrity/showcases?mode=blindbox");
}

// ── 项目 ────────────────────────────────────────────────────────────────────
export async function listProjects(
  status?: CelebrityProjectStatus | "全部",
): Promise<CelebrityProject[]> {
  if (USE_MOCK) {
    if (!status || status === "全部") return mockDelay([...CELEBRITY_PROJECTS]);
    return mockDelay(CELEBRITY_PROJECTS.filter((p) => p.status === status));
  }
  const suffix = status && status !== "全部" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<CelebrityProject[]>(`/celebrity/projects${suffix}`);
}

export async function getProject(id: ID): Promise<CelebrityProject | null> {
  if (USE_MOCK) {
    return mockDelay(CELEBRITY_PROJECTS.find((p) => p.id === id) ?? null);
  }
  return apiFetch<CelebrityProject | null>(`/celebrity/projects/${id}`);
}

export async function listProjectVideos(projectId: ID): Promise<CelebrityProjectVideo[]> {
  if (USE_MOCK) return mockDelay(PROJECT_VIDEOS_MAP[projectId] ?? []);
  return apiFetch<CelebrityProjectVideo[]>(`/celebrity/projects/${projectId}/videos`);
}

// ── 视频库（跨项目） ────────────────────────────────────────────────────────
export interface AllVideosFilter {
  status?: CelebrityProjectVideo["status"] | "全部";
  starId?: ID;
  projectId?: ID;
  /** 排序：默认按创建时间倒序 */
  sort?: "createdDesc" | "playsDesc";
}

export async function listAllVideos(
  filter?: AllVideosFilter,
): Promise<CelebrityProjectVideo[]> {
  if (USE_MOCK) {
    let all = Object.values(PROJECT_VIDEOS_MAP).flat();
    if (filter?.status && filter.status !== "全部") {
      all = all.filter((v) => v.status === filter.status);
    }
    if (filter?.starId) all = all.filter((v) => v.starId === filter.starId);
    if (filter?.projectId) all = all.filter((v) => v.projectId === filter.projectId);
    if (filter?.sort === "playsDesc") {
      all.sort((a, b) => parsePlays(b.plays) - parsePlays(a.plays));
    } else {
      all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return mockDelay(all);
  }
  const qs = new URLSearchParams();
  if (filter?.status && filter.status !== "全部") qs.set("status", filter.status);
  if (filter?.starId) qs.set("starId", filter.starId);
  if (filter?.projectId) qs.set("projectId", filter.projectId);
  if (filter?.sort) qs.set("sort", filter.sort);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<CelebrityProjectVideo[]>(`/celebrity/videos${suffix}`);
}

function parsePlays(plays?: string): number {
  if (!plays) return 0;
  const m = plays.match(/^(\d+(?:\.\d+)?)([KMB]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult: Record<string, number> = { "": 1, K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  return n * (mult[m[2]] ?? 1);
}

// ── 创建项目 ────────────────────────────────────────────────────────────────
export interface CreateProjectPayload {
  name: string;
  starId: ID;
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<CelebrityProject> {
  if (USE_MOCK) {
    const star = STAR_DETAIL_MAP[payload.starId];
    return mockDelay({
      id: `proj-${Date.now()}`,
      name: payload.name,
      starId: payload.starId,
      starName: star?.name ?? "",
      starAvatar: star?.avatar ?? "",
      status: "筹备中",
      videoCount: 0,
      totalPlays: "—",
      totalInteractions: "—",
      conversions: 0,
      gmv: "—",
      createdAt: new Date().toISOString().slice(0, 10),
      pricingTier: star?.pricingTier ?? "标准版",
      channels: [],
      quota: { used: 0, total: star?.quotaTotal ?? 0 },
    });
  }
  return apiFetch<CelebrityProject>("/celebrity/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── 批量分发 ────────────────────────────────────────────────────────────────
export async function batchDistribute(
  projectId: ID,
  videoIds: ID[],
  channels: string[],
): Promise<AsyncJobStarted> {
  if (USE_MOCK) {
    return mockDelay({
      jobId: `dist-${Date.now()}`,
      status: "queued",
      pollUrl: "/api/celebrity/jobs/mock",
      pollIntervalMs: 3000,
      estimatedSeconds: 60,
    });
  }
  return apiFetch<AsyncJobStarted>(`/celebrity/projects/${projectId}/distribute`, {
    method: "POST",
    body: JSON.stringify({ videoIds, channels }),
  });
}

// ── 数据中心 ────────────────────────────────────────────────────────────────
export async function getZoneOverview(): Promise<CelebrityZoneOverview> {
  if (USE_MOCK) return mockDelay(ZONE_OVERVIEW);
  return apiFetch<CelebrityZoneOverview>("/celebrity/overview");
}

// ── 引擎计价（后端配置） ────────────────────────────────────────────────────
export interface EnginePricing {
  /** 单条视频积分单价 */
  creditPrice: number;
  /** 占套餐额度的「条数」 */
  quotaCost: number;
}

/** 后端配置：每个引擎单条视频的积分单价 + 套餐额度消耗。 */
export async function getEnginePricing(): Promise<Record<CelebrityEngine, EnginePricing>> {
  if (USE_MOCK) {
    const out = Object.fromEntries(
      (Object.keys(ENGINE_META) as CelebrityEngine[]).map((k) => [
        k,
        {
          creditPrice: ENGINE_META[k].creditPrice,
          quotaCost: ENGINE_META[k].cost,
        },
      ]),
    ) as Record<CelebrityEngine, EnginePricing>;
    return mockDelay(out);
  }
  return apiFetch<Record<CelebrityEngine, EnginePricing>>("/celebrity/engine-pricing");
}

// ── 生成 ────────────────────────────────────────────────────────────────────
export async function startGeneration(
  payload: CelebrityGenerationRequest,
): Promise<AsyncJobStarted> {
  if (USE_MOCK) {
    return mockDelay({
      jobId: `mock-${Date.now()}`,
      status: "queued",
      pollUrl: "/api/celebrity/jobs/mock",
      pollIntervalMs: 3000,
      estimatedSeconds: 180,
    });
  }
  return apiFetch<AsyncJobStarted>("/celebrity/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
