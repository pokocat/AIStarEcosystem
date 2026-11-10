"use client";

// 电脑版「我的账号」总览：近 30 天消耗、存储用量、生成中的任务、最近任务和常用入口。手机版是 app/me 的 MeMobile。

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "antd";
import { ChevronRight, Clock, Database, IdCard, Layers, TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import type { StudioStorageUsage, StudioTaskHistoryPage } from "@ai-star-eco/types";
import type { MeIdentity } from "@/proto/api";
import { InvitationLink, InvitationRecords, invitationsEnabled, useInvitations } from "@/ip/invitation-workspace";
import "@/styles/invitations.css";
import { AccountApi } from "@/ip/api";
import { AccountShell } from "@/shell/account-workspace";
import { IconBox, number, TaskCredits, TaskIcon, TaskStatusTag, taskSource } from "./account-ui";

function Row({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return <Link className="account-row" href={href}>{icon}<span><strong>{title}</strong><small>{sub}</small></span><ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>;
}

/** {@code invitesOpen}：/me/invitations 打开总览并展开邀请记录抽屉，关掉回到 /me。 */
export function AccountOverview({ invitesOpen = false }: { name?: string; phone?: string | null; demo?: boolean; identity?: MeIdentity | null; invitesOpen?: boolean }) {
  const router = useRouter();
  const inviting = invitationsEnabled();
  const inv = useInvitations(inviting);
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
        <Link href="/me/tasks">查看任务历史</Link>
      </section>
      <section className="account-card account-stat" aria-label="存储用量">
        <div className="account-stat-top"><span>存储用量</span><IconBox tone="is-audio"><Database /></IconBox></div>
        <strong>{storage ? formatMb(storage.usedMb) : "…"}<small>{storage ? `/ ${formatMb(storage.quotaMb)}` : ""}</small></strong>
        <div className="account-meter" role="img" aria-label={`已用 ${usedPct}%`}><i style={{ width: `${usedPct}%` }} /></div>
        <Link href="/me/storage">查看明细</Link>
      </section>
      <section className="account-card account-stat" aria-label="生成中">
        <div className="account-stat-top"><span>生成中</span><IconBox tone="is-video"><Clock /></IconBox></div>
        <strong>{s ? s.running : "…"}<small>个任务</small></strong>
        <Link href="/me/tasks?status=running">查看任务</Link>
      </section>
    </div>

    <section className="account-section" aria-labelledby="account-recent">
      <div className="account-section-head"><h2 id="account-recent">最近任务</h2><Link href="/me/tasks" className="account-muted">全部任务</Link></div>
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
      {inviting && <section aria-labelledby="account-invite">
        <div className="account-section-head"><h2 id="account-invite">邀请朋友</h2>
          {inv.data && <Link href="/me/invitations" className="account-muted">邀请记录 · {number.format(inv.data.total)}</Link>}</div>
        <div className="account-card invitation-card">
          {inv.data ? <InvitationLink inv={inv} /> : inv.loadError ? <span className="account-alert" role="alert">{inv.loadError}</span> : <span className="account-muted" role="status">正在加载邀请链接…</span>}
          {inv.data && <span className="account-muted" style={{ fontSize: 12 }}>{inv.data.inviter ? `我的邀请人：${inv.data.inviter.displayName}` : "朋友通过链接注册后，会出现在邀请记录里。"}</span>}
        </div>
      </section>}
      <section aria-labelledby="account-assets">
        <div className="account-section-head"><h2 id="account-assets">资产与名片</h2></div>
        <div className="account-card account-list" style={{ overflow: "hidden" }}>
          <Row href="/assets" icon={<IconBox tone="is-video"><Layers /></IconBox>} title="我的资产" sub="人物、声音和创作素材" />
          <Row href="/assets/cards" icon={<IconBox tone="is-audio"><IdCard /></IconBox>} title="我的名片" sub="按人物发布的数字名片" />
        </div>
      </section>
    </div>
    {inviting && <Drawer open={invitesOpen} onClose={() => router.replace("/me")} size={520} title="邀请记录" rootClassName="account-drawer">
      <InvitationRecords inv={inv} />
    </Drawer>}
  </AccountShell>;
}

export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${number.format(mb)} MB`;
}
