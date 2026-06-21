// ─────────────────────────────────────────────────────────────────────────────
// lib/interactive-graph.ts — 互动剧图算法（v0.79，纯函数，无 React / 无网络）。
//   · validateStory：结构校验（错误阻断导出 / 警告提示），实现 §2.4 规则
//   · reachableIds：从起始集 BFS 可达性（孤立节点检出）
//   · layoutGraph：按分支深度 BFS 左→右分层布局（给分支图画布用）
//   · buildStoryConfig：导出为下发给播放器的 Story Config v2 JSON（§1 目标形态）
//   · simulateNext：试玩走查时按选项 + 条件推进（创作端验证工具，非播放器运行时）
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FlagValue,
  InteractiveEpisode,
  InteractiveNode,
  InteractiveOverlay,
  InteractiveStoryData,
} from "@/lib/interactive-types";
import type { EpisodeOutline, ProjectData } from "@/mocks/drama-workshop";
import { getEpisodeDoc } from "@/mocks/drama-workshop";

export interface Issue {
  level: "error" | "warning";
  code: string;
  message: string;
  /** 关联集（点击可定位）。 */
  episodeId?: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
  /** 可导出 = 无 error。 */
  ok: boolean;
}

const FLAG_REF = /globalFlags\.([A-Za-z0-9_]+)/g;

/** 从 condition 表达式里抽出引用的标记名（用于「引用的标记需先声明」校验）。 */
export function flagsInCondition(condition: string | undefined): string[] {
  if (!condition) return [];
  const out: string[] = [];
  let m: RegExpExecArray | null;
  FLAG_REF.lastIndex = 0;
  while ((m = FLAG_REF.exec(condition)) !== null) out.push(m[1]);
  return out;
}

/** 一集的所有出边目标（互动选项 nextVideoId + 线性 nextVideoId）。 */
export function outgoingTargets(ep: InteractiveEpisode): string[] {
  const out: string[] = [];
  for (const it of ep.interactions ?? []) {
    for (const o of it.uiConfig?.options ?? []) {
      if (o.nextVideoId) out.push(o.nextVideoId);
    }
  }
  if (ep.nextVideoId) out.push(ep.nextVideoId);
  return out;
}

