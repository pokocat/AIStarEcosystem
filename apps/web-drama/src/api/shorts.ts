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
  /**
   * v0.143 提示词直出：本镜画面中出现的角色名（对应 visualBible.characters[].name）。
   * 与短剧工作台 FormShot.cast（角色实体 id）区分开，这里是名字，故独立字段名。
   * 显式空数组 = 本镜确实没有人物（纯环境镜）；字段缺失 = 未标注，服务端按全员锚定。
   */
  castNames?: string[];
  /** v0.143：本镜所在场景名（对应 visualBible.scenes[].name），服务端据此挂场景锚点。 */
  sceneName?: string;
  /** v0.143：原提示词里的时间码（如 01:08-01:43），只做展示与溯源，不参与计算。 */
  timecode?: string;
  /** 本镜节拍语义标签（AI 对话线由脚本 AI 给；提示词直出线由拆解给）。 */
  beat?: string;
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
  /** v0.143 提示词直出：全片视觉设定（人物卡 / 场景 / 画面基调）。
   *  服务端保存 / 预检时据此派生一致性锚点，逐镜出图与出片的前缀因此带上用户原始设定。 */
  visualBible?: ShortVisualBible;
  /** v0.143：这条短视频的来源提示词（原文 + 拆解时间），供工作台展示与「按提示词重新拆解」。 */
  promptSource?: ShortPromptSource;
  /** v0.143：拆解过程中的处理说明（超长截断 / 超时长拆镜 / 超镜数未拆解…），如实展示给用户。 */
  promptNotes?: string[];
  /** v0.144：建这条草稿时用的幂等键（服务端写入，用于重试查重）。前端只读，不要改。 */
  clientRequestId?: string;
}

/** 提示词直出的全片视觉设定（人物卡只放视觉，表演另存，避免台词污染逐镜画面）。 */
export interface ShortVisualBible {
  /** 全片画面基调：环境 + 光影 + 质感 + 镜头语言（不含分镜动作与台词）。 */
  universal?: string;
  characters: Array<{ name: string; visual: string; performance?: string }>;
  scenes: Array<{ name: string; visual: string }>;
}

export interface ShortPromptSource {
  /** 用户粘贴的提示词原文。 */
  raw: string;
  /** 最近一次拆解时间（ISO）。 */
  parsedAt?: string;
}

/** 提示词拆解入参：prompt=原文；instruction=在原文基础上追加的调整要求（重新拆解用）。 */
export interface ParseShortPromptInput {
  prompt: string;
  instruction?: string;
}

/** 拆解出的单镜（与后端 DramaShortPromptService.normalize 对齐）。 */
export interface ParsedShortShot {
  no: number;
  timecode: string;
  durationSec: number;
  sceneName: string;
  /**
   * 本镜出场人物名（取自 characters[].name）。
   * 显式空数组 = 本镜确实没有人物（纯环境镜）；**字段缺失 = 未标注**，下游按全员锚定 ——
   * 两者行为不同，不要把缺失补成空数组。
   */
  castNames?: string[];
  beat: string;
  visual: string;
  size: string;
  move: string;
  voWho: string;
  voText: string;
  sfx: string;
  bgm: string;
  fx: string;
}

