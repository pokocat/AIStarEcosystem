// ─────────────────────────────────────────────────────────────────────────────
// api/digital-person.ts — AI 数字人 API。
// 真后端：
//   GET /api/me/person-models / POST /api/me/person-models（开训）
//   GET /api/me/digital-person/gen-tasks / POST /api/me/digital-person/gen-tasks
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PersonModel,
  DigitalPersonGenTask,
  CreateGenTaskInput,
} from "@ai-star-eco/types/digital-person";
import type { ID } from "@ai-star-eco/types/_shared";
import { PERSON_MODELS, GEN_TASKS } from "@/mocks/digital-person";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listModels(): Promise<PersonModel[]> {
  if (USE_MOCK) return mockDelay(PERSON_MODELS);
  return apiFetch<PersonModel[]>("/me/person-models");
}

export async function listGenTasks(): Promise<DigitalPersonGenTask[]> {
  if (USE_MOCK) return mockDelay(GEN_TASKS);
  return apiFetch<DigitalPersonGenTask[]>("/me/digital-person/gen-tasks");
}

/** 创建生成任务；server 校验 copyId 必须是 approved，appearanceModel/voiceModel 必须 active。 */
export async function createGenTask(input: CreateGenTaskInput): Promise<DigitalPersonGenTask> {
  if (USE_MOCK) {
    const appearance = PERSON_MODELS.find(m => m.id === input.appearanceModelId);
    if (!appearance) throw new Error(`appearance model not found: ${input.appearanceModelId}`);
    const t: DigitalPersonGenTask = {
      id: `gt-${Date.now()}`,
      modelId: appearance.id,
      modelName: appearance.name,
      partnerName: appearance.partnerName,
      copyTitle: "（按 copyId 查询）",
      platform: input.platform,
      status: "generating",
      duration: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      assignee: "制作小新",
      qualityScore: null,
      issues: [],
    };
    GEN_TASKS.unshift(t);
    return mockDelay(t, 400);
  }
  return apiFetch<DigitalPersonGenTask>("/me/digital-person/gen-tasks", { method: "POST", body: input });
}

/** 把已通过任务推入发布池 */
export async function pushGenTaskToPool(id: ID): Promise<DigitalPersonGenTask> {
  if (USE_MOCK) {
    const t = GEN_TASKS.find(x => x.id === id);
    if (!t) throw new Error(`gen task not found: ${id}`);
    if (t.status !== "approved") throw new Error("仅 approved 的任务可入池");
    t.status = "in_pool";
    return mockDelay(t, 200);
  }
  return apiFetch<DigitalPersonGenTask>(`/me/digital-person/gen-tasks/${encodeURIComponent(id)}/push-to-pool`, { method: "POST" });
}
