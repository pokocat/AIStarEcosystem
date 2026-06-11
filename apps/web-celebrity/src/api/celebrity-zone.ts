// ─────────────────────────────────────────────────────────────────────────────
// api/celebrity-zone.ts — 明星专区：模板/盲盒生成 + 浏览/项目/数据 API 封装。
// 当前阶段（前端原型）所有调用走 mock；接入后端时按 specs/openapi.yaml 接 /api/celebrity/*。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityEngine,
  CelebrityProject,
  CelebrityProjectStatus,
  CelebrityProjectVideo,
  CelebrityPricingTier,
  CelebrityShowcase,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityZoneOverview,
  CelebrityCategory,
  CelebrityGenerationRequest,
} from "@ai-star-eco/types/celebrity-zone";
import type { AsyncJobStarted, ID } from "@ai-star-eco/types/_shared";
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

const DELETED_PROJECT_VIDEOS_KEY = "aistareco.web.celebrity.deleted-project-videos.v1";

function readDeletedProjectVideos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_PROJECT_VIDEOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDeletedProjectVideos(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DELETED_PROJECT_VIDEOS_KEY, JSON.stringify(ids));
  } catch {
    /* storage 满 / 隐私模式静默 */
  }
}

function visibleProjectVideos(videos: CelebrityProjectVideo[]): CelebrityProjectVideo[] {
  if (!USE_MOCK) return videos;
  const deleted = new Set(readDeletedProjectVideos());
  return videos.filter((v) => !deleted.has(v.id));
}

type RawPricingTier = Partial<CelebrityPricingTier> & {
  perks?: unknown;
  quota?: unknown;
};

function normalizePricingFeatures(raw: RawPricingTier): string[] {
  if (Array.isArray(raw.features)) return raw.features.filter((f): f is string => typeof f === "string");
  if (Array.isArray(raw.perks)) return raw.perks.filter((f): f is string => typeof f === "string");
  if (typeof raw.quota === "number" && Number.isFinite(raw.quota)) return [`${raw.quota} 条生成额度`];
  return ["按授权规则开通使用"];
}

function normalizePricingTier(raw: RawPricingTier, index: number): CelebrityPricingTier {
  const name = (typeof raw.name === "string" && raw.name ? raw.name : "体验版") as CelebrityPricingTier["name"];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `${name}-${index + 1}`,
    name,
    price: typeof raw.price === "string" && raw.price ? raw.price : "议价",
    features: normalizePricingFeatures(raw),
    recommended: typeof raw.recommended === "boolean" ? raw.recommended : name === "标准版" || index === 1,
  };
}

function normalizeStar(star: CelebrityStar | null): CelebrityStar | null {
  if (!star) return star;
  const auth = (star.authorization ?? {}) as Partial<CelebrityStar["authorization"]>;
  const stats = (star.stats ?? {}) as Partial<CelebrityStar["stats"]>;
  return {
    ...star,
    subCategories: Array.isArray(star.subCategories) ? star.subCategories : [],
    authorization: {
      status: auth.status ?? "unauthorized",
      scenes: Array.isArray(auth.scenes) ? auth.scenes : [],
      expireDate: auth.expireDate,
      availableStyles: typeof auth.availableStyles === "number" ? auth.availableStyles : 0,
      pendingNote: auth.pendingNote,
      applyUrl: auth.applyUrl,
    },
    stats: {
      totalGenerated: typeof stats.totalGenerated === "number" ? stats.totalGenerated : 0,
      totalPlays: stats.totalPlays ?? "—",
      conversionRate: stats.conversionRate ?? "—",
      gmv: stats.gmv ?? "—",
    },
    sampleVideos: Array.isArray(star.sampleVideos) ? star.sampleVideos : [],
    pricing: Array.isArray(star.pricing) ? star.pricing.map((tier, idx) => normalizePricingTier(tier, idx)) : [],
    photos: Array.isArray(star.photos) ? star.photos : [],
    videos: Array.isArray(star.videos) ? star.videos : [],
  };
}

function normalizeStars(stars: CelebrityStar[]): CelebrityStar[] {
  return stars.map((star) => normalizeStar(star)).filter((star): star is CelebrityStar => Boolean(star));
}

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
  return normalizeStars(await apiFetch<CelebrityStar[]>(`/celebrity/stars${suffix}`));
}

export async function getStar(id: ID): Promise<CelebrityStar | null> {
  if (USE_MOCK) return mockDelay(STAR_DETAIL_MAP[id] ?? null);
  return normalizeStar(await apiFetch<CelebrityStar | null>(`/celebrity/stars/${id}`));
}

/** 旧接口：保留兼容（部分组件直接使用 ACTIVE_STAR fallback） */
export async function getActiveStar(): Promise<CelebrityStar> {
  if (USE_MOCK) return mockDelay(ACTIVE_STAR);
  return normalizeStar(await apiFetch<CelebrityStar>("/celebrity/active-star"))!;
}

