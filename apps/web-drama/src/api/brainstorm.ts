// ─────────────────────────────────────────────────────────────────────────────
// api/brainstorm.ts — 首页「跟 AI 聊出故事」脑暴草稿（v0.87）。
// 设计稿首页核心链路：随口说一个念头 → 左侧与 AI 脑暴 → 右侧生成可编辑的「故事大纲」→「去制作」。
// 脑暴是「立项之前」的可恢复草稿（草稿不丢、可回溯）；点「去制作」才按形态 promote 成
// 一部 DramaProject（剧集）或一条 DramaShort（单片）。
// 后端：/api/me/drama/brainstorms/**（DramaBrainstormController），按 ownerUserId 隔离。
// 本文件 TS 接口即前后端契约真源（字段名 1:1 对齐 DramaBrainstormService 的 payloadJson）。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError, apiFetch, USE_MOCK, mockDelay } from "./_client";
import { createProject, saveProject } from "./projects";
import type { CharacterDef, SceneAsset } from "@/mocks/drama-workshop";
import { createDraft } from "./shorts";

export type BrainstormStatus = "draft" | "promoted";
export type BrainstormForm = "series" | "single";

/** 一条脑暴对话消息。quick = AI 给的可一键追问的后续建议（用户视角短句）。 */
export interface BrainstormMessage {
  role: "ai" | "user";
  text: string;
  quick?: string[];
}

/** 故事大纲里的核心人物。role 是「身份 · 戏份」，如「真千金 · 女主」。 */
export interface OutlineRole {
  name: string;
  role: string;
}

/** 由对话生成的「故事大纲」（右侧面板展示，全部可编辑）。 */
export interface OutlineDraft {
  title: string;
  type: string;
  tone: string;
  logline: string;
  mainline: string;
  /** 剧情脉络节点（4-6 个递进情绪节点）。 */
  beats: string[];
  roles: OutlineRole[];
  /** 取景参考（主要场景）。 */
  scenes: string[];
}

/** 制作设置：形态（剧集 / 单片）+ 屏幕尺寸。形态决定「去制作」落成项目还是短视频。 */
export interface BrainstormSettings {
  form: BrainstormForm;
  ratio: string; // "9:16" / "16:9" / "1:1"
  episodes?: number;
}

/** 整页脑暴态（= 后端 payloadJson；本接口即契约真源）。 */
export interface BrainstormData {
  seed?: string | null;
  direction?: string | null;
  messages: BrainstormMessage[];
  outline: OutlineDraft | null;
  settings: BrainstormSettings;
}

/** 「继续上次脑暴」列表卡片（与后端 DramaBrainstormService.toSummary 对齐）。 */
export interface BrainstormSummary {
  id: string;
  title: string;
  status: BrainstormStatus;
  promotedKind?: "project" | "short" | null;
  promotedId?: string | null;
  messageCount: number;
  hasOutline: boolean;
  form: BrainstormForm;
  updated: string;
  updatedAt: string | null;
}

export interface BrainstormDetail {
  meta: BrainstormSummary;
  data: BrainstormData;
}

export interface ChatResult {
  message: BrainstormMessage;
}

export interface OutlineResult {
  outline: OutlineDraft;
}

export type PromoteResult =
  | { kind: "project"; projectId: string }
  | { kind: "short"; shortId: string };

// ── mock：进程内存表（USE_MOCK=1 时本地回放，演示 + dev 联调；整页刷新会清空）──────────

const mockStore = new Map<string, BrainstormDetail>();
let mockSeq = 0;

const GREETING = "来，把你脑子里的画面或者一句话丢给我，哪怕只是一个模糊的念头。";

/**
 * 开场白里「去模板广场」那个快捷回复。服务端 DramaBrainstormService.seedData 写的是旧叫法
 * 「套爆款模板」，改名后新叫法也要认：点它是跳模板广场，不是发给 AI 的一句话。
 * 只认快捷按钮，用户自己打字不跳转。
 */
export const QUICK_GO_TEMPLATES = new Set(["套爆款模板", "去模板广场看看", "逛模板广场", "看看模板"]);

