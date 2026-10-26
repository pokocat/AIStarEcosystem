"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, RefreshCw, ServerCog, WalletCards } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudioOperationsApi } from "@/api";
import type { CreditEventPage, Latency, ReconciliationDetailPage, StudioOperationsDashboard } from "@/types/studio-operations";

type View = "business" | "technology";
type Days = 1 | 7 | 30;

const num = (value: number) => value.toLocaleString("zh-CN");
const money = (value: number) => `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (value: number | null) => value == null ? "样本不足" : `${(value * 100).toFixed(1)}%`;
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
}).format(new Date(value)) : "未接入";

export default function StudioOperationsPage() {
  return <React.Suspense fallback={<PageLoading />}><Dashboard /></React.Suspense>;
}

function Dashboard() {
  const search = useSearchParams();
  const initialView: View = search.get("view") === "technology" ? "technology" : "business";
  const rawDays = Number(search.get("days"));
  const initialDays: Days = rawDays === 1 || rawDays === 30 ? rawDays : 7;
  const [view, setView] = React.useState<View>(initialView);
  const [days, setDays] = React.useState<Days>(initialDays);
  const [data, setData] = React.useState<StudioOperationsDashboard>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [detailCheck, setDetailCheck] = React.useState<string>();
  const [eventsOpen, setEventsOpen] = React.useState(false);

  const syncUrl = React.useCallback((nextView: View, nextDays: Days) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", nextView);
    params.set("days", String(nextDays));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await StudioOperationsApi.dashboard(days)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法加载 Studio 运营数据"); }
    finally { setLoading(false); }
  }, [days]);

  React.useEffect(() => { void load(); }, [load]);
  const changeView = (next: string) => { const value = next as View; setView(value); syncUrl(value, days); };
  const changeDays = (next: string) => { const value = Number(next) as Days; setDays(value); syncUrl(view, value); };
  const stale = data ? Date.now() - new Date(data.generatedAt).getTime() > 10 * 60_000 : false;

  return <div className="admin-page space-y-5">
    <PageHeader
      title="Studio 运营看板"
      description="一期只读看板：积分健康、经营消耗、发出积分，以及生成任务与供应商故障。积分折算仅供运营观察，不代表收入或毛利。"
      breadcrumb={[{ label: "AI 中台" }, { label: "Studio 运营看板" }]}
      actions={<>
        <Select value={String(days)} onValueChange={changeDays} disabled={loading}>
          <SelectTrigger className="w-full sm:w-[132px]" aria-label="统计窗口"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="1">今天</SelectItem><SelectItem value="7">近 7 天</SelectItem><SelectItem value="30">近 30 天</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />{loading ? "刷新中" : "刷新"}</Button>
      </>}
      meta={data ? <p className="text-xs text-muted-foreground">北京时间口径 · 数据时点 {dateTime(data.generatedAt)}{stale && <Badge tone="warning" className="ml-2">数据已陈旧</Badge>}</p> : undefined}
    />

    {error && <LoadError message={error} retry={() => void load()} />}
    {!error && !data && <PageLoading />}
    {data && <>
      <HealthStrip data={data} stale={stale} onDetail={setDetailCheck} />
      <Tabs value={view} onValueChange={changeView}>
        <TabsList aria-label="看板页面"><TabsTrigger value="business">经营</TabsTrigger><TabsTrigger value="technology">技术</TabsTrigger></TabsList>
        <TabsContent value="business"><BusinessView data={data} onEvents={() => setEventsOpen(true)} /></TabsContent>
        <TabsContent value="technology"><TechnologyView data={data} /></TabsContent>
      </Tabs>
    </>}

    <ReconciliationDialog check={detailCheck} onOpenChange={(open) => !open && setDetailCheck(undefined)} />
    <CreditEventsDialog open={eventsOpen} days={days} onOpenChange={setEventsOpen} />
  </div>;
}

function HealthStrip({ data, stale, onDetail }: { data: StudioOperationsDashboard; stale: boolean; onDetail: (id: string) => void }) {
  const issues = data.health.checks.filter((item) => item.count > 0).length + (data.health.stuckHoldsOverSixHours > 0 ? 1 : 0) + (data.health.abnormalModels > 0 ? 1 : 0);
  const partial = data.health.reconciliationAgent.status !== "linked" || stale;
  const tone = issues > 0 ? "danger" : partial ? "warning" : "success";
  return <section aria-labelledby="health-heading" className={`rounded-lg border p-4 ${issues > 0 ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20" : partial ? "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"}`}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="health-heading" className="flex items-center gap-2 text-sm font-semibold">{issues > 0 ? <AlertCircle className="h-4 w-4 text-rose-600" /> : partial ? <Clock3 className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}共用健康状态 <Badge tone={tone}>{issues > 0 ? `${issues} 项需处理` : partial ? "部分数据未接入" : "全部正常"}</Badge></h2><p className="mt-1 text-xs text-muted-foreground">A–I 为当前数据库即时只读重算。加载失败、陈旧和未接入不会显示为健康绿色。</p></div>
      <div className="text-right text-xs text-muted-foreground">Agent：{data.health.reconciliationAgent.status === "linked" ? data.health.reconciliationAgent.conclusion : "未接入运行记录"}</div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {data.health.checks.map((item) => <button key={item.id} type="button" disabled={!item.detailAvailable} onClick={() => onDetail(item.id)} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/80 bg-surface/80 px-3 py-2 text-left text-xs disabled:cursor-default">
        <span className="min-w-0"><strong>{item.id}</strong> · {item.label}</span><Badge tone={item.count ? "danger" : "success"}>{item.count ? num(item.count) : "0"}</Badge>
      </button>)}
      <HealthFact label="进行中超过 6 小时冻结" value={data.health.stuckHoldsOverSixHours} />
      <HealthFact label="任务 ≥5 且退回率 ≥50% 模型" value={data.health.abnormalModels} />
    </div>
  </section>;
}