/** 拆解结果（不落库；前端预览 / 编辑后作为 createDraft 的 seed 提交）。 */
export interface ParsedShortPrompt {
  title: string;
  logline: string;
  style: string[];
  universalPrompt: string;
  characters: Array<{ name: string; visual: string; performance: string }>;
  scenes: Array<{ name: string; visual: string }>;
  shots: ParsedShortShot[];
  shotCount: number;
  totalDurationSec: number;
  /** 拆解过程中的处理说明（如「有镜头超 15s 已压到上限」「超 40 镜未拆解」）。 */
  notes: string[];
  /**
   * 命中 40 镜上限时，最后一镜在原提示词里的时间码 = 「拆到哪」的锚点。
   * 前端据此把剩余原文接着拆下一条；原文没写时间码时为空串（切不准就不给这个入口）。
   */
  truncatedAfterTimecode?: string;
  /**
   * true = 上限正好切在某个长段中间（该段被拆成多镜、共用同一时间码）。
   * 这时分卷必须把那一行整行留给下一条，否则会跳过该段没拆完的动作。
   */
  truncatedMidSegment?: boolean;
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
  /**
   * v0.143 提示词直出：拆解结果（可被用户在预览页改过）+ promptSource.raw 原文。
   * 带 seed 时服务端直接建成带人物卡 / 场景 / 逐镜分镜的草稿（分镜一律 draft 态），
   * 扣费仍是同一笔开拍费；title / fmtName / idea 由 seed 决定，无需另传。
   */
  seed?: ParsedShortPrompt & { promptSource?: ShortPromptSource };
  /**
   * 幂等键：同一次「开始制作」的重试要用同一个值。
   * 响应在网络层丢失后客户端会原样重试，没有它服务端会再建一条草稿、再扣一笔开拍费。
   * 服务端按 owner + key 在 2 小时窗口内查重，命中就回原草稿（不重复扣费）。
   */
  clientRequestId?: string;
}

