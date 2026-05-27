"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 权益扣减配置
//   - 引擎单价（v0.5 §D5；v0.33 起落 PlatformConfig）
//   - 动作单价（v0.35：混剪生成 / 分发上传 / 视频生成 各自单价，可选回退引擎价）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/feedback";
import { CelebrityZoneApi } from "@/api";
import type { ActionPricing } from "@/api/celebrity-zone";

type EnginePricing = Record<string, { creditPrice: number; cost: number }>;
const ENGINES = ["KeLing", "HiGen", "MiniMax"];

const ACTIONS: { code: string; label: string; unit: string; allowEngineFallback: boolean }[] = [
  { code: "mixcut.generate", label: "混剪生成", unit: "积分 / 单变体", allowEngineFallback: false },
  { code: "publish.upload",  label: "分发上传", unit: "积分 / 单任务", allowEngineFallback: false },
  { code: "celebrity.video", label: "数字人视频生成", unit: "积分 / 单条", allowEngineFallback: true },
];

export default function CelebrityPricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="权益扣减配置"
        description="混剪生成 / 分发上传 / 数字人视频生成 各自的积分单价，以及引擎计价表。修改后用户端立即生效。"
      />

      <Tabs defaultValue="action" className="space-y-4">
        <TabsList>
          <TabsTrigger value="action">动作单价（v0.35）</TabsTrigger>
          <TabsTrigger value="engine">引擎单价</TabsTrigger>
        </TabsList>

        <TabsContent value="action">
          <ActionPricingTab />
        </TabsContent>
        <TabsContent value="engine">
          <EnginePricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 动作单价 Tab（v0.35） ────────────────────────────────────────────────────
function ActionPricingTab() {
  const toast = useToast();
  const [pricing, setPricing] = React.useState<Record<string, ActionPricing>>({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      setPricing(await CelebrityZoneApi.getActionPricing());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  function setPrice(code: string, val: number) {
    setPricing({
      ...pricing,
      [code]: { ...pricing[code], creditPrice: val, useEnginePricing: false },
    });
  }
  function setUseEngine(code: string, on: boolean) {
    setPricing({
      ...pricing,
      [code]: { ...pricing[code], useEnginePricing: on, creditPrice: on ? null : (pricing[code]?.creditPrice ?? 0) },
    });
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try {
      await CelebrityZoneApi.replaceActionPricing(pricing);
      toast.success({ title: "已保存", description: "用户端扣点单价已立即生效。" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">动作单价表</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
        {err && <div className="text-sm text-destructive">{err}</div>}
        {!loading && !err && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>动作</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>沿用引擎价</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTIONS.map((a) => {
                const row = pricing[a.code] ?? {};
                const useEngine = !!row.useEnginePricing;
                return (
                  <TableRow key={a.code}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{a.label}</span>
                        <span className="text-xs text-muted-foreground">{a.code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-32"
                        value={useEngine ? "" : (row.creditPrice ?? 0)}
                        onChange={(ev) => setPrice(a.code, Number(ev.target.value) || 0)}
                        disabled={useEngine}
                        placeholder={useEngine ? "—" : "0"}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.unit}</TableCell>
                    <TableCell>
                      {a.allowEngineFallback ? (
                        <div className="flex items-center gap-2">
                          <Switch checked={useEngine} onCheckedChange={(v) => setUseEngine(a.code, v)} />
                          <span className="text-xs text-muted-foreground">{useEngine ? "走引擎计价表" : "用左侧单价"}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          说明：单价缺失或为 0 时，对应动作回退到旧默认值（混剪 30，分发 20）；勾选「沿用引擎价」时调用方按 KeLing/HiGen/MiniMax 计价表算。
        </p>
      </CardContent>
    </Card>
  );
}

// ── 引擎单价 Tab ─────────────────────────────────────────────────────────────
function EnginePricingTab() {
  const toast = useToast();
  const [pricing, setPricing] = React.useState<EnginePricing>({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      setPricing(await CelebrityZoneApi.getEnginePricing());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  function setPrice(eng: string, field: "creditPrice" | "cost", val: number) {
    setPricing({
      ...pricing,
      [eng]: { ...(pricing[eng] ?? { creditPrice: 0, cost: 0 }), [field]: val },
    });
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try {
      await CelebrityZoneApi.replaceEnginePricing(pricing);
      toast.success({ title: "已保存", description: "引擎计价已立即生效。" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.danger({ title: "保存失败", description: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">引擎计价表</CardTitle>
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
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? "保存中…" : "保存整张表"}
          </Button>
          <Button variant="outline" onClick={() => void refresh()}>重新读取</Button>
        </div>
      </CardContent>
    </Card>
  );
}
