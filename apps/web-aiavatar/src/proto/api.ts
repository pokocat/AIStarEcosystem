"use client";
// ============================================================
// 数字人资产平台 — 前端 API 契约层（唯一数据出入口）
//
// 设计：屏幕层只 import 本文件，绝不直接读 ./data。
//   · 实体数据（数字人 / 造型 / 衍生 / 授权 / 任务 / 音色 / 账户 / 应用 / 场景）
//     一律走异步函数：USE_MOCK=1 → 返回 ./data 的样例（含本地任务模拟器）；
//     USE_MOCK=0 → apiFetch 打 server（/api/v1/**，Bearer Token）。
//   · UI 字典（状态/路径/标准图/衍生 meta/链路/能力/精调/模板/配色）是展示配置，
//     从这里同步再导出（screens 用 DATA.STATUS 等），同样只经本文件。
//
// server 端实现：apps/server com.aistareco.aep.dap.*（v0.51，表 dap_*）。
// 登录：/api/auth/sms/*（生产）+ /api/auth/dev-login（dev 体验账号）。
// ============================================================
import React from "react";
import * as Mock from "./data";

// ── 开关 / 错误 ──────────────────────────────────────────────

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "0";
const API_PREFIX = "/api/v1";
const AUTH_PREFIX = "/api/auth";
const TOKEN_KEY = "aiavatar_token";
const USER_KEY = "aiavatar_user";

