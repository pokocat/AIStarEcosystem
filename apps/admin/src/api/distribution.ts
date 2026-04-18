// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发管理 API。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  DistributionContentItem,
  PlatformViewPoint,
} from "@/types/distribution";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { PLATFORMS, CONTENT_ITEMS, PLATFORM_DATA } from "@/mocks/distribution";

export async function listPlatforms(): Promise<Platform[]> {
  if (USE_MOCK) return mockDelay(PLATFORMS);
  return apiFetch<Platform[]>("/admin/distribution/platforms");
}

export async function listDistributionContent(): Promise<DistributionContentItem[]> {
  if (USE_MOCK) return mockDelay(CONTENT_ITEMS);
  return apiFetch<DistributionContentItem[]>("/admin/distribution/content");
}

export async function getPlatformViewStats(): Promise<PlatformViewPoint[]> {
  if (USE_MOCK) return mockDelay(PLATFORM_DATA);
  return apiFetch<PlatformViewPoint[]>("/admin/distribution/platform-views");
}
