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
// 登录：/api/auth/sms/*（正式账号）+ /api/auth/dev-login（授权内部体验入口）。
// ============================================================
import React from "react";
import * as Mock from "./data";

// ── 开关 / 错误 ──────────────────────────────────────────────

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "0";
export const ENABLE_DEV_LOGIN =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1" ||
    (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "0" &&
      process.env.NODE_ENV !== "production"));
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

/** 内嵌运营角色判定（operatorRole wire 全小写）—— 数字人广场后台门禁用。 */
export function isOperatorRole(role?: string | null): boolean {
  return role === "operator" || role === "super_admin";
}

/** 本子应用审计来源短码 —— 随请求作为 X-App-Code 头带上，让 server 登录日志可区分子应用。 */
const APP_CODE = "aiavatar";

function authHeaders(): Record<string, string> {
  const t = auth.token();
  return {
    "X-App-Code": APP_CODE,
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
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
    headers: { "Content-Type": "application/json", "X-App-Code": APP_CODE },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export const AuthApi = {
  describeSmsRequestCodeResult,
  /** 授权内部账号清单（正式环境默认不展示入口）。 */
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
  /**
   * v0.53：注册透传 platform=aiavatar（dev-grant-all=false 时按来源授权本子产品）。
   * v0.84：支持 registerTicket —— 验证码登录未注册时回带的注册凭证，带它可省略 code 免重输验证码。
   */
  smsRegister: (input: { phone: string; code?: string; registerTicket?: string; licenseKey: string; studioName: string; displayName?: string; platform?: string }): Promise<{ token: string; user: any }> =>
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
  // 数字资产平台 · 六类资产字典
  ASSET_TYPES,
  SPACE_LABELS,
  SOURCE_LABELS,
  assetTypeOf,
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
  ASSET_TYPES,
  SPACE_LABELS,
  SOURCE_LABELS,
  assetTypeOf,
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
  // 数字资产平台 · 六类资产
  AssetKind,
  AssetSource,
  AssetStatus,
  AssetTypeMeta,
  AssetSummary,
  AssetTypeTile,
  RecentAsset,
  AssetIp,
  IpDetail,
  IpMembers,
  AssetShot,
  SceneAsset,
  ProductAsset,
  StyleAsset,
  AssetUsage,
  Composition,
  CompositionOutput,
  CompositionSource,
  ComposeOptions,
  // v0.105 真人授权刷脸认证 + 素材平台审核
  Capture,
  RealAuthSession,
  RealAuthStatus,
  DapMaterialInfo,
  MaterialStatus,
  MaterialRefType,
} from "./data";

// ── Mock 任务模拟器（USE_MOCK=1 时让创建/衍生流程可观察推进）────

let mockSeq = 9000;
const mockJobStore = new Map<string, any>();
/** mock 模式下的「我的数字人」可变副本（创建流程会往里加）。 */
const mockChars: any[] = Mock.CHARS.map((c) => ({ ...c }));
/** mock 模式下运营新增的「数字人广场」公开数字人（PlazaAdminApi 往里加；live 由 server 持久化）。 */
const mockPublicExtra: any[] = [];
/** mock 回收站（软删数字人；live 模式由 server 持久化）。 */
const mockTrash: any[] = [];
/** mock 授权登记簿（刷脸认证通过后会往里追加新登记；live 由 server 持久化）。 */
const mockLicenses: Mock.License[] = Mock.LICENSES.map((l) => ({ ...l }));

// ── 数字资产平台 · 六类资产的 mock 「数据库」──────────────────
const mockIps: Mock.AssetIp[] = Mock.ASSET_IPS.map((x) => ({ ...x, members: { ...x.members } }));
const mockScenes: Mock.SceneAsset[] = Mock.SCENE_ASSETS.map((x) => ({ ...x, variants: x.variants.slice() }));
const mockProducts: Mock.ProductAsset[] = Mock.PRODUCT_ASSETS.map((x) => ({ ...x, angles: x.angles.slice() }));
const mockStyles: Mock.StyleAsset[] = Mock.STYLE_ASSETS.map((x) => ({ ...x, tags: x.tags.slice() }));
const mockCompositions: Mock.Composition[] = Mock.COMPOSITIONS.map((x) => ({ ...x }));
const mockUsages: Record<string, Mock.AssetUsage[]> = JSON.parse(JSON.stringify(Mock.ASSET_USAGES));

const MOCK_COST_PER_IMAGE = 3;

/** 描述 → 资产名（与 server DapAssetService.truncate 同规则：截断并去掉截口标点）。 */
function nameFromPrompt(prompt: string, n = 12): string {
  const s = String(prompt || "").trim();
  if (s.length <= n) return s;
  const head = s.slice(0, n).replace(/[\s，。、；：,.;:!?！？]+$/, "");
  return (head || s.slice(0, n)) + "…";
}

/** mock：六类资产总览（数量随 mock 库实时变化，与资产库分类计数一致）。 */
function buildMockSummary(): Mock.AssetSummary {
  const counts: Record<string, number> = {
    character: mockChars.length,
    ip: mockIps.length,
    scene: mockScenes.length,
    product: mockProducts.length,
    voice: Mock.VOICES.length,
    style: mockStyles.length,
  };
  const types = Mock.ASSET_TYPES.map((t) => ({
    key: t.key, label: t.label, prefix: t.prefix, count: counts[t.key] || 0,
  }));
  const recent: Mock.RecentAsset[] = [
    ...mockScenes.slice(0, 2).map((s) => ({
      kind: "scene" as const, kindLabel: "场景", id: s.id, name: s.name, when: s.updated, imageUrl: s.imageUrl,
    })),
    ...mockChars.slice(0, 2).map((c: any) => ({
      kind: "character" as const, kindLabel: "人物", id: c.id, name: c.name, when: c.updated, imageUrl: c.imageUrl || null,
    })),
    ...mockProducts.slice(0, 1).map((p) => ({
      kind: "product" as const, kindLabel: "产品", id: p.id, name: p.name, when: p.updated, imageUrl: p.imageUrl,
    })),
  ];
  const total = types.reduce((a, t) => a + t.count, 0);
  const bytes = 4.2 * 1024 * 1024 * 1024;
  return { totalCount: total, totalBytes: bytes, totalSizeLabel: "4.2 GB", types, recent };
}

/** mock：把一次合成的引用写进台账（与 server recordUsages 同语义）。 */
function mockRecordUsage(assetType: string, assetId: string | null | undefined, u: Mock.AssetUsage) {
  if (!assetId) return;
  const key = `${assetType}:${assetId}`;
  const list = mockUsages[key] || (mockUsages[key] = []);
  const hit = list.find((x) => x.usedById === u.usedById);
  if (hit) hit.times += 1;
  else list.unshift({ ...u });
}

function newMockJob(partial: Partial<Mock.Job> & { kind: string } & Record<string, unknown>): Mock.Job {
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
  if (job.pct >= 100) {
    job.pct = 100;
    job.status = "done";
    // 确定性回填衍生计数（与任务完成同一时刻发生，awaitJob 解析后即可读到最新计数）
    if (job.derivApply) applyMockDerivDone(job.derivApply);
    // 六类资产 / 合成的产物回填：同样在翻 done 的那一刻同步执行，
    // 否则 awaitJob 解析后立刻取详情会读到还没产出的旧状态。
    if (job.assetApply) {
      const apply = job.assetApply;
      job.assetApply = null;
      try { apply(); } catch { /* noop */ }
    }
  }
  return job;
}

/** mock：衍生任务完成时把对应数字人的 deriv 状态翻成 done 并累加 counts。 */
function applyMockDerivDone(apply: { id: string; type: string }) {
  const c = mockChars.find((x) => x.id === apply.id);
  if (!c) return;
  c.deriv = { ...c.deriv, [apply.type]: "done" };
  const inc: any = { atlas: 5, expr: 4, scene: 2, ward: 2, d3: 1, video: 1 };
  c.counts = { ...c.counts, [apply.type]: (c.counts?.[apply.type] || 0) + (inc[apply.type] || 1) };
  c.updated = "刚刚";
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
  assetSummary: (): Mock.AssetSummary | null => (USE_MOCK ? buildMockSummary() : null),
  ips: (): Mock.AssetIp[] => (USE_MOCK ? mockIps.slice() : []),
  scenes2: (): Mock.SceneAsset[] => (USE_MOCK ? mockScenes.slice() : []),
  products: (): Mock.ProductAsset[] => (USE_MOCK ? mockProducts.slice() : []),
  styles: (): Mock.StyleAsset[] => (USE_MOCK ? mockStyles.slice() : []),
  compositions: (): Mock.Composition[] => (USE_MOCK ? mockCompositions.slice() : []),
  composeOptions: (): Mock.ComposeOptions | null =>
    USE_MOCK
      ? { costPerImage: 3, minCount: 1, maxCount: 8, defaultCount: 4, ratios: ["9:16", "1:1", "16:9"], styles: mockStyles.slice() }
      : null,
  builtinVoices: (): Mock.BuiltinVoice[] => (USE_MOCK ? Mock.BUILTIN_VOICES.slice() : []),
  myVoices: (): Mock.VoiceAsset[] => (USE_MOCK ? Mock.VOICES.slice() : []),
  jobs: (): Mock.Job[] => (USE_MOCK ? Mock.TASKS.map((t) => ({ ...t })) : []),
  licenses: (): Mock.License[] => (USE_MOCK ? mockLicenses.slice() : []),
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
    if (USE_MOCK) return mock(scope === "public" ? [...Mock.PUBLIC_AVATARS, ...mockPublicExtra] : mockChars.slice());
    const qs = new URLSearchParams({ scope, ...(params as any) }).toString();
    return apiFetch(`/avatars?${qs}`);
  },
  get: (id: string): Promise<any> => {
    if (USE_MOCK) {
      if (String(id).startsWith("PA-")) {
        const pub = Mock.PUBLIC_AVATARS.find((c) => c.id === id) || mockPublicExtra.find((c) => c.id === id);
        if (pub) return mock(pub);   // 数字人广场公开形象（只读，不在 mockChars 里）
      }
      return mock(mockChars.find((c) => c.id === id) || mockChars[0]);
    }
    return apiFetch(`/avatars/${id}`);
  },
  /** v0.61 反向「应用于」：数字人被哪些 music/drama 艺人壳引用。 */
  references: (id: string): Promise<Mock.AvatarReference[]> => {
    if (USE_MOCK) return mock((Mock.AVATAR_REFERENCES[id] || []).slice());
    return apiFetch(`/avatars/${id}/references`);
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
  switchVersion: (id: string, version: number): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      if (c) { c.versions = (c.versions || 1) + 1; c.updated = "刚刚"; }
      return mock(c || { id });
    }
    return apiFetch(`/avatars/${id}/versions/${version}/switch`, { method: "POST" });
  },
  forkVersion: (id: string, version: number): Promise<any> => {
    if (USE_MOCK) {
      const c = mockChars.find((x) => x.id === id);
      const copy = c ? { ...c, id: `DH-${mockSeq++}`, name: `${c.name} · v${version}`, counts: {}, deriv: {}, versions: 1, updated: "刚刚" } : { id: `DH-${mockSeq++}` };
      mockChars.unshift(copy as any);
      return mock(copy);
    }
    return apiFetch(`/avatars/${id}/versions/${version}/fork`, { method: "POST" });
  },
  /**
   * 数字人广场「另存为我的数字人」：把只读公开数字人（PA-*）复制为当前用户可编辑的副本（DH-*）。
   * 复制形象图集 / 设定档案 / 配色，状态置为已就绪，之后可自由改名 / 迭代 / 衍生。
   */
  saveAs: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const src = Mock.PUBLIC_AVATARS.find((c) => c.id === id) || mockPublicExtra.find((c) => c.id === id);
      const copy: any = src
        ? { ...JSON.parse(JSON.stringify(src)), id: `DH-${mockSeq++}`, codename: `${src.codename || "avatar"}-copy`, fav: false, versions: 1, updated: "刚刚", managed: undefined }
        : { id: `DH-${mockSeq++}` };
      mockChars.unshift(copy);
      return mock(copy);
    }
    return apiFetch(`/avatars/${id}/save-as`, { method: "POST" });
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
      // derivKey 让任务中心能定位回对应衍生；derivApply 让 tickMockJob 在完成时确定性回填计数
      const job = newMockJob({ kind: kindZh[body.type] || "衍生生成", char: id, charName: c?.name, derivKey: body.type, derivApply: { id, type: body.type } });
      if (c) c.deriv = { ...c.deriv, [body.type]: "running" };
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
  imageBlob: async (id: string, cacheKey?: string | number): Promise<Blob | null> => {
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
      const qs = cacheKey === undefined ? "" : `?t=${encodeURIComponent(String(cacheKey))}`;
      const res = await fetch(`${API_PREFIX}/avatars/${id}/image${qs}`, { headers: { ...authHeaders() }, cache: "no-store" });
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

// ── 数字人广场 · 运营内嵌后台（OPERATOR / SUPER_ADMIN）─────────
// 路径 /api/v1/admin/**（server 门禁 hasAnyRole(SUPER_ADMIN, OPERATOR)）。

/** 新增 / 编辑公开数字人入参。*Url 仅 mock 展示用，server 忽略（认 *Key）。 */
export interface PlazaUpsert {
  name: string;
  codename?: string;
  archetype?: string;
  tagline?: string;
  cat?: string;
  hue?: number;
  voiceName?: string;
  age?: string;
  temperament?: string;
  usage?: string;
  traits?: string[];
  outfit?: string;
  persona?: string;
  frontKey?: string;
  rightKey?: string;
  leftKey?: string;
  frontUrl?: string;
  rightUrl?: string;
  leftUrl?: string;
}

function mockPlazaFrom(body: PlazaUpsert, base: any | null, id?: string): any {
  const front = body.frontUrl || base?.imageUrl || null;
  const right = body.rightUrl || base?.shotImages?.right || null;
  const left = body.leftUrl || base?.shotImages?.left || null;
  const bd = base?.def || {};
  const def = {
    年龄: body.age ?? bd["年龄"] ?? "",
    气质: body.temperament ?? bd["气质"] ?? "",
    用途: body.usage ?? bd["用途"] ?? "",
    性格: body.traits ?? bd["性格"] ?? [],
    服饰: body.outfit ?? bd["服饰"] ?? "",
    形象来源: "AI 原创虚构",
    设定语: body.persona ?? bd["设定语"] ?? "",
  };
  const shotImages: Record<string, string> = {};
  if (front) shotImages["front-half"] = front;
  if (right) shotImages["right"] = right;
  if (left) shotImages["left"] = left;
  return {
    id: id || `PA-m${mockSeq++}`,
    name: body.name,
    codename: body.codename || base?.codename || "plaza-avatar",
    path: "ai",
    archetype: body.archetype ?? base?.archetype ?? "",
    tagline: body.tagline ?? base?.tagline ?? "",
    status: "archived",
    updated: "已就绪",
    hue: body.hue ?? base?.hue ?? 222,
    cat: body.cat ?? base?.cat ?? "pro",
    fav: false,
    versions: 1,
    engine: "SDXL",
    voiceName: body.voiceName ?? base?.voiceName ?? "亲和邻家女声",
    palette: base?.palette || {},
    def,
    counts: {},
    deriv: {},
    imageUrl: front,
    shotImages,
    managed: true,
  };
}

export const PlazaAdminApi = {
  /** 运营公开数字人列表（仅 DB managed 项；内置 10 个不在此列）。 */
  list: (): Promise<any[]> => {
    if (USE_MOCK) return mock(mockPublicExtra.slice());
    return apiFetch(`/admin/avatars`);
  },
  /** 上传一张形象图 → { key, url }。key 放进 create/update 的 frontKey/rightKey/leftKey。 */
  uploadImage: (file: File, kind: "front" | "right" | "left" = "front"): Promise<{ key: string; url: string }> => {
    if (USE_MOCK) return mock({ key: `mockkey-${mockSeq++}`, url: URL.createObjectURL(file) });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    return apiUpload(`/admin/uploads`, fd);
  },
  create: (body: PlazaUpsert): Promise<any> => {
    if (USE_MOCK) {
      const a = mockPlazaFrom(body, null);
      mockPublicExtra.unshift(a);
      return mock(a);
    }
    return apiFetch(`/admin/avatars`, { method: "POST", body: JSON.stringify(body) });
  },
  update: (id: string, body: PlazaUpsert): Promise<any> => {
    if (USE_MOCK) {
      const i = mockPublicExtra.findIndex((x) => x.id === id);
      const a = mockPlazaFrom(body, i >= 0 ? mockPublicExtra[i] : null, id);
      if (i >= 0) mockPublicExtra[i] = a; else mockPublicExtra.unshift(a);
      return mock(a);
    }
    return apiFetch(`/admin/avatars/${id}`, { method: "PUT", body: JSON.stringify(body) });
  },
  remove: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockPublicExtra.findIndex((x) => x.id === id);
      if (i >= 0) mockPublicExtra.splice(i, 1);
      return mock({ deleted: true });
    }
    return apiFetch(`/admin/avatars/${id}`, { method: "DELETE" });
  },
};

