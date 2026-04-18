// ─────────────────────────────────────────────────────────────────────────────
// api/community.ts — 粉丝社区管理 API。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FanTier,
  FanGrowthPoint,
  FanActivity,
  CommunityEvent,
} from "@/types/community";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { FAN_TIERS, FAN_GROWTH, ACTIVITIES, EVENTS } from "@/mocks/community";

export async function listFanTiers(): Promise<FanTier[]> {
  if (USE_MOCK) return mockDelay(FAN_TIERS);
  return apiFetch<FanTier[]>("/admin/community/fan-tiers");
}

export async function getFanGrowth(): Promise<FanGrowthPoint[]> {
  if (USE_MOCK) return mockDelay(FAN_GROWTH);
  return apiFetch<FanGrowthPoint[]>("/admin/community/fan-growth");
}

export async function listActivities(): Promise<FanActivity[]> {
  if (USE_MOCK) return mockDelay(ACTIVITIES);
  return apiFetch<FanActivity[]>("/admin/community/activities");
}

export async function listEvents(): Promise<CommunityEvent[]> {
  if (USE_MOCK) return mockDelay(EVENTS);
  return apiFetch<CommunityEvent[]>("/admin/community/events");
}
