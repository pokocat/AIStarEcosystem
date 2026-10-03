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
import { episodeContent, episodeTitle, getEpisodeDoc } from "@/mocks/drama-workshop";

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

// v0.197：剧情状态名允许中文（之前正则只认 A-Z0-9_，输入「钥匙」点添加没反应）。
const FLAG_REF = /globalFlags\.([\p{L}\p{N}_]+)/gu;

/** 剧情状态名的合法字符（字母 / 数字 / 下划线，含中文）。 */
export const FLAG_NAME_STRIP = /[^\p{L}\p{N}_]/gu;

/** 界面上显示的集名：有标题用标题，没有就从剧情首句派生，兜底「第 N 集」。 */
export function epDisplayTitle(e: { no: number; title?: string; synopsis?: string }): string {
  const t = (e.title ?? "").trim();
  if (t) return t;
  return episodeTitle({ no: e.no, content: e.synopsis });
}

/** 从 condition 表达式里抽出引用的标记名（用于「引用的标记需先声明」校验）。 */
export function flagsInCondition(condition: string | undefined): string[] {
  if (!condition) return [];
  // 能按标准形状解析就只认左边那个状态名（右边的文字值里写了 "globalFlags.x" 也不算引用）。
  const parsed = parseCondition(condition);
  if (parsed) return [parsed.flag];
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
      errors.push({ level: "error", code: "DUP_EPISODE_ID", message: `有两集的集号重复（第 ${e.no} 集）`, episodeId: e.episodeId });
    }
    ids.add(e.episodeId);
    byId.set(e.episodeId, e);
  }
  if (eps.length === 0) {
    errors.push({ level: "error", code: "NO_EPISODES", message: "还没有任何一集" });
  }
  if (!data.startEpisodeId) {
    errors.push({ level: "error", code: "NO_START", message: "还没设起始集" });
  } else if (!byId.has(data.startEpisodeId)) {
    errors.push({ level: "error", code: "BAD_START", message: "起始集已经删掉了，请重新选一集「设为起始集」" });
  }

  // 至少一个结局
  if (eps.length > 0 && !eps.some((e) => e.isEnding)) {
    errors.push({ level: "error", code: "NO_ENDING", message: "还没有结局集：至少把一集勾成「这一集是结局集」" });
  }

  const reachable = reachableIds(data);
  let hasBranch = false;
  const flagDecl = data.globalFlags ?? {};

  for (const e of eps) {
    const name = epDisplayTitle(e);
    const targets = outgoingTargets(e);
    // 出边目标必须存在
    for (const it of e.interactions ?? []) {
      if ((it.uiConfig?.options?.length ?? 0) > 1) hasBranch = true;
      if (!it.uiConfig?.question?.trim()) {
        errors.push({ level: "error", code: "NO_QUESTION", message: `「${name}」有个互动点还没写问观众什么`, episodeId: e.episodeId });
      }
      const opts = it.uiConfig?.options ?? [];
      if (e.interactions?.length && opts.length === 0 && it.interactionType === "choice") {
        warnings.push({ level: "warning", code: "NO_OPTIONS", message: `「${name}」的互动点还没有选项`, episodeId: e.episodeId });
      }
      for (const o of opts) {
        if (!o.nextVideoId) {
          errors.push({ level: "error", code: "OPTION_DANGLING", message: `「${name}」的选项「${o.text || o.id}」还没连到任何一集`, episodeId: e.episodeId });
        } else if (!byId.has(o.nextVideoId)) {
          errors.push({ level: "error", code: "OPTION_BAD_TARGET", message: `「${name}」的选项「${o.text || o.id}」要去的那一集已经删掉了`, episodeId: e.episodeId });
        }
        // setFlags 引用的标记需先声明
        for (const k of Object.keys(o.setFlags ?? {})) {
          if (!declared.has(k)) {
            errors.push({ level: "error", code: "UNDECLARED_FLAG", message: `「${name}」的选项用到了「${k}」，请先在「剧情状态」里添加它`, episodeId: e.episodeId });
          }
        }
      }
      // condition 引用的标记需先声明
      for (const k of flagsInCondition(it.condition)) {
        if (!declared.has(k)) {
          errors.push({ level: "error", code: "UNDECLARED_FLAG", message: `「${name}」的弹出条件用到了「${k}」，请先在「剧情状态」里添加它`, episodeId: e.episodeId });
        }
      }
      // v0.197 评审 WB6：剧情状态改了类型（比如「是否」改成「数字」）之后，旧条件 / 旧选项值还是原来的类型，
      // 判定永远不成立（=== 不跨类型）。提醒去改，不拦导出。
      const cond = parseCondition(it.condition);
      if (cond && declared.has(cond.flag) && !conditionFitsFlag(cond, flagDecl[cond.flag])) {
        warnings.push({
          level: "warning",
          code: "FLAG_TYPE_MISMATCH",
          message: `「${name}」的弹出条件按旧的写法判断「${cond.flag}」，它现在记的是${FLAG_KIND_LABEL[flagKindOf(flagDecl[cond.flag])]}，要重新设一下`,
          episodeId: e.episodeId,
        });
      }
      for (const o of opts) {
        for (const [k, v] of Object.entries(o.setFlags ?? {})) {
          if (declared.has(k) && flagKindOf(v) !== flagKindOf(flagDecl[k])) {
            warnings.push({
              level: "warning",
              code: "FLAG_TYPE_MISMATCH",
              message: `「${name}」的选项「${o.text || o.id}」记下的「${k}」还是旧的值，它现在记的是${FLAG_KIND_LABEL[flagKindOf(flagDecl[k])]}，要重新填一下`,
              episodeId: e.episodeId,
            });
          }
        }
      }
      // triggerTime ≤ 本集时长（已出片才可严格判定）
      if (e.durationSec > 0 && it.triggerTime > e.durationSec) {
        errors.push({ level: "error", code: "TRIGGER_OVERFLOW", message: `「${name}」的互动点设在第 ${it.triggerTime} 秒弹出，但这一集只有 ${e.durationSec} 秒`, episodeId: e.episodeId });
      }
      if (e.durationSec <= 0 && (e.interactions?.length ?? 0) > 0) {
        warnings.push({ level: "warning", code: "DURATION_UNKNOWN", message: `「${name}」还没成片，暂时核对不了互动点的弹出时间`, episodeId: e.episodeId });
      }
    }
    // 线性续播目标必须存在
    if (e.nextVideoId && !byId.has(e.nextVideoId)) {
      errors.push({ level: "error", code: "NEXT_BAD_TARGET", message: `「${name}」播完要接的那一集已经删掉了`, episodeId: e.episodeId });
    }
    // 非结局集必须有后续（否则断点）
    if (!e.isEnding && targets.length === 0) {
      errors.push({ level: "error", code: "DEAD_END", message: `「${name}」没接上：播完不接下一集，也不是结局集，观众会卡在这里`, episodeId: e.episodeId });
    }
    // 孤立节点（不可达）
    if (eps.length > 1 && !reachable.has(e.episodeId)) {
      warnings.push({ level: "warning", code: "UNREACHABLE", message: `从起始集走不到「${name}」`, episodeId: e.episodeId });
    }
  }

  // 结局可达性
  if (eps.some((e) => e.isEnding) && !eps.some((e) => e.isEnding && reachable.has(e.episodeId))) {
    errors.push({ level: "error", code: "ENDING_UNREACHABLE", message: "从起始集走不到任何一个结局集" });
  }
  // 鼓励分支（纯线性给个温和提示）
  if (eps.length > 1 && !hasBranch) {
    warnings.push({ level: "warning", code: "NO_BRANCH", message: "现在还是一条线走到底，加一个有两个以上选项的互动点才算互动剧" });
  }
  // v0.197：走得到的集里还没成片的，导出后那几集播不了（之前照样说「可以下发」）。
  const noVideo = eps.filter((e) => reachable.has(e.episodeId) && !e.videoUrl);
  if (noVideo.length > 0) {
    warnings.push({
      level: "warning",
      code: "NO_VIDEO",
      message: `还有 ${noVideo.length} 集没成片，导出后这几集播不了`,
      episodeId: noVideo[0].episodeId,
    });
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
          uiConfig: (() => {
            const ui = it.uiConfig ?? {};
            return {
              question: ui.question ?? '',
              ...(ui.countdownSec ? { countdownSec: ui.countdownSec } : {}),
              ...(ui.inputKey ? { inputKey: ui.inputKey } : {}),
              ...(ui.placeholder ? { placeholder: ui.placeholder } : {}),
              ...(ui.options
                ? {
                    options: ui.options.map((o) => ({
                      id: o.id,
                      text: o.text,
                      nextVideoId: o.nextVideoId,
                      ...(o.setFlags && Object.keys(o.setFlags).length ? { setFlags: o.setFlags } : {}),
                    })),
                  }
                : {}),
            };
          })(),
        })),
      nextVideoId: e.nextVideoId ?? null,
      isEnding: e.isEnding,
      ...(e.endingLabel ? { endingLabel: e.endingLabel } : {}),
    })),
  };
}

