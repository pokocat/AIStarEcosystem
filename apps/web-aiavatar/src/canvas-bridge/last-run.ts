// ─────────────────────────────────────────────────────────────────────────────
// 「这次到底发给模型什么」—— 最近一次出图的真实入参。
//
// 为什么要有这个：画布上用户只写自己那段提示词，实际发出去的还包着服务端的模板
// （身份锚句、参考图编号说明、构图与负面词），参考图也可能因为读不到而被跳过。
// 出来的图不对劲时，这两件事是仅有的排查入口，而此前界面上一个字都看不到 ——
// 于是「像不像参考图」只能靠猜。真实排障里为这件事来回折腾了一整天。
//
// 服务端本来就把它们放在运行记录里（IpRun.inputs.prompt / inputs.refs），
// 这里只是把最近一次留在内存里给顶栏用；不落库、不进画布文档。
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { IpRun } from "./api";

export type LastRun = {
  id: string;
  at: number;
  /** 实际送进模型的完整提示词（含服务端模板部分） */
  prompt: string;
  /** 每张参考图有没有真的用上 */
  refs: { note: string; applied: boolean; reason?: string }[];
  size?: string;
  count?: number;
};

type Store = { last: LastRun | null; set: (r: LastRun | null) => void };

export const useLastRun = create<Store>((set) => ({
  last: null,
  set: (last) => set({ last }),
}));

/** 一次运行结束后记一笔。字段缺失就当没有，绝不编。 */
export function recordRun(run: IpRun): void {
  const inputs = run.inputs ?? {};
  useLastRun.getState().set({
    id: run.id,
    at: Date.now(),
    prompt: inputs.prompt ?? "",
    refs: (inputs.refs ?? []).map((r) => ({
      note: r.note?.trim() || "参考图",
      applied: !!r.applied,
      reason: r.reason,
    })),
    size: inputs.size,
    count: inputs.count,
  });
}
