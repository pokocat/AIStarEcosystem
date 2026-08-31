"use client";
// ============================================================
// 资产主页（M3 导航合并后的首页内容）：
//   顶部两段「我的资产 / 官方资产」；「我的」段顶带总览与进行中的事
//   （原工作台内容并入，工作台 tab 退役）。
// 由 / 与 /assets 共用，深链保持不变。
// ============================================================
import React, { useState } from "react";
import Link from "next/link";
import { AssetApi, AvatarApi, DATA, JobApi, LicenseApi, VoiceApi } from "@/proto/api";
import type { AssetSummary, Avatar, Job, License, StarGrant, VoiceAsset } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { settled, studioHref, useHubData } from "@/components/hub/data";
import {
  AssetPortrait,
  Badge,
  Card,
  Chevron,
  EmptyState,
  HubScreen,
  LinkAction,
  LoadingBlock,
  NavBar,
  RegNo,
  SectionHeader,
} from "@/components/hub/ui";

const EMPTY_SUMMARY: AssetSummary = { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] };

/**
 * 授权徽章按 License 实体的真实状态判断（review #2：`c.license` 只是登记号，
 * 过期 / 待补确认时它依然存在，不能用"有没有 ID"冒充"授权是否有效"）。
 * 授权列表还没加载出来 / 加载失败时不下结论（返回 null）。
 */
function licenseBadge(c: Avatar, license: License | null, known: boolean) {
  if (c.path === "ai") return <Badge tone="mute">AI 原创 · 无需授权</Badge>;
  if (!known) return null;
  if (license?.status === "active") return <Badge tone="ok" dot>授权有效</Badge>;
  if (license?.status === "expired") return <Badge tone="err" dot>授权已到期</Badge>;
  return <Badge tone="warn" dot>待完成授权</Badge>;
}

