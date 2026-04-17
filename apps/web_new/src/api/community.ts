// ─────────────────────────────────────────────────────────────────────────────
// api/community.ts — 社区 / 粉丝运营 API 封装。
// 注意：OpenAPI 尚未覆盖本域。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FanTier,
  FanGrowthPoint,
  FanActivity,
  CommunityEvent,
} from "@/types/community";
import { FAN_TIERS, FAN_GROWTH, ACTIVITIES, EVENTS } from "@/mocks/community";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listFanTiers(): Promise<FanTier[]> {
  if (USE_MOCK) return mockDelay(FAN_TIERS);
  return apiFetch<FanTier[]>("/community/fan-tiers");
}

export async function getFanGrowth(): Promise<FanGrowthPoint[]> {
  if (USE_MOCK) return mockDelay(FAN_GROWTH);
  return apiFetch<FanGrowthPoint[]>("/community/fan-growth");
}

export async function listActivities(): Promise<FanActivity[]> {
  if (USE_MOCK) return mockDelay(ACTIVITIES);
  return apiFetch<FanActivity[]>("/community/activities");
}

export async function listEvents(): Promise<CommunityEvent[]> {
  if (USE_MOCK) return mockDelay(EVENTS);
  return apiFetch<CommunityEvent[]>("/community/events");
}
