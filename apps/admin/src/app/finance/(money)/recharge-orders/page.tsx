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
  RECHARGE_PAID_VIA_META,
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
  closed: "neutral",
  refunded: "neutral",
};

// v2 §6 支付来源 tone：jeepay 真实在线=success；shadow 影子(dev/test)=warning；manual 线下=neutral。
const PAID_VIA_TONE: Record<string, StatusTone> = {
  jeepay: "success",
  alipay: "success",
  wechat: "success",
  shadow: "warning",
  manual: "neutral",
};

// v2 §6 业务来源（sourceApp）→ 可读子应用名。
const SOURCE_APP_LABEL: Record<string, string> = {
  celebrity: "明星带货",
  drama: "短剧",
  music: "音乐人",
  aiavatar: "AiAvatar",
  star: "明星工作台",
};
const sourceAppLabel = (s?: string | null): string => (s ? SOURCE_APP_LABEL[s] ?? s : "—");

/** 支付方式 / 渠道列：在线（Jeepay/影子）显示渠道流水号 + 支付方式；线下核准显示来源；未支付显示 —。 */
function PayMethodCell({ o }: { o: RechargeOrder }) {
  if (!o.paidVia) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = RECHARGE_PAID_VIA_META[o.paidVia] ?? { label: o.paidVia, online: true };
  const traceTitle = o.payOrderId
    ? `渠道单号 ${o.channelPayNo ?? "—"} · 网关单号 ${o.payOrderId}`
    : o.channelPayNo
      ? `渠道单号 ${o.channelPayNo}`
      : undefined;
  return (
    <div className="space-y-0.5">
      <Badge tone={PAID_VIA_TONE[o.paidVia] ?? "info"} className="font-normal">
        {meta.label}
      </Badge>
      {o.channelPayNo ? (
        <div className="max-w-[170px] truncate font-mono text-[11px] text-muted-foreground" title={traceTitle}>
          {o.channelPayNo}
        </div>
      ) : null}
      {o.wayCode ? (
        <div className="text-[11px] text-muted-foreground">{o.wayCode}</div>
      ) : null}
    </div>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "待确认" },
  { key: "all", label: "全部" },
  { key: "paid", label: "已到账" },
  { key: "rejected", label: "已驳回" },
  { key: "cancelled", label: "已取消" },
  { key: "refunded", label: "已退款" },
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

  // v2 §6 在线 PENDING 订单只能「查单同步」（查支付网关 → 已支付自动入账 / 超时关单），不能手工核准（防给未付款用户白发积分）。
  async function onSync(o: RechargeOrder) {
    setBusyId(o.id);
    try {
      const u = await RechargeOrdersApi.syncOrder(o.id);
      await refresh();
      toast.success({
        title:
          u.status === "paid" ? "已查到支付，自动入账"
            : u.status === "closed" ? "订单已超时关闭"
              : "网关仍未查到支付，请稍后再查",
      });
    } catch (e) {
      toast.danger({ title: "查单失败", description: e instanceof Error ? e.message : undefined });
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

  async function onRefund(o: RechargeOrder) {
    const res = await confirm({
      title: "退款 + 回收未消费积分",
      tone: "danger",
      confirmLabel: "确认退款",
      requireReason: true,
      description:
        "资金面动作（限财务 / 超管）。将按订单积分回收用户当前未消费的充值额度（写不可变账本 REFUND_CASH），" +
        "已消费部分不回收。真实现金请另在渠道侧原路退回。请填写退款原因，用户可见。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">
            {o.username ?? o.userId} · {o.packageTag ?? "充值套餐"}
          </div>
          <div className="text-xs text-muted-foreground">
            原到账 {o.credits.toLocaleString()} 积分 · 应收 {fmtCny(o.priceCents)} · 编号{" "}
            <span className="font-mono">{o.id}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    setBusyId(o.id);
    try {
      const updated = await RechargeOrdersApi.refund(o.id, res.reason);
      await refresh();
      toast.success({
        title: "已退款",
        description: `回收未消费积分 ${(updated.refundedCredits ?? 0).toLocaleString()} 分`,
      });
    } catch (e) {
      toast.danger({ title: "退款失败", description: e instanceof Error ? e.message : undefined });
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
        <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:items-center">
          <CardTitle className="text-base">
            订单列表（{list.length}）
            {filter === "pending" && pendingCount > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-600">· {pendingCount} 笔待处理</span>
            )}
          </CardTitle>
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
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
                  <TableHead>业务</TableHead>
                  <TableHead>套餐</TableHead>
                  <TableHead className="text-right">积分</TableHead>
                  <TableHead className="text-right">应收</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>支付方式</TableHead>
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
                    <TableCell>
                      <Badge tone="info" className="font-normal">{sourceAppLabel(o.sourceApp)}</Badge>
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
                    <TableCell>
                      <PayMethodCell o={o} />
                    </TableCell>
                    <TableCell className="max-w-[180px] text-xs text-muted-foreground">
                      {o.status === "rejected" && o.reviewNote ? (
                        <span className="text-rose-600">驳回：{o.reviewNote}</span>
                      ) : o.status === "refunded" ? (
                        <span className="text-amber-600">
                          退款回收 {(o.refundedCredits ?? 0).toLocaleString()} 分
                          {o.reviewNote ? ` · ${o.reviewNote}` : ""}
                        </span>
                      ) : (
                        o.userNote || "—"
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {o.status === "pending" ? (
                        o.wayCode || o.payOrderId ? (
                          // 在线支付订单：只能查单同步（查网关 → 已支付自动入账 / 超时关单），禁止手工入账
                          <Button size="sm" onClick={() => void onSync(o)} disabled={busyId === o.id}>
                            查单同步
                          </Button>
                        ) : (
                          // 线下转账订单：运营核准入账 / 驳回
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
                        )
                      ) : o.status === "paid" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onRefund(o)}
                          disabled={busyId === o.id}
                        >
                          退款
                        </Button>
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
