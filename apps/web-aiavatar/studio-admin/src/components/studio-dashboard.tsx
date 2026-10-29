"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  DatabaseZap,
  ExternalLink,
  Gift,
  ImageIcon,
  Info,
  Layers3,
  ListFilter,
  RefreshCw,
  Search,
  ServerCog,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Video,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  StudioCreditEventPage,
  StudioIntegrationState,
  StudioLatency,
  StudioOperationsDashboard as DashboardData,
  StudioReconciliationDetailPage,
} from "@ai-star-eco/types/studio-operations";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@ai-star-eco/ui/ui/sheet";
import { Skeleton } from "@ai-star-eco/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ai-star-eco/ui/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ai-star-eco/ui/ui/tooltip";
import { ApiError, StudioOperationsApi } from "@/lib/api";

type View = "business" | "technology";
type Days = 1 | 7 | 30;

const int = (value: number) => value.toLocaleString("zh-CN");
const yuan = (value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cents = (value: number) => yuan(value / 100);
const rate = (value: number | null) => value == null ? "样本不足" : `${(value * 100).toFixed(1)}%`;
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(value)) : "未接入";

function demoOutcomes(statuses: Array<"ok" | "issue" | "active" | "no_calls">) {
  const end = new Date();
  end.setMinutes(end.getMinutes() < 30 ? 0 : 30, 0, 0);
  return Array.from({ length: 48 }, (_, index) => {
    const status = statuses[index % statuses.length];
    const startedAt = new Date(end.getTime() - (47 - index) * 30 * 60_000).toISOString();
    return {
      startedAt,
      minutes: 30,
      succeeded: status === "ok" ? 2 + (index % 4) : 0,
      failed: status === "issue" ? 1 : 0,
      inFlight: status === "active" ? 1 : 0,
      status,
    };
  });
}

/** Development-only visual fixture. The production branch can never select it. */
function withDemoTechnology(data: DashboardData): DashboardData {
  return {
    ...data,
    generatedAt: new Date().toISOString(),
    business: {
      ...data.business,
      consumerActivity: { activeConsumers: 128, firstTimeConsumers: 31, returningConsumers: 97, rechargeConsumerStatus: "unavailable", note: "演示：消费用户按已结算且实际扣费任务去重。" },
      cashFlow: { paidUsers: 42, paidOrders: 57, paidAmountCents: 268900, refundedUsers: 3, refundedOrders: 3, refundedAmountCents: 18900, note: "演示：真实到账与退款，不等同于收入。" },
      directorFunnel: { status: "available", projects: 96, projectsWithEpisodes: 81, projectsWithStoryboards: 63, projectsWithVideos: 41, episodes: 184, clips: 628, storyboards: 402, videos: 219, note: "演示：当前快照；推进率始终按同一批项目去重计算。" },
    },
    technology: {
      ...data.technology,
      models: [
        { key: "gpt-image-2", supplier: "CATech", mediaType: "图片", jobs: 116, succeeded: 110, failed: 4, inFlight: 2, successRate: 110 / 114, ownership: "混合", successWindows: [{ label: "24 小时", samples: 114, successRate: 110 / 114 }, { label: "7 天", samples: 624, successRate: .971 }, { label: "30 天", samples: 2418, successRate: .966 }], outcomeBuckets: demoOutcomes(["ok", "ok", "ok", "no_calls", "ok", "issue"]) },
        { key: "minimax-h3", supplier: "聚算视频", mediaType: "视频", jobs: 74, succeeded: 69, failed: 3, inFlight: 2, successRate: 69 / 72, ownership: "混合", successWindows: [{ label: "24 小时", samples: 72, successRate: 69 / 72 }, { label: "7 天", samples: 338, successRate: .944 }, { label: "30 天", samples: 1352, successRate: .938 }], outcomeBuckets: demoOutcomes(["ok", "ok", "no_calls", "ok", "active", "ok"]) },
        { key: "seedance-1.0-pro", supplier: "方舟视频", mediaType: "视频", jobs: 42, succeeded: 40, failed: 1, inFlight: 1, successRate: 40 / 41, ownership: "混合", successWindows: [{ label: "24 小时", samples: 41, successRate: 40 / 41 }, { label: "7 天", samples: 207, successRate: .952 }, { label: "30 天", samples: 824, successRate: .948 }], outcomeBuckets: demoOutcomes(["no_calls", "ok", "ok", "ok", "ok", "active"]) },
      ],
      failureReasons: [
        { category: "timeout", label: "超时", count: 3, ownership: "供应商" },
        { category: "rejected", label: "供应商拒绝", count: 2, ownership: "供应商" },
        { category: "invalid_request", label: "请求参数", count: 1, ownership: "我方请求" },
        { category: "unknown", label: "未知", count: 2, ownership: "未知" },
      ],
      imageLatency: { mediaType: "图片", p50Seconds: 42, p95Seconds: 96, samples: 110, note: "演示样本：完成时间减开始时间，展示 P50 / P95。" },
      videoLatency: { mediaType: "视频", p50Seconds: 188, p95Seconds: 412, samples: 109, note: "演示样本：完成时间减开始时间，图片与视频分开统计。" },
      queue: { ...data.technology.queue, queued: 5, averageWaitSeconds: 18, pendingReconciliation: 2 },
      supplier: { ...data.technology.supplier, platformRequestErrors: 1, supplierErrors: 5, unknownErrors: 2, dailyUsage: 232, quotaStatus: "linked", alerts: [{ severity: "warning", type: "error-rate", providerId: "jusuan", providerName: "聚算视频", title: "近 24 小时失败率升高", message: "失败 3 / 72 个终态样本", metricValue: 3, threshold: 2, href: "/platform/ai-models?tab=usage&providerId=jusuan" }], usageRanking: [{ providerId: "catech", providerName: "CATech", calls: 116, estimatedCostMicros: 0 }, { providerId: "jusuan", providerName: "聚算视频", calls: 74, estimatedCostMicros: 0 }, { providerId: "ark", providerName: "方舟视频", calls: 42, estimatedCostMicros: 0 }] },
      outputs: { submittedTasks: 232, terminalSuccesses: 219, terminalFailures: 8, imageAssets: 142, videoAssets: 77, note: "演示：任务提交与实际持久化产物分开统计。" },
    },
  };
}

