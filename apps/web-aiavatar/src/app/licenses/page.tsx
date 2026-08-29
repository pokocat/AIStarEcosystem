"use client";
// ============================================================
// 授权中心（P1）：我的授权登记列表 + 证书查看。
// 双向视图（授权给我的 / 我授权出去的）等 P2 接入明星授权数据后再拆
// —— 现阶段 server 只有本人真人授权 / IP 授权，如实按一列展示。
// ============================================================
import React from "react";
import { LicenseApi } from "@/proto/api";
import type { License } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar, RegNo } from "@/components/hub/ui";
import type { BadgeTone } from "@/components/hub/ui";

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "生效中", tone: "ok" },
  pending: { label: "办理中", tone: "warn" },
  expired: { label: "已到期", tone: "err" },
};

function LicenseCard({ l }: { l: License }) {
  // 未知枚举不把原值当可视文案（CLAUDE.md 文案红线）
  const st = STATUS_META[l.status] || { label: "未知状态", tone: "mute" as BadgeTone };
  const needsSupplement = l.evidenceStatus === "legacy_unconfirmed";
  return (
    <Card pad={16} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <RegNo size={10}>{`LICENSE · ${l.id}`}</RegNo>
        {needsSupplement ? <Badge tone="warn" dot>待补确认</Badge> : <Badge tone={st.tone} dot>{st.label}</Badge>}
      </div>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600, marginBottom: 10 }}>{l.subject}</span>
      <div style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
          <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>可用范围</span>
          <span style={{ fontWeight: 600, minWidth: 0 }}>{l.scope}</span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
          <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>有效期</span>
          <span className="mono" style={{ fontWeight: 600 }}>{l.period}</span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
          <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>核验方式</span>
          <span style={{ fontWeight: 600 }}>
            {l.verifyMethod === "liveness" ? "平台协议确认 + 本人刷脸核验" : "书面授权登记"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <a
          href={studioHref("#/licenses")}
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary-700)", textDecoration: "none" }}
        >
          {needsSupplement ? "去补确认 ›" : "查看证书 ›"}
        </a>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>登记于 {l.signed}</span>
      </div>
    </Card>
  );
}

export default function LicensesPage() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  return (
    <HubScreen>
      <NavBar back="/me" title="授权中心" />
      <div style={{ margin: "8px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {licenses.loading ? (
          <LoadingBlock />
        ) : licenses.error ? (
          <Card>
            <EmptyState text={licenses.error} />
          </Card>
        ) : licenses.data.length === 0 ? (
          <Card>
            <EmptyState
              text="还没有授权记录。真人数字人完成协议确认与刷脸核验后，证书会出现在这里"
              actionHref={studioHref("#/realmaterials")}
              actionLabel="去真人授权"
            />
          </Card>
        ) : (
          licenses.data.map((l) => <LicenseCard key={l.id} l={l} />)
        )}
      </div>
      <div style={{ margin: "16px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
        明星形象授权（申请 / 审批在「明星工作台」完成）将在第二期接入这里。
      </div>
    </HubScreen>
  );
}
