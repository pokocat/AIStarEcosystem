"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 调差 / 赠送（v2 §9 积分面 lane）
//
// 运营给用户补发（客诉补偿）/ 赠送（激励）积分。只发赠送积分（giftBalance），
// 结构上不碰资金面（不影响真实资金）。强制填原因；补偿强制填工单号。
// 操作人 + 原因写入不可变账本，结算中心可溯源。
// 后续：maker-checker 双签 + 批量 campaign + 角色拆分（PLATFORM_OPERATOR / FINANCE_ADMIN）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/feedback";
import { AdjustmentsApi } from "@/api";

export default function AdminAdjustmentsPage() {
  const toast = useToast();

  return (
    <div className="space-y-6">
      <PageHeader title="调差 / 赠送" description="给用户补发 / 赠送积分（积分面，不碰真实资金）" />

      <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
        ⚖️ 本操作只发<strong>赠送积分（giftBalance）</strong>，<strong>不影响真实资金</strong>（不碰充值 / 现金桶）。
        强制填原因，补偿强制填工单号；操作人 + 原因写入不可变账本，结算中心可溯源。
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CompensateCard toast={toast} />
        <GrantCard toast={toast} />
      </div>
    </div>
  );
}

type Toast = ReturnType<typeof useToast>;

function CompensateCard({ toast }: { toast: Toast }) {
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
      const entry = await AdjustmentsApi.compensate({
        userId: userId.trim(),
        amount: n,
        incidentRef: ticket.trim(),
        reason: reason.trim(),
      });
      toast.success({ title: "补偿已发放", description: `+${entry.amount.toLocaleString()} 积分（gift）· 账本 ${entry.id}` });
      setAmount("");
      setTicket("");
      setReason("");
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
          {busy ? "发放中…" : "发放补偿"}
        </Button>
      </CardContent>
    </Card>
  );
}

function GrantCard({ toast }: { toast: Toast }) {
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
      const entry = await AdjustmentsApi.grant({
        userId: userId.trim(),
        amount: n,
        campaignId: campaign.trim() || undefined,
        reason: reason.trim(),
      });
      toast.success({ title: "赠送已发放", description: `+${entry.amount.toLocaleString()} 积分（gift）· 账本 ${entry.id}` });
      setAmount("");
      setCampaign("");
      setReason("");
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
          {busy ? "发放中…" : "发放赠送"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
