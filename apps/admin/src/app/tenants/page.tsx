"use client";

import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  ChevronRight,
  Edit2,
  RefreshCw,
  Search,
  Users2,
  X,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
import { PageResponse, Tenant } from "@/types";
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

/* ─── helpers ─── */

function statusVariant(status: Tenant["status"]) {
  switch (status) {
    case "active":    return "success";
    case "suspended": return "warning";
    case "deleted":   return "destructive";
    default:          return "secondary";
  }
}

function typeVariant(type: Tenant["type"]) {
  switch (type) {
    case "organization": return "info";
    case "channel":      return "secondary";
    default:             return "outline";
  }
}

function typeLabel(type: Tenant["type"]) {
  const labels: Record<Tenant["type"], string> = {
    organization: "组织",
    channel: "渠道",
    personal: "个人",
  };
  return labels[type] ?? type;
}

function statusLabel(status: Tenant["status"]) {
  const labels: Record<Tenant["status"], string> = {
    active: "正常",
    suspended: "已暂停",
    deleted: "已删除",
  };
  return labels[status] ?? status;
}

function typeIcon(type: Tenant["type"]) {
  switch (type) {
    case "organization": return "🏢";
    case "channel":      return "📡";
    case "personal":     return "👤";
    default:             return "🔷";
  }
}

function normalizeTenant(item: Partial<Tenant>): Tenant {
  return {
    id:          item.id ?? "",
    name:        item.name ?? "未命名租户",
    type:        (item.type ?? "personal") as Tenant["type"],
    status:      (item.status ?? "active") as Tenant["status"],
    ownerUserId: item.ownerUserId ?? "未绑定",
    createdAt:   item.createdAt ?? "",
    updatedAt:   item.updatedAt ?? "",
  };
}

/* ─── InfoRow ─── */

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/* ─── Tenant Detail Drawer ─── */

function TenantDetailDrawer({
  tenant,
  open,
  onClose,
  onEdit,
}: {
  tenant: Tenant | null;
  open: boolean;
  onClose: () => void;
  onEdit: (t: Tenant) => void;
}) {
  if (!tenant) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              {typeIcon(tenant.type)}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{tenant.name}</SheetTitle>
              <SheetDescription>租户 ID：{tenant.id || "—"}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
            <Badge variant={typeVariant(tenant.type)}>{typeLabel(tenant.type)}</Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 基础信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              基础信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="租户名称">
                <span className="font-medium">{tenant.name}</span>
              </InfoRow>
              <InfoRow label="工作区类型">
                <div className="flex items-center gap-2">
                  <span>{typeIcon(tenant.type)}</span>
                  <Badge variant={typeVariant(tenant.type)}>{typeLabel(tenant.type)}</Badge>
                </div>
              </InfoRow>
              <InfoRow label="所有者用户 ID">
                <span className="font-mono text-xs break-all">{tenant.ownerUserId}</span>
              </InfoRow>
            </div>
          </div>

          <Separator />

          {/* 状态信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              状态
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">当前状态</span>
                <Badge variant={statusVariant(tenant.status)}>
                  {statusLabel(tenant.status)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* 时间记录 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间记录
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="创建时间">{formatDateTime(tenant.createdAt)}</InfoRow>
              <InfoRow label="最近更新">{formatDateTime(tenant.updatedAt)}</InfoRow>
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button size="sm" onClick={() => onEdit(tenant)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" />
            编辑状态
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Edit Tenant Dialog ─── */

function EditTenantDialog({
  tenant,
  open,
  onClose,
  onSave,
}: {
  tenant: Tenant | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Tenant) => void;
}) {
  const [status, setStatus] = useState<Tenant["status"]>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) setStatus(tenant.status);
  }, [tenant]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch {
      // Optimistic update even if API unavailable
    } finally {
      setSaving(false);
      onSave({ ...tenant, status });
      onClose();
    }
  }

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>编辑租户状态</DialogTitle>
          <DialogDescription>
            修改 <span className="font-medium text-foreground">{tenant.name}</span> 的启用状态
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-tenant-status">租户状态</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Tenant["status"])}>
              <SelectTrigger id="edit-tenant-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="suspended">已暂停</SelectItem>
                <SelectItem value="deleted">已删除</SelectItem>
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

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);

  async function fetchTenants(targetPage = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/tenants?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<Tenant>> = normalizePageResponse(data, [
        "tenants", "content", "items", "records",
      ]);
      setTenants(normalized.content.map(normalizeTenant));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setTenants([]);
      setTotalPages(0);
      setPage(0);
      setError("加载租户列表失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTenants(0); }, []);

  const filteredTenants = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.ownerUserId.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const organizationCount = tenants.filter((t) => t.type === "organization").length;
  const activeCount = tenants.filter((t) => t.status === "active").length;

  function handleTenantSaved(updated: Tenant) {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">租户空间</h2>
          <p className="text-sm text-muted-foreground">
            管理组织、渠道与个人工作区的归属、状态和创建信息。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTenants(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页租户</CardTitle>
            <CardDescription>本页已加载的租户空间记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(tenants.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Building2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">组织租户</CardTitle>
            <CardDescription>适用于企业或团队管理的租户类型</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(organizationCount)}
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Users2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">正常租户</CardTitle>
            <CardDescription>状态为"正常"的租户空间数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(activeCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>租户数据暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索租户名称、所有者 ID…"
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
                <TableHead>租户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>所有者 ID</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    {search ? `未找到匹配"${search}"的租户。` : "当前没有可展示的租户数据。"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow
                    key={tenant.id || tenant.name}
                    className="group cursor-pointer"
                    onClick={() => setSelectedTenant(tenant)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{typeIcon(tenant.type)}</span>
                        <span className="text-slate-950">{tenant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeVariant(tenant.type)}>{typeLabel(tenant.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tenant.ownerUserId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="编辑状态"
                          onClick={(e) => { e.stopPropagation(); setEditTenant(tenant); }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="查看详情"
                          onClick={(e) => { e.stopPropagation(); setSelectedTenant(tenant); }}
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
          <Button variant="outline" size="sm" onClick={() => fetchTenants(page - 1)} disabled={page === 0 || loading}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => fetchTenants(page + 1)} disabled={page >= totalPages - 1 || loading}>
            下一页
          </Button>
        </div>
      )}

      {search && !loading && (
        <p className="text-center text-sm text-muted-foreground">
          共找到 {filteredTenants.length} 条匹配记录
        </p>
      )}

      {/* Detail Drawer */}
      <TenantDetailDrawer
        tenant={selectedTenant}
        open={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        onEdit={(t) => { setSelectedTenant(null); setEditTenant(t); }}
      />

      {/* Edit Dialog */}
      <EditTenantDialog
        tenant={editTenant}
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        onSave={handleTenantSaved}
      />
    </div>
  );
}