function mockSummary(detail: BrainstormDetail["data"], id: string, status: BrainstormStatus): BrainstormSummary {
  const title = detail.outline?.title || detail.messages.find((m) => m.role === "user")?.text || "新的对话";
  return {
    id,
    title: title.length > 40 ? title.slice(0, 40) : title,
    status,
    promotedKind: null,
    promotedId: null,
    messageCount: detail.messages.length,
    hasOutline: !!detail.outline,
    form: detail.settings.form,
    updated: "刚刚",
    updatedAt: new Date().toISOString(),
  };
}

/** 照服务端 requireOwned：找不到这段对话 → 404 DRAMA_BRAINSTORM_NOT_FOUND（此前 mock 保存时会凭空建一条）。 */
function mockRequire(id: string): BrainstormDetail {
  const d = mockStore.get(id);
  if (!d) throw new ApiError({ code: "DRAMA_BRAINSTORM_NOT_FOUND", message: "这段对话找不到了" }, 404);
  return d;
}

/** 照服务端 isPromoted：去制作过（status=promoted 且有去向）就只读。 */
function mockIsPromoted(d: BrainstormDetail): boolean {
  return d.meta.status === "promoted" && !!d.meta.promotedId;
}

/** 已经去制作过的对话再保存：错误码、状态码、文案与服务端 saveBrainstorm 一致。 */
export const BRAINSTORM_ALREADY_PROMOTED = "DRAMA_BRAINSTORM_ALREADY_PROMOTED";
function mockAlreadyPromoted(): ApiError {
  return new ApiError({ code: BRAINSTORM_ALREADY_PROMOTED, message: "这段对话已经拿去制作了，这里的改动不会再保存。" }, 409);
}

/** mock 脑暴回复（仿设计稿 _aiReplies，按轮次轮换 + 给后续追问 chips）。 */
function mockReply(turn: number): BrainstormMessage {
  const replies: BrainstormMessage[] = [
    {
      role: "ai",
      text: "听起来有戏 👀 我顺着你这个点子捋了一版：\n· 主角：被低估的真千金，手握隐藏身份\n· 爽点：每集一次精准打脸\n· 钩子：婚礼当天身份反转\n想看完整的故事大纲，点「生成故事大纲」。",
      quick: ["换个更甜的方向", "走双重身份悬疑", "主角再惨一点"],
    },
    {
      role: "ai",
      text: "这个完全能做成竖屏短剧。给你三个切入口，挑一个基调我就照它生成大纲：",
      quick: ["走复仇逆袭", "走先婚后爱", "走双重身份"],
    },
    {
      role: "ai",
      text: "方向我记下了。点「生成故事大纲」，我把人物、剧情走向和主要场景都整理出来；想再调就接着聊。",
      quick: ["再给两个备选的一句话剧情"],
    },
  ];
  return replies[turn % replies.length];
}

/** mock 故事大纲（仿设计稿 _outlineFor，按方向给不同大纲）。 */
function mockOutline(direction?: string | null): OutlineDraft {
  const base: OutlineDraft = {
    title: "替嫁千金她A爆全场",
    type: "都市逆袭",
    tone: "强爽 · 快节奏",
    logline: "豪门替嫁的真千金，手握集团继承权，步步翻盘打脸所有看轻她的人。",
    mainline: "屈辱替嫁 → 身世反转 → 商战夺权 → 真情相护 → 全面逆袭",
    beats: ["屈辱替嫁", "身世反转", "商战夺权", "真情相护", "全面逆袭"],
    roles: [
      { name: "林星遥", role: "真千金 · 女主" },
      { name: "顾沉舟", role: "清冷霸总 · 男主" },
      { name: "苏曼", role: "假千金 · 反派" },
    ],
    scenes: ["教堂婚礼现场", "董事会议室", "雨夜天台", "老宅院落"],
  };
  if (direction === "sweet") {
    return {
      ...base,
      title: "闪婚老公竟是隐形大佬",
      type: "甜宠虐恋",
      tone: "甜虐 · 高糖",
      logline: "一纸契约闪婚，低调老公竟是隐形大佬，错位心动后宠她入骨。",
      mainline: "契约闪婚 → 错位心动 → 身份揭晓 → 反复拉扯 → 破镜重圆",
      beats: ["契约闪婚", "错位心动", "身份揭晓", "反复拉扯", "破镜重圆"],
      roles: [
        { name: "苏晚晚", role: "落魄千金 · 女主" },
        { name: "陆沉", role: "隐形大佬 · 男主" },
        { name: "白薇", role: "心机白月光 · 反派" },
      ],
      scenes: ["民政局门口", "江景豪宅", "公司年会", "海边民宿"],
    };
  }
  return base;
}

