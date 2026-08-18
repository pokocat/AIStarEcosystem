// ─────────────────────────────────────────────────────────────────────────────
// api/shorts.ts — 短视频制作草稿（v0.76）。
// 短视频工坊 /shorts/make「分镜脚本 → 视频工厂」整页编辑态的可恢复草稿 CRUD。
// 让「做到一半」刷新 / 返回 / 换设备都能接着做。AI 出脚本 / 出片仍走既有端点
// （short-drama.ts / render.ts），本文件只负责把整页状态持久化。
// 后端：/api/me/drama/shorts/**（DramaShortController），按 ownerUserId 隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { Material } from "@/mocks/drama-workshop";
import type { ScriptMeta, ShortContinuityManifest } from "./short-drama";

export type ShortDraftStatus = "draft" | "done";

export interface ShortAssembledMedia {
  url: string;
  cdnKey: string;
  durationSec: number;
  shotCount: number;
  at: string | null;
  coverCdnKey?: string;
  coverUrl?: string;
  assemblyVersion?: string;
  /** 镜头被编辑后，服务端保留旧 key 只为下一次替换清理；列表不会继续播放旧片。 */
  stale?: boolean;
}

/** 列表卡片字段（与后端 DramaShortService.toSummary 对齐）。 */
export interface ShortDraftSummary {
  id: string;
  title: string;
  fmtKey: string | null;
  fmtName: string;
  from: string;
  to: string;
  durationSec: number;
  shotCount: number;
  doneCount: number;
  status: ShortDraftStatus;
  progress: number;
  coverUrl?: string | null;
  videoUrl?: string | null;
  updated: string;
  updatedAt: string | null;
}

/** 回收站卡片：在草稿卡片字段上加软删元数据（与后端 DramaShortService.toTrashItem 对齐）。 */
export interface ShortDraftTrashItem extends ShortDraftSummary {
  deletedAt: string;
  purgeAt: string;
  daysLeft: number;
}

/** 持久化的分镜（与 make 页 ShortShot 对齐，含出片产物，刷新后可继续）。 */
export interface ShortDraftShot {
  id: string;
  no: number;
  dur: number;
  visual: string;
  size: string;
  move: string;
  voWho: string;
  voText: string;
  sfx: string;
  bgm: string;
  fx: string;
  refs: Material[];
  sub: boolean;
  flow: "draft" | "frame" | "clip" | "done";
  engine: string;
  frameIdx: number;
  frameUrls?: string[];
  frameUrl?: string;
  videoUrl?: string;
  jobId?: string;
  /**
   * 进行中的后台渲染任务（首帧 / 视频）。运行期已在 payloadJson 里 round-trip
   * （提交后写入、随 autosave 落库，进页对账恢复），此处补齐类型契约声明。
   */
  pendingJob?: { jobId: string; kind: "frame" | "clip" };
  sceneId?: string;
  parentShotId?: string;
  audio?: {
    cdnKey: string;
    url?: string;
    durationSec: number;
    textFingerprint: string;
    providerTaskId?: string;
    at?: string;
  };
}

export interface ShortDraftChatMsg {
  who: "ai" | "me";
  text: string;
}

/** 整页编辑态（= 后端 payloadJson；本文件 TS 接口即契约真源）。 */
export interface ShortDraftData {
  idea?: string | null;
  reopen?: string | null;
  fmtKey?: string | null;
  fmtName?: string;
  title?: string;
  /** v0.77：由「单集创意」套用而来时，创意名（展示在工厂顶栏 / 对话引导）。 */
  styleName?: string;
  /** v0.77：创意风格参考（一句话说明 + 主线），出脚本 AI 按此风格拆你的主题。 */
  styleRef?: string;
  step: "script" | "factory";
  meta: ScriptMeta | null;
  continuityManifest?: ShortContinuityManifest;
  /** 一句话故事大纲（AI 起草的 logline）；展示在标题下，可直接改。 */
  logline?: string;
  /** 主角参考图（上传到 OSS）：url 展示值 / cdnKey 真值。 */
  characterRef?: { url: string; cdnKey: string } | null;
  /** 主角绑定的数字人（来自 AiAvatar「我的数字人」）：id + 名称 + 展示图。 */
  characterAvatar?: { id: string; name: string; image: string } | null;
  /** 主场景参考图（上传到 OSS）。 */
  sceneRef?: { url: string; cdnKey: string } | null;
  shots: ShortDraftShot[];
  chat: ShortDraftChatMsg[];
  /** @素材 / 上传素材引用（数字人参考图、道具图等）。 */
  refs: Material[];
  /** AI 跟当前脚本给出的后续修改建议（快捷 chip）；随脚本刷新，重开草稿时恢复。 */
  suggestions?: string[];
  /** 服务端真实总装产物；只有 assemble 成功后才存在且允许 status=done。 */
  assembled?: ShortAssembledMedia;
}

