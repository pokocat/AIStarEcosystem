// ─────────────────────────────────────────────────────────────────────────────
// api/platform-config.ts — 平台 JSON 配置 (aep_platform_configs) 读写
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export interface PlatformConfigDto<T = unknown> {
  key: string;
  value: T | null;
  version: number;
  description: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export async function listConfigs(): Promise<PlatformConfigDto[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<PlatformConfigDto[]>("/admin/platform-configs");
}

export async function getConfig<T = unknown>(key: string): Promise<PlatformConfigDto<T>> {
  if (USE_MOCK) {
    return mockDelay({ key, value: null, version: 0, description: null, updatedAt: null, updatedBy: null } as PlatformConfigDto<T>);
  }
  return apiFetch<PlatformConfigDto<T>>(`/admin/platform-configs/${encodeURIComponent(key)}`);
}

/**
 * 提交 key 的新值（JSON 任意节点），同时可以带 description。
 * 后端 version 自增、updatedAt 刷新。
 */
export async function upsertConfig(
  key: string,
  value: unknown,
  description?: string,
): Promise<PlatformConfigDto> {
  if (USE_MOCK) return mockDelay({ key, value, version: 1, description: description ?? null, updatedAt: new Date().toISOString(), updatedBy: "mock" } as PlatformConfigDto);
  return apiFetch<PlatformConfigDto>(`/admin/platform-configs/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: description != null ? { value, description } : value,
  });
}

export async function deleteConfig(key: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch<void>(`/admin/platform-configs/${encodeURIComponent(key)}`, { method: "DELETE" });
}