function demoDashboard(): DashboardData {
  const now = new Date();
  const dailySpend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() - (6 - index) * 86_400_000);
    return { date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(day), walletCredits: 6400 + index * 830, grantCredits: 1500 + (index % 3) * 470 };
  });
  return withDemoTechnology({
    generatedAt: now.toISOString(), timezone: "Asia/Shanghai",
    window: { days: 7, startInclusive: new Date(now.getTime() - 7 * 86_400_000).toISOString(), endExclusive: now.toISOString(), label: "近 7 天" },
    health: { status: "partial", checks: "ABCDEFGHI".split("").map((id) => ({ id, label: `对账项 ${id}`, count: 0, status: "ok", detailAvailable: false })), stuckHoldsOverSixHours: 0, abnormalModels: 0, reconciliationAgent: { status: "unavailable", observedAt: null, conclusion: null, note: "演示模式不读取对账 agent", href: null } },
    business: {
      totals: { walletCredits: 62110, grantCredits: 13820, totalCredits: 75930, yuanEquivalent: 759.3 }, dailySpend,
      models: [{ endpointId: "gpt-image-2", name: "GPT Image 2", jobs: 116, succeeded: 110, refunded: 4, inFlight: 2, credits: 34800, walletCredits: 28600, grantCredits: 6200 }, { endpointId: "minimax-h3", name: "MiniMax H3", jobs: 74, succeeded: 69, refunded: 3, inFlight: 2, credits: 28700, walletCredits: 23100, grantCredits: 5600 }],
      features: [{ feature: "出图", jobs: 116, succeeded: 110, refunded: 4, inFlight: 2, credits: 34800 }, { feature: "视频", jobs: 116, succeeded: 109, refunded: 4, inFlight: 3, credits: 28700 }, { feature: "对话", jobs: 46, succeeded: 45, refunded: 1, inFlight: 0, credits: 5310 }, { feature: "导演台", jobs: 28, succeeded: 27, refunded: 1, inFlight: 0, credits: 4720 }, { feature: "短剧", jobs: 13, succeeded: 12, refunded: 0, inFlight: 1, credits: 2400 }, { feature: "其他", jobs: 0, succeeded: 0, refunded: 0, inFlight: 0, credits: 0 }],
      issuance: { issuedCredits: 98600, yuanEquivalent: 986, walletBalance: 1248000, grantAvailable: 318400, usageAttributionStatus: "unavailable", note: "演示：普通赠送进入混合余额，不能逐笔归因实际使用。" },
      consumerActivity: { activeConsumers: 0, firstTimeConsumers: 0, returningConsumers: 0, rechargeConsumerStatus: "unavailable", note: "演示覆盖" }, cashFlow: { paidUsers: 0, paidOrders: 0, paidAmountCents: 0, refundedUsers: 0, refundedOrders: 0, refundedAmountCents: 0, note: "演示覆盖" }, directorFunnel: { status: "unavailable", projects: null, projectsWithEpisodes: null, projectsWithStoryboards: null, projectsWithVideos: null, episodes: null, clips: null, storyboards: null, videos: null, note: "演示覆盖" },
    },
    technology: { models: [], failureReasons: [], imageLatency: { mediaType: "图片", p50Seconds: null, p95Seconds: null, samples: 0, note: "演示覆盖" }, videoLatency: { mediaType: "视频", p50Seconds: null, p95Seconds: null, samples: 0, note: "演示覆盖" }, queue: { queued: 0, averageWaitSeconds: null, concurrencyRemaining: null, concurrencyStatus: "unavailable", pendingReconciliation: 0, note: "演示覆盖" }, supplier: { platformRequestErrors: 0, supplierErrors: 0, unknownErrors: 0, rateLimited: null, dailyUsage: null, quotaRemaining: null, quotaStatus: "unavailable", alerts: [], usageRanking: [] }, outputs: { submittedTasks: 0, terminalSuccesses: 0, terminalFailures: 0, imageAssets: 0, videoAssets: 0, note: "演示覆盖" } },
    integrations: { release: { status: "unavailable", observedAt: null, conclusion: null, note: "演示模式不读取发布清单", href: null }, feishuAlerts: { status: "unavailable", observedAt: null, conclusion: null, note: "演示模式不发送告警", href: null }, requestLogs: { status: "linked", observedAt: null, conclusion: "使用现有页面", note: "不重复建设", href: "/platform/error-logs" } },
  });
}

