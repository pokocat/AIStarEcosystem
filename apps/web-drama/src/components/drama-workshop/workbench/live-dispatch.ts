"use client";

// 「现在挂着的那个工作台」的 dispatch（v0.197 复核）。
//
// 重新生成角色、画定妆照这类要等几秒的操作，结果回来时发起它的那个组件可能已经卸载：
// 用户切去逐集制作再切回来、或者回到列表又点进同一部 —— 界面上是一个**新的**工作台 reducer。
// 用发起时闭包里的 dispatch，结果落到旧 reducer 上，新界面还是旧角色；之后在新界面上绑一下数字人，
// 角色自动保存就把旧角色整表写回去，这次扣的积分白花。
// 结果文档本身由 ctx.patchData 落库（doc-store.ts 保证合并到同一份最新文档上）；这里只负责让屏幕跟上。
import * as React from "react";
import type { WorkshopAction } from "./workshop-shell";

const live = new Map<string, React.Dispatch<WorkshopAction>>();

/** WorkshopShell 挂载时登记自己的 dispatch，卸载时撤掉（只撤自己登记的那个）。 */
export function useRegisterWorkbenchDispatch(projectId: string, dispatch: React.Dispatch<WorkshopAction>): void {
  React.useEffect(() => {
    if (!projectId) return;
    live.set(projectId, dispatch);
    return () => {
      if (live.get(projectId) === dispatch) live.delete(projectId);
    };
  }, [projectId, dispatch]);
}

/**
 * 发给这部短剧现在挂着的工作台；没有登记的（比如单独渲染阶段组件）就用调用方自己的 fallback。
 * 用户已经离开工作台时 fallback 是个已卸载的 reducer，什么都不会发生 —— 落库那一步不靠它。
 */
export function dispatchToWorkbench(
  projectId: string | undefined,
  action: WorkshopAction,
  fallback: React.Dispatch<WorkshopAction>,
): void {
  const d = projectId ? live.get(projectId) : undefined;
  (d ?? fallback)(action);
}
