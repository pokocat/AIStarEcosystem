// ─────────────────────────────────────────────────────────────────────────────
// api/recipes.ts — 短剧「创意市场」配方 Recipe（v0.73 抽 skill 飞轮，v0.75 双通道）。
// 用户：成片后发布到创意市场（→ 待运营审核）、看「我发布的创意」、套用已发布、回应运营邀请。
// 运营：审核队列 + 发布/驳回 + 从用户作品精选（候选/邀请）+ 手建内置（后端 requireOperator；
//       维护入口在 web-drama 运营视图，不在 admin）。
// 后端：/api/me/drama/recipes/** + /api/me/drama/projects/{id}/extract-recipe。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { createDraft as createShortDraft } from "./shorts";

// submitted=用户自助待审 · invited=运营邀请待用户授权 · published=已上架 · rejected=审核驳回 · declined=用户谢绝
export type RecipeStatus = "draft" | "submitted" | "invited" | "published" | "rejected" | "declined";

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
  // extracted=用户自助 · featured=运营邀请精选用户作品 · official=运营手建内置
  origin: "extracted" | "featured" | "official";
  /** 来源用户展示名（用于「来自用户@xx」标签）。official 内置为空。 */
  authorName?: string;
  /** 运营发起邀请时记录的运营 id（审计；自助提交为空）。 */
  invitedBy?: string;
  title: string;
  summary: string;
  typeKey: string;
  type: string;
  ratio: string;
  episodes: number;
  cover: { from: string; to: string };
  /** v0.74：官方内置配方的真实预览图（/recipes/<id>.webp）；为空时回退 cover 渐变。 */
  coverImage?: string;
  /** 配方详情页的范例视频可播放 URL（后端由 OSS key 派生/签名，poster 用 coverImage）。 */
  previewVideo?: string;
  useCount: number;
  reviewNote?: string;
  data: RecipeData;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  /** 用户对运营邀请的授权时间。 */
  consentAt?: string | null;
}

/** 运营「从用户作品精选」候选项（一部用户已铺大纲的项目）。 */
export interface RecipeCandidate {
  projectId: string;
  title: string;
  type: string;
  typeKey: string;
  ratio: string;
  episodes: number;
  stage: number;
  cover: { from: string; to: string };
  authorName: string;
  ownerUserId: string;
  /** 是否已抽过配方（精选去重提示）。 */
  hasRecipe: boolean;
  updatedAt: string | null;
}

