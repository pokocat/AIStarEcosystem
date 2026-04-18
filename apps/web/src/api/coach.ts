// ─────────────────────────────────────────────────────────────────────────────
// api/coach.ts — 经纪人（Coach）后台 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SignedArtist,
  CoachRevenuePoint,
  DistributionQueueItem,
  CopyrightItem,
  CoachCategoryDistribution,
} from "@/types/coach";
import {
  SignedArtists,
  CoachRevenueData,
  DistributionQueue,
  CopyrightPending,
  CategoryDist,
} from "@/mocks/coach";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listSignedArtists(): Promise<SignedArtist[]> {
  if (USE_MOCK) return mockDelay(SignedArtists);
  return apiFetch<SignedArtist[]>("/coach/artists");
}

export async function getCoachRevenue(): Promise<CoachRevenuePoint[]> {
  if (USE_MOCK) return mockDelay(CoachRevenueData);
  return apiFetch<CoachRevenuePoint[]>("/coach/revenue");
}

export async function listDistributionQueue(): Promise<DistributionQueueItem[]> {
  if (USE_MOCK) return mockDelay(DistributionQueue);
  return apiFetch<DistributionQueueItem[]>("/coach/distribution-queue");
}

export async function listPendingCopyright(): Promise<CopyrightItem[]> {
  if (USE_MOCK) return mockDelay(CopyrightPending);
  return apiFetch<CopyrightItem[]>("/coach/copyright/pending");
}

export async function getCategoryDistribution(): Promise<CoachCategoryDistribution[]> {
  if (USE_MOCK) return mockDelay(CategoryDist);
  return apiFetch<CoachCategoryDistribution[]>("/coach/category-distribution");
}

/** 用户提交版权登记 (backed by aep_copyrights.submittedByUserId)。 */
export async function submitCopyright(payload: {
  title: string;
  artist?: string;
  type?: string;
}): Promise<CopyrightItem> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      title: payload.title,
      artist: payload.artist ?? "",
      type: payload.type ?? "",
      submitted: new Date().toISOString().slice(0, 10),
      status: "pending",
    } as CopyrightItem);
  }
  return apiFetch<CopyrightItem>("/coach/copyright", {
    method: "POST",
    body: payload,
  });
}
