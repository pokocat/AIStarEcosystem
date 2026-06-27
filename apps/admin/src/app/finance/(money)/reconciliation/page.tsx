"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 对账（v2 §9 资金面 lane / §11）
//
// 从不可变账本 + 充值订单重算两平面：
//  - 资金面：现金入账（排除影子）勾稽账本 RECHARGE → drift 告警（不自动消解，守 §8.0）。
//  - 积分面：gift + adjust + license = 未兑付积分负债，单列，永不进现金 / 营收报表。
// 只读视图。限 FINANCE_ADMIN / SUPER_ADMIN（OPERATOR 访问后端返回 403）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReconciliationApi } from "@/api";
import type { ReconciliationReport } from "@/api/reconciliation";

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function AdminReconciliationPage() {
  const [report, setReport] = React.useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setReport(await ReconciliationApi.report());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="对账"
        description="从不可变账本 + 充值订单重算两平面。现金勾稽（排除影子）+ 积分负债单列 + drift 告警；只读，不自动消解差异。"
      />

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? "重算中…" : "重新对账"}
        </Button>
        {report && (
          <span className="text-xs text-muted-foreground">重算时间：{fmtTime(report.generatedAt)}</span>
        )}
      </div>

      {err && <div className="text-sm text-destructive">{err}（对账仅限财务 / 超管）</div>}

      {report && (
        <>
          {/* drift 横幅 */}
          <div
            className={
              report.balanced
                ? "rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "rounded-lg border border-rose-300/60 bg-rose-50/70 px-4 py-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/30 dark:text-rose-200"
            }
          >
            {report.balanced ? (
              <>✅ 账面平：订单侧现金事实 = 账本 RECHARGE（非影子），drift = 0。</>
            ) : (
              <>
                ⚠️ <strong>drift = {fmt(report.drift)} 积分</strong>：订单侧现金事实与账本 RECHARGE 不一致，
                可能为 lost update / 漏写账本。<strong>不自动消解</strong>，请人工排查后再处理。
              </>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 资金面 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  资金面（真实现金）
                  <Badge tone="neutral" className="font-normal">排除影子</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="现金入账（订单 PAID+REFUNDED，非影子）" value={fmt(report.grossRecharge)} />
                <Row label="− 已退款回收" value={fmt(report.refundedReclaimed)} muted />
                <Row label="− 已提现" value={fmt(report.withdrawn)} muted />
                <div className="my-1 border-t border-border" />
                <Row label="= 当前现金背书负债" value={fmt(report.netCashCredits)} strong />
                <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  勾稽：账本 RECHARGE（非影子）= {fmt(report.ledgerRechargeNonShadow)} ·
                  drift = <span className={report.balanced ? "" : "font-semibold text-rose-600"}>{fmt(report.drift)}</span>
                  {report.shadowRecharge > 0 && <> · 影子单 {fmt(report.shadowRecharge)}（已剔除）</>}
                </div>
              </CardContent>
            </Card>

            {/* 积分面 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  积分面（平台负债）
                  <Badge tone="warning" className="font-normal">永不进现金报表</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="赠送积分（GIFT）" value={fmt(report.giftIssued)} />
                <Row label="调差净额（ADJUST）" value={fmt(report.adjustNet)} />
                <Row label="授权发放（LICENSE_GRANT）" value={fmt(report.licenseGranted)} />
                <div className="my-1 border-t border-border" />
                <Row label="= 未兑付积分负债" value={fmt(report.creditLiability)} strong />
                <div className="mt-3 rounded-md bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  积分负债是平台单方负债（无现金背书），单列；被消费时吃真实算力 / AI / OSS 成本 ——
                  「不出现金」≠「免费」。
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-muted-foreground" : strong ? "font-medium" : ""}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