// ── 真人捕获 / 刷脸认证 / 授权 ─────────────────────────────────

/** mock 捕获会话：{captureId → avatarId}，供认证会话与核验回填授权时定位人物。 */
const mockCaptures = new Map<string, { id: string; avatarId: string }>();

/**
 * mock 刷脸认证会话。状态按「创建至今经过的时间」惰性推进，
 * 与 mockJobStore 同思路：不开定时器，每次 get 现算，保证读到什么就是什么。
 *   0 ~ 1.5s  准备中     1.5 ~ 7.5s 待认证（可去刷脸）
 *   7.5 ~ 9.5s 核验中     ≥ 9.5s     已通过
 */
const mockAuthSessions = new Map<string, any>();
/** {captureId → 最近一次认证会话 id}，让 verify 能找到该捕获的认证结果。 */
const mockAuthByCapture = new Map<string, string>();

const MOCK_AUTH_PREPARING_MS = 1_500;
const MOCK_AUTH_AWAITING_MS = 7_500;
const MOCK_AUTH_VALIDATING_MS = 9_500;

function mockAuthStatusOf(s: any): Mock.RealAuthStatus {
  if (s.forcedStatus) return s.forcedStatus;
  const t = Date.now() - s.startedAt;
  if (t < MOCK_AUTH_PREPARING_MS) return "preparing";
  if (t < MOCK_AUTH_AWAITING_MS) return "awaiting_auth";
  if (t < MOCK_AUTH_VALIDATING_MS) return "validating";
  return "active";
}

