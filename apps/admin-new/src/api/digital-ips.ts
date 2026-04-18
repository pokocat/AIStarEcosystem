// ─────────────────────────────────────────────────────────────────────────────
// api/digital-ips.ts — 虚拟 IP 管理。对应 AdminDigitalIpController。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist } from "@/types/artist";
import type { ID } from "@/types/_shared";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { MOCK_ARTISTS } from "@/mocks/artists";

export async function listDigitalIps(
  page = 0, size = 20, ownerUserId?: string, studioId?: string, kind?: string
): Promise<Artist[]> {
  if (USE_MOCK) return mockDelay(MOCK_ARTISTS);
  return apiFetch<Artist[]>("/admin/digital-ips", {
    query: { page, size, ownerUserId, studioId, kind },
  });
}

export async function getDigitalIp(id: ID): Promise<Artist> {
  if (USE_MOCK) return mockDelay(MOCK_ARTISTS.find((a) => a.id === id)!);
  return apiFetch<Artist>(`/admin/digital-ips/${encodeURIComponent(id)}`);
}

export async function createDigitalIp(data: Partial<Artist>): Promise<Artist> {
  return apiFetch<Artist>("/admin/digital-ips", {
    method: "POST",
    body: data,
  });
}

export async function updateDigitalIp(id: ID, data: Partial<Artist>): Promise<Artist> {
  return apiFetch<Artist>(`/admin/digital-ips/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}
