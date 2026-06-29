// ─────────────────────────────────────────────────────────────────────────────
// api/storage.ts — 通用存储用量（v0.92）。
// 查当前用户在某子应用的存储占用 / 配额 / 余量 + 分类明细。
// 后端：GET /api/me/storage?app=drama（StorageController，通用，celebrity 等可复用）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export interface StorageSlice {
  category: string;
  mb: number;
}

export interface StorageUsage {
  app: string;
  usedMb: number;
  /** 实际配额（MB）= 基础配额 + 已购存储扩容。 */
  quotaMb: number;
  remainingMb: number;
  breakdown: StorageSlice[];
}

export async function getStorageUsage(app = "drama"): Promise<StorageUsage> {
  if (USE_MOCK) {
    return mockDelay({
      app,
      usedMb: 1860,
      quotaMb: 5120,
      remainingMb: 3260,
      breakdown: [
        { category: "成片", mb: 1240 },
        { category: "分镜首帧", mb: 420 },
        { category: "参考图素材", mb: 200 },
      ],
    });
  }
  return apiFetch<StorageUsage>(`/me/storage?app=${encodeURIComponent(app)}`);
}