/** 从起始集 BFS 出发，沿所有出边求可达集合。 */
export function reachableIds(data: InteractiveStoryData): Set<string> {
  const byId = new Map(data.episodes.map((e) => [e.episodeId, e]));
  const seen = new Set<string>();
  const start = data.startEpisodeId;
  if (!start || !byId.has(start)) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const cur = byId.get(queue.shift()!);
    if (!cur) continue;
    for (const t of outgoingTargets(cur)) {
      if (byId.has(t) && !seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }
  return seen;
}

/**
 * 结构校验（§2.4）：
 *  错误（阻断导出）：起始集缺失/不存在、episodeId 重复、选项/线性目标指向不存在的集、
 *    无任何结局、非结局集无任何后续（断点）、互动点 triggerTime 超过本集时长、
 *    condition/setFlags 引用未声明的标记、选项缺问题文案。
 *  警告（不阻断）：从起点不可达（孤立节点）、互动点缺选项、本集尚未出片（时长 0 无法校验触发点）、
 *    没有任何分支（纯线性，鼓励但不强制）。
 */
export function validateStory(data: InteractiveStoryData): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const eps = data.episodes ?? [];
  const ids = new Set<string>();
  const declared = new Set(Object.keys(data.globalFlags ?? {}));

  // 起始集
  const byId = new Map<string, InteractiveEpisode>();
  for (const e of eps) {
    if (ids.has(e.episodeId)) {
      errors.push({ level: "error", code: "DUP_EPISODE_ID", message: `集 id 重复：${e.episodeId}`, episodeId: e.episodeId });
    }
    ids.add(e.episodeId);
    byId.set(e.episodeId, e);
  }
  if (eps.length === 0) {
    errors.push({ level: "error", code: "NO_EPISODES", message: "还没有任何集" });
  }
  if (!data.startEpisodeId) {
    errors.push({ level: "error", code: "NO_START", message: "未设置起始集" });
  } else if (!byId.has(data.startEpisodeId)) {
    errors.push({ level: "error", code: "BAD_START", message: `起始集不存在：${data.startEpisodeId}` });
  }

  // 至少一个结局
  if (eps.length > 0 && !eps.some((e) => e.isEnding)) {
    errors.push({ level: "error", code: "NO_ENDING", message: "缺少结局集（至少要有一个 isEnding=true 的集）" });
  }

  const reachable = reachableIds(data);
  let hasBranch = false;

  for (const e of eps) {
    const targets = outgoingTargets(e);
    // 出边目标必须存在
    for (const it of e.interactions ?? []) {
      if ((it.uiConfig?.options?.length ?? 0) > 1) hasBranch = true;
      if (!it.uiConfig?.question?.trim()) {
        errors.push({ level: "error", code: "NO_QUESTION", message: `「${e.title}」有互动点缺少问题文案`, episodeId: e.episodeId });
      }
      const opts = it.uiConfig?.options ?? [];
      if (e.interactions?.length && opts.length === 0 && it.interactionType === "choice") {
        warnings.push({ level: "warning", code: "NO_OPTIONS", message: `「${e.title}」的选择互动点还没有选项`, episodeId: e.episodeId });
      }
      for (const o of opts) {
        if (!o.nextVideoId) {
          errors.push({ level: "error", code: "OPTION_DANGLING", message: `「${e.title}」选项「${o.text || o.id}」还没接到任何集`, episodeId: e.episodeId });
        } else if (!byId.has(o.nextVideoId)) {
          errors.push({ level: "error", code: "OPTION_BAD_TARGET", message: `「${e.title}」选项「${o.text || o.id}」指向不存在的集 ${o.nextVideoId}`, episodeId: e.episodeId });
        }
        // setFlags 引用的标记需先声明
        for (const k of Object.keys(o.setFlags ?? {})) {
          if (!declared.has(k)) {
            errors.push({ level: "error", code: "UNDECLARED_FLAG", message: `「${e.title}」选项写入了未声明的标记「${k}」（请先在全局标记里声明）`, episodeId: e.episodeId });
          }
        }
      }
      // condition 引用的标记需先声明
      for (const k of flagsInCondition(it.condition)) {
        if (!declared.has(k)) {
          errors.push({ level: "error", code: "UNDECLARED_FLAG", message: `「${e.title}」的条件引用了未声明的标记「${k}」`, episodeId: e.episodeId });
        }
      }
      // triggerTime ≤ 本集时长（已出片才可严格判定）
      if (e.durationSec > 0 && it.triggerTime > e.durationSec) {
        errors.push({ level: "error", code: "TRIGGER_OVERFLOW", message: `「${e.title}」互动点触发时间 ${it.triggerTime}s 超过了本集时长 ${e.durationSec}s`, episodeId: e.episodeId });
      }
      if (e.durationSec <= 0 && (e.interactions?.length ?? 0) > 0) {
        warnings.push({ level: "warning", code: "DURATION_UNKNOWN", message: `「${e.title}」还没出片，触发时间暂无法按时长校验`, episodeId: e.episodeId });
      }
    }
    // 线性续播目标必须存在
    if (e.nextVideoId && !byId.has(e.nextVideoId)) {
      errors.push({ level: "error", code: "NEXT_BAD_TARGET", message: `「${e.title}」的续播目标不存在：${e.nextVideoId}`, episodeId: e.episodeId });
    }
    // 非结局集必须有后续（否则断点）
    if (!e.isEnding && targets.length === 0) {
      errors.push({ level: "error", code: "DEAD_END", message: `「${e.title}」既不是结局也没有任何后续（断点）`, episodeId: e.episodeId });
    }
    // 孤立节点（不可达）
    if (eps.length > 1 && !reachable.has(e.episodeId)) {
      warnings.push({ level: "warning", code: "UNREACHABLE", message: `「${e.title}」从起始集走不到（孤立节点）`, episodeId: e.episodeId });
    }
  }

  // 结局可达性
  if (eps.some((e) => e.isEnding) && !eps.some((e) => e.isEnding && reachable.has(e.episodeId))) {
    errors.push({ level: "error", code: "ENDING_UNREACHABLE", message: "没有任何结局集是从起始集可达的" });
  }
  // 鼓励分支（纯线性给个温和提示）
  if (eps.length > 1 && !hasBranch) {
    warnings.push({ level: "warning", code: "NO_BRANCH", message: "目前是纯线性剧情，加一个「选择」互动点才有互动剧的意义" });
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// ── 分支图布局（BFS 分层，左→右） ──────────────────────────────────────────

export interface GraphNode {
  id: string;
  episode: InteractiveEpisode;
  depth: number;
  row: number;
  x: number;
  y: number;
  reachable: boolean;
}
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  /** 条件边（互动选项）vs 线性续播。 */
  kind: "option" | "linear";
}
export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

const COL = 220;
const ROW = 132;
const PAD_X = 40;
const PAD_Y = 28;
const NODE_W = 170;
const NODE_H = 92;

export function layoutGraph(data: InteractiveStoryData): GraphLayout {
  const eps = data.episodes ?? [];
  const byId = new Map(eps.map((e) => [e.episodeId, e]));
  const reachable = reachableIds(data);

  // BFS 求每个节点的深度（按可达层）
  const depth = new Map<string, number>();
  const start = data.startEpisodeId && byId.has(data.startEpisodeId) ? data.startEpisodeId : eps[0]?.episodeId;
  if (start) {
    const queue: string[] = [start];
    depth.set(start, 0);
    while (queue.length) {
      const cur = queue.shift()!;
      const d = depth.get(cur) ?? 0;
      const node = byId.get(cur);
      if (!node) continue;
      for (const t of outgoingTargets(node)) {
        if (byId.has(t) && !depth.has(t)) {
          depth.set(t, d + 1);
          queue.push(t);
        }
      }
    }
  }
  // 不可达节点排到最右侧一列
  const maxDepth = depth.size ? Math.max(...depth.values()) : 0;
  for (const e of eps) {
    if (!depth.has(e.episodeId)) depth.set(e.episodeId, maxDepth + 1);
  }

  // 按列分组 + 行号
  const cols = new Map<number, string[]>();
  for (const e of eps) {
    const d = depth.get(e.episodeId) ?? 0;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d)!.push(e.episodeId);
  }
  const nodes: GraphNode[] = [];
  let maxRow = 0;
  for (const [d, list] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((id, row) => {
      maxRow = Math.max(maxRow, row);
      nodes.push({
        id,
        episode: byId.get(id)!,
        depth: d,
        row,
        x: PAD_X + d * COL,
        y: PAD_Y + row * ROW,
        reachable: reachable.has(id),
      });
    });
  }

  const edges: GraphEdge[] = [];
  for (const e of eps) {
    for (const it of e.interactions ?? []) {
      for (const o of it.uiConfig?.options ?? []) {
        if (o.nextVideoId && byId.has(o.nextVideoId)) {
          edges.push({ from: e.episodeId, to: o.nextVideoId, label: o.text, kind: "option" });
        }
      }
    }
    if (e.nextVideoId && byId.has(e.nextVideoId)) {
      edges.push({ from: e.episodeId, to: e.nextVideoId, kind: "linear" });
    }
  }

  const width = PAD_X * 2 + (maxDepth + 2) * COL + NODE_W;
  const height = PAD_Y * 2 + (maxRow + 1) * ROW;
  return { nodes, edges, width, height };
}

