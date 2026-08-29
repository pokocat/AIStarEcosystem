"use client";
// ============================================================
// 资产货架（P1）：人物与形象是主角（大卡），声音次之，
// 场景 / 产品 / 风格收进"素材库"分区 —— 管理与新建走 /studio。
// ============================================================
import React from "react";
import Link from "next/link";
import { AssetApi, AvatarApi, DATA, LicenseApi, VoiceApi } from "@/proto/api";
import type { AssetSummary, Avatar, License, VoiceAsset } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
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

export default function AssetsPage() {
  const authState = useRequireAuth();
  const ready = authState === "ok";

  const avatars = useHubData<Avatar[]>(() => AvatarApi.list("mine"), [], [], ready);
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [], ready);
  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const licenseKnown = settled(licenses);
  const licenseByChar = new Map(licenses.data.filter((l) => l.char).map((l) => [l.char as string, l]));

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

      <div style={{ margin: "4px 16px 0" }}>
        <SectionHeader title="人物与形象" hint="都可以直接拿去创作视频" count={avatars.loading ? undefined : avatars.data.length} />
        {avatars.loading ? (
          <LoadingBlock />
        ) : avatars.error ? (
          <Card>
            <EmptyState text={avatars.error} />
          </Card>
        ) : avatars.data.length === 0 ? (
          <Card>
            <EmptyState text="还没有数字人，从一段视频就能开始" actionHref="/studio" actionLabel="创建数字人" />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {avatars.data.map((c) => (
              <AvatarCard key={c.id} c={c} license={licenseByChar.get(c.id) || null} licenseKnown={licenseKnown} />
            ))}
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
    </HubScreen>
  );
}
