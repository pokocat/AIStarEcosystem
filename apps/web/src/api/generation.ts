// ─────────────────────────────────────────────────────────────────────────────
// api/generation.ts — AI 生成工作流接口钩子。
// 当前仅作后端对接锚点；组件走本地 mock 的流式模拟，不直接调用本文件（USE_MOCK=false 时会 404）。
// 后端实现时：按 req.modelVersion + req.thinkDepth 查工作流计费表扣 credits，
// 然后推回 SSE/WebSocket 流；前端届时把组件里的 setTimeout 串流替换为这里的调用。
// ─────────────────────────────────────────────────────────────────────────────

import type { GenerationRequest, GenerationResult } from "@/types/generation";
import { MOCK_DRAFTS } from "@/mocks/generation";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function runGeneration(req: GenerationRequest): Promise<GenerationResult> {
  if (USE_MOCK) {
    const draft = MOCK_DRAFTS[Math.floor(Math.random() * MOCK_DRAFTS.length)];
    return mockDelay({
      jobId: `gen-${Date.now()}`,
      draft,
      messages: [],
      completedAt: new Date().toISOString(),
    }, 2500);
  }
  return apiFetch<GenerationResult>("/me/generation/run", {
    method: "POST",
    body: req,
  });
}