export interface ShortPreflightIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  shotNo?: number;
}

export interface ShortPreflight {
  manifestVersion: string;
  promptVersion: string;
  assemblyVersion: string;
  totalDurationSec: number;
  shotCount: number;
  completedShotCount: number;
  audioReadyCount: number;
  structuralReady: boolean;
  audioReady: boolean;
  assemblyReady: boolean;
  issues: ShortPreflightIssue[];
  dependencyPlan: ShortContinuityManifest["dependencyPlan"];
}

export interface PreparedShortAudio {
  preparedCount: number;
  reusedCount: number;
  provider: string;
  shots: Array<{ shotId: string; shotNo: number; cdnKey: string; url: string; durationSec: number; textFingerprint: string }>;
}

export interface ShortDraftDetail {
  meta: ShortDraftSummary;
  data: ShortDraftData;
}

export interface CreateShortInput {
  title?: string;
  fmtKey?: string | null;
  fmtName?: string;
  coverFrom?: string;
  coverTo?: string;
  idea?: string | null;
  reopen?: string | null;
  /** v0.77：由「单集创意」套用而来时携带的创意名 / 风格参考（真实后端走 recipes/apply，本字段仅 mock 用）。 */
  styleName?: string;
  styleRef?: string;
}

export interface SaveShortOptions {
  status?: ShortDraftStatus;
  progress?: number;
}

// ── mock：进程内存表（USE_MOCK=1 时本地回放）。同会话内 create→get→save 可恢复
//    （满足新建流程在 mock 下可用 + 前进/后退导航不丢）；整页刷新会清空（mock 本无后端）。
const mockStore = new Map<string, ShortDraftDetail>();
const mockTrash = new Map<string, ShortDraftTrashItem>();
let mockSeq = 0;

function mockSummary(id: string, input: CreateShortInput): ShortDraftSummary {
  return {
    id,
    title: input.title || input.idea || input.reopen || input.fmtName || "未命名短视频",
    fmtKey: input.fmtKey ?? null,
    fmtName: input.fmtName || "短视频",
    from: input.coverFrom || "#f97316",
    to: input.coverTo || "#e11d48",
    durationSec: 0,
    shotCount: 0,
    doneCount: 0,
    status: "draft",
    progress: 0,
    coverUrl: null,
    videoUrl: null,
    updated: "刚刚",
    updatedAt: new Date().toISOString(),
  };
}

function mockPreviewMedia(data: ShortDraftData): Pick<ShortDraftSummary, "coverUrl" | "videoUrl"> {
  const videoShot = data.shots.find((s) => s.flow === "done" && s.videoUrl) ?? data.shots.find((s) => s.videoUrl);
  const coverShot = data.shots.find((s) => s.frameUrl || s.frameUrls?.[0]) ?? videoShot;
  return {
    coverUrl: coverShot?.frameUrl ?? coverShot?.frameUrls?.[0] ?? null,
    videoUrl: !data.assembled?.stale ? data.assembled?.url ?? videoShot?.videoUrl ?? null : videoShot?.videoUrl ?? null,
  };
}

export async function listDrafts(): Promise<ShortDraftSummary[]> {
  if (USE_MOCK) {
    return mockDelay(
      Array.from(mockStore.values())
        .map((d) => d.meta)
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    );
  }
  return apiFetch<ShortDraftSummary[]>("/me/drama/shorts");
}

