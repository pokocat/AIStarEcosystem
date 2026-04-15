"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Link2, ServerCrash } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { DashboardStats } from "@/types";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
        setError("当前未能从后端读取管理指标，页面已自动回退到占位数据。");
        setStats(dashboardFallbackStats);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(239,246,255,0.98))] shadow-[0_16px_60px_rgba(15,23,42,0.08)]">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">中文运营后台</Badge>
              <Badge variant="outline">shadcn/ui 规范整理</Badge>
            </div>
            <CardTitle className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              统一查看账户、权益、许可证与积分运营状态。
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              这个后台与前台业务站点解耦，聚焦平台运营场景。页面默认优先展示状态、表格和操作入口，并且在后端数据不完整时自动降级，不再因为字段缺失直接崩溃。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/users">
                进入用户管理
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/audit">
                查看审计日志
                <Link2 className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">连接状态</CardTitle>
            <CardDescription>当前管理后台与后端之间的运行情况</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  error ? "bg-amber-500" : loading ? "bg-sky-500" : "bg-emerald-500"
                }`}
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {loading ? "正在连接后端" : error ? "已进入回退模式" : "后端连接正常"}
                </p>
                <p className="text-xs text-muted-foreground">目标地址：`http://localhost:8080`</p>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>建议下一步接通 `/api/admin/**` 与 Spring Security 管理员角色体系。</p>
              <p>在此之前，各页面会优先保证可读性与稳健性，即使数据形状不稳定也不再直接报错。</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {error && (
        <Alert variant="warning">
          <AlertCircle className="mb-2 h-4 w-4" />
          <AlertTitle>后端指标暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">核心指标</h2>
          <p className="text-sm text-muted-foreground">
            统计卡片已加上响应归一化保护，缺字段时会回退为 `0`，不会再触发运行时异常。
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="border-border/80">
                <CardHeader className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <StatsCards stats={stats} />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">快捷入口</CardTitle>
            <CardDescription>运营团队最常进入的核心工作页面</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { href: "/users", label: "用户管理", desc: "账号生命周期、角色与状态巡检" },
              { href: "/tenants", label: "租户空间", desc: "工作区归属、类型与启用状态" },
              { href: "/licenses", label: "许可证管理", desc: "批次、密钥与激活追踪" },
              { href: "/credits", label: "积分钱包", desc: "余额结构与流水核查" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent"
              >
                <p className="font-medium text-slate-950">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">系统说明</CardTitle>
            <CardDescription>本轮后台整理的实现重点</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Alert variant="info">
              <AlertTitle>界面基础已统一</AlertTitle>
              <AlertDescription>
                告警、头像、抽屉、骨架屏、侧栏和表格都已统一到同一套 shadcn/ui 组合方式，中文界面层级也重新校准过。
              </AlertDescription>
            </Alert>
            <Alert variant="default">
              <ServerCrash className="mb-2 h-4 w-4" />
              <AlertTitle>接口容错已补齐</AlertTitle>
              <AlertDescription>
                后台页面会先归一化后端响应，再参与渲染。即使拿到数组、分页对象或嵌套字段，页面也能继续显示而不是直接报错。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
