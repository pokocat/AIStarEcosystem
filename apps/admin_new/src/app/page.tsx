"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Coins,
  KeySquare,
  LineChart,
  Music2,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDigitalIps } from "@/api/digital-ips";
import { listUsers } from "@/api/users";
import { listBatches } from "@/api/licenses";
import { getMonthlyRevenue, getRevenueSources, listTransactions } from "@/api/finance";
import { listSongs } from "@/api/music";
import { listPlatforms } from "@/api/distribution";
import { listEvents } from "@/api/community";
import {
  COMMUNITY_EVENT_STATUS,
  COMMUNITY_EVENT_TYPE,
  TRANSACTION_STATUS,
} from "@/constants/status";
import { formatCompactNumber, formatCredits } from "@/lib/format";

export default function DashboardPage() {
  const users = useAsyncList(() => listUsers(0, 500));
  const artists = useAsyncList(() => listDigitalIps(0, 500));
  const batches = useAsyncList(() => listBatches(0, 200));
  const revenueMonthly = useAsyncList(() => getMonthlyRevenue());
  const revenueSources = useAsyncList(() => getRevenueSources());
  const transactions = useAsyncList(() => listTransactions(0, 20));
  const songs = useAsyncList(() => listSongs());
  const platforms = useAsyncList(() => listPlatforms());
  const events = useAsyncList(() => listEvents());

  const activeArtists = artists.data.filter((a) => a.status === "active").length;
  const trainee = artists.data.filter((a) => a.status === "trainee" || a.status === "debut").length;
  const totalFans = artists.data.reduce((s, a) => s + (a.stats?.fans ?? 0), 0);
  const totalPlays = songs.data.reduce((s, a) => s + (a.plays ?? 0), 0);
  const totalBalance = batches.data.reduce((s, b) => s + b.activatedCount * b.initialCreditGrant, 0);
  const activeLicenses = batches.data.filter((b) => b.status === "active").length;
  const txnPending = transactions.data.filter((t) => t.status === "pending" || t.status === "processing").length;
  const connectedPlatforms = platforms.data.filter((p) => p.status === "connected").length;
  const upcomingEvents = events.data.filter((e) => e.status === "upcoming" || e.status === "live").slice(0, 5);

  const revenueThisMonth = revenueMonthly.data.at(-1)?.revenue ?? 0;
  const revenuePrevMonth = revenueMonthly.data.at(-2)?.revenue ?? 0;
  const revenueDelta = revenuePrevMonth > 0
    ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="运营总览"
        description="平台核心 KPI 与待办队列。所有数值均为原始整数，展示层统一格式化。"
        actions={
          <Link
            href="/finance/ledger"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Wallet className="h-4 w-4" /> 结算中心
          </Link>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="注册账号"
          value={formatCompactNumber(users.data.length)}
          hint={`其中 ${users.data.filter((u) => u.status === "active").length} 启用 · ${users.data.filter((u) => u.status === "suspended").length} 停用`}
          tone="primary"
        />
        <StatCard
          icon={Sparkles}
          label="活跃 AI 艺人"
          value={formatCompactNumber(activeArtists)}
          hint={`练习生/新人 ${trainee} · 粉丝总量 ${formatCompactNumber(totalFans)}`}
          tone="violet"
          delta={8}
        />
        <StatCard
          icon={LineChart}
          label="本月收益（credits）"
          value={formatCredits(revenueThisMonth)}
          hint={`上月 ${formatCredits(revenuePrevMonth)}`}
          tone="emerald"
          delta={revenueDelta}
        />
        <StatCard
          icon={KeySquare}
          label="秘钥池"
          value={`${activeLicenses} / ${batches.data.length}`}
          hint={`累计发放 ${formatCredits(totalBalance)} credits`}
          tone="sky"
        />
        <StatCard
          icon={Music2}
          label="已发行歌曲"
          value={songs.data.filter((s) => s.status === "released").length}
          hint={`本季累计播放 ${formatCompactNumber(totalPlays)}`}
          tone="primary"
        />
        <StatCard
          icon={Radio}
          label="分发渠道"
          value={`${connectedPlatforms} / ${platforms.data.length}`}
          hint={`待审 ${platforms.data.filter((p) => p.status === "pending").length} 个`}
          tone="sky"
        />
        <StatCard
          icon={AlertTriangle}
          label="待处理流水"
          value={txnPending}
          hint="处理中 / 待复核"
          tone={txnPending > 0 ? "amber" : "emerald"}
        />
        <StatCard
          icon={Coins}
          label="活跃事件"
          value={events.data.filter((e) => e.status === "live" || e.status === "upcoming").length}
          hint="社群投票 / 见面会 / 挑战赛"
          tone="violet"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section
          className="xl:col-span-2"
          title={<div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> 月度收益（credits）</div>}
          description="近 6 个月平台总收益（未扣结算费）"
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueMonthly.data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tickFormatter={(v) => formatCompactNumber(v as number)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  formatter={(v) => formatCredits(v as number)}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="收益构成" description="本月各业务线占比">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueSources.data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                  {revenueSources.data.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Recent rows */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section
          className="xl:col-span-2"
          title={<div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> 最近流水</div>}
          description="结算中心入口 · 点击查看详情"
          actions={<Link href="/finance/ledger" className="text-xs text-primary hover:underline">查看全部 →</Link>}
          padding={false}
        >
          <div className="divide-y divide-border">
            {transactions.data.slice(0, 6).map((t) => {
              const s = TRANSACTION_STATUS[t.status];
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{t.source}</div>
                    <div className="text-xs text-muted-foreground">{t.date} · 用户 {t.userId ?? "—"}</div>
                  </div>
                  <div className={`tabular-nums font-medium ${t.amount >= 0 ? "text-success" : "text-destructive"}`}>
                    {t.amount >= 0 ? "+" : ""}{formatCredits(t.amount)}
                  </div>
                  {s && <StatusBadge tone={mapTone(s.tone)} label={s.label} />}
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="近期社群活动"
          description="正在进行 / 即将开始"
          padding={false}
        >
          <div className="divide-y divide-border">
            {upcomingEvents.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">暂无活动</div>
            )}
            {upcomingEvents.map((e) => {
              const s = COMMUNITY_EVENT_STATUS[e.status];
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {COMMUNITY_EVENT_TYPE[e.type]} · {e.date}
                    </div>
                  </div>
                  {s && <StatusBadge tone={mapTone(s.tone)} label={s.label} />}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Platform health bar */}
      <div className="mt-6">
        <Section title="平台播放分布" description="主要分发渠道的近 30 天播放量">
          <PlatformBars />
        </Section>
      </div>
    </>
  );
}

function PlatformBars() {
  const { data } = useAsyncList(async () => {
    const { getPlatformViewStats } = await import("@/api/distribution");
    return getPlatformViewStats();
  });

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis tickFormatter={(v) => formatCompactNumber(v as number)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <Tooltip
            formatter={(v) => formatCompactNumber(v as number)}
            contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }}
          />
          <Bar dataKey="views" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