export async function getDraft(id: string): Promise<ShortDraftDetail> {
  if (USE_MOCK) {
    const d = mockStore.get(id);
    if (!d) throw new Error("短视频草稿不存在");
    return mockDelay(d);
  }
  return apiFetch<ShortDraftDetail>(`/me/drama/shorts/${id}`);
}

export async function createDraft(input: CreateShortInput): Promise<ShortDraftDetail> {
  if (USE_MOCK) {
    const id = `dvs_mock_${Date.now()}_${mockSeq++}`;
    const detail: ShortDraftDetail = {
      meta: mockSummary(id, input),
      data: {
        idea: input.idea ?? null,
        reopen: input.reopen ?? null,
        fmtKey: input.fmtKey ?? null,
        fmtName: input.fmtName || "短视频",
        styleName: input.styleName || undefined,
        styleRef: input.styleRef || undefined,
        title: input.title || input.idea || input.reopen || input.fmtName || "未命名短视频",
        step: "script",
        meta: null,
        shots: [],
        chat: [],
        refs: [],
      },
    };
    mockStore.set(id, detail);
    return mockDelay(detail);
  }
  return apiFetch<ShortDraftDetail>("/me/drama/shorts", { method: "POST", body: input });
}

export async function saveDraft(
  id: string,
  data: ShortDraftData,
  opts?: SaveShortOptions,
): Promise<ShortDraftDetail> {
  if (USE_MOCK) {
    const prev = mockStore.get(id);
    const shotCount = data.shots.length;
    const doneCount = data.shots.filter((s) => s.flow === "done").length;
    const durationSec = data.shots.reduce((a, s) => a + (s.dur || 0), 0);
    const meta: ShortDraftSummary = {
      ...(prev?.meta ?? mockSummary(id, { fmtKey: data.fmtKey, fmtName: data.fmtName })),
      title: data.meta?.title || data.title || prev?.meta.title || "未命名短视频",
      fmtKey: data.fmtKey ?? prev?.meta.fmtKey ?? null,
      fmtName: data.fmtName || prev?.meta.fmtName || "短视频",
      durationSec,
      shotCount,
      doneCount,
      status: opts?.status ?? prev?.meta.status ?? "draft",
      progress: opts?.progress ?? (shotCount > 0 ? Math.round((doneCount / shotCount) * 100) : 0),
      ...mockPreviewMedia(data),
      updated: "刚刚",
      updatedAt: new Date().toISOString(),
    };
    const detail: ShortDraftDetail = { meta, data };
    mockStore.set(id, detail);
    return mockDelay(detail);
  }
  return apiFetch<ShortDraftDetail>(`/me/drama/shorts/${id}`, {
    method: "PUT",
    body: { data, status: opts?.status, progress: opts?.progress },
  });
}

/** 把全部已验收镜头按镜号拼成一条真实成片；成功后后端才把草稿置为 done。 */
export async function assembleDraft(id: string): Promise<ShortAssembledMedia> {
  if (USE_MOCK) {
    const detail = mockStore.get(id);
    if (!detail) throw new Error("短视频草稿不存在");
    const missing = detail.data.shots.filter((shot) => shot.flow !== "done" || !shot.videoUrl);
    if (missing.length) throw new Error(`还有 ${missing.length} 个镜头缺少已验收视频`);
    const assembled: ShortAssembledMedia = {
      url: detail.data.shots[0]?.videoUrl ?? "/videos/showreel-01.mp4",
      cdnKey: `mock/drama/shorts/${id}/final.mp4`,
      durationSec: detail.data.shots.reduce((sum, shot) => sum + (shot.dur || 0), 0),
      shotCount: detail.data.shots.length,
      at: new Date().toISOString(),
    };
    detail.data.assembled = assembled;
    detail.meta = {
      ...detail.meta,
      status: "done",
      progress: 100,
      videoUrl: assembled.url,
      durationSec: assembled.durationSec,
      shotCount: assembled.shotCount,
      doneCount: assembled.shotCount,
      updated: "刚刚",
      updatedAt: assembled.at,
    };
    mockStore.set(id, detail);
    return mockDelay(assembled, 900);
  }
  return apiFetch<ShortAssembledMedia>(`/me/drama/shorts/${id}/assemble`, { method: "POST" });
}

