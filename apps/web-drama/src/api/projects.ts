// ─────────────────────────────────────────────────────────────────────────────
// api/projects.ts — 短剧项目工作台（v0.64+）。
// 六阶段工作台 ProjectData 文档的 CRUD + 大纲 AI 起草。
// 后端：/api/me/drama/projects/**（DramaProjectController），按 ownerUserId 隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError, apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  PROJECTS,
  deleteProjectData,
  getProjectData,
  setProjectData,
  type AssembledEpisode,
  type BoardScene,
  type BoardShot,
  type CharacterDef,
  type DramaRefImage,
  type DramaProjectSummary,
  type EpisodeOutline,
  type ProjectData,
  type ScriptLine,
  type ScriptScene,
} from "@/mocks/drama-workshop";
import type { InteractiveOverlay } from "@/lib/interactive-types";

/** 详情壳：列表卡片字段 + 整套工作台文档。 */
export interface ProjectDetail {
  meta: DramaProjectSummary;
  data: ProjectData;
}

export interface CreateProjectInput {
  title?: string;
  type: string;
  typeKey: string;
  /** v0.79：interactive = 互动剧形态（剧集分支图 + 互动点，叠加在项目上）。 */
  mode: "guided" | "template" | "interactive";
  ratio?: string;
  episodes?: number;
  logline?: string;
  mainline?: string;
  coverFrom?: string;
  coverTo?: string;
}

export interface SaveProjectOptions {
  stage?: number;
  progress?: number;
}

/**
 * 用户全部短剧项目（多集短剧 + 单集作品/宣传片）。后端按 updatedAt 倒序返回全集；
 * 由各页按集数分流：短剧工坊只收多集（episodes > 1），短视频工坊只收单集（episodes === 1）。
 * （mock 同样返回全集，保持与真后端一致。）
 */
export async function listProjects(): Promise<DramaProjectSummary[]> {
  if (USE_MOCK) return mockDelay([...PROJECTS]);
  return apiFetch<DramaProjectSummary[]>("/me/drama/projects");
}

export async function getProject(id: string): Promise<ProjectDetail> {
  if (USE_MOCK) {
    const data = getProjectData(id);
    const meta = PROJECTS.find((p) => p.id === id);
    if (!data || !meta) throw mockProjectNotFound();
    return mockDelay({ meta, data });
  }
  return apiFetch<ProjectDetail>(`/me/drama/projects/${id}`);
}

/**
 * 照服务端 DramaProjectService#requireOwned：不在列表里（没建过，或者已经移进回收站）→ 404。
 * 读、存、合成都走这一处，mock 与服务端同一个错误码、同一个状态码。
 */
function mockProjectNotFound(): ApiError {
  return new ApiError({ code: "DRAMA_PROJECT_NOT_FOUND", message: "找不到这部短剧" }, 404);
}

// ── mock 回收站（进程内存；整页刷新清空，与 brainstorm / shorts 的 mock 一致）──────────
const MOCK_TRASH: DramaProjectTrashItem[] = [];
let mockSeq = 0;
const TRASH_DAYS = 30;

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  if (USE_MOCK) {
    // 与服务端一致：新建完就能在列表里看到、在工作台里打开（§8.0.1 ⑦）。
    // 脑暴「去制作」、多集模板「做同款」、「照这部新建一部」都走这里。
    const id = `dp_mock_${Date.now().toString(36)}_${mockSeq++}`;
    const meta: DramaProjectSummary = {
      id,
      title: input.title || "未命名短剧",
      type: input.type,
      typeKey: input.typeKey,
      ratio: input.ratio || "9:16",
      episodes: input.episodes ?? 1,
      progress: 0,
      stage: 1,
      cover: { from: input.coverFrom || "#f97316", to: input.coverTo || "#e11d48" },
      mode: input.mode,
      updated: "今天",
      updatedAt: new Date().toISOString(),
    };
    // 形状照服务端 DramaProjectService#seedProjectData 写：横屏「每集 60 秒」、其余「每集 75 秒」，
    // 大纲参数、场景设定、按集存档、互动剧叠加层也一并给上（字段缺了，演示模式和线上长得不一样）。
    const landscape = meta.ratio.startsWith("16");
    const data: ProjectData = {
      projectInfo: {
        title: meta.title,
        type: input.type,
        episodes: Math.max(1, meta.episodes),
        duration: landscape ? "每集 60 秒" : "每集 75 秒",
        ratio: meta.ratio,
        logline: input.logline || "",
        mainline: input.mainline || "",
      },
      topicCards: [],
      episodes: [],
      characters: [],
      scenes: [],
      outlinePrefs: { scope: "trial", dur: landscape ? "60 秒/集" : "75 秒/集" },
      script: { ep: 1, scenes: [] },
      storyboard: { ep: 1, scenes: [] },
      promptPack: { ep: 1, scene: "", shots: [] },
      episodeDocs: {},
      ...(input.mode === "interactive"
        ? { interactive: { enabled: true, startEpisodeId: "ep1", globalFlags: {}, nodes: {} } }
        : {}),
    };
    PROJECTS.unshift(meta);
    setProjectData(id, data);
    return mockDelay({ meta, data });
  }
  return apiFetch<ProjectDetail>("/me/drama/projects", { method: "POST", body: input });
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
const nonBlank = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";

