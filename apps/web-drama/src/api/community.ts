// ─────────────────────────────────────────────────────────────────────────────
// api/community.ts — 社区 / 粉丝运营 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/community.ts 拦截。
// 注意：OpenAPI 尚未覆盖本域。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FanTier,
  FanGrowthPoint,
  FanActivity,
  CommunityEvent,
} from "@ai-star-eco/types/community";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "./_client";

export async function listFanTiers(): Promise<FanTier[]> {
  return apiFetch<FanTier[]>("/community/fan-tiers");
}

export async function getFanGrowth(): Promise<FanGrowthPoint[]> {
  return apiFetch<FanGrowthPoint[]>("/community/fan-growth");
}

export async function listActivities(): Promise<FanActivity[]> {
  return apiFetch<FanActivity[]>("/community/activities");
}

export async function listEvents(): Promise<CommunityEvent[]> {
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
  return apiFetch<CommunityPostWire[]>("/community/posts", { query: { page, size } });
}

export async function createPost(
  content: string,
  artistId?: ID,
  mediaUrls: string[] = [],
): Promise<CommunityPostWire> {
  return apiFetch<CommunityPostWire>("/community/posts", {
    method: "POST",
    body: { content, artistId, mediaUrls },
  });
}

export async function rsvpEvent(eventId: ID): Promise<void> {
  await apiFetch<void>(
    `/community/events/${encodeURIComponent(eventId)}/rsvp`,
    { method: "POST" },
  );
}

export async function cancelRsvp(eventId: ID): Promise<void> {
  await apiFetch<void>(
    `/community/events/${encodeURIComponent(eventId)}/rsvp`,
    { method: "DELETE" },
  );
}