export async function preflightDraft(id: string): Promise<ShortPreflight> {
  if (USE_MOCK) {
    const detail = mockStore.get(id);
    const shots = detail?.data.shots ?? [];
    const audioReadyCount = shots.filter((shot) => !shot.voText?.trim() || !!shot.audio?.cdnKey).length;
    return mockDelay({
      manifestVersion: "1.0", promptVersion: "drama-short-v2", assemblyVersion: "drama-short-av-v1",
      totalDurationSec: shots.reduce((sum, shot) => sum + shot.dur, 0), shotCount: shots.length,
      completedShotCount: shots.filter((shot) => shot.flow === "done" && shot.videoUrl).length,
      audioReadyCount, structuralReady: shots.length > 0, audioReady: audioReadyCount === shots.length,
      assemblyReady: shots.length > 0 && shots.every((shot) => shot.flow === "done" && shot.videoUrl) && audioReadyCount === shots.length,
      issues: [], dependencyPlan: detail?.data.continuityManifest?.dependencyPlan ?? [],
    });
  }
  return apiFetch<ShortPreflight>(`/me/drama/shorts/${id}/preflight`);
}

export async function prepareAudio(id: string): Promise<PreparedShortAudio> {
  if (USE_MOCK) {
    const detail = mockStore.get(id);
    if (!detail) throw new Error("短视频草稿不存在");
    const prepared = detail.data.shots.filter((shot) => shot.voText?.trim()).map((shot) => {
      const item = { shotId: shot.id, shotNo: shot.no, cdnKey: `mock/audio/${shot.id}.mp3`, url: "/audio/mock.mp3", durationSec: Math.max(1, Math.round(shot.voText.length / 4)), textFingerprint: `mock-${shot.voText}` };
      shot.audio = { cdnKey: item.cdnKey, url: item.url, durationSec: item.durationSec, textFingerprint: item.textFingerprint };
      return item;
    });
    mockStore.set(id, detail);
    return mockDelay({ preparedCount: prepared.length, reusedCount: 0, provider: "mock", shots: prepared }, 500);
  }
  return apiFetch<PreparedShortAudio>(`/me/drama/shorts/${id}/prepare-audio`, { method: "POST" });
}

export async function deleteDraft(id: string): Promise<void> {
  if (USE_MOCK) {
    const d = mockStore.get(id);
    if (d) {
      const now = new Date();
      mockTrash.set(id, {
        ...d.meta,
        deletedAt: now.toISOString(),
        purgeAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
        daysLeft: 30,
      });
      mockStore.delete(id);
    }
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/shorts/${id}`, { method: "DELETE" });
}

/** 回收站列表（软删的短视频草稿）。 */
export async function listTrashDrafts(): Promise<ShortDraftTrashItem[]> {
  if (USE_MOCK) {
    return mockDelay(
      Array.from(mockTrash.values()).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")),
    );
  }
  return apiFetch<ShortDraftTrashItem[]>("/me/drama/shorts/trash");
}

/** 从回收站恢复一条短视频草稿。 */
export async function restoreDraft(id: string): Promise<void> {
  if (USE_MOCK) {
    const t = mockTrash.get(id);
    if (t) {
      const prev = mockStore.get(id);
      mockStore.set(id, {
        meta: { ...t, updated: "刚刚", updatedAt: new Date().toISOString() },
        data: prev?.data ?? {
          fmtKey: t.fmtKey,
          fmtName: t.fmtName,
          title: t.title,
          step: "script",
          meta: null,
          shots: [],
          chat: [],
          refs: [],
        },
      });
      mockTrash.delete(id);
    }
    return mockDelay(undefined);
  }
  await apiFetch<ShortDraftDetail>(`/me/drama/shorts/${id}/restore`, { method: "POST" });
}

/** 彻底删除一条回收站短视频草稿（物理，不可恢复）。 */
export async function purgeDraft(id: string): Promise<void> {
  if (USE_MOCK) {
    mockTrash.delete(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/shorts/${id}/purge`, { method: "DELETE" });
}
