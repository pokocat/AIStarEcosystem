"use client";
// ============================================================
// 首页（2026-09-01 五 Tab 定案）：门户，不是资产列表。
//   总览数字 + 进行中的事 + 快捷创作 + 最近更新 + 官方精选
// 资产清单在「资产」Tab，官方名录在「发现」Tab。
// ============================================================
import React from "react";
import Link from "next/link";
import { AssetApi, AvatarApi, JobApi, LicenseApi } from "@/proto/api";
import type { AssetSummary, Avatar, Job, License, StarGrant } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { OfficialCard } from "@/components/hub/asset-cards";
import { AssetPortrait, Card, HubScreen, LinkAction, LoadingBlock, NavBar, SectionHeader } from "@/components/hub/ui";

const EMPTY_SUMMARY: AssetSummary = { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] };

/** 快捷创作：四个高频起点，落点与「创作」Tab 一致。 */
const QUICK = [
  { href: "/studio?start=real", label: "真人复刻", sub: "一段视频起步" },
  { href: "/studio?start=ai", label: "AI 原创人物", sub: "从设定开始" },
  { href: "/studio?start=compose", label: "合成出片", sub: "人物 × 场景 × 产品" },
  { href: studioHref("#/voice"), label: "克隆声音", sub: "录一段就行" },
];

export function HubHome() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";

  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [], ready);
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);
  const official = useHubData<Avatar[]>(() => AvatarApi.list("public"), [], [], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const runningJobs = jobs.data.filter((j) => j.status === "running");
  const attentionLicenses = licenses.data.filter((l) => l.status !== "active" || l.evidenceStatus === "legacy_unconfirmed");
  const pendingGrants = grants.data.filter((g) => g.status === "pending");
  const todoLabel = [
    runningJobs.length > 0 ? `${runningJobs.length} 个生成中` : "",
    attentionLicenses.length > 0 ? `${attentionLicenses.length} 条授权待处理` : "",
    pendingGrants.length > 0 ? `${pendingGrants.length} 条明星授权审批中` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tile = (key: string) => summary.data.types.find((t) => t.key === key)?.count ?? 0;
  const recent = summary.data.recent.slice(0, 6);

  return (
    <HubScreen tabBar>
      <NavBar title="数字资产" serifBrand />

      {/* 总览 + 进行中的事 */}
      <div style={{ margin: "8px 16px 0" }}>
        <Card
          radius={20}
          pad={0}
          style={{ background: "linear-gradient(155deg, #2BC2E8, #0E9CC4 62%, #0A85A9)", border: "none", boxShadow: "0 10px 26px rgba(18,179,222,.26)", overflow: "hidden" }}
        >
          <Link href="/assets" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ padding: "15px 16px 13px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.82)" }}>我的资产</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {summary.loading ? "—" : summary.data.totalCount}
                  </span>
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.8)" }}>件</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  { n: tile("character"), label: "数字人" },
                  { n: tile("voice"), label: "声音" },
                  { n: tile("scene") + tile("product") + tile("style"), label: "素材" },
                ].map((x) => (
                  <div key={x.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{summary.loading ? "—" : x.n}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,.82)" }}>{x.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
          {todoLabel && (
            <Link href={studioHref("#/tasks")} style={{ textDecoration: "none", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,.16)", borderTop: "1px solid rgba(255,255,255,.2)" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "#fff", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {todoLabel}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.9)", flexShrink: 0 }}>去看看 ›</span>
              </div>
            </Link>
          )}
        </Card>
      </div>

      {/* 快捷创作 */}
      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="开始创作" action={<LinkAction href="/create">全部方式 ›</LinkAction>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} style={{ textDecoration: "none", color: "inherit" }}>
              <Card radius={13} pad={12} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.label}</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.sub}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 最近更新 */}
      {(summary.loading || recent.length > 0) && (
        <div style={{ margin: "20px 0 0" }}>
          <div style={{ margin: "0 16px" }}>
            <SectionHeader title="最近更新" action={<LinkAction href="/assets">我的资产 ›</LinkAction>} />
          </div>
          {summary.loading ? (
            <div style={{ margin: "0 16px" }}>
              <LoadingBlock />
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
              {recent.map((r) => (
                <Link
                  key={`${r.kind}-${r.id}`}
                  href={r.kind === "character" ? `/assets/${r.id}` : studioHref("#/library")}
                  style={{ textDecoration: "none", color: "inherit", flexShrink: 0 }}
                >
                  <Card radius={13} pad={10} style={{ width: 132, display: "flex", flexDirection: "column", gap: 8 }}>
                    <AssetPortrait name={r.name} imageUrl={r.imageUrl} hue={200} width={112} height={112} radius={10} fontSize={34} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontFamily: "var(--font-serif)", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.kindLabel} · {r.when}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 官方精选 */}
      {official.data.length > 0 && (
        <div style={{ margin: "20px 16px 0" }}>
          <SectionHeader title="官方可授权角色" hint="授权后可直接拿去出片" action={<LinkAction href="/discover">去发现 ›</LinkAction>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {official.data.slice(0, 2).map((c) => (
              <OfficialCard key={c.id} c={c} height={172} />
            ))}
          </div>
        </div>
      )}
    </HubScreen>
  );
}