export function StudioDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const demoMode = process.env.NODE_ENV !== "production" && searchParams.get("demo") === "1";
  const view: View = searchParams.get("view") === "technology" ? "technology" : "business";
  const days: Days = searchParams.get("days") === "1" ? 1 : searchParams.get("days") === "30" ? 30 : 7;
  const [data, setData] = React.useState<DashboardData>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [forbidden, setForbidden] = React.useState(false);
  const [healthCheck, setHealthCheck] = React.useState<string>();
  const [eventsOpen, setEventsOpen] = React.useState(false);

  const syncWindow = React.useCallback((nextDays: Days) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    params.set("days", String(nextDays));
    router.replace(`/?${params.toString()}${window.location.hash}`, { scroll: false });
  }, [router, searchParams, view]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const next = await StudioOperationsApi.dashboard(days);
      setData(demoMode ? withDemoTechnology(next) : next);
    } catch (cause) {
      if (demoMode) {
        setData(demoDashboard());
        return;
      }
      setForbidden(cause instanceof ApiError && cause.status === 403);
      setError(cause instanceof Error ? cause.message : "无法加载 Studio 运营数据");
    } finally {
      setLoading(false);
    }
  }, [days, demoMode]);

  React.useEffect(() => { void load(); }, [load]);
  const stale = data ? Date.now() - new Date(data.generatedAt).getTime() > 10 * 60_000 : false;

  const setWindowDays = (next: string) => {
    const value = Number(next) as Days;
    syncWindow(value);
  };

  return (
    <div className="mx-auto max-w-[1760px] space-y-4 px-3 py-4 sm:px-5 md:space-y-5 md:px-7 md:py-6 xl:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-9 items-center gap-2">
          <span className="text-xs text-slate-500">统计窗口按北京时间计算</span>
          {demoMode && <Badge variant="outline" className="border-[#d9d1de] bg-[#f1edf3] text-[#74667f]">本地演示数据</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={setWindowDays} disabled={loading}>
            <SelectTrigger className="w-[124px] bg-white" aria-label="统计窗口"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">今天</SelectItem><SelectItem value="7">近 7 天</SelectItem><SelectItem value="30">近 30 天</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" className="bg-white" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />{loading ? "刷新中" : "刷新"}
          </Button>
        </div>
      </div>

      {loading && !data && <DashboardSkeleton />}
      {error && !data && <LoadError message={error} forbidden={forbidden} retry={() => void load()} />}
      {data && (
        <>
          <HealthOverview data={data} stale={stale} onDetail={setHealthCheck} />
          <OverviewHero data={data} view={view} stale={stale} />
          <KpiGrid data={data} view={view} />
          {view === "business"
            ? <BusinessView data={data} onEvents={() => setEventsOpen(true)} />
            : <TechnologyView data={data} />}
        </>
      )}

      <ReconciliationSheet check={healthCheck} onOpenChange={(open) => !open && setHealthCheck(undefined)} />
      <CreditEventsSheet open={eventsOpen} days={days} onOpenChange={setEventsOpen} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="正在加载看板" className="space-y-4">
      <Skeleton className="h-44 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function LoadError({ message, forbidden, retry }: { message: string; forbidden: boolean; retry: () => void }) {
  return (
    <Card role="alert" className="studio-panel border-red-200 bg-white">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600"><ShieldAlert /></span>
        <div><h2 className="font-semibold">{forbidden ? "没有查看权限" : "数据加载失败"}</h2><p className="mt-1 max-w-xl text-sm text-slate-500">{message}</p></div>
        {!forbidden && <Button variant="outline" onClick={retry}><RefreshCw />重试</Button>}
      </CardContent>
    </Card>
  );
}

function OverviewHero({ data, view, stale }: { data: DashboardData; view: View; stale: boolean }) {
  const issueCount = data.health.checks.filter((item) => item.count > 0).length
    + (data.health.stuckHoldsOverSixHours > 0 ? 1 : 0)
    + (data.health.abnormalModels > 0 ? 1 : 0);
  const taskCount = data.technology.models.reduce((sum, item) => sum + item.jobs, 0);
  return (
    <section className="studio-hero studio-grid relative overflow-hidden rounded-xl p-5 text-slate-900 sm:p-7 md:min-h-44 md:p-8">
      <div className="relative z-10 flex h-full flex-col justify-between gap-7 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            <DatabaseZap className="size-3.5" /> 北京时间口径 · {data.window.label}
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{view === "business" ? "经营数据，一屏掌握" : "生成链路，持续可见"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {view === "business"
              ? "普通积分与模型赠款分桶统计；人民币换算只用于运营观察，不代表收入或毛利。"
              : "运行中不计入失败率，账务退回率不冒充技术失败率；缺失采集明确标注为未接入。"}
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="size-3.5" />数据时点 {dateTime(data.generatedAt)}
            {stale && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">数据已陈旧</Badge>}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:min-w-[360px]">
          <div className="bg-slate-50 p-4 sm:p-5"><p className="text-xs text-slate-500">{view === "business" ? "窗口消耗" : "生成任务"}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{view === "business" ? int(data.business.totals.totalCredits) : int(taskCount)}</p><p className="mt-1 text-[11px] text-slate-400">{view === "business" ? "积分" : "当前窗口"}</p></div>
          <div className="bg-slate-50 p-4 sm:p-5"><p className="text-xs text-slate-500">需关注</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{int(issueCount)}</p><p className="mt-1 text-[11px] text-slate-400">{issueCount ? "健康项异常" : "当前无异常计数"}</p></div>
        </div>
      </div>
    </section>
  );
}

function KpiGrid({ data, view }: { data: DashboardData; view: View }) {
  const models = data.technology.models;
  const terminal = models.reduce((sum, item) => sum + item.succeeded + item.failed, 0);
  const success = models.reduce((sum, item) => sum + item.succeeded, 0);
  const totalTasks = models.reduce((sum, item) => sum + item.jobs, 0);
  const failures = models.reduce((sum, item) => sum + item.failed, 0);
  const items = view === "business"
    ? [
        { label: "总消耗", value: `${int(data.business.totals.totalCredits)} 积分`, detail: `约 ${yuan(data.business.totals.yuanEquivalent)} · 非收入`, icon: Coins, tone: "indigo" },
        { label: "普通积分消耗", value: int(data.business.totals.walletCredits), detail: "SPEND 流水", icon: WalletCards, tone: "cyan" },
        { label: "模型赠款消耗", value: int(data.business.totals.grantCredits), detail: "SCOPED_SPEND 流水", icon: Gift, tone: "emerald" },
        { label: "窗口内发出积分", value: int(data.business.issuance.issuedCredits), detail: `约 ${yuan(data.business.issuance.yuanEquivalent)} · 非营收`, icon: CircleDollarSign, tone: "amber" },
        { label: "普通钱包余额", value: int(data.business.issuance.walletBalance), detail: "不含模型赠款", icon: Boxes, tone: "violet" },
        { label: "赠款可用与冻结", value: int(data.business.issuance.grantAvailable), detail: "待兑现算力 · 独立分桶", icon: Layers3, tone: "rose" },
      ]
    : [
        { label: "生成任务", value: int(totalTasks), detail: data.window.label, icon: Sparkles, tone: "indigo" },
        { label: "终态成功率", value: terminal ? `${(success / terminal * 100).toFixed(1)}%` : "样本不足", detail: "只含成功 + 失败", icon: CheckCircle2, tone: "emerald" },
        { label: "终态失败", value: int(failures), detail: "不含运行中与排队", icon: XCircle, tone: "rose" },
        { label: "当前排队", value: int(data.technology.queue.queued), detail: "不会计入失败率", icon: Clock3, tone: "cyan" },
        { label: "受理待核对", value: int(data.technology.queue.pendingReconciliation), detail: "不会自动重提", icon: TriangleAlert, tone: "amber" },
        { label: "并发余量", value: data.technology.queue.concurrencyRemaining == null ? "未接入" : int(data.technology.queue.concurrencyRemaining), detail: "无统一采集时不显示 0", icon: ServerCog, tone: "violet" },
      ];
  return (
    <section aria-label="关键指标" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => <KpiCard key={item.label} {...item} />)}
    </section>
  );
}

const KPI_TONES: Record<string, string> = {
  indigo: "bg-[#e8edf5] text-[#58709b]",
  cyan: "bg-[#e6eef0] text-[#5f7d84]",
  emerald: "bg-[#e7eee9] text-[#627d6c]",
  amber: "bg-[#f3ece3] text-[#947852]",
  violet: "bg-[#eeeaf1] text-[#796c84]",
  rose: "bg-[#f2e9ea] text-[#956d72]",
};

function KpiCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: string }) {
  return (
    <Card className="studio-panel relative min-h-32 gap-0 overflow-hidden border-slate-200 bg-white">
      <CardContent className="relative flex h-full items-center justify-between gap-3 p-5">
        <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 truncate text-xl font-bold tabular-nums text-slate-950">{value}</p><p className="mt-1 truncate text-[11px] text-slate-400">{detail}</p></div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${KPI_TONES[tone]}`}><Icon className="size-5" /></span>
      </CardContent>
    </Card>
  );
}

