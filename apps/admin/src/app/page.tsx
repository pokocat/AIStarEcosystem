"use client";

import * as React from "react";
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
  Clock3,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { CoachRevenueChart } from "@/components/CoachRevenueChart";
import { RevenueSourcePie } from "@/components/RevenueSourcePie";
import { listDigitalIps } from "@/api/digital-ips";
import { listSignedArtists, listDistributionQueue, listPendingCopyright, getCoachRevenue } from "@/api/coach";
import { listSongs } from "@/api/music";
import { listDramas, listMovies, listAds } from "@/api/film";
import { listPlatforms } from "@/api/distribution";
import { listTransactions, getRevenueSources } from "@/api/finance";
import {
  SIGNED_ARTIST_STATUS,
  DISTRIBUTION_QUEUE_STATUS,
  COPYRIGHT_STATUS,
  PLATFORM_STATUS,
  TRANSACTION_STATUS,
} from "@/constants/status";
import { cn, daysUntil } from "@/lib/utils";
import { formatCredits, formatSignedCredits } from "@/lib/format";
import type { Artist } from "@/types/artist";
import type {
  SignedArtist,
  DistributionQueueItem,
  CopyrightItem,
  CoachRevenuePoint,
} from "@/types/coach";
import type { Song } from "@/types/music";
import type { Drama, Movie, Advertisement } from "@/types/film";
import type { Platform } from "@/types/distribution";
import type { Transaction, RevenueSource } from "@/types/finance";

type QueueTone = "primary" | "info" | "warning" | "danger" | "success";

const queueToneClasses: Record<QueueTone, string> = {
  primary: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
  warning: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/20",
  danger: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
};

function LoadingBlock({ className }: { className?: string }) {
  return <span aria-hidden className={cn("admin-skeleton inline-flex rounded-md", className)} />;
}

function RowSkeleton({ shape = "rounded" }: { shape?: "rounded" | "circle" }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5" aria-hidden>
      <LoadingBlock className={cn("h-9 w-9 shrink-0", shape === "circle" ? "rounded-full" : "rounded-lg")} />
      <div className="min-w-0 flex-1 space-y-2">
        <LoadingBlock className="h-4 w-2/3" />
        <LoadingBlock className="h-3 w-1/2" />
      </div>
      <LoadingBlock className="h-5 w-14" />
    </div>
  );
}

