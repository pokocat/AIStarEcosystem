"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LicenseBatchResult = {
  id: string;
  batchNo: string;
  productId: string;
  planId: string | null;
  licenseType: string;
  totalCount: number;
  creditDelta: number;
  settlementMode: string;
};

export default function LicenseCreatePage() {
  const [productId, setProductId] = useState("ai_singer");
  const [planId, setPlanId] = useState("pro");
  const [licenseType, setLicenseType] = useState("plan_activation");
  const [settlementMode, setSettlementMode] = useState("prepaid");
  const [creditDelta, setCreditDelta] = useState("100");
  const [totalCount, setTotalCount] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LicenseBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const batch = await apiFetch<LicenseBatchResult>("/api/admin/license-batches", {
        method: "POST",
        body: JSON.stringify({
          productId,
          planId,
          licenseType: licenseType.toUpperCase(),
          settlementMode: settlementMode.toUpperCase(),
          creditDelta: Number(creditDelta),
          totalCount: Number(totalCount),
        }),
      });
      setResult(batch);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建批次失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">创建许可证批次</h2>
        <p className="text-sm text-muted-foreground">
          对齐 spec 的卡密批次创建入口，当前直接调用后端批次生成接口。
        </p>
      </div>

      <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>批次配置</CardTitle>
          <CardDescription>提交后后端会生成批次与对应数量的秘钥。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>产品</Label>
              <Input value={productId} onChange={(event) => setProductId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>套餐</Label>
              <Input value={planId} onChange={(event) => setPlanId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>批次类型</Label>
              <Select value={licenseType} onValueChange={setLicenseType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan_activation">套餐激活</SelectItem>
                  <SelectItem value="credit_pack">积分包</SelectItem>
                  <SelectItem value="seat_expansion">席位扩展</SelectItem>
                  <SelectItem value="addon">增值包</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>结算模式</Label>
              <Select value={settlementMode} onValueChange={setSettlementMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepaid">预付费</SelectItem>
                  <SelectItem value="on_activation">激活结算</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>积分增量</Label>
              <Input type="number" value={creditDelta} onChange={(event) => setCreditDelta(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>生成数量</Label>
              <Input type="number" min="1" value={totalCount} onChange={(event) => setTotalCount(event.target.value)} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {submitting ? "创建中..." : "创建批次"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="warning">
          <AlertTitle>创建失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Alert variant="info">
          <AlertTitle>批次创建成功</AlertTitle>
          <AlertDescription>
            批次号 `{result.batchNo}` 已创建，产品 `{result.productId}`，数量 `{result.totalCount}`。
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
