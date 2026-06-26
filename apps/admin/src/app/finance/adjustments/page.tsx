"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 调差 / 赠送（v2 §9 积分面 lane）+ maker-checker（§9.2）
//
// 运营给用户补发（客诉补偿）/ 赠送（激励）积分。只发赠送积分（giftBalance），
// 结构上不碰资金面（不影响真实资金）。强制填原因；补偿强制填工单号。
// 小额（≤ 阈值）直发；大额（> 阈值）落审批单，需 FINANCE_ADMIN / SUPER_ADMIN 复核（maker≠checker）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/feedback";
import { AdjustmentsApi } from "@/api";
import type { CreditAdjustmentRequest, AdjustmentResult } from "@/api/adjustments";

type Toast = ReturnType<typeof useToast>;

export default function AdminAdjustmentsPage() {
  const toast = useToast();
  const [pending, setPending] = React.useState<CreditAdjustmentRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reloadPending = React.useCallback(async () => {
    setLoading(true);
    try {
      setPending(await AdjustmentsApi.listRequests("pending_approval"));
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reloadPending();
  }, [reloadPending]);

  return (
    <div className="space-y-6">
      <PageHeader title="调差 / 赠送" description="给用户补发 / 赠送积分（积分面，不碰真实资金）· 大额走审批" />

      <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
        ⚖️ 本操作只发<strong>赠送积分（giftBalance）</strong>，<strong>不影响真实资金</strong>（不碰充值 / 现金桶）。
        强制填原因，补偿强制填工单号；操作人 + 原因写入不可变账本可溯源。
        大额（超阈值）需财务复核（复核人 ≠ 发起人）。
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CompensateCard toast={toast} onSubmitted={reloadPending} />
        <GrantCard toast={toast} onSubmitted={reloadPending} />
      </div>

      <PendingApprovals toast={toast} list={pending} loading={loading} reload={reloadPending} />
    </div>
  );
}

function CompensateCard({ toast, onSubmitted }: { toast: Toast; onSubmitted: () => void }) {
  const [userId, setUserId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [ticket, setTicket] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const n = Number(amount);
    if (!userId.trim() || !Number.isFinite(n) || n <= 0 || !ticket.trim() || !reason.trim()) {
      toast.warning({ title: "请填完整", description: "用户、正整数积分、工单号、原因均必填" });
      return;
    }
    setBusy(true);
    try {
      const res = await AdjustmentsApi.compensate({
        userId: userId.trim(),
        amount: n,
        incidentRef: ticket.trim(),
        reason: reason.trim(),
      });
      announce(toast, res, "补偿");
      setAmount("");
      setTicket("");
      setReason("");
      onSubmitted();
    } catch (e) {
      toast.danger({ title: "补偿失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>客诉补偿</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="用户 ID">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="用户 userId" />
        </Field>
        <Field label="积分数">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="如 500" />
        </Field>
        <Field label="工单号 / 事故单号">
          <Input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="如 TICKET-42" />
        </Field>
        <Field label="原因">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如 生成失败补偿" />
        </Field>
        <Button onClick={submit} disabled={busy}>
          {busy ? "提交中…" : "发放补偿"}
        </Button>
      </CardContent>
    </Card>
  );
}

function GrantCard({ toast, onSubmitted }: { toast: Toast; onSubmitted: () => void }) {
  const [userId, setUserId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [campaign, setCampaign] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const n = Number(amount);
    if (!userId.trim() || !Number.isFinite(n) || n <= 0 || !reason.trim()) {
      toast.warning({ title: "请填完整", description: "用户、正整数积分、原因均必填" });
      return;
    }
    setBusy(true);
    try {
      const res = await AdjustmentsApi.grant({
        userId: userId.trim(),
        amount: n,
        campaignId: campaign.trim() || undefined,
        reason: reason.trim(),
      });
      announce(toast, res, "赠送");
      setAmount("");
      setCampaign("");
      setReason("");
      onSubmitted();
    } catch (e) {
      toast.danger({ title: "赠送失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>激励赠送</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="用户 ID">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="用户 userId" />
        </Field>
        <Field label="积分数">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="如 100" />
        </Field>
        <Field label="活动号（可选）">
          <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="如 SPRING2026" />
        </Field>
        <Field label="原因">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如 拉新激励" />
        </Field>
        <Button onClick={submit} disabled={busy}>
          {busy ? "提交中…" : "发放赠送"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PendingApprovals({
  toast,
  list,
  loading,
  reload,
}: {
  toast: Toast;
  list: CreditAdjustmentRequest[];
  loading: boolean;
  reload: () => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      if (action === "approve") {
        await AdjustmentsApi.approveRequest(id);
        toast.success({ title: "已批准并入账" });
      } else {
        await AdjustmentsApi.rejectRequest(id);
        toast.success({ title: "已驳回" });
      }
      reload();
    } catch (e) {
      toast.danger({ title: action === "approve" ? "批准失败" : "驳回失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>待审批（大额调差 / 赠送）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">复核仅限财务 / 超管，且复核人不能是发起人。批准后才真正入账。</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中…</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-muted-foreground">没有待审批的单。</div>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {r.type === "compensate" ? "客诉补偿" : "激励赠送"} · +{r.amount.toLocaleString()} 积分
                    {r.incidentRef ? ` · 工单 ${r.incidentRef}` : ""}
                    {r.campaignId ? ` · 活动 ${r.campaignId}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    用户 {r.targetUserId} · 发起 {r.makerId} · {r.reason ?? ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(r.id, "approve")} disabled={busyId === r.id}>
                    批准入账
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide(r.id, "reject")} disabled={busyId === r.id}>
                    驳回
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function announce(toast: Toast, res: AdjustmentResult, label: string) {
  if (res.pending) {
    toast.success({
      title: "已提交审批",
      description: `${res.amount.toLocaleString()} 积分超阈值，待财务复核（单 ${res.requestId ?? ""}）`,
    });
  } else {
    toast.success({
      title: `${label}已发放`,
      description: `+${(res.entry?.amount ?? res.amount).toLocaleString()} 积分（gift）· 账本 ${res.entry?.id ?? ""}`,
    });
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
