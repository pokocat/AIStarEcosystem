// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发中心（第三方平台发行）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  DistributionContentItem,
  PlatformViewPoint,
} from "@/types/distribution";
import { PLATFORMS, CONTENT_ITEMS, PLATFORM_DATA } from "@/mocks/distribution";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listPlatforms(): Promise<Platform[]> {
  if (USE_MOCK) return mockDelay(PLATFORMS);
  return apiFetch<Platform[]>("/distribution/platforms");
}

export async function listDistributionContent(): Promise<DistributionContentItem[]> {
  if (USE_MOCK) return mockDelay(CONTENT_ITEMS);
  return apiFetch<DistributionContentItem[]>("/distribution/content");
}

export async function getPlatformViewStats(): Promise<PlatformViewPoint[]> {
  if (USE_MOCK) return mockDelay(PLATFORM_DATA);
  return apiFetch<PlatformViewPoint[]>("/distribution/platform-views");
}
