"use client";
// ============================================================
// 数字人资产平台 — 前端 API 契约层（唯一数据出入口）
//
// 设计：屏幕层只 import 本文件，绝不直接读 ./data。
//   · 实体数据（数字人 / 造型 / 衍生 / 授权 / 任务 / 音色 / 账户 / 应用 / 场景）
//     一律走异步函数：USE_MOCK=1 → 返回 ./data 的样例；USE_MOCK=0 → apiFetch 打后端。
//   · UI 字典（状态/路径/标准图/衍生 meta/链路/能力/精调/模板/配色）是展示配置，
//     从这里同步再导出（screens 用 DATA.STATUS 等），同样只经本文件。
//
// REST 面对齐规格《数字人资产平台》§4（/api/v1，Bearer Token，业务 id 暴露）。
// server 端尚未实现这些端点；当前默认 USE_MOCK=1 走本地样例，接后端时把
// NEXT_PUBLIC_USE_MOCK=0 即可，屏幕层零改动。
// ============================================================
import React from "react";
import * as Mock from "./data";

// ── 开关 / 错误 ──────────────────────────────────────────────

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "0";
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const mock = <T,>(v: T): Promise<T> => Promise.resolve(v);

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = window.localStorage?.getItem("aiavatar_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * 统一 fetch：拼 /api/v1 前缀（next.config.mjs 把 /api/* 代理到 :8080），
 * 解包后端响应壳 `{ success, data }` / 分页 `{ data, pagination }`，失败抛 ApiError。
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 无 body */
  }
  if (!res.ok || (json && json.success === false)) {
    const err = json?.error || {};
    throw new ApiError(err.message || `请求失败（${res.status}）`, err.code, res.status);
  }
  // ApiResponse<T> / PageEnvelope<T> 自动解包 data；裸 body 原样返回
  if (json && typeof json === "object" && "data" in json) return json.data as T;
  return json as T;
}

// ── UI 字典（展示配置，同步再导出）────────────────────────────

export const {
  STATUS,
  PATHS,
  SHOTS,
  DERIVS,
  CHAIN,
  CAPS,
  WARP_CTRLS,
  APPEAR_CTRLS,
  TEMPLATES,
  catColor,
  catSoft,
} = Mock;

/** 屏幕层沿用的字典聚合（仅 UI 配置，不含实体数据 —— 实体走下面的 *Api）。 */
export const DATA = {
  STATUS,
  PATHS,
  SHOTS,
  DERIVS,
  CHAIN,
  CAPS,
  WARP_CTRLS,
  APPEAR_CTRLS,
  TEMPLATES,
  catColor,
  catSoft,
};

// 类型再导出，screens / 调用方可从 api 取类型
export type {
  Avatar,
  AvatarPath,
  AvatarStatus,
  AvatarDef,
  License,
  Job,
  VoiceAsset,
  BuiltinVoice,
  Application,
  Scene,
  Account,
  DerivKey,
  DerivStatus,
} from "./data";

// ── 同步种子（仅 mock 模式有值；用于 useApi 初值，避免首帧闪烁）──

export const seed = {
  avatars: (scope: "mine" | "public" = "mine"): any[] =>
    USE_MOCK ? (scope === "public" ? Mock.PUBLIC_AVATARS : Mock.CHARS).slice() : [],
  builtinVoices: (): Mock.BuiltinVoice[] => (USE_MOCK ? Mock.BUILTIN_VOICES.slice() : []),
  myVoices: (): Mock.VoiceAsset[] => (USE_MOCK ? Mock.VOICES.slice() : []),
  jobs: (): Mock.Job[] => (USE_MOCK ? Mock.TASKS.map((t) => ({ ...t })) : []),
  licenses: (): Mock.License[] => (USE_MOCK ? Mock.LICENSES.slice() : []),
  applications: (): Mock.Application[] => (USE_MOCK ? Mock.APPLICATIONS.slice() : []),
  scenes: (): Mock.Scene[] => (USE_MOCK ? Mock.SCENES.slice() : []),
  templates: (): Mock.TemplateMeta[] => (USE_MOCK ? Mock.TEMPLATES.slice() : []),
  account: (): Mock.Account | null => (USE_MOCK ? Mock.ACCOUNT : null),
};

/**
 * 极简数据 hook：挂载后调 fn() 拉数据写入 state。
 * `initial` 一般传对应的 seed.*()（mock 下即完整数据 → 首帧无闪烁；live 下为空 → 异步填充）。
 */
