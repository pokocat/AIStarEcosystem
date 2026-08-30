"use client";
// ============================================================
// 首页（双面）：访客 → 公开宣传页（Landing）；已登录 → 工作台
// （资产总览数字 + 进行中的事 + 最近动态）。
// 兼容层：老版整站是根路径 hash SPA（现挂 /studio），七牛刷脸回调与历史分享
// 链接仍指向 /#/...，这里检测到旧 hash 一律原样转发到 /studio —— 在 /studio
// 流程全部迁完之前不得移除（见 docs/aiavatar-asset-hub-redesign.md §3.1）。
// dev 预览宣传页：任意模式加 ?landing=1。
// ============================================================
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AssetApi, auth, JobApi, LicenseApi, onAuthExpired, USE_MOCK } from "@/proto/api";
import type { AssetSummary, Job, License, RecentAsset, StarGrant } from "@/proto/data";
import { Landing } from "@/components/hub/landing";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, LinkAction, ListRow, LoadingBlock, NavBar, RegNo, SectionHeader } from "@/components/hub/ui";

const EMPTY_SUMMARY: AssetSummary = { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] };

/** 旧链接 / 刷脸回调的 hash 前缀 → 整体转发 /studio。 */
function isLegacyHash(hash: string): boolean {
  return /^#\/?(avatar|ip|scene|product|style|compose|create|real-auth|home|library|apps|me|tasks|licenses|realmaterials|voice|settings|security|membership|storage|trash|voiceclone)(\/|$)/.test(hash);
}

/** eta 有时只是状态回声（「生成中…」），与徽章重复就不显示。 */
function etaOf(j: Job): string {
  const eta = (j.eta || "").trim();
  return !eta || /生成中|排队|处理中|进行中/.test(eta) ? "" : eta;
}

function recentHref(a: RecentAsset): string {
  if (a.kind === "character") return `/assets/${a.id}`;
  if (a.kind === "voice") return studioHref("#/voice");
  if (a.kind === "ip" || a.kind === "scene" || a.kind === "product" || a.kind === "style") return studioHref(`#/${a.kind}/${a.id}`);
  return studioHref("#/library");
}

export default function HomePage() {
  // 三态：checking（旧 hash 检测中，什么都不下结论）/ landing（访客宣传页）/ app（工作台）。
  // 旧 hash 检测必须先拿到结论（review #1）：正在转发 /studio 时绝不做任何本页导航，
  // 保证 #/real-auth/{id} 刷脸回调 hash 永不丢失。访客不再被弹去 /login，而是看宣传页。
  const [mode, setMode] = useState<"checking" | "landing" | "app">("checking");
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash && isLegacyHash(hash)) {
      window.location.replace(`/studio${hash}`);
      return; // 保持 checking（空白）直到跳转完成
    }
    const wantLanding = new URLSearchParams(window.location.search).get("landing") === "1";
    if (wantLanding) {
      setMode("landing");
      return;
    }
    setMode(USE_MOCK || auth.isAuthed() ? "app" : "landing");
  }, []);
  useEffect(() => {
    if (USE_MOCK) return;
    return onAuthExpired(() => setMode("landing"));
  }, []);

  const ready = mode === "app";

  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [], ready);
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);

  if (mode === "landing") return <Landing />;
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
          <div style={{ margin: "6px 16px 0", position: "relative" }}>
            <Card
              radius={22}
              pad={0}
              style={{
                background: "linear-gradient(155deg, #2BC2E8, #0E9CC4 62%, #0A85A9)",
                border: "none",
                boxShadow: "0 12px 30px rgba(18,179,222,.28)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "18px 18px 16px", position: "relative" }}>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -60,
                    right: -50,
                    width: 180,
                    height: 180,
                    borderRadius: 999,
                    background: "radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,0) 68%)",
                  }}
                />
                <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.82)" }}>我的资产</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                      <span className="mono" style={{ fontSize: 38, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                        {summary.data.totalCount}
                      </span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,.8)" }}>件</span>
                    </div>
                  </div>
                  <Link
                    href="/assets"
                    style={{
                      height: 30,
                      padding: "0 14px",
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      background: "rgba(255,255,255,.2)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      flexShrink: 0,
                    }}
                  >
                    查看资产 ›
                  </Link>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  background: "rgba(255,255,255,.16)",
                  borderTop: "1px solid rgba(255,255,255,.2)",
                }}
              >
                {[
                  { n: tile("character"), label: "数字人" },
                  { n: tile("voice"), label: "声音" },
                  { n: tile("scene") + tile("product") + tile("style") + tile("ip"), label: "素材" },
                ].map((s) => (
                  <div key={s.label} style={{ padding: "11px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{s.n}</span>
                    <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.82)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ margin: "14px 16px 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {[
              {
                href: "/studio",
                label: "创建资产",
                icon: (
                  <>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </>
                ),
              },
              {
                href: "/assets",
                label: "去创作",
                icon: (
                  <>
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <polygon points="10 9 15 12 10 15 10 9" />
                  </>
                ),
              },
              {
                href: "/licenses",
                label: "授权中心",
                icon: (
                  <>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </>
                ),
              },
            ].map((a) => (
              <Link key={a.label} href={a.href} style={{ textDecoration: "none", color: "inherit" }}>
                <Card radius={15} pad={0} style={{ padding: "13px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      background: "var(--primary-soft)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--primary-700)",
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      {a.icon}
                    </svg>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>{a.label}</span>
                </Card>
              </Link>
            ))}
          </div>

          <div style={{ margin: "22px 16px 0" }}>
            <SectionHeader title="进行中" count={todoCount || undefined} action={<LinkAction href={studioHref("#/tasks")}>任务中心 ›</LinkAction>} />
            {todoCount === 0 ? (
              <Card>
                <EmptyState text="没有在办的事" actionHref="/studio" actionLabel="去创建资产" />
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
                      title={j.kind}
                      sub={`${j.charName}${etaOf(j) ? ` · ${etaOf(j)}` : ""}`}
                      trailing={
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-700)", flexShrink: 0 }}>
                          {Math.round(j.pct)}%
                        </span>
                      }
                      leading={<Badge tone="primary" dot>生成中</Badge>}
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
                <EmptyState text="还没有动态。资产用起来之后，这里会记下每一次使用" actionHref="/studio" actionLabel="去创建" />
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
              创建、出片都在工作室 ›
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
