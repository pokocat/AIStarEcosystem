// ─────────────────────────────────────────────────────────────────────────────
// api/coach.ts — 发行机构管理 API。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SignedArtist,
  CoachRevenuePoint,
  DistributionQueueItem,
  CopyrightItem,
  CoachCategoryDistribution,
} from "@/types/coach";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  SignedArtists,
  CoachRevenueData,
  DistributionQueue,
  CopyrightPending,
  CategoryDist,
} from "@/mocks/coach";

export async function listSignedArtists(): Promise<SignedArtist[]> {
  if (USE_MOCK) return mockDelay(SignedArtists);
  return apiFetch<SignedArtist[]>("/admin/coach/artists");
}

export async function getCoachRevenue(): Promise<CoachRevenuePoint[]> {
  if (USE_MOCK) return mockDelay(CoachRevenueData);
  return apiFetch<CoachRevenuePoint[]>("/admin/coach/revenue");
}

export async function listDistributionQueue(): Promise<DistributionQueueItem[]> {
  if (USE_MOCK) return mockDelay(DistributionQueue);
  return apiFetch<DistributionQueueItem[]>("/admin/coach/distribution-queue");
}

export async function listPendingCopyright(): Promise<CopyrightItem[]> {
  if (USE_MOCK) return mockDelay(CopyrightPending);
  return apiFetch<CopyrightItem[]>("/admin/coach/copyright/pending");
}

export async function getCategoryDistribution(): Promise<CoachCategoryDistribution[]> {
  if (USE_MOCK) return mockDelay(CategoryDist);
  return apiFetch<CoachCategoryDistribution[]>("/admin/coach/category-distribution");
}
