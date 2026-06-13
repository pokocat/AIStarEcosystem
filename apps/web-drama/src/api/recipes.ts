// ─────────────────────────────────────────────────────────────────────────────
// api/recipes.ts — 短剧「可复用配方」Recipe（v0.73 抽 skill 飞轮）。
// 用户：从爆款项目抽成配方（→ 待运营审核）、看自己的、套用已发布配方。
// 运营：审核队列 + 发布 / 驳回（后端 requireOperator；维护入口在 web-drama 运营后台，不在 admin）。
// 后端：/api/me/drama/recipes/** + /api/me/drama/projects/{id}/extract-recipe。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export type RecipeStatus = "draft" | "submitted" | "published" | "rejected";

export interface RecipeBeat {
  no: number;
  hook: string;
  beat: string;
}
export interface RecipeArchetype {
  role: "key" | "extra";
  archetype: string;
  desc: string;
}
export interface RecipeData {
  mainline: string;
  beats: RecipeBeat[];
  characters: RecipeArchetype[];
  hooks: string[];
  notes: string;
}

export interface DramaRecipe {
  id: string;
  ownerUserId: string;
  sourceProjectId: string | null;
  status: RecipeStatus;
  origin: "extracted" | "official";
  title: string;
  summary: string;
  typeKey: string;
  type: string;
  ratio: string;
  episodes: number;
  cover: { from: string; to: string };
  useCount: number;
  reviewNote?: string;
  data: RecipeData;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
}

function mockRecipe(over?: Partial<DramaRecipe>): DramaRecipe {
  return {
    id: `dr_mock_${Date.now()}`,
    ownerUserId: "me",
    sourceProjectId: "dp_mock",
    status: "submitted",
    origin: "extracted",
    title: "反转悬疑·步步惊心",
    summary: "适合都市悬疑：强钩子开局 + 中段反转 + 末集双线收束。",
    typeKey: "mystery",
    type: "悬疑短剧",
    ratio: "9:16",
    episodes: 80,
    cover: { from: "#f97316", to: "#e11d48" },
    useCount: 0,
    data: {
      mainline: "（示例）主角因一桩旧案卷入追凶，步步逼近真相。",
      beats: [
        { no: 1, hook: "开局悬念", beat: "建立不安，留下钩子" },
        { no: 2, hook: "身份反转", beat: "信任崩塌" },
      ],
      characters: [{ role: "key", archetype: "敏感坚韧女主", desc: "自我怀疑到直面真相" }],
      hooks: ["开场即悬念", "中段大反转"],
      notes: "竖屏强钩子、快节奏。",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    ...over,
  };
}

/** 把一部已完成项目抽成可复用配方（→ status=submitted 待运营审核）。 */
export async function extractFromProject(projectId: string): Promise<DramaRecipe> {
  if (USE_MOCK) return mockDelay(mockRecipe(), 1400);
  return apiFetch<DramaRecipe>(`/me/drama/projects/${encodeURIComponent(projectId)}/extract-recipe`, { method: "POST" });
}

/** 我抽取 / 提交过的配方（含审核状态）。 */
export async function listMine(): Promise<DramaRecipe[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DramaRecipe[]>("/me/drama/recipes");
}

/** 创意库：已发布配方（按套用热度降序）。 */
export async function listPublished(): Promise<DramaRecipe[]> {
  if (USE_MOCK) return mockDelay([mockRecipe({ status: "published", publishedAt: new Date().toISOString(), useCount: 12 })]);
  return apiFetch<DramaRecipe[]>("/me/drama/recipes/published");
}

/** 运营审核队列：待审配方。 */
export async function listForReview(): Promise<DramaRecipe[]> {
  if (USE_MOCK) return mockDelay([mockRecipe()]);
  return apiFetch<DramaRecipe[]>("/me/drama/recipes/review");
}

/** 运营发布。 */
export async function publish(id: string): Promise<DramaRecipe> {
  if (USE_MOCK) return mockDelay(mockRecipe({ id, status: "published", publishedAt: new Date().toISOString() }));
  return apiFetch<DramaRecipe>(`/me/drama/recipes/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

/** 运营驳回。 */
export async function reject(id: string, note?: string): Promise<DramaRecipe> {
  if (USE_MOCK) return mockDelay(mockRecipe({ id, status: "rejected", reviewNote: note }));
  return apiFetch<DramaRecipe>(`/me/drama/recipes/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { note },
  });
}

/** 套用已发布配方 → 新建预填项目，返回 { projectId }。 */
export async function applyRecipe(id: string): Promise<{ projectId: string }> {
  if (USE_MOCK) return mockDelay({ projectId: `dp_mock_${Date.now()}` });
  return apiFetch<{ projectId: string }>(`/me/drama/recipes/${encodeURIComponent(id)}/apply`, { method: "POST" });
}
