"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Coins, Users2 } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatAmount, formatDateTime } from "@/lib/utils";
import { Entitlement, PageResponse, Tenant, User, Wallet } from "@/types";
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

function typeVariant(type: Tenant["type"]) {
  switch (type) {
    case "organization":
      return "info";
    case "channel":
      return "secondary";
    default:
      return "outline";
  }
}

function typeLabel(type: Tenant["type"]) {
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

function statusVariant(status: Tenant["status"]) {
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

function statusLabel(status: Tenant["status"]) {
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

function entitlementStatusVariant(status: Entitlement["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "expired":
      return "warning";
    case "revoked":
      return "destructive";
    default:
      return "secondary";
  }
}

function entitlementStatusLabel(status: Entitlement["status"]) {
  switch (status) {
    case "active":
      return "生效中";
    case "expired":
      return "已过期";
    case "revoked":
      return "已撤销";
    default:
      return status;
  }
}

function entitlementTypeLabel(type: Entitlement["entitlementType"]) {
  switch (type) {
    case "feature_access":
      return "功能访问";
    case "seat_limit":
      return "席位上限";
    case "quota_limit":
      return "额度限制";
    case "monthly_credit":
      return "月度积分";
    case "addon":
      return "增值能力";
    case "singer_slot":
      return "歌手席位";
    case "nft_mint_quota":
      return "NFT 配额";
    case "distribution_tier":
      return "分发等级";
    default:
      return type;
  }
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

function normalizeWallet(item: Partial<Wallet>): Wallet {
  return {
    id: item.id ?? "",
    tenantId: item.tenantId ?? "",
    totalBalance: Number(item.totalBalance ?? 0),
    giftBalance: Number(item.giftBalance ?? 0),
    rechargeBalance: Number(item.rechargeBalance ?? 0),
    planBalance: Number(item.planBalance ?? 0),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

function normalizeEntitlement(item: Partial<Entitlement>): Entitlement {
  return {
    id: item.id ?? "",
    tenantId: item.tenantId ?? "",
    productId: item.productId ?? "",
    planId: item.planId ?? null,
    entitlementType: (item.entitlementType ?? "feature_access") as Entitlement["entitlementType"],
    featureCode: item.featureCode ?? "unknown.feature",
    value: item.value ?? "0",
    validFrom: item.validFrom ?? "",
    validTo: item.validTo ?? null,
    status: (item.status ?? "active") as Entitlement["status"],
    createdAt: item.createdAt ?? "",
  };
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

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    async function fetchDetail() {
      setLoading(true);
      setError(null);

      try {
        const tenantData = await apiFetch<unknown>(`/api/admin/tenants/${tenantId}`);
        const normalizedTenant = normalizeTenant(tenantData as Partial<Tenant>);

        const [walletData, entitlementData] = await Promise.all([
          apiFetch<unknown>(`/api/admin/wallets/${tenantId}`).catch(() => null),
          apiFetch<unknown>(`/api/admin/entitlements?tenantId=${tenantId}&page=0&size=20`),
        ]);

        let ownerData: User | null = null;
        if (normalizedTenant.ownerUserId) {
          try {
            const ownerResponse = await apiFetch<unknown>(
              `/api/admin/users/${normalizedTenant.ownerUserId}`
            );
            ownerData = normalizeUser(ownerResponse as Partial<User>);
          } catch {
            ownerData = null;
          }
        }

        const normalizedEntitlements: PageResponse<Partial<Entitlement>> = normalizePageResponse(
          entitlementData,
          ["entitlements", "content", "items", "records"]
        );

        setTenant(normalizedTenant);
        setWallet(walletData ? normalizeWallet(walletData as Partial<Wallet>) : null);
        setOwner(ownerData);
        setEntitlements(normalizedEntitlements.content.map(normalizeEntitlement));
      } catch {
        setTenant(null);
        setWallet(null);
        setOwner(null);
        setEntitlements([]);
        setError("加载租户详情失败，请稍后刷新重试。");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [tenantId]);

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
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/tenants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回租户列表
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>租户详情暂不可用</AlertTitle>
          <AlertDescription>{error ?? "未找到该租户。"} </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/tenants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回租户列表
          </Link>
        </Button>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{tenant.name}</h2>
            <Badge variant={typeVariant(tenant.type)}>{typeLabel(tenant.type)}</Badge>
            <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            租户 ID：<span className="font-mono">{tenant.id}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">钱包总余额</CardTitle>
            <CardDescription>统一积分视角下的当前可用余额</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatAmount(wallet?.totalBalance ?? 0)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Coins className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">生效权益数</CardTitle>
            <CardDescription>当前租户仍处于生效期的权益条目</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {entitlements.filter((item) => item.status === "active").length}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">所有者</CardTitle>
            <CardDescription>租户主账号，用于快速跳转排查</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-lg font-semibold tracking-tight text-slate-950">
              {owner ? owner.username : "未关联"}
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Users2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">基础信息</CardTitle>
            <CardDescription>租户状态、归属人与创建时间</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">所有者账号</p>
              {owner ? (
                <Link
                  href={`/users/${owner.id}`}
                  className="text-sm text-slate-950 transition-colors hover:text-sky-700 hover:underline"
                >
                  {owner.username}
                </Link>
              ) : (
                <p className="text-sm text-slate-950">{tenant.ownerUserId || "未设置"}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">创建时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(tenant.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近更新时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(tenant.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">钱包结构</CardTitle>
            <CardDescription>按赠送、充值、套餐积分拆分余额</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">赠送积分</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatAmount(wallet?.giftBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">充值积分</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatAmount(wallet?.rechargeBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">套餐积分</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatAmount(wallet?.planBalance ?? 0)}
              </p>
            </div>
            {!wallet && (
              <Alert variant="warning" className="sm:col-span-2">
                <AlertTitle>该租户尚未初始化钱包</AlertTitle>
                <AlertDescription>
                  当前未查到钱包数据，通常意味着该租户还未发生激活、补点或消费行为。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle className="text-lg">权益清单</CardTitle>
          <CardDescription>展示当前租户已授予的套餐能力与额度</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权益类型</TableHead>
                <TableHead>功能编码</TableHead>
                <TableHead>值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>生效时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    当前租户还没有可展示的权益记录。
                  </TableCell>
                </TableRow>
              ) : (
                entitlements.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {entitlementTypeLabel(item.entitlementType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.featureCode}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-950">{item.value}</TableCell>
                    <TableCell>
                      <Badge variant={entitlementStatusVariant(item.status)}>
                        {entitlementStatusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(item.validFrom)}
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
