// ─────────────────────────────────────────────────────────────────────────────
// api/community.ts — 社区 / 粉丝运营 API 封装。
// 注意：OpenAPI 尚未覆盖本域。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FanTier,
  FanGrowthPoint,
  FanActivity,
  CommunityEvent,
} from "@ai-star-eco/types/community";
import type { ID } from "@ai-star-eco/types/_shared";
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

export interface CommunityPostWire {
  id: ID;
  userId: ID;
  artistId: ID | null;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

export async function listPosts(page = 0, size = 20): Promise<CommunityPostWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<CommunityPostWire[]>("/community/posts", { query: { page, size } });
}

export async function createPost(
  content: string,
  artistId?: ID,
  mediaUrls: string[] = [],
): Promise<CommunityPostWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      userId: "mock-user",
      artistId: artistId ?? null,
      content, mediaUrls,
      createdAt: new Date().toISOString(),
    });
  }
  return apiFetch<CommunityPostWire>("/community/posts", {
    method: "POST",
    body: { content, artistId, mediaUrls },
  });
}

export async function rsvpEvent(eventId: ID): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(
    `/community/events/${encodeURIComponent(eventId)}/rsvp`,
    { method: "POST" },
  );
}

export async function cancelRsvp(eventId: ID): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(
    `/community/events/${encodeURIComponent(eventId)}/rsvp`,
    { method: "DELETE" },
  );
}
