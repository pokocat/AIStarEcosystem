"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 引擎价格（v0.5 §D5 新增；本期 in-memory，重启失效）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CelebrityZoneApi } from "@/api";

type Pricing = Record<string, { creditPrice: number; cost: number }>;
const ENGINES = ["KeLing", "HiGen", "MiniMax"];

export default function EnginePricingPage() {
  const [pricing, setPricing] = React.useState<Pricing>({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setPricing(await CelebrityZoneApi.getEnginePricing());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  function setPrice(eng: string, field: "creditPrice" | "cost", val: number) {
    setPricing({
      ...pricing,
      [eng]: { ...(pricing[eng] ?? { creditPrice: 0, cost: 0 }), [field]: val },
    });
  }
  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      await CelebrityZoneApi.replaceEnginePricing(pricing);
      alert("已保存。注意：本期为 in-memory，重启失效；正式 v0.6 将落 PlatformConfig 持久化。");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="引擎价格" description="KeLing / HiGen / MiniMax 三档引擎的积分单价 + 套餐扣减系数。修改后用户端 /celebrity/engine-pricing 立即生效。" />

      <Card>
        <CardHeader><CardTitle>计价表</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>引擎</TableHead>
                  <TableHead>creditPrice（积分/条）</TableHead>
                  <TableHead>cost（套餐扣减条数）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ENGINES.map((e) => (
                  <TableRow key={e}>
                    <TableCell className="font-medium">{e}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-32"
                        value={pricing[e]?.creditPrice ?? 0}
                        onChange={(ev) => setPrice(e, "creditPrice", Number(ev.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-32"
                        value={pricing[e]?.cost ?? 0}
                        onChange={(ev) => setPrice(e, "cost", Number(ev.target.value) || 0)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void onSave()} disabled={saving}>{saving ? "保存中…" : "保存整张表"}</Button>
            <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
