// ─────────────────────────────────────────────────────────────────────────────
// api/appearance-forge.ts — AI 形象锻造炉 API。
// 形象锻造由"静态选项 + 生成请求 + 结果历史"三部分组成。
// 生成接口在 mock 模式下走随机模版伪实现；真实后端通常以异步任务形式返回。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ForgeOptions,
  ForgeRequest,
  ForgeResult,
} from "@/types/appearance-forge";
import type { ID } from "@/types/_shared";
import { FORGE_OPTIONS, FORGE_TEMPLATES } from "@/mocks/appearance-forge";
import { MOCK_FORGE_DURATION_MS } from "@/constants/appearance-forge-ui";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function getForgeOptions(): Promise<ForgeOptions> {
  if (USE_MOCK) return mockDelay(FORGE_OPTIONS);
  return apiFetch<ForgeOptions>("/appearance-forge/options");
}

export async function listForgeHistory(artistId: ID): Promise<ForgeResult[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<ForgeResult[]>(`/appearance-forge/history`, {
    query: { artistId },
  });
}

/**
 * 执行一次锻造生成。
 * mock 模式：延迟后基于 templateId 或随机模版拼装伪结果；
 * 真实后端：预期为异步任务（返回已完成的 ForgeResult 或发起轮询）。
 */
export async function generateForge(req: ForgeRequest): Promise<ForgeResult> {
  if (USE_MOCK) {
    const tpl =
      FORGE_TEMPLATES.find(t => t.id === req.templateId) ??
      FORGE_TEMPLATES[Math.floor(Math.random() * FORGE_TEMPLATES.length)];
    const result: ForgeResult = {
      id: Date.now().toString(),
      image: tpl.image,
      prompt: req.prompt || `自动生成 - ${tpl.name}`,
      mode: req.mode,
      createdAt: new Date().toISOString(),
      locked: [...req.lockedFeatures],
    };
    return mockDelay(result, MOCK_FORGE_DURATION_MS);
  }
  return apiFetch<ForgeResult>("/appearance-forge/generate", {
    method: "POST",
    body: req,
  });
}

/** 将本次生成存为艺人的固定形象"蓝图"。 */
export async function saveForgeBlueprint(
  artistId: ID,
  resultId: ID,
): Promise<{ ok: true }> {
  if (USE_MOCK) return mockDelay({ ok: true });
  return apiFetch<{ ok: true }>("/appearance-forge/blueprint", {
    method: "POST",
    body: { artistId, resultId },
  });
}
