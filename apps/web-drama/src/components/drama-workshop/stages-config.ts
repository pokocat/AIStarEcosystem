// 阶段定义 — 设计真源 v4 app-v4.jsx `STAGES_V3`:
// 项目设置(跨集共享)1-3 + 剧集制作(逐集推进)4-6。
// v4 变化:单集剧本 + 分镜工作台合并为「剧集脚本」;新增「视频工厂」(渲染出片)。
import type { LucideIcon } from "lucide-react";
import { Clapperboard, Film, Image as ImageIcon, List, Network, Package, Sparkles, Users } from "lucide-react";

// v0.79：branch = 互动剧专属「互动编排」阶段（scope="互动"，仅互动剧项目显示，不进 1-6 线性流）。
export type StageKey = "topic" | "outline" | "cast" | "epscript" | "factory" | "prompt" | "branch";

export interface StageDef {
  key: StageKey;
  no: number;
  name: string;
  scope: "项目" | "剧集" | "互动";
  scopeHint: string; // "跨集共享" / "针对当前集"
  /** 集内步骤的副标题(剧集阶段用) */
  sub?: string;
  icon: LucideIcon;
  /** 阶段消耗的预估积分(连跑总预算用) */
  cost: number;
}

export const STAGES: readonly StageDef[] = [
  { key: "topic",    no: 1, name: "选题立项", scope: "项目", scopeHint: "跨集共享",   icon: Sparkles,  cost: 6 },
  { key: "outline",  no: 2, name: "大纲分集", scope: "项目", scopeHint: "跨集共享",   icon: List,      cost: 18 },
  { key: "cast",     no: 3, name: "角色与资产", scope: "项目", scopeHint: "跨集共享", icon: Users,     cost: 5 },
  { key: "epscript", no: 4, name: "剧集脚本", scope: "剧集", scopeHint: "针对当前集", sub: "剧本 + 分镜", icon: Film,    cost: 30 },
  { key: "factory",  no: 5, name: "视频工厂", scope: "剧集", scopeHint: "针对当前集", sub: "渲染出片",   icon: ImageIcon, cost: 0 },
  // v0.66：原「成片配方」退役 —— 分镜已真实出片，最后一步只需拼接交付（key 保留避免大改）
  { key: "prompt",   no: 6, name: "成片合成", scope: "剧集", scopeHint: "针对当前集", sub: "拼接完整片", icon: Package,  cost: 0 },
  // v0.79：互动剧分支编排（剧集图 + 时间轴互动点 + 全局标记 + 试玩 + 导出）。no=0 表示不在 1-6 线性进度里；
  // stageNameByNo(1..6) 仍按数组前 6 项映射，本项 append 在末位不影响。
  { key: "branch",   no: 0, name: "互动编排", scope: "互动", scopeHint: "剧集分支图", sub: "分支 / 互动 / 结局", icon: Network, cost: 18 },
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

/** 让 ProjectCard 等组件以序号取得阶段名 */
export function stageNameByNo(no: number): string {
  return STAGES[no - 1]?.name ?? "选题立项";
}

/** 留给 Clapperboard 入口(workspace logo) */
export { Clapperboard };