function HealthOverview({ data, stale, onDetail }: { data: DashboardData; stale: boolean; onDetail: (id: string) => void }) {
  const issues = data.health.checks.filter((item) => item.count > 0).length;
  const partial = data.health.reconciliationAgent.status !== "linked" || stale;
  return (
    <Card id="health" className="studio-panel scroll-mt-36 gap-0 overflow-hidden border-slate-200 sm:scroll-mt-24">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b bg-white px-5 py-4">
        <div><CardTitle className="flex items-center gap-2 text-sm font-semibold"><span className={`size-2 rounded-full ${issues ? "bg-red-500" : partial ? "bg-amber-500" : "bg-emerald-500"}`} />共用健康状态</CardTitle><CardDescription className="mt-1 text-xs">A–I 即时只读重算；加载失败、陈旧和未接入不会显示健康绿色。</CardDescription></div>
        <Badge variant="outline" className={issues ? "border-red-200 bg-red-50 text-red-700" : partial ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
          {issues ? `${issues} 项异常` : partial ? "部分数据未接入" : "全部正常"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {data.health.checks.map((item) => (
          <button key={item.id} type="button" disabled={!item.detailAvailable} onClick={() => onDetail(item.id)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-left text-xs outline-none transition hover:border-blue-200 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:border-border disabled:hover:bg-slate-50">
            <span className="min-w-0 truncate"><b className="mr-1 text-slate-800">{item.id}</b>{item.label}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${item.count ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{int(item.count)}</span>
          </button>
        ))}
        <HealthFact label="冻结超过 6 小时" value={data.health.stuckHoldsOverSixHours} />
        <HealthFact label="异常退回模型" value={data.health.abnormalModels} />
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><span>对账 Agent</span><span className="font-semibold">未接入</span></div>
      </CardContent>
    </Card>
  );
}

function HealthFact({ label, value }: { label: string; value: number }) {
  return <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs"><span>{label}</span><span className={value ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{int(value)}</span></div>;
}

function BusinessView({ data, onEvents }: { data: DashboardData; onEvents: () => void }) {
  return (
    <div id="spend" className="scroll-mt-36 space-y-5 sm:scroll-mt-24">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,.8fr)]">
        <Card className="studio-panel gap-0 border-slate-200">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm font-semibold">每日积分消耗</CardTitle>
            <CardDescription className="text-xs">北京时间自然日；普通积分与模型赠款分开统计，不重复计数。</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {data.business.dailySpend.length ? <SpendChart data={data.business.dailySpend} /> : <EmptyState icon={Coins} title="当前窗口没有消费流水" />}
          </CardContent>
        </Card>
        <FeatureOverview data={data} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.35fr)]">
        <ConsumersAndCashPanel data={data} />
        <DirectorFunnelPanel data={data} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,.85fr)]">
        <Card className="studio-panel gap-0 overflow-hidden border-slate-200">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm font-semibold">模型消耗概览</CardTitle>
            <CardDescription className="text-xs">成功=COMMITTED，退回=RELEASED，进行中=ACTIVE。</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <ModelSpendTable rows={data.business.models} />
          </CardContent>
        </Card>

        <Card id="issuance" className="studio-panel scroll-mt-36 gap-0 border-slate-200 sm:scroll-mt-24">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="size-4 text-[#4f6692]" />发出积分核对</CardTitle>
            <CardDescription className="text-xs">普通余额与模型赠款是两套分桶，不合并冒充总收入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="窗口内发出" value={`${int(data.business.issuance.issuedCredits)} 积分`} />
              <MiniMetric label="折算观察值" value={yuan(data.business.issuance.yuanEquivalent)} />
              <MiniMetric label="普通钱包余额" value={int(data.business.issuance.walletBalance)} />
              <MiniMetric label="赠款可用 + 冻结" value={int(data.business.issuance.grantAvailable)} />
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <b>赠送实际使用比例：未具备数据</b><br />{data.business.issuance.note}
            </div>
            <Button variant="outline" className="w-full" onClick={onEvents}><ListFilter />查看只读发放明细</Button>
          </CardContent>
        </Card>
      </div>
      <PhaseTwoNote />
    </div>
  );
}

