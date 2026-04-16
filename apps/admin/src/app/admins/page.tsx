"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Edit2,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AdminUser, PageResponse } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ─── helpers ─── */

function roleVariant(role: AdminUser["role"]) {
  return role === "super_admin" ? "default" : "secondary";
}

function roleLabel(role: AdminUser["role"]) {
  return role === "super_admin" ? "超级管理员" : "运营";
}

function statusVariant(status: AdminUser["status"]) {
  return status === "active" ? "success" : "warning";
}

function statusLabel(status: AdminUser["status"]) {
  return status === "active" ? "正常" : "已暂停";
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function normalizeAdmin(item: Partial<AdminUser>): AdminUser {
  return {
    id:          item.id ?? "",
    username:    item.username ?? "",
    email:       item.email ?? null,
    displayName: item.displayName ?? null,
    role:        (item.role ?? "operator") as AdminUser["role"],
    status:      (item.status ?? "active") as AdminUser["status"],
    createdAt:   item.createdAt ?? "",
    updatedAt:   item.updatedAt ?? "",
    lastLoginAt: item.lastLoginAt ?? null,
  };
}

/* ─── Create/Edit Dialog ─── */

function AdminFormDialog({
  admin,
  open,
  onClose,
  onSaved,
}: {
  admin: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSaved: (a: AdminUser) => void;
}) {
  const isEdit = !!admin;
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("operator");
  const [status, setStatus] = useState<AdminUser["status"]>("active");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      setUsername(admin.username);
      setDisplayName(admin.displayName ?? "");
      setEmail(admin.email ?? "");
      setRole(admin.role);
      setStatus(admin.status);
      setPassword("");
    } else {
      setUsername("");
      setDisplayName("");
      setEmail("");
      setRole("operator");
      setStatus("active");
      setPassword("");
    }
    setError(null);
  }, [admin, open]);

  async function handleSave() {
    if (!isEdit && !username.trim()) {
      setError("用户名不能为空");
      return;
    }
    if (!isEdit && !password.trim()) {
      setError("创建账号时密码不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = { role, status };
      if (displayName) body.displayName = displayName;
      if (email) body.email = email;
      if (password) body.password = password;
      if (!isEdit) body.username = username;

      const result = await apiFetch<AdminUser>(
        isEdit ? `/api/admin/staff/${admin!.id}` : "/api/admin/staff",
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      onSaved(normalizeAdmin(result as Partial<AdminUser>));
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑管理员" : "创建管理员"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `修改 @${admin!.username} 的信息`
              : "添加一个新的后台管理账号"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {!isEdit && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-username">用户名 *</Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin_ops"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-display">显示名称</Label>
            <Input
              id="admin-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="平台运营"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-email">邮箱</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops@aistareco.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-role">角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminUser["role"])}>
              <SelectTrigger id="admin-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">超级管理员</SelectItem>
                <SelectItem value="operator">运营</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-status">账号状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AdminUser["status"])}>
                <SelectTrigger id="admin-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="suspended">已暂停</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-password">
              {isEdit ? "新密码（留空则不修改）" : "密码 *"}
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : isEdit ? "保存更改" : "创建账号"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  async function fetchAdmins(targetPage = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/staff?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<AdminUser>> = normalizePageResponse(data, [
        "staff", "admins", "content", "items",
      ]);
      setAdmins(normalized.content.map(normalizeAdmin));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setAdmins([]);
      setTotalPages(0);
      setPage(0);
      setError("加载管理员列表失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAdmins(0); }, []);

  function handleSaved(saved: AdminUser) {
    setAdmins((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  const superAdminCount = admins.filter((a) => a.role === "super_admin").length;
  const operatorCount   = admins.filter((a) => a.role === "operator").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">管理员账号</h2>
          <p className="text-sm text-muted-foreground">
            后台运营人员账号管理，与平台用户完全隔离。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAdmins(page)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建管理员
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">管理员总数</CardTitle>
            <CardDescription>当前页已加载</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : admins.length}
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <UserCog className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">超级管理员</CardTitle>
            <CardDescription>拥有全权访问权限</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : superAdminCount}
            </div>
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">运营人员</CardTitle>
            <CardDescription>日常运营操作权限</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : operatorCount}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <UserCog className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    暂无管理员账号数据。
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((admin) => (
                  <TableRow key={admin.id} className="group">
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-slate-950 font-medium">
                          {admin.displayName ?? admin.username}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">@{admin.username}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {admin.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariant(admin.role)}>{roleLabel(admin.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(admin.status)}>{statusLabel(admin.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(admin.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : "从未"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="编辑"
                        onClick={() => setEditAdmin(admin)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
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
          <Button variant="outline" size="sm" onClick={() => fetchAdmins(page - 1)} disabled={page === 0 || loading}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => fetchAdmins(page + 1)} disabled={page >= totalPages - 1 || loading}>
            下一页
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <AdminFormDialog
        admin={null}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={handleSaved}
      />
      <AdminFormDialog
        admin={editAdmin}
        open={!!editAdmin}
        onClose={() => setEditAdmin(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
