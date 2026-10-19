// ─────────────────────────────────────────────────────────────────────────────
// api/studio-skills.ts — Studio 技能管理（全能创作对话的制作方法）。
// 对应 server 后台技能接口（/api/admin/studio/skills/*）。每次发布、回滚、审阅草稿都追加一个不可变版本；
// 进行中的制作仍按它开始时的版本快照执行。NEXT_PUBLIC_USE_MOCK=1 时走 mocks/studio-skills.ts。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StudioSkillAdminDetail, StudioSkillAdminItem, StudioSkillCreateRequest, StudioSkillDryRunRequest, StudioSkillDryRunResult,
  StudioSkillPublishRequest, StudioSkillStatusRequest, StudioSkillVersion, StudioSkillVersionActionRequest,
} from "@/types/studio-skills";
import { USE_MOCK, apiFetch, mockDelay } from "./_client";
import {
  mockCreateStudioSkill, mockDryRunStudioSkill, mockGetStudioSkill, mockListStudioSkills, mockListStudioSkillVersions,
  mockPublishStudioSkillDraft, mockPublishStudioSkillVersion, mockRollbackStudioSkill, mockSetStudioSkillStatus,
} from "@/mocks/studio-skills";

const path = (key: string) => `/admin/studio/skills/${encodeURIComponent(key)}`;

/** GET /admin/studio/skills */
export async function listStudioSkills(): Promise<StudioSkillAdminItem[]> {
  if (USE_MOCK) return mockDelay(mockListStudioSkills());
  return apiFetch<StudioSkillAdminItem[]>("/admin/studio/skills");
}

/** POST /admin/studio/skills —— 贴一整份技能文件（YAML 头 + 正文）新建；标识取自头部的 key。 */
export async function createStudioSkill(body: StudioSkillCreateRequest): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockCreateStudioSkill(body));
  return apiFetch<StudioSkillAdminDetail>("/admin/studio/skills", { method: "POST", body });
}

/** GET /admin/studio/skills/{key} */
export async function getStudioSkill(key: string): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockGetStudioSkill(key));
  return apiFetch<StudioSkillAdminDetail>(path(key));
}

/** GET /admin/studio/skills/{key}/versions —— 新的在前，含待审阅的整理草稿。 */
export async function listStudioSkillVersions(key: string): Promise<StudioSkillVersion[]> {
  if (USE_MOCK) return mockDelay(mockListStudioSkillVersions(key));
  return apiFetch<StudioSkillVersion[]>(`${path(key)}/versions`);
}

/** POST /admin/studio/skills/{key}/versions —— 发布新版本并立即生效。 */
export async function publishStudioSkillVersion(key: string, body: StudioSkillPublishRequest): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockPublishStudioSkillVersion(key, body));
  return apiFetch<StudioSkillAdminDetail>(`${path(key)}/versions`, { method: "POST", body });
}

/** PUT /admin/studio/skills/{key}/status —— 停用唯一启用的技能会被拒（409 STUDIO_SKILL_LAST_ACTIVE）。 */
export async function setStudioSkillStatus(key: string, body: StudioSkillStatusRequest): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockSetStudioSkillStatus(key, body));
  return apiFetch<StudioSkillAdminDetail>(`${path(key)}/status`, { method: "PUT", body });
}

/** POST /admin/studio/skills/{key}/rollback/{version} —— 用旧版本内容追加一个新版本。 */
export async function rollbackStudioSkill(key: string, version: number, body: StudioSkillVersionActionRequest): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockRollbackStudioSkill(key, version, body));
  return apiFetch<StudioSkillAdminDetail>(`${path(key)}/rollback/${version}`, { method: "POST", body });
}

/** POST /admin/studio/skills/{key}/versions/{version}/publish —— 审阅后发布一份整理草稿。 */
export async function publishStudioSkillDraft(key: string, version: number, body: StudioSkillVersionActionRequest): Promise<StudioSkillAdminDetail> {
  if (USE_MOCK) return mockDelay(mockPublishStudioSkillDraft(key, version, body));
  return apiFetch<StudioSkillAdminDetail>(`${path(key)}/versions/${version}/publish`, { method: "POST", body });
}

/** POST /admin/studio/skills/{key}/dry-run —— 真实调用一次规划模型看计划；不扣用户积分、不保存。 */
export async function dryRunStudioSkill(key: string, body: StudioSkillDryRunRequest): Promise<StudioSkillDryRunResult> {
  if (USE_MOCK) return mockDelay(mockDryRunStudioSkill(key, body), 400);
  return apiFetch<StudioSkillDryRunResult>(`${path(key)}/dry-run`, { method: "POST", body });
}
