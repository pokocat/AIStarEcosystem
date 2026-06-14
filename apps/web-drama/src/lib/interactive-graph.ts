// ─────────────────────────────────────────────────────────────────────────────
// lib/interactive-graph.ts — 互动短剧「剧集图」的纯逻辑（无网络）。
// 派生摘要 / 校验 / 导出 manifest / 新建骨架 / 节点增删改。前端契约真源是
// api/interactive-drama.ts；本文件只 type-import 它的类型，提供纯函数。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CreateSeriesInput,
  EpisodeChoice,
  EpisodeNode,
  InteractiveManifest,
  InteractiveSeries,
  InteractiveSeriesSummary,
  ManifestEpisode,
} from "@/api/interactive-drama";

/** 导出给社媒平台的互动配置 schema 版本（我们自己的规范格式）。 */
export const INTERACTIVE_MANIFEST_SCHEMA = "ai-star-eco.interactive-drama/v1";

let _seq = 0;
/** 生成本地 id（mock / 新建节点用；落库时后端可 upsert 同 id）。 */
export function genId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
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
    branch_count: eps.filter((e) => !!e.interaction && (e.interaction.choices?.length ?? 0) > 0).length,
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

/** 校验剧集图：起点、可达性、选项指向、结局、断点。 */
export function validateSeries(s: InteractiveSeries): SeriesValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(s.episodes.map((e) => [e.id, e] as const));

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
    const nexts: string[] = [];
    if (ep.interaction) for (const c of ep.interaction.choices) nexts.push(c.next_episode_id);
    if (ep.next_episode_id) nexts.push(ep.next_episode_id);
    for (const n of nexts) if (byId.has(n) && !reachable.has(n)) queue.push(n);
  }

  for (const ep of s.episodes) {
    const flows = (ep.interaction?.choices.length ?? 0) + (ep.next_episode_id ? 1 : 0);
    if (!ep.is_ending && flows === 0) {
      warnings.push(`「${ep.title}」既不是结局，也没有互动或下一集 —— 剧情会断在这里。`);
    }
    if (ep.interaction) {
      if (ep.interaction.choices.length < 2) {
        errors.push(`「${ep.title}」的互动至少要有 2 个选项。`);
      }
      if (!ep.interaction.prompt.trim()) {
        errors.push(`「${ep.title}」的互动还没填问题文案。`);
      }
      for (const c of ep.interaction.choices) {
        if (!c.next_episode_id || !byId.has(c.next_episode_id)) {
          errors.push(`「${ep.title}」里选项「${c.label || "未命名"}」没有指向有效的下一集。`);
        }
        if (!c.label.trim()) {
          warnings.push(`「${ep.title}」有一个选项还没填文案。`);
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

// ── 导出 manifest ────────────────────────────────────────────────────────────

export function buildManifest(s: InteractiveSeries): InteractiveManifest {
  const episodes: ManifestEpisode[] = s.episodes.map((e) => ({
    id: e.id,
    title: e.title,
    video_url: e.video_url ?? null,
    duration_sec: e.duration_sec,
    interaction: e.interaction
      ? {
          prompt: e.interaction.prompt,
          choices: e.interaction.choices.map((c) => ({ label: c.label, next_episode: c.next_episode_id })),
          countdown_sec: e.interaction.countdown_sec ?? null,
        }
      : null,
    next_episode: e.next_episode_id ?? null,
    is_ending: e.is_ending || undefined,
    ending_label: e.ending_label || undefined,
  }));
  return {
    schema: INTERACTIVE_MANIFEST_SCHEMA,
    series_id: s.id,
    title: s.title,
    genre: s.genre,
    start_episode: s.start_episode_id,
    episodes,
    generated_at: new Date().toISOString(),
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

/** 删除一集，并清理其它集对它的引用（线性下一集 / 互动选项）。 */
export function removeEpisode(s: InteractiveSeries, episodeId: string): InteractiveSeries {
  const episodes = s.episodes
    .filter((e) => e.id !== episodeId)
    .map((e) => {
      const next = e.next_episode_id === episodeId ? null : e.next_episode_id;
      let interaction = e.interaction
        ? { ...e.interaction, choices: e.interaction.choices.filter((c) => c.next_episode_id !== episodeId) }
        : e.interaction;
      if (interaction && interaction.choices.length === 0) interaction = null; // 选项删空 → 降级为无互动
      return { ...e, next_episode_id: next, interaction };
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
    interaction: null,
    next_episode_id: null,
    is_ending: false,
  };
}

export function blankChoice(targetId: string): EpisodeChoice {
  return { id: genId("ch"), label: "", next_episode_id: targetId };
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
    created_at: now,
    updated_at: now,
  };

  if (input.skeleton === "single") {
    const ep1 = blankEpisode("第 1 集", "故事开场，埋下钩子。");
    return { ...base, start_episode_id: ep1.id, episodes: [ep1] };
  }

  // branch 示例：1 集 → 互动 → 2 个结局
  const e1 = blankEpisode("第 1 集 · 抉择前夜", "矛盾爆发，主角必须做出选择。");
  const eA = blankEpisode("第 2 集 · A 线", "选择 A 之后的走向。");
  const eB = blankEpisode("第 2 集 · B 线", "选择 B 之后的走向。");
  eA.branch_label = "A 线";
  eB.branch_label = "B 线";
  eA.is_ending = true;
  eA.ending_label = "结局 A";
  eB.is_ending = true;
  eB.ending_label = "结局 B";
  e1.interaction = {
    prompt: "看完这一集，主角该怎么选？",
    choices: [
      { id: genId("ch"), label: "选择 A", next_episode_id: eA.id },
      { id: genId("ch"), label: "选择 B", next_episode_id: eB.id },
    ],
    countdown_sec: 10,
    default_choice_id: null,
  };
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
    created_at: now,
    updated_at: now,
  };

  if (branchPoints <= 1) {
    // 单互动点：第 1 集 → endings 个选项 → 各自结局
    const e1 = blankEpisode("第 1 集 · 抉择时刻", `${tag}：矛盾在这一集被推到顶点，主角站在岔路口。`);
    const labels = ["顺从内心", "选择现实", "另辟蹊径", "停下脚步"];
    const endLabels = ["HE · 圆满", "BE · 遗憾", "开放 · 留白", "反转 · 意外"];
    const endingNodes: EpisodeNode[] = [];
    const choices: EpisodeChoice[] = [];
    for (let i = 0; i < endings; i++) {
      const ep = blankEpisode(`大结局 · ${endLabels[i]}`, `选择「${labels[i]}」之后的走向与收束。`);
      ep.is_ending = true;
      ep.ending_label = endLabels[i];
      ep.branch_label = labels[i];
      endingNodes.push(ep);
      choices.push({ id: genId("ch"), label: labels[i], next_episode_id: ep.id });
    }
    e1.interaction = { prompt: `面对「${tag}」，主角该怎么选？`, choices, countdown_sec: 10, default_choice_id: null };
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
  e1.interaction = {
    prompt: `面对「${tag}」，主角该怎么选？`,
    choices: [
      { id: genId("ch"), label: "迎难而上", next_episode_id: eA.id },
      { id: genId("ch"), label: "暂避锋芒", next_episode_id: eB.id },
    ],
    countdown_sec: 10,
    default_choice_id: null,
  };
  eA.interaction = {
    prompt: "A 线的关键一步，主角如何应对？",
    choices: [
      { id: genId("ch"), label: "全力一搏", next_episode_id: heA.id },
      { id: genId("ch"), label: "保留退路", next_episode_id: beA.id },
    ],
    countdown_sec: 8,
    default_choice_id: null,
  };
  eB.next_episode_id = endB.id;
  return { ...base, start_episode_id: e1.id, episodes: [e1, eA, eB, heA, beA, endB] };
}
