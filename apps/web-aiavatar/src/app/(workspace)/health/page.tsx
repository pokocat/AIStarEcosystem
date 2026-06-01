"use client";

// 能力状态（配套工具）：每能力 mode + 实现来源 + 健康，一眼分辨 mock / 真实。
import * as React from "react";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import type { AiAvatarProviderHealth } from "@ai-star-eco/types/ai-avatar";
import { AiAvatarApi, USE_MOCK } from "@/api";

export default function HealthPage() {
  const [items, setItems] = React.useState<AiAvatarProviderHealth[] | null>(null);

  React.useEffect(() => { AiAvatarApi.providerHealth().then(setItems).catch(() => setItems([])); }, []);

  const realCount = (items ?? []).filter((i) => i.mode !== "mock").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Activity className="h-5 w-5 text-[var(--brand-strong)]" /> 能力状态</h1>
        <p className="mt-0.5 text-sm text-[var(--fg-2)]">
          每个能力当前的实现来源与健康。{USE_MOCK ? "当前前端为 mock 模式" : "当前调用真实后端"} ·
          真实方案 <span className="num font-semibold text-[var(--fg-0)]">{realCount}</span> / <span className="num">{items?.length ?? 0}</span>
        </p>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2.5 text-xs leading-relaxed text-[var(--fg-2)]">
        <span className="src-badge mr-1" data-mock="true">MOCK</span> = 演示占位（与真实路径同契约，可一键切换）；
        <span className="src-badge mx-1" data-mock="false"><span className="dot" style={{ background: "var(--success)" }} />REAL</span> = 已接真实方案。
        几何形变（faceWarp）即便在 dev 也走真实确定性算法。后端可观测端点：<span className="num">GET /api/aiavatar/health/providers</span>
      </div>

      {items === null ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--bg-2)]" />)}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-2)] text-left text-xs text-[var(--fg-2)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">能力</th>
                <th className="px-4 py-2.5 font-medium">来源</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">引擎 / 方案</th>
                <th className="px-4 py-2.5 font-medium">健康</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isMock = it.mode === "mock";
                return (
                  <tr key={it.capability} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--fg-0)]">{it.capabilityLabel}</div>
                      <div className="num text-[10px] text-[var(--fg-3)]">{it.capability}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="src-badge" data-mock={isMock ? "true" : "false"}>
                        {!isMock && <span className="dot" style={{ background: "var(--success)" }} />}
                        {isMock ? "MOCK" : (it.mode ?? "").toUpperCase()}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="text-[var(--fg-1)]">{it.engine}</div>
                      <div className="text-[11px] text-[var(--fg-3)]">{it.approach}</div>
                    </td>
                    <td className="px-4 py-3">
                      {it.healthy ? (
                        <span className="flex items-center gap-1 text-[var(--success)]"><CheckCircle2 className="h-4 w-4" /> 正常</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[var(--danger)]"><XCircle className="h-4 w-4" /> {it.message}</span>
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
