// ─────────────────────────────────────────────────────────────────────────────
// api/generation.ts — AI 生成工作流 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/generation.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { GenerationRequest, GenerationResult } from "@ai-star-eco/types/generation";
import { apiFetch } from "./_client";

export async function runGeneration(req: GenerationRequest): Promise<GenerationResult> {
  return apiFetch<GenerationResult>("/me/generation/run", {
    method: "POST",
    body: req,
  });
}
