// ─────────────────────────────────────────────────────────────────────────────
// api/distribution.ts — 分发中心（第三方平台发行）API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Platform,
  DistributionContentItem,
  PlatformViewPoint,
} from "@ai-star-eco/types/distribution";
import type { ID } from "@ai-star-eco/types/_shared";
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

export interface PlatformConnectionWire {
  id: ID;
  tenantId: ID;
  userId: ID;
  platformId: ID;
  status: "pending" | "connected" | "failed" | "disconnected";
  connectedAt: string | null;
}

export async function listConnections(): Promise<PlatformConnectionWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<PlatformConnectionWire[]>("/distribution/connections");
}

export async function connectPlatform(
  platformId: ID,
  credentials?: Record<string, unknown>,
): Promise<PlatformConnectionWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      tenantId: "mock-tenant",
      userId: "mock-user",
      platformId,
      status: "connected",
      connectedAt: new Date().toISOString(),
    });
  }
  return apiFetch<PlatformConnectionWire>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "POST", body: { credentials } },
  );
}

export async function disconnectPlatform(platformId: ID): Promise<void> {
  if (USE_MOCK) { await mockDelay(undefined); return; }
  await apiFetch<void>(
    `/distribution/platforms/${encodeURIComponent(platformId)}/connection`,
    { method: "DELETE" },
  );
}
