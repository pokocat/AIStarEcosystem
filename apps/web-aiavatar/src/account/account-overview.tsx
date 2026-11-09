"use client";

// 电脑版「我的账号」总览：近 30 天消耗、存储用量、生成中的任务、最近任务和常用入口。手机版是 app/me 的 MeMobile。

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Clock, Database, FileText, IdCard, Layers, ShieldCheck, TrendingUp, UserPlus } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import type { StudioStorageUsage, StudioTaskHistoryPage } from "@ai-star-eco/types";
import { ID_MODE, type MeIdentity } from "@/proto/api";
import { AccountApi } from "@/ip/api";
import { AccountShell } from "@/shell/account-workspace";
import { IconBox, number, TaskCredits, TaskIcon, TaskStatusTag, taskSource } from "./account-ui";

function Row({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return <Link className="account-row" href={href}>{icon}<span><strong>{title}</strong><small>{sub}</small></span><ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>;
}

export function AccountOverview(_props: { name?: string; phone?: string | null; demo?: boolean; identity?: MeIdentity | null }) {
  const [history, setHistory] = useState<StudioTaskHistoryPage>();
  const [storage, setStorage] = useState<StudioStorageUsage>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    AccountApi.taskHistory({ days: 30, page: 0 }).then(v => { if (live) setHistory(v); }).catch(() => { if (live) setFailed(true); });
    AccountApi.storageUsage().then(v => { if (live) setStorage(v); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  const s = history?.summary;
  const usedPct = storage && storage.quotaMb > 0 ? Math.min(100, Math.round(storage.usedMb / storage.quotaMb * 100)) : 0;
  return <AccountShell active="me" title="我的账号">
    {failed && <p className="account-alert" role="alert" style={{ marginBottom: 12 }}>部分数据加载失败，请稍后刷新重试。</p>}
    <div className="account-stats">
      <section className="account-card account-stat" aria-label="近 30 天消耗">
        <div className="account-stat-top"><span>近 30 天消耗</span><IconBox tone="is-image"><TrendingUp /></IconBox></div>
        <strong>{s ? number.format(s.spent) : "…"}<small>积分</small></strong>
        {s && s.scopedSpent > 0 && <span className="account-muted">其中模型赠款 {number.format(s.scopedSpent)}</span>}
        {s?.partial && <span className="account-muted">任务较多，只统计了最近 {number.format(s.count)} 条</span>}
        <a href="/studio#/tasks">查看任务历史</a>
      </section>
      <section className="account-card account-stat" aria-label="存储用量">
        <div className="account-stat-top"><span>存储用量</span><IconBox tone="is-audio"><Database /></IconBox></div>
        <strong>{storage ? formatMb(storage.usedMb) : "…"}<small>{storage ? `/ ${formatMb(storage.quotaMb)}` : ""}</small></strong>
        <div className="account-meter" role="img" aria-label={`已用 ${usedPct}%`}><i style={{ width: `${usedPct}%` }} /></div>
        <a href="/studio#/storage">查看明细</a>
      </section>
      <section className="account-card account-stat" aria-label="生成中">
        <div className="account-stat-top"><span>生成中</span><IconBox tone="is-video"><Clock /></IconBox></div>
        <strong>{s ? s.running : "…"}<small>个任务</small></strong>
        <a href="/studio#/tasks">查看任务</a>
      </section>
    </div>

    <section className="account-section" aria-labelledby="account-recent">
      <div className="account-section-head"><h2 id="account-recent">最近任务</h2><a href="/studio#/tasks" className="account-muted">全部任务</a></div>
      <div className="account-card account-list" style={{ overflow: "hidden" }}>
        {history && history.items.length === 0 && <div className="account-state"><strong>近 30 天没有生成任务</strong></div>}
        {(history?.items ?? []).slice(0, 3).map(item => <Link key={item.id} className="account-row" href={item.href}>
          <TaskIcon type={item.type} />
          <span><strong>{item.title}</strong><small>{[formatDateTime(item.createdAt), taskSource(item)].filter(Boolean).join(" · ")}</small></span>
          <TaskStatusTag item={item} />
          <span style={{ flex: "0 0 96px", alignItems: "flex-end" }}><TaskCredits item={item} /></span>
        </Link>)}
      </div>
    </section>

    <div className="account-two account-section">
      <section aria-labelledby="account-manage">
        <div className="account-section-head"><h2 id="account-manage">账号管理</h2></div>
        <div className="account-card account-list" style={{ overflow: "hidden" }}>
          {ID_MODE && <Row href="/invitations" icon={<IconBox tone="is-image"><UserPlus /></IconBox>} title="邀请朋友" sub="邀请链接和邀请记录" />}
          {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && <Row href="/enterprise" icon={<IconBox tone="is-person"><Building2 /></IconBox>} title="企业积分" sub="企业余额、积分分配和充值记录" />}
          <Row href="/model-results" icon={<IconBox tone="is-text"><FileText /></IconBox>} title="生成原文" sub="模型返回的完整原文，可复制和下载" />
        </div>
      </section>
      <section aria-labelledby="account-assets">
        <div className="account-section-head"><h2 id="account-assets">创作与资产</h2></div>
        <div className="account-card account-list" style={{ overflow: "hidden" }}>
          <Row href="/assets" icon={<IconBox tone="is-video"><Layers /></IconBox>} title="我的资产" sub="人物、声音和创作素材" />
          <Row href="/cards" icon={<IconBox tone="is-audio"><IdCard /></IconBox>} title="我的名片" sub="对外展示的数字名片" />
          <Row href="/licenses" icon={<IconBox tone="is-person"><ShieldCheck /></IconBox>} title="授权中心" sub="人物和 IP 的授权证书" />
        </div>
      </section>
    </div>
  </AccountShell>;
}

export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${number.format(mb)} MB`;
}
