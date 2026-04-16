"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Edit2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
import { Entitlement, PageResponse, Plan, Product } from "@/types";
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

function statusVariant(status: Entitlement["status"]) {
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

function entitlementTypeLabel(type: Entitlement["entitlementType"]) {
  const labels: Record<Entitlement["entitlementType"], string> = {
    feature_access: "功能访问",
    seat_limit: "席位上限",
    quota_limit: "额度限制",
    monthly_credit: "月度积分",
    addon: "增值能力",
    singer_slot: "歌手席位",
    nft_mint_quota: "NFT 铸造额度",
    distribution_tier: "分发等级",
  };
  return labels[type] ?? type;
}

function statusLabel(status: Entitlement["status"]) {
  const labels: Record<Entitlement["status"], string> = {
    active: "生效中",
    expired: "已过期",
    revoked: "已撤销",
  };
  return labels[status] ?? status;
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

/* ─── InfoRow ─── */

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/* ─── Detail Drawer ─── */

function EntitlementDetailDrawer({
  entitlement,
  open,
  onClose,
  onEdit,
  onRevoke,
  productMap,
  planMap,
}: {
  entitlement: Entitlement | null;
  open: boolean;
  onClose: () => void;
  onEdit: (e: Entitlement) => void;
  onRevoke: (e: Entitlement) => void;
  productMap: Map<string, Product>;
  planMap: Map<string, Plan>;
}) {
  if (!entitlement) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {entitlementTypeLabel(entitlement.entitlementType)}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {entitlement.featureCode}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={statusVariant(entitlement.status)}>
              {statusLabel(entitlement.status)}
            </Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              权益信息
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="权益类型">
                <Badge variant="secondary">
                  {entitlementTypeLabel(entitlement.entitlementType)}
                </Badge>
              </InfoRow>
              <InfoRow label="权益值">
                <span className="font-mono font-semibold">{entitlement.value}</span>
              </InfoRow>
              <InfoRow label="功能编码">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  {entitlement.featureCode}
                </code>
              </InfoRow>
              <InfoRow label="状态">
                <Badge variant={statusVariant(entitlement.status)}>
                  {statusLabel(entitlement.status)}
                </Badge>
              </InfoRow>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              关联信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="租户 ID">
                <span className="font-mono text-xs break-all">{entitlement.tenantId || "未关联"}</span>
              </InfoRow>
              <InfoRow label="产品">
                {productMap.has(entitlement.productId) ? (
                  <span className="font-medium">{productMap.get(entitlement.productId)!.name}</span>
                ) : (
                  <span className="font-mono text-xs break-all">{entitlement.productId || "未关联"}</span>
                )}
              </InfoRow>
              {entitlement.planId && (
                <InfoRow label="套餐">
                  {planMap.has(entitlement.planId) ? (
                    <span className="font-medium">{planMap.get(entitlement.planId)!.name}</span>
                  ) : (
                    <span className="font-mono text-xs break-all">{entitlement.planId}</span>
                  )}
                </InfoRow>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间记录
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="创建时间">{formatDateTime(entitlement.createdAt)}</InfoRow>
              <InfoRow label="生效时间">{formatDateTime(entitlement.validFrom)}</InfoRow>
              <InfoRow label="结束时间">
                {entitlement.validTo ? formatDateTime(entitlement.validTo) : (
                  <span className="text-muted-foreground">永久有效</span>
                )}
              </InfoRow>
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          {entitlement.status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onEdit(entitlement)}>
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                编辑
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onRevoke(entitlement)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                撤销
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Create / Edit Dialog ─── */

interface EntitlementFormData {
  tenantId: string;
  productId: string;
  planId: string;
  entitlementType: string;
  featureCode: string;
  value: string;
  validFrom: string;
  validTo: string;
  status: string;
}

const EMPTY_FORM: EntitlementFormData = {
  tenantId: "",
  productId: "",
  planId: "",
  entitlementType: "FEATURE_ACCESS",
  featureCode: "",
  value: "",
  validFrom: "",
  validTo: "",
  status: "ACTIVE",
};

function EntitlementFormDialog({
  mode,
  entitlement,
  open,
  onClose,
  onSaved,
  products,
  plans,
}: {
  mode: "create" | "edit";
  entitlement: Entitlement | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  products: Product[];
  plans: Plan[];
}) {
  const [form, setForm] = useState<EntitlementFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && entitlement) {
      setForm({
        tenantId: entitlement.tenantId,
        productId: entitlement.productId,
        planId: entitlement.planId ?? "",
        entitlementType: entitlement.entitlementType.toUpperCase(),
        featureCode: entitlement.featureCode,
        value: entitlement.value,
        validFrom: entitlement.validFrom ? entitlement.validFrom.substring(0, 16) : "",
        validTo: entitlement.validTo ? entitlement.validTo.substring(0, 16) : "",
        status: entitlement.status.toUpperCase(),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [mode, entitlement, open]);

  const availablePlans = plans.filter((p) => p.productId === form.productId);

  function updateField(key: keyof EntitlementFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.tenantId.trim() || !form.productId || !form.featureCode.trim()) {
      setError("租户 ID、产品和功能编码不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        tenantId: form.tenantId,
        productId: form.productId,
        planId: form.planId || null,
        entitlementType: form.entitlementType,
        featureCode: form.featureCode,
        value: form.value,
      };
      if (form.validFrom) {
        payload.validFrom = new Date(form.validFrom).toISOString();
      }
      if (form.validTo) {
        payload.validTo = new Date(form.validTo).toISOString();
      }

      if (mode === "edit" && entitlement) {
        payload.status = form.status;
        await apiFetch(`/api/admin/entitlements/${entitlement.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/admin/entitlements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增权益" : "编辑权益"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "为指定租户添加一条新的权益配置记录。"
              : `编辑权益 ${entitlement?.featureCode ?? ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-tenant">租户 ID *</Label>
              <Input
                id="ent-tenant"
                placeholder="租户 UUID"
                value={form.tenantId}
                onChange={(e) => updateField("tenantId", e.target.value)}
                disabled={mode === "edit"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-product">产品 *</Label>
              <Select
                value={form.productId}
                onValueChange={(v) => {
                  updateField("productId", v);
                  updateField("planId", "");
                }}
                disabled={mode === "edit"}
              >
                <SelectTrigger id="ent-product">
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-type">权益类型</Label>
              <Select
                value={form.entitlementType}
                onValueChange={(v) => updateField("entitlementType", v)}
              >
                <SelectTrigger id="ent-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEATURE_ACCESS">功能访问</SelectItem>
                  <SelectItem value="SEAT_LIMIT">席位上限</SelectItem>
                  <SelectItem value="QUOTA_LIMIT">额度限制</SelectItem>
                  <SelectItem value="MONTHLY_CREDIT">月度积分</SelectItem>
                  <SelectItem value="ADDON">增值能力</SelectItem>
                  <SelectItem value="SINGER_SLOT">歌手席位</SelectItem>
                  <SelectItem value="NFT_MINT_QUOTA">NFT 铸造额度</SelectItem>
                  <SelectItem value="DISTRIBUTION_TIER">分发等级</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-feature">功能编码 *</Label>
              <Input
                id="ent-feature"
                placeholder="例如 singer.create"
                value={form.featureCode}
                onChange={(e) => updateField("featureCode", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-value">值</Label>
              <Input
                id="ent-value"
                placeholder="true / 100 / ..."
                value={form.value}
                onChange={(e) => updateField("value", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-plan">套餐</Label>
              <Select
                value={form.planId || "__none__"}
                onValueChange={(v) => updateField("planId", v === "__none__" ? "" : v)}
                disabled={!form.productId}
              >
                <SelectTrigger id="ent-plan">
                  <SelectValue placeholder="不关联套餐" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不关联套餐</SelectItem>
                  {availablePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-from">生效时间</Label>
              <Input
                id="ent-from"
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => updateField("validFrom", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-to">结束时间</Label>
              <Input
                id="ent-to"
                type="datetime-local"
                value={form.validTo}
                onChange={(e) => updateField("validTo", e.target.value)}
              />
            </div>
          </div>

          {mode === "edit" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-status">状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField("status", v)}
              >
                <SelectTrigger id="ent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">生效中</SelectItem>
                  <SelectItem value="EXPIRED">已过期</SelectItem>
                  <SelectItem value="REVOKED">已撤销</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : mode === "create" ? "创建" : "保存更改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Revoke Confirm Dialog ─── */

function RevokeConfirmDialog({
  entitlement,
  open,
  onClose,
  onConfirm,
}: {
  entitlement: Entitlement | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    if (!entitlement) return;
    setRevoking(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/entitlements/${entitlement.id}`, { method: "DELETE" });
      onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败");
    } finally {
      setRevoking(false);
    }
  }

  if (!entitlement) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>确认撤销权益</DialogTitle>
          <DialogDescription>
            即将撤销 <span className="font-medium font-mono text-foreground">{entitlement.featureCode}</span> 权益。
            此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={revoking}>
            取消
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRevoke} disabled={revoking}>
            {revoking ? "撤销中..." : "确认撤销"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */

export default function EntitlementsPage() {
  const { isAdmin } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Dialogs / Drawers
  const [selectedEntitlement, setSelectedEntitlement] = useState<Entitlement | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Entitlement | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Entitlement | null>(null);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const planMap = new Map(plans.map((p) => [p.id, p]));

  async function fetchMeta() {
    try {
      const [prodData, planData] = await Promise.all([
        apiFetch<unknown>("/api/admin/products"),
        apiFetch<unknown>("/api/admin/plans?page=0&size=100"),
      ]);
      const prodList = Array.isArray(prodData)
        ? (prodData as Product[])
        : (normalizePageResponse<Product>(prodData).content);
      setProducts(prodList);
      setPlans(normalizePageResponse<Plan>(planData).content);
    } catch {
      // fallback: keep empty lists, IDs will be shown as-is
    }
  }

  async function fetchEntitlements(targetPage = 0) {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>(
        `/api/admin/entitlements?page=${targetPage}&size=20`
      );
      const normalized: PageResponse<Partial<Entitlement>> = normalizePageResponse(data, [
        "entitlements",
        "content",
        "items",
        "records",
      ]);
      setEntitlements(normalized.content.map(normalizeEntitlement));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setEntitlements([]);
      setTotalPages(0);
      setPage(0);
      setError("加载权益配置失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntitlements(0);
    fetchMeta();
  }, []);

  const activeCount = entitlements.filter((item) => item.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">权益配置</h2>
          <p className="text-sm text-muted-foreground">
            管理租户的功能、额度和套餐衍生权益。支持新增、编辑和撤销操作。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增权益
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page)}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新数据
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页权益</CardTitle>
            <CardDescription>本页已加载的权益条目数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(entitlements.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">生效中权益</CardTitle>
            <CardDescription>当前状态仍在生效中的授权数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(activeCount)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分页状态</CardTitle>
            <CardDescription>适合按页巡视权益投放与失效情况</CardDescription>
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
          <AlertTitle>权益数据暂不可用</AlertTitle>
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
                <TableHead>租户 ID</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>权益类型</TableHead>
                <TableHead>功能编码</TableHead>
                <TableHead>值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>生效时间</TableHead>
                <TableHead>结束时间</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的权益数据。点击「新增权益」创建第一条记录。
                  </TableCell>
                </TableRow>
              ) : (
                entitlements.map((item) => (
                  <TableRow
                    key={item.id || `${item.tenantId}-${item.featureCode}`}
                    className="group cursor-pointer"
                    onClick={() => setSelectedEntitlement(item)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                      {item.tenantId || "未关联"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {productMap.has(item.productId)
                        ? productMap.get(item.productId)!.name
                        : <span className="font-mono text-xs text-muted-foreground">{item.productId || "未关联"}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entitlementTypeLabel(item.entitlementType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-950">
                      {item.featureCode}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-slate-950">
                      {item.value}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.validFrom)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.validTo)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="编辑权益"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(item);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {item.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            title="撤销权益"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevokeTarget(item);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="查看详情"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntitlement(item);
                          }}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page - 1)}
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
            onClick={() => fetchEntitlements(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            下一页
          </Button>
        </div>
      )}

      {/* Detail Drawer */}
      <EntitlementDetailDrawer
        entitlement={selectedEntitlement}
        open={!!selectedEntitlement}
        onClose={() => setSelectedEntitlement(null)}
        onEdit={(e) => {
          setSelectedEntitlement(null);
          setEditTarget(e);
        }}
        onRevoke={(e) => {
          setSelectedEntitlement(null);
          setRevokeTarget(e);
        }}
        productMap={productMap}
        planMap={planMap}
      />

      {/* Create Dialog */}
      <EntitlementFormDialog
        mode="create"
        entitlement={null}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => fetchEntitlements(page)}
        products={products}
        plans={plans}
      />

      {/* Edit Dialog */}
      <EntitlementFormDialog
        mode="edit"
        entitlement={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => fetchEntitlements(page)}
        products={products}
        plans={plans}
      />

      {/* Revoke Confirm */}
      <RevokeConfirmDialog
        entitlement={revokeTarget}
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => fetchEntitlements(page)}
      />
    </div>
  );
}
