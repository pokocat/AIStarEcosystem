"use client";
// ============================================================
// 明星形象名片（P2）：授权给我的明星形象详情 —— 授权范围 / 有效期 / 去带货创作。
// 真值在 celebrity 域（只读投影）；申请续期、审批进度都回带货线处理，
// 这里不做任何写操作。使用记录（被用在哪）等带货出片真链路上线后接入。
// ============================================================
import React, { use as usePromise } from "react";
import { AssetApi } from "@/proto/api";
import type { StarGrant } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
import { useHubData } from "@/components/hub/data";
import { AssetPortrait, Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar, RegNo } from "@/components/hub/ui";
import type { BadgeTone } from "@/components/hub/ui";

const CELEBRITY_URL = process.env.NEXT_PUBLIC_CELEBRITY_URL || "https://celebrity.aibuzz.cn";

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  authorized: { label: "授权生效中", tone: "ok" },
  pending: { label: "审批中", tone: "warn" },
  expired: { label: "授权已到期", tone: "err" },
};

export default function StarGrantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [id], ready);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  if (grants.loading) {
    return (
      <HubScreen>
        <NavBar back="/assets" title="明星形象" />
        <LoadingBlock />
      </HubScreen>
    );
  }
  const g = grants.data.find((x) => x.id === id);
  if (grants.error || !g) {
    return (
      <HubScreen>
        <NavBar back="/assets" title="明星形象" />
        <Card style={{ margin: "12px 16px 0" }}>
          <EmptyState text={grants.error || "没有找到这条明星授权"} actionHref="/assets" actionLabel="回资产货架" />
        </Card>
      </HubScreen>
    );
  }

  const st = STATUS_META[g.status] || { label: "未知状态", tone: "mute" as BadgeTone };

  return (
    <HubScreen>
      <NavBar back="/assets" title="明星形象" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card radius={22} pad={16} style={{ display: "flex", gap: 15, boxShadow: "var(--sh-2)" }}>
          <AssetPortrait name={g.starName} imageUrl={g.starAvatar} hue={35} width={96} height={122} radius={17} fontSize={42} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{g.starName}</span>
            <RegNo size={10.5}>{`明星形象 · ${g.starId}${g.category ? ` · ${g.category}` : ""}`}</RegNo>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Badge tone={st.tone} dot>{st.label}</Badge>
              <Badge tone="mute">授权引入</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ margin: "12px 16px 0" }}>
        <Card pad={16}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>授权内容</span>
            <RegNo size={10}>{g.id}</RegNo>
          </div>
          <div style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
              <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>可用场景</span>
              <span style={{ fontWeight: 600, minWidth: 0 }}>{g.scenes.length > 0 ? g.scenes.join("、") : "以授权约定为准"}</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
              <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>有效期至</span>
              <span className="mono" style={{ fontWeight: 600 }}>{g.expireDate || (g.status === "pending" ? "审批通过后确定" : "—")}</span>
            </div>
            {g.availableStyles != null && (
              <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>可用风格</span>
                <span className="mono" style={{ fontWeight: 600 }}>{g.availableStyles} 款</span>
              </div>
            )}
            {g.decidedAt && (
              <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                <span style={{ flexShrink: 0, width: 62, color: "var(--ink-3)" }}>批准时间</span>
                <span className="mono" style={{ fontWeight: 600 }}>{g.decidedAt.slice(0, 10)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div style={{ margin: "16px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {g.status === "authorized" ? (
          <a href={CELEBRITY_URL} style={{ textDecoration: "none", display: "block" }}>
            <div
              style={{
                height: 46,
                borderRadius: "var(--r-md)",
                background: "var(--grad)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(18,179,222,.3)",
              }}
            >
              去带货创作（AI 明星带货）
            </div>
          </a>
        ) : (
          <Card>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
              {g.status === "pending"
                ? "申请已提交，等待明星团队在明星工作台审批。通过后这里会显示可用场景与有效期。"
                : "授权已到期。要继续使用，请到 AI 明星带货里重新发起授权申请。"}
            </span>
          </Card>
        )}
      </div>

      <div style={{ margin: "16px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.6 }}>
        明星授权的申请与审批在带货线和「明星工作台」完成，这里只展示结果。
        <br />
        用它生成的视频记录，将随带货出片链路上线后在这里汇总。
      </div>
    </HubScreen>
  );
}