/**
 * mock 保存时回算列表卡片字段，照服务端 DramaProjectService#saveProject + toSummary 写（§8.0.1 ⑦）：
 * - 标题 / 类型 / 画幅以 projectInfo 为准回写（空值不覆盖）；集数 > 0 才回写；
 * - stage 夹到 1..6、progress 夹到 0..100（只在调用方带了才改）；
 * - 文档里 interactive.enabled 为真 → mode 同步成 interactive（不会反向改回去）；
 * - done 由 progress 推出：≥ 100 才有 done=true，否则不带这个字段。
 * 此前有旧记录时直接展开旧卡片，这些都没同步 —— 新做完的 mock 短剧在列表里点开还是进工作台，
 * 而不是成片预览（列表按 p.done 分流）。
 */
function mockSyncSummary(
  base: DramaProjectSummary,
  data: ProjectData,
  opts?: SaveProjectOptions,
): DramaProjectSummary {
  const info = data.projectInfo;
  const eps = Number(info?.episodes);
  const progress = opts?.progress != null ? clampInt(opts.progress, 0, 100) : base.progress;
  const { done: _done, ...rest } = base;
  void _done;
  return {
    ...rest,
    title: nonBlank(info?.title) ? info.title : base.title,
    type: nonBlank(info?.type) ? info.type : base.type,
    ratio: nonBlank(info?.ratio) ? info.ratio : base.ratio,
    episodes: Number.isFinite(eps) && eps > 0 ? Math.trunc(eps) : base.episodes,
    stage: opts?.stage != null ? clampInt(opts.stage, 1, 6) : base.stage > 0 ? base.stage : 1,
    progress,
    mode: data.interactive?.enabled ? "interactive" : base.mode,
    updated: "今天",
    updatedAt: new Date().toISOString(),
    ...(progress >= 100 ? { done: true } : {}),
  };
}

/** 保存整套工作台文档（可选携带 stage / progress）。 */
export async function saveProject(
  id: string,
  data: ProjectData,
  opts?: SaveProjectOptions,
): Promise<ProjectDetail> {
  if (USE_MOCK) {
    // 与服务端 requireOwned 一致：已经移进回收站（或根本没有）的短剧不能再存 → 404。
    // 此前这里会凭空补一张卡片，删除之后才落地的自动保存让同一部短剧同时出现在列表和回收站里。
    const idx = PROJECTS.findIndex((p) => p.id === id);
    if (idx < 0) throw mockProjectNotFound();
    const meta = mockSyncSummary(PROJECTS[idx], data, opts);
    // 服务端按 updatedAt 倒序返回列表：刚保存的排到最前。
    PROJECTS.splice(idx, 1);
    PROJECTS.unshift(meta);
    setProjectData(id, data);
    return mockDelay({ meta, data });
  }
  return apiFetch<ProjectDetail>(`/me/drama/projects/${id}`, {
    method: "PUT",
    body: { data, stage: opts?.stage, progress: opts?.progress },
  });
}

