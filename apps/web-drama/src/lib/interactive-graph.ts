// ─────────────────────────────────────────────────────────────────────────────
// lib/interactive-graph.ts — 互动短剧「剧集图」的纯逻辑（无网络）。
// 派生摘要 / 校验 / 导出 Story Config / 新建骨架 / 节点增删改 / 旧结构迁移。
// 前端契约真源是 api/interactive-drama.ts；本文件只 type-import 它的类型，提供纯函数。
//
// 模型对齐抖音小程序「互动视频」规范：一集（视频）的时间轴上可有 0..N 个「互动点」
// （interactions[]，在 trigger_time 秒触发，类型 choice/input/countdown），选项 →
// nextVideoId 跳转；剧级带 global_flags（道具 / 好感度等状态）。导出 manifest = 平台
// 下发的 Story Config（camelCase）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CreateSeriesInput,
  EpisodeNode,
  GlobalFlagDef,
  Interaction,
  InteractionOption,
  InteractiveManifest,
  InteractiveSeries,
  InteractiveSeriesSummary,
  ManifestEpisode,
  ManifestInteraction,
} from "@/api/interactive-drama";

/** 导出给社媒平台的互动配置 schema 版本（v2 = 抖音 Story Config 对齐：时间轴互动 + globalFlags）。 */
export const INTERACTIVE_MANIFEST_SCHEMA = "ai-star-eco.interactive-drama/v2";

let _seq = 0;
/** 生成本地 id（mock / 新建节点用；落库时后端可 upsert 同 id）。 */
export function genId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// ── 迁移 / 规整 ───────────────────────────────────────────────────────────────
// 旧模型（单 `interaction` 对象，互动只在整集播完）→ 新模型（`interactions[]` 时间轴互动点）。
// 读路径（mock store / 后端老 row）经此升级，编辑器 / 画布 / 导出统一吃新结构。

interface LegacyChoice {
  id?: string;
  label?: string;
  next_episode_id?: string;
}
interface LegacyInteraction {
  prompt?: string;
  choices?: LegacyChoice[];
  countdown_sec?: number | null;
  default_choice_id?: string | null;
}

/** 规整一集：补齐 interactions[]（含旧 interaction 迁移）+ 每个互动点 / 选项的必备字段。 */
export function normalizeEpisode(raw: EpisodeNode): EpisodeNode {
  const e = raw as EpisodeNode & { interaction?: LegacyInteraction | null };
  let interactions: Interaction[] = Array.isArray(e.interactions) ? e.interactions : [];

  // 旧 `interaction`（整集播完弹）→ 一个落在视频末尾（trigger_time = 时长）的 choice 互动点。
  if (interactions.length === 0 && e.interaction && Array.isArray(e.interaction.choices)) {
    const li = e.interaction;
    interactions = [
      {
        id: genId("itx"),
        trigger_time: e.duration_sec ?? 60,
        type: "choice",
        prompt: li.prompt ?? "",
        options: (li.choices ?? []).map((c) => ({
          id: c.id ?? genId("opt"),
          label: c.label ?? "",
          next_episode_id: c.next_episode_id ?? "",
        })),
        countdown_sec: li.countdown_sec ?? null,
        default_option_id: li.default_choice_id ?? null,
        condition: null,
      },
    ];
  }

  const normInteractions: Interaction[] = interactions.map((i) => ({
    id: i.id ?? genId("itx"),
    trigger_time: typeof i.trigger_time === "number" ? i.trigger_time : e.duration_sec ?? 60,
    type: i.type ?? "choice",
    prompt: i.prompt ?? "",
    options: Array.isArray(i.options)
      ? i.options.map((o) => ({
          id: o.id ?? genId("opt"),
          label: o.label ?? "",
          next_episode_id: o.next_episode_id ?? "",
          ...(o.set_flags ? { set_flags: o.set_flags } : {}),
        }))
      : [],
    countdown_sec: i.countdown_sec ?? null,
    default_option_id: i.default_option_id ?? null,
    condition: i.condition ?? null,
  }));

  const out = { ...e, interactions: normInteractions } as EpisodeNode & { interaction?: unknown };
  delete out.interaction; // 丢弃旧字段
  return out;
}