function mockAuthSnapshot(s: any): Mock.RealAuthSession {
  const status = mockAuthStatusOf(s);
  return {
    id: s.id,
    captureId: s.captureId,
    avatarId: s.avatarId || null,
    status,
    // 链接短时有效：每次拉取都带上本次拉取时间戳，模拟「过期后重新获取会换新链接」
    h5Url: status === "awaiting_auth" ? `about:blank#mock-face-auth-${s.id}-${Date.now()}` : null,
    failReason: status === "failed" ? s.failReason || "认证未通过，请重新认证" : null,
    mock: true,
    createdAt: new Date(s.startedAt).toISOString(),
  };
}

/** mock：核验通过后登记一条「已刷脸核验」的肖像授权，并绑定到人物资产上。 */
function mockRegisterLicense(avatarId: string | null | undefined): string | undefined {
  if (!avatarId) return undefined;
  const c: any = mockChars.find((x: any) => x.id === avatarId);
  const existing = c?.license && mockLicenses.find((l) => l.id === c.license);
  if (existing) {
    existing.status = "active";
    existing.verifyMethod = "liveness";
    return existing.id;
  }
  const id = `LIC-${9000 + mockSeq++}`;
  const today = new Date();
  const year = today.getFullYear();
  mockLicenses.unshift({
    id,
    subject: `${c?.name || "本人"}（本人授权）`,
    char: avatarId,
    scope: "品牌商用 / 全平台",
    period: `${year}-${String(today.getMonth() + 1).padStart(2, "0")} ~ ${year + 2}-${String(today.getMonth() + 1).padStart(2, "0")}`,
    platforms: ["全平台"],
    status: "active",
    signed: today.toISOString().slice(0, 10),
    photos: 5,
    verifyMethod: "liveness",
  });
  if (c) { c.license = id; c.updated = "刚刚"; }
  return id;
}

