"use client";
// ============================================================
// 工作台（新版首页，P1）：资产总览数字 + 进行中的事 + 最近动态。
// 兼容层：老版整站是根路径 hash SPA（现挂 /studio），七牛刷脸回调与历史分享
// 链接仍指向 /#/...，这里检测到旧 hash 一律原样转发到 /studio —— 在 /studio
// 流程全部迁完之前不得移除（见 docs/aiavatar-asset-hub-redesign.md §3.1）。
// ============================================================
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AssetApi, JobApi, LicenseApi } from "@/proto/api";
import type { AssetSummary, Job, License, RecentAsset, StarGrant } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, LinkAction, ListRow, LoadingBlock, NavBar, RegNo, SectionHeader } from "@/components/hub/ui";

const EMPTY_SUMMARY: AssetSummary = { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] };

/** 旧链接 / 刷脸回调的 hash 前缀 → 整体转发 /studio。 */
function isLegacyHash(hash: string): boolean {
  return /^#\/?(avatar|ip|scene|product|style|compose|create|real-auth|home|library|apps|me|tasks|licenses|realmaterials|voice|settings|security|membership|storage|trash|voiceclone)(\/|$)/.test(hash);
}

function recentHref(a: RecentAsset): string {
  if (a.kind === "character") return `/assets/${a.id}`;
  if (a.kind === "voice") return studioHref("#/voice");
  if (a.kind === "ip" || a.kind === "scene" || a.kind === "product" || a.kind === "style") return studioHref(`#/${a.kind}/${a.id}`);
  return studioHref("#/library");
}

export default function WorkbenchPage() {
  // 旧 hash 检测必须先于登录守卫拿到结论（review #1）：hashState=unknown 期间守卫
  // 完全禁用，确认不是旧链接后才允许守卫做 /login 重定向 —— 消除与 location.replace
  // 的竞速，保证 #/real-auth/{id} 刷脸回调 hash 永不丢失。
  const [hashState, setHashState] = useState<"unknown" | "legacy" | "none">("unknown");
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash && isLegacyHash(hash)) {
      setHashState("legacy");
      window.location.replace(`/studio${hash}`);
    } else {
      setHashState("none");
    }
  }, []);

  const authState = useRequireAuth(hashState === "none");
  const ready = authState === "ok" && hashState === "none";

  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [], ready);
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  // 计数先算全量再截断展示（review #7：slice 后求和会让角标失真）
  const runningAll = jobs.data.filter((j) => j.status === "running");
  const attentionAll = licenses.data.filter((l) => l.status !== "active" || l.evidenceStatus === "legacy_unconfirmed");
  const pendingGrantsAll = grants.data.filter((g) => g.status === "pending");
  const runningJobs = runningAll.slice(0, 3);
  const pendingLicenses = attentionAll.slice(0, 2);
  const pendingGrants = pendingGrantsAll.slice(0, 2);
  const todoCount = runningAll.length + attentionAll.length + pendingGrantsAll.length;
  const tile = (key: string) => summary.data.types.find((t) => t.key === key)?.count ?? 0;
  const loading = summary.loading || jobs.loading || licenses.loading || grants.loading;

  return (
    <HubScreen tabBar>
      <NavBar title="数字资产" serifBrand right={<RegNo size={9.5}>ASSET LEDGER</RegNo>} />

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div style={{ margin: "6px 16px 0" }}>
            <Card
              radius={22}
              pad={16}
              style={{ background: "linear-gradient(150deg, var(--primary-tint), var(--primary-soft))", border: "1px solid #D6EEF7", boxShadow: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>我的资产总览</span>
                <LinkAction href="/assets">查看资产 ›</LinkAction>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { n: tile("character"), label: "数字人" },
                  { n: tile("voice"), label: "声音" },
                  { n: tile("scene") + tile("product") + tile("style"), label: "素材" },
                  { n: summary.data.totalCount, label: "全部资产", accent: true },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="mono" style={{ fontSize: 23, fontWeight: 700, color: s.accent ? "var(--primary-700)" : "var(--ink)" }}>
                      {s.n}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ margin: "22px 16px 0" }}>
            <SectionHeader title="进行中的事" count={todoCount || undefined} action={<LinkAction href={studioHref("#/tasks")}>任务中心 ›</LinkAction>} />
            {todoCount === 0 ? (
              <Card>
                <EmptyState text="暂时没有等你处理的事" actionHref="/studio" actionLabel="去创建资产" />
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingLicenses.map((l) => (
                  <Card key={l.id} pad={0}>
                    <ListRow
                      href="/licenses"
                      title={
                        l.evidenceStatus === "legacy_unconfirmed"
                          ? "授权待补确认"
                          : l.status === "expired"
                            ? "授权已到期，需要续期"
                            : "授权还差一步"
                      }
                      sub={`${l.subject} · ${l.scope}`}
                      leading={<Badge tone="warn" dot>授权</Badge>}
                    />
                  </Card>
                ))}
                {pendingGrants.map((g) => (
                  <Card key={g.id} pad={0}>
                    <ListRow
                      href={`/stars/${g.id}`}
                      title="明星授权审批中"
                      sub={`「${g.starName}」· 等待明星团队审批`}
                      leading={<Badge tone="warn" dot>授权</Badge>}
                    />
                  </Card>
                ))}
                {runningJobs.map((j) => (
                  <Card key={j.id} pad={0}>
                    <ListRow
                      href={studioHref("#/tasks")}
                      title={`${j.kind}生成中`}
                      sub={`${j.charName}${j.eta ? ` · ${j.eta}` : ""}`}
                      trailing={
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-700)", flexShrink: 0 }}>
                          {Math.round(j.pct)}%
                        </span>
                      }
                      leading={<Badge tone="primary" dot>生成</Badge>}
                    />
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div style={{ margin: "22px 16px 0" }}>
            <SectionHeader title="最近动态" action={<LinkAction href="/assets">资产 ›</LinkAction>} />
            {summary.data.recent.length === 0 ? (
              <Card>
                <EmptyState text="还没有动态，先创建第一个资产吧" actionHref="/studio" actionLabel="去创建" />
              </Card>
            ) : (
              <Card pad={0}>
                {summary.data.recent.slice(0, 5).map((a, i, arr) => (
                  <ListRow
                    key={`${a.kind}-${a.id}`}
                    href={recentHref(a)}
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

          <div style={{ margin: "20px 16px 0", textAlign: "center" }}>
            <Link href="/studio" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textDecoration: "none" }}>
              创建 / 制作请进工作室 ›
            </Link>
          </div>
        </>
      )}

      {(summary.error || jobs.error || licenses.error || grants.error) && (
        <div style={{ margin: "12px 16px 0", fontSize: 12, color: "var(--err)", textAlign: "center" }}>
          {summary.error || jobs.error || licenses.error || grants.error}
        </div>
      )}
    </HubScreen>
  );
}