/** 规整一部剧：补 global_flags + 规整每集。读路径（getSeries / 派生摘要）调用。 */
export function normalizeSeries(raw: InteractiveSeries): InteractiveSeries {
  return {
    ...raw,
    global_flags: Array.isArray(raw.global_flags) ? raw.global_flags : [],
    episodes: (raw.episodes ?? []).map(normalizeEpisode),
  };
}

/** 一集所有「向外跳转」的目标集 id（所有互动点的选项 + 线性下一集）。 */
export function episodeTargets(e: EpisodeNode): string[] {
  const outs: string[] = [];
  for (const itx of e.interactions ?? []) for (const o of itx.options) if (o.next_episode_id) outs.push(o.next_episode_id);
  if (e.next_episode_id) outs.push(e.next_episode_id);
  return outs;
}

// ── 派生 ─────────────────────────────────────────────────────────────────────

export function summarize(s: InteractiveSeries): InteractiveSeriesSummary {
  const eps = s.episodes ?? [];
  return {
    id: s.id,
    title: s.title,
    genre: s.genre,
    status: s.status,
    episode_count: eps.length,
    branch_count: eps.reduce((n, e) => n + (e.interactions?.length ?? 0), 0), // 互动点总数
    ending_count: eps.filter((e) => !!e.is_ending).length,
    ready_count: eps.filter((e) => e.gen_status === "ready").length,
    updated_at: s.updated_at,
  };
}

/** 全部集已生成 → ready；否则 draft。 */
export function deriveStatus(s: InteractiveSeries): string {
  const eps = s.episodes ?? [];
  if (eps.length === 0) return "draft";
  return eps.every((e) => e.gen_status === "ready") ? "ready" : "draft";
}

export function episodeTitle(s: InteractiveSeries, id: string | null | undefined): string {
  if (!id) return "—";
  return s.episodes.find((e) => e.id === id)?.title ?? `（已删除）`;
}

// ── 校验 ─────────────────────────────────────────────────────────────────────

export interface SeriesValidation {
  errors: string[];
  warnings: string[];
  reachable: Set<string>;
  ok: boolean;
}

/** 校验剧集图：起点、可达性、互动点（类型 / 选项指向 / 触发时间）、结局、断点、标记引用。 */
export function validateSeries(s: InteractiveSeries): SeriesValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(s.episodes.map((e) => [e.id, e] as const));
  const flagKeys = new Set((s.global_flags ?? []).map((f) => f.key));

  if (!byId.has(s.start_episode_id)) {
    errors.push("没有设置有效的起始集。");
  }

  // 可达性 BFS（从起始集出发）
  const reachable = new Set<string>();
  const queue: string[] = byId.has(s.start_episode_id) ? [s.start_episode_id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const ep = byId.get(id);
    if (!ep) continue;
    for (const n of episodeTargets(ep)) if (byId.has(n) && !reachable.has(n)) queue.push(n);
  }

  for (const ep of s.episodes) {
    const optionCount = ep.interactions.reduce((n, i) => n + i.options.length, 0);
    const flows = optionCount + (ep.next_episode_id ? 1 : 0);
    if (!ep.is_ending && flows === 0) {
      warnings.push(`「${ep.title}」既不是结局，也没有互动或下一集 —— 剧情会断在这里。`);
    }
    for (const itx of ep.interactions) {
      const at = `@${itx.trigger_time}s`;
      if (itx.type === "choice" && itx.options.length < 2) {
        errors.push(`「${ep.title}」的「选择」互动（${at}）至少要有 2 个选项。`);
      }
      if (!itx.prompt.trim()) {
        errors.push(`「${ep.title}」有个互动（${at}）还没填问题文案。`);
      }
      if (typeof ep.duration_sec === "number" && itx.trigger_time > ep.duration_sec) {
        warnings.push(`「${ep.title}」的互动触发时间（${itx.trigger_time}s）超过了本集时长（${ep.duration_sec}s）。`);
      }
      for (const o of itx.options) {
        if (!o.next_episode_id || !byId.has(o.next_episode_id)) {
          errors.push(`「${ep.title}」里选项「${o.label || "未命名"}」没有指向有效的下一集。`);
        }
        if (!o.label.trim()) {
          warnings.push(`「${ep.title}」有一个选项还没填文案。`);
        }
        if (o.set_flags) {
          for (const k of Object.keys(o.set_flags)) {
            if (!flagKeys.has(k)) warnings.push(`「${ep.title}」的选项写了未声明的剧情标记「${k}」—— 记得在「全局标记」里声明。`);
          }
        }
      }
      if (itx.condition && itx.condition.trim()) {
        const refs = itx.condition.match(/globalFlags\.(\w+)/g) ?? [];
        for (const token of refs) {
          const k = token.split(".")[1];
          if (k && !flagKeys.has(k)) warnings.push(`「${ep.title}」的互动条件引用了未声明的标记「${k}」。`);
        }
      }
    }
    if (ep.next_episode_id && !byId.has(ep.next_episode_id)) {
      errors.push(`「${ep.title}」的线性下一集指向了不存在的集。`);
    }
    if (byId.has(s.start_episode_id) && !reachable.has(ep.id)) {
      warnings.push(`「${ep.title}」从起始集走不到（孤立节点）。`);
    }
  }

  if (!s.episodes.some((e) => e.is_ending)) {
    warnings.push("还没有任何结局集，观众的旅程没有终点。");
  }

  return { errors, warnings, reachable, ok: errors.length === 0 };
}

