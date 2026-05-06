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
