// ─────────────────────────────────────────────────────────────────────────────
// api/celebrity-zone.ts — 明星专区：模板/盲盒生成 API 封装。
// 当前阶段（前端原型）所有调用走 mock；接入后端时按 BACKEND_API_SPEC 接 /api/celebrity/*。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityStar,
  CelebrityTemplate,
  CelebrityProject,
  CelebrityShowcase,
  CelebrityGenerationRequest,
} from "@/types/celebrity-zone";
import type { AsyncJobStarted } from "@/types/_shared";
import {
  ACTIVE_STAR,
  CELEBRITY_TEMPLATES,
  CELEBRITY_PROJECTS,
  TEMPLATE_SHOWCASES,
  BLINDBOX_SHOWCASES,
} from "@/mocks/celebrity-zone";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function getActiveStar(): Promise<CelebrityStar> {
  if (USE_MOCK) return mockDelay(ACTIVE_STAR);
  return apiFetch<CelebrityStar>("/celebrity/active-star");
}

export async function listTemplates(): Promise<CelebrityTemplate[]> {
  if (USE_MOCK) return mockDelay(CELEBRITY_TEMPLATES);
  return apiFetch<CelebrityTemplate[]>("/celebrity/templates");
}

export async function listProjects(): Promise<CelebrityProject[]> {
  if (USE_MOCK) return mockDelay(CELEBRITY_PROJECTS);
  return apiFetch<CelebrityProject[]>("/celebrity/projects");
}

export async function listTemplateShowcases(): Promise<CelebrityShowcase[]> {
  if (USE_MOCK) return mockDelay(TEMPLATE_SHOWCASES);
  return apiFetch<CelebrityShowcase[]>("/celebrity/showcases?mode=template");
}

export async function listBlindboxShowcases(): Promise<CelebrityShowcase[]> {
  if (USE_MOCK) return mockDelay(BLINDBOX_SHOWCASES);
  return apiFetch<CelebrityShowcase[]>("/celebrity/showcases?mode=blindbox");
}

export async function startGeneration(
  payload: CelebrityGenerationRequest,
): Promise<AsyncJobStarted> {
  if (USE_MOCK) {
    return mockDelay({
      jobId: `mock-${Date.now()}`,
      status: "queued",
      pollUrl: "/api/celebrity/jobs/mock",
      pollIntervalMs: 3000,
      estimatedSeconds: 180,
    });
  }
  return apiFetch<AsyncJobStarted>("/celebrity/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