// ── 导出 manifest（抖音 Story Config v2，camelCase） ──────────────────────────

function defaultFlagValue(f: GlobalFlagDef): number | boolean | string {
  if (f.default !== undefined) return f.default;
  return f.type === "boolean" ? false : f.type === "number" ? 0 : "";
}

export function buildManifest(s: InteractiveSeries): InteractiveManifest {
  const episodes: ManifestEpisode[] = s.episodes.map((e) => ({
    episodeId: e.id,
    title: e.title,
    videoUrl: e.video_url ?? null,
    durationSec: e.duration_sec,
    interactions: e.interactions.map<ManifestInteraction>((i) => ({
      triggerTime: i.trigger_time,
      interactionType: i.type,
      ...(i.condition && i.condition.trim() ? { condition: i.condition.trim() } : {}),
      uiConfig: {
        question: i.prompt,
        options: i.options.map((o) => ({
          id: o.id,
          text: o.label,
          nextVideoId: o.next_episode_id,
          ...(o.set_flags ? { setFlags: o.set_flags } : {}),
        })),
        countdownSec: i.countdown_sec ?? null,
      },
    })),
    nextVideoId: e.next_episode_id ?? null,
    isEnding: e.is_ending || undefined,
    endingLabel: e.ending_label || undefined,
  }));
  const globalFlags: Record<string, number | boolean | string> = {};
  for (const f of s.global_flags ?? []) globalFlags[f.key] = defaultFlagValue(f);
  return {
    schema: INTERACTIVE_MANIFEST_SCHEMA,
    dramaId: s.id,
    title: s.title,
    genre: s.genre,
    startEpisodeId: s.start_episode_id,
    globalFlags,
    episodes,
    generatedAt: new Date().toISOString(),
  };
}

// ── 节点增删改（纯函数，返回新 series） ──────────────────────────────────────

export function applyNodePatch(
  s: InteractiveSeries,
  episodeId: string,
  patch: Partial<EpisodeNode>,
): InteractiveSeries {
  return { ...s, episodes: s.episodes.map((e) => (e.id === episodeId ? { ...e, ...patch } : e)) };
}

/** 删除一集，并清理其它集对它的引用（线性下一集 / 互动选项；选项删空的 choice 互动点一并移除）。 */
export function removeEpisode(s: InteractiveSeries, episodeId: string): InteractiveSeries {
  const episodes = s.episodes
    .filter((e) => e.id !== episodeId)
    .map((e) => {
      const next = e.next_episode_id === episodeId ? null : e.next_episode_id;
      const interactions = e.interactions
        .map((itx) => ({ ...itx, options: itx.options.filter((o) => o.next_episode_id !== episodeId) }))
        .filter((itx) => itx.type !== "choice" || itx.options.length > 0);
      return { ...e, next_episode_id: next, interactions };
    });
  let start = s.start_episode_id;
  if (start === episodeId) start = episodes[0]?.id ?? "";
  return { ...s, episodes, start_episode_id: start };
}

