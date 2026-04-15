"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Coins, ShieldCheck } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
import { PageResponse, Tenant, User } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function roleVariant(role: User["role"]) {
  switch (role) {
    case "platform_owner":
      return "destructive";
    case "platform_operator":
      return "default";
    case "finance_admin":
      return "info";
    case "channel_manager":
      return "secondary";
    case "producer":
    case "coach":
      return "secondary";
    default:
      return "outline";
  }
}

function roleLabel(role: User["role"]) {
  switch (role) {
    case "platform_owner":
      return "平台所有者";
    case "platform_operator":
      return "平台运营";
    case "finance_admin":
      return "财务管理员";
    case "channel_manager":
      return "渠道管理员";
    case "producer":
      return "制作人";
    case "coach":
      return "掌门人";
    case "fan":
      return "粉丝";
    default:
      return role;
  }
}

function statusVariant(status: User["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "warning";
    case "deleted":
      return "destructive";
    default:
      return "secondary";
  }
}

function statusLabel(status: User["status"]) {
  switch (status) {
    case "active":
      return "正常";
    case "suspended":
      return "已暂停";
    case "deleted":
      return "已删除";
    default:
      return status;
  }
}

function planVariant(plan: User["plan"]) {
  switch (plan) {
    case "enterprise":
      return "default";
    case "pro":
      return "info";
    default:
      return "outline";
  }
}

function planLabel(plan: User["plan"]) {
  switch (plan) {
    case "enterprise":
      return "企业版";
    case "pro":
      return "专业版";
    case "free":
      return "免费版";
    default:
      return plan;
  }
}

function tenantTypeLabel(type: Tenant["type"]) {
  switch (type) {
    case "organization":
      return "组织";
    case "channel":
      return "渠道";
    case "personal":
      return "个人";
    default:
      return type;
  }
}

function normalizeUser(item: Partial<User>): User {
  return {
    id: item.id ?? "",
    username: item.username ?? "未命名用户",
    email: item.email ?? null,
    phone: item.phone ?? null,
    displayName: item.displayName ?? null,
    avatarUrl: item.avatarUrl ?? null,
    walletAddress: item.walletAddress ?? null,
    role: (item.role ?? "fan") as User["role"],
    plan: (item.plan ?? "free") as User["plan"],
    credits: Number(item.credits ?? 0),
    status: (item.status ?? "active") as User["status"],
    emailVerified: Boolean(item.emailVerified),
    phoneVerified: Boolean(item.phoneVerified),
    langPreference: item.langPreference ?? null,
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    lastLoginAt: item.lastLoginAt ?? null,
  };
}

function normalizeTenant(item: Partial<Tenant>): Tenant {
  return {
    id: item.id ?? "",
    name: item.name ?? "未命名租户",
    type: (item.type ?? "personal") as Tenant["type"],
    status: (item.status ?? "active") as Tenant["status"],
    ownerUserId: item.ownerUserId ?? "",
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function fetchDetail() {
      setLoading(true);
      setError(null);

      try {
        const [userData, tenantData] = await Promise.all([
          apiFetch<unknown>(`/api/admin/users/${userId}`),
          apiFetch<unknown>("/api/admin/tenants?page=0&size=100"),
        ]);

        const normalizedUser = normalizeUser(userData as Partial<User>);
        const normalizedTenants: PageResponse<Partial<Tenant>> = normalizePageResponse(tenantData, [
          "tenants",
          "content",
          "items",
          "records",
        ]);

        setUser(normalizedUser);
        setTenants(
          normalizedTenants.content
            .map(normalizeTenant)
            .filter((tenant) => tenant.ownerUserId === normalizedUser.id)
        );
      } catch {
        setUser(null);
        setTenants([]);
        setError("加载用户详情失败，请稍后刷新重试。");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [userId]);

  const verifiedChannels = useMemo(() => {
    if (!user) return 0;
    return Number(user.emailVerified) + Number(user.phoneVerified);
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回用户列表
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>用户详情暂不可用</AlertTitle>
          <AlertDescription>{error ?? "未找到该用户。"} </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回用户列表
            </Link>
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {user.username}
              </h2>
              <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
              <Badge variant={planVariant(user.plan)}>{planLabel(user.plan)}</Badge>
              <Badge variant={statusVariant(user.status)}>{statusLabel(user.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              用户 ID：<span className="font-mono">{user.id}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前积分</CardTitle>
            <CardDescription>用户表中的积分冗余字段，用于后台快速巡视</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatCount(user.credits)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Coins className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">验证状态</CardTitle>
            <CardDescription>邮箱和手机号的验证完成情况</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {verifiedChannels}/2
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">名下租户</CardTitle>
            <CardDescription>当前由该账号作为所有者创建的租户数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatCount(tenants.length)}
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Building2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">基础资料</CardTitle>
            <CardDescription>用于排查注册方式、验证状态和资料完整性</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">展示名</p>
              <p className="text-sm text-slate-950">{user.displayName ?? "未设置"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">语言偏好</p>
              <p className="text-sm text-slate-950">{user.langPreference ?? "未设置"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">邮箱</p>
              <p className="text-sm text-slate-950">{user.email ?? "未绑定"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">手机号</p>
              <p className="text-sm text-slate-950">{user.phone ?? "未绑定"}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">钱包地址</p>
              <p className="break-all font-mono text-sm text-slate-950">
                {user.walletAddress ?? "未绑定 Web3 钱包"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">时间线</CardTitle>
            <CardDescription>账号生命周期与最近活跃时间</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">注册时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(user.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近更新</p>
              <p className="text-sm text-slate-950">{formatDateTime(user.updatedAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最后登录</p>
              <p className="text-sm text-slate-950">{formatDateTime(user.lastLoginAt)}</p>
            </div>
            <Alert variant="info">
              <AlertTitle>当前页为只读巡检视图</AlertTitle>
              <AlertDescription>
                这一页优先承载运营排查信息，后续可继续接入会话明细、OAuth 绑定和审计轨迹。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle className="text-lg">名下租户</CardTitle>
          <CardDescription>帮助快速定位该账号拥有的个人或组织工作区</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    当前没有归属到该用户的租户。
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className="text-slate-950 transition-colors hover:text-sky-700 hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>{tenantTypeLabel(tenant.type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
