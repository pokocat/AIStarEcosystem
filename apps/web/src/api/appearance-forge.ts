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
import {
  FORGE_OPTIONS,
  FORGE_TEMPLATES,
  MOCK_APPEARANCES,
  generateMockAppearancesFor,
  pickDemoForgeVideo,
} from "@/mocks/appearance-forge";
import { MOCK_FORGE_DURATION_MS } from "@/constants/appearance-forge-ui";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function getForgeOptions(): Promise<ForgeOptions> {
  if (USE_MOCK) return mockDelay(FORGE_OPTIONS);
  return apiFetch<ForgeOptions>("/appearance-forge/options");
}

export async function listForgeHistory(artistId: ID): Promise<ForgeResult[]> {
  if (USE_MOCK) {
    let scoped = MOCK_APPEARANCES.filter(a => a.artistId === artistId);
    // 新建艺人（孵化器刚产出）没有种子形象时，按 artistId 合成 3 张，
    // 并写回 MOCK_APPEARANCES 以保证会话内后续请求幂等。
    if (scoped.length === 0) {
      const synth = generateMockAppearancesFor(artistId);
      MOCK_APPEARANCES.push(...synth);
      scoped = synth;
    }
    const sorted = [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(sorted);
  }
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
      artistId: req.artistId,
      image: tpl.image,
      prompt: req.prompt || `自动生成 - ${tpl.name}`,
      mode: req.mode,
      createdAt: new Date().toISOString(),
      locked: [...req.lockedFeatures],
      status: "draft",
      usageCount: 0,
    };
    // 回写到 mock 仓库，让"锻造 → 返回艺人详情页画廊"能看到新图。
    MOCK_APPEARANCES.unshift(result);
    return mockDelay(result, MOCK_FORGE_DURATION_MS);
  }
  return apiFetch<ForgeResult>("/appearance-forge/generate", {
    method: "POST",
    body: req,
  });
}

/**
 * 保存一次锻造结果到艺人形象库，并为其关联一段短视频。
 *
 * 当前 AI 视频生成尚未接入：
 * - mock 模式下从 DEMO_FORGE_VIDEO_POOL 随机挑一个 URL 写入 videoUrl，并回写
 *   MOCK_APPEARANCES 供艺人详情画廊即时呈现。
 * - 真实后端 `POST /api/appearance-forge/save` 行为一致，两个 URL 由 server 端
 *   {@code ForgeController.DEMO_VIDEO_POOL} 维护。
 * 接入真实 AI 后，后端应替换为触发生成任务并回填真实 videoUrl。
 *
 * @param resultId 要保存的 ForgeResult.id
 * @param reassign 为 true 时即使已有 videoUrl 也重抽一次（默认 false，幂等）
 */
export async function saveForgeResult(
  resultId: ID,
  reassign = false,
): Promise<ForgeResult> {
  if (USE_MOCK) {
    const existing = MOCK_APPEARANCES.find(a => a.id === resultId);
    if (!existing) {
      throw new Error(`锻造结果不存在：${resultId}`);
    }
    if (!existing.videoUrl || reassign) {
      existing.videoUrl = pickDemoForgeVideo();
    }
    return mockDelay({ ...existing });
  }
  return apiFetch<ForgeResult>("/appearance-forge/save", {
    method: "POST",
    body: { resultId, reassign },
  });
}

/** 后端返回的蓝图视图。 */
export interface ForgeBlueprintWire {
  id: ID;
  artistId: ID;
  resultId: ID;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

/** 将本次生成存为艺人的固定形象"蓝图"。 */
export async function saveForgeBlueprint(
  artistId: ID,
  resultId: ID,
  snapshot?: Record<string, unknown>,
): Promise<ForgeBlueprintWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      artistId, resultId,
      snapshot: snapshot ?? {},
      createdAt: new Date().toISOString(),
    });
  }
  return apiFetch<ForgeBlueprintWire>("/appearance-forge/blueprint", {
    method: "POST",
    body: { artistId, resultId, snapshot },
  });
}

export async function listBlueprints(artistId: ID): Promise<ForgeBlueprintWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<ForgeBlueprintWire[]>("/appearance-forge/blueprints", {
    query: { artistId },
  });
}