export function addEpisode(s: InteractiveSeries, ep: EpisodeNode): InteractiveSeries {
  return { ...s, episodes: [...s.episodes, ep] };
}

// ── 工厂 ─────────────────────────────────────────────────────────────────────

export function blankEpisode(title: string, synopsis?: string): EpisodeNode {
  return {
    id: genId("ep"),
    title,
    synopsis,
    duration_sec: 60,
    gen_status: "idle",
    video_url: null,
    interactions: [],
    next_episode_id: null,
    is_ending: false,
  };
}

export function blankOption(targetId: string): InteractionOption {
  return { id: genId("opt"), label: "", next_episode_id: targetId };
}

/** 新建一个互动点（默认 choice、触发在 triggerTime 秒、含两个空选项指向给定目标）。 */
export function blankInteraction(triggerTime: number, targetA?: string, targetB?: string): Interaction {
  return {
    id: genId("itx"),
    trigger_time: Math.max(0, Math.round(triggerTime)),
    type: "choice",
    prompt: "",
    options: [blankOption(targetA ?? ""), blankOption(targetB ?? targetA ?? "")],
    countdown_sec: 10,
    default_option_id: null,
    condition: null,
  };
}

/** 拼一个 choice 互动点（工厂 / AI 起草内部用）。 */
function choiceInteraction(triggerTime: number, prompt: string, options: { label: string; next: string }[], countdown = 10): Interaction {
  return {
    id: genId("itx"),
    trigger_time: triggerTime,
    type: "choice",
    prompt,
    options: options.map((o) => ({ id: genId("opt"), label: o.label, next_episode_id: o.next })),
    countdown_sec: countdown,
    default_option_id: null,
    condition: null,
  };
}

/** 复制一集：保留内容（标题/分支标签/剧情/分镜/时长），但重置生成态、清空流转（新副本未接线）。 */
export function cloneEpisode(ep: EpisodeNode): EpisodeNode {
  const fresh = blankEpisode(`${ep.title || "未命名"} 副本`, ep.synopsis);
  fresh.branch_label = ep.branch_label;
  fresh.duration_sec = ep.duration_sec ?? 60;
  fresh.scenes = ep.scenes ? JSON.parse(JSON.stringify(ep.scenes)) : undefined;
  return fresh;
}

/** 新建一部互动剧骨架。single=单集起步；branch=带一个分支点的示例。 */
export function buildSkeleton(input: CreateSeriesInput): InteractiveSeries {
  const now = new Date().toISOString();
  const id = genId("dis");
  const base = {
    id,
    title: input.title,
    genre: input.genre,
    logline: input.logline,
    status: "draft",
    global_flags: [] as GlobalFlagDef[],
    created_at: now,
    updated_at: now,
  };

  if (input.skeleton === "single") {
    const ep1 = blankEpisode("第 1 集", "故事开场，埋下钩子。");
    return { ...base, start_episode_id: ep1.id, episodes: [ep1] };
  }

  // branch 示例：1 集 → 末尾互动 → 2 个结局
  const e1 = blankEpisode("第 1 集 · 抉择前夜", "矛盾爆发，主角必须做出选择。");
  const eA = blankEpisode("第 2 集 · A 线", "选择 A 之后的走向。");
  const eB = blankEpisode("第 2 集 · B 线", "选择 B 之后的走向。");
  eA.branch_label = "A 线";
  eB.branch_label = "B 线";
  eA.is_ending = true;
  eA.ending_label = "结局 A";
  eB.is_ending = true;
  eB.ending_label = "结局 B";
  e1.interactions = [
    choiceInteraction(e1.duration_sec ?? 60, "看完这一集，主角该怎么选？", [
      { label: "选择 A", next: eA.id },
      { label: "选择 B", next: eB.id },
    ]),
  ];
  return { ...base, start_episode_id: e1.id, episodes: [e1, eA, eB] };
}