function dirFromText(t: string): string | null {
  if (/先婚后爱|甜宠|宠|闪婚|高糖|甜/.test(t)) return "sweet";
  if (/双重身份|悬疑|反转|烧脑|身份/.test(t)) return "mystery";
  if (/复仇|逆袭|打脸|爽|碾压/.test(t)) return "revenge";
  return null;
}

export async function listBrainstorms(): Promise<BrainstormSummary[]> {
  if (USE_MOCK) {
    return mockDelay(
      Array.from(mockStore.values())
        .map((d) => d.meta)
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    );
  }
  return apiFetch<BrainstormSummary[]>("/me/drama/brainstorms");
}

export async function getBrainstorm(id: string): Promise<BrainstormDetail> {
  if (USE_MOCK) {
    return mockDelay(mockRequire(id));
  }
  return apiFetch<BrainstormDetail>(`/me/drama/brainstorms/${id}`);
}

export async function createBrainstorm(seed?: string): Promise<BrainstormDetail> {
  if (USE_MOCK) {
    const id = `brs_mock_${Date.now()}_${mockSeq++}`;
    const data: BrainstormData = {
      seed: seed ?? null,
      direction: null,
      messages: [{ role: "ai", text: GREETING, quick: ["我没想法，给点灵感", "去模板广场看看"] }],
      outline: null,
      settings: { form: "series", ratio: "9:16" },
    };
    const detail: BrainstormDetail = { meta: mockSummary(data, id, "draft"), data };
    mockStore.set(id, detail);
    return mockDelay(detail);
  }
  return apiFetch<BrainstormDetail>("/me/drama/brainstorms", {
    method: "POST",
    body: { seed: seed ?? null },
  });
}

export async function saveBrainstorm(id: string, data: BrainstormData): Promise<BrainstormDetail> {
  if (USE_MOCK) {
    // 与服务端 DramaBrainstormService#saveBrainstorm 同形：找不到 → 404；已经去制作过 → 409 只读。
    const prev = mockRequire(id);
    if (mockIsPromoted(prev)) throw mockAlreadyPromoted();
    const detail: BrainstormDetail = { meta: mockSummary(data, id, "draft"), data };
    mockStore.set(id, detail);
    return mockDelay(detail);
  }
  return apiFetch<BrainstormDetail>(`/me/drama/brainstorms/${id}`, { method: "PUT", body: { data } });
}