export const CaptureApi = {
  create: (avatarId: string): Promise<any> => {
    if (USE_MOCK) {
      const id = `CAP-${mockSeq++}`;
      mockCaptures.set(id, { id, avatarId });
      return mock({ id, avatarId, status: "created" });
    }
    return apiFetch(`/captures`, { method: "POST", body: JSON.stringify({ avatarId }) });
  },
  footage: (id: string, files: FormData): Promise<any> => {
    if (USE_MOCK) return mock({ id, status: "footage_uploaded" });
    return apiUpload(`/captures/${id}/footage`, files);
  },
  /**
   * 核验并登记授权。刷脸认证尚未完成时 server 返回 409 DAP_AUTH_NOT_COMPLETED，
   * 调用方应回到等待轮询而不是当作失败。
   */
  verify: (id: string): Promise<{ passed: boolean; captureId: string; licenseId?: string }> => {
    if (USE_MOCK) {
      const sid = mockAuthByCapture.get(id);
      const s = sid ? mockAuthSessions.get(sid) : null;
      const status = s ? mockAuthStatusOf(s) : null;
      if (status !== "active") {
        return Promise.reject(new ApiError("刷脸认证尚未完成", "DAP_AUTH_NOT_COMPLETED", 409));
      }
      const licenseId = mockRegisterLicense(s.avatarId || mockCaptures.get(id)?.avatarId);
      return mock({ passed: true, captureId: id, licenseId });
    }
    return apiFetch(`/captures/${id}/verify`, { method: "POST" });
  },
};

/**
 * 真人授权刷脸认证会话（v0.105）。
 * 流程：start(captureId) 建会话 → 轮询 get(id) → awaiting_auth 时打开 h5Url 刷脸
 *      → active 后调 CaptureApi.verify(captureId) 落授权登记。
 */
export const RealAuthApi = {
  start: (captureId: string): Promise<Mock.RealAuthSession> => {
    if (USE_MOCK) {
      const id = `RAS-${mockSeq++}`;
      const s = {
        id, captureId, avatarId: mockCaptures.get(captureId)?.avatarId || null,
        startedAt: Date.now(), forcedStatus: null as Mock.RealAuthStatus | null, failReason: null as string | null,
      };
      mockAuthSessions.set(id, s);
      mockAuthByCapture.set(captureId, id);
      return mock(mockAuthSnapshot(s));
    }
    return apiFetch(`/real-auth/sessions`, { method: "POST", body: JSON.stringify({ captureId }) });
  },
  get: (id: string): Promise<Mock.RealAuthSession> => {
    if (USE_MOCK) {
      const s = mockAuthSessions.get(id);
      if (!s) return Promise.reject(new ApiError("认证会话不存在或已失效", "DAP_AUTH_SESSION_NOT_FOUND", 404));
      return mock(mockAuthSnapshot(s));
    }
    return apiFetch(`/real-auth/sessions/${id}`);
  },
};

/**
 * 素材平台审核（v0.105）。人物形象主图等素材提交内容安全审核，
 * 通过后才可用于视频生成。
 */
const mockMaterials: Record<string, any[]> = Object.fromEntries(
  Object.entries(Mock.MATERIALS).map(([k, v]) => [k, v.map((m) => ({ ...m, frozen: true }))]),
);

const MOCK_MAT_REVIEWING_MS = 2_000;
const MOCK_MAT_APPROVED_MS = 5_000;

/** mock：按提交至今的时间惰性推进审核状态（种子样本 frozen，保持定案态）。 */
function mockMaterialSnapshot(m: any): Mock.DapMaterialInfo {
  if (m.frozen) { const { frozen, startedAt, ...rest } = m; return rest as Mock.DapMaterialInfo; }
  const t = Date.now() - m.startedAt;
  const status: Mock.MaterialStatus = t < MOCK_MAT_REVIEWING_MS ? "pending" : t < MOCK_MAT_APPROVED_MS ? "reviewing" : "approved";
  const { frozen, startedAt, ...rest } = m;
  return { ...rest, status, updatedAt: new Date().toISOString() } as Mock.DapMaterialInfo;
}

export const MaterialApi = {
  /** 提交平台审核。同一资产已有「未被驳回」的记录时幂等返回既有记录。 */
  submit: (refType: Mock.MaterialRefType, refId: string, name?: string): Promise<Mock.DapMaterialInfo> => {
    if (USE_MOCK) {
      const key = `${refType}:${refId}`;
      const list = mockMaterials[key] || (mockMaterials[key] = []);
      const alive = list.map(mockMaterialSnapshot).find((m) => m.status !== "failed");
      if (alive) return mock(alive);
      const now = new Date().toISOString();
      const c: any = mockChars.find((x: any) => x.id === refId);
      const fresh = {
        id: `MAT-${mockSeq++}`, refType, refId, type: "image" as const,
        name: name || `${c?.name || refId} · 形象主图`,
        status: "pending" as Mock.MaterialStatus, failReason: null, qassetUri: null, mock: true,
        createdAt: now, updatedAt: now, frozen: false, startedAt: Date.now(),
      };
      list.unshift(fresh);
      return mock(mockMaterialSnapshot(fresh));
    }
    return apiFetch(`/materials`, { method: "POST", body: JSON.stringify({ refType, refId }) });
  },
  listByRef: (refType: Mock.MaterialRefType, refId: string): Promise<Mock.DapMaterialInfo[]> => {
    if (USE_MOCK) return mock((mockMaterials[`${refType}:${refId}`] || []).map(mockMaterialSnapshot));
    return apiFetch(`/materials?refType=${encodeURIComponent(refType)}&refId=${encodeURIComponent(refId)}`);
  },
};

export const LicenseApi = {
  list: (status?: string): Promise<any[]> => {
    if (USE_MOCK) return mock(status ? mockLicenses.filter((l) => l.status === status) : mockLicenses.slice());
    return apiFetch(`/licenses${status ? `?status=${status}` : ""}`);
  },
  get: (id: string): Promise<any> => {
    if (USE_MOCK) return mock(mockLicenses.find((l) => l.id === id) || mockLicenses[0]);
    return apiFetch(`/licenses/${id}`);
  },
  certificate: (id: string): Promise<{ certificateUrl: string }> => {
    if (USE_MOCK) return mock({ certificateUrl: "" });
    return apiFetch(`/licenses/${id}/certificate`);
  },
  renew: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const l = mockLicenses.find((x) => x.id === id);
      if (l) l.status = "active";
      return mock(l || { id, status: "active" });
    }
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
    if (USE_MOCK) return mock({ kind: "builtin", message: "内置音色为合成声线，可直接绑定到数字人资产" });
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

