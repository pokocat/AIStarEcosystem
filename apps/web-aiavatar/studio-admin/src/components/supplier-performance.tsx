"use client";

import * as React from "react";
import { AlertCircle, Clock3, Filter, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import type { StudioSupplierPerformance, StudioSupplierPerformanceQuery } from "@ai-star-eco/types/studio-operations";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Skeleton } from "@ai-star-eco/ui/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ai-star-eco/ui/ui/table";
import { StudioOperationsApi } from "@/lib/api";

type Filters = Required<Pick<StudioSupplierPerformanceQuery,
  "from" | "to" | "timezone" | "supplier" | "model" | "mediaType" | "status" | "query">>
  & { exclude: string[]; page: number };

const EXCLUSIONS = [
  ["insufficient-balance", "余额不足"], ["moderation", "内容审核"], ["rate-limited", "限流"],
  ["http-error", "HTTP 异常"], ["result-validation", "结果校验"], ["timeout", "超时"],
] as const;
const STATUS_LABEL: Record<string, string> = {
  succeeded: "成功", failed: "失败", "in-flight": "进行中", cancelled: "已取消", unknown: "未知",
};

function localValue(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function filtersFromUrl(): Filters {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const timezone = params.get("spTimezone") || "Asia/Shanghai";
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60_000);
  return {
    from: params.get("spFrom") || localValue(start, timezone),
    to: params.get("spTo") || localValue(end, timezone),
    timezone,
    supplier: params.get("spSupplier") || "",
    model: params.get("spModel") || "",
    mediaType: params.get("spMedia") || "all",
    status: params.get("spStatus") || "all",
    exclude: params.getAll("spExclude"),
    query: params.get("spQuery") || "",
    page: Number(params.get("spPage")) || 0,
  };
}

const percent = (value: number | null) => value == null ? "样本不足" : `${(value * 100).toFixed(1)}%`;
const duration = (value: number | null) => value == null ? "—" : value < 60 ? `${value} 秒` : `${Math.floor(value / 60)}分 ${value % 60}秒`;
const number = (value: number) => value.toLocaleString("zh-CN");

function demoPerformance(filters: Filters): StudioSupplierPerformance {
  const now = new Date();
  const trend = Array.from({ length: 12 }, (_, index) => ({
    start: new Date(now.getTime() - (11 - index) * 2 * 60 * 60_000).toISOString(),
    succeeded: 9 + (index % 5), failed: index % 4 === 1 ? 3 : index % 3 === 0 ? 1 : 0,
    inFlight: index === 11 ? 6 : 0, cancelled: index === 7 ? 2 : 0, unknown: 0,
    deliverySuccessRate: .82 + (index % 4) * .04,
  }));
  const details = [
    ["task_demo_0186", "CATech", "gpt-image-2", "image", "failed", "moderation", "内容审核拒绝", "供应商", "CONTENT_MODERATION", null],
    ["task_demo_0185", "聚算视频", "minimax-h3", "video", "succeeded", "other", "其他 / 未知", "未知", "", 214],
    ["task_demo_0184", "方舟视频", "seedance-1.0-pro", "video", "failed", "http-error", "上游 HTTP 异常", "供应商", "UPSTREAM_HTTP_502", null],
    ["task_demo_0183", "CATech", "gpt-image-2", "image", "in-flight", "other", "其他 / 未知", "未知", "", null],
  ].map((item, index) => ({
    id: String(item[0]), source: index % 2 ? "material_video_job" : "ip_run",
    supplier: String(item[1]), model: String(item[2]), mediaType: String(item[3]), status: String(item[4]),
    failureCategory: String(item[5]), failureLabel: String(item[6]), ownership: String(item[7]),
    errorCode: String(item[8]), createdAt: new Date(now.getTime() - index * 18 * 60_000).toISOString(),
    completedAt: item[9] == null ? null : new Date(now.getTime() - index * 18 * 60_000 + Number(item[9]) * 1000).toISOString(),
    durationSeconds: item[9] == null ? null : Number(item[9]),
  }));
  return {
    generatedAt: now.toISOString(), timezone: filters.timezone,
    window: { startInclusive: new Date(now.getTime() - 24 * 60 * 60_000).toISOString(), endExclusive: now.toISOString(), bucket: "hour", maxRangeDays: 31 },
    filters: { supplier: filters.supplier, model: filters.model, mediaType: filters.mediaType, status: filters.status, excludedFailureCategories: filters.exclude, query: filters.query },
    summary: { tasks: 186, succeeded: 161, failed: 17, inFlight: 6, cancelled: 2, unknown: 0, terminalSamples: 178, deliverySuccessRate: 161 / 178, p50Seconds: 146, p95Seconds: 511, maxSeconds: 892, latencySamples: 161, excludedTasks: filters.exclude.length ? 5 : 0, latencyDefinition: "仅统计交付成功且时间字段完整的任务；从创建到交付，包含排队、生成、下载与转存。", smallSample: false },
    trend,
    latencyDistribution: [
      { key: "lte-60", label: "≤ 1 分钟", count: 18, percentage: 18 / 161 },
      { key: "61-180", label: "1–3 分钟", count: 69, percentage: 69 / 161 },
      { key: "181-300", label: "3–5 分钟", count: 42, percentage: 42 / 161 },
      { key: "301-600", label: "5–10 分钟", count: 26, percentage: 26 / 161 },
      { key: "601-900", label: "10–15 分钟", count: 6, percentage: 6 / 161 },
      { key: "gt-900", label: "> 15 分钟", count: 0, percentage: 0 },
    ],
    errors: [
      { category: "moderation", label: "内容审核拒绝", ownership: "供应商", count: 7, percentage: 7 / 17 },
      { category: "rate-limited", label: "限流", ownership: "供应商", count: 4, percentage: 4 / 17 },
      { category: "http-error", label: "上游 HTTP 异常", ownership: "供应商", count: 3, percentage: 3 / 17 },
      { category: "other", label: "其他 / 未知", ownership: "未知", count: 3, percentage: 3 / 17 },
    ],
    suppliers: ["CATech", "聚算视频", "方舟视频"],
    models: ["gpt-image-2", "minimax-h3", "seedance-1.0-pro"],
    details: { items: details, page: filters.page, size: 20, total: 186, hasMore: filters.page < 9 },
  };
}