/** 软删（移入回收站，保留 30 天后由后端定时物理删除，期间可恢复）。 */
export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = PROJECTS.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const [meta] = PROJECTS.splice(idx, 1);
      const now = new Date();
      const purge = new Date(now.getTime() + TRASH_DAYS * 86_400_000);
      MOCK_TRASH.unshift({ ...meta, deletedAt: now.toISOString(), purgeAt: purge.toISOString(), daysLeft: TRASH_DAYS });
    }
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/projects/${id}`, { method: "DELETE" });
}

/** 回收站条目：列表卡片字段 + 删除 / 到期信息。 */
export interface DramaProjectTrashItem extends DramaProjectSummary {
  deletedAt: string;
  purgeAt: string;
  /** 距彻底删除的剩余天数（向上取整）。 */
  daysLeft: number;
}

/** 回收站列表（当前用户已软删的短剧）。 */
export async function listTrashProjects(): Promise<DramaProjectTrashItem[]> {
  if (USE_MOCK) return mockDelay([...MOCK_TRASH]);
  return apiFetch<DramaProjectTrashItem[]>("/me/drama/projects/trash");
}

/** 从回收站恢复到工坊列表。 */
export async function restoreProject(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = MOCK_TRASH.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const [item] = MOCK_TRASH.splice(idx, 1);
      const { deletedAt: _d, purgeAt: _p, daysLeft: _l, ...meta } = item;
      void _d; void _p; void _l;
      PROJECTS.unshift(meta);
    }
    return mockDelay(undefined);
  }
  await apiFetch<ProjectDetail>(`/me/drama/projects/${id}/restore`, { method: "POST" });
}

/** 彻底删除（物理，需已在回收站）。 */
export async function purgeProject(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = MOCK_TRASH.findIndex((p) => p.id === id);
    if (idx >= 0) MOCK_TRASH.splice(idx, 1);
    deleteProjectData(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/projects/${id}/purge`, { method: "DELETE" });
}

// ── 剧集脚本 / 角色 AI ─────────────────────────────────────────────────────────

export interface EpscriptDraftResult {
  scenes: ScriptScene[];
  boardScenes: BoardScene[];
}

/** 按本集剧情把整集重写为分场 + 分镜（未落库，前端合并后 saveProject）。 */
export async function epscriptAiDraft(
  id: string,
  input: { ep: number; plot: string; style?: string; cast?: string[] },
): Promise<EpscriptDraftResult> {
  if (USE_MOCK) {
    const sceneId = `sc_${input.ep}_1`;
    const scenes: ScriptScene[] = [
      {
        id: sceneId,
        place: "内景 · 公寓客厅 · 深夜",
        mood: "压抑悬疑",
        action: input.plot.slice(0, 40) || "主角发现对楼窗口的异样灯光。",
        lines: [{ who: "旁白", text: "搬进来的第一晚，她就觉得哪里不对。" }],
      },
    ];
    const boardScenes: BoardScene[] = [
      {
        id: sceneId,
        shots: [
          { id: `${sceneId}_s1`, no: 1, size: "中近景", move: "缓慢推近", dur: 4, engine: "avatar", desc: "主角拆箱，抬头瞥向窗外", cast: [], line: null },
          { id: `${sceneId}_s2`, no: 2, size: "特写", move: "固定", dur: 5, engine: "seedance", desc: "对楼窗口人影一闪而过", cast: [], line: null },
        ],
      },
    ];
    return mockDelay({ scenes, boardScenes }, 1300);
  }
  return apiFetch<EpscriptDraftResult>(`/me/drama/projects/${id}/epscript/ai-draft`, {
    method: "POST",
    body: { ep: input.ep, plot: input.plot, style: input.style, cast: input.cast },
  });
}

/** 把单场拆成镜头表（未落库）。 */
export async function splitSceneShots(
  id: string,
  input: { sceneId: string; place?: string; action: string; lines?: ScriptLine[]; style?: string },
): Promise<BoardShot[]> {
  if (USE_MOCK) {
    return mockDelay(
      [
        { id: `${input.sceneId}_s1`, no: 1, size: "中近景", move: "缓慢推近", dur: 4, engine: "avatar" as const, desc: input.action.slice(0, 30) || "主角入画", cast: [], line: null },
        { id: `${input.sceneId}_s2`, no: 2, size: "特写", move: "固定", dur: 4, engine: "seedance" as const, desc: "关键道具特写", cast: [], line: null },
      ],
      1100,
    );
  }
  const res = await apiFetch<{ shots: BoardShot[] }>(`/me/drama/projects/${id}/epscript/split-scene`, {
    method: "POST",
    body: input,
  });
  return res.shots ?? [];
}