// ── 钱包 / 在线充值（v2 §6 aiavatar 接入）──────────────────────────────────────
// 复用主用户域 /api/me/wallet/*（非 /api/v1）：meFetch 走 /api 前缀 + Bearer + X-App-Code。
// 真模式打真后端的充值套餐 / 下单 / 影子确认；mock 模式给样例 + 影子收银台,流程可走通。
export type WalletPackage = {
  id: string; credits: number; priceCents: number; tag: string; recommended?: boolean; bonusCredits?: number;
};
export type CheckoutResult = { orderId: string; payDataType: string; payData: string };

// 仅 USE_MOCK=1（无后端 dev）兜底套餐示例。真模式（下方）打 /me/wallet/packages?sourceApp=aiavatar
// 取 admin 后台配置 —— 充值套餐上线后纯靠后台配置，后端不播种 seed。改价 / 加套餐去 admin 财务控制台。
const MOCK_WALLET_PACKAGES: WalletPackage[] = [
  { id: "pkg-300", credits: 300, priceCents: 9_900, tag: "体验包", recommended: false, bonusCredits: 0 },
  { id: "pkg-1000", credits: 1_000, priceCents: 29_900, tag: "标准包", recommended: true, bonusCredits: 100 },
  { id: "pkg-3000", credits: 3_000, priceCents: 79_900, tag: "热门包", recommended: false, bonusCredits: 500 },
  { id: "pkg-10000", credits: 10_000, priceCents: 239_900, tag: "企业包", recommended: false, bonusCredits: 2_000 },
];

/** 主用户域 fetch（/api 前缀，非 /api/v1；带 Bearer + X-App-Code）。用于复用 /me/wallet/*。 */
async function meFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  return parseResponse<T>(res);
}