/** 授权给我的明星形象卡（celebrity 域投影；申请审批走带货线，这里只展示与进入名片）。 */
function StarGrantCard({ g }: { g: StarGrant }) {
  return (
    <Link href={`/stars/${g.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AssetPortrait name={g.starName} imageUrl={g.starAvatar} hue={35} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 19,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {g.starName}
            </span>
            <RegNo>{`明星形象 · ${g.starId}`}</RegNo>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Badge tone="primary" dot>
              {g.scenes.length > 0
                ? `授权给我 · ${g.scenes.slice(0, 2).join(" / ")}${g.scenes.length > 2 ? " 等" : ""}`
                : "授权给我"}
            </Badge>
            {g.category && <span style={{ fontSize: 10.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{g.category}</span>}
          </div>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.expireDate ? `有效期至 ${g.expireDate}` : "有效期以授权约定为准"}
          </span>
        </div>
        <Chevron />
      </Card>
    </Link>
  );
}

function AvatarCard({ c, license, licenseKnown }: { c: Avatar; license: License | null; licenseKnown: boolean }) {
  const status = DATA.STATUS[c.status];
  return (
    <Link href={`/assets/${c.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AssetPortrait name={c.name} imageUrl={c.imageUrl} hue={c.hue} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 19,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.name}
            </span>
            <RegNo>{`${c.id} · V${c.versions || 1}`}</RegNo>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {licenseBadge(c, license, licenseKnown)}
            <span style={{ fontSize: 10.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{c.archetype}</span>
          </div>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {status ? `${status.label} · ` : ""}更新于 {c.updated}
          </span>
        </div>
        <Chevron />
      </Card>
    </Link>
  );
}

/**
 * 官方资产段：复用既有「数字人广场」（scope=public）。
 * 角色卡走 B 版视觉（立绘铺满、名字压在图上）。授权本身尚未打通，
 * 卡片只标「可授权」不标价 —— 价格字段还不存在，不编造（§3.3）。
 */
function OfficialSection({ state }: { state: { data: Avatar[]; loading: boolean; error: string | null } }) {
  if (state.loading) return <LoadingBlock label="官方资产加载中" />;
  if (state.error)
    return (
      <div style={{ margin: "14px 16px 0" }}>
        <Card>
          <EmptyState text={`官方资产加载失败：${state.error}`} />
        </Card>
      </div>
    );
  if (state.data.length === 0)
    return (
      <div style={{ margin: "14px 16px 0" }}>
        <Card>
          <EmptyState text="暂时还没有上架的官方资产" />
        </Card>
      </div>
    );
  return (
    <div style={{ margin: "14px 16px 0" }}>
      <SectionHeader title="可授权的官方角色" hint="授权后可用于出片" count={state.data.length} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {state.data.map((c) => (
          <Link key={c.id} href={`/market/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ position: "relative", height: 190, borderRadius: 18, overflow: "hidden", background: `linear-gradient(160deg, hsl(${c.hue ?? 200} 55% 82%), hsl(${c.hue ?? 200} 48% 66%))` }}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-serif)", fontSize: 62, color: "rgba(255,255,255,.85)" }}>
                  {(c.name || "?").trim().slice(0, 1)}
                </span>
              )}
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(12,20,34,0) 48%, rgba(12,20,34,.74))" }} />
              <span style={{ position: "absolute", top: 10, right: 10, height: 19, padding: "0 7px", display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.9)", color: "var(--primary-700)", fontSize: 9, fontWeight: 800 }}>
                可授权
              </span>
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.archetype}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AssetsHome() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";

  const avatars = useHubData<Avatar[]>(() => AvatarApi.list("mine"), [], [], ready);
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [], ready);
  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);
  // 官方资产复用已有的「数字人广场」（scope=public，服务端已实现），不新增后端
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);
  const [seg, setSeg] = useState<"mine" | "official">("mine");
  const official = useHubData<Avatar[]>(() => AvatarApi.list("public"), [], [], ready && seg === "official");

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const licenseKnown = settled(licenses);
  const licenseByChar = new Map(licenses.data.filter((l) => l.char).map((l) => [l.char as string, l]));
  const activeGrants = settled(grants) ? grants.data.filter((g) => g.status === "authorized") : [];

  const runningJobs = jobs.data.filter((j) => j.status === "running");
  const attentionLicenses = licenses.data.filter((l) => l.status !== "active" || l.evidenceStatus === "legacy_unconfirmed");
  const pendingGrants = grants.data.filter((g) => g.status === "pending");
  const todoCount = runningJobs.length + attentionLicenses.length + pendingGrants.length;
  const todoLabel = [
    runningJobs.length > 0 ? `${runningJobs.length} 个生成中` : "",
    attentionLicenses.length > 0 ? `${attentionLicenses.length} 条授权待处理` : "",
    pendingGrants.length > 0 ? `${pendingGrants.length} 条明星授权审批中` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tile = (key: string) => summary.data.types.find((t) => t.key === key)?.count ?? 0;
  const materialTiles = [
    { label: "场景", n: tile("scene") },
    { label: "产品", n: tile("product") },
    { label: "风格", n: tile("style") },
    { label: "IP", n: tile("ip") },
  ];

  return (
    <HubScreen tabBar>
      <NavBar
        title="资产"
        right={
          <Link
            href="/studio"
            aria-label="创建资产"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "var(--primary)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(18,179,222,.35)",
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        }
      />

      <div style={{ margin: "8px 16px 0", display: "flex", background: "var(--surface-3)", padding: 3, borderRadius: 999 }}>
        {([["mine", "我的资产"], ["official", "官方资产"]] as const).map(([k, label]) => {
          const on = seg === k;
          return (
            <button
              key={k}
              onClick={() => setSeg(k)}
              style={{
                flex: 1, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--ink-3)",
                border: "none", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 600,
                boxShadow: on ? "var(--sh-1)" : "none", cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {seg === "official" ? (
        <OfficialSection state={official} />
      ) : (
      <>
      {/* 总览 + 进行中（原工作台内容，M3 合并后并入此处）*/}
      <div style={{ margin: "14px 16px 0" }}>
        <Card
          radius={20}
          pad={0}
          style={{ background: "linear-gradient(155deg, #2BC2E8, #0E9CC4 62%, #0A85A9)", border: "none", boxShadow: "0 10px 26px rgba(18,179,222,.26)", overflow: "hidden" }}
        >
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
              ].map((x) => (
                <div key={x.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{summary.loading ? "—" : x.n}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,.82)" }}>{x.label}</span>
                </div>
              ))}
            </div>
          </div>
          {todoCount > 0 && (
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

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader
          title="人物与形象"
          hint="都可以直接拿去创作视频"
          count={avatars.loading || grants.loading ? undefined : avatars.data.length + activeGrants.length}
        />
        {avatars.loading || grants.loading ? (
          <LoadingBlock />
        ) : avatars.error ? (
          <Card>
            <EmptyState text={avatars.error} />
          </Card>
        ) : avatars.data.length + activeGrants.length === 0 ? (
          <Card>
            <EmptyState text="还没有数字人，从一段视频就能开始" actionHref="/studio" actionLabel="创建数字人" />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {avatars.data.map((c) => (
              <AvatarCard key={c.id} c={c} license={licenseByChar.get(c.id) || null} licenseKnown={licenseKnown} />
            ))}
            {activeGrants.map((g) => (
              <StarGrantCard key={g.id} g={g} />
            ))}
          </div>
        )}
        {grants.error && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--err)", textAlign: "center" }}>
            明星授权加载失败：{grants.error}
          </div>
        )}
      </div>

      <div style={{ margin: "20px 16px 0" }}>
        <SectionHeader
          title="声音"
          count={voices.loading ? undefined : voices.data.length}
          action={<LinkAction href={studioHref("#/voice")}>声音工作室 ›</LinkAction>}
        />
        {voices.loading ? (
          <LoadingBlock />
        ) : voices.error ? (
          <Card>
            <EmptyState text={voices.error} />
          </Card>
        ) : voices.data.length === 0 ? (
          <Card>
            <EmptyState text="还没有专属声音" actionHref={studioHref("#/voice")} actionLabel="去录一段" />
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {voices.data.slice(0, 4).map((v) => (
              <Link key={v.id} href={studioHref("#/voice")} style={{ textDecoration: "none", color: "inherit" }}>
                <Card radius={13} pad={12} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.name}
                  </span>
                  <RegNo size={9.5}>{`${v.id} · ${v.kind === "clone" ? "克隆声" : "设计声"} · ${v.dur}`}</RegNo>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ margin: "20px 16px 0" }}>
        <SectionHeader title="素材库" hint="生成视频时搭配使用" action={<LinkAction href={studioHref("#/library")}>管理 ›</LinkAction>} />
        <Link href={studioHref("#/library")} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          {summary.error ? (
            <Card>
              <EmptyState text={summary.error} />
            </Card>
          ) : (
            <Card style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {materialTiles.map((t) => (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
                    {summary.loading ? "—" : t.n}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t.label}</span>
                </div>
              ))}
            </Card>
          )}
        </Link>
      </div>
      </>
      )}
    </HubScreen>
  );
}
