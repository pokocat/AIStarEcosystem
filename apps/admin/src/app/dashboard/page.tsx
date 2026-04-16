"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { DashboardStats } from "@/types";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardFallbackStats, normalizeDashboardStats } from "@/lib/dashboard";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(dashboardFallbackStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await apiFetch<DashboardStats>("/api/admin/stats");
        setStats(normalizeDashboardStats(data));
      } catch {
        setError("当前未能读取实时指标，页面已自动回退为占位统计。");
        setStats(dashboardFallbackStats);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.98))] shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[12px] font-medium text-sky-800">
              今日概览
            </div>
            <CardTitle className="text-[28px] leading-tight text-slate-950">
              统一查看账户、租户、卡密、积分与审计运行状态。
            </CardTitle>
            <CardDescription className="max-w-3xl text-[14px] leading-7 text-slate-600">
              看板优先展示平台运营最常关注的核心指标，便于快速发现账户异常、库存变化和账务波动。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/users">
                查看用户账户
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/licenses">
                查看卡密批次
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/audit">
                查看系统审计
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-[15px]">数据状态</CardTitle>
              <CardDescription>后台与服务端的当前读取情况</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              className="h-8"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              刷新
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-slate-50 px-3 py-3">
              <p className="text-[12px] text-slate-500">指标来源</p>
              <p className="mt-1 text-[13px] font-medium text-slate-900">
                {error ? "占位数据" : loading ? "正在读取" : "实时接口"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-slate-50 px-3 py-3">
              <p className="text-[12px] text-slate-500">后端地址</p>
              <p className="mt-1 font-mono text-[12px] text-slate-900">http://localhost:8080</p>
            </div>
            <Alert variant={error ? "warning" : "info"}>
              <AlertTitle>{error ? "已进入回退模式" : "当前连接正常"}</AlertTitle>
              <AlertDescription>
                {error
                  ? error
                  : "如需排查异常，请优先核对管理员登录态、服务端状态与数据库连接。"}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      {error && (
        <Alert variant="warning">
          <AlertTitle>实时指标暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-[18px] font-semibold text-slate-950">核心指标</h2>
          <p className="text-[13px] text-muted-foreground">
            默认按当前服务端返回结果展示，字段缺失时自动归一化为 `0`。
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="border-border/80">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <StatsCards stats={stats} />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/80 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-[15px]">快捷入口</CardTitle>
            <CardDescription>平台运营日常最常访问的页面</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { href: "/users", label: "用户账户", desc: "查看账号状态、角色与资料完整度" },
              { href: "/tenants", label: "租户工作区", desc: "查看工作区归属和启用状态" },
              { href: "/licenses", label: "卡密批次", desc: "查看批次库存与单码状态" },
              { href: "/credits", label: "钱包流水", desc: "查看余额结构与账本记录" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent"
              >
                <p className="text-[14px] font-semibold text-slate-950">{item.label}</p>
                <p className="mt-1 text-[12px] leading-6 text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-[15px]">待关注事项</CardTitle>
            <CardDescription>适合在值班或巡检时优先关注的几个方向</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="info">
              <AlertTitle>优先核对账户与租户的归属关系</AlertTitle>
              <AlertDescription>
                建议结合“用户账户”和“租户工作区”页面，检查高价值账号是否归属正确、是否存在异常停用。
              </AlertDescription>
            </Alert>
            <Alert variant="default">
              <AlertTitle>关注卡密库存与激活节奏</AlertTitle>
              <AlertDescription>
                如批次激活率突增或突降，应及时进入“卡密批次”页核对渠道投放和库存回收情况。
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>巡检账本与审计记录</AlertTitle>
              <AlertDescription>
                积分补录、卡密吊销、权限调整等高风险动作，建议联动“钱包流水”和“系统审计”交叉核查。
              </AlertDescription>
            </Alert>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[13px] leading-6 text-emerald-900">
              <div className="flex items-center gap-2 font-medium">
                <BadgeCheck className="h-4 w-4" />
                当前这版后台已按管理场景压缩信息密度
              </div>
              <p className="mt-2 text-[12px] leading-6 text-emerald-800">
                表格、卡片、页头和登录页已统一到更适合中文管理后台的视觉节奏，便于连续巡检和密集操作。
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
