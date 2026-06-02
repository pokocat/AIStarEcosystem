// 六阶段定义 — 设计真源:components.jsx `STAGES`。
// 项目阶段(跨集共享) 1-3 + 剧集阶段(针对当前集) 4-6。
import type { LucideIcon } from "lucide-react";
import { Clapperboard, Film, Layers, List, Package, Sparkles, Users } from "lucide-react";

export type StageKey = "topic" | "outline" | "cast" | "script" | "board" | "prompt";

export interface StageDef {
  key: StageKey;
  no: number;
  name: string;
  scope: "项目" | "剧集";
  scopeHint: string; // "跨集共享" / "针对当前集"
  icon: LucideIcon;
  /** 阶段消耗的预估积分(连跑总预算用) */
  cost: number;
}

export const STAGES: readonly StageDef[] = [
  { key: "topic",   no: 1, name: "选题立项",     scope: "项目", scopeHint: "跨集共享",   icon: Sparkles,    cost: 6  },
  { key: "outline", no: 2, name: "大纲分集",     scope: "项目", scopeHint: "跨集共享",   icon: List,        cost: 18 },
  { key: "cast",    no: 3, name: "角色与资产", scope: "项目", scopeHint: "跨集共享",   icon: Users,       cost: 5  },
  { key: "script",  no: 4, name: "单集剧本",     scope: "剧集", scopeHint: "针对当前集", icon: Layers,      cost: 22 },
  { key: "board",   no: 5, name: "分镜工作台", scope: "剧集", scopeHint: "针对当前集", icon: Film,        cost: 26 },
  { key: "prompt",  no: 6, name: "成片配方",     scope: "剧集", scopeHint: "针对当前集", icon: Package,     cost: 14 },
] as const;

export const STAGE_NAMES = STAGES.map((s) => s.name);

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
