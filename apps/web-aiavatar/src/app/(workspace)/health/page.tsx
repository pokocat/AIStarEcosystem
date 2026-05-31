"use client";
// ============================================================
// 能力健康 — Provider 实现来源可观测（任务书 §6.3：GET /api/aiavatar/health/providers）。
// 逐能力展示 mode（mock/后端/自部署）+ 引擎 + 实现类别 + healthcheck，让测试者一眼分辨真实/模拟。
// ============================================================
import * as React from "react";
import { Tag } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { providerHealth, dataSourceMode } from "@/api/ai-avatar";
import { Head } from "../templates/page";

export default function HealthPage() {
  const { data, loading } = useApi(() => providerHealth(), []);
  const rows = data ?? [];
  const mode = dataSourceMode();
  const realCount = rows.filter((r) => r.mode !== "mock").length;
  const mockCount = rows.filter((r) => r.mode === "mock").length;

  return (
    <div className="fade-up" style={{ padding: "28px 36px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <Head kicker="PROVIDER HEALTH" title="能力健康" sub="每类 AI 能力的实现来源（真实 SDK / 后端网关 / Mock）与健康状态，运行时可观测。" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 26 }}>
        <Stat label="数据源" value={mode === "mock" ? "DEV MOCK" : "LIVE 后端"} tone={mode === "mock" ? "var(--warn)" : "var(--ok)"} sub={mode === "mock" ? "本地 mock store · 离线整跑" : "Spring Boot /api/me/aiavatar/*"} />
        <Stat label="真实 / 自部署能力" value={realCount} tone="var(--ok)" sub="走真实算法或模型服务" />
        <Stat label="Mock 能力" value={mockCount} tone="var(--warn)" sub="产出占位资产 · 契约一致可热切换" />
      </div>

      <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.7fr 1.6fr 0.9fr 0.6fr", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>能力</span><span>来源</span><span>引擎 / 方案</span><span>实现类别</span><span>状态</span>
        </div>
        {loading && rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>读取 /aiavatar/health/providers…</div>}
        {rows.map((r) => (
          <div key={r.capability} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.7fr 1.6fr 0.9fr 0.6fr", gap: 16, alignItems: "center", padding: "13px 20px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.capabilityLabel}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{r.capability}</div>
            </div>
            <SourceBadge mode={r.mode} engine={r.mode === "mock" ? "MOCK" : r.engine} />
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-1)" }}>{r.engine}</span>
            <Tag on={r.approach === "关键点算法"}>{r.approach}</Tag>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: r.healthy ? "var(--ok)" : "var(--err)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: r.healthy ? "var(--ok)" : "var(--err)" }} />
              {r.healthy ? "正常" : "异常"}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, display: "flex", alignItems: "flex-start", gap: 10, padding: 16, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
        <Icons.scan size={16} style={{ color: "var(--signal)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <b style={{ color: "var(--ink-1)" }}>几何微调（faceWarp）</b> 始终走真实客户端算法（MediaPipe FaceMesh 478 关键点 + 网格液化形变），确定性、实时、无需 GPU；其余能力 mock 模式产出占位资产但<b style={{ color: "var(--ink-1)" }}>契约与真实路径完全一致</b>，可逐能力热切换。生产环境按 <span className="mono">PROVIDERS.&lt;能力&gt;=backend|selfhost</span> 接入真实模型服务。
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone: string; sub: string }) {
  return (
    <div style={{ padding: 20, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: tone, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