/** 一次创建意图的幂等键（重试复用，成功后由调用方丢弃）。 */
export function newClientRequestId(): string {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `dvs-${Date.now().toString(36)}-${rand}`.slice(0, 64);
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

// ── 提示词直出（v0.143）────────────────────────────────────────────────────────

/** 时间码：00:03-00:19 / 1:08–1:43 / 01:08 - 01:43。 */
const MOCK_TIMECODE_RE = /(\d{1,3}:\d{2})\s*[-–—~至]\s*(\d{1,3}:\d{2})/;

function mockToSeconds(v: string): number {
  const [m, sec] = v.split(":");
  return Number(m) * 60 + Number(sec);
}

/** 从一行里切出 台词 / 音效 / BGM / 特效 段（同一行常写在画面后面）。 */
function mockPickSegment(line: string, labels: string[]): { hit: string; rest: string } {
  for (const label of labels) {
    const idx = line.indexOf(label);
    if (idx >= 0) {
      const after = line.slice(idx + label.length).replace(/^[:：]\s*/, "");
      const cut = after.search(/(台词|字幕|口播|旁白|音效|BGM|背景音乐|特效)[:：]/);
      return { hit: (cut >= 0 ? after.slice(0, cut) : after).trim(), rest: line.slice(0, idx).trim() };
    }
  }
  return { hit: "", rest: line };
}

const MOCK_SIZES = ["远景", "全景", "中近景", "中景", "近景", "特写", "双人中景"];
const MOCK_MOVES = ["推近", "拉远", "摇", "跟", "手持", "固定"];

/**
 * USE_MOCK=1 时的本地样例拆解 —— 只按 【角色】/【场景】/【全片基调】块 + 时间码行做朴素切分，
 * 结果里显式带一条说明，避免把本地样例误当成真实大模型拆解（AGENTS §8.0）。
 */
function mockParsePrompt(prompt: string): ParsedShortPrompt {
  const lines = prompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const characters: ParsedShortPrompt["characters"] = [];
  const scenes: ParsedShortPrompt["scenes"] = [];
  const shots: ParsedShortShot[] = [];
  let universal = "";
  let title = "";

  for (const line of lines) {
    const block = line.match(/^【(标题|角色|场景|全片基调|分镜)】\s*(.*)$/);
    if (block) {
      const [, kind, body] = block;
      if (kind === "标题") title = body.slice(0, 20);
      if (kind === "角色" && body) {
        const [name, ...restParts] = body.split(/[:：]/);
        const rest = restParts.join("：");
        const [visual, ...perf] = rest.split(/[;；]/);
        characters.push({
          name: name.trim().slice(0, 24),
          visual: (visual ?? "").trim(),
          performance: perf.join("；").trim(),
        });
      }
      if (kind === "场景" && body) {
        scenes.push({ name: body.split(/[，,]/)[0].slice(0, 24), visual: body.trim() });
      }
      if (kind === "全片基调") universal = body.trim();
      continue;
    }
    const tc = line.match(MOCK_TIMECODE_RE);
    const isShotLine = !!tc || shots.length > 0;
    if (!isShotLine) continue;
    if (tc) {
      let text = line.replace(MOCK_TIMECODE_RE, "").replace(/^[｜|·\-—\s]+/, "").trim();
      const vo = mockPickSegment(text, ["台词", "字幕", "口播"]);
      text = vo.rest;
      const sfx = mockPickSegment(text, ["音效"]);
      text = sfx.rest;
      const bgm = mockPickSegment(text, ["BGM", "背景音乐"]);
      text = bgm.rest;
      const fx = mockPickSegment(text, ["特效"]);
      text = fx.rest;
      const size = MOCK_SIZES.find((v) => text.includes(v)) ?? (shots.length === 0 ? "中近景" : "中景");
      const move = MOCK_MOVES.find((v) => text.includes(v)) ?? "固定";
      const visual = text.replace(/^[^:：]{0,12}[:：]\s*/, "").trim();
      const speaker = vo.hit.includes("：") ? vo.hit.split("：")[0].trim() : "";
      shots.push({
        no: shots.length + 1,
        timecode: `${tc[1]}-${tc[2]}`,
        durationSec: Math.max(2, Math.min(15, mockToSeconds(tc[2]) - mockToSeconds(tc[1]) || 4)),
        sceneName: scenes[0]?.name ?? "",
        // 与服务端同规则：推断不出出场人物就不落这个字段（缺失=未标注，不是「明确无人」）。
        castNames: (() => {
          const hit = characters.filter((c) => c.name && visual.includes(c.name)).map((c) => c.name);
          return hit.length ? hit : undefined;
        })(),
        beat: shots.length === 0 ? "开场" : "",
        visual,
        size,
        move,
        voWho: vo.hit ? speaker || "旁白" : "",
        voText: (speaker ? vo.hit.slice(speaker.length + 1) : vo.hit).trim(),
        sfx: sfx.hit,
        bgm: bgm.hit,
        fx: fx.hit,
      });
      continue;
    }
    // 时间码之后的续行：补进上一镜的画面。
    const cur = shots[shots.length - 1];
    if (cur && line.length > 4 && cur.visual.length < 120) {
      cur.visual = `${cur.visual}；${line.replace(/^[•·\-\s]+/, "")}`;
    }
  }

  if (!shots.length) {
    // 没有时间码：按句切成 3-6 镜，够看清「拆解 → 预览 → 制作」整条链路。
    const sentences = prompt.split(/[。！？\n]/).map((t) => t.trim()).filter((t) => t.length > 6).slice(0, 6);
    sentences.forEach((t, i) =>
      shots.push({
        no: i + 1, timecode: "", durationSec: 4, sceneName: scenes[0]?.name ?? "",
        beat: i === 0 ? "开场" : "", visual: t.slice(0, 120), size: i === 0 ? "中近景" : "中景",
        move: i === 0 ? "推近" : "固定", voWho: "", voText: "", sfx: "", bgm: "", fx: "",
      }),
    );
  }
  return {
    title: title || (shots[0]?.voText || shots[0]?.visual || "未命名短视频").slice(0, 12),
    logline: shots[0]?.voText ?? "",
    style: ["电影感", "竖屏短片"],
    universalPrompt: universal,
    characters,
    scenes,
    shots,
    shotCount: shots.length,
    totalDurationSec: shots.reduce((a, s) => a + s.durationSec, 0),
    notes: ["本地样例拆解（USE_MOCK=1）：真实拆解由大模型完成，接上后端后字段会更完整。"],
  };
}

/**
 * 拆解「我自己写好的提示词」→ 人物卡 / 场景 / 全片基调 / 逐镜分镜。
 * 免费、不落库：结果供预览与修改，确认后作为 createDraft 的 seed 提交（那一步才扣开拍费）。
 */
export async function parsePrompt(
  input: ParseShortPromptInput,
  signal?: AbortSignal,
): Promise<ParsedShortPrompt> {
  if (USE_MOCK) {
    // mock 也尊重取消：否则 dev 下「取消→重试」的竞态与生产不一致，问题只在生产暴露。
    return new Promise<ParsedShortPrompt>((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
      const timer = setTimeout(() => resolve(mockParsePrompt(input.prompt)), 900);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }
  return apiFetch<ParsedShortPrompt>("/me/drama/shorts/parse-prompt", {
    method: "POST",
    body: { prompt: input.prompt, instruction: input.instruction },
    // 大模型逐镜拆解实测 30-90 秒（长提示词更久），必须能取消，否则用户只能干等。
    signal,
  });
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

/** mock 侧的 seed → ShortDraftData（与后端 DramaShortPromptService.seedToDraftData 同规则的精简版）。 */
function mockSeedToData(seed: NonNullable<CreateShortInput["seed"]>, clientRequestId?: string): ShortDraftData {
  const title = seed.title || "未命名短视频";
  return {
    idea: null,
    reopen: null,
    fmtKey: null,
    fmtName: seed.style?.length ? seed.style.join(" · ").slice(0, 24) : "自定义短片",
    title,
    step: "script",
    meta: {
      title,
      style: seed.style ?? [],
      scene: seed.scenes?.[0]?.visual || seed.universalPrompt || "",
      character: {
        name: seed.characters?.[0]?.name ?? "",
        description: seed.characters?.[0]?.visual ?? "",
      },
    },
    logline: seed.logline ?? "",
    visualBible: {
      universal: seed.universalPrompt ?? "",
      characters: seed.characters ?? [],
      scenes: seed.scenes ?? [],
    },
    promptSource: { raw: seed.promptSource?.raw ?? "", parsedAt: new Date().toISOString() },
    promptNotes: seed.notes ?? [],
    clientRequestId,
    shots: (seed.shots ?? []).map((s, i) => ({
      id: `sh_p${i + 1}_mock`,
      no: i + 1,
      dur: s.durationSec || 4,
      visual: s.visual,
      size: s.size || "中景",
      move: s.move || "固定",
      voWho: s.voWho || (s.voText ? "旁白" : ""),
      voText: s.voText,
      sfx: s.sfx,
      bgm: s.bgm,
      fx: s.fx,
      beat: s.beat,
      timecode: s.timecode,
      sceneName: s.sceneName || undefined,
      castNames: s.castNames,
      refs: [],
      sub: true,
      flow: "draft" as const,
      engine: "avatar",
      frameIdx: 0,
    })),
    chat: [
      {
        who: "ai",
        text:
          `已按你的提示词拆成 ${seed.shots?.length ?? 0} 镜，人物和画面设定都在右侧「提示词设定」里。` +
          "分镜表里的字段都能直接改；想整张表重来，点分镜表右上的「按提示词重拆」。",
      },
    ],
    refs: [],
  };
}

export async function createDraft(input: CreateShortInput): Promise<ShortDraftDetail> {
  if (USE_MOCK) {
    if (input.clientRequestId) {
      const hit = Array.from(mockStore.values()).find((d) => d.data.clientRequestId === input.clientRequestId);
      if (hit) return mockDelay(hit);
    }
    const id = `dvs_mock_${Date.now()}_${mockSeq++}`;
    // 提示词直出：seed 即整份草稿内容（分镜一律 draft 态，与后端同规则）。
    if (input.seed) {
      const seeded = mockSeedToData(input.seed, input.clientRequestId);
      const detail: ShortDraftDetail = {
        meta: {
          ...mockSummary(id, { ...input, title: seeded.title, fmtName: seeded.fmtName }),
          durationSec: seeded.shots.reduce((a, s) => a + (s.dur || 0), 0),
          shotCount: seeded.shots.length,
        },
        data: seeded,
      };
      mockStore.set(id, detail);
      return mockDelay(detail);
    }
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