/** v0.97 P2：镜头分解结果（借鉴 ViMax）—— 首/末帧静态快照 + 运动描述 + 变化等级。 */
export interface ShotDecomposeResult {
  ffDesc: string;
  ffChars: string[];
  lfDesc: string;
  lfChars: string[];
  motionDesc: string;
  variationType: "small" | "medium" | "large" | string;
  variationReason: string;
}

/** 镜头分解：单镜画面 → 首/末帧 + 运动 + 变化等级（未落库，前端合并到 BoardShot）。 */
export async function decomposeShot(
  id: string,
  input: { desc: string; cast?: string[] },
): Promise<ShotDecomposeResult> {
  if (USE_MOCK) {
    return mockDelay(
      {
        ffDesc: (input.desc || "主体入画").slice(0, 40) + "（定格·开场）",
        ffChars: [],
        lfDesc: (input.desc || "主体").slice(0, 40) + "（定格·收尾）",
        lfChars: [],
        motionDesc: "摄像机缓慢推近；画面内主体轻微转身。",
        variationType: "small",
        variationReason: "仅细微动作与轻微运镜。",
      },
      900,
    );
  }
  return apiFetch<ShotDecomposeResult>(`/me/drama/projects/${id}/shot/decompose`, {
    method: "POST",
    body: input,
  });
}

/** v0.97 P5：行级就地改写本镜结果。 */
export interface ShotRewriteResult {
  desc: string;
  size: string;
  move: string;
  line: ScriptLine | null;
}

/** 行级就地改写本镜：按指令只改这一个镜头（未落库，前端合并到该镜）。 */
export async function rewriteShot(
  id: string,
  input: { desc: string; size?: string; move?: string; line?: ScriptLine | null; instruction: string; cast?: string[] },
): Promise<ShotRewriteResult> {
  if (USE_MOCK) {
    return mockDelay(
      {
        desc: `${input.desc}（已按「${input.instruction}」调整）`.slice(0, 80),
        size: input.size || "中景",
        move: input.move || "固定",
        line: input.line ?? null,
      },
      800,
    );
  }
  return apiFetch<ShotRewriteResult>(`/me/drama/projects/${id}/shot/rewrite`, {
    method: "POST",
    body: input,
  });
}

/** 从大纲重抽角色阵容（未落库）。 */
export async function castAiDraft(id: string): Promise<CharacterDef[]> {
  if (USE_MOCK) {
    return mockDelay(
      [
        { id: "ch_1", name: "林夏", role: "key" as const, cast: "女 · 28 岁 · 广告公司 AE", desc: "敏感坚韧，弧线从自我怀疑到直面真相。", avatar: "a1", bound: false },
        { id: "ch_2", name: "沈一鸣", role: "key" as const, cast: "男 · 32 岁 · 刑警", desc: "冷静克制，因旧案与主角命运交错。", avatar: "a4", bound: false },
        { id: "ch_3", name: "陈姨", role: "extra" as const, cast: "女 · 55 岁 · 楼栋管理员", desc: "热心却藏着秘密。", avatar: "a2", bound: false },
      ],
      1200,
    );
  }
  const res = await apiFetch<{ characters: CharacterDef[] }>(`/me/drama/projects/${id}/cast/ai-draft`, {
    method: "POST",
  });
  return res.characters ?? [];
}

/** C-2 三视图：角色一键生成 正/侧/全身 参考图集（后端 hold→逐角度 commit，产物落实体表）。 */
export interface ReferenceSheetInput {
  /** 要出的角度；缺省 [front, side, full]。 */
  angles?: Array<"front" | "side" | "full">;
  ratio?: string;
  /** 补充外观描述（如「短发、风衣」），拼进出图提示词。 */
  appearanceHint?: string;
}
export interface ReferenceSheetResult {
  characterId: string;
  refImages: DramaRefImage[];
  cost: number;
}