export const WalletApi = {
  packages: (): Promise<WalletPackage[]> => {
    if (USE_MOCK) return mock(MOCK_WALLET_PACKAGES.slice());
    return meFetch(`/me/wallet/packages?sourceApp=aiavatar`);
  },
  checkout: (packageId: string): Promise<CheckoutResult> => {
    if (USE_MOCK) return mock({ orderId: `ro-mock-${packageId}`, payDataType: "shadow", payData: "" });
    return meFetch(`/me/wallet/recharge/checkout`, {
      method: "POST",
      body: JSON.stringify({ packageId, sourceApp: "aiavatar" }),
    });
  },
  confirmShadow: (orderId: string, result: "success" | "fail" | "timeout" = "success"): Promise<any> => {
    if (USE_MOCK) return mock({ id: orderId, status: result === "success" ? "paid" : "cancelled" });
    return meFetch(`/dev/pay/shadow/confirm`, { method: "POST", body: JSON.stringify({ orderId, result }) });
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

// ════════════════════════════════════════════════════════════
// 数字资产平台 · 六类资产（/api/v1/assets/**）
//
// 「数字人」是六类资产之一：DH- 人物 / IP- 品牌 / SC- 场景 / PD- 产品 /
// VO- 声音 / ST- 风格。人物与声音沿用上面既有的 AvatarApi / VoiceApi，
// 这里只补另外四类 + 总览 + 引用台账。
// ════════════════════════════════════════════════════════════

/**
 * mock：给场景 / 产品 / 合成的异步生成起一个会推进到 done 的任务。
 * `apply` 由 tickMockJob 在任务翻 done 的同一刻同步调用 —— 与 awaitJob 的解析时机对齐，
 * 保证「等任务结束 → 立刻取详情」读到的是已产出的状态。
 */
function mockAssetJob(kind: string, assetId: string, assetName: string, apply: () => void) {
  return newMockJob({ kind, char: assetId, charName: assetName, assetId, assetApply: apply } as any);
}

export const AssetApi = {
  /** 六类资产总览（首页 · 资产总览 + 资产库分类计数）。 */
  summary: (): Promise<Mock.AssetSummary> => {
    if (USE_MOCK) return mock(buildMockSummary());
    return apiFetch(`/assets/summary`);
  },

  // ── IP 容器 ──────────────────────────────────────────────
  ips: (): Promise<Mock.AssetIp[]> => {
    // 成员数按真实归属实时算，保证列表与详情页统计一致
    if (USE_MOCK) return mock(mockIps.map((ip) => ({ ...ip, members: mockIpMembers(ip.id) })));
    return apiFetch(`/assets/ips`);
  },
  createIp: (body: { name: string; tagline?: string; summary?: string }): Promise<Mock.AssetIp> => {
    if (USE_MOCK) {
      const ip: Mock.AssetIp = {
        id: `IP-${mockSeq++}`, name: body.name, tagline: body.tagline || null, summary: body.summary || null,
        status: "ready", licenseId: null, licenseStatus: null, coverUrl: null,
        hue: 210, versions: 1, updated: "刚刚",
        members: { characters: 0, scenes: 0, products: 0, voices: 0 }, works: 0,
      };
      mockIps.unshift(ip);
      return mock(ip);
    }
    return apiFetch(`/assets/ips`, { method: "POST", body: JSON.stringify(body) });
  },
  ip: (id: string): Promise<Mock.IpDetail> => {
    if (USE_MOCK) return mock(buildMockIpDetail(id));
    return apiFetch(`/assets/ips/${id}`);
  },
  patchIp: (id: string, body: Record<string, unknown>): Promise<Mock.AssetIp> => {
    if (USE_MOCK) {
      const ip = mockIps.find((x) => x.id === id);
      if (ip) Object.assign(ip, body, { updated: "刚刚" });
      return mock(ip || ({ id } as any));
    }
    return apiFetch(`/assets/ips/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  removeIp: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockIps.findIndex((x) => x.id === id);
      if (i >= 0) mockIps.splice(i, 1);
      mockScenes.forEach((s) => { if (s.ipId === id) s.ipId = null; });
      mockProducts.forEach((p) => { if (p.ipId === id) p.ipId = null; });
      mockChars.forEach((c: any) => { if (c.ipId === id) c.ipId = null; });
      return mock({ deleted: true });
    }
    return apiFetch(`/assets/ips/${id}`, { method: "DELETE" });
  },
  /** 关联 / 取消关联成员资产（assetType: character | scene | product）。 */
  ipMember: (id: string, body: { assetType: string; assetId: string; attach?: boolean }): Promise<Mock.IpDetail> => {
    if (USE_MOCK) {
      const target = body.attach === false ? null : id;
      if (body.assetType === "scene") {
        const s = mockScenes.find((x) => x.id === body.assetId);
        if (s) s.ipId = target;
      } else if (body.assetType === "product") {
        const p = mockProducts.find((x) => x.id === body.assetId);
        if (p) p.ipId = target;
      } else {
        const c: any = mockChars.find((x: any) => x.id === body.assetId);
        if (c) c.ipId = target;
      }
      return mock(buildMockIpDetail(id));
    }
    return apiFetch(`/assets/ips/${id}/members`, { method: "POST", body: JSON.stringify(body) });
  },
  /** 登记 / 续签 IP 授权（设计 §02：只有真人肖像与 IP 需要授权）。 */
  ipLicense: (id: string, body?: { subject?: string; scope?: string; years?: number; platforms?: string[] }): Promise<any> => {
    if (USE_MOCK) {
      const ip = mockIps.find((x) => x.id === id);
      const licId = ip?.licenseId || `LIC-${mockSeq++}`;
      if (ip) { ip.licenseId = licId; ip.licenseStatus = "active"; ip.updated = "刚刚"; }
      const year = new Date().getFullYear();
      return mock({
        id: licId, subject: body?.subject || ip?.name || "IP 品牌授权", char: null, ipId: id,
        scope: body?.scope || "品牌商用 / 全平台", period: `${year}-01 ~ ${year + (body?.years || 2)}-01`,
        platforms: body?.platforms || ["全平台"], status: "active",
        signed: new Date().toISOString().slice(0, 10), photos: 0, expiresOn: `${year + (body?.years || 2)}-01`,
      });
    }
    return apiFetch(`/assets/ips/${id}/license`, { method: "POST", body: JSON.stringify(body || {}) });
  },

  // ── 场景 ─────────────────────────────────────────────────
  scenes: (params?: { source?: string; space?: string; ipId?: string; q?: string }): Promise<Mock.SceneAsset[]> => {
    if (USE_MOCK) {
      let list = mockScenes.slice();
      if (params?.source) list = list.filter((s) => s.source === params.source);
      if (params?.space) list = list.filter((s) => s.space === params.space);
      if (params?.ipId) list = list.filter((s) => s.ipId === params.ipId);
      if (params?.q) {
        const q = params.q.toLowerCase();
        list = list.filter((s) => (s.name + s.id + (s.description || "")).toLowerCase().includes(q));
      }
      return mock(list);
    }
    const qs = params ? `?${new URLSearchParams(cleanParams(params)).toString()}` : "";
    return apiFetch(`/assets/scenes${qs}`);
  },
  scene: (id: string): Promise<Mock.SceneAsset> => {
    if (USE_MOCK) return mock(mockScenes.find((s) => s.id === id) || mockScenes[0]);
    return apiFetch(`/assets/scenes/${id}`);
  },
  /** AI 生成场景（异步任务 + 扣费）→ { scene, job }。 */
  createScene: (body: { name?: string; description?: string; prompt: string; space?: string; light?: string; ipId?: string; ratio?: string }): Promise<any> => {
    if (USE_MOCK) {
      const s: Mock.SceneAsset = {
        id: `SC-${mockSeq++}`, name: body.name || nameFromPrompt(body.prompt), description: body.description || null,
        source: "ai", space: body.space || "indoor", light: body.light || null,
        width: 1024, height: 640, spec: "1024 × 640", imageUrl: null, ipId: body.ipId || null,
        status: "running", jobId: null, hue: 205, updated: "刚刚", variants: [], usageCount: 0,
      };
      mockScenes.unshift(s);
      const job = mockAssetJob("场景生成", s.id, s.name, () => {
        s.status = "ready";
        s.imageUrl = "/generated/avatar-previews/example-home-lifestyle.jpg";
        s.updated = "刚刚";
      });
      s.jobId = job.id;
      return mock({ scene: s, job: { ...job } });
    }
    return apiFetch(`/assets/scenes`, { method: "POST", body: JSON.stringify(body) });
  },
  /** 实拍上传入库（multipart；轻资产不扣费）。 */
  uploadScene: (file: File, meta: { name?: string; description?: string; space?: string; light?: string; ipId?: string } = {}): Promise<Mock.SceneAsset> => {
    if (USE_MOCK) {
      const s: Mock.SceneAsset = {
        id: `SC-${mockSeq++}`, name: meta.name || file.name.replace(/\.[^.]+$/, ""),
        description: meta.description || null, source: "shot", space: meta.space || "indoor",
        light: meta.light || null, width: 0, height: 0, spec: "—",
        imageUrl: URL.createObjectURL(file), ipId: meta.ipId || null,
        status: "ready", jobId: null, hue: 200, updated: "刚刚", variants: [], usageCount: 0,
      };
      mockScenes.unshift(s);
      return mock(s);
    }
    const fd = new FormData();
    fd.append("file", file);
    Object.entries(meta).forEach(([k, v]) => { if (v) fd.append(k, String(v)); });
    return apiUpload(`/assets/scenes/upload`, fd);
  },
  patchScene: (id: string, body: Record<string, unknown>): Promise<Mock.SceneAsset> => {
    if (USE_MOCK) {
      const s = mockScenes.find((x) => x.id === id);
      if (s) Object.assign(s, body, { updated: "刚刚" });
      return mock(s || ({ id } as any));
    }
    return apiFetch(`/assets/scenes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  removeScene: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockScenes.findIndex((x) => x.id === id);
      if (i >= 0) mockScenes.splice(i, 1);
      return mock({ deleted: true });
    }
    return apiFetch(`/assets/scenes/${id}`, { method: "DELETE" });
  },
  /** 生成光线变体（按张扣费）→ { job }。 */
  sceneVariants: (id: string, labels?: string[]): Promise<any> => {
    if (USE_MOCK) {
      const s = mockScenes.find((x) => x.id === id);
      const picks = labels && labels.length ? labels : ["午后", "夜晚"];
      const job = mockAssetJob("场景光线变体", id, s?.name || id, () => {
        if (!s) return;
        picks.forEach((label) => {
          const at = s.variants.findIndex((v) => v.label === label);
          const item = { label, url: s.imageUrl || "", spec: "1024 × 640" };
          if (at >= 0) s.variants[at] = item; else s.variants.push(item);
        });
        s.updated = "刚刚";
      });
      return mock({ job: { ...job } });
    }
    return apiFetch(`/assets/scenes/${id}/variants`, { method: "POST", body: JSON.stringify({ labels: labels || [] }) });
  },

  // ── 产品 ─────────────────────────────────────────────────
  products: (params?: { category?: string; ipId?: string; q?: string }): Promise<Mock.ProductAsset[]> => {
    if (USE_MOCK) {
      let list = mockProducts.slice();
      if (params?.category) list = list.filter((p) => p.category === params.category);
      if (params?.ipId) list = list.filter((p) => p.ipId === params.ipId);
      if (params?.q) {
        const q = params.q.toLowerCase();
        list = list.filter((p) => (p.name + p.id + (p.category || "")).toLowerCase().includes(q));
      }
      return mock(list);
    }
    const qs = params ? `?${new URLSearchParams(cleanParams(params)).toString()}` : "";
    return apiFetch(`/assets/products${qs}`);
  },
  product: (id: string): Promise<Mock.ProductAsset> => {
    if (USE_MOCK) return mock(mockProducts.find((p) => p.id === id) || mockProducts[0]);
    return apiFetch(`/assets/products/${id}`);
  },
  createProduct: (body: { name?: string; category?: string; description?: string; prompt: string; ipId?: string; brandAuthorized?: boolean; brandLicenseUntil?: string }): Promise<any> => {
    if (USE_MOCK) {
      const p: Mock.ProductAsset = {
        id: `PD-${mockSeq++}`, name: body.name || nameFromPrompt(body.prompt), category: body.category || null,
        description: body.description || null, source: "ai", ipId: body.ipId || null,
        brandAuthorized: !!body.brandAuthorized, brandLicenseUntil: body.brandLicenseUntil || null,
        imageUrl: null, angles: [], status: "running", jobId: null, hue: 26, updated: "刚刚", usageCount: 0,
      };
      mockProducts.unshift(p);
      const job = mockAssetJob("产品图生成", p.id, p.name, () => {
        p.status = "ready";
        p.angles = [{ label: "正面", url: "", spec: "1024 × 1024 · PNG" }];
        p.updated = "刚刚";
      });
      p.jobId = job.id;
      return mock({ product: p, job: { ...job } });
    }
    return apiFetch(`/assets/products`, { method: "POST", body: JSON.stringify(body) });
  },
  uploadProduct: (file: File, meta: { name?: string; category?: string; description?: string; ipId?: string; brandAuthorized?: boolean; brandLicenseUntil?: string } = {}): Promise<Mock.ProductAsset> => {
    if (USE_MOCK) {
      const url = URL.createObjectURL(file);
      const p: Mock.ProductAsset = {
        id: `PD-${mockSeq++}`, name: meta.name || file.name.replace(/\.[^.]+$/, ""),
        category: meta.category || null, description: meta.description || null, source: "shot",
        ipId: meta.ipId || null, brandAuthorized: !!meta.brandAuthorized,
        brandLicenseUntil: meta.brandLicenseUntil || null, imageUrl: url,
        angles: [{ label: "正面", url, spec: "原图" }],
        status: "ready", jobId: null, hue: 26, updated: "刚刚", usageCount: 0,
      };
      mockProducts.unshift(p);
      return mock(p);
    }
    const fd = new FormData();
    fd.append("file", file);
    Object.entries(meta).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, String(v)); });
    return apiUpload(`/assets/products/upload`, fd);
  },
  patchProduct: (id: string, body: Record<string, unknown>): Promise<Mock.ProductAsset> => {
    if (USE_MOCK) {
      const p = mockProducts.find((x) => x.id === id);
      if (p) Object.assign(p, body, { updated: "刚刚" });
      return mock(p || ({ id } as any));
    }
    return apiFetch(`/assets/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  removeProduct: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockProducts.findIndex((x) => x.id === id);
      if (i >= 0) mockProducts.splice(i, 1);
      return mock({ deleted: true });
    }
    return apiFetch(`/assets/products/${id}`, { method: "DELETE" });
  },
  /** 补充角度（按张扣费）→ { job }。 */
  productAngles: (id: string, labels?: string[]): Promise<any> => {
    if (USE_MOCK) {
      const p = mockProducts.find((x) => x.id === id);
      const picks = labels && labels.length ? labels : ["45°", "背面", "细节"];
      const job = mockAssetJob("产品补充角度", id, p?.name || id, () => {
        if (!p) return;
        picks.forEach((label) => {
          const at = p.angles.findIndex((a) => a.label === label);
          const item = { label, url: p.imageUrl || "", spec: "1024 × 1024 · PNG" };
          if (at >= 0) p.angles[at] = item; else p.angles.push(item);
        });
        p.updated = "刚刚";
      });
      return mock({ job: { ...job } });
    }
    return apiFetch(`/assets/products/${id}/angles`, { method: "POST", body: JSON.stringify({ labels: labels || [] }) });
  },

  // ── 风格模板 ──────────────────────────────────────────────
  styles: (): Promise<Mock.StyleAsset[]> => {
    if (USE_MOCK) return mock(mockStyles.slice());
    return apiFetch(`/assets/styles`);
  },
  style: (id: string): Promise<Mock.StyleAsset> => {
    if (USE_MOCK) return mock(mockStyles.find((s) => s.id === id) || mockStyles[0]);
    return apiFetch(`/assets/styles/${id}`);
  },
  createStyle: (body: { name: string; summary?: string; promptEn?: string; tags?: string[]; source?: string }): Promise<Mock.StyleAsset> => {
    if (USE_MOCK) {
      const s: Mock.StyleAsset = {
        id: `ST-${mockSeq++}`, name: body.name, summary: body.summary || null,
        promptEn: body.promptEn || null, tags: body.tags || [], source: body.source || "manual",
        coverUrl: null, hue: 210, useCount: 0, updated: "刚刚",
      };
      mockStyles.unshift(s);
      return mock(s);
    }
    return apiFetch(`/assets/styles`, { method: "POST", body: JSON.stringify(body) });
  },
  patchStyle: (id: string, body: Record<string, unknown>): Promise<Mock.StyleAsset> => {
    if (USE_MOCK) {
      const s = mockStyles.find((x) => x.id === id);
      if (s) Object.assign(s, body, { updated: "刚刚" });
      return mock(s || ({ id } as any));
    }
    return apiFetch(`/assets/styles/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  removeStyle: (id: string): Promise<any> => {
    if (USE_MOCK) {
      const i = mockStyles.findIndex((x) => x.id === id);
      if (i >= 0) mockStyles.splice(i, 1);
      return mock({ deleted: true });
    }
    return apiFetch(`/assets/styles/${id}`, { method: "DELETE" });
  },

  // ── 引用台账（APPLIED TO · 已用于）─────────────────────────
  usages: (assetType: string, assetId: string): Promise<Mock.AssetUsage[]> => {
    if (USE_MOCK) return mock((mockUsages[`${assetType}:${assetId}`] || []).slice());
    return apiFetch(`/assets/usages?assetType=${encodeURIComponent(assetType)}&assetId=${encodeURIComponent(assetId)}`);
  },
};

/** mock：按 ipId 归属实时统计 IP 成员数（列表与详情共用同一口径）。 */
function mockIpMembers(ipId: string): Mock.IpMembers {
  const characters = mockChars.filter((c: any) => c.ipId === ipId);
  return {
    characters: characters.length,
    scenes: mockScenes.filter((s) => s.ipId === ipId).length,
    products: mockProducts.filter((p) => p.ipId === ipId).length,
    voices: Mock.VOICES.filter((v) => characters.some((c: any) => c.id === v.char)).length,
  };
}

/** mock：拼一个 IP 详情（容器视图），成员来自各 mock 库的 ipId 归属。 */
function buildMockIpDetail(id: string): Mock.IpDetail {
  const ip = mockIps.find((x) => x.id === id) || mockIps[0];
  const characters = mockChars.filter((c: any) => c.ipId === ip.id);
  const scenes = mockScenes.filter((s) => s.ipId === ip.id);
  const products = mockProducts.filter((p) => p.ipId === ip.id);
  const compositions = mockCompositions.filter((c) => c.ipId === ip.id);
  const voices = Mock.VOICES.filter((v) => characters.some((c: any) => c.id === v.char));
  // 计数严格等于真实成员数 —— 统计条与下面的成员网格必须一致，不能出现「说 3 个却只列出 0 个」
  const members = mockIpMembers(ip.id);
  const license = ip.licenseId
    ? {
        id: ip.licenseId, subject: ip.name, char: null, ipId: ip.id, scope: "品牌商用 / 全平台",
        period: "2026-01 ~ 2028-01", platforms: ["全平台"], status: ip.licenseStatus || "active",
        signed: "2026-01-08", photos: 0, expiresOn: "2028-01",
      }
    : null;
  return { ip: { ...ip, members }, characters, scenes, products, voices, compositions, license } as any;
}

/** URLSearchParams 前剔除空值，避免 `?q=undefined` 这类脏查询串。 */
function cleanParams(p: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  });
  return out;
}

