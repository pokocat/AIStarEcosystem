// ─────────────────────────────────────────────────────────────────────────────
// api/clip-studio.ts — 切片制作 API。
// 真后端：/api/me/clip-tasks CRUD + /api/me/clip-tasks/{id}/submit-qc 提交质检结果。
// ─────────────────────────────────────────────────────────────────────────────

import type { ClipTask, CreateClipTaskInput } from "@ai-star-eco/types/clip-studio";
import type { ID } from "@ai-star-eco/types/_shared";
import { CLIP_TASKS } from "@/mocks/clip-studio";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listTasks(): Promise<ClipTask[]> {
  if (USE_MOCK) return mockDelay(CLIP_TASKS);
  return apiFetch<ClipTask[]>("/me/clip-tasks");
}

export async function createTask(input: CreateClipTaskInput): Promise<ClipTask> {
  if (USE_MOCK) {
    const t: ClipTask = {
      id: `ct-${Date.now()}`,
      ...input,
      status: "in_progress",
      totalClips: 0,
      passedClips: 0,
      failedClips: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    CLIP_TASKS.unshift(t);
    return mockDelay(t, 300);
  }
  return apiFetch<ClipTask>("/me/clip-tasks", { method: "POST", body: input });
}

/** 提交 6 项质检结果；任一未通过即整任务 failed。 */
export async function submitQcResult(id: ID, qcResults: Record<string, boolean>): Promise<ClipTask> {
  if (USE_MOCK) {
    const t = CLIP_TASKS.find(x => x.id === id);
    if (!t) throw new Error(`clip task not found: ${id}`);
    const allPassed = Object.values(qcResults).every(Boolean);
    t.status = allPassed ? "completed" : "failed";
    return mockDelay(t, 400);
  }
  return apiFetch<ClipTask>(`/me/clip-tasks/${encodeURIComponent(id)}/submit-qc`, {
    method: "POST",
    body: { qcResults },
  });
}