function ConsumersAndCashPanel({ data }: { data: DashboardData }) {
  const { consumerActivity, cashFlow } = data.business;
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-[#5f7d84]" />消费用户与真实到账</CardTitle>
        <CardDescription className="text-xs">消费和现金流各用自己的口径，不互相代替。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="窗口消费用户" value={int(consumerActivity.activeConsumers)} />
          <MiniMetric label="首次 / 回访消费" value={`${int(consumerActivity.firstTimeConsumers)} / ${int(consumerActivity.returningConsumers)}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#dce7df] bg-[#f2f6f3] p-3"><p className="text-[11px] text-slate-500">真实到账</p><p className="mt-1 font-semibold tabular-nums">{cents(cashFlow.paidAmountCents)}</p><p className="mt-1 text-[10px] text-slate-500">{int(cashFlow.paidUsers)} 人 · {int(cashFlow.paidOrders)} 单 · 非收入</p></div>
          <div className="rounded-xl border border-[#eadfda] bg-[#f8f3f1] p-3"><p className="text-[11px] text-slate-500">现金退款</p><p className="mt-1 font-semibold tabular-nums">{cents(cashFlow.refundedAmountCents)}</p><p className="mt-1 text-[10px] text-slate-500">{int(cashFlow.refundedUsers)} 人 · {int(cashFlow.refundedOrders)} 单</p></div>
        </div>
        <p className="text-[11px] leading-5 text-slate-500">{consumerActivity.note} {cashFlow.note}</p>
      </CardContent>
    </Card>
  );
}

function DirectorFunnelPanel({ data }: { data: DashboardData }) {
  const funnel = data.business.directorFunnel;
  const projects = funnel.projects ?? 0;
  const steps = [
    { label: "项目", projects: funnel.projects, volume: funnel.projects },
    { label: "已建剧集", projects: funnel.projectsWithEpisodes, volume: funnel.episodes },
    { label: "有效分镜", projects: funnel.projectsWithStoryboards, volume: funnel.storyboards },
    { label: "可用视频", projects: funnel.projectsWithVideos, volume: funnel.videos },
  ];
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4 text-[#796c84]" />导演台创作推进</CardTitle>
        <CardDescription className="text-xs">当前快照；推进率按同一批项目去重，实体数量只作为创作规模展示。</CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {funnel.status !== "available" ? <EmptyState icon={Layers3} title="导演台聚合源暂不可用" /> : <>
          <div className="grid gap-2 sm:grid-cols-4">
            {steps.map((step, index) => {
              const percent = index === 0 ? 100 : projects ? Math.round(((step.projects ?? 0) / projects) * 100) : 0;
              return <div key={step.label} className="relative overflow-hidden rounded-xl border bg-slate-50 p-3">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100"><span className="block h-full bg-[#7086a8]" style={{ width: `${percent}%` }} /></div>
                <p className="text-[11px] text-slate-500">{index + 1}. {step.label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{int(step.projects ?? 0)} <span className="text-xs font-normal text-slate-400">项目</span></p><p className="text-[10px] text-slate-500">推进率 {percent}% · 规模 {int(step.volume ?? 0)}</p>
              </div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500"><span>剧集 {int(funnel.episodes ?? 0)}</span><span>片段 {int(funnel.clips ?? 0)}</span><span>有效分镜 {int(funnel.storyboards ?? 0)}</span><span>可用视频 {int(funnel.videos ?? 0)}</span></div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">{funnel.note}</p>
        </>}
      </CardContent>
    </Card>
  );
}

function SpendChart({ data }: { data: DashboardData["business"]["dailySpend"] }) {
  return (
    <div className="h-[300px] w-full" role="img" aria-label="普通积分和模型赠款每日消耗折线图">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="walletFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#526fa4" stopOpacity={0.18}/><stop offset="95%" stopColor="#526fa4" stopOpacity={0}/></linearGradient>
            <linearGradient id="grantFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#718a79" stopOpacity={0.14}/><stop offset="95%" stopColor="#718a79" stopOpacity={0}/></linearGradient>
          </defs>
          <CartesianGrid stroke="#e9edf5" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11, fill: "#8490a5" }} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis tick={{ fontSize: 11, fill: "#8490a5" }} tickLine={false} axisLine={false} width={52} tickFormatter={(value: number) => value >= 10_000 ? `${Math.round(value / 10_000)}万` : String(value)} />
          <ChartTooltip contentStyle={{ borderRadius: 12, borderColor: "#e3e8f2", boxShadow: "0 10px 28px rgba(15,23,42,.08)" }} formatter={(value: number | string, name: string) => [int(Number(value)), name === "walletCredits" ? "普通积分" : "模型赠款"]} labelFormatter={(label) => `北京时间 ${label}`} />
          <Legend formatter={(value) => value === "walletCredits" ? "普通积分" : "模型赠款"} />
          <Area type="monotone" dataKey="walletCredits" stroke="#526fa4" strokeWidth={2.25} fill="url(#walletFill)" dot={false} />
          <Area type="monotone" dataKey="grantCredits" stroke="#718a79" strokeWidth={2.25} fill="url(#grantFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FeatureOverview({ data }: { data: DashboardData }) {
  const features = data.business.features;
  const total = features.reduce((sum, item) => sum + item.credits, 0);
  const colors = ["bg-[#5d76a1]", "bg-[#6f8980]", "bg-[#9b825f]", "bg-[#81748d]", "bg-[#8b9bab]", "bg-slate-400"];
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="text-sm font-semibold">功能消耗构成</CardTitle>
        <CardDescription className="text-xs">条形仅表示当前窗口积分消耗占比，不是业务转化率。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {features.map((item, index) => {
          const share = total ? item.credits / total * 100 : 0;
          return (
            <div key={item.feature}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 font-medium"><span className={`size-2 rounded-full ${colors[index]}`} />{item.feature}</span>
                <span className="tabular-nums text-slate-500">{int(item.credits)} 积分 · {int(item.jobs)} 任务</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${colors[index]}`} style={{ width: `${share}%` }} /></div>
            </div>
          );
        })}
        {!total && <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">当前窗口暂无功能消耗</p>}
      </CardContent>
    </Card>
  );
}

function ModelSpendTable({ rows }: { rows: DashboardData["business"]["models"] }) {
  if (!rows.length) return <EmptyState icon={Coins} title="当前窗口没有模型扣费记录" />;
  return (
    <Table>
      <TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-5">模型 / 接入点</TableHead><TableHead className="text-right">任务</TableHead><TableHead className="text-right">成功 / 退回 / 进行中</TableHead><TableHead className="text-right">普通 / 赠款</TableHead><TableHead className="pr-5 text-right">消耗</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.endpointId}><TableCell className="pl-5"><div className="font-medium text-slate-900">{row.name}</div><div className="text-[11px] text-slate-400">{row.endpointId}</div></TableCell><TableCell className="text-right tabular-nums">{int(row.jobs)}</TableCell><TableCell className="text-right tabular-nums"><span className="text-emerald-600">{int(row.succeeded)}</span> / <span className="text-rose-600">{int(row.refunded)}</span> / {int(row.inFlight)}</TableCell><TableCell className="text-right tabular-nums">{int(row.walletCredits)} / {int(row.grantCredits)}</TableCell><TableCell className="pr-5 text-right font-semibold tabular-nums">{int(row.credits)}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 font-semibold tabular-nums text-slate-900">{value}</p></div>;
}

function TechnologyView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-5">
      <ModelMonitor data={data} />
      <section id="failure-analysis" aria-label="失败与耗时" className="scroll-mt-36 space-y-5 sm:scroll-mt-24">
        <div className="grid gap-5 xl:grid-cols-2">
          <LatencyPanel latency={data.technology.imageLatency} />
          <LatencyPanel latency={data.technology.videoLatency} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <FailurePanel data={data} />
          <SupplierPanel data={data} />
        </div>
      </section>
      <IntegrationsPanel integrations={data.integrations} />
      <PhaseTwoNote technical />
    </div>
  );
}

