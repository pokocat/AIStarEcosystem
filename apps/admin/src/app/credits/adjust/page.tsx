"use client";

import { FormEvent, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreditEntry = {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

export default function CreditsAdjustPage() {
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("100");
  const [description, setDescription] = useState("运营补点");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreditEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const entry = await apiFetch<CreditEntry>(`/api/admin/wallets/${tenantId}/credit`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          description,
          referenceType: "manual_adjustment",
        }),
      });
      setResult(entry);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "补点失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">手动补点</h2>
        <p className="text-sm text-muted-foreground">
          对应后台财务应急处理场景，写入 `LedgerEntry`，不直接修改余额字段。
        </p>
      </div>

      <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>补点表单</CardTitle>
          <CardDescription>当前会调用现有 `/api/admin/wallets/{'{tenantId}'}/credit` 接口。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tenantId">目标租户 ID</Label>
              <Input
                id="tenantId"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                placeholder="tenant-uuid"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">补点金额</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">原因说明</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="例如：客服补偿、活动发放"
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                {submitting ? "提交中..." : "确认补点"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="warning">
          <AlertTitle>补点失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Alert variant="info">
          <AlertTitle>补点成功</AlertTitle>
          <AlertDescription>
            已为租户 `{result.tenantId}` 写入流水，金额 `{result.amount}`，补后余额 `{result.balanceAfter}`。
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
