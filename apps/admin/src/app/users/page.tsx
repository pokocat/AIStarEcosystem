"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/utils";
import { PageResponse, User } from "@/types";
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

function roleVariant(role: User["role"]) {
  switch (role) {
    case "platform_operator":
      return "default";
    case "finance_admin":
      return "info";
    case "producer":
    case "coach":
      return "secondary";
    default:
      return "outline";
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

function roleLabel(role: User["role"]) {
  switch (role) {
    case "platform_operator":
      return "平台运营";
    case "finance_admin":
      return "财务管理员";
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

function normalizeUser(item: Partial<User>): User {
  return {
    id: item.id ?? "",
    username: item.username ?? "未命名用户",
    email: item.email ?? null,
    phone: item.phone ?? null,
    displayName: item.displayName ?? null,
    avatarUrl: item.avatarUrl ?? null,
    role: (item.role ?? "fan") as User["role"],
    plan: (item.plan ?? "free") as User["plan"],
    credits: Number(item.credits ?? 0),
    status: (item.status ?? "active") as User["status"],
    emailVerified: Boolean(item.emailVerified),
    phoneVerified: Boolean(item.phoneVerified),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    lastLoginAt: item.lastLoginAt ?? null,
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchUsers(targetPage = 0) {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>(`/api/admin/users?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<User>> = normalizePageResponse(data, [
        "users",
        "content",
        "items",
        "records",
      ]);
      setUsers(normalized.content.map(normalizeUser));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setUsers([]);
      setTotalPages(0);
      setPage(0);
      setError("加载用户列表失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers(0);
  }, []);

  const verifiedUsers = users.filter((user) => user.emailVerified || user.phoneVerified).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">用户管理</h2>
          <p className="text-sm text-muted-foreground">
            查看平台用户身份、套餐、角色状态与基础验证信息。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchUsers(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页用户</CardTitle>
            <CardDescription>当前分页已加载的用户记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(users.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Users className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已验证用户</CardTitle>
            <CardDescription>邮箱或手机号已完成验证的账号</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(verifiedUsers)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分页状态</CardTitle>
            <CardDescription>便于运营同学快速判断是否还有更多记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : `${page + 1}/${Math.max(totalPages, 1)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>用户数据暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>联系信息</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead className="text-right">积分</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的用户数据。
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id || user.username}>
                    <TableCell className="font-medium">
                      <div className="text-slate-950">{user.username}</div>
                      {user.displayName && (
                        <div className="text-xs text-muted-foreground">{user.displayName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email ?? user.phone ?? "暂无"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={planVariant(user.plan)}>{planLabel(user.plan)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCount(user.credits)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(user.status)}>{statusLabel(user.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(page - 1)}
            disabled={page === 0 || loading}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
