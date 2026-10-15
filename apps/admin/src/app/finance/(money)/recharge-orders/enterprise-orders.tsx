"use client";

import * as React from "react";
import { EnterpriseFinancialReport } from "./enterprise-financial-report";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useConfirm, useToast } from "@/components/feedback";
import * as api from "@/api/enterprise-recharges";
import type { EnterpriseRechargeOrder, EnterpriseRechargeConfirmRequest, EnterpriseRefundPreview } from "@/types/enterprise";

const currency = (cents: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(cents / 100);
const time = (value?: string) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
const labels = { pending: "待登记收款", paid: "已到账", rejected: "已驳回", refunded: "已登记退款" } as const;
const tones = { pending: "warning", paid: "success", rejected: "danger", refunded: "neutral" } as const;
const errorText = (e: unknown) => e instanceof Error ? e.message : "操作失败，请重试";

/** Integral conversion keeps manual RMB amounts exact; never assume a credit exchange rate. */
export function parseMoney(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [yuan, fraction = ""] = value.trim().split(".");
  const result = BigInt(yuan) * 100n + BigInt(fraction.padEnd(2, "0"));
  return result > 0n && result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null;
}

export function EnterpriseRechargeOrders() {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = React.useState("pending");
  const [page, setPage] = React.useState(0);
  const [rows, setRows] = React.useState<EnterpriseRechargeOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [hasNext, setHasNext] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [active, setActive] = React.useState<EnterpriseRechargeOrder | null>(null);
  const [mode, setMode] = React.useState<"confirm" | "refund">("confirm");
  const [money, setMoney] = React.useState("");
  const [credits, setCredits] = React.useState("");
  const [receipt, setReceipt] = React.useState("");
  const [note, setNote] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<EnterpriseRefundPreview | null>(null);
  const [review, setReview] = React.useState<EnterpriseRechargeConfirmRequest | null>(null);
  const request = React.useRef({ fingerprint: "", key: "" });
  const loadVersion = React.useRef(0);
  const requestKey = (body: unknown) => {
    const fingerprint = JSON.stringify(body);
    if (request.current.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    return request.current.key;
  };
  const refresh = React.useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError("");
    try {
      const response = await api.list(filter, page);
      if (version !== loadVersion.current) return;
      setRows(response.data); setTotal(response.pagination.total); setHasNext(response.pagination.hasNext);
    } catch (e) { if (version === loadVersion.current) setLoadError(errorText(e)); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [filter, page]);
  React.useEffect(() => { void refresh(); }, [refresh]);

  async function reloadPreview(orderId: string) {
    setPreviewLoading(true); setPreview(null); setFormError("");
    try { setPreview(await api.refundPreview(orderId)); }
    catch (e) { setFormError(errorText(e)); }
    finally { setPreviewLoading(false); }
  }
  function open(order: EnterpriseRechargeOrder, action: "confirm" | "refund") {
    setActive(order); setMode(action); setMoney(""); setCredits(""); setReceipt(""); setNote("");
    setReview(null); setPreview(null); setFormError(""); request.current = { fingerprint: "", key: "" };
    if (action === "refund") void reloadPreview(order.id);
  }
  function prepare(event: React.FormEvent) {
    event.preventDefault(); setFormError("");
    const cents = parseMoney(money);
    const points = /^\d+$/.test(credits.trim()) ? Number(credits.trim()) : 0;
    if (!cents || !Number.isSafeInteger(points) || points <= 0) { setFormError("实收金额须大于零、最多两位小数；积分须为正整数。"); return; }
    if (!receipt.trim()) { setFormError("请填写可核对的收款凭据编号。"); return; }
    const body = { priceCents: cents, credits: points, receiptReference: receipt.trim(), note: note.trim() };
    setReview({ ...body, clientRequestId: requestKey(body) });
  }
  async function submit() {
    if (!active || busy || (mode === "confirm" && !review)) return;
    if (mode === "refund" && (!preview || !receipt.trim() || !note.trim())) { setFormError("请填写退款凭据编号和退款原因。"); return; }
    setBusy(true); setFormError("");
    try {
      if (mode === "confirm" && review) await api.confirm(active.id, review);
      else if (preview) {
        const body = { previewToken: preview.previewToken, reason: note.trim(), receiptReference: receipt.trim() };
        await api.refund(active.id, { ...body, clientRequestId: requestKey(body) });
      }
      setActive(null); await refresh();
      toast.success({ title: mode === "confirm" ? "已入账企业账户" : "已登记退款并回收积分" });
    } catch (e) { setFormError(errorText(e)); }
    finally { setBusy(false); }
  }
  async function reject(order: EnterpriseRechargeOrder) {
    const result = await confirm({ title: "驳回企业充值申请", description: "请填写原因，企业可在充值记录中查看。驳回不会变动任何账户积分。", confirmLabel: "确认驳回", tone: "danger", requireReason: true, affected: <p>{order.enterpriseName} · {order.initiatorName}</p> });
    if (!result.ok) return;
    try { await api.reject(order.id, result.reason); await refresh(); toast.success({ title: "已驳回企业申请" }); }
    catch (e) { toast.danger({ title: "驳回失败", description: errorText(e) }); }
  }

  return <div className="admin-page space-y-6">
    <PageHeader title="企业充值订单" description="核对实际收款后登记金额和积分，资金固定进入申请时的企业待分配账户。" />
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:items-center">
        <CardTitle className="text-base">企业订单（{total}）</CardTitle>
        <div className="flex flex-wrap gap-2">
          {[...["pending", "paid", "refunded"], "all"].map(value => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => { setFilter(value); setPage(0); }}>{value === "all" ? "全部" : labels[value as keyof typeof labels]}</Button>)}
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void refresh()}>刷新</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="animate-pulse space-y-3" role="status" aria-label="正在加载企业订单"><div className="h-8 rounded bg-muted" /><div className="h-8 rounded bg-muted" /></div> : loadError ? <div role="alert" className="text-sm text-destructive">{loadError}<Button className="ml-2" variant="outline" size="sm" onClick={() => void refresh()}>重试</Button></div> : !rows.length ? <p className="py-6 text-sm text-muted-foreground">当前没有企业订单。企业成员提交充值申请后，可在这里登记实际收款。</p> : <Table>
          <TableHeader><TableRow><TableHead>申请时间</TableHead><TableHead>目标企业 / 申请人</TableHead><TableHead className="text-right">实收金额</TableHead><TableHead className="text-right">入账积分</TableHead><TableHead>收款凭据</TableHead><TableHead>状态</TableHead><TableHead>备注 / 退款</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(order => <TableRow key={order.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{time(order.createdAt)}</TableCell>
            <TableCell><div className="font-medium">{order.enterpriseName}</div><div className="text-xs text-muted-foreground">{order.initiatorName} · {order.enterpriseId}</div></TableCell>
            <TableCell className="text-right tabular-nums">{order.status === "pending" ? "待登记" : currency(order.priceCents)}</TableCell>
            <TableCell className="text-right tabular-nums">{order.status === "pending" ? "待登记" : order.credits.toLocaleString()}</TableCell>
            <TableCell className="max-w-[200px] break-words text-xs">{order.receiptReference || "—"}</TableCell>
            <TableCell><Badge tone={tones[order.status]}>{labels[order.status]}</Badge></TableCell>
            <TableCell className="max-w-[220px] break-words text-xs text-muted-foreground">{order.status === "refunded" ? <>{currency(order.refundedPriceCents)} · 回收 {order.refundedCredits.toLocaleString()} 积分<br />退款凭据 {order.refundReceiptReference}</> : order.note || "—"}</TableCell>
            <TableCell className="whitespace-nowrap text-right">{order.status === "pending" ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => open(order, "confirm")}>登记收款</Button><Button size="sm" variant="outline" onClick={() => void reject(order)}>驳回</Button></div> : order.status === "paid" ? <Button size="sm" variant="outline" onClick={() => open(order, "refund")}>核对退款</Button> : "—"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
        <div className="flex items-center justify-end gap-3 text-sm"><span className="text-muted-foreground">第 {page + 1} 页 · 共 {total} 笔</span><Button size="sm" variant="outline" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={loading || !hasNext} onClick={() => setPage(p => p + 1)}>下一页</Button></div>
      </CardContent>
    </Card>
    <EnterpriseFinancialReport />
    <Dialog open={!!active} onOpenChange={value => { if (!value && !busy) setActive(null); }}>
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{mode === "refund" ? "核对企业退款" : review ? "确认企业入账" : "登记企业实际收款"}</DialogTitle><DialogDescription>{mode === "refund" ? "先核对本单可退金额，在原收款渠道完成现金退款后登记凭据。提交将回收可退积分并记录退款，不会自动打款。" : "仅在实际收到款项后登记；金额与积分分别填写，提交后固定保存。"}</DialogDescription></DialogHeader>
        {active && <div className="rounded-md bg-muted p-3 text-sm"><strong>{active.enterpriseName}</strong><p className="break-all text-xs text-muted-foreground">企业 {active.enterpriseId} · 申请人 {active.initiatorName}</p><p className="break-all text-xs text-muted-foreground">目标企业待分配账户 {active.targetWalletId}</p>{active.note && <p className="mt-1 break-words">订单备注：{active.note}</p>}</div>}
        {mode === "confirm" ? review ? <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm"><dt>实收金额</dt><dd className="text-right font-semibold tabular-nums">{currency(review.priceCents)}</dd><dt>入账积分</dt><dd className="text-right font-semibold tabular-nums">{review.credits.toLocaleString()}</dd><dt>收款凭据</dt><dd className="break-all text-right">{review.receiptReference}</dd></dl>
          {review.note && <p className="break-words text-sm">备注：{review.note}</p>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReview(null)}>返回修改</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? "正在入账…" : "确认收款并入账"}</Button></DialogFooter>
        </div> : <form onSubmit={prepare} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-recharge-money">实收金额（元）</label><Input id="enterprise-recharge-money" inputMode="decimal" maxLength={18} required value={money} onChange={event => setMoney(event.target.value)} placeholder="填写实际到账金额" /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-recharge-credits">入账积分</label><Input id="enterprise-recharge-credits" inputMode="numeric" maxLength={16} required value={credits} onChange={event => setCredits(event.target.value)} placeholder="填写本次发放积分" /></div></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-recharge-receipt">收款凭据编号</label><Input id="enterprise-recharge-receipt" maxLength={256} required value={receipt} onChange={event => setReceipt(event.target.value)} placeholder="银行或支付渠道的唯一流水号" /></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-recharge-note">财务备注（选填）</label><Textarea id="enterprise-recharge-note" maxLength={512} value={note} onChange={event => setNote(event.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setActive(null)}>取消</Button><Button type="submit">核对入账信息</Button></DialogFooter>
        </form> : <div className="space-y-4">
          {previewLoading ? <p role="status" className="text-sm text-muted-foreground">正在核对可退积分…</p> : preview ? <dl className="grid grid-cols-2 gap-2 text-sm"><dt>原收款 / 原积分</dt><dd className="text-right tabular-nums">{currency(preview.originalPriceCents)} / {preview.originalCredits.toLocaleString()}</dd><dt>本次可回收积分</dt><dd className="text-right font-semibold tabular-nums">{preview.reclaimableCredits.toLocaleString()}</dd><dt>其中从成员账户归集</dt><dd className="text-right tabular-nums">{preview.memberRecallCredits.toLocaleString()}</dd><dt>冻结 / 已消费积分</dt><dd className="text-right tabular-nums">{preview.pendingCredits.toLocaleString()} / {preview.spentCredits.toLocaleString()}</dd><dt>本次应退现金</dt><dd className="text-right font-semibold tabular-nums">{currency(preview.refundPriceCents)}</dd></dl> : null}
          {!!preview?.pendingCredits && <p role="status" className="text-sm text-muted-foreground">原订单仍有冻结积分，请等待在途任务结算后重新核对退款。</p>}
          <Button size="sm" variant="outline" disabled={previewLoading || busy} onClick={() => active && void reloadPreview(active.id)}>重新核对可退金额</Button>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-refund-receipt">现金退款凭据编号</label><Input id="enterprise-refund-receipt" maxLength={256} required value={receipt} onChange={event => setReceipt(event.target.value)} placeholder="已在收款渠道完成退款的流水号" /></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="enterprise-refund-reason">退款原因</label><Textarea id="enterprise-refund-reason" maxLength={512} required value={note} onChange={event => setNote(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setActive(null)}>取消</Button><Button variant="destructive" disabled={busy || previewLoading || !preview?.reclaimableCredits || !!preview?.pendingCredits || !receipt.trim() || !note.trim()} onClick={() => void submit()}>{busy ? "正在登记…" : "确认现金已退并回收积分"}</Button></DialogFooter>
        </div>}
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      </DialogContent>
    </Dialog>
  </div>;
}
