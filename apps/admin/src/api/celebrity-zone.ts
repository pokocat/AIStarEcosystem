// ─────────────────────────────────────────────────────────────────────────────
// api/celebrity-zone.ts — Admin AI 明星专区 API。对应 AdminCelebrityController。
// 路径前缀走 /admin/celebrity/*。仅暴露读取 + 跨用户聚合视图。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityCategory,
  CelebrityProject,
  CelebrityProjectStatus,
  CelebrityProjectVideo,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityZoneOverview,
} from "@/types/celebrity-zone";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";
import {
  ADMIN_CELEBRITY_PROJECTS,
  ADMIN_CELEBRITY_STARS,
  ADMIN_CELEBRITY_TEMPLATES,
  ADMIN_CELEBRITY_VIDEOS,
} from "@/mocks/celebrity-zone";

export interface StarFilter {
  category?: "全部" | CelebrityCategory;
  sort?: "hot" | "price-asc" | "price-desc";
}

export async function listStars(filter?: StarFilter): Promise<CelebrityStar[]> {
  if (USE_MOCK) {
    let stars = [...ADMIN_CELEBRITY_STARS];
    if (filter?.category && filter.category !== "全部") {
      stars = stars.filter((s) => s.category === filter.category);
    }
    if (filter?.sort === "hot") {
      stars.sort((a, b) => Number(b.isHot) - Number(a.isHot));
    }
    return mockDelay(stars);
  }
  const query: Record<string, unknown> = {};
  if (filter?.category && filter.category !== "全部") query.category = filter.category;
  if (filter?.sort) query.sort = filter.sort;
  return apiFetch<CelebrityStar[]>(`/admin/celebrity/stars${buildQuery(query)}`);
}

export async function getStar(id: string): Promise<CelebrityStar | null> {
  if (USE_MOCK) return mockDelay(ADMIN_CELEBRITY_STARS.find((s) => s.id === id) ?? null);
  return apiFetch<CelebrityStar | null>(`/admin/celebrity/stars/${encodeURIComponent(id)}`);
}

export async function listProjects(status?: CelebrityProjectStatus | "全部"): Promise<CelebrityProject[]> {
  if (USE_MOCK) {
    if (!status || status === "全部") return mockDelay([...ADMIN_CELEBRITY_PROJECTS]);
    return mockDelay(ADMIN_CELEBRITY_PROJECTS.filter((p) => p.status === status));
  }
  const query: Record<string, unknown> = {};
  if (status && status !== "全部") query.status = status;
  return apiFetch<CelebrityProject[]>(`/admin/celebrity/projects${buildQuery(query)}`);
}

export interface AllVideosFilter {
  status?: CelebrityProjectVideo["status"] | "全部";
  starId?: string;
  projectId?: string;
  sort?: "createdDesc" | "playsDesc";
}

export async function listAllVideos(filter?: AllVideosFilter): Promise<CelebrityProjectVideo[]> {
  if (USE_MOCK) {
    let rows = [...ADMIN_CELEBRITY_VIDEOS];
    if (filter?.status && filter.status !== "全部") rows = rows.filter((v) => v.status === filter.status);
    if (filter?.starId) rows = rows.filter((v) => v.starId === filter.starId);
    if (filter?.projectId) rows = rows.filter((v) => v.projectId === filter.projectId);
    return mockDelay(rows);
  }
  const query: Record<string, unknown> = {};
  if (filter?.status && filter.status !== "全部") query.status = filter.status;
  if (filter?.starId) query.starId = filter.starId;
  if (filter?.projectId) query.projectId = filter.projectId;
  if (filter?.sort) query.sort = filter.sort;
  return apiFetch<CelebrityProjectVideo[]>(`/admin/celebrity/videos${buildQuery(query)}`);
}

export async function listTemplates(): Promise<CelebrityTemplate[]> {
  if (USE_MOCK) return mockDelay([...ADMIN_CELEBRITY_TEMPLATES]);
  return apiFetch<CelebrityTemplate[]>("/admin/celebrity/templates");
}

export async function getOverview(): Promise<CelebrityZoneOverview> {
  if (USE_MOCK) {
    return mockDelay({
      hero: { totalPlays: "12.4M", totalConversions: "—", activeStars: ADMIN_CELEBRITY_STARS.length },
      starLeaderboard: ADMIN_CELEBRITY_STARS.map((s) => ({
        starId: s.id,
        name: s.name,
        avatar: s.avatar,
        plays: s.stats.totalPlays,
        gmv: s.stats.gmv,
        videoCount: s.stats.totalGenerated,
      })),
      weeklyTrend: [],
      channelMix: [],
    });
  }
  return apiFetch<CelebrityZoneOverview>("/admin/celebrity/overview");
}