function ModelMonitor({ data }: { data: DashboardData }) {
  const models = data.technology.models;
  const suppliers = React.useMemo(() => Array.from(new Set(models.map((item) => item.supplier))), [models]);
  const [supplier, setSupplier] = React.useState("全部");
  const [query, setQuery] = React.useState("");
  const visible = models.filter((model) =>
    (supplier === "全部" || model.supplier === supplier)
    && (!query.trim() || `${model.key} ${model.supplier} ${model.mediaType}`.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const failed = visible.reduce((sum, item) => sum + item.failed, 0);
  const active = visible.reduce((sum, item) => sum + item.inFlight, 0);

  return (
    <Card id="models" className="studio-panel scroll-mt-36 gap-0 overflow-hidden border-slate-200 sm:scroll-mt-24">
      <CardHeader className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-[#4f6692]" />供应商与模型运行情况</CardTitle><CardDescription className="mt-1 text-xs">成功率只含终态；近 24 小时色块表示任务结果，不表示服务在线率。</CardDescription></div>
          <div className="relative w-full lg:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="bg-white pl-9" placeholder="搜索供应商或模型" aria-label="搜索供应商或模型" /></div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto border-b bg-slate-50/80 px-4 py-3">
          <div className="flex min-w-max gap-2">
            {["全部", ...suppliers].map((name) => {
              const group = name === "全部" ? models : models.filter((item) => item.supplier === name);
              const groupFailed = group.reduce((sum, item) => sum + item.failed, 0);
              return <Button key={name} size="sm" variant={supplier === name ? "default" : "outline"} className={supplier === name ? "shadow-sm" : "bg-white"} onClick={() => setSupplier(name)}><span className={`size-1.5 rounded-full ${groupFailed ? "bg-red-400" : group.length ? "bg-emerald-400" : "bg-slate-300"}`} />{name}<span className="text-[10px] opacity-70">({group.length})</span></Button>;
            })}
          </div>
        </div>
        <div className="space-y-2.5 p-4">
          <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${failed ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            <span className="flex items-center gap-2 font-semibold">{failed ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}{failed ? "当前筛选存在终态失败" : "当前筛选暂无终态失败"}</span>
            <span>{int(visible.length)} 个模型 · {int(failed)} 个失败任务 · {int(active)} 个进行中</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 font-semibold"><Activity className="size-4" />任务队列</span>
            <span>排队 {int(data.technology.queue.queued)} · 平均等待 {data.technology.queue.averageWaitSeconds == null ? "样本不足" : `${int(data.technology.queue.averageWaitSeconds)} 秒`} · 并发余量 {data.technology.queue.concurrencyRemaining == null ? "未接入" : int(data.technology.queue.concurrencyRemaining)}</span>
          </div>
          <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 text-xs sm:grid-cols-5">
            <RuntimeMetric label="提交任务" value={int(data.technology.outputs.submittedTasks)} />
            <RuntimeMetric label="终态成功" value={int(data.technology.outputs.terminalSuccesses)} />
            <RuntimeMetric label="终态失败" value={int(data.technology.outputs.terminalFailures)} tone={data.technology.outputs.terminalFailures ? "bad" : "normal"} />
            <RuntimeMetric label="实际图片产物" value={int(data.technology.outputs.imageAssets)} />
            <RuntimeMetric label="实际视频产物" value={int(data.technology.outputs.videoAssets)} />
          </div>
          {visible.length ? visible.map((model) => <ModelRuntimeCard key={`${model.supplier}:${model.mediaType}:${model.key}`} model={model} />) : <EmptyState icon={Search} title="没有符合筛选条件的模型" />}
        </div>
      </CardContent>
    </Card>
  );
}

function ModelRuntimeCard({ model }: { model: DashboardData["technology"]["models"][number] }) {
  const status = model.failed > 0 ? "异常" : model.inFlight > 0 ? "运行中" : model.jobs > 0 ? "正常" : "暂无任务";
  return (
    <div className="rounded-lg border bg-white p-3.5 transition hover:border-blue-200 hover:shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0 xl:w-[280px] xl:shrink-0">
          <div className="flex flex-wrap items-center gap-2"><span className={`size-2 rounded-full ${model.failed ? "bg-red-500" : model.inFlight ? "bg-blue-500" : model.jobs ? "bg-emerald-500" : "bg-slate-300"}`} /><strong className="truncate text-sm">{model.key}</strong><Badge variant="outline" className="text-[10px]">{model.mediaType}</Badge><Badge variant="outline" className={model.failed ? "border-red-200 bg-red-50 text-red-700" : model.inFlight ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{status}</Badge></div>
          <p className="mt-1 truncate pl-4 text-[11px] text-slate-400">{model.supplier} · {model.ownership}</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          {model.successWindows.map((window) => <RuntimeMetric key={window.label} label={`${window.label}成功率`} value={`${rate(window.successRate)} · ${int(window.samples)}样本`} tone={window.samples >= 5 && window.successRate != null && window.successRate < .5 ? "bad" : "normal"} />)}
          <RuntimeMetric label="成功 / 失败 / 进行中" value={`${int(model.succeeded)} / ${int(model.failed)} / ${int(model.inFlight)}`} tone={model.failed ? "bad" : "normal"} />
          <RuntimeMetric label="并发余量" value="未知" />
        </div>
      </div>
      <OutcomeTimeline outcomes={model.outcomeBuckets} />
    </div>
  );
}

function RuntimeMetric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "bad" }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] text-slate-400">{label}</p><p className={`mt-0.5 text-xs font-semibold tabular-nums ${tone === "bad" ? "text-red-600" : "text-slate-800"}`}>{value}</p></div>;
}

function OutcomeTimeline({ outcomes }: { outcomes: DashboardData["technology"]["models"][number]["outcomeBuckets"] }) {
  const colors: Record<string, string> = {
    ok: "bg-emerald-200",
    issue: "bg-rose-200",
    active: "bg-blue-200",
    no_calls: "bg-slate-200",
    missing: "border border-dashed border-slate-300 bg-transparent",
  };
  const labels: Record<string, string> = { ok: "有成功且无失败", issue: "存在失败", active: "仅有进行中任务", no_calls: "无调用", missing: "缺少覆盖" };
  return (
    <TooltipProvider delayDuration={100}>
      <div className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-[10px] text-slate-400">24h · 每格30分钟</span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
          {outcomes.map((item) => (
            <Tooltip key={item.startedAt}>
              <TooltipTrigger asChild><span tabIndex={0} className={`timeline-cell flex-1 outline-none ring-blue-500 focus-visible:ring-2 ${colors[item.status]}`} /></TooltipTrigger>
              <TooltipContent><div className="text-xs"><b>{dateTime(item.startedAt)}</b><br />{labels[item.status]} · 成功 {item.succeeded} / 失败 {item.failed} / 进行中 {item.inFlight}</div></TooltipContent>
            </Tooltip>
          ))}
        </div>
        <span className="shrink-0 text-[10px] text-slate-400">现在</span>
      </div>
    </TooltipProvider>
  );
}

function LatencyPanel({ latency }: { latency: StudioLatency }) {
  const rows = [
    { name: "P50", seconds: latency.p50Seconds || 0 },
    { name: "P95", seconds: latency.p95Seconds || 0 },
  ];
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">{latency.mediaType === "视频" ? <Video className="size-4 text-[#796c84]" /> : <ImageIcon className="size-4 text-[#58709b]" />}{latency.mediaType}耗时</CardTitle>
        <CardDescription className="text-xs">{latency.note}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_1.2fr]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
          <MiniMetric label="P50" value={latency.p50Seconds == null ? "—" : `${int(latency.p50Seconds)} 秒`} />
          <MiniMetric label="P95" value={latency.p95Seconds == null ? "—" : `${int(latency.p95Seconds)} 秒`} />
          <MiniMetric label="有效样本" value={int(latency.samples)} />
        </div>
        {latency.samples ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8490a5" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8490a5" }} />
                <ChartTooltip formatter={(value: number | string) => [`${int(Number(value))} 秒`, "耗时"]} />
                <Line type="monotone" dataKey="seconds" stroke={latency.mediaType === "视频" ? "#81748d" : "#5d76a1"} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="grid h-40 place-items-center rounded-xl border border-dashed text-xs text-slate-400">暂无完整耗时样本</div>}
      </CardContent>
    </Card>
  );
}

