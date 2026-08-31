"use client";
// ============================================================
// 我的（P1）：账号信息 + 授权中心入口 + 工作室各功能深链。
// 算力 / 存储 / 设置等管理页仍在 /studio（P3 逐屏迁出）。
// ============================================================
import React from "react";
import { useRouter } from "next/navigation";
import { AccountApi, AssetApi, auth, USE_MOCK } from "@/proto/api";
import type { Account, AssetSummary, RecentAsset } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, ListRow, NavBar, SectionHeader } from "@/components/hub/ui";

export default function MePage() {
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  const account = useHubData<Account | null>(() => AccountApi.get().catch(() => null), null, [], ready);
  const summary = useHubData<AssetSummary>(
    () => AssetApi.summary(),
    { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] },
    [],
    ready,
  );

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const sessionUser = !USE_MOCK ? auth.user() : null;
  const displayName =
    (sessionUser && (sessionUser.displayName || sessionUser.studioName || sessionUser.username)) ||
    (account.data as { name?: string } | null)?.name ||
    "我的账号";
  const initial = String(displayName).trim().slice(0, 1) || "我";

  return (
    <HubScreen tabBar>
      <NavBar title="我的" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card radius={22} pad={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              background: "var(--grad)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontFamily: "var(--font-serif)",
              fontSize: 24,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
            {USE_MOCK && <Badge tone="mute">演示数据模式</Badge>}
          </div>
        </Card>
      </div>

      <div style={{ margin: "16px 16px 0" }}>
        <Card pad={0}>
          <ListRow href="/licenses" title="授权中心" sub="授权证书 · 待补确认" divider />
          <ListRow href={studioHref("#/tasks")} title="任务中心" sub="生成任务的进度与历史" divider />
          <ListRow href={studioHref("#/realmaterials")} title="真人授权素材库" sub="素材录制 · 审核状态" />
        </Card>
      </div>

      <div style={{ margin: "12px 16px 0" }}>
        <Card pad={0}>
          <ListRow href={studioHref("#/membership")} title="会员与算力" divider />
          <ListRow href={studioHref("#/storage")} title="存储用量" divider />
          <ListRow href={studioHref("#/trash")} title="回收站" divider />
          <ListRow href={studioHref("#/settings")} title="设置" />
        </Card>
      </div>

      <div style={{ margin: "20px 16px 0" }}>
        <SectionHeader title="最近动态" />
        {summary.loading ? null : summary.error ? (
          <Card>
            <EmptyState text={`动态加载失败：${summary.error}`} />
          </Card>
        ) : summary.data.recent.length === 0 ? (
          <Card>
            <EmptyState text="还没有动态。资产用起来之后，这里会记下每一次使用" />
          </Card>
        ) : (
          <Card pad={0}>
            {summary.data.recent.slice(0, 5).map((a: RecentAsset, i: number, arr: RecentAsset[]) => (
              <ListRow
                key={`${a.kind}-${a.id}`}
                divider={i < arr.length - 1}
                leading={<Badge tone="mute">{a.kindLabel}</Badge>}
                title={a.name}
                trailing={
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)", flexShrink: 0 }}>
                    {a.when}
                  </span>
                }
              />
            ))}
          </Card>
        )}
      </div>

      {!USE_MOCK && (
        <div style={{ margin: "20px 16px 0" }}>
          <button
            onClick={() => {
              auth.clear();
              router.replace("/login");
            }}
            style={{
              width: "100%",
              height: 44,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--err)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </HubScreen>
  );
}