function HealthFact({ label, value }: { label: string; value: number }) {
  return <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/80 bg-surface/80 px-3 py-2 text-xs"><span>{label}</span><Badge tone={value ? "danger" : "success"}>{num(value)}</Badge></div>;
}

function BusinessView({ data, onEvents }: { data: StudioOperationsDashboard; onEvents: () => void }) {
  const business = data.business;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={`${data.window.label}总消耗`} value={`${num(business.totals.totalCredits)} 积分`} detail={`约 ${money(business.totals.yuanEquivalent)} · 非收入`} />
      <Metric label="普通积分消耗" value={num(business.totals.walletCredits)} detail="SPEND 流水" />
      <Metric label="模型赠款消耗" value={num(business.totals.grantCredits)} detail="SCOPED_SPEND 流水" />
      <Metric label="窗口内发出积分" value={num(business.issuance.issuedCredits)} detail={`约 ${money(business.issuance.yuanEquivalent)} · 非营收`} />
    </div>
    <Card>
      <CardHeader><CardTitle>每日消耗趋势</CardTitle><CardDescription>北京时间自然日；普通积分与模型赠款分开，不重复计数。</CardDescription></CardHeader>
      <CardContent>{business.dailySpend.length ? <SpendChart data={business.dailySpend} /> : <Empty text="当前窗口没有消费流水" />}</CardContent>
    </Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card><CardHeader><CardTitle>模型维度</CardTitle><CardDescription>状态以冻结终态统一：成功=COMMITTED，退回=RELEASED，进行中=ACTIVE。</CardDescription></CardHeader><CardContent><ModelSpendTable rows={business.models} /></CardContent></Card>
      <Card><CardHeader><CardTitle>功能维度</CardTitle><CardDescription>从任务引用类型及 Studio run kind 归类；未知来源保留在“其他”。</CardDescription></CardHeader><CardContent><FeatureTable rows={business.features} /></CardContent></Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-4 w-4" />发出积分核对</CardTitle><CardDescription>赠送、调整、激活码、模型赠款、充值、退款与转账记录。普通余额与模型赠款是两套分桶。</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <SmallMetric label="全部钱包当前余额" value={`${num(business.issuance.walletBalance)} 积分`} />
        <SmallMetric label="模型赠款可用 + 冻结" value={`${num(business.issuance.grantAvailable)} 积分`} />
        <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><strong>赠送实际使用比例：未具备数据</strong><br />{business.issuance.note}</div>
      </CardContent>
      <div className="flex px-5 pb-5"><Button variant="outline" onClick={onEvents}>查看只读发放明细</Button></div>
    </Card>
    <PhaseTwoNote />
  </div>;
}

