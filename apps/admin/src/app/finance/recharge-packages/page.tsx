"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 充值套餐管理（v0.5 §D4 新增）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RechargePackagesApi } from "@/api";
import type { RechargePackage } from "@/types/wallet";

export default function AdminRechargePackagesPage() {
  const [list, setList] = React.useState<RechargePackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({
    id: "",
    credits: 1000,
    priceCents: 29900,
    tag: "标准包",
    recommended: false,
    bonusCredits: 100,
    sortOrder: 20,
    active: true,
  });

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await RechargePackagesApi.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    try {
      await RechargePackagesApi.create({
        ...draft,
        id: draft.id.trim() || undefined,
      });
      setDraft({ ...draft, id: "" });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  }
  async function onToggleActive(p: RechargePackage) {
    try {
      await RechargePackagesApi.update(p.id, {
        credits: p.credits,
        priceCents: p.priceCents,
        tag: p.tag,
        recommended: p.recommended,
        bonusCredits: p.bonusCredits,
        sortOrder: p.sortOrder,
        active: !(p.active ?? true),
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新失败");
    }
  }
  async function onDelete(id: string) {
    if (!confirm("软删（active=false）？")) return;
    try {
      await RechargePackagesApi.softDelete(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="充值套餐" description="管理小程序充值页可见的积分套餐。删除走软删（active=false），保留 ledger 引用。" />

      <Card>
        <CardHeader><CardTitle>新增套餐</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FieldInput label="id（可空，自动生成）" value={draft.id} onChange={(v) => setDraft({ ...draft, id: v })} />
          <FieldInput label="credits（积分）" type="number" value={String(draft.credits)} onChange={(v) => setDraft({ ...draft, credits: Number(v) || 0 })} />
          <FieldInput label="priceCents（分）" type="number" value={String(draft.priceCents)} onChange={(v) => setDraft({ ...draft, priceCents: Number(v) || 0 })} />
          <FieldInput label="tag" value={draft.tag} onChange={(v) => setDraft({ ...draft, tag: v })} />
          <FieldInput label="bonusCredits" type="number" value={String(draft.bonusCredits)} onChange={(v) => setDraft({ ...draft, bonusCredits: Number(v) || 0 })} />
          <FieldInput label="sortOrder" type="number" value={String(draft.sortOrder)} onChange={(v) => setDraft({ ...draft, sortOrder: Number(v) || 0 })} />
          <label className="mt-6 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.recommended} onChange={(e) => setDraft({ ...draft, recommended: e.target.checked })} />
            recommended（推荐）
          </label>
          <Button className="mt-4" onClick={() => void onCreate()}>提交</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>套餐列表（{list.length}）</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>tag</TableHead>
                  <TableHead>credits</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>bonus</TableHead>
                  <TableHead>推荐</TableHead>
                  <TableHead>active</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="w-[200px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-mono">{p.id}</TableCell>
                    <TableCell>{p.tag}</TableCell>
                    <TableCell>{p.credits}</TableCell>
                    <TableCell>¥{(p.priceCents / 100).toFixed(2)}</TableCell>
                    <TableCell>{p.bonusCredits ?? 0}</TableCell>
                    <TableCell>{p.recommended ? "★" : "—"}</TableCell>
                    <TableCell>{p.active === false ? "✗" : "✓"}</TableCell>
                    <TableCell>{p.sortOrder ?? 0}</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="outline" onClick={() => void onToggleActive(p)}>切启停</Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(p.id)}>软删</Button>
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

function FieldInput({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: "text" | "number" }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