/** 运营手建内置创意入参。 */
export interface BuiltinRecipeInput {
  title: string;
  summary?: string;
  type?: string;
  typeKey?: string;
  ratio?: string;
  episodes?: number;
  mainline?: string;
  notes?: string;
  beats?: RecipeBeat[];
  characters?: RecipeArchetype[];
  hooks?: string[];
  coverFrom?: string;
  coverTo?: string;
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

/** 用户把一部成片发布到创意市场（→ status=submitted 待运营审核）。 */
export async function extractFromProject(projectId: string): Promise<DramaRecipe> {
  if (USE_MOCK) return mockDelay(mockRecipe(), 1400);
  return apiFetch<DramaRecipe>(`/me/drama/projects/${encodeURIComponent(projectId)}/extract-recipe`, { method: "POST" });
}

/** 我抽取 / 提交过的配方（含审核状态）。 */
export async function listMine(): Promise<DramaRecipe[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DramaRecipe[]>("/me/drama/recipes");
}

/** 创意市场：已发布配方（官方内置 + 用户作品，按套用热度降序）。 */
export async function listPublished(): Promise<DramaRecipe[]> {
  if (USE_MOCK)
    return mockDelay([
      // 单集官方风格短片（套用 → 短视频工厂）
      mockRecipe({
        id: "dr_mock_style",
        status: "published",
        origin: "official",
        title: "韦斯·安德森风格短片",
        summary: "对称构图 · 复古色卡 · 章节标题卡，适合 1–3 分钟风格化短片。",
        typeKey: "style",
        type: "风格短片",
        ratio: "16:9",
        episodes: 1,
        cover: { from: "#0ea5e9", to: "#22c55e" },
        useCount: 42,
        publishedAt: new Date().toISOString(),
        data: { mainline: "", beats: [], characters: [], hooks: [], notes: "【创作方法】对称机位…" },
      }),
      // 多集用户短剧（套用 → 六阶段项目）
      mockRecipe({ status: "published", publishedAt: new Date().toISOString(), useCount: 12 }),
    ]);
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

/**
 * 套用已发布配方的落地形态（v0.77 按单 / 多集分流）：
 *   多集 → 六阶段短剧项目（跳 /projects/{id}）；单集 → 短视频草稿（跳 /shorts/make）。
 */
export type ApplyRecipeResult =
  | { kind: "project"; projectId: string }
  | { kind: "short"; shortId: string };

/**
 * 套用已发布配方。多集创意新建六阶段项目，单集创意（如官方风格短片）新建短视频草稿。
 * 传完整 recipe 以便 mock 模式镜像后端的单 / 多集分流（单集还会把风格 styleRef 带进短视频草稿）。
 */
export async function applyRecipe(r: DramaRecipe): Promise<ApplyRecipeResult> {
  if (USE_MOCK) {
    if (r.episodes > 1) return mockDelay({ kind: "project", projectId: `dp_mock_${Date.now()}` });
    // 单集：建一条带风格的短视频草稿（mock store 里真建，跳转后工厂可加载）
    const styleRef = [r.summary, r.data?.mainline ? `主线：${r.data.mainline}` : ""].filter(Boolean).join("。");
    const d = await createShortDraft({
      title: r.title,
      fmtName: r.type,
      coverFrom: r.cover.from,
      coverTo: r.cover.to,
      styleName: r.title,
      styleRef,
    });
    return { kind: "short", shortId: d.meta.id };
  }
  return apiFetch<ApplyRecipeResult>(`/me/drama/recipes/${encodeURIComponent(r.id)}/apply`, { method: "POST" });
}

// ── 运营：从用户作品精选（通道②）+ 手建内置（通道③）；用户：回应邀请 ──────────────

/** 运营「从用户作品精选」候选池。 */
export async function listCandidates(): Promise<RecipeCandidate[]> {
  if (USE_MOCK)
    return mockDelay([
      {
        projectId: "dp_mock_cand",
        title: "（示例）逆袭の楼下奶茶店",
        type: "甜宠短剧",
        typeKey: "romance",
        ratio: "9:16",
        episodes: 24,
        stage: 5,
        cover: { from: "#db2777", to: "#9333ea" },
        authorName: "示例用户",
        ownerUserId: "u_demo",
        hasRecipe: false,
        updatedAt: new Date().toISOString(),
      },
    ]);
  return apiFetch<RecipeCandidate[]>("/me/drama/recipes/candidates");
}

/** 运营对某用户项目发起「邀请精选」→ invited 待用户授权。 */
export async function invite(projectId: string): Promise<DramaRecipe> {
  if (USE_MOCK) return mockDelay(mockRecipe({ status: "invited", origin: "featured", authorName: "示例用户" }));
  return apiFetch<DramaRecipe>("/me/drama/recipes/invite", { method: "POST", body: { projectId } });
}

/** 运营手建内置创意（直接发布）。 */
export async function createBuiltin(input: BuiltinRecipeInput): Promise<DramaRecipe> {
  if (USE_MOCK)
    return mockDelay(
      mockRecipe({ status: "published", origin: "official", title: input.title, publishedAt: new Date().toISOString() }),
    );
  return apiFetch<DramaRecipe>("/me/drama/recipes/builtin", { method: "POST", body: input });
}

/** 用户对运营邀请授权 / 谢绝。 */
export async function respondInvite(id: string, approve: boolean): Promise<DramaRecipe> {
  if (USE_MOCK)
    return mockDelay(mockRecipe({ id, status: approve ? "published" : "declined", origin: "featured" }));
  return apiFetch<DramaRecipe>(`/me/drama/recipes/${encodeURIComponent(id)}/respond`, {
    method: "POST",
    body: { approve },
  });
}