export function SupplierPerformancePanel({ demo = false, mode = "overview" }: { demo?: boolean; mode?: "overview" | "details" }) {
  const [filters, setFilters] = React.useState<Filters>(filtersFromUrl);
  const [draft, setDraft] = React.useState<Filters>(filtersFromUrl);
  const [data, setData] = React.useState<StudioSupplierPerformance>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const requestSequence = React.useRef(0);

  const syncFromUrl = React.useCallback(() => {
    const next = filtersFromUrl();
    setFilters(next);
    setDraft(next);
  }, []);
  React.useEffect(() => {
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [syncFromUrl]);

  const load = React.useCallback(async (externalSignal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    if (demo) {
      setData(demoPerformance(filters));
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await StudioOperationsApi.supplierPerformance({
        from: filters.from, to: filters.to, timezone: filters.timezone,
        supplier: filters.supplier || undefined, model: filters.model || undefined,
        mediaType: filters.mediaType, status: filters.status,
        exclude: filters.exclude.join(",") || undefined, query: filters.query || undefined,
        page: filters.page, size: 20,
      }, controller.signal);
      if (sequence === requestSequence.current) setData(result);
    } catch (cause) {
      if (sequence === requestSequence.current && !externalSignal?.aborted) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          setError("查询超过 15 秒，已取消。请缩短时间范围或减少筛选条件。");
        } else {
          setError(cause instanceof Error ? cause.message : "供应商性能查询失败");
        }
      }
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abort);
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [demo, filters]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const navigate = (next: Filters, targetTab?: "overview" | "details") => {
    const params = new URLSearchParams(window.location.search);
    const values = [
      ["spFrom", next.from], ["spTo", next.to], ["spTimezone", next.timezone],
      ["spSupplier", next.supplier], ["spModel", next.model], ["spMedia", next.mediaType],
      ["spStatus", next.status], ["spQuery", next.query], ["spPage", String(next.page)],
    ];
    values.forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    params.delete("spExclude");
    next.exclude.forEach((value) => params.append("spExclude", value));
    if (targetTab) params.set("tab", targetTab);
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
    setFilters(next);
    setDraft(next);
  };
  const apply = () => navigate({ ...draft, page: 0 });
  const quickRange = (hours: number) => {
    const end = new Date(), start = new Date(end.getTime() - hours * 60 * 60_000);
    setDraft((current) => ({ ...current, from: localValue(start, current.timezone), to: localValue(end, current.timezone), page: 0 }));
  };
  const focusError = (category: string) => {
    navigate({ ...filters, status: "failed", exclude: filters.exclude.filter((item) => item !== category), query: category, page: 0 }, "details");
  };
  const stale = data ? Date.now() - new Date(data.generatedAt).getTime() > 10 * 60_000 : false;

  return (
    <section id="supplier-performance" aria-labelledby="supplier-performance-title" className="space-y-3">
      <Card className="studio-panel gap-0 border-slate-200">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="supplier-performance-title" className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="size-4 text-[#4f6692]" />供应商性能观察
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                交付成功率、成功任务耗时与错误分布；交付成功不等于上游接口可用率。
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {demo && <Badge variant="outline" className="border-[#d9d1de] bg-[#f1edf3] text-[#74667f]">本地演示数据</Badge>}
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">只读</Badge>
              {stale && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">数据已陈旧</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2" aria-label="快捷时间范围">
            <Button size="sm" variant="outline" onClick={() => quickRange(24)}>近 24 小时</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(24 * 7)}>近 7 天</Button>
            <Button size="sm" variant="outline" onClick={() => quickRange(24 * 30)}>近 30 天</Button>
          </div>
          <div className="grid gap-2 lg:grid-cols-4">
            <label className="text-xs text-slate-500">开始时间
              <Input type="datetime-local" className="mt-1 bg-white" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
            </label>
            <label className="text-xs text-slate-500">结束时间
              <Input type="datetime-local" className="mt-1 bg-white" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
            </label>
            <label className="text-xs text-slate-500">时区
              <Select value={draft.timezone} onValueChange={(value) => setDraft({ ...draft, timezone: value })}>
                <SelectTrigger className="mt-1 bg-white" aria-label="统计时区"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Asia/Shanghai">北京时间</SelectItem><SelectItem value="America/Los_Angeles">洛杉矶时间</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectContent>
              </Select>
            </label>
            <label className="text-xs text-slate-500">任务类型
              <Select value={draft.mediaType} onValueChange={(value) => setDraft({ ...draft, mediaType: value })}>
                <SelectTrigger className="mt-1 bg-white" aria-label="任务类型"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">全部类型</SelectItem><SelectItem value="image">图片</SelectItem><SelectItem value="video">视频</SelectItem></SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_160px_1.2fr_auto]">
            <Select value={draft.supplier || "ALL"} onValueChange={(value) => setDraft({ ...draft, supplier: value === "ALL" ? "" : value })}>
              <SelectTrigger className="bg-white" aria-label="供应商"><SelectValue placeholder="全部供应商" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">全部供应商</SelectItem>{data?.suppliers.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={draft.model || "ALL"} onValueChange={(value) => setDraft({ ...draft, model: value === "ALL" ? "" : value })}>
              <SelectTrigger className="bg-white" aria-label="模型"><SelectValue placeholder="全部模型" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">全部模型</SelectItem>{data?.models.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value })}>
              <SelectTrigger className="bg-white" aria-label="任务状态"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部状态</SelectItem>{Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input className="bg-white pl-9" aria-label="搜索任务、模型或错误码" placeholder="任务 ID、模型、错误码" value={draft.query} onChange={(event) => setDraft({ ...draft, query: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") apply(); }} /></div>
            <Button onClick={apply} disabled={loading}><Filter />应用筛选</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">明确排除（默认不排除）：</span>
            {EXCLUSIONS.map(([value, label]) => {
              const selected = draft.exclude.includes(value);
              return <Button key={value} type="button" size="sm" variant={selected ? "secondary" : "outline"} aria-pressed={selected}
                onClick={() => setDraft({ ...draft, exclude: selected ? draft.exclude.filter((item) => item !== value) : [...draft.exclude, value] })}>
                {selected && <X />}{label}
              </Button>;
            })}
          </div>
        </CardContent>
      </Card>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <strong>供应商性能加载失败</strong><p className="mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 bg-white" onClick={() => void load()}><RefreshCw />重试</Button>
      </div>}
      {loading && !data && <div role="status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>}
      {data && <>
        {loading && <div role="status" className="text-xs text-slate-500"><RefreshCw className="mr-1 inline size-3 animate-spin" />正在刷新，暂时保留上一次结果</div>}
        {data.summary.excludedTasks > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mr-2 inline size-4" />当前明确排除了 {number(data.summary.excludedTasks)} 个任务：{data.filters.excludedFailureCategories.join("、")}。统计与明细应用相同条件。
        </div>}
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-6">
          <PerformanceMetric label="任务样本" value={number(data.summary.tasks)} detail={`终态 ${number(data.summary.terminalSamples)}`} />
          <PerformanceMetric label="交付成功率" value={percent(data.summary.deliverySuccessRate)} detail={`${number(data.summary.succeeded)} 成功 / ${number(data.summary.failed)} 失败`} warning={data.summary.smallSample} />
          <PerformanceMetric label="成功耗时 P50" value={duration(data.summary.p50Seconds)} detail={`样本 ${number(data.summary.latencySamples)}`} />
          <PerformanceMetric label="成功耗时 P95" value={duration(data.summary.p95Seconds)} detail="非平均分位数" />
          <PerformanceMetric label="成功最长耗时" value={duration(data.summary.maxSeconds)} detail="仅完整时间样本" />
          <PerformanceMetric label="进行中 / 取消 / 未知" value={`${number(data.summary.inFlight)} / ${number(data.summary.cancelled)} / ${number(data.summary.unknown)}`} detail="均不计入失败率" />
        </div>
        {data.summary.smallSample && <p className="text-xs text-amber-700"><AlertCircle className="mr-1 inline size-3" />终态样本少于 20 个，百分比波动可能较大，请结合数量判断。</p>}

        {mode === "overview" && <><div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Card className="studio-panel gap-0 border-slate-200">
            <CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">成功与失败趋势</CardTitle><CardDescription className="text-xs">{data.window.bucket === "hour" ? "按小时" : "按自然日"}分桶 · {data.timezone}；无任务的分桶不是健康绿色。</CardDescription></CardHeader>
            <CardContent className="p-3 sm:p-4"><PerformanceTrend data={data.trend} timezone={data.timezone} /></CardContent>
          </Card>
          <Card className="studio-panel gap-0 border-slate-200">
            <CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">成功任务耗时分布</CardTitle><CardDescription className="text-xs">{data.summary.latencyDefinition}</CardDescription></CardHeader>
            <CardContent className="space-y-2.5 p-4">
              {data.summary.latencySamples ? data.latencyDistribution.map((item) => <div key={item.key}>
                <div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><span>{number(item.count)} · {(item.percentage * 100).toFixed(1)}%</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#71889a]" style={{ width: `${item.percentage * 100}%` }} /></div>
              </div>) : <PerformanceEmpty text="没有成功且时间字段完整的任务" />}
            </CardContent>
          </Card>
        </div>

        <Card className="studio-panel gap-0 border-slate-200">
          <CardHeader className="border-b px-4 py-3"><CardTitle className="text-sm font-semibold">错误分布</CardTitle><CardDescription className="text-xs">点击类别定位到同口径失败明细；未知原因保留，不把全部失败归为供应商宕机。</CardDescription></CardHeader>
          <CardContent className="p-3 sm:p-4">
            {data.errors.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.errors.map((item) =>
              <button key={`${item.category}:${item.ownership}`} type="button" className="rounded-xl border bg-slate-50 p-3 text-left outline-none transition hover:border-blue-200 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => focusError(item.category)}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm">{item.label}</strong><Badge variant="outline" className={item.ownership === "供应商" ? "border-amber-200 bg-amber-50 text-amber-700" : item.ownership === "未知" ? "border-slate-200 bg-white text-slate-600" : "border-blue-200 bg-blue-50 text-blue-700"}>{item.ownership}</Badge></div>
                <p className="mt-2 text-xl font-semibold tabular-nums">{number(item.count)} <span className="text-xs font-normal text-slate-500">{(item.percentage * 100).toFixed(1)}%</span></p>
              </button>)}</div> : <PerformanceEmpty text={data.summary.tasks ? "当前筛选下没有终态失败任务" : "没有符合筛选条件的任务"} />}
          </CardContent>
        </Card></>}

        {mode === "details" && <Card id="supplier-task-details" className="studio-panel gap-0 border-slate-200">
          <CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm font-semibold">任务明细</CardTitle><CardDescription className="text-xs">只读分页；不返回用户、完整提示词、上游凭据或原始错误文案。时间按 {data.timezone} 展示。</CardDescription></CardHeader>
          <CardContent className="p-0">
            {data.details.items.length ? <>
              <div className="overflow-x-auto">
                <Table><TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-5">时间 / 任务</TableHead><TableHead>供应商 / 模型</TableHead><TableHead>类型 / 状态</TableHead><TableHead>错误分类</TableHead><TableHead className="pr-5 text-right">成功耗时</TableHead></TableRow></TableHeader>
                  <TableBody>{data.details.items.map((item) => <TableRow key={`${item.source}:${item.id}`}>
                    <TableCell className="pl-5"><div>{new Intl.DateTimeFormat("zh-CN", { timeZone: data.timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</div><div className="max-w-[190px] truncate text-xs text-slate-400" title={item.id}>{item.id}</div></TableCell>
                    <TableCell><div>{item.supplier}</div><div className="text-xs text-slate-400">{item.model}</div></TableCell>
                    <TableCell><Badge variant="outline" className="mr-1">{item.mediaType === "video" ? "视频" : "图片"}</Badge><Badge variant="outline" className={item.status === "succeeded" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "failed" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{STATUS_LABEL[item.status] || item.status}</Badge></TableCell>
                    <TableCell><div>{item.status === "failed" ? item.failureLabel : "—"}</div>{item.errorCode && <div className="max-w-[220px] truncate text-xs text-slate-400">{item.errorCode}</div>}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{duration(item.durationSeconds)}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><span className="text-xs text-slate-500">共 {number(data.details.total)} 条 · 第 {data.details.page + 1} 页</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || data.details.page === 0} onClick={() => navigate({ ...filters, page: data.details.page - 1 })}>上一页</Button><Button variant="outline" size="sm" disabled={loading || !data.details.hasMore} onClick={() => navigate({ ...filters, page: data.details.page + 1 })}>下一页</Button></div></div>
            </> : <PerformanceEmpty text={filters.query || filters.supplier || filters.model || filters.status !== "all" ? "没有符合当前筛选的任务" : "当前时间范围没有任务"} />}
          </CardContent>
        </Card>}
        <p className="text-xs text-slate-500"><Clock3 className="mr-1 inline size-3" />查询上限 {data.window.maxRangeDays} 天；单来源超过安全样本上限会整次报错，不会把截断结果冒充全量。</p>
      </>}
    </section>
  );
}

function PerformanceMetric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <Card className="studio-panel gap-0 border-slate-200"><CardContent className="p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p><p className={`mt-0.5 text-[11px] ${warning ? "text-amber-700" : "text-slate-400"}`}>{detail}</p></CardContent></Card>;
}

function PerformanceEmpty({ text }: { text: string }) {
  return <div className="m-4 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-slate-400">{text}</div>;
}

function PerformanceTrend({ data, timezone }: { data: StudioSupplierPerformance["trend"]; timezone: string }) {
  return <div className="h-[220px] w-full" role="img" aria-label="供应商任务成功失败趋势图">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#edf0f6" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="start" tick={{ fontSize: 11, fill: "#8490a5" }} tickLine={false} axisLine={false}
          tickFormatter={(value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, month: "2-digit", day: "2-digit", hour: "2-digit" }).format(new Date(value))} />
        <YAxis width={42} allowDecimals={false} tick={{ fontSize: 11, fill: "#8490a5" }} tickLine={false} axisLine={false} />
        <ChartTooltip labelFormatter={(value) => new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)))} />
        <Legend formatter={(value) => value === "succeeded" ? "成功" : value === "failed" ? "失败" : "进行中"} />
        <Line type="monotone" dataKey="succeeded" stroke="#6f8980" strokeWidth={2.25} dot={false} />
        <Line type="monotone" dataKey="failed" stroke="#a36f73" strokeWidth={2.25} dot={false} />
        <Line type="monotone" dataKey="inFlight" stroke="#647fa5" strokeWidth={2.25} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
