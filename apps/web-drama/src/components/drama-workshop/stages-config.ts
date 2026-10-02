// 阶段定义 — 设计真源 v4 app-v4.jsx `STAGES_V3`:
// 项目设置(跨集共享)1-3 + 剧集制作(逐集推进)4-6。
// v4 变化:单集剧本 + 分镜工作台合并为「剧集脚本」;新增「视频工厂」(渲染出片)。
import type { LucideIcon } from "lucide-react";
import { Clapperboard, Film, List, Network, Package, Sparkles, Users } from "lucide-react";

// v0.79：branch = 互动剧专属「互动编排」阶段（scope="互动"，仅互动剧项目显示，不进 1-6 线性流）。
// v0.97：删「视频工厂」独立阶段 —— 逐镜出片收敛进「剧集脚本」分镜表（脚本表=唯一逐镜工作面）。
export type StageKey = "topic" | "outline" | "cast" | "epscript" | "prompt" | "branch";

export interface StageDef {
  key: StageKey;
  no: number;
  name: string;
  scope: "项目" | "剧集" | "互动";
  scopeHint: string; // "所有集通用" / "只改这一集"
  /** 集内步骤的副标题(剧集阶段用) */
  sub?: string;
  icon: LucideIcon;
  /** 阶段消耗的预估积分(连跑总预算用) */
  cost: number;
}

export const STAGES: readonly StageDef[] = [
  // v0.197：topic / outline / cast 在工作台里早已合并成「短剧设定」一页（v0.88），
  // 对外一律叫「短剧设定」（项目卡、首页「上次做到」都走 stageNameByNo）。key 不改。
  { key: "topic",    no: 1, name: "短剧设定", scope: "项目", scopeHint: "所有集通用", icon: Sparkles,  cost: 6 },
  { key: "outline",  no: 2, name: "短剧设定", scope: "项目", scopeHint: "所有集通用", icon: List,      cost: 18 },
  { key: "cast",     no: 3, name: "短剧设定", scope: "项目", scopeHint: "所有集通用", icon: Users,     cost: 5 },
  // v0.197：逐集制作两步 ① 分镜 ② 合成成片（docs/drama-ux-copy-pass.md §2.2）。
  { key: "epscript", no: 4, name: "分镜", scope: "剧集", scopeHint: "只改这一集", sub: "逐镜出首帧和视频", icon: Film,    cost: 30 },
  // v0.66：原「成片配方」退役 —— 分镜已真实出片，最后一步只需拼接交付（key 保留避免大改）
  // v0.97：原「视频工厂」阶段删除，逐镜出片并入「剧集脚本」分镜表；本阶段前移为剧集第 2 步。
  { key: "prompt",   no: 5, name: "合成成片", scope: "剧集", scopeHint: "只改这一集", sub: "把镜头视频拼成完整一集", icon: Package,  cost: 0 },
  // v0.79：互动剧分支编排（剧集图 + 时间轴互动点 + 全局标记 + 试玩 + 导出）。no=0 表示不在 1-6 线性进度里；
  // stageNameByNo(1..6) 仍按数组前 6 项映射，本项 append 在末位不影响。
  { key: "branch",   no: 0, name: "互动编排", scope: "互动", scopeHint: "剧集分支图", sub: "分支图 · 互动点 · 结局", icon: Network, cost: 18 },
] as const;

export const STAGE_NAMES = STAGES.map((s) => s.name);

/** 剧集内三步(顶部步骤页签用) */
export const EP_STEPS = STAGES.filter((s) => s.scope === "剧集");

/** 剧集阶段集合 */
export const EPISODE_STAGE_KEYS: StageKey[] = EP_STEPS.map((s) => s.key);

export const STAGE_BY_KEY: Record<StageKey, StageDef> = STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s;
    return acc;
  },
  {} as Record<StageKey, StageDef>,
);

/** 线性阶段（no>0，排除 no:0 的互动编排）。 */
const LINEAR_STAGES = STAGES.filter((s) => s.no > 0);

/** 以序号取阶段名（ProjectCard/首页等用）。按 no 精确匹配线性阶段；
 *  v0.98 删「视频工厂」后 no 从 6 收为 5，老数据 stage=5(原视频工厂)/6(原成片合成)
 *  统一归一到「合成成片」，避免落到 no:0 的「互动编排」而误标。 */
export function stageNameByNo(no: number): string {
  const hit = LINEAR_STAGES.find((s) => s.no === no);
  if (hit) return hit.name;
  if (no >= LINEAR_STAGES.length) return STAGE_BY_KEY.prompt.name; // 老数据 ≥5 → 合成成片
  return LINEAR_STAGES[0]?.name ?? "短剧设定";
}

/** 留给 Clapperboard 入口(workspace logo) */
export { Clapperboard };
