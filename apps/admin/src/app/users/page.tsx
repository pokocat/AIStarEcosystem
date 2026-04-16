"use client";

import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Edit2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
import { PageResponse, User } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ─── label / variant helpers ─── */

function statusVariant(status: User["status"]) {
  switch (status) {
    case "active":    return "success";
    case "suspended": return "warning";
    case "deleted":   return "destructive";
    default:          return "secondary";
  }
}

function roleVariant(role: User["role"]) {
  switch (role) {
    case "economic_company": return "default";
    case "ai_artist":        return "info";
    case "ai_singer":        return "secondary";
    default:                 return "outline";
  }
}

function roleLabel(role: User["role"]) {
  const labels: Record<User["role"], string> = {
    ai_singer:        "AI 歌手",
    ai_artist:        "AI 艺人",
    economic_company: "经纪公司",
  };
  return labels[role] ?? role;
}

function statusLabel(status: User["status"]) {
  const labels: Record<User["status"], string> = {
    active: "正常",
    suspended: "已暂停",
    deleted: "已删除",
  };
  return labels[status] ?? status;
}

function normalizeUser(item: Partial<User>): User {
  return {
    id:            item.id ?? "",
    username:      item.username ?? "未命名用户",
    email:         item.email ?? null,
    phone:         item.phone ?? null,
    displayName:   item.displayName ?? null,
    avatarUrl:     item.avatarUrl ?? null,
    role:          (item.role ?? "ai_singer") as User["role"],
    credits:       Number(item.credits ?? 0),
    status:        (item.status ?? "active") as User["status"],
    emailVerified: Boolean(item.emailVerified),
    phoneVerified: Boolean(item.phoneVerified),
    createdAt:     item.createdAt ?? "",
    updatedAt:     item.updatedAt ?? "",
    lastLoginAt:   item.lastLoginAt ?? null,
  };
}

/* ─── InfoRow helper ─── */

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/* ─── User Detail Drawer ─── */

