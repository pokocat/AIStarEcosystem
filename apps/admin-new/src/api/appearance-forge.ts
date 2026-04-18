// ─────────────────────────────────────────────────────────────────────────────
// api/appearance-forge.ts — AI 形象锻造炉 API。
// ─────────────────────────────────────────────────────────────────────────────

import type { ForgeOptions, ForgeResult, ForgeRequest } from "@/types/appearance-forge";
import type { ID } from "@/types/_shared";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { FORGE_OPTIONS } from "@/mocks/appearance-forge";

export async function getForgeOptions(): Promise<ForgeOptions> {
  if (USE_MOCK) return mockDelay(FORGE_OPTIONS);
  return apiFetch<ForgeOptions>("/admin/appearance-forge/options");
}

export async function listForgeHistory(artistId: ID): Promise<ForgeResult[]> {
  if (USE_MOCK) return mockDelay<ForgeResult[]>([]);
  return apiFetch<ForgeResult[]>("/admin/appearance-forge/history", {
    query: { artistId },
  });
}

export async function generateForge(req: ForgeRequest): Promise<ForgeResult> {
  if (USE_MOCK) {
    const result: ForgeResult = {
      id: `forge-${Date.now()}`,
      image: FORGE_OPTIONS.templates[0].image,
      prompt: req.prompt || "mock-generated",
      mode: req.mode,
      createdAt: new Date().toISOString(),
      locked: req.lockedFeatures,
    };
    return mockDelay(result);
  }
  return apiFetch<ForgeResult>("/admin/appearance-forge/generate", {
    method: "POST",
    body: req,
  });
}

export async function saveForgeBlueprint(artistId: ID, resultId: ID): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined as unknown as void);
  return apiFetch<void>("/admin/appearance-forge/blueprint", {
    method: "POST",
    body: { artistId, resultId },
  });
}
