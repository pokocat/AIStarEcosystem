"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Search, ShieldCheck, ShieldOff, Trash2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionDialog } from "@/components/ActionDialog";
import { StaffApi } from "@/api";
import type { AdminUser, AdminRole, AdminStatus } from "@/types/account";
import { formatDateCN } from "@/lib/utils";
import { useAdminRole } from "@/lib/useAdminRole";

/**
 * /platform/staff — 后台管理员账号 CRUD（admin_users 表）。
 * 仅 SUPER_ADMIN 可访问（server 端 AepSecurityConfig 强制；前端 nav 同样 role-gated）。
 *
 * 不能误删 / 自降级当前登录账号：UI 层禁用相关按钮 + 二次确认；server 端无此校验
 * （后续 v0.32+ 可加 self-protect）。
 */
export default function AdminStaffPage() {
  const currentRole = useAdminRole();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | AdminRole>("all");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);
  const [deleting, setDeleting] = React.useState<AdminUser | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await StaffApi.listStaff(0, 200);
      setUsers(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!needle) return true;
      return (
        u.username.toLowerCase().includes(needle) ||
        u.displayName.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle)
      );
    });
  }, [users, q, roleFilter]);

  const superCount = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const opCount = users.filter((u) => u.role === "OPERATOR").length;
  const suspended = users.filter((u) => u.status === "suspended").length;

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const handleEdit = (u: AdminUser) => {
    setEditing(u);
    setFormOpen(true);
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="后台管理员"
        description="admin_users 表 · 管理 admin 后台登录账号与角色。仅超级管理员可访问。"
        breadcrumb={[{ label: "平台账户" }, { label: "后台管理员" }]}
        actions={
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" /> 新建管理员
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="账号总数"   value={users.length} icon={UserCog} />
        <StatCard label="超级管理员" value={superCount}   icon={ShieldCheck} tone="success" />
        <StatCard label="运营"       value={opCount}      icon={UserCog} />
        <StatCard label="已停用"     value={suspended}    icon={ShieldOff} tone={suspended ? "warning" : "default"} />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">账号列表</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按用户名 / 显示名 / 邮箱搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
              <SelectItem value="OPERATOR">运营</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
              {loadError.includes("FORBIDDEN") || loadError.includes("403") ? (
                <span className="ml-2 text-xs text-muted-foreground">（仅超级管理员可访问该页）</span>
              ) : null}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名 / 显示名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((u) => {
                const isSelf = currentRole === u.role && u.username === currentRole; // 仅一种 loose self 判断
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.displayName || u.username}</span>
                        <span className="text-xs text-muted-foreground">{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell>
                      {u.role === "SUPER_ADMIN" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700">
                          <ShieldCheck className="h-3 w-3" /> 超级管理员
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                          <UserCog className="h-3 w-3" /> 运营
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.status === "active" ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
                          活跃
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-700 ring-1 ring-rose-200">
                          已停用
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt ? formatDateCN(u.lastLoginAt) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateCN(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(u)} title="编辑">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(u)}
                          disabled={isSelf}
                          title={isSelf ? "不能删除当前登录账号" : "删除"}
                        >
                          <Trash2 className={`h-3.5 w-3.5 ${isSelf ? "text-muted-foreground" : "text-rose-600"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无账号</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StaffFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={() => {
          setFormOpen(false);
          void reload();
        }}
      />

      {deleting && (
        <ActionDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`删除管理员：${deleting.displayName || deleting.username}`}
          description={`此操作不可撤销。该账号将立即失去 admin 后台登录权限。`}
          tone="danger"
          confirmLabel="删除"
          requireReason
          onConfirm={async () => {
            try {
              await StaffApi.deleteStaff(deleting.id);
              await reload();
            } catch (err) {
              setLoadError(err instanceof Error ? err.message : "删除失败");
            }
          }}
        />
      )}
    </div>
  );
}

// ── 新建 / 编辑 dialog ──────────────────────────────────────────────────────
function StaffFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: AdminUser | null;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AdminRole>("OPERATOR");
  const [status, setStatus] = React.useState<AdminStatus>("active");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setPassword("");
    if (initial) {
      setUsername(initial.username);
      setDisplayName(initial.displayName);
      setEmail(initial.email);
      setRole(initial.role);
      setStatus(initial.status);
    } else {
      setUsername("");
      setDisplayName("");
      setEmail("");
      setRole("OPERATOR");
      setStatus("active");
    }
  }, [open, initial]);

  const handleSubmit = async () => {
    const trimmedUsername = username.trim();
    if (!isEdit) {
      if (!trimmedUsername) return setError("用户名不能为空");
      if (!password.trim()) return setError("初始密码不能为空");
      if (password.length < 6) return setError("密码至少 6 位");
    } else if (password && password.length < 6) {
      return setError("新密码至少 6 位（留空则不修改）");
    }

    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await StaffApi.updateStaff(initial.id, {
          email: email.trim() || undefined,
          displayName: displayName.trim() || undefined,
          role,
          status,
          password: password.trim() || undefined,
        });
      } else {
        await StaffApi.createStaff({
          username: trimmedUsername,
          password: password.trim(),
          email: email.trim() || undefined,
          displayName: displayName.trim() || undefined,
          role,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑管理员" : "新建管理员"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "用户名不可修改；密码留空保持不变。"
              : "新建后请把初始密码安全告知本人。SUPER_ADMIN 拥有全部权限，谨慎授予。"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">用户名（登录用）</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如 operator_zhang"
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">显示名</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="张三" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">邮箱</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="zhang@aistareco.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">角色</label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPERATOR">运营（OPERATOR）</SelectItem>
                <SelectItem value="SUPER_ADMIN">超级管理员（SUPER_ADMIN）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div>
              <label className="text-xs text-muted-foreground">账号状态</label>
              <Select value={status} onValueChange={(v) => setStatus(v as AdminStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="suspended">已停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">
              {isEdit ? "重置密码（留空不修改）" : "初始密码"}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "若需重置请输入新密码" : "至少 6 位"}
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && <div className="text-xs text-rose-600">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 保存中…</> : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
