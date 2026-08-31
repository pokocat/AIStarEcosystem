"use client";
// ============================================================
// 授权中心（P2 双向）：
//   授权给我的 —— 明星形象授权（celebrity 域只读投影；申请审批走带货线 + 明星工作台）
//   我授权出去的 —— 本人真人授权 / IP 授权登记（dap 域 License）
// ============================================================
import React, { useState } from "react";
import Link from "next/link";
import { AssetApi, LicenseApi } from "@/proto/api";
import type { License, StarGrant } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar, RegNo } from "@/components/hub/ui";
import type { BadgeTone } from "@/components/hub/ui";

const LICENSE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "生效中", tone: "ok" },
  pending: { label: "办理中", tone: "warn" },
  expired: { label: "已到期", tone: "err" },
};

const GRANT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  authorized: { label: "生效中", tone: "ok" },
  pending: { label: "审批中", tone: "warn" },
  expired: { label: "已到期", tone: "err" },
};

function GrantCard({ g }: { g: StarGrant }) {
  const st = GRANT_STATUS[g.status] || { label: "未知状态", tone: "mute" as BadgeTone };
  return (
    <Link href={`/stars/${g.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card pad={16}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
          <RegNo size={10}>{`STAR GRANT · ${g.id}`}</RegNo>
          <Badge tone={st.tone} dot>{st.label}</Badge>
        </div>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 600 }}>{g.starName} · 明星形象</span>
        <div style={{ borderTop: "1px dashed var(--line-2)", marginTop: 10, paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
            <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>可用场景</span>
            <span style={{ fontWeight: 600, minWidth: 0 }}>{g.scenes.length > 0 ? g.scenes.join("、") : "以授权约定为准"}</span>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
            <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>有效期至</span>
            <span className="mono" style={{ fontWeight: 600 }}>{g.expireDate || (g.status === "pending" ? "审批通过后确定" : "—")}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function LicenseCard({ l }: { l: License }) {
  // 未知枚举不把原值当可视文案（CLAUDE.md 文案红线）
  const st = LICENSE_STATUS[l.status] || { label: "未知状态", tone: "mute" as BadgeTone };
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
  const noPlatform = authState === "no-platform";
  const [tab, setTab] = useState<"granted" | "issued">("granted");
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const segBtn = (key: "granted" | "issued", label: string) => {
    const on = tab === key;
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        style={{
          flex: 1,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: on ? "var(--surface)" : "transparent",
          color: on ? "var(--ink)" : "var(--ink-3)",
          border: "none",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: on ? 700 : 600,
          boxShadow: on ? "var(--sh-1)" : "none",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <HubScreen>
      <NavBar back="/me" title="授权中心" />

      <div style={{ margin: "8px 16px 0", display: "flex", background: "var(--surface-3)", padding: 3, borderRadius: 999 }}>
        {segBtn("granted", "授权给我的")}
        {segBtn("issued", "我授权出去的")}
      </div>

      {tab === "granted" ? (
        <>
          <div style={{ margin: "14px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {grants.loading ? (
              <LoadingBlock />
            ) : grants.error ? (
              <Card>
                <EmptyState text={grants.error} />
              </Card>
            ) : grants.data.length === 0 ? (
              <Card>
                <EmptyState text="还没有授权给你的明星形象。到 AI 明星带货里挑选明星并发起授权申请，通过后会出现在这里" />
              </Card>
            ) : (
              grants.data.map((g) => <GrantCard key={g.id} g={g} />)
            )}
          </div>
          <div style={{ margin: "16px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
            明星授权的申请与审批在带货线和「明星工作台」完成，这里只看结果和授权内容。
          </div>
        </>
      ) : (
        <>
          <div style={{ margin: "14px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
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
            这里是你作为真人 / IP 权利人授权平台使用的登记与证书。
          </div>
        </>
      )}
    </HubScreen>
  );
}
