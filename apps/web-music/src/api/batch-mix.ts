// ─────────────────────────────────────────────────────────────────────────────
// api/batch-mix.ts — 混剪批量 API。
// 真后端：
//   GET /api/me/mix-templates
//   GET /api/me/batch-tasks / POST /api/me/batch-tasks / POST .../start
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MixTemplate,
  BatchTask,
  CreateBatchTaskInput,
} from "@ai-star-eco/types/batch-mix";
import type { ID } from "@ai-star-eco/types/_shared";
import { MIX_TEMPLATES, BATCH_TASKS } from "@/mocks/batch-mix";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listTemplates(): Promise<MixTemplate[]> {
  if (USE_MOCK) return mockDelay(MIX_TEMPLATES);
  return apiFetch<MixTemplate[]>("/me/mix-templates");
}

export async function listTasks(): Promise<BatchTask[]> {
  if (USE_MOCK) return mockDelay(BATCH_TASKS);
  return apiFetch<BatchTask[]>("/me/batch-tasks");
}

export async function createBatchTask(input: CreateBatchTaskInput): Promise<BatchTask> {
  if (USE_MOCK) {
    const tmpl = MIX_TEMPLATES.find(t => t.id === input.templateId);
    if (!tmpl) throw new Error(`template not found: ${input.templateId}`);
    const t: BatchTask = {
      id: `bt-${Date.now()}`,
      name: input.name,
      templateId: tmpl.id,
      templateName: tmpl.name,
      totalCount: input.count,
      completedCount: 0,
      failedCount: 0,
      status: "pending",
      startedAt: "-",
      estimatedDone: null,
      partnerName: "（按槽位推断）",
    };
    BATCH_TASKS.unshift(t);
    return mockDelay(t, 300);
  }
  return apiFetch<BatchTask>("/me/batch-tasks", { method: "POST", body: input });
}

export async function startBatchTask(id: ID): Promise<BatchTask> {
  if (USE_MOCK) {
    const t = BATCH_TASKS.find(x => x.id === id);
    if (!t) throw new Error(`batch task not found: ${id}`);
    t.status = "rendering";
    t.startedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    return mockDelay(t, 300);
  }
  return apiFetch<BatchTask>(`/me/batch-tasks/${encodeURIComponent(id)}/start`, { method: "POST" });
}

export async function pushBatchToPool(id: ID): Promise<BatchTask> {
  if (USE_MOCK) {
    const t = BATCH_TASKS.find(x => x.id === id);
    if (!t) throw new Error(`batch task not found: ${id}`);
    if (t.status !== "done") throw new Error("仅 done 的任务可入池");
    return mockDelay(t, 200);
  }
  return apiFetch<BatchTask>(`/me/batch-tasks/${encodeURIComponent(id)}/push-to-pool`, { method: "POST" });
}
