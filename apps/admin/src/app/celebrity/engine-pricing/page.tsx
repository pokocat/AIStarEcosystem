"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 引擎价格（v0.5 §D5；本期 in-memory，重启失效）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/components/feedback";
import { CelebrityZoneApi } from "@/api";

type Pricing = Record<string, { creditPrice: number; cost: number }>;
const ENGINES = ["KeLing", "HiGen", "MiniMax"];

export default function EnginePricingPage() {
  const toast = useToast();
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
      toast.success({
        title: "已保存",
        description: "用户端 /celebrity/engine-pricing 已生效。",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="引擎价格"
        description="可灵 / HiGen / MiniMax 三档生成引擎的积分单价与套餐扣减系数。修改后用户端立即生效。"
      />

      <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <div className="font-medium">本期仅内存保存</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            保存后立即生效，但服务端重启会丢失。v0.6 将落 PlatformConfig 表持久化。
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">计价表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>引擎</TableHead>
                  <TableHead>积分单价（积分 / 条）</TableHead>
                  <TableHead>套餐扣减（条 / 次调用）</TableHead>
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
                        onChange={(ev) =>
                          setPrice(e, "creditPrice", Number(ev.target.value) || 0)
                        }
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
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? "保存中…" : "保存整张表"}
            </Button>
            <Button variant="outline" onClick={() => void refresh()}>
              重新读取
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
