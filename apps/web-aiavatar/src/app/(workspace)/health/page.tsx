"use client";

// 能力健康（任务书 §6.3 GET /api/health/providers）：每能力 mode + 实现来源 + 健康，前端一眼分辨 mock/真实。
import * as React from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import type { AiAvatarProviderHealth } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi, USE_MOCK } from "@/api";

export default function HealthPage() {
  const [items, setItems] = React.useState<AiAvatarProviderHealth[] | null>(null);

  React.useEffect(() => { AiAvatarApi.providerHealth().then(setItems).catch(() => setItems([])); }, []);

  const realCount = (items ?? []).filter((i) => i.mode !== "mock").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Activity className="h-5 w-5 text-amber-400" /> 能力健康</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          每个能力当前的实现来源与健康。{USE_MOCK ? "当前前端为 mock 模式" : "当前调用真实后端"} ·
          真实方案 <span className="font-mono text-amber-400">{realCount}</span> / {items?.length ?? 0}
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300/90">
        <b>MOCK</b> = 演示占位（与真实路径同契约，可一键切换）；<b>非 MOCK</b> = 已接真实方案。
        几何形变（faceWarp）即便在 dev 也走真实确定性算法。后端可观测端点：<span className="font-mono">GET /api/aiavatar/health/providers</span>
      </div>

      {items === null ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-800/50" />)}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-2)] text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">能力</th>
                <th className="px-4 py-2.5 font-medium">来源</th>
                <th className="px-4 py-2.5 font-medium">引擎 / 方案</th>
                <th className="px-4 py-2.5 font-medium">健康</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isMock = it.mode === "mock";
                return (
                  <tr key={it.capability} className="border-t border-zinc-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100">{it.capabilityLabel}</div>
                      <div className="font-mono text-[10px] text-zinc-600">{it.capability}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                        isMock ? "border-amber-500 bg-amber-500/15 text-amber-400" : "border-emerald-500/60 bg-emerald-500/10 text-emerald-400")}>
                        {isMock ? "MOCK" : (it.mode ?? "").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-300">{it.engine}</div>
                      <div className="text-[11px] text-zinc-500">{it.approach}</div>
                    </td>
                    <td className="px-4 py-3">
                      {it.healthy ? (
                        <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-4 w-4" /> 正常</span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-400"><XCircle className="h-4 w-4" /> {it.message}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