export class ApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;
  constructor(message: string, code?: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type SmsDeliveryStatus = "NOT_APPLICABLE" | "ACCEPTED" | "PENDING" | "DELIVERED" | "FAILED" | "UNKNOWN";
export interface SmsRequestCodeResult {
  sent: boolean;
  accepted: boolean;
  provider: string;
  purpose: "login" | "register";
  templateCode?: string;
  httpStatus?: number;
  providerCode?: string;
  providerMessage?: string;
  requestId?: string;
  bizId?: string;
  deliveryStatus: SmsDeliveryStatus;
  sendStatus?: number;
  errCode?: string;
  sendDate?: string;
  receiveDate?: string;
}

export function describeSmsRequestCodeResult(result: SmsRequestCodeResult): { tone: "ok" | "warn" | "err"; message: string } {
  const suffix = result.bizId ? `（BizId ${result.bizId}）` : "";
  switch (result.deliveryStatus) {
    case "DELIVERED":
      return { tone: "ok", message: "验证码已送达" };
    case "NOT_APPLICABLE":
      return { tone: "ok", message: "验证码请求已处理" };
    case "FAILED":
      return { tone: "err", message: `短信发送失败${result.errCode ? `：${result.errCode}` : ""}${suffix}` };
    case "PENDING":
    case "ACCEPTED":
      return { tone: "warn", message: `短信已提交，运营商回执尚未确认${suffix}` };
    default:
      return { tone: "warn", message: `短信请求已提交，但回执状态未知${suffix}` };
  }
}

const mock = <T,>(v: T): Promise<T> => Promise.resolve(v);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 登录态 ───────────────────────────────────────────────────

type AuthListener = () => void;
const authExpiredListeners = new Set<AuthListener>();

export function onAuthExpired(cb: AuthListener): () => void {
  authExpiredListeners.add(cb);
  return () => authExpiredListeners.delete(cb);
}

export const auth = {
  token(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage?.getItem(TOKEN_KEY) || null;
  },
  user(): any | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage?.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setSession(token: string, user?: any) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
  isAuthed(): boolean {
    return USE_MOCK || !!auth.token();
  },
};

function authHeaders(): Record<string, string> {
  const t = auth.token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function fireAuthExpired() {
  auth.clear();
  authExpiredListeners.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
}

async function parseResponse<T>(res: Response): Promise<T> {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* 无 body */
  }
  if (res.status === 401) {
    fireAuthExpired();
    const err = json?.error || {};
    throw new ApiError(err.message || "登录状态已过期，请重新登录", err.code || "UNAUTHORIZED", 401, err.details);
  }
  if (!res.ok || (json && json.success === false)) {
    const err = json?.error || {};
    throw new ApiError(err.message || `请求失败（${res.status}）`, err.code, res.status, err.details);
  }
  if (json && typeof json === "object" && "data" in json) return json.data as T;
  return json as T;
}

/** 统一 fetch（/api/v1 前缀；解包 { success, data } 壳；401 触发登出事件）。 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  return parseResponse<T>(res);
}

/** multipart 上传（不设 Content-Type，浏览器自带 boundary）。 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  return parseResponse<T>(res);
}

/** 认证端点（/api/auth 前缀，permitAll）。 */
async function authFetch<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${AUTH_PREFIX}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export const AuthApi = {
  describeSmsRequestCodeResult,
  /** dev 体验账号清单（生产环境 404 → 返回 []）。 */
  devAccounts: async (): Promise<any[]> => {
    try {
      return await authFetch<any[]>(`/dev-accounts`);
    } catch {
      return [];
    }
  },
  devLogin: (username: string): Promise<{ token: string; user: any }> =>
    authFetch(`/dev-login`, { username }),
  smsRequestCode: (phone: string, purpose: "login" | "register" = "login"): Promise<SmsRequestCodeResult> =>
    authFetch(`/sms/request-code`, { phone, purpose }),
  smsLogin: (phone: string, code: string): Promise<{ token: string; user: any }> =>
    authFetch(`/sms/verify`, { phone, code }),
  /** 手机号 + 密码登录（账号需先在「账号与安全」设置过密码；未设置 → PASSWORD_NOT_SET）。 */
  passwordLogin: (phone: string, password: string): Promise<{ token: string; user: any }> =>
    authFetch(`/password/login`, { phone, password }),
  /** v0.53：注册透传 platform=aiavatar（dev-grant-all=false 时按来源授权本子产品）。 */
  smsRegister: (input: { phone: string; code: string; licenseKey: string; studioName: string; displayName?: string; platform?: string }): Promise<{ token: string; user: any }> =>
    authFetch(`/sms/register`, { platform: "aiavatar", ...input }),

  // ── v0.53 平台门禁（秘钥按子应用拆分）────────────────────────
  /** 当前登录账号（/api/me，AepUser 形状；platforms 为已开通子产品列表）。 */
  me: async (): Promise<any> => {
    const res = await fetch(`/api/me`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
    return parseResponse<any>(res);
  },
  /**
   * 已登录账号「追加激活」秘钥：开通秘钥批次绑定的子应用（如仅 aiavatar）+ 追加发放积分。
   * 返回 { user, creditsGranted, newTotalBalance, platformsGranted }。
   */
  activateLicense: async (code: string): Promise<{ user: any; creditsGranted: number; newTotalBalance: number; platformsGranted: string[] }> => {
    const res = await fetch(`/api/me/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ code }),
    });
    return parseResponse<any>(res);
  },

  /**
   * 当前登录账号设置 / 修改登录密码（/api/me/password，需登录态）。
   * 首次设置可不传 currentPassword；已有密码则必须校验 currentPassword。
   * 设置成功后即可在登录页用「手机号 + 密码」登录。
   */
  setPassword: async (input: { currentPassword?: string; newPassword: string }): Promise<{ changed: boolean; hasPassword: boolean }> => {
    const res = await fetch(`/api/me/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(input),
    });
    return parseResponse<{ changed: boolean; hasPassword: boolean }>(res);
  },
};

// ── UI 字典（展示配置，同步再导出）────────────────────────────

export const {
  STATUS,
  PATHS,
  SHOTS,
  DERIVS,
  DERIV_PRESETS,
  DERIV_DEFAULT_PICKS,
  D3_STYLES,
  VIDEO_MOTIONS,
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
  DERIV_PRESETS,
  DERIV_DEFAULT_PICKS,
  D3_STYLES,
  VIDEO_MOTIONS,
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

// ── Mock 任务模拟器（USE_MOCK=1 时让创建/衍生流程可观察推进）────

let mockSeq = 9000;
const mockJobStore = new Map<string, any>();
/** mock 模式下的「我的数字人」可变副本（创建流程会往里加）。 */
const mockChars: any[] = Mock.CHARS.map((c) => ({ ...c }));
/** mock 回收站（软删数字人；live 模式由 server 持久化）。 */
const mockTrash: any[] = [];

function newMockJob(partial: Partial<Mock.Job> & { kind: string }): Mock.Job {
  const id = `JOB-${mockSeq++}`;
  const job: any = {
    id, char: partial.char || "DH-NEW", charName: partial.charName || "新建数字人",
    kind: partial.kind, engine: partial.engine || "Agnes Image 2.1", mode: "mock",
    status: "running", pct: 4, eta: "排队中", stage: "mock.generate",
    started: new Date().toTimeString().slice(0, 5),
    ...partial,
  };
  mockJobStore.set(id, job);
  return job;
}

let staticJobsSeeded = false;
/** 把静态种子任务并入模拟器，让它们也会推进到 done（向导 attach / 任务中心一致推进）。 */
function seedStaticJobs() {
  if (staticJobsSeeded) return;
  staticJobsSeeded = true;
  Mock.TASKS.forEach((t) => { if (!mockJobStore.has(t.id)) mockJobStore.set(t.id, { ...t }); });
}

function tickMockJob(id: string) {
  const job = mockJobStore.get(id);
  if (!job || job.status !== "running") return job;
  job.pct = Math.min(100, job.pct + 22 + Math.random() * 14);
  job.eta = job.pct >= 100 ? "已完成" : "生成中…";
  job.stage = job.pct >= 100 ? "done" : "mock.generate";
  if (job.pct >= 100) { job.pct = 100; job.status = "done"; }
  return job;
}

/** 轮询任务直到终态；onTick 每次回调最新任务。失败时 reject ApiError。 */
export async function awaitJob(jobId: string, onTick?: (job: Mock.Job) => void,
                               intervalMs = USE_MOCK ? 700 : 1500): Promise<Mock.Job> {
  // 上限 ~12 分钟（视频任务最长）
  for (let i = 0; i < 700; i++) {
    const job = await JobApi.get(jobId);
    onTick?.(job);
    if (job.status === "done") return job;
    if (job.status === "failed") {
      throw new ApiError((job as any).error || "任务执行失败，请稍后重试", "JOB_FAILED");
    }
    await sleep(intervalMs);
  }
  throw new ApiError("任务超时，请到作业队列查看", "JOB_TIMEOUT");
}

// ── 同步种子（仅 mock 模式有值；用于 useApi 初值，避免首帧闪烁）──

export const seed = {
  avatars: (scope: "mine" | "public" = "mine"): any[] =>
    USE_MOCK ? (scope === "public" ? Mock.PUBLIC_AVATARS.slice() : mockChars.slice()) : [],
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
        /* 静默：保留 initial。401 由 onAuthExpired 全局接管；其余错误由动作型调用处理。 */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return val;
}

// ── 数字人 Avatars ────────────────────────────────────────────

export const AvatarApi = {
  list: (scope: "mine" | "public" = "mine", params?: { path?: string; status?: string; fav?: boolean; q?: string }): Promise<any[]> => {
    if (USE_MOCK) return mock(scope === "public" ? Mock.PUBLIC_AVATARS.slice() : mockChars.slice());
    const qs = new URLSearchParams({ scope, ...(params as any) }).toString();
    return apiFetch(`/avatars?${qs}`);
  },
  get: (id: string): Promise<any> => {
    if (USE_MOCK) return mock(mockChars.find((c) => c.id === id) || mockChars[0]);
    return apiFetch(`/avatars/${id}`);
  },
  create: (body: { path: string; entry?: string; name?: string }): Promise<any> => {
    if (USE_MOCK) {
      const id = `DH-${mockSeq++}`;
      const base = mockChars[0] || ({ palette: {}, hue: 250 } as any);
      const fresh = {
        ...base, id, name: body.name || "新建数字人", codename: "new-avatar", path: body.path,
        archetype: body.path === "real" ? "真人授权复刻" : "AI 原创形象", tagline: "创建中…",
        status: "draft", updated: "刚刚", fav: false, versions: 1, license: null,
        deriv: { atlas: "empty", expr: "empty", scene: "empty", ward: "empty", d3: "empty", video: "empty" },
        counts: { atlas: 0, expr: 0, scene: 0, ward: 0, d3: 0, video: 0 },
        def: { ...base.def, 设定语: "" },
      };
      mockChars.unshift(fresh);
      return mock(fresh);
    }
    return apiFetch(`/avatars`, { method: "POST", body: JSON.stringify(body) });
  },
  patch: (id: string, body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      if (c) Object.assign(c, body, { updated: "刚刚" });
      return mock(c || { id, ...body });
    }
    return apiFetch(`/avatars/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  /** 软删 → 回收站（默认 30 天后自动清理）。 */
  remove: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockChars.findIndex((x) => x.id === id);
      if (i >= 0) {
        const [c] = mockChars.splice(i, 1);
        mockTrash.unshift({ ...c, deletedAt: new Date().toISOString(), daysLeft: 30 });
      }
      return mock({ deleted: true, retentionDays: 30 });
    }
    return apiFetch(`/avatars/${id}`, { method: "DELETE" });
  },
  /** 回收站列表（含 daysLeft 剩余天数 / purgeAt 清理时间）。 */
  trash: (): Promise<any[]> => {
    if (USE_MOCK) return mock(mockTrash.slice());
    return apiFetch(`/avatars/trash`);
  },
  /** 从回收站恢复。 */
  restore: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockTrash.findIndex((x) => x.id === id);
      if (i >= 0) {
        const [c] = mockTrash.splice(i, 1);
        delete c.deletedAt; delete c.daysLeft;
        c.updated = "刚刚";
        mockChars.unshift(c);
        return mock(c);
      }
      return mock({ id });
    }
    return apiFetch(`/avatars/${id}/restore`, { method: "POST" });
  },
  /** 立即彻底删除（仅回收站内资产）。 */
  purge: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockTrash.findIndex((x) => x.id === id);
      if (i >= 0) mockTrash.splice(i, 1);
      return mock({ purged: true });
    }
    return apiFetch(`/avatars/${id}/purge`, { method: "DELETE" });
  },
  versions: (id: string): Promise<any[]> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id) || mockChars[0];
      const n = c?.versions || 3;
      return mock([
        { v: `v${n}`, t: c?.updated || "刚刚", note: "完成创建 · 锁定标准图集", kind: "archive", cur: true },
        { v: `v${Math.max(1, n - 1)}`, t: "今天 11:20", note: "定稿确认 · 5 张标准图", kind: "finalize", cur: false },
        { v: "v1", t: "昨天 15:30", note: "初始选稿", kind: "init", cur: false },
      ]);
    }
    return apiFetch(`/avatars/${id}/versions`);
  },
  looks: (id: string): Promise<any[]> => {
    if (USE_MOCK) return mock([]);
    return apiFetch(`/avatars/${id}/looks`);
  },
  createLook: (id: string, body: { source?: string; prompt?: string; sceneId?: string }): Promise<any> => {
    if (USE_MOCK) {
      const job = newMockJob({ kind: "造型设计", char: id });
      return mock({ id: `LK-${mockSeq++}`, avatarId: id, ...body, status: "running", jobId: job.id });
    }
    return apiFetch(`/avatars/${id}/looks`, { method: "POST", body: JSON.stringify(body) });
  },
  derivatives: (id: string): Promise<any[]> => {
    if (USE_MOCK) return mock([]);
    return apiFetch(`/avatars/${id}/derivatives`);
  },
  createDerivative: (id: string, body: { type: string; options?: { items?: { label: string; prompt: string }[]; extraPrompt?: string; motion?: string }; templateId?: string }): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const kindZh: any = { atlas: "多角度图集", expr: "表情图集", scene: "剧情场景图", ward: "换装变体", d3: "3D 模型", video: "运镜短视频" };
      const job = newMockJob({ kind: kindZh[body.type] || "衍生生成", char: id, charName: c?.name });
      if (c) c.deriv = { ...c.deriv, [body.type]: "running" };
      // mock：任务完成时把 deriv 状态翻成 done
      const watch = setInterval(() => {
        const j = mockJobStore.get(job.id);
        if (j && j.status !== "running") {
          clearInterval(watch);
          if (c) {
            c.deriv = { ...c.deriv, [body.type]: "done" };
            const inc: any = { atlas: 5, expr: 4, scene: 2, ward: 2, d3: 1, video: 1 };
            c.counts = { ...c.counts, [body.type]: (c.counts?.[body.type] || 0) + (inc[body.type] || 1) };
          }
        }
      }, 800);
      return mock({ ...job });
    }
    return apiFetch(`/avatars/${id}/derivatives`, { method: "POST", body: JSON.stringify(body) });
  },
  finalize: (id: string, body: { templateId?: string; confirmedShots?: string[]; archive?: boolean }): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      if (c) { c.status = body.archive ? "archived" : "finalized"; c.updated = "刚刚"; }
      return mock(c || { id, status: body.archive ? "archived" : "finalized" });
    }
    return apiFetch(`/avatars/${id}/finalize`, { method: "POST", body: JSON.stringify(body) });
  },
  // —— 创建流程 ——
  describe: (id: string, body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) return mock({ ok: true, avatarId: id });
    return apiFetch(`/avatars/${id}/describe`, { method: "POST", body: JSON.stringify(body) });
  },
  photos: (id: string, files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ passed: true, count: 3 });
    return apiUpload(`/avatars/${id}/photos`, files);
  },
  generate: (id: string, body: { mode: "upload" | "describe"; form?: Record<string, unknown>; captureId?: string }): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      if (c) c.status = "proofing";
      const job = newMockJob({ kind: body.mode === "upload" ? "真人复刻生成" : "形象生成", char: id, charName: c?.name });
      const watch = setInterval(() => {
        const j = mockJobStore.get(job.id);
        if (j && j.status !== "running") { clearInterval(watch); if (c) c.status = body.mode === "upload" ? "pending" : "proofing"; }
      }, 700);
      return mock({ ...job });
    }
    return apiFetch(`/avatars/${id}/generate`, { method: "POST", body: JSON.stringify(body) });
  },
  pick: (id: string, variantIndex: number): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      if (c) { c.status = "iterating"; c.updated = "刚刚"; }
      return mock(c || { id, variantIndex });
    }
    return apiFetch(`/avatars/${id}/pick`, { method: "POST", body: JSON.stringify({ variantIndex }) });
  },
  iterate: (id: string, instruction: string): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const job = newMockJob({ kind: "形象迭代", char: id, charName: c?.name });
      return mock({ ...job });
    }
    return apiFetch(`/avatars/${id}/iterate`, { method: "POST", body: JSON.stringify({ instruction }) });
  },
  warp: (id: string, params: Record<string, number>): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const job = newMockJob({ kind: "几何精调", char: id, charName: c?.name });
      return mock({ ...job });
    }
    return apiFetch(`/avatars/${id}/warp`, { method: "POST", body: JSON.stringify(params) });
  },
  // —— 端上精调（v0.52：美颜在浏览器实时处理，这里只取图 / 存成品）——
  /** 取当前定妆图字节（同源流式输出，规避 CDN 跨域 canvas 污染）。无图返回 null。 */
  imageBlob: async (id: string): Promise<Blob | null> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const src = (c && (c.imageUrl || (c.variantImages || [])[0])) || null;
      if (!src) return null;
      try {
        const r = await fetch(src);
        return r.ok ? await r.blob() : null;
      } catch {
        return null;
      }
    }
    try {
      const res = await fetch(`${API_PREFIX}/avatars/${id}/image`, { headers: { ...authHeaders() } });
      if (res.status === 401) { fireAuthExpired(); return null; }
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  },
  /** 上传端上精调成品 → 保存为新版本（不经生成式模型，零积分）。返回 { avatar, imageUrl, jobId }。 */
  applyRefine: async (id: string, file: Blob, params: Record<string, unknown>, note?: string): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const dataUrl = await new Promise<string>((ok, err) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => err(new Error("READ_FAILED"));
        fr.readAsDataURL(file);
      });
      if (c) {
        c.imageUrl = dataUrl;
        c.versions = (c.versions || 1) + 1;
        c.updated = "刚刚";
        if (c.status === "iterating" || c.status === "pending") c.status = "refining";
      }
      const job = newMockJob({ kind: "精调 · 端上美化", char: id, charName: c?.name, engine: "端上图像引擎", mode: "local" });
      const j = mockJobStore.get(job.id);
      if (j) { j.status = "done"; j.pct = 100; j.eta = "已完成"; j.stage = "done"; }
      return mock({ avatar: c ? { ...c } : { id }, imageUrl: dataUrl, jobId: job.id });
    }
    const fd = new FormData();
    fd.append("file", file, "refine.jpg");
    fd.append("params", JSON.stringify(params || {}));
    if (note) fd.append("note", note);
    return apiUpload(`/avatars/${id}/refine-apply`, fd);
  },
};

// ── 真人捕获 / 授权 ───────────────────────────────────────────

export const CaptureApi = {
  create: (avatarId: string): Promise<any> => {
    if (USE_MOCK) return mock({ id: `CAP-${mockSeq++}`, avatarId, status: "created" });
    return apiFetch(`/captures`, { method: "POST", body: JSON.stringify({ avatarId }) });
  },
  footage: (id: string, files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ id, status: "footage_uploaded" });
    return apiUpload(`/captures/${id}/footage`, files);
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
    if (USE_MOCK) return mock({ certificateUrl: "" });
    return apiFetch(`/licenses/${id}/certificate`);
  },
  renew: (id: string): Promise<any> => {
    if (USE_MOCK) return mock({ id, status: "active" });
    return apiFetch(`/licenses/${id}/renew`, { method: "POST" });
  },
  create: (body: Record<string, unknown>): Promise<any> => {
    if (USE_MOCK) return mock({ id: `LIC-${mockSeq++}`, ...body, status: "active" });
    return apiFetch(`/licenses`, { method: "POST", body: JSON.stringify(body) });
  },
};

// ── 音色 ─────────────────────────────────────────────────────

export const VoiceApi = {
  builtin: (): Promise<Mock.BuiltinVoice[]> => {
    if (USE_MOCK) return mock(Mock.BUILTIN_VOICES.slice());
    return apiFetch(`/voices/builtin`);
  },
  mine: (): Promise<Mock.VoiceAsset[]> => {
    if (USE_MOCK) return mock(Mock.VOICES.slice());
    return apiFetch(`/voices/mine`);
  },
  preview: (voiceId: string, text?: string): Promise<{ audioUrl?: string; message?: string; kind?: string }> => {
    if (USE_MOCK) return mock({ kind: "builtin", message: "内置音色为合成声线，在线试听即将上线" });
    return apiFetch(`/voices/preview`, { method: "POST", body: JSON.stringify({ voiceId, text }) });
  },
  bind: (avatarId: string, voiceName: string): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === avatarId);
      if (c) c.voiceName = voiceName;
      return mock({ avatarId, voiceName });
    }
    return apiFetch(`/avatars/${avatarId}/voice`, { method: "POST", body: JSON.stringify({ voiceName }) });
  },
  clone: (files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ id: `VC-${mockSeq++}`, name: "我的声音 01", kind: "clone", dur: "00:10", fav: false, wave: [6, 12, 8, 17, 10, 21, 9, 14, 7, 19, 11, 16, 6, 13, 20, 8, 15, 10, 18, 7] });
    return apiUpload(`/voices/clone`, files);
  },
};

// ── 任务 ─────────────────────────────────────────────────────

export const JobApi = {
  list: (params?: { status?: string; avatarId?: string }): Promise<Mock.Job[]> => {
    if (USE_MOCK) {
      seedStaticJobs();
      let all = Array.from(mockJobStore.values()).map((j) => { tickMockJob(j.id); return { ...j }; }).reverse();
      if (params?.avatarId) all = all.filter((j: any) => j.char === params.avatarId);
      if (params?.status) all = all.filter((j: any) => j.status === params.status);
      return mock(all);
    }
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return apiFetch(`/jobs${qs}`);
  },
  get: (id: string): Promise<Mock.Job> => {
    if (USE_MOCK) {
      seedStaticJobs();
      const j = tickMockJob(id) || mockJobStore.get(id);
      if (j) return mock({ ...j });
      return mock(Mock.TASKS.find((t) => t.id === id) || Mock.TASKS[0]);
    }
    return apiFetch(`/jobs/${id}`);
  },
  retry: (id: string): Promise<Mock.Job> => {
    if (USE_MOCK) {
      const j = mockJobStore.get(id);
      if (j) { j.status = "running"; j.pct = 5; j.eta = "重试中"; return mock({ ...j }); }
      return mock({ ...(Mock.TASKS.find((t) => t.id === id) || Mock.TASKS[0]), status: "running", pct: 0, eta: "重新排队中" });
    }
    return apiFetch(`/jobs/${id}/retry`, { method: "POST" });
  },
  cancel: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const j = mockJobStore.get(id);
      if (j) { j.status = "failed"; j.eta = "已取消"; }
      return mock(undefined);
    }
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