export async function deleteBrainstorm(id: string): Promise<void> {
  if (USE_MOCK) {
    mockStore.delete(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/brainstorms/${id}`, { method: "DELETE" });
}

export async function chat(
  id: string,
  text: string,
  messages?: BrainstormMessage[],
): Promise<ChatResult> {
  if (USE_MOCK) {
    const turn = (messages ?? []).filter((m) => m.role === "user").length;
    return mockDelay({ message: mockReply(turn) });
  }
  return apiFetch<ChatResult>(`/me/drama/brainstorms/${id}/chat`, {
    method: "POST",
    body: { text, messages },
  });
}

export async function generateOutline(
  id: string,
  messages?: BrainstormMessage[],
): Promise<OutlineResult> {
  if (USE_MOCK) {
    const joined = (messages ?? []).filter((m) => m.role === "user").map((m) => m.text).join(" ");
    return mockDelay({ outline: mockOutline(dirFromText(joined)) });
  }
  return apiFetch<OutlineResult>(`/me/drama/brainstorms/${id}/outline`, {
    method: "POST",
    body: { messages },
  });
}

/**
 * 「单条短视频」去制作要扣开拍费，所以这一步必须幂等（v0.197 评审 P0）。
 *
 * 键**按这段对话派生**，不是每次点击现生成：一段对话最多落成一条短视频，这正是要保证的事。
 * 这样三种重复都会撞到服务端 (owner, clientRequestId) 唯一键、只扣一笔：
 *   · 响应在网络上丢了，用户再点一次（同一个页面）；
 *   · 刷新页面后再点（页面里临时生成的键会丢，派生的不会）；
 *   · 两个标签页同时点（各自生成的键互不相同，唯一键就拦不住）。
 * 服务端 DramaShortService.createFromRecipe 命中同键直接回原草稿；并发同键时后到的那个
 * 撞唯一索引、释放冻结、回赢家的 id。长度远小于服务端上限 64。
 */
export function promoteRequestId(brainstormId: string): string {
  return `brs-${brainstormId}`.slice(0, 64);
}

export interface PromoteOptions {
  /** 幂等键：用 {@link promoteRequestId}；失败重试沿用同一个。 */
  clientRequestId?: string;
}

/** mock：同键的「单条短视频」去制作只建一次（进行中的也算，第二次拿到的是同一个结果）。 */
const mockPromoteByKey = new Map<string, Promise<PromoteResult>>();

export async function promote(
  id: string,
  form: BrainstormForm,
  data?: BrainstormData,
  opts?: PromoteOptions,
): Promise<PromoteResult> {
  const clientRequestId = opts?.clientRequestId?.trim() || undefined;
  if (USE_MOCK) {
    // 与服务端一致：只有单条短视频（扣开拍费的那条）按键去重；失败不占键，重试按新请求处理。
    if (form === "single" && clientRequestId) {
      const hit = mockPromoteByKey.get(clientRequestId);
      if (hit) return hit;
      const run = mockPromote(id, form, data, clientRequestId);
      mockPromoteByKey.set(clientRequestId, run);
      run.catch(() => mockPromoteByKey.delete(clientRequestId));
      return run;
    }
    return mockPromote(id, form, data, clientRequestId);
  }
  return apiFetch<PromoteResult>(`/me/drama/brainstorms/${id}/promote`, {
    method: "POST",
    body: { form, data, clientRequestId },
  });
}

async function mockPromote(
  id: string,
  form: BrainstormForm,
  data: BrainstormData | undefined,
  clientRequestId: string | undefined,
): Promise<PromoteResult> {
  // 照服务端 DramaBrainstormService#promote 的顺序写（§8.0.1 ⑦ mock 与服务端同形）：
  // 1. 已经做过一次 → 原样返回去向，不重复建、不重复扣费，也不拿这次带来的 data 覆盖已封存的对话；
  // 2. 带了 data 才落库，没带就用已存的那份（服务端 readPayload）；
  // 3. 没有大纲 → 400，不建空壳。
  const prev = mockRequire(id);
  if (mockIsPromoted(prev)) {
    return prev.meta.promotedKind === "short"
      ? { kind: "short", shortId: prev.meta.promotedId! }
      : { kind: "project", projectId: prev.meta.promotedId! };
  }
  if (data) mockStore.set(id, { meta: mockSummary(data, id, "draft"), data });
  const src = mockStore.get(id)!;
  const outline = src.data.outline;
  if (!outline || typeof outline !== "object") {
    throw new ApiError({ code: "DRAMA_BRAINSTORM_NO_OUTLINE", message: "请先生成故事大纲，再去制作。" }, 400);
  }
  const title = nonBlank(outline.title) ? outline.title : nonBlank(src.meta.title) ? src.meta.title : "未命名短剧";
  const type = nonBlank(outline.type) ? outline.type : "通用短剧";
  const logline = nonBlank(outline.logline) ? outline.logline : "";
  const mainline = nonBlank(outline.mainline) ? outline.mainline : joinBeats(outline.beats);

  // 复用项目 / 短视频 mock 建实体，拿到可导航 id（演示链路完整）。
  if (form === "single") {
    // 与服务端同形：一句话剧情 + 主线落成草稿的 idea，制作页见到 idea 就直接写口播脚本；
    // 不写 styleName / styleRef —— 写了，制作页会把故事名当成「风格」喂给写脚本和出图的模型。
    const detail = await createDraft({
      title,
      fmtName: type,
      idea: singleIdea(title, logline, mainline),
      clientRequestId,
    });
    mockMarkPromoted(id, "short", detail.meta.id);
    return { kind: "short", shortId: detail.meta.id };
  }
  const episodes = Number(src.data.settings?.episodes);
  const detail = await createProject({
    title,
    type,
    typeKey: "custom",
    mode: "guided",
    ratio: nonBlank(src.data.settings?.ratio) ? src.data.settings.ratio : "9:16",
    episodes: Number.isFinite(episodes) && episodes > 0 ? Math.trunc(episodes) : 12,
    logline,
    mainline,
  });
  // 与服务端 promote 同形：大纲里的人物 / 取景参考预填进「角色与场景」，短剧设定页一进来就有。
  const characters = charactersFromRoles(outline.roles);
  const scenes = scenesFromOutline(outline.scenes);
  if (characters.length > 0 || scenes.length > 0) {
    await saveProject(detail.meta.id, {
      ...detail.data,
      ...(characters.length > 0 ? { characters } : {}),
      ...(scenes.length > 0 ? { scenes } : {}),
    });
  }
  mockMarkPromoted(id, "project", detail.meta.id);
  return { kind: "project", projectId: detail.meta.id };
}

const nonBlank = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** 照服务端 DramaBrainstormService#joinBeats：主线没写时用剧情走向拼一条。 */
function joinBeats(beats: string[] | undefined | null): string {
  if (!Array.isArray(beats)) return "";
  return beats.filter(nonBlank).map((b) => b.trim()).join(" → ");
}

/**
 * 照服务端 DramaBrainstormService#singleIdea：单条短视频草稿的点子 = 一句话剧情 + 主线。
 * 两样都没有时退回故事名；一句话剧情没以句末标点收尾才补一个句号，再接「主线：」。
 */
export function singleIdea(title: string, logline: string, mainline: string): string {
  const l = (logline ?? "").trim();
  const m = (mainline ?? "").trim();
  if (!l && !m) return title;
  if (!m) return l;
  if (!l) return m;
  const closed = "。！？!?.…".includes(l.charAt(l.length - 1));
  return l + (closed ? "" : "。") + "主线：" + m;
}

/**
 * 大纲核心人物 → 项目角色（照服务端 DramaBrainstormService#charactersFromRoles）：
 * 前两个、或身份里带「主」的判为主要角色；id / 占位色按顺序编号。
 */
function charactersFromRoles(roles: OutlineRole[] | undefined | null): CharacterDef[] {
  const out: CharacterDef[] = [];
  if (!Array.isArray(roles)) return out;
  let i = 1;
  for (const r of roles) {
    if (!r || typeof r !== "object") continue;
    const name = r.name && r.name.trim() ? r.name : `角色 ${i}`;
    const roleDesc = r.role && r.role.trim() ? r.role : "";
    const key = i <= 2 || roleDesc.includes("主");
    out.push({
      id: `ch_${i}`,
      name,
      role: key ? "key" : "extra",
      cast: roleDesc,
      desc: "",
      avatar: `a${((i - 1) % 8) + 1}`,
      bound: false,
    });
    i++;
  }
  return out;
}

/** 大纲取景参考 → 项目场景（照服务端 DramaBrainstormService#scenesFromOutline：空的跳过，氛围留空）。 */
function scenesFromOutline(scenes: string[] | undefined | null): SceneAsset[] {
  const out: SceneAsset[] = [];
  if (!Array.isArray(scenes)) return out;
  let i = 1;
  for (const s of scenes) {
    const name = typeof s === "string" ? s : "";
    if (!name.trim()) continue;
    out.push({ id: `scn_${i}`, name: name.trim(), mood: "" });
    i++;
  }
  return out;
}

function mockMarkPromoted(id: string, kind: "project" | "short", promotedId: string) {
  const prev = mockStore.get(id);
  if (!prev) return;
  mockStore.set(id, {
    ...prev,
    meta: { ...prev.meta, status: "promoted", promotedKind: kind, promotedId },
  });
}