function TechnologyView({ data }: { data: StudioOperationsDashboard }) {
  const tech = data.technology;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="当前排队" value={num(tech.queue.queued)} detail="不计入失败率" />
      <Metric label="平均等待" value={tech.queue.averageWaitSeconds == null ? "样本不足" : `${num(tech.queue.averageWaitSeconds)} 秒`} detail="仅 started_at 完整样本" />
      <Metric label="受理结果待核对" value={num(tech.queue.pendingReconciliation)} detail="不会自动重提任务" />
      <Metric label="并发余量" value="未接入" detail="无统一运行时采集源" />
    </div>
    <Card><CardHeader><CardTitle>各模型生成表现</CardTitle><CardDescription>成功率分母只含终态成功 + 失败；运行中和排队不作为失败。退回率属于账务口径，不与技术失败率混用。</CardDescription></CardHeader><CardContent><GenerationTable rows={tech.models} /></CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-2">
      <LatencyCard latency={tech.imageLatency} /><LatencyCard latency={tech.videoLatency} />
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>失败原因</CardTitle><CardDescription>从稳定错误码与脱敏错误文案分类；无法判断归属时保留“未知”。</CardDescription></CardHeader><CardContent>{tech.failureReasons.length ? <div className="space-y-2">{tech.failureReasons.map((item) => <div key={`${item.category}:${item.ownership}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>{item.label}<Badge tone={item.ownership === "供应商" ? "warning" : item.ownership === "我方请求" ? "danger" : "neutral"} className="ml-2">{item.ownership}</Badge></span><strong>{num(item.count)}</strong></div>)}</div> : <Empty text="当前窗口没有终态失败任务" />}</CardContent></Card>
      <Card><CardHeader><CardTitle>供应商状态</CardTitle><CardDescription>区分我方请求错误、供应商故障与未知；配额字段只有真实来源才展示。</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2"><SmallMetric label="我方请求" value={num(tech.supplier.platformRequestErrors)} /><SmallMetric label="供应商" value={num(tech.supplier.supplierErrors)} /><SmallMetric label="未知" value={num(tech.supplier.unknownErrors)} /></div><Unavailable text="限流次数、每日用量与配额余量尚无统一数据源，未显示为 0。" /></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ServerCog className="h-4 w-4" />发版与告警</CardTitle><CardDescription>复用已有异常与日志页面；发布清单和飞书发送记录需安全只读适配器。</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><IntegrationCard title="线上版本 / 发布时间" state={data.integrations.release} /><IntegrationCard title="飞书发送 / 失败记录" state={data.integrations.feishuAlerts} /><IntegrationCard title="请求日志" state={data.integrations.requestLogs} /></CardContent></Card>
    <PhaseTwoNote technical />
  </div>;
}

function SpendChart({ data }: { data: StudioOperationsDashboard["business"]["dailySpend"] }) {
  return <div className="h-[260px] w-full" role="img" aria-label="普通积分和模型赠款每日消耗折线图"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} /><YAxis width={56} fontSize={12} tickFormatter={(v: number) => v >= 10_000 ? `${Math.round(v / 10_000)}万` : String(v)} /><Tooltip formatter={(value: number | string, name: string) => [num(Number(value)), name === "walletCredits" ? "普通积分" : "模型赠款"]} labelFormatter={(label) => `北京时间 ${label}`} /><Legend formatter={(value) => value === "walletCredits" ? "普通积分" : "模型赠款"} /><Line type="monotone" dataKey="walletCredits" stroke="oklch(0.52 0.18 264)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="grantCredits" stroke="oklch(0.62 0.16 145)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>;
}

function ModelSpendTable({ rows }: { rows: StudioOperationsDashboard["business"]["models"] }) {
  if (!rows.length) return <Empty text="当前窗口没有模型扣费记录" />;
  return <Table><TableHeader><TableRow><TableHead>模型 / 接入点</TableHead><TableHead className="text-right">任务</TableHead><TableHead className="text-right">成功 / 退回 / 进行中</TableHead><TableHead className="text-right">普通 / 赠款</TableHead><TableHead className="text-right">消耗</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.endpointId}><TableCell><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.endpointId}</div></TableCell><TableCell className="text-right tabular-nums">{num(row.jobs)}</TableCell><TableCell className="text-right tabular-nums">{num(row.succeeded)} / {num(row.refunded)} / {num(row.inFlight)}</TableCell><TableCell className="text-right tabular-nums">{num(row.walletCredits)} / {num(row.grantCredits)}</TableCell><TableCell className="text-right tabular-nums font-medium">{num(row.credits)}</TableCell></TableRow>)}</TableBody></Table>;
}

function FeatureTable({ rows }: { rows: StudioOperationsDashboard["business"]["features"] }) {
  return <Table><TableHeader><TableRow><TableHead>功能</TableHead><TableHead className="text-right">任务</TableHead><TableHead className="text-right">成功 / 退回 / 进行中</TableHead><TableHead className="text-right">消耗</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.feature}><TableCell className="font-medium">{row.feature}</TableCell><TableCell className="text-right">{num(row.jobs)}</TableCell><TableCell className="text-right">{num(row.succeeded)} / {num(row.refunded)} / {num(row.inFlight)}</TableCell><TableCell className="text-right">{num(row.credits)}</TableCell></TableRow>)}</TableBody></Table>;
}

function GenerationTable({ rows }: { rows: StudioOperationsDashboard["technology"]["models"] }) {
  if (!rows.length) return <Empty text="当前窗口没有生成任务" />;
  return <Table><TableHeader><TableRow><TableHead>类型 / 模型</TableHead><TableHead className="text-right">任务</TableHead><TableHead className="text-right">成功</TableHead><TableHead className="text-right">失败</TableHead><TableHead className="text-right">进行中</TableHead><TableHead className="text-right">终态成功率</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={`${row.mediaType}:${row.key}`}><TableCell><Badge tone={row.mediaType === "视频" ? "primary" : "info"}>{row.mediaType}</Badge><span className="ml-2 font-medium">{row.key}</span></TableCell><TableCell className="text-right">{num(row.jobs)}</TableCell><TableCell className="text-right">{num(row.succeeded)}</TableCell><TableCell className="text-right">{num(row.failed)}</TableCell><TableCell className="text-right">{num(row.inFlight)}</TableCell><TableCell className="text-right font-medium">{pct(row.successRate)}</TableCell></TableRow>)}</TableBody></Table>;
}

function LatencyCard({ latency }: { latency: Latency }) {
  return <Card><CardHeader><CardTitle>{latency.mediaType}耗时</CardTitle><CardDescription>{latency.note}</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-2"><SmallMetric label="P50" value={latency.p50Seconds == null ? "—" : `${num(latency.p50Seconds)} 秒`} /><SmallMetric label="P95" value={latency.p95Seconds == null ? "—" : `${num(latency.p95Seconds)} 秒`} /><SmallMetric label="样本" value={num(latency.samples)} /></CardContent></Card>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card><CardContent className="pt-4 sm:pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-md border bg-surface-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>; }
function Unavailable({ text }: { text: string }) { return <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><Badge tone="warning" className="mr-2">未接入</Badge>{text}</div>; }

function IntegrationCard({ title, state }: { title: string; state: StudioOperationsDashboard["integrations"]["release"] }) {
  return <div className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{title}</strong><Badge tone={state.status === "linked" ? "info" : "warning"}>{state.status === "linked" ? "已有入口" : "未接入"}</Badge></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{state.note}</p>{state.href && <Button asChild variant="link" size="sm" className="mt-1 px-0"><Link href={state.href}>打开已有页面 <ExternalLink /></Link></Button>}</div>;
}
function PhaseTwoNote({ technical = false }: { technical?: boolean }) {
  return <div className="rounded-lg border border-dashed bg-surface-muted/30 p-4 text-sm"><strong>第二期扩展点</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{technical ? "服务在线、重启/502、错误慢接口、磁盘/内存/DB 连接与上传失败需要新增采集后接入；本期不放置虚假的绿色控件。" : "用户消耗排行、充值消费者、低余额持续使用与赠款活动提醒将在二期接入；当前一期不以占位数字冒充数据。"}</p></div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50/60 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"><strong>看板加载失败</strong><p className="mt-1">{message}</p><Button variant="outline" size="sm" className="mt-3" onClick={retry}>重试</Button></div>;
}
function PageLoading() { return <div role="status" className="space-y-3" aria-label="正在加载 Studio 运营看板"><div className="h-28 animate-pulse rounded-lg bg-muted" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div></div>; }

function ReconciliationDialog({ check, onOpenChange }: { check?: string; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = React.useState<ReconciliationDetailPage>(); const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState("");
  const read = React.useCallback(async (page = 0) => { if (!check) return; setLoading(true); setError(""); try { setData(await StudioOperationsApi.reconciliationDetails(check, page)); } catch (cause) { setError(cause instanceof Error ? cause.message : "明细加载失败"); } finally { setLoading(false); } }, [check]);
  React.useEffect(() => { setData(undefined); if (check) void read(0); }, [check, read]);
  const columns = data?.items[0] ? Object.keys(data.items[0]) : [];
  return <Dialog open={Boolean(check)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>对账项 {check} · 账户明细</DialogTitle><DialogDescription>只读结果，最多每页 20 条；账户标识用于定位，不包含完整手机号。</DialogDescription></DialogHeader>{loading && !data && <p role="status" className="text-sm text-muted-foreground">正在加载明细…</p>}{error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="link" onClick={() => void read(data?.page ?? 0)}>重试</Button></p>}{data && (data.items.length ? <><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{data.items.map((row, index) => <TableRow key={index}>{columns.map((column) => <TableCell key={column} className="break-all">{row[column]}</TableCell>)}</TableRow>)}</TableBody></Table><Pagination page={data.page} hasMore={data.hasMore} loading={loading} onPage={(page) => void read(page)} total={data.total} /></> : <Empty text="该项已无异常，刷新主看板可更新状态" />)}</DialogContent></Dialog>;
}

function CreditEventsDialog({ open, days, onOpenChange }: { open: boolean; days: Days; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = React.useState<CreditEventPage>(); const [loading, setLoading] = React.useState(false); const [error, setError] = React.useState(""); const [type, setType] = React.useState("ALL"); const [query, setQuery] = React.useState("");
  const read = React.useCallback(async (page = 0) => { setLoading(true); setError(""); try { setData(await StudioOperationsApi.creditEvents(days, page, type === "ALL" ? undefined : type, query.trim() || undefined)); } catch (cause) { setError(cause instanceof Error ? cause.message : "发放明细加载失败"); } finally { setLoading(false); } }, [days, query, type]);
  React.useEffect(() => { if (open) void read(0); }, [open, read]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-5xl">
      <DialogHeader><DialogTitle>发出积分明细</DialogTitle><DialogDescription>只读、分页；原因与所有文本中的手机号由服务端统一打码。积分折现不是收入。</DialogDescription></DialogHeader>
      <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
        <Select value={type} onValueChange={setType}><SelectTrigger aria-label="积分类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">全部类型</SelectItem>{["GIFT","ADJUST","LICENSE_GRANT","SCOPED_GRANT","RECHARGE","REFUND_CASH","TRANSFER_IN","TRANSFER_OUT"].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Input aria-label="搜索发放人、受益人或原因" placeholder="搜索发放人、受益人或原因" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void read(0); }} />
        <Button variant="outline" onClick={() => void read(0)} disabled={loading}>筛选</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="link" onClick={() => void read(data?.page ?? 0)}>重试</Button></p>}
      {loading && !data && <p role="status" className="text-sm text-muted-foreground">正在加载发放记录…</p>}
      {data && data.items.length > 0 && <>
        <Table><TableHeader><TableRow><TableHead>时间 / 类型</TableHead><TableHead>发放人</TableHead><TableHead>受益人</TableHead><TableHead className="text-right">积分 / 折算</TableHead><TableHead>原因</TableHead></TableRow></TableHeader><TableBody>{data.items.map((item) => <TableRow key={item.id}><TableCell><div>{dateTime(item.createdAt)}</div><Badge tone="neutral" className="mt-1">{item.type}</Badge></TableCell><TableCell className="break-all">{item.actor || "系统"}</TableCell><TableCell className="break-all">{item.beneficiary || "—"}</TableCell><TableCell className="text-right tabular-nums"><div className="font-medium">{num(item.credits)}</div><div className="text-xs text-muted-foreground">{money(item.yuanEquivalent)}</div></TableCell><TableCell className="max-w-[280px] whitespace-normal break-words">{item.reason || "未填写"}</TableCell></TableRow>)}</TableBody></Table>
        <Pagination page={data.page} hasMore={data.hasMore} loading={loading} onPage={(page) => void read(page)} total={data.total} />
      </>}
      {data && data.items.length === 0 && <Empty text={query || type !== "ALL" ? "没有符合筛选条件的记录" : "当前窗口没有发出积分记录"} />}
    </DialogContent>
  </Dialog>;
}

function Pagination({ page, hasMore, loading, total, onPage }: { page: number; hasMore: boolean; loading: boolean; total: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><span className="text-xs text-muted-foreground">共 {num(total)} 条 · 第 {page + 1} 页</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || page === 0} onClick={() => onPage(page - 1)}>上一页</Button><Button variant="outline" size="sm" disabled={loading || !hasMore} onClick={() => onPage(page + 1)}>下一页</Button></div></div>;
}