export default function DashboardPage() {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [signedArtists, setSignedArtists] = React.useState<SignedArtist[]>([]);
  const [distributionQueue, setDistributionQueue] = React.useState<DistributionQueueItem[]>([]);
  const [copyrightItems, setCopyrightItems] = React.useState<CopyrightItem[]>([]);
  const [coachRevenue, setCoachRevenue] = React.useState<CoachRevenuePoint[]>([]);
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [dramas, setDramas] = React.useState<Drama[]>([]);
  const [movies, setMovies] = React.useState<Movie[]>([]);
  const [ads, setAds] = React.useState<Advertisement[]>([]);
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [revenueSources, setRevenueSources] = React.useState<RevenueSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [a, sa, dq, cp, cr, s, d, m, ad, pl, tx, rs] = await Promise.all([
          listDigitalIps(0, 500),
          listSignedArtists(),
          listDistributionQueue(),
          listPendingCopyright(),
          getCoachRevenue(),
          listSongs(),
          listDramas(),
          listMovies(),
          listAds(),
          listPlatforms(),
          listTransactions(0, 200),
          getRevenueSources(),
        ]);
        if (!active) return;
        setArtists(a);
        setSignedArtists(sa);
        setDistributionQueue(dq);
        setCopyrightItems(cp);
        setCoachRevenue(cr);
        setSongs(s);
        setDramas(d);
        setMovies(m);
        setAds(ad);
        setPlatforms(pl);
        setTransactions(tx);
        setRevenueSources(rs);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalArtists = artists.length;
  const traineeCount = artists.filter((a) => a.status === "trainee" || a.status === "debut").length;
  const expiringContracts = signedArtists.filter((a) => a.status === "expiring" || a.status === "negotiating").length;
  const reviewingDist = distributionQueue.filter((d) => d.status === "reviewing").length;
  const pendingCopyright = copyrightItems.filter((c) => c.status === "pending").length;
  const pendingPlatforms = platforms.filter((p) => p.status === "pending").length;
  const actionableTxns = transactions.filter((t) => t.status === "pending" || t.status === "processing");
  const inProductionFilm = [
    ...dramas.filter((d) => d.status === "post-production" || d.status === "filming"),
    ...movies.filter((m) => m.status === "post-production" || m.status === "filming"),
    ...ads.filter((a) => a.status === "negotiating" || a.status === "shooting"),
  ].length;
  const songsInProduction = songs.filter((s) => s.status !== "released").length;
  const gmv = coachRevenue.reduce(
    (acc, m) => acc + m.streaming + m.endorsement + m.nft + m.live,
    0
  );

  // High-priority action rows
  const urgentContracts = signedArtists
    .map((a) => ({ ...a, days: daysUntil(a.contractEnd) }))
    .filter((a) => a.status === "expiring" || a.status === "negotiating" || a.days < 120)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const primaryQueues: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    count: number;
    summary: string;
    tone: QueueTone;
  }> = [
    {
      href: "/content/copyright",
      icon: ShieldCheck,
      label: "版权待核验",
      count: pendingCopyright,
      summary: pendingCopyright > 0 ? "优先处理人工审核，避免发行阻塞" : "当前没有版权阻塞项",
      tone: pendingCopyright > 0 ? "danger" : "success",
    },
    {
      href: "/finance/ledger",
      icon: AlertTriangle,
      label: "结算待复核",
      count: actionableTxns.length,
      summary: actionableTxns.length > 0 ? "优先清理处理中与待复核流水" : "结算流水稳定，无需人工介入",
      tone: actionableTxns.length > 0 ? "danger" : "success",
    },
    {
      href: "/platform/accounts",
      icon: Handshake,
      label: "合约异常",
      count: expiringContracts,
      summary: expiringContracts > 0 ? "包含临期与谈判中合约" : "近期没有需要跟进的合约",
      tone: expiringContracts > 0 ? "warning" : "success",
    },
  ];

  const supportQueues: Array<{
    href: string;
    icon: LucideIcon;
    label: string;
    count: number;
    hint: string;
    tone: QueueTone;
  }> = [
    {
      href: "/artists/lifecycle",
      icon: Flame,
      label: "练习生池",
      count: traineeCount,
      hint: "跟进练习生和新人转化",
      tone: "primary",
    },
    {
      href: "/distribution/platforms",
      icon: Radio,
      label: "渠道接入",
      count: pendingPlatforms,
      hint: pendingPlatforms > 0 ? "存在待审核或断开的渠道" : "渠道状态正常",
      tone: pendingPlatforms > 0 ? "warning" : "success",
    },
    {
      href: "/content/songs",
      icon: Music2,
      label: "歌曲制作中",
      count: songsInProduction,
      hint: "查看未发布歌曲进度",
      tone: "info",
    },
    {
      href: "/content/dramas",
      icon: Film,
      label: "影视项目",
      count: inProductionFilm,
      hint: "关注拍摄与后期阶段项目",
      tone: "info",
    },
  ];

  return (
    <div className="admin-page space-y-8">
      <PageHeader
        title="运营总览"
        description="先处理阻塞项，再看趋势与在途产能。"
        breadcrumb={[{ label: "AI Star Eco" }, { label: "运营总览" }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/audit">查看审计日志</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/content/copyright">
                处理最高优先级待办 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {loadError && (
        <Card className="border-destructive/25 bg-destructive/10">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> 加载失败：{loadError}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader className="gap-3 border-b border-border/80 pb-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                当前最需要处理的事项
              </CardTitle>
              <CardDescription>把会阻塞审核、结算和合约推进的事项放在最前面。</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {primaryQueues.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-4 rounded-lg border border-border px-4 py-4 transition-colors hover:border-primary/25 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", queueToneClasses[item.tone])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {loading ? "正在同步" : item.count > 0 ? "需要跟进" : "状态正常"}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
                          {loading ? <LoadingBlock className="h-7 w-10" /> : item.count}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <StatCard
            label="签约艺人"
            value={loading ? <LoadingBlock className="h-7 w-12" /> : totalArtists}
            hint={loading ? "正在同步艺人档案" : `练习生 / 新人 ${traineeCount} · 活跃 ${totalArtists - traineeCount}`}
            icon={Users}
          />
          <StatCard
            label="近 6 月 GMV · 积分"
            value={loading ? <LoadingBlock className="h-7 w-24" /> : formatCredits(gmv)}
            hint="流媒体 / 代言 / 数字藏品 / 现场合计"
            icon={Wallet}
          />
          <StatCard
            label="发行队列待审核"
            value={loading ? <LoadingBlock className="h-7 w-10" /> : reviewingDist}
            hint={loading ? "正在同步发行队列" : `全部 ${distributionQueue.length} 项在途`}
            icon={Send}
            tone={reviewingDist > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">运营趋势</h2>
            <p className="text-sm text-muted-foreground">趋势图保留全局视角，但不抢占待办判断。</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/finance/ledger">查看收入明细 <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.85fr)]">
          <Card>
            <CardHeader>
              <CardTitle>平台 GMV 趋势 · 近 6 月</CardTitle>
              <CardDescription>按品类堆叠：流媒体 / 代言 / 数字藏品 / 现场</CardDescription>
            </CardHeader>
            <CardContent>
              {coachRevenue.length > 0 ? (
                <CoachRevenueChart data={coachRevenue} />
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  {loading ? "加载中…" : "暂无数据"}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>收入构成</CardTitle>
              <CardDescription>当月占比 · 单位 %</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueSources.length > 0 ? (
                <RevenueSourcePie data={revenueSources} />
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  {loading ? "加载中…" : "暂无数据"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">重点队列</h2>
          <p className="text-sm text-muted-foreground">保留两个最需要持续盯防的在途列表。</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-destructive" />
                  临期 / 谈判合约
                </CardTitle>
                <CardDescription>按到期日升序</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/platform/accounts">全部合约 <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="-mx-2 divide-y divide-border">
              {loading && urgentContracts.length === 0 && (
                <>
                  <RowSkeleton shape="circle" />
                  <RowSkeleton shape="circle" />
                  <RowSkeleton shape="circle" />
                </>
              )}
              {urgentContracts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-lg">
                    {c.typeIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <StatusBadge meta={SIGNED_ARTIST_STATUS[c.status]} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.mcn} · 分成 {c.royaltyRate}% · 月均 {c.monthlyRevenue}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">到期</div>
                    <div
                      className={
                        "text-sm font-medium tabular-nums " +
                        (c.days <= 30 ? "text-destructive" : c.days <= 90 ? "text-warning" : "text-foreground")
                      }
                    >
                      {c.days < 0 ? `已过 ${-c.days}天` : `${c.days} 天`}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && urgentContracts.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  暂无待处理合约
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-warning" />
                  发行队列待审
                </CardTitle>
                <CardDescription>审核通过后推送至目标渠道</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/distribution/queue">发行中心 <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="-mx-2 divide-y divide-border">
              {loading && distributionQueue.length === 0 && (
                <>
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                </>
              )}
              {distributionQueue.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info ring-1 ring-inset ring-info/15">
                    {d.type === "Music" ? (
                      <Music2 className="h-4 w-4" />
                    ) : d.type === "Video" ? (
                      <Film className="h-4 w-4" />
                    ) : (
                      <Radio className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.artist} · 目标 {d.platforms} 渠道 · {d.date}
                    </div>
                  </div>
                  <StatusBadge meta={DISTRIBUTION_QUEUE_STATUS[d.status]} />
                </div>
              ))}
              {!loading && distributionQueue.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无发行任务</div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">巡检与在途</h2>
          <p className="text-sm text-muted-foreground">把非阻塞项收束到最后一屏，方便集中巡检。</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                运转概况
              </CardTitle>
              <CardDescription>适合每日巡检的辅助视图。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {supportQueues.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-lg border border-border px-4 py-4 transition-colors hover:border-primary/25 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", queueToneClasses[item.tone])}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {loading ? <LoadingBlock className="h-4 w-7" /> : item.count}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{item.hint}</p>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-destructive" />
                  版权核验
                </CardTitle>
                <CardDescription>待核验的版权登记</CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 divide-y divide-border">
                {loading && copyrightItems.length === 0 && (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                )}
                {copyrightItems.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.artist} · {c.type} · 提交 {c.submitted}
                      </div>
                    </div>
                    <StatusBadge meta={COPYRIGHT_STATUS[c.status]} />
                  </div>
                ))}
                {!loading && copyrightItems.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无版权登记</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-warning" />
                  渠道接入
                </CardTitle>
                <CardDescription>待审核 / 已断开的分发渠道</CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 divide-y divide-border">
                {loading && platforms.length === 0 && (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                )}
                {platforms.filter((p) => p.status !== "connected").slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-muted text-base">
                      {p.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs capitalize text-muted-foreground">{p.category}</div>
                    </div>
                    <StatusBadge meta={PLATFORM_STATUS[p.status]} />
                  </div>
                ))}
                {!loading && platforms.filter((p) => p.status !== "connected").length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">所有渠道已接入</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  结算异常
                </CardTitle>
                <CardDescription>处理中 / 待复核流水</CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 divide-y divide-border">
                {loading && actionableTxns.length === 0 && (
                  <>
                    <RowSkeleton />
                    <RowSkeleton />
                    <RowSkeleton />
                  </>
                )}
                {actionableTxns.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.source}</div>
                      <div className="text-xs text-muted-foreground">{t.date}</div>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{formatSignedCredits(t.amount)}</div>
                    <StatusBadge meta={TRANSACTION_STATUS[t.status]} />
                  </div>
                ))}
                {!loading && actionableTxns.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">暂无异常流水</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