export function useApi<T>(fn: () => Promise<T>, initial: T, deps: any[] = []): T {
  const [val, setVal] = React.useState<T>(initial);
  React.useEffect(() => {
    let live = true;
    fn()
      .then((d) => {
        if (live) setVal(d);
      })
      .catch(() => {
        /* 静默：保留 initial（mock 下即完整样例）。真实错误处理留待接后端时补 toast。 */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return val;
}

// ── 数字人 Avatars（规格 §4 Avatars + 创建流程）────────────────

export const AvatarApi = {
  list: (scope: "mine" | "public" = "mine", params?: { path?: string; status?: string; fav?: boolean; q?: string }): Promise<any[]> => {
    if (USE_MOCK) return mock(scope === "public" ? Mock.PUBLIC_AVATARS.slice() : Mock.CHARS.slice());
    const qs = new URLSearchParams({ scope, ...(params as any) }).toString();
    return apiFetch(`/avatars?${qs}`);
  },
  get: (id: string): Promise<any> => {
    if (USE_MOCK) return mock(Mock.CHARS.find((c) => c.id === id) || Mock.CHARS[0]);
    return apiFetch(`/avatars/${id}`);
  },
  create: (body: { path: string; entry?: string }): Promise<any> => {
    if (USE_MOCK) return mock({ id: "DH-NEW", ...body });
    return apiFetch(`/avatars`, { method: "POST", body: JSON.stringify(body) });
  },
  patch: (id: string, body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) return mock({ id, ...body });
    return apiFetch(`/avatars/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  remove: (id: string): Promise<void> => {
    if (USE_MOCK) return mock(undefined);
    return apiFetch(`/avatars/${id}`, { method: "DELETE" });
  },
  versions: (id: string): Promise<any[]> => {
    if (USE_MOCK) return mock([]);
    return apiFetch(`/avatars/${id}/versions`);
  },
  looks: (id: string): Promise<any[]> => {
    if (USE_MOCK) return mock([]);
    return apiFetch(`/avatars/${id}/looks`);
  },
  createLook: (id: string, body: { source: string; prompt?: string; sceneId?: string }): Promise<any> => {
    if (USE_MOCK) return mock({ id: "LK-NEW", avatarId: id, ...body, status: "running" });
    return apiFetch(`/avatars/${id}/looks`, { method: "POST", body: JSON.stringify(body) });
  },
  derivatives: (id: string): Promise<any[]> => {
    if (USE_MOCK) return mock([]);
    return apiFetch(`/avatars/${id}/derivatives`);
  },
  createDerivative: (id: string, body: { type: string }): Promise<any> => {
    if (USE_MOCK) return mock({ id: "JOB-NEW", avatarId: id, status: "running" });
    return apiFetch(`/avatars/${id}/derivatives`, { method: "POST", body: JSON.stringify(body) });
  },
  finalize: (id: string, body: { templateId: string; confirmedShots: string[] }): Promise<any> => {
    if (USE_MOCK) return mock({ id, status: "finalized" });
    return apiFetch(`/avatars/${id}/finalize`, { method: "POST", body: JSON.stringify(body) });
  },
  // —— 创建流程 ——
  describe: (id: string, body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) return mock({ id: "JOB-NEW", status: "running" });
    return apiFetch(`/avatars/${id}/describe`, { method: "POST", body: JSON.stringify(body) });
  },
  photos: (id: string, files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ passed: true });
    return apiFetch(`/avatars/${id}/photos`, { method: "POST", body: files as any, headers: {} });
  },
  generate: (id: string, body: { mode: "upload" | "describe" }): Promise<any> => {
    if (USE_MOCK) return mock({ id: "JOB-NEW", status: "running" });
    return apiFetch(`/avatars/${id}/generate`, { method: "POST", body: JSON.stringify(body) });
  },
  pick: (id: string, variantIndex: number): Promise<any> => {
    if (USE_MOCK) return mock({ id, variantIndex });
    return apiFetch(`/avatars/${id}/pick`, { method: "POST", body: JSON.stringify({ variantIndex }) });
  },
  iterate: (id: string, instruction: string): Promise<any> => {
    if (USE_MOCK) return mock({ id: "JOB-NEW", status: "running" });
    return apiFetch(`/avatars/${id}/iterate`, { method: "POST", body: JSON.stringify({ instruction }) });
  },
  warp: (id: string, params: Record<string, number>): Promise<any> => {
    if (USE_MOCK) return mock({ id, params });
    return apiFetch(`/avatars/${id}/warp`, { method: "POST", body: JSON.stringify(params) });
  },
};

// ── 真人捕获 / 授权 Captures & Licenses（规格 §4）────────────────

export const CaptureApi = {
  create: (avatarId: string): Promise<any> => {
    if (USE_MOCK) return mock({ id: "CAP-NEW", avatarId });
    return apiFetch(`/captures`, { method: "POST", body: JSON.stringify({ avatarId }) });
  },
  footage: (id: string, files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ passed: true });
    return apiFetch(`/captures/${id}/footage`, { method: "POST", body: files as any, headers: {} });
  },
  verify: (id: string): Promise<{ passed: boolean }> => {
    if (USE_MOCK) return mock({ passed: true });
    return apiFetch(`/captures/${id}/verify`, { method: "POST" });
  },
};

export const LicenseApi = {
  list: (status?: string): Promise<any[]> => {
    if (USE_MOCK) return mock(Mock.LICENSES.slice());
    return apiFetch(`/licenses${status ? `?status=${status}` : ""}`);
  },
  get: (id: string): Promise<any> => {
    if (USE_MOCK) return mock(Mock.LICENSES.find((l) => l.id === id) || Mock.LICENSES[0]);
    return apiFetch(`/licenses/${id}`);
  },
  certificate: (id: string): Promise<{ certificateUrl: string }> => {
    if (USE_MOCK) return mock({ certificateUrl: `#cert-${id}` });
    return apiFetch(`/licenses/${id}/certificate`);
  },
  renew: (id: string): Promise<any> => {
    if (USE_MOCK) return mock({ id, status: "active" });
    return apiFetch(`/licenses/${id}/renew`, { method: "POST" });
  },
  create: (body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) return mock({ id: "LIC-NEW", ...body, status: "active" });
    return apiFetch(`/licenses`, { method: "POST", body: JSON.stringify(body) });
  },
};

// ── 音色 Voices（规格 §4 + §6 内置 7 款）────────────────────────

export const VoiceApi = {
  builtin: (): Promise<Mock.BuiltinVoice[]> => {
    if (USE_MOCK) return mock(Mock.BUILTIN_VOICES.slice());
    return apiFetch(`/voices/builtin`);
  },
  mine: (): Promise<Mock.VoiceAsset[]> => {
    if (USE_MOCK) return mock(Mock.VOICES.slice());
    return apiFetch(`/voices/mine`);
  },
  preview: (voiceId: string, text?: string): Promise<{ audioUrl?: string }> => {
    if (USE_MOCK) return mock({ audioUrl: `#preview-${voiceId}` });
    return apiFetch(`/voices/preview`, { method: "POST", body: JSON.stringify({ voiceId, text }) });
  },
  bind: (avatarId: string, voiceId: string): Promise<any> => {
    if (USE_MOCK) return mock({ avatarId, voiceId });
    return apiFetch(`/avatars/${avatarId}/voice`, { method: "POST", body: JSON.stringify({ voiceId }) });
  },
  clone: (files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ id: "VC-NEW", status: "running" });
    return apiFetch(`/voices/clone`, { method: "POST", body: files as any, headers: {} });
  },
};

// ── 任务 Jobs（规格 §4）────────────────────────────────────────

export const JobApi = {
  list: (params?: { status?: string; avatarId?: string }): Promise<Mock.Job[]> => {
    if (USE_MOCK) return mock(Mock.TASKS.map((t) => ({ ...t })));
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return apiFetch(`/jobs${qs}`);
  },
  get: (id: string): Promise<Mock.Job> => {
    if (USE_MOCK) return mock(Mock.TASKS.find((t) => t.id === id) || Mock.TASKS[0]);
    return apiFetch(`/jobs/${id}`);
  },
  retry: (id: string): Promise<Mock.Job> => {
    if (USE_MOCK) return mock({ ...(Mock.TASKS.find((t) => t.id === id) || Mock.TASKS[0]), status: "running", pct: 0, eta: "重新排队中" });
    return apiFetch(`/jobs/${id}/retry`, { method: "POST" });
  },
  cancel: (id: string): Promise<void> => {
    if (USE_MOCK) return mock(undefined);
    return apiFetch(`/jobs/${id}/cancel`, { method: "POST" });
  },
};

// ── 账户 / 应用中心 / 场景库 / 模板 ─────────────────────────────

export const AccountApi = {
  get: (): Promise<Mock.Account> => {
    if (USE_MOCK) return mock(Mock.ACCOUNT);
    return apiFetch(`/account`);
  },
};

export const AppApi = {
  list: (): Promise<Mock.Application[]> => {
    if (USE_MOCK) return mock(Mock.APPLICATIONS.slice());
    return apiFetch(`/applications`);
  },
};

export const SceneApi = {
  list: (): Promise<Mock.Scene[]> => {
    if (USE_MOCK) return mock(Mock.SCENES.slice());
    return apiFetch(`/scenes`);
  },
};

export const TemplateApi = {
  list: (): Promise<Mock.TemplateMeta[]> => {
    if (USE_MOCK) return mock(Mock.TEMPLATES.slice());
    return apiFetch(`/templates`);
  },
};