export async function generateReferenceSheet(
  projectId: string,
  charId: string,
  input?: ReferenceSheetInput,
): Promise<ReferenceSheetResult> {
  if (USE_MOCK) {
    const angles = input?.angles ?? ["front", "side", "full"];
    const label: Record<string, string> = { front: "正面", side: "侧面", full: "全身" };
    return mockDelay(
      {
        characterId: charId,
        refImages: angles.map((a) => ({
          cdnKey: `mock/char-refs/${charId}_${a}.svg`,
          url: `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160'><rect width='120' height='160' fill='hsl(${(a.length * 60) % 360},60%,60%)'/></svg>`,
          )}`,
          angle: a,
          label: label[a] ?? a,
        })),
        cost: angles.length * 2,
      },
      1400,
    );
  }
  return apiFetch<ReferenceSheetResult>(
    `/me/drama/projects/${projectId}/characters/${encodeURIComponent(charId)}/reference-sheet`,
    { method: "POST", body: { angles: input?.angles, ratio: input?.ratio, appearanceHint: input?.appearanceHint } },
  );
}

/**
 * mock 合成要拼哪几镜 —— 与服务端 DramaAssembleService#collectClipUrls 同一口径：
 * 取 episodeDocs[ep].storyboard；没有这一集的分镜、且整个项目还没启用 episodeDocs（老项目）时
 * 回落老的 storyboard 字段；逐场按镜号排序，只收有 videoUrl 的镜头。
 */
function mockAssembleClips(data: ProjectData, ep: number): BoardShot[] {
  let scenes = data.episodeDocs?.[String(ep)]?.storyboard?.scenes;
  if (!scenes) {
    const docsEnabled = !!data.episodeDocs && Object.keys(data.episodeDocs).length > 0;
    scenes = docsEnabled ? [] : data.storyboard?.scenes ?? [];
  }
  return scenes.flatMap((sc) =>
    [...(sc.shots ?? [])].sort((a, b) => (a.no ?? 0) - (b.no ?? 0)).filter((sh) => !!sh.videoUrl?.trim()),
  );
}

/** 成片合成（v0.66）：把某集已出片分镜按序拼成完整片（未落库，前端合并后 saveProject）。 */
export async function assembleEpisode(id: string, ep: number): Promise<AssembledEpisode> {
  if (USE_MOCK) {
    // 与服务端同形（§8.0.1 ⑦）：镜数 = 这一集有 videoUrl 的镜头数；时长服务端量的是拼好的成片，
    // mock 没有真文件，用这几镜的时长之和（成片就是它们首尾相接）。没有可拼的镜头时同样报
    // DRAMA_ASSEMBLE_NO_CLIPS。视频地址固定用 public/videos 里那段标了「本地演示视频」的样片。
    const data = getProjectData(id);
    if (!data || !PROJECTS.some((p) => p.id === id)) throw mockProjectNotFound();
    const clips = mockAssembleClips(data, ep);
    if (!clips.length) {
      throw new ApiError(
        {
          code: "DRAMA_ASSEMBLE_NO_CLIPS",
          message: `第 ${ep} 集还没有生成好视频的镜头，先在「分镜」里给镜头生成视频。`,
        },
        400,
      );
    }
    return mockDelay(
      {
        url: "/videos/showreel-01.mp4",
        durationSec: Math.round(clips.reduce((sum, sh) => sum + (Number(sh.dur) || 0), 0)),
        shotCount: clips.length,
        at: new Date().toISOString(),
      },
      1800,
    );
  }
  return apiFetch<AssembledEpisode>(`/me/drama/projects/${id}/assemble`, {
    method: "POST",
    body: { ep },
  });
}

/** 大纲 AI 起草：按 projectInfo 生成分集大纲（未落库，前端合并后再 saveProject）。 */
export async function outlineAiDraft(id: string, count?: number): Promise<EpisodeOutline[]> {
  if (USE_MOCK) {
    const beats = ["误会加深", "信任崩塌", "高光反击", "终极揭谜", "情绪释怀", "续作悬念"];
    return mockDelay(
      Array.from({ length: count ?? 6 }, (_, i) => ({
        no: i + 1,
        hook: `第 ${i + 1} 集的钩子（本地演示数据）`,
        synopsis: "按故事主线写出的本集梗概（本地演示数据）。",
        beat: beats[i % beats.length],
      })),
      1200,
    );
  }
  const res = await apiFetch<{ episodes: EpisodeOutline[] }>(
    `/me/drama/projects/${id}/outline/ai-draft`,
    { method: "POST", body: { count } },
  );
  return res.episodes ?? [];
}

/** v0.79 互动剧 AI 起草整张分支图（大纲分集 + 分支叠加层）；未落库，调用方合并入 ProjectData 后整图保存。 */
export interface InteractiveDraftResult {
  episodes: EpisodeOutline[];
  interactive: InteractiveOverlay;
}

export async function interactiveDraft(id: string, theme?: string): Promise<InteractiveDraftResult> {
  if (USE_MOCK) {
    // 本地联调样本：6 节点「古宅惊魂夜」可玩图（含 globalFlags + 条件触发 + setFlags）。
    const episodes: EpisodeOutline[] = [
      { no: 1, hook: "误入古宅", synopsis: "暴雨夜，你的车抛锚在荒山，只有一座亮着灯的古宅。", beat: "钩子" },
      { no: 2, hook: "温暖的客厅", synopsis: "壁炉噼啪作响，桌上似乎放着一把铜钥匙。", beat: "线索" },
      { no: 3, hook: "幽长走廊", synopsis: "锈蚀铁门在身后吱呀作响，走廊深不见底。", beat: "悬疑" },
      { no: 4, hook: "密室门前", synopsis: "尽头一扇紧锁的门，门后似有出路。", beat: "抉择" },
      { no: 5, hook: "逃出生天", synopsis: "钥匙转动，门开了，你冲进雨夜。", beat: "结局" },
      { no: 6, hook: "困死古宅", synopsis: "门纹丝不动，灯一盏盏熄灭。", beat: "结局" },
    ];
    const interactive: InteractiveOverlay = {
      enabled: true,
      startEpisodeId: "ep1",
      globalFlags: { hasKey: false, affection: 0 },
      nodes: {
        ep1: {
          isEnding: false,
          nextVideoId: null,
          interactions: [
            {
              id: "ep1_i1", triggerTime: 48, interactionType: "choice",
              uiConfig: {
                question: "门厅有两道门，你推开哪一扇？", countdownSec: 10,
                options: [
                  { id: "A", text: "雕花木门（透出暖光）", nextVideoId: "ep2", setFlags: { affection: 1 } },
                  { id: "B", text: "锈蚀铁门（吱呀作响）", nextVideoId: "ep3" },
                ],
              },
            },
          ],
        },
        ep2: {
          isEnding: false,
          nextVideoId: null,
          interactions: [
            {
              id: "ep2_i1", triggerTime: 40, interactionType: "choice",
              uiConfig: {
                question: "桌上的铜钥匙，拿吗？", countdownSec: 8,
                options: [
                  { id: "A", text: "悄悄收进口袋", nextVideoId: "ep4", setFlags: { hasKey: true } },
                  { id: "B", text: "礼貌地告辞", nextVideoId: "ep3" },
                ],
              },
            },
          ],
        },
        ep3: { isEnding: false, nextVideoId: "ep4", interactions: [] },
        ep4: {
          isEnding: false,
          nextVideoId: null,
          interactions: [
            {
              id: "ep4_i1", triggerTime: 44, interactionType: "choice",
              condition: "globalFlags.hasKey == true",
              uiConfig: {
                question: "你手里正好有钥匙", countdownSec: 10,
                options: [{ id: "A", text: "插入钥匙开门", nextVideoId: "ep5" }],
              },
            },
            {
              id: "ep4_i2", triggerTime: 46, interactionType: "choice",
              uiConfig: {
                question: "门锁着，怎么办？", countdownSec: 10,
                options: [{ id: "A", text: "用力撞门", nextVideoId: "ep6" }],
              },
            },
          ],
        },
        ep5: { isEnding: true, endingLabel: "逃出生天", nextVideoId: null, interactions: [] },
        ep6: { isEnding: true, endingLabel: "困死古宅", nextVideoId: null, interactions: [] },
      },
    };
    void theme;
    return mockDelay({ episodes, interactive }, 1600);
  }
  return apiFetch<InteractiveDraftResult>(`/me/drama/projects/${id}/interactive/draft`, {
    method: "POST",
    body: { theme },
  });
}