export const NODE_SIZE = { w: NODE_W, h: NODE_H };

// ── 导出 Story Config v2（下发给播放器的契约） ──────────────────────────────

export interface StoryConfigExport {
  schema: "story-config/v2";
  dramaId: string;
  startEpisodeId: string;
  globalFlags: Record<string, FlagValue>;
  episodes: Array<{
    episodeId: string;
    videoUrl: string | null;
    durationSec: number;
    interactions: Array<{
      triggerTime: number;
      interactionType: string;
      condition?: string;
      uiConfig: {
        question: string;
        countdownSec?: number;
        inputKey?: string;
        placeholder?: string;
        options?: Array<{ id: string; text: string; nextVideoId: string | null; setFlags?: Record<string, FlagValue> }>;
      };
    }>;
    nextVideoId: string | null;
    isEnding: boolean;
    endingLabel?: string;
  }>;
}

/**
 * 把创作端图文档转成下发给社媒平台播放器的 Story Config v2（§1 目标形态）。
 * 只保留播放器消费所需字段，剔除编辑器内部态（videoStatus / videoJobId / synopsis）。
 * 同集互动点按 triggerTime 升序输出（区间触发语义）。
 */
export function buildStoryConfig(dramaId: string, data: InteractiveStoryData): StoryConfigExport {
  return {
    schema: "story-config/v2",
    dramaId,
    startEpisodeId: data.startEpisodeId,
    globalFlags: { ...(data.globalFlags ?? {}) },
    episodes: (data.episodes ?? []).map((e) => ({
      episodeId: e.episodeId,
      videoUrl: e.videoUrl ?? null,
      durationSec: e.durationSec ?? 0,
      interactions: [...(e.interactions ?? [])]
        .sort((a, b) => a.triggerTime - b.triggerTime)
        .map((it) => ({
          triggerTime: it.triggerTime,
          interactionType: it.interactionType,
          ...(it.condition ? { condition: it.condition } : {}),
          uiConfig: {
            question: it.uiConfig.question,
            ...(it.uiConfig.countdownSec ? { countdownSec: it.uiConfig.countdownSec } : {}),
            ...(it.uiConfig.inputKey ? { inputKey: it.uiConfig.inputKey } : {}),
            ...(it.uiConfig.placeholder ? { placeholder: it.uiConfig.placeholder } : {}),
            ...(it.uiConfig.options
              ? {
                  options: it.uiConfig.options.map((o) => ({
                    id: o.id,
                    text: o.text,
                    nextVideoId: o.nextVideoId,
                    ...(o.setFlags && Object.keys(o.setFlags).length ? { setFlags: o.setFlags } : {}),
                  })),
                }
              : {}),
          },
        })),
      nextVideoId: e.nextVideoId ?? null,
      isEnding: e.isEnding,
      ...(e.endingLabel ? { endingLabel: e.endingLabel } : {}),
    })),
  };
}