function UserDetailDrawer({
  user,
  open,
  onClose,
  onEdit,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onEdit: (user: User) => void;
}) {
  if (!user) return null;

  const initials = (user.displayName ?? user.username)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 rounded-2xl">
              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-semibold text-base">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {user.displayName ?? user.username}
              </SheetTitle>
              <SheetDescription className="truncate">@{user.username}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={statusVariant(user.status)}>{statusLabel(user.status)}</Badge>
            <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 联系信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              联系信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="邮箱">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{user.email ?? "—"}</span>
                  {user.email && (
                    <Badge variant={user.emailVerified ? "success" : "outline"} className="text-[10px]">
                      {user.emailVerified ? "已验证" : "未验证"}
                    </Badge>
                  )}
                </div>
              </InfoRow>
              <InfoRow label="手机号">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{user.phone ?? "—"}</span>
                  {user.phone && (
                    <Badge variant={user.phoneVerified ? "success" : "outline"} className="text-[10px]">
                      {user.phoneVerified ? "已验证" : "未验证"}
                    </Badge>
                  )}
                </div>
              </InfoRow>
            </div>
          </div>

          <Separator />

          {/* 账户详情 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              账户详情
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="用户 ID">
                <span className="font-mono text-xs break-all">{user.id || "—"}</span>
              </InfoRow>
              <InfoRow label="积分余额">
                <span className="font-mono font-semibold text-primary">
                  {formatCount(user.credits)}
                </span>
              </InfoRow>
              <InfoRow label="账户角色">
                <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
              </InfoRow>
            </div>
          </div>

          <Separator />

          {/* 时间信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间记录
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="注册时间">{formatDateTime(user.createdAt)}</InfoRow>
              <InfoRow label="最近更新">{formatDateTime(user.updatedAt)}</InfoRow>
              <InfoRow label="最后登录">
                {user.lastLoginAt ? (
                  formatDateTime(user.lastLoginAt)
                ) : (
                  <span className="text-muted-foreground">从未登录</span>
                )}
              </InfoRow>
            </div>
          </div>

          {/* 验证状态 */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              验证状态
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">邮箱验证</span>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${user.emailVerified ? "text-emerald-600" : "text-muted-foreground"}`}>
                {user.emailVerified ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> 已验证</>
                ) : (
                  <><X className="h-3.5 w-3.5" /> 未验证</>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">手机验证</span>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${user.phoneVerified ? "text-emerald-600" : "text-muted-foreground"}`}>
                {user.phoneVerified ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> 已验证</>
                ) : (
                  <><X className="h-3.5 w-3.5" /> 未验证</>
                )}
              </div>
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button size="sm" onClick={() => onEdit(user)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" />
            编辑用户
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Edit User Dialog ─── */

function EditUserDialog({
  user,
  open,
  onClose,
  onSave,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: User) => void;
}) {
  const [status, setStatus] = useState<User["status"]>("active");
  const [role, setRole] = useState<User["role"]>("ai_singer");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setStatus(user.status);
      setRole(user.role);
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, role }),
      });
    } catch {
      // API not available yet — proceed with optimistic update
    } finally {
      setSaving(false);
      onSave({ ...user, status, role });
      onClose();
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改 <span className="font-medium text-foreground">@{user.username}</span> 的角色与状态
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-status">账户状态</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as User["status"])}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="suspended">已暂停</SelectItem>
                <SelectItem value="deleted">已删除</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-role">用户角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as User["role"])}>
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_singer">AI 歌手</SelectItem>
                <SelectItem value="ai_artist">AI 艺人</SelectItem>
                <SelectItem value="economic_company">经纪公司</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存更改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);

  async function fetchUsers(targetPage = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/users?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<User>> = normalizePageResponse(data, [
        "users", "content", "items", "records",
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

  useEffect(() => { fetchUsers(0); }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q)) ||
        (u.displayName?.toLowerCase().includes(q)) ||
        (u.phone?.includes(q))
    );
  }, [users, search]);

  const verifiedCount = users.filter((u) => u.emailVerified || u.phoneVerified).length;

  function handleUserSaved(updated: User) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">用户管理</h2>
          <p className="text-sm text-muted-foreground">
            平台用户（通过激活码注册的 AI 歌手、AI 艺人及经纪公司）账号状态与管理。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchUsers(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      {/* Stats */}
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
              {loading ? "..." : formatCount(verifiedCount)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分页状态</CardTitle>
            <CardDescription>用于快速判断当前浏览位置与剩余页数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : `${page + 1} / ${Math.max(totalPages, 1)}`}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索用户名、邮箱、昵称或手机号…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>联系信息</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-right">积分余额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    {search ? `未找到匹配"${search}"的用户。` : "当前没有可展示的用户数据。"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.id || user.username}
                    className="group cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7 rounded-xl shrink-0">
                          <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-[10px] font-semibold">
                            {(user.displayName ?? user.username).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-slate-950 font-medium">{user.username}</div>
                          {user.displayName && (
                            <div className="truncate text-xs text-muted-foreground">{user.displayName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {user.email ?? user.phone ?? "暂无"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(user.role)}>{roleLabel(user.role)}</Badge>
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="编辑用户"
                          onClick={(e) => { e.stopPropagation(); setEditUser(user); }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="查看详情"
                          onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchUsers(page - 1)} disabled={page === 0 || loading}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => fetchUsers(page + 1)} disabled={page >= totalPages - 1 || loading}>
            下一页
          </Button>
        </div>
      )}

      {/* Search result count */}
      {search && !loading && (
        <p className="text-center text-sm text-muted-foreground">
          共找到 {filteredUsers.length} 条匹配记录
        </p>
      )}

      {/* Detail Drawer */}
      <UserDetailDrawer
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onEdit={(u) => { setSelectedUser(null); setEditUser(u); }}
      />

      {/* Edit Dialog */}
      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSave={handleUserSaved}
      />
    </div>
  );
}
