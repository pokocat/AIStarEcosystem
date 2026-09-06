// ─────────────────────────────────────────────────────────────────────────────
// module-notice.tsx — 「后端还没建好」的诚实提示条。
//
// 背景（2026-09-06）：制作工坊的四个面板（数字资产库 / 切片制作台 / AI 数字人 /
// 混剪批量）在 `specs/openapi.yaml` 里登记了接口，但 server 从未实现。此前这些面板
// 把 `@/mocks/*` 的演示数据当初始 state，真接口失败又被 `.catch(() => {})` 吞掉，
// 于是**生产环境上给用户看的是假记录**（还带着「合作方」「今日完成」等具体数字）。
// v0.149 的开通闸让这些请求从静默 404 变成 403 PRODUCT_ROUTE_UNMAPPED，
// 顺带把这件事暴露出来。
//
// 按 AGENTS.md §8.0（生产模式禁止静默降级）：不能拿假内容冒充真产物。
// 所以改成 —— 演示数据只在 USE_MOCK 下用；真环境拿不到数据就空着，并明确说明原因。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Loader2, Hammer } from "lucide-react";

export type ModuleState = "loading" | "ready" | "unavailable";

export function ModuleNotice({ state, name }: { state: ModuleState; name: string }) {
  if (state === "ready") return null;

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>正在载入{name}…</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
      <Hammer className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        {name}还在建设中，暂时没有数据可以展示。
        <span className="text-amber-300/70">（界面已经就位，等后端接口上线后这里会自动出现你的真实数据）</span>
      </span>
    </div>
  );
}