// ── v0.5：admin 写操作（CRUD + photos/videos + templates + engine pricing） ──────

/** POST /admin/celebrity/stars */
export async function createStar(body: Partial<CelebrityStar>): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>("/admin/celebrity/stars", { method: "POST", body });
}
/** PUT /admin/celebrity/stars/{id} */
export async function updateStar(id: string, body: Partial<CelebrityStar>): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>(`/admin/celebrity/stars/${encodeURIComponent(id)}`, { method: "PUT", body });
}
/** DELETE /admin/celebrity/stars/{id} */
export async function deleteStar(id: string): Promise<void> {
  await apiFetch<void>(`/admin/celebrity/stars/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** POST /admin/celebrity/stars/{id}/photos */
export async function appendStarPhoto(id: string, body: { id?: string; url: string; caption?: string }): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>(`/admin/celebrity/stars/${encodeURIComponent(id)}/photos`, { method: "POST", body });
}
/** DELETE /admin/celebrity/stars/{id}/photos/{photoId} */
export async function removeStarPhoto(starId: string, photoId: string): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>(
    `/admin/celebrity/stars/${encodeURIComponent(starId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
}
/** POST /admin/celebrity/stars/{id}/videos */
export async function appendStarVideo(
  id: string,
  body: { id?: string; title: string; durationSec: number; coverUrl?: string; playUrl?: string; tag?: string },
): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>(`/admin/celebrity/stars/${encodeURIComponent(id)}/videos`, { method: "POST", body });
}
/** DELETE /admin/celebrity/stars/{id}/videos/{videoId} */
export async function removeStarVideo(starId: string, videoId: string): Promise<CelebrityStar> {
  return apiFetch<CelebrityStar>(
    `/admin/celebrity/stars/${encodeURIComponent(starId)}/videos/${encodeURIComponent(videoId)}`,
    { method: "DELETE" },
  );
}

/** POST /admin/celebrity/templates */
export async function createTemplate(body: Partial<CelebrityTemplate>): Promise<CelebrityTemplate> {
  return apiFetch<CelebrityTemplate>("/admin/celebrity/templates", { method: "POST", body });
}
/** PUT /admin/celebrity/templates/{id} */
export async function updateTemplate(id: string, body: Partial<CelebrityTemplate>): Promise<CelebrityTemplate> {
  return apiFetch<CelebrityTemplate>(`/admin/celebrity/templates/${encodeURIComponent(id)}`, { method: "PUT", body });
}
/** DELETE /admin/celebrity/templates/{id} */
export async function deleteTemplate(id: string): Promise<void> {
  await apiFetch<void>(`/admin/celebrity/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
/** PUT /admin/celebrity/templates/{id}/preview */
export async function setTemplatePreview(
  id: string,
  body: { previewCover?: string; previewVideoUrl?: string; durationSec?: number },
): Promise<CelebrityTemplate> {
  return apiFetch<CelebrityTemplate>(
    `/admin/celebrity/templates/${encodeURIComponent(id)}/preview`,
    { method: "PUT", body },
  );
}

/** GET /admin/celebrity/engine-pricing */
export async function getEnginePricing(): Promise<Record<string, { creditPrice: number; cost: number }>> {
  return apiFetch("/admin/celebrity/engine-pricing");
}
/** PUT /admin/celebrity/engine-pricing */
export async function replaceEnginePricing(
  body: Record<string, { creditPrice: number; cost: number }>,
): Promise<Record<string, { creditPrice: number; cost: number }>> {
  return apiFetch("/admin/celebrity/engine-pricing", { method: "PUT", body });
}

// ── v0.35：动作级权益扣减单价（PlatformConfig key=celebrity.action-pricing） ──
export type ActionPricing = { creditPrice?: number | null; useEnginePricing?: boolean | null };

/** GET /admin/celebrity/action-pricing */
export async function getActionPricing(): Promise<Record<string, ActionPricing>> {
  return apiFetch("/admin/celebrity/action-pricing");
}
/** PUT /admin/celebrity/action-pricing */
export async function replaceActionPricing(
  body: Record<string, ActionPricing>,
): Promise<Record<string, ActionPricing>> {
  return apiFetch("/admin/celebrity/action-pricing", { method: "PUT", body });
}