// ── 跨资产合成（/api/v1/compositions/**）──────────────────────

export const ComposeApi = {
  /** 出片设置选项与单价（画幅 / 出图数量区间 / 单价 / 可用风格模板）。 */
  options: (): Promise<Mock.ComposeOptions> => {
    if (USE_MOCK) {
      return mock({
        costPerImage: MOCK_COST_PER_IMAGE, minCount: 1, maxCount: 8, defaultCount: 4,
        ratios: ["9:16", "1:1", "16:9"], styles: mockStyles.slice(),
      });
    }
    return apiFetch(`/compositions/options`);
  },
  list: (ipId?: string): Promise<Mock.Composition[]> => {
    if (USE_MOCK) return mock(ipId ? mockCompositions.filter((c) => c.ipId === ipId) : mockCompositions.slice());
    return apiFetch(`/compositions${ipId ? `?ipId=${encodeURIComponent(ipId)}` : ""}`);
  },
  get: (id: string): Promise<Mock.Composition> => {
    if (USE_MOCK) return mock(mockCompositions.find((c) => c.id === id) || mockCompositions[0]);
    return apiFetch(`/compositions/${id}`);
  },
  /** 提交合成（授权核对 → 建单 → 异步出片）→ { composition, job }。 */
  create: (body: { avatarId: string; sceneId: string; productId?: string | null; styleId?: string | null; ratio?: string; count?: number; extraPrompt?: string }): Promise<any> => {
    if (USE_MOCK) {
      const avatar: any = mockChars.find((c: any) => c.id === body.avatarId) || mockChars[0];
      // 与 server 一致：真人复刻缺生效肖像授权 → 直接拒绝，不建单不扣费
      if (avatar.path === "real" && !avatar.license) {
        return Promise.reject(new ApiError(
          "该真人形象还没有完成肖像授权，无法出片", "DAP_LICENSE_REQUIRED", 403, { avatarId: avatar.id },
        ));
      }
      const scene = mockScenes.find((s) => s.id === body.sceneId) || mockScenes[0];
      const product = body.productId ? mockProducts.find((p) => p.id === body.productId) : null;
      const style = body.styleId ? mockStyles.find((s) => s.id === body.styleId) : null;
      const count = body.count || 4;
      const ratio = body.ratio || "9:16";
      const parts: string[] = [];
      parts.push(avatar.path === "real"
        ? `人物 ${avatar.license || "LIC-未登记"} 有效`
        : "人物为 AI 原创，无需肖像授权");
      parts.push(scene.source === "shot" ? "场景为自有实拍" : "场景为 AI 生成");
      if (product) {
        parts.push(product.brandAuthorized
          ? `产品已获品牌方授权${product.brandLicenseUntil ? `（至 ${product.brandLicenseUntil}）` : ""}`
          : "产品未登记品牌方授权，请确认商用范围");
      }
      const comp: Mock.Composition = {
        id: `CP-${mockSeq++}`, avatarId: avatar.id, sceneId: scene.id,
        productId: product?.id || null, styleId: style?.id || null,
        ipId: avatar.ipId || product?.ipId || scene.ipId || null,
        ratio, count, status: "running", jobId: null,
        licenseNote: `已核对授权：${parts.join("，")}，可商用。`,
        cost: MOCK_COST_PER_IMAGE * count, created: "刚刚", outputs: [], sources: [],
      };
      mockCompositions.unshift(comp);
      const pool = [avatar.imageUrl || "/plaza/PA-07-1.jpg", scene.imageUrl || "", "/plaza/PA-07-2.jpg", "/plaza/PA-06-1.jpg"];
      const job = mockAssetJob("跨资产合成", comp.id, `${avatar.name} × ${scene.name}`, () => {
        comp.status = "done";
        comp.outputs = Array.from({ length: count }).map((_, i) => ({
          id: `CO-${mockSeq++}`, idx: i, no: String(i + 1).padStart(2, "0"),
          url: pool[i % pool.length], spec: "768 × 1365 · PNG",
        }));
        comp.sources = [
          { kind: "character", id: `${avatar.id} · v${avatar.versions || 1}`, name: avatar.name, thumbUrl: avatar.imageUrl || "/plaza/PA-07-1.jpg" },
          { kind: "scene", id: scene.id, name: scene.name, thumbUrl: scene.imageUrl || null },
          ...(product ? [{ kind: "product", id: product.id, name: product.name, thumbUrl: product.imageUrl || null }] : []),
          ...(style ? [{ kind: "style", id: style.id, name: style.name, thumbUrl: style.coverUrl || null }] : []),
        ];
        const usage: Mock.AssetUsage = {
          usedByType: "composition", usedById: comp.id,
          title: `${avatar.name} × ${scene.name}${product ? ` × ${product.name}` : ""}`,
          meta: `合成工作台 · ${new Date().toISOString().slice(0, 10)} 出片`,
          thumbUrl: comp.outputs[0]?.url || null, times: 1,
        };
        mockRecordUsage("character", avatar.id, usage);
        mockRecordUsage("scene", scene.id, usage);
        if (product) { mockRecordUsage("product", product.id, usage); product.usageCount += 1; }
        if (style) { mockRecordUsage("style", style.id, usage); style.useCount += 1; }
        if (comp.ipId) mockRecordUsage("ip", comp.ipId, usage);
        scene.usageCount += 1;
      });
      comp.jobId = job.id;
      return mock({ composition: comp, job: { ...job } });
    }
    return apiFetch(`/compositions`, { method: "POST", body: JSON.stringify(body) });
  },
};
