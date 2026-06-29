// ─────────────────────────────────────────────────────────────────────────────
// api/brainstorm.ts — 首页「跟 AI 聊出故事」脑暴草稿（v0.87）。
// 设计稿首页核心链路：随口说一个念头 → 左侧与 AI 脑暴 → 右侧生成可编辑的「故事大纲」→「去制作」。
// 脑暴是「立项之前」的可恢复草稿（草稿不丢、可回溯）；点「去制作」才按形态 promote 成
// 一部 DramaProject（剧集）或一条 DramaShort（单片）。
// 后端：/api/me/drama/brainstorms/**（DramaBrainstormController），按 ownerUserId 隔离。
// 本文件 TS 接口即前后端契约真源（字段名 1:1 对齐 DramaBrainstormService 的 payloadJson）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { createProject } from "./projects";
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

const GREETING =
  "来，把你脑子里的画面或者一句话丢给我 —— 哪怕只是一个模糊的念头。\n比如「替嫁千金」「重生考研」「熬夜也能救的精华」… 我陪你聊成一部能拍的剧。";

function mockSummary(detail: BrainstormDetail["data"], id: string, status: BrainstormStatus): BrainstormSummary {
  const title = detail.outline?.title || detail.messages.find((m) => m.role === "user")?.text || "新的脑暴";
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

/** mock 脑暴回复（仿设计稿 _aiReplies，按轮次轮换 + 给后续追问 chips）。 */
function mockReply(turn: number): BrainstormMessage {
  const replies: BrainstormMessage[] = [
    {
      role: "ai",
      text: "听起来有戏 👀 我顺着你这个点子捋了一版：\n· 主角：被低估的真千金，手握隐藏身份\n· 爽点：每集一次精准打脸\n· 钩子：婚礼当天身份反转\n想看完整的故事大纲，点右侧「生成故事大纲」。",
      quick: ["换个更甜的方向", "走双重身份悬疑", "主角再惨一点"],
    },
    {
      role: "ai",
      text: "这个完全能做成竖屏短剧。给你三个切入口，挑一个基调我就照它生成大纲：",
      quick: ["走复仇逆袭", "走先婚后爱", "走双重身份"],
    },
    {
      role: "ai",
      text: "方向我记下了。右侧点「生成故事大纲」我就把人物、脉络和设定都整理出来；想再调就接着聊。",
      quick: ["再给两个备选 logline"],
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
    const d = mockStore.get(id);
    if (!d) throw new Error("脑暴草稿不存在");
    return mockDelay(d);
  }
  return apiFetch<BrainstormDetail>(`/me/drama/brainstorms/${id}`);
}

export async function createBrainstorm(seed?: string): Promise<BrainstormDetail> {
  if (USE_MOCK) {
    const id = `brs_mock_${Date.now()}_${mockSeq++}`;
    const data: BrainstormData = {
      seed: seed ?? null,
      direction: null,
      messages: [{ role: "ai", text: GREETING, quick: ["我没想法，给点灵感", "套爆款模板"] }],
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
    const prev = mockStore.get(id);
    const detail: BrainstormDetail = {
      meta: { ...mockSummary(data, id, prev?.meta.status ?? "draft"), promotedKind: prev?.meta.promotedKind ?? null, promotedId: prev?.meta.promotedId ?? null },
      data,
    };
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

export async function promote(
  id: string,
  form: BrainstormForm,
  data?: BrainstormData,
): Promise<PromoteResult> {
  if (USE_MOCK) {
    // 复用项目 / 短视频 mock 建实体，拿到可导航 id（演示链路完整）。
    const outline = data?.outline;
    if (form === "single") {
      const detail = await createDraft({
        title: outline?.title,
        fmtName: outline?.type ?? "短视频",
        idea: outline?.logline,
        styleName: outline?.title,
        styleRef: outline?.logline,
      });
      mockMarkPromoted(id, "short", detail.meta.id);
      return { kind: "short", shortId: detail.meta.id };
    }
    const detail = await createProject({
      title: outline?.title || "未命名短剧",
      type: outline?.type || "通用短剧",
      typeKey: "custom",
      mode: "guided",
      ratio: data?.settings.ratio || "9:16",
      episodes: data?.settings.episodes || 12,
      logline: outline?.logline,
      mainline: outline?.mainline,
    });
    mockMarkPromoted(id, "project", detail.meta.id);
    return { kind: "project", projectId: detail.meta.id };
  }
  return apiFetch<PromoteResult>(`/me/drama/brainstorms/${id}/promote`, {
    method: "POST",
    body: { form, data },
  });
}

function mockMarkPromoted(id: string, kind: "project" | "short", promotedId: string) {
  const prev = mockStore.get(id);
  if (!prev) return;
  mockStore.set(id, {
    ...prev,
    meta: { ...prev.meta, status: "promoted", promotedKind: kind, promotedId },
  });
}