// ── 试玩走查（创作端验证工具，非播放器运行时） ──────────────────────────────

/** 极简条件判定：仅支持 "globalFlags.X (==|!=|>|<|>=|<=) value"，解析失败按 true（不挡走查）。 */
export function evalCondition(condition: string | undefined, flags: Record<string, FlagValue>): boolean {
  if (!condition || !condition.trim()) return true;
  const m = condition.match(/globalFlags\.([A-Za-z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*(.+)/);
  if (!m) return true;
  const [, key, op, rawRhs] = m;
  const lhs = flags[key];
  let rhs: FlagValue = rawRhs.trim().replace(/^["']|["']$/g, "");
  if (rhs === "true") rhs = true;
  else if (rhs === "false") rhs = false;
  else if (/^-?\d+(\.\d+)?$/.test(rhs)) rhs = Number(rhs);
  switch (op) {
    case "==": return lhs === rhs;
    case "!=": return lhs !== rhs;
    case ">": return Number(lhs) > Number(rhs);
    case "<": return Number(lhs) < Number(rhs);
    case ">=": return Number(lhs) >= Number(rhs);
    case "<=": return Number(lhs) <= Number(rhs);
    default: return true;
  }
}

/** 在试玩中应用一个选项的 setFlags，返回新的 flags（不可变更新）。 */
export function applySetFlags(flags: Record<string, FlagValue>, setFlags?: Record<string, FlagValue>): Record<string, FlagValue> {
  if (!setFlags) return flags;
  return { ...flags, ...setFlags };
}

// ── ProjectData ⇄ Story 视图适配（互动剧 = DramaProject 的形态，不是独立实体） ──────
//
// 剧集（图节点）即项目大纲分集（按 no 标识，episodeId = "ep"+no）；每集视频 = 该集成片
// （episodeDocs[no].assembled）；分支编排叠加层 = ProjectData.interactive。下面两个纯函数把
// 项目文档 ↔ 标准 story 视图互转，让分支画布 / 单集编辑器 / 试玩 / 导出复用同一套 story 组件。

export const epIdForNo = (no: number): string => `ep${no}`;
export const noFromEpId = (id: string): number => {
  const m = /^ep(\d+)$/.exec(id);
  return m ? Number(m[1]) : NaN;
};

/** 项目首个集号（大纲为空时回退 1）。 */
function firstEpisodeNo(data: ProjectData): number {
  return data.episodes?.[0]?.no ?? 1;
}

/** 项目缺省 overlay（刚转换 / 刚建的互动剧）：起始集 = 首集，无标记，各集线性串成链、末集为结局。 */
export function defaultOverlay(data: ProjectData): InteractiveOverlay {
  const eps = data.episodes ?? [];
  const nodes: Record<string, InteractiveNode> = {};
  eps.forEach((o, i) => {
    const last = i === eps.length - 1;
    nodes[epIdForNo(o.no)] = {
      interactions: [],
      nextVideoId: last ? null : epIdForNo(eps[i + 1].no),
      isEnding: last,
      ...(last ? { endingLabel: "大结局" } : {}),
    };
  });
  return { enabled: true, startEpisodeId: epIdForNo(firstEpisodeNo(data)), globalFlags: {}, nodes };
}

/** 项目文档 → 标准 story 视图（合并大纲 + 成片 + overlay）。 */
export function projectToStory(data: ProjectData): InteractiveStoryData {
  const ov = data.interactive ?? defaultOverlay(data);
  const eps = data.episodes ?? [];
  const episodes: InteractiveEpisode[] = eps.map((o) => {
    const episodeId = epIdForNo(o.no);
    const node = ov.nodes?.[episodeId] ?? { interactions: [], nextVideoId: null, isEnding: false };
    const assembled = getEpisodeDoc(data, o.no).assembled;
    return {
      episodeId,
      no: o.no,
      title: o.hook?.trim() || `第 ${o.no} 集`,
      synopsis: o.synopsis ?? "",
      videoUrl: assembled?.url ?? null,
      durationSec: assembled?.durationSec ?? 0,
      videoStatus: assembled?.url ? "ready" : "idle",
      interactions: node.interactions ?? [],
      nextVideoId: node.nextVideoId ?? null,
      isEnding: !!node.isEnding,
      ...(node.endingLabel ? { endingLabel: node.endingLabel } : {}),
    };
  });
  const start = ov.startEpisodeId && episodes.some((e) => e.episodeId === ov.startEpisodeId)
    ? ov.startEpisodeId
    : episodes[0]?.episodeId ?? "";
  return {
    schema: "story-config/v2",
    startEpisodeId: start,
    globalFlags: ov.globalFlags ?? {},
    episodes,
    title: data.projectInfo?.title,
  };
}

/**
 * 标准 story 视图 → 项目文档（写回大纲 hook/synopsis + overlay；按 story.episodes 全量对账：
 * 增/删集即增删大纲与对应 episodeDocs）。story.episodes 是「哪些集存在」的真源。
 */
export function writeStoryToProject(data: ProjectData, story: InteractiveStoryData): ProjectData {
  const prevByNo = new Map((data.episodes ?? []).map((e) => [e.no, e]));
  const outline: EpisodeOutline[] = story.episodes.map((e, i) => {
    const no = Number.isNaN(noFromEpId(e.episodeId)) ? i + 1 : noFromEpId(e.episodeId);
    const prev = prevByNo.get(no);
    return {
      no,
      hook: e.title,
      synopsis: e.synopsis ?? prev?.synopsis ?? "",
      beat: prev?.beat ?? "",
      ...(prev?.locked ? { locked: prev.locked } : {}),
    };
  });
  const nodes: Record<string, InteractiveNode> = {};
  for (const e of story.episodes) {
    nodes[e.episodeId] = {
      interactions: e.interactions,
      nextVideoId: e.nextVideoId ?? null,
      isEnding: e.isEnding,
      ...(e.endingLabel ? { endingLabel: e.endingLabel } : {}),
    };
  }
  // episodeDocs 只保留仍存在的集（删集时一并丢弃其剧本/分镜/成片）。
  const surviving = new Set(outline.map((o) => String(o.no)));
  const episodeDocs = Object.fromEntries(
    Object.entries(data.episodeDocs ?? {}).filter(([k]) => surviving.has(k)),
  );
  return {
    ...data,
    projectInfo: { ...data.projectInfo, episodes: outline.length },
    episodes: outline,
    episodeDocs,
    interactive: {
      enabled: true,
      startEpisodeId: story.startEpisodeId,
      globalFlags: story.globalFlags ?? {},
      nodes,
    },
  };
}
