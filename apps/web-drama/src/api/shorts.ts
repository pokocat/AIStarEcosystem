// ─────────────────────────────────────────────────────────────────────────────
// api/shorts.ts — 短视频制作草稿（v0.76）。
// 短视频工坊 /shorts/make「分镜脚本 → 视频工厂」整页编辑态的可恢复草稿 CRUD。
// 让「做到一半」刷新 / 返回 / 换设备都能接着做。AI 出脚本 / 出片仍走既有端点
// （short-drama.ts / render.ts），本文件只负责把整页状态持久化。
// 后端：/api/me/drama/shorts/**（DramaShortController），按 ownerUserId 隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { Material } from "@/mocks/drama-workshop";
import type { ScriptMeta } from "./short-drama";

export type ShortDraftStatus = "draft" | "done";

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
  updated: string;
  updatedAt: string | null;
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
  step: "script" | "factory";
  meta: ScriptMeta | null;
  shots: ShortDraftShot[];
  chat: ShortDraftChatMsg[];
  refs: Material[];
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
}

export interface SaveShortOptions {
  status?: ShortDraftStatus;
  progress?: number;
}

// ── mock：进程内存表（USE_MOCK=1 时本地回放）。同会话内 create→get→save 可恢复
//    （满足新建流程在 mock 下可用 + 前进/后退导航不丢）；整页刷新会清空（mock 本无后端）。
const mockStore = new Map<string, ShortDraftDetail>();
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
    updated: "刚刚",
    updatedAt: new Date().toISOString(),
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

export async function deleteDraft(id: string): Promise<void> {
  if (USE_MOCK) {
    mockStore.delete(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/shorts/${id}`, { method: "DELETE" });
}
