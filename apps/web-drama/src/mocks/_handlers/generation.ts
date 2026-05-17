// mocks/_handlers/generation.ts — AI 生成工作流 mock handler。

import type { GenerationResult } from "@ai-star-eco/types/generation";
import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { MOCK_DRAFTS } from "@/mocks/generation";

registerMocks([
  {
    method: "POST",
    pattern: "/me/generation/run",
    handler: () => {
      const draft = MOCK_DRAFTS[Math.floor(Math.random() * MOCK_DRAFTS.length)];
      return mockDelay<GenerationResult>(
        {
          jobId: `gen-${Date.now()}`,
          draft,
          messages: [],
          completedAt: new Date().toISOString(),
        },
        2500,
      );
    },
  },
]);
