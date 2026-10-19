"use client";
// 创作首页：Studio 的主要能力前置，资产管理与原有业务继续保留。
import React from "react";
import Link from "next/link";
import { AssetApi, AvatarApi, JobApi, LicenseApi } from "@/proto/api";
import type { AssetSummary, Avatar, Job, License, StarGrant } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { OfficialCard } from "@/components/hub/asset-cards";
import { AssetPortrait, Card, HubScreen, LinkAction, LoadingBlock, SectionHeader } from "@/components/hub/ui";
import { StudioHome } from "./studio-home";

const EMPTY_SUMMARY: AssetSummary = { totalCount: 0, totalBytes: 0, totalSizeLabel: "0 MB", types: [], recent: [] };
const ASSET_TOOLS = [
  { href: "/studio?start=real", label: "真人复刻", sub: "从本人出镜视频开始" },
  { href: "/studio?start=compose", label: "资产合成", sub: "使用已有数字人、场景和产品" },
  { href: studioHref("#/voice"), label: "声音训练", sub: "查看录音要求与训练进度" },
  { href: "/studio?start=sheet", label: "素材管理", sub: "场景、商品、风格与品牌资产" },
];

export function HubHome() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const [refresh, setRefresh] = React.useState(0);
  const summary = useHubData<AssetSummary>(() => AssetApi.summary(), EMPTY_SUMMARY, [refresh], ready);
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);
  const official = useHubData<Avatar[]>(() => AvatarApi.list("public"), [], [], ready);
  if (authState === "no-platform") return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const runningJobs = jobs.data.filter(j => j.status === "running");
  const attentionLicenses = licenses.data.filter(l => l.status !== "active" || l.evidenceStatus === "legacy_unconfirmed");
  const pendingGrants = grants.data.filter(g => g.status === "pending");
  const recent = summary.data.recent.slice(0, 6);
  const tile = (key: string) => summary.data.types.find(t => t.key === key)?.count ?? 0;

  return <div data-studio-overlay-root className="ip-surface studio-home-surface"><HubScreen tabBar>
    <StudioHome ready={ready}/>
    <section className="studio-home-assets" aria-label="我的数字资产">
      <SectionHeader title="我的数字资产" action={<LinkAction href="/assets">管理资产 ›</LinkAction>}/>
      {summary.error ? <div className="studio-home-error" role="alert"><p>{summary.error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}>重新加载资产</button></div> :
        <div className="studio-home-asset-summary"><Link href="/assets">{summary.loading ? '正在加载资产…' : `${summary.data.totalCount} 件资产`}</Link><span>人物 {summary.loading ? '—' : tile('character')}</span><span>声音 {summary.loading ? '—' : tile('voice')}</span><span>素材 {summary.loading ? '—' : tile('scene') + tile('product') + tile('style')}</span></div>}
      {(runningJobs.length > 0 || attentionLicenses.length > 0 || pendingGrants.length > 0) && <div className="studio-home-attention">
        {!!runningJobs.length && <Link href={studioHref('#/tasks')}>{runningJobs.length} 个资产任务生成中 ›</Link>}
        {!!attentionLicenses.length && <Link href="/licenses">{attentionLicenses.length} 条授权待处理 ›</Link>}
        {!!pendingGrants.length && <Link href="/licenses">{pendingGrants.length} 条明星授权审批中 ›</Link>}
      </div>}
      {summary.loading ? <LoadingBlock/> : recent.length > 0 && <div className="studio-home-recent-assets">{recent.map(r => <Link key={`${r.kind}-${r.id}`} href={r.kind === 'character' ? `/assets/${r.id}` : studioHref('#/library')}>
        <Card radius={13} pad={10}><AssetPortrait name={r.name} imageUrl={r.imageUrl} hue={200} width={112} height={112} radius={10} fontSize={34}/><div><strong>{r.name}</strong><small>{r.kindLabel} · {r.when}</small></div></Card>
      </Link>)}</div>}
    </section>
    <section className="studio-home-assets" aria-label="更多资产工具"><SectionHeader title="更多资产工具"/><div className="studio-home-asset-tools">{ASSET_TOOLS.map(q => <Link key={q.href} href={q.href}><strong>{q.label}</strong><span>{q.sub}</span></Link>)}</div></section>
    {official.data.length > 0 && <section className="studio-home-assets"><SectionHeader title="官方可授权角色" action={<LinkAction href="/discover">去发现 ›</LinkAction>}/><div className="hub-grid-cards">{official.data.slice(0, 6).map(c => <OfficialCard key={c.id} c={c}/>)}</div></section>}
  </HubScreen></div>;
}