function FailurePanel({ data }: { data: DashboardData }) {
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="size-4 text-amber-600" />失败原因</CardTitle>
        <CardDescription className="text-xs">从稳定错误码与脱敏错误文案分类，无法判断归属时保留“未知”。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {data.technology.failureReasons.length ? data.technology.failureReasons.map((item) => (
          <div key={`${item.category}:${item.ownership}`} className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3">
            <div><span className="text-sm font-medium">{item.label}</span><Badge variant="outline" className={`ml-2 ${item.ownership === "供应商" ? "border-amber-200 bg-amber-50 text-amber-700" : item.ownership === "我方请求" ? "border-red-200 bg-red-50 text-red-700" : ""}`}>{item.ownership}</Badge></div>
            <strong className="tabular-nums">{int(item.count)}</strong>
          </div>
        )) : <EmptyState icon={CheckCircle2} title="当前窗口没有终态失败任务" />}
      </CardContent>
    </Card>
  );
}

function SupplierPanel({ data }: { data: DashboardData }) {
  const supplier = data.technology.supplier;
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL?.replace(/\/$/, "");
  return (
    <Card className="studio-panel gap-0 border-slate-200">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><ServerCog className="size-4 text-[#4f6692]" />错误归属与配额</CardTitle>
        <CardDescription className="text-xs">区分我方请求、供应商故障与未知；配额只有真实来源才展示。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="我方请求" value={int(supplier.platformRequestErrors)} />
          <MiniMetric label="供应商" value={int(supplier.supplierErrors)} />
          <MiniMetric label="未知" value={int(supplier.unknownErrors)} />
        </div>
        {supplier.alerts.length > 0 && <div className="space-y-2"><p className="text-[11px] font-medium text-slate-500">供应商异常</p>{supplier.alerts.map((alert) => {
          const href = adminUrl ? `${adminUrl}/admin${alert.href}` : null;
          const body = <><div><p className="font-medium text-slate-800">{alert.providerName} · {alert.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{alert.message}</p></div>{href && <ExternalLink className="size-4 shrink-0 text-slate-400" />}</>;
          return href ? <Link key={`${alert.providerId}:${alert.type}`} href={href} target="_blank" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs hover:border-amber-300">{body}</Link>
            : <div key={`${alert.providerId}:${alert.type}`} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">{body}</div>;
        })}</div>}
        {supplier.usageRanking.length > 0 && <div><p className="mb-2 text-[11px] font-medium text-slate-500">供应商调用排行</p><div className="space-y-2">{supplier.usageRanking.map((item, index) => <div key={item.providerId} className="flex items-center gap-3 text-xs"><span className="w-4 text-slate-400">{index + 1}</span><span className="min-w-0 flex-1 truncate">{item.providerName}</span><strong className="tabular-nums">{int(item.calls)} 次</strong></div>)}</div><p className="mt-2 text-[10px] text-slate-400">未展示估算成本：缺少完整定价覆盖率时不计算毛利。</p></div>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800"><Info className="size-4" />并发与配额</div>
          {supplier.quotaStatus === "linked" && supplier.dailyUsage != null ? `已接入调用量：${int(supplier.dailyUsage)}；限流次数和配额余量仍无可靠来源。` : "限流次数、每日用量与配额余量尚无统一数据源，因此不显示为 0。"}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsPanel({ integrations }: { integrations: DashboardData["integrations"] }) {
  return (
    <Card id="release-alerts" className="studio-panel scroll-mt-36 gap-0 border-slate-200 sm:scroll-mt-24">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><ServerCog className="size-4 text-[#4f6692]" />发版与告警</CardTitle>
        <CardDescription className="text-xs">发布清单与飞书记录需要安全只读适配器；不会由浏览器执行 SSH 或读取服务器环境变量。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 md:grid-cols-3">
        <IntegrationCard title="线上版本 / 发布时间" state={integrations.release} />
        <IntegrationCard title="飞书发送 / 失败记录" state={integrations.feishuAlerts} />
        <IntegrationCard title="请求日志" state={integrations.requestLogs} />
      </CardContent>
    </Card>
  );
}

function IntegrationCard({ title, state }: { title: string; state: StudioIntegrationState }) {
  const linked = state.status === "linked";
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  const href = adminUrl && state.href ? `${adminUrl.replace(/\/$/, "")}/admin${state.href}` : null;
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">{title}</strong><Badge variant="outline" className={linked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{linked ? "已接入" : "未接入"}</Badge></div>
      <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{state.conclusion || state.note}</p>
      {href ? <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0"><Link href={href} target="_blank">打开现有页面<ExternalLink /></Link></Button>
        : state.href && <p className="mt-2 text-[11px] text-slate-400">配置 NEXT_PUBLIC_ADMIN_APP_URL 后可跳转现有页面</p>}
    </div>
  );
}

function PhaseTwoNote({ technical = false }: { technical?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
      <b>第二期扩展位置已预留：</b>{technical
        ? "服务在线与重启、重启窗口 502、错误慢接口、磁盘 / 内存 / DB 连接和上传失败，需先接入可靠采集源。"
        : "用户消耗排行、低余额持续使用、每日消费者及赠款活动发 / 用 / 余 / 到期提醒，需按既定数据口径接入。"}
    </div>
  );
}

function EmptyState({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return <div className="grid min-h-36 place-items-center p-6 text-center"><div><span className="mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon className="size-5" /></span><p className="mt-2 text-sm text-slate-500">{title}</p></div></div>;
}

function ReconciliationSheet({ check, onOpenChange }: { check?: string; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = React.useState<StudioReconciliationDetailPage>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const read = React.useCallback(async (page = 0) => {
    if (!check) return;
    setLoading(true); setError("");
    try { setData(await StudioOperationsApi.reconciliationDetails(check, page)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "对账明细加载失败"); }
    finally { setLoading(false); }
  }, [check]);
  React.useEffect(() => { setData(undefined); if (check) void read(0); }, [check, read]);
  const columns = data?.items[0] ? Object.keys(data.items[0]) : [];
  return (
    <Sheet open={Boolean(check)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="border-b p-5"><SheetTitle>对账项 {check} · 账户明细</SheetTitle><SheetDescription>只读分页结果；账户标识用于定位，不包含完整手机号。</SheetDescription></SheetHeader>
        <div className="p-5">
          {loading && !data && <Skeleton className="h-48 w-full" />}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<Button variant="link" onClick={() => void read(data?.page || 0)}>重试</Button></div>}
          {data && data.items.length > 0 && <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map((row, index) => <TableRow key={index}>{columns.map((column) => <TableCell key={column} className="max-w-64 break-all text-xs">{row[column]}</TableCell>)}</TableRow>)}</TableBody></Table></div>}
          {data && !data.items.length && <EmptyState icon={CheckCircle2} title="该项已无异常，刷新主看板可更新状态" />}
          {data && <Pager page={data.page} total={data.total} hasMore={data.hasMore} loading={loading} onPage={(page) => void read(page)} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreditEventsSheet({ open, days, onOpenChange }: { open: boolean; days: Days; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = React.useState<StudioCreditEventPage>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [type, setType] = React.useState("ALL");
  const [query, setQuery] = React.useState("");
  const read = React.useCallback(async (page = 0) => {
    setLoading(true); setError("");
    try { setData(await StudioOperationsApi.creditEvents(days, page, type === "ALL" ? undefined : type, query.trim() || undefined)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "发放明细加载失败"); }
    finally { setLoading(false); }
  }, [days, query, type]);
  React.useEffect(() => { if (open) void read(0); }, [open, read]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-5xl">
        <SheetHeader className="border-b p-5"><SheetTitle>发出积分明细</SheetTitle><SheetDescription>只读分页；描述与文本中的手机号由服务端统一打码。积分折现不是收入。</SheetDescription></SheetHeader>
        <div className="space-y-4 p-5">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Select value={type} onValueChange={setType}><SelectTrigger aria-label="积分类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">全部类型</SelectItem>{["GIFT","ADJUST","LICENSE_GRANT","SCOPED_GRANT","RECHARGE","REFUND_CASH","TRANSFER_IN","TRANSFER_OUT"].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Input aria-label="搜索发放人、受益人或原因" placeholder="搜索发放人、受益人或原因" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void read(0); }} />
            <Button variant="outline" onClick={() => void read(0)} disabled={loading}><ListFilter />筛选</Button>
          </div>
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<Button variant="link" onClick={() => void read(data?.page || 0)}>重试</Button></div>}
          {loading && !data && <Skeleton className="h-56 w-full" />}
          {data && data.items.length > 0 && <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>时间 / 类型</TableHead><TableHead>发放人</TableHead><TableHead>受益人</TableHead><TableHead className="text-right">积分 / 折算</TableHead><TableHead>原因</TableHead></TableRow></TableHeader><TableBody>{data.items.map((item) => <TableRow key={item.id}><TableCell><div className="whitespace-nowrap text-xs">{dateTime(item.createdAt)}</div><Badge variant="outline" className="mt-1 text-[10px]">{item.type}</Badge></TableCell><TableCell className="max-w-48 break-all text-xs">{item.actor || "系统"}</TableCell><TableCell className="max-w-48 break-all text-xs">{item.beneficiary || "—"}</TableCell><TableCell className="text-right tabular-nums"><div className="font-semibold">{int(item.credits)}</div><div className="text-[11px] text-slate-400">{yuan(item.yuanEquivalent)}</div></TableCell><TableCell className="max-w-72 whitespace-normal break-words text-xs">{item.reason || "未填写"}</TableCell></TableRow>)}</TableBody></Table></div>}
          {data && !data.items.length && <EmptyState icon={Coins} title={query || type !== "ALL" ? "没有符合筛选条件的记录" : "当前窗口没有发出积分记录"} />}
          {data && <Pager page={data.page} total={data.total} hasMore={data.hasMore} loading={loading} onPage={(page) => void read(page)} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Pager({ page, total, hasMore, loading, onPage }: { page: number; total: number; hasMore: boolean; loading: boolean; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-3 pt-3"><span className="text-xs text-slate-500">共 {int(total)} 条 · 第 {page + 1} 页</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || page === 0} onClick={() => onPage(page - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={loading || !hasMore} onClick={() => onPage(page + 1)}>下一页</Button></div></div>;
}