// ── 试玩走查（创作端验证工具，非播放器运行时） ──────────────────────────────

export type ConditionOp = "==" | "!=" | ">=" | "<=" | ">" | "<";

export interface ParsedCondition {
  flag: string;
  op: ConditionOp;
  value: FlagValue;
}

const NUMBER_LITERAL = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * 条件右边的值。与 buildCondition 互逆（v0.197 评审 WB5）：
 * 文字值由 buildCondition 用 JSON.stringify 写成双引号串，这里就用 JSON.parse 还原 ——
 * 之前只去掉首尾引号、不反转义，值里有引号或反斜杠时（如 `他说"好"`）读回来多了反斜杠，试玩判定永远不成立。
 * 单引号串是老数据手写的 JS 写法，只还原 \' 与 \\；裸词（老数据 `== abc`）原样当文字。
 */
function parseConditionValue(raw: string): FlagValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (NUMBER_LITERAL.test(raw)) return Number(raw);
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const v: unknown = JSON.parse(raw);
      if (typeof v === "string") return v;
    } catch {
      /* 不是合法的双引号串：按旧规则只去掉首尾引号 */
    }
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/\\(['\\])/g, "$1");
  }
  return raw.replace(/^["']|["']$/g, "");
}

/**
 * 解析 "globalFlags.X (==|!=|>|<|>=|<=) value"（导出契约里 condition 的形状，不改）。
 * 解析不了返回 null。v0.197：编辑器用它把条件拆成下拉，创作者不再手写表达式。
 * 带 s 标志：文字值里的换行 / 段落分隔符（JSON.stringify 不转义 U+2028）也要能匹配上。
 */
export function parseCondition(condition: string | undefined): ParsedCondition | null {
  if (!condition || !condition.trim()) return null;
  const m = condition.match(/^\s*globalFlags\.([\p{L}\p{N}_]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/su);
  if (!m) return null;
  const [, flag, op, rawRhs] = m;
  return { flag, op: op as ConditionOp, value: parseConditionValue(rawRhs.trim()) };
}

/** parseCondition 的逆：拼回导出契约里的 condition 字符串。 */
export function buildCondition(c: ParsedCondition): string {
  const v = typeof c.value === "string" ? JSON.stringify(c.value) : String(c.value);
  return `globalFlags.${c.flag} ${c.op} ${v}`;
}

// ── 剧情状态的类型（是否 / 数字 / 文字） ─────────────────────────────────────

export type FlagKind = "boolean" | "number" | "string";

export function flagKindOf(v: FlagValue): FlagKind {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  return "string";
}

/** 界面上对类型的叫法（与剧情状态面板里「记的是什么」下拉一致）。 */
export const FLAG_KIND_LABEL: Record<FlagKind, string> = { boolean: "是否", number: "数字", string: "文字" };

/** 每种类型能用的比较方式：数字能比大小，是否 / 文字只有等于 / 不等于。 */
export function opsForFlagKind(kind: FlagKind): readonly ConditionOp[] {
  return kind === "number" ? (["==", "!=", ">", "<", ">=", "<="] as const) : (["==", "!="] as const);
}

/** 条件的写法和状态现在的类型对不对得上（值的类型一致、比较方式这种类型能用）。 */
export function conditionFitsFlag(c: ParsedCondition, declared: FlagValue): boolean {
  const kind = flagKindOf(declared);
  return flagKindOf(c.value) === kind && opsForFlagKind(kind).includes(c.op);
}

/** 某个剧情状态在哪几处被用到（弹出条件 / 选项记下 / 填空记录），删之前告诉创作者。 */
export interface FlagUsage {
  episodeId: string;
  kind: "condition" | "setFlags" | "inputKey";
  /** 界面上怎么说这一处，如「第 2 集「门厅」的弹出条件」。 */
  label: string;
  /** 这一处还是按改类型之前的写法填的（值的类型 / 比较方式对不上），要重新设。 */
  stale: boolean;
}

export function flagUsages(data: InteractiveStoryData, flag: string): FlagUsage[] {
  const out: FlagUsage[] = [];
  const flags = data.globalFlags ?? {};
  const declared = Object.prototype.hasOwnProperty.call(flags, flag);
  for (const e of data.episodes ?? []) {
    const where = `第 ${e.no} 集「${epDisplayTitle(e)}」`;
    for (const it of e.interactions ?? []) {
      if (flagsInCondition(it.condition).includes(flag)) {
        const cond = parseCondition(it.condition);
        out.push({
          episodeId: e.episodeId,
          kind: "condition",
          label: `${where}的弹出条件`,
          stale: declared && !!cond && !conditionFitsFlag(cond, flags[flag]),
        });
      }
      if (it.uiConfig?.inputKey === flag) {
        out.push({ episodeId: e.episodeId, kind: "inputKey", label: `${where}记录观众填的内容`, stale: false });
      }
      for (const o of it.uiConfig?.options ?? []) {
        if (o.setFlags && Object.prototype.hasOwnProperty.call(o.setFlags, flag)) {
          out.push({
            episodeId: e.episodeId,
            kind: "setFlags",
            label: `${where}的选项「${o.text || o.id}」`,
            stale: declared && flagKindOf(o.setFlags[flag]) !== flagKindOf(flags[flag]),
          });
        }
      }
    }
  }
  return out;
}

/** 极简条件判定：仅支持 "globalFlags.X (==|!=|>|<|>=|<=) value"，解析失败按 true（不挡走查）。 */
export function evalCondition(condition: string | undefined, flags: Record<string, FlagValue>): boolean {
  if (!condition || !condition.trim()) return true;
  const parsed = parseCondition(condition);
  if (!parsed) return true;
  const { flag: key, op } = parsed;
  const lhs = flags[key];
  const rhs: FlagValue = parsed.value;
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
      // v0.197：用原始标题，不用 episodeTitle() 派生的截断版 —— 之前派生出来的「废土追猎中,凌霄掌心第一…」
      // 会在第一次保存时被 writeStoryToProject 当成标题写回大纲。显示时用 epDisplayTitle() 兜底。
      title: o.title ?? "",
      synopsis: episodeContent(o),
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
    const prevContent = prev ? episodeContent(prev) : "";
    const title = (e.title ?? "").trim();
    const content = e.synopsis ?? prevContent;
    // 没改过的集原样保留（不改写旧数据的 hook / synopsis 结构）。
    if (prev && title === (prev.title ?? "").trim() && content === prevContent) return { ...prev, no };
    return {
      no,
      ...(title ? { title } : {}),
      content,
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
