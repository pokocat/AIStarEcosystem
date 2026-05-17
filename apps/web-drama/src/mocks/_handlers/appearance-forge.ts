// mocks/_handlers/appearance-forge.ts — 形象锻造炉 JSON 接口 mock handlers。
// 注意：streamForgeConversation 是 SSE 流式接口（非 apiFetch），其 mock 仍在 api/appearance-forge.ts 内。

import type { ID } from "@ai-star-eco/types/_shared";
import type { ForgeRequest, ForgeResult } from "@ai-star-eco/types/appearance-forge";
import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import {
  FORGE_OPTIONS,
  FORGE_TEMPLATES,
  MOCK_APPEARANCES,
  generateMockAppearancesFor,
  pickDemoForgeVideo,
} from "@/mocks/appearance-forge";
import { MOCK_FORGE_DURATION_MS } from "@/constants/appearance-forge-ui";
import type { ForgeBlueprintWire, ForgeProviderStatus } from "@/api/appearance-forge";

registerMocks([
  {
    method: "GET",
    pattern: "/appearance-forge/options",
    handler: () => mockDelay(FORGE_OPTIONS),
  },
  {
    method: "GET",
    pattern: "/appearance-forge/history",
    handler: ({ query }) => {
      const artistId = String(query?.artistId ?? "");
      let scoped = MOCK_APPEARANCES.filter((a) => a.artistId === artistId);
      if (scoped.length === 0) {
        const synth = generateMockAppearancesFor(artistId);
        MOCK_APPEARANCES.push(...synth);
        scoped = synth;
      }
      const sorted = [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return mockDelay(sorted);
    },
  },
  {
    method: "POST",
    pattern: "/appearance-forge/generate",
    handler: ({ body }) => {
      const req = body as ForgeRequest;
      const tpl =
        FORGE_TEMPLATES.find((t) => t.id === req.templateId) ??
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
      MOCK_APPEARANCES.unshift(result);
      return mockDelay(result, MOCK_FORGE_DURATION_MS);
    },
  },
  {
    method: "POST",
    pattern: "/appearance-forge/save",
    handler: ({ body }) => {
      // upsert：与 api 端将 ForgeResult 字段拍扁后送出对应。
      const b = (body ?? {}) as {
        resultId: ID;
        artistId: ID;
        image: string;
        prompt: string;
        mode: ForgeResult["mode"];
        createdAt: string;
        locked: ForgeResult["locked"];
        reassign?: boolean;
      };
      let stored = MOCK_APPEARANCES.find((a) => a.id === b.resultId);
      if (!stored) {
        stored = {
          id: b.resultId,
          artistId: b.artistId,
          image: b.image,
          prompt: b.prompt,
          mode: b.mode,
          createdAt: b.createdAt,
          locked: b.locked,
          status: "draft",
          usageCount: 0,
        };
        MOCK_APPEARANCES.unshift(stored);
      }
      if (!stored.videoUrl || b.reassign) {
        stored.videoUrl = pickDemoForgeVideo();
      }
      return mockDelay({ ...stored });
    },
  },
  {
    method: "POST",
    pattern: "/appearance-forge/blueprint",
    handler: ({ body }) => {
      const b = (body ?? {}) as { artistId: ID; resultId: ID; snapshot?: Record<string, unknown> };
      return mockDelay<ForgeBlueprintWire>({
        id: `mock-${Date.now()}`,
        artistId: b.artistId,
        resultId: b.resultId,
        snapshot: b.snapshot ?? {},
        createdAt: new Date().toISOString(),
      });
    },
  },
  {
    method: "GET",
    pattern: "/appearance-forge/blueprints",
    handler: () => mockDelay<ForgeBlueprintWire[]>([]),
  },
  {
    method: "GET",
    pattern: "/appearance-forge/coze/status",
    handler: () =>
      mockDelay<ForgeProviderStatus>({
        configured: true,
        provider: "mock",
        message: "当前为 mock 模式，将使用本地流式回放",
      }),
  },
]);
