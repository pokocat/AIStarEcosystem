"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 充值订单核销（v0.56）
//
// 用户在前端下单生成 PENDING 充值账单（不入账）。运营在此「线下收款 → 核准入账」或「驳回」。
// 核准走不可变账本（CreditService），驳回需填原因。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm, useToast } from "@/components/feedback";
import { RechargeOrdersApi } from "@/api";
import {
  RECHARGE_ORDER_STATUS_LABEL,
  type RechargeOrder,
  type RechargeOrderStatus,
} from "@/types/recharge-order";
import type { StatusTone } from "@/constants/status";

type Filter = RechargeOrderStatus | "all";

const STATUS_TONE: Record<RechargeOrderStatus, StatusTone> = {
  pending: "warning",
  paid: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "待确认" },
  { key: "all", label: "全部" },
  { key: "paid", label: "已到账" },
  { key: "rejected", label: "已驳回" },
  { key: "cancelled", label: "已取消" },
];

function fmtCny(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminRechargeOrdersPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [filter, setFilter] = React.useState<Filter>("pending");
  const [list, setList] = React.useState<RechargeOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await RechargeOrdersApi.list(filter));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onApprove(o: RechargeOrder) {
    const res = await confirm({
      title: "确认已收款并入账",
      tone: "success",
      confirmLabel: "确认入账",
      requireReason: false,
      description:
        "确认平台已实际收到该订单对应款项。确认后将立即向用户账户入账（经不可变账本），此操作不可撤销。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">
            {o.username ?? o.userId} · {o.packageTag ?? "充值套餐"}
          </div>
          <div className="text-xs text-muted-foreground">
            到账 {o.credits.toLocaleString()}
            {o.bonusCredits ? ` + 赠 ${o.bonusCredits.toLocaleString()}` : ""} 积分 · 应收 {fmtCny(o.priceCents)} · 编号{" "}
            <span className="font-mono">{o.id}</span>
            {o.userNote ? ` · 用户备注：${o.userNote}` : ""}
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    setBusyId(o.id);
    try {
      await RechargeOrdersApi.approve(o.id, res.reason || undefined);
      await refresh();
      toast.success({ title: "已入账", description: `${o.credits.toLocaleString()} 积分已发放给用户` });
    } catch (e) {
      toast.danger({ title: "入账失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(o: RechargeOrder) {
    const res = await confirm({
      title: "驳回充值订单",
      tone: "danger",
      confirmLabel: "确认驳回",
      requireReason: true,
      description: "用于收款不符 / 重复下单 / 无效订单等。驳回后用户可重新下单；请填写原因，用户可见。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">
            {o.username ?? o.userId} · {o.packageTag ?? "充值套餐"}
          </div>
          <div className="text-xs text-muted-foreground">
            应收 {fmtCny(o.priceCents)} · 编号 <span className="font-mono">{o.id}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    setBusyId(o.id);
    try {
      await RechargeOrdersApi.reject(o.id, res.reason);
      await refresh();
      toast.success({ title: "已驳回" });
    } catch (e) {
      toast.danger({ title: "驳回失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = list.filter((o) => o.status === "pending").length;

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="充值订单核销"
        description="用户下单后生成待确认账单；平台线下收款后在此核准入账（经不可变账本）或驳回。"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            订单列表（{list.length}）
            {filter === "pending" && pendingCount > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-600">· {pendingCount} 笔待处理</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && list.length === 0 && (
            <div className="text-sm text-muted-foreground">当前筛选下没有订单。</div>
          )}
          {!loading && !err && list.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>下单时间</TableHead>
                  <TableHead>用户 / 工作室</TableHead>
                  <TableHead>套餐</TableHead>
                  <TableHead className="text-right">积分</TableHead>
                  <TableHead className="text-right">应收</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtTime(o.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{o.displayName || o.username || o.userId}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.studioName ?? o.username ?? o.userId}
                      </div>
                    </TableCell>
                    <TableCell>{o.packageTag ?? "充值套餐"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.credits.toLocaleString()}
                      {o.bonusCredits ? (
                        <span className="text-xs text-emerald-600"> +{o.bonusCredits.toLocaleString()}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCny(o.priceCents)}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[o.status]} className="font-normal">
                        {RECHARGE_ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] text-xs text-muted-foreground">
                      {o.status === "rejected" && o.reviewNote ? (
                        <span className="text-rose-600">驳回：{o.reviewNote}</span>
                      ) : (
                        o.userNote || "—"
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {o.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void onApprove(o)}
                            disabled={busyId === o.id}
                          >
                            入账
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onReject(o)}
                            disabled={busyId === o.id}
                          >
                            驳回
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {o.reviewedAt ? fmtTime(o.reviewedAt) : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
