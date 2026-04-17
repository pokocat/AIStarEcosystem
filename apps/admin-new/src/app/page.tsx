import Link from "next/link";
import {
  Users,
  Handshake,
  Send,
  ShieldCheck,
  Wallet,
  Music2,
  Film,
  Radio,
  AlertTriangle,
  ArrowRight,
  Flame,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { CoachRevenueChart } from "@/components/CoachRevenueChart";
import { RevenueSourcePie } from "@/components/RevenueSourcePie";

import { MOCK_ARTISTS } from "@/mocks/artists";
import {
  SignedArtists,
  DistributionQueue,
  CopyrightPending,
  CoachRevenueData,
} from "@/mocks/coach";
import { SONGS } from "@/mocks/music";
import { DRAMAS, MOVIES, ADS } from "@/mocks/film";
import { PLATFORMS } from "@/mocks/distribution";
import { TRANSACTIONS, REVENUE_SOURCES } from "@/mocks/finance";
import {
  SIGNED_ARTIST_STATUS,
  DISTRIBUTION_QUEUE_STATUS,
  COPYRIGHT_STATUS,
  PLATFORM_STATUS,
  TRANSACTION_STATUS,
} from "@/constants/status";
import { daysUntil, formatCurrencyCN } from "@/lib/utils";

export default function DashboardPage() {
  const totalArtists = MOCK_ARTISTS.length;
  const traineeCount = MOCK_ARTISTS.filter((a) => a.status === "trainee" || a.status === "debut").length;
  const expiringContracts = SignedArtists.filter((a) => a.status === "expiring" || a.status === "negotiating").length;
  const reviewingDist = DistributionQueue.filter((d) => d.status === "reviewing").length;
  const pendingCopyright = CopyrightPending.filter((c) => c.status === "pending").length;
  const pendingPlatforms = PLATFORMS.filter((p) => p.status === "pending").length;
  const actionableTxns = TRANSACTIONS.filter((t) => t.status === "pending" || t.status === "processing");
  const inProductionFilm = [
    ...DRAMAS.filter((d) => d.status === "post-production" || d.status === "filming"),
    ...MOVIES.filter((m) => m.status === "post-production" || m.status === "filming"),
    ...ADS.filter((a) => a.status === "negotiating" || a.status === "shooting"),
  ].length;
  const songsInProduction = SONGS.filter((s) => s.status !== "released").length;
  const gmv = CoachRevenueData.reduce(
    (acc, m) => acc + m.streaming + m.endorsement + m.nft + m.live,
    0
  );

  // High-priority action rows
  const urgentContracts = SignedArtists
    .map((a) => ({ ...a, days: daysUntil(a.contractEnd) }))
    .filter((a) => a.status === "expiring" || a.status === "negotiating" || a.days < 120)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="运营总览"
        description="平台关键指标 · 待处理队列 · 趋势与异常"
        breadcrumb={[{ label: "AI Star Eco" }, { label: "运营总览" }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/audit">查看审计日志</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/content/copyright">
                立即处理待办 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {/* Top KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="签约艺人"
          value={totalArtists}
          hint={`练习生 / 新人 ${traineeCount} · 活跃 ${totalArtists - traineeCount}`}
          icon={Users}
        />
        <StatCard
          label="GMV（近 6 月）"
          value={formatCurrencyCN(gmv)}
          hint="流媒体 / 代言 / NFT / 现场合计"
          icon={Wallet}
          delta={{ value: "12.4%", positive: true }}
        />
        <StatCard
          label="发行队列待审核"
          value={reviewingDist}
          hint={`全部 ${DistributionQueue.length} 项在途`}
          icon={Send}
          tone={reviewingDist > 0 ? "warning" : "default"}
        />
        <StatCard
          label="版权待核验"
          value={pendingCopyright}
          hint="需要人工审核"
          icon={ShieldCheck}
          tone={pendingCopyright > 0 ? "danger" : "default"}
        />
      </section>

      {/* Action queue strip */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { href: "/artists/lifecycle", icon: Flame, label: "练习生", count: traineeCount, tone: "primary" },
          { href: "/coach/contracts", icon: Handshake, label: "合约异常", count: expiringContracts, tone: "danger" },
          { href: "/distribution/platforms", icon: Radio, label: "渠道接入", count: pendingPlatforms, tone: "warning" },
          { href: "/content/songs", icon: Music2, label: "歌曲制作中", count: songsInProduction, tone: "info" },
          { href: "/content/film", icon: Film, label: "影视项目", count: inProductionFilm, tone: "info" },
          { href: "/finance/settlement", icon: AlertTriangle, label: "结算待复核", count: actionableTxns.length, tone: "danger" },
        ].map((item) => {
          const Icon = item.icon;
          const hasItems = item.count > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 card-shadow transition hover:card-shadow-hover hover:border-indigo-200"
            >
              <div
                className={
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
                  (item.tone === "danger"
                    ? "bg-rose-50 text-rose-600"
                    : item.tone === "warning"
                    ? "bg-amber-50 text-amber-600"
                    : item.tone === "primary"
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-sky-50 text-sky-600")
                }
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-none">
                  {item.count}
                  {hasItems && <span className="text-xs text-muted-foreground font-normal ml-1">待处理</span>}
                </div>
                <span className="text-xs text-muted-foreground mt-1 truncate">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>平台 GMV 趋势 · 近 6 月</CardTitle>
              <CardDescription>按品类堆叠：流媒体 / 代言 / NFT / 现场</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/finance/settlement">查看明细 <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <CoachRevenueChart data={CoachRevenueData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>收入构成</CardTitle>
            <CardDescription>当月占比 · 单位 %</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueSourcePie data={REVENUE_SOURCES} />
          </CardContent>
        </Card>
      </section>

      {/* Critical queues */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-rose-500" />
                临期 / 谈判合约
              </CardTitle>
              <CardDescription>按到期日升序</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/coach/contracts">全部合约 <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {urgentContracts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-lg">
                  {c.typeIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{c.name}</span>
                    <StatusBadge meta={SIGNED_ARTIST_STATUS[c.status]} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.mcn} · 分成 {c.royaltyRate}% · 月均 {c.monthlyRevenue}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">到期</div>
                  <div
                    className={
                      "text-sm font-medium tabular-nums " +
                      (c.days <= 30 ? "text-rose-600" : c.days <= 90 ? "text-amber-600" : "text-foreground")
                    }
                  >
                    {c.days < 0 ? `已过 ${-c.days}天` : `${c.days} 天`}
                  </div>
                </div>
              </div>
            ))}
            {urgentContracts.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无待处理合约</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-500" />
                发行队列待审
              </CardTitle>
              <CardDescription>审核通过后推送至目标渠道</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/distribution/queue">发行中心 <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {DistributionQueue.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-xs font-medium text-muted-foreground">
                  {d.type === "Music" ? "🎵" : d.type === "Video" ? "🎬" : "📡"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.artist} · 目标 {d.platforms} 渠道 · {d.date}
                  </div>
                </div>
                <StatusBadge meta={DISTRIBUTION_QUEUE_STATUS[d.status]} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Secondary queues */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-500" />
              版权核验
            </CardTitle>
            <CardDescription>待核验的版权登记</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {CopyrightPending.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.artist} · {c.type} · 提交 {c.submitted}
                  </div>
                </div>
                <StatusBadge meta={COPYRIGHT_STATUS[c.status]} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-amber-500" />
              渠道接入
            </CardTitle>
            <CardDescription>待审核 / 已断开的分发渠道</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {PLATFORMS.filter((p) => p.status !== "connected").map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-muted text-base">
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                </div>
                <StatusBadge meta={PLATFORM_STATUS[p.status]} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              结算异常
            </CardTitle>
            <CardDescription>处理中 / 待复核流水</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border -mx-2">
            {actionableTxns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.source}</div>
                  <div className="text-xs text-muted-foreground">{t.date}</div>
                </div>
                <div className="text-sm tabular-nums font-medium">{t.amount}</div>
                <StatusBadge meta={TRANSACTION_STATUS[t.status]} />
              </div>
            ))}
            {actionableTxns.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无异常流水</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
