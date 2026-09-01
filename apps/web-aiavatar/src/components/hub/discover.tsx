"use client";
// ============================================================
// 发现（2026-09-01 五 Tab 定案）：官方可授权角色名录。
//   官方资产 = 普通资产 + 上架标记，复用既有「数字人广场」（scope=public）。
//   明星形象走既有明星端申请，这里只做入口，不复制一套审批。
// 授权本身尚未打通：卡片只标「可授权」不标价 —— 价格字段还不存在，不编造（§3.3）。
// ============================================================
import React from "react";
import Link from "next/link";
import { AvatarApi } from "@/proto/api";
import type { Avatar } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useHubData } from "@/components/hub/data";
import { OfficialCard } from "@/components/hub/asset-cards";

const CELEBRITY_URL = process.env.NEXT_PUBLIC_CELEBRITY_URL || "https://celebrity.aibuzz.cn";
import { Card, Chevron, EmptyState, HubScreen, LoadingBlock, NavBar, SectionHeader } from "@/components/hub/ui";

export function Discover() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  const official = useHubData<Avatar[]>(() => AvatarApi.list("public"), [], [], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  return (
    <HubScreen tabBar>
      <NavBar title="发现" />

      <div style={{ margin: "6px 16px 0" }}>
        <SectionHeader title="官方角色" hint="授权后可用于出片" count={official.loading || official.error ? undefined : official.data.length} />
        {official.loading ? (
          <LoadingBlock label="官方资产加载中" />
        ) : official.error ? (
          <Card>
            <EmptyState text={`官方资产加载失败：${official.error}`} />
          </Card>
        ) : official.data.length === 0 ? (
          <Card>
            <EmptyState text="暂时还没有上架的官方角色" />
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {official.data.map((c) => (
              <OfficialCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>

      <div style={{ margin: "20px 16px 0" }}>
        <SectionHeader title="明星形象" hint="授权与审批在明星端办理" />
        <Card pad={0}>
          <Link
            href={CELEBRITY_URL}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, textDecoration: "none", color: "inherit" }}
          >
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>去申请明星形象授权</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                明星本人与团队在带货端审批，通过后形象会出现在你的资产里
              </span>
            </div>
            <Chevron />
          </Link>
        </Card>
      </div>
    </HubScreen>
  );
}
