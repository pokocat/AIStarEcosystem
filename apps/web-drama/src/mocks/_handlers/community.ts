// mocks/_handlers/community.ts — 社区 / 粉丝运营 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { FAN_TIERS, FAN_GROWTH, ACTIVITIES, EVENTS } from "@/mocks/community";
import type { CommunityPostWire } from "@/api/community";

registerMocks([
  { method: "GET", pattern: "/community/fan-tiers", handler: () => mockDelay(FAN_TIERS) },
  { method: "GET", pattern: "/community/fan-growth", handler: () => mockDelay(FAN_GROWTH) },
  { method: "GET", pattern: "/community/activities", handler: () => mockDelay(ACTIVITIES) },
  { method: "GET", pattern: "/community/events", handler: () => mockDelay(EVENTS) },
  { method: "GET", pattern: "/community/posts", handler: () => mockDelay<CommunityPostWire[]>([]) },
  {
    method: "POST",
    pattern: "/community/posts",
    handler: ({ body }) => {
      const b = (body ?? {}) as { content?: string; artistId?: string; mediaUrls?: string[] };
      return mockDelay<CommunityPostWire>({
        id: `mock-${Date.now()}`,
        userId: "mock-user",
        artistId: b.artistId ?? null,
        content: b.content ?? "",
        mediaUrls: b.mediaUrls ?? [],
        createdAt: new Date().toISOString(),
      });
    },
  },
  {
    method: "POST",
    pattern: "/community/events/:eventId/rsvp",
    handler: () => mockDelay(undefined),
  },
  {
    method: "DELETE",
    pattern: "/community/events/:eventId/rsvp",
    handler: () => mockDelay(undefined),
  },
]);