/**
 * AI 起草（mock 生成器）：从主题生成一张可玩的剧集分支图。
 * live 走后端 `/me/drama/interactive/ai-draft`；本函数是 USE_MOCK 下的本地产物，
 * 形态与后端约定一致（起始集 + 互动点 + 分支集 + 结局，valid 且可达）。
 */
export function draftSeriesFromTheme(input: {
  theme: string;
  genre?: string;
  branchPoints?: number;
  endings?: number;
}): InteractiveSeries {
  const now = new Date().toISOString();
  const id = genId("dis");
  const theme = (input.theme || "").trim() || "未命名故事";
  const genre = input.genre || "都市悬疑";
  const tag = theme.length > 10 ? theme.slice(0, 10) + "…" : theme;
  const branchPoints = Math.max(1, Math.min(2, input.branchPoints ?? 1));
  const endings = Math.max(2, Math.min(4, input.endings ?? 2));

  const base = {
    id,
    title: `${theme.slice(0, 12)} · 互动版`,
    genre,
    logline: `围绕「${tag}」展开，关键时刻由观众替主角抉择，走向不同结局。`,
    status: "draft",
    global_flags: [] as GlobalFlagDef[],
    created_at: now,
    updated_at: now,
  };

  if (branchPoints <= 1) {
    // 单互动点：第 1 集 → endings 个选项 → 各自结局
    const e1 = blankEpisode("第 1 集 · 抉择时刻", `${tag}：矛盾在这一集被推到顶点，主角站在岔路口。`);
    const labels = ["顺从内心", "选择现实", "另辟蹊径", "停下脚步"];
    const endLabels = ["HE · 圆满", "BE · 遗憾", "开放 · 留白", "反转 · 意外"];
    const endingNodes: EpisodeNode[] = [];
    const options: { label: string; next: string }[] = [];
    for (let i = 0; i < endings; i++) {
      const ep = blankEpisode(`大结局 · ${endLabels[i]}`, `选择「${labels[i]}」之后的走向与收束。`);
      ep.is_ending = true;
      ep.ending_label = endLabels[i];
      ep.branch_label = labels[i];
      endingNodes.push(ep);
      options.push({ label: labels[i], next: ep.id });
    }
    e1.interactions = [choiceInteraction(e1.duration_sec ?? 60, `面对「${tag}」，主角该怎么选？`, options)];
    return { ...base, start_episode_id: e1.id, episodes: [e1, ...endingNodes] };
  }

  // 双互动点：第 1 集 → 2 分支；A 线再分叉到 2 结局，B 线线性收 1 开放结局
  const e1 = blankEpisode("第 1 集 · 抉择时刻", `${tag}：第一道选择题摆在主角面前。`);
  const eA = blankEpisode("第 2 集 · A 线", "走上 A 线后的新局面，又一次抉择在等着。");
  const eB = blankEpisode("第 2 集 · B 线", "走上 B 线后，故事滑向另一种节奏。");
  eA.branch_label = "A 线";
  eB.branch_label = "B 线";
  const heA = blankEpisode("大结局 · A · 圆满", "A 线深入后的圆满收束。");
  const beA = blankEpisode("大结局 · A · 遗憾", "A 线深入后的遗憾收束。");
  const endB = blankEpisode("大结局 · B · 开放", "B 线的开放式收尾，留下想象。");
  for (const e of [heA, beA, endB]) e.is_ending = true;
  heA.ending_label = "HE · 圆满";
  heA.branch_label = "A 线";
  beA.ending_label = "BE · 遗憾";
  beA.branch_label = "A 线";
  endB.ending_label = "开放结局";
  endB.branch_label = "B 线";
  e1.interactions = [
    choiceInteraction(e1.duration_sec ?? 60, `面对「${tag}」，主角该怎么选？`, [
      { label: "迎难而上", next: eA.id },
      { label: "暂避锋芒", next: eB.id },
    ]),
  ];
  eA.interactions = [
    choiceInteraction(eA.duration_sec ?? 60, "A 线的关键一步，主角如何应对？", [
      { label: "全力一搏", next: heA.id },
      { label: "保留退路", next: beA.id },
    ], 8),
  ];
  eB.next_episode_id = endB.id;
  return { ...base, start_episode_id: e1.id, episodes: [e1, eA, eB, heA, beA, endB] };
}