// ── 明星运营管理（v0.55+） ─────────────────────────────────────────────────────
// web-celebrity 内嵌运营写入：URL 全走 /admin/celebrity/*，由 server 端
// hasAnyRole(SUPER_ADMIN, OPERATOR) 兜底（沿用 v0.31 商品库同款模式）。
// 普通用户前端不暴露入口；即便绕过 UI 直接调用，server 也会 403。

/** 由 Partial 合出一个完整 CelebrityStar（仅 USE_MOCK 用，保证演示/类型完整）。 */
function mockStarFrom(body: Partial<CelebrityStar>, base?: CelebrityStar | null): CelebrityStar {
  return {
    id: base?.id ?? `star-${Date.now()}`,
    name: body.name ?? base?.name ?? "未命名明星",
    avatar: body.avatar ?? base?.avatar ?? "",
    cover: body.cover ?? base?.cover ?? "",
    category: body.category ?? base?.category ?? "演员",
    subCategories: body.subCategories ?? base?.subCategories,
    isHot: body.isHot ?? base?.isHot ?? false,
    description: body.description ?? base?.description ?? "",
    startingPrice: body.startingPrice ?? base?.startingPrice ?? "¥99起",
    pricingTier: body.pricingTier ?? base?.pricingTier,
    quotaUsed: base?.quotaUsed,
    quotaTotal: body.quotaTotal ?? base?.quotaTotal,
    authorization:
      base?.authorization ?? { status: "unauthorized", scenes: [], availableStyles: 0 },
    stats: base?.stats ?? { totalGenerated: 0, totalPlays: "0", conversionRate: "0%", gmv: "¥0" },
    sampleVideos: base?.sampleVideos ?? [],
    pricing: base?.pricing ?? [],
  };
}

export async function createStar(body: Partial<CelebrityStar>): Promise<CelebrityStar> {
  if (USE_MOCK) return mockDelay(mockStarFrom(body));
  return apiFetch<CelebrityStar>("/admin/celebrity/stars", { method: "POST", body });
}

export async function updateStar(id: ID, body: Partial<CelebrityStar>): Promise<CelebrityStar> {
  if (USE_MOCK) {
    const base = STAR_DETAIL_MAP[id] ?? MARKET_STARS.find((s) => s.id === id) ?? null;
    return mockDelay(mockStarFrom(body, base ? { ...base, id } : null));
  }
  return apiFetch<CelebrityStar>(`/admin/celebrity/stars/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}

export async function deleteStar(id: ID): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(null);
    return;
  }
  await apiFetch<void>(`/admin/celebrity/stars/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 上传明星头像 / 封面到公共图床，返回可直接用作 avatar/cover 的 URL。 */
export async function uploadCelebrityImage(
  file: File,
  kind: "avatar" | "cover" | "preview" | "photo" | "video",
): Promise<{ url: string; kind: string }> {
  if (USE_MOCK) return mockDelay({ url: URL.createObjectURL(file), kind });
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  return apiFetch<{ url: string; kind: string }>("/admin/celebrity/uploads", {
    method: "POST",
    body: form,
  });
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
  if (USE_MOCK) return mockDelay(visibleProjectVideos(PROJECT_VIDEOS_MAP[projectId] ?? []));
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
    let all = visibleProjectVideos(Object.values(PROJECT_VIDEOS_MAP).flat());
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

export async function deleteVideo(videoId: ID): Promise<boolean> {
  if (USE_MOCK) {
    const deleted = readDeletedProjectVideos();
    if (!deleted.includes(videoId)) writeDeletedProjectVideos([...deleted, videoId]);
    return mockDelay(true);
  }
  return apiFetch<boolean>(`/celebrity/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" });
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
    body: payload,
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
    body: { videoIds, channels },
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
    body: payload,
  });
}

// ── 带货授权申请（v0.60 · web-star 打通） ───────────────────────────────────

export interface StarAuthApplyPayload {
  scenes: string[];
  note?: string;
}

export interface StarAuthApplyResult {
  id: ID;
  starId: ID;
  status: string;
  pendingNote?: string;
}

/**
 * 向明星发起 AI 复刻带货授权申请。
 * 真实链路：POST /api/me/celebrity/stars/{id}/authorization/apply →
 * 明星商务工作台（web-star）「带货授权」队列审批 → 批准后本端授权状态变 authorized。
 */
export async function applyStarAuthorization(
  starId: ID,
  payload: StarAuthApplyPayload,
): Promise<StarAuthApplyResult> {
  if (USE_MOCK) {
    const star = STAR_DETAIL_MAP[starId] ?? MARKET_STARS.find((s) => s.id === starId);
    if (star) {
      star.authorization = {
        ...star.authorization,
        status: "pending",
        pendingNote: "经纪团队复核中（48h SLA）",
      };
    }
    return mockDelay({
      id: `auth-mock-${Date.now()}`,
      starId,
      status: "pending",
      pendingNote: "经纪团队复核中（48h SLA）",
    });
  }
  return apiFetch<StarAuthApplyResult>(`/me/celebrity/stars/${starId}/authorization/apply`, {
    method: "POST",
    body: payload,
  });
}
