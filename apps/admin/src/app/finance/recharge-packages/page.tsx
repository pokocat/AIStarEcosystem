"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 财务 · 充值套餐管理（v0.5 §D4）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { RechargePackagesApi } from "@/api";
import type { RechargePackage } from "@/types/wallet";

export default function AdminRechargePackagesPage() {
  const toast = useToast();
  const confirm = useConfirm();

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
    if (draft.credits <= 0 || draft.priceCents <= 0) {
      toast.warning({ title: "积分数与售价必须为正" });
      return;
    }
    try {
      await RechargePackagesApi.create({
        ...draft,
        id: draft.id.trim() || undefined,
      });
      setDraft({ ...draft, id: "" });
      await refresh();
      toast.success({ title: "套餐已创建" });
    } catch (e) {
      toast.danger({ title: "创建失败", description: e instanceof Error ? e.message : undefined });
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
      toast.success({
        title: (p.active ?? true) ? "套餐已下架" : "套餐已上架",
      });
    } catch (e) {
      toast.danger({ title: "更新失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onDelete(p: RechargePackage) {
    const res = await confirm({
      title: "下架并软删除套餐",
      tone: "danger",
      confirmLabel: "确认下架",
      description:
        "下架后小程序充值页立即不可见。已有的 ledger 引用保留，不会被影响。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.tag}</div>
          <div className="text-xs text-muted-foreground">
            积分 {p.credits.toLocaleString()} · 售价 ¥{(p.priceCents / 100).toFixed(2)} · 编号{" "}
            <span className="font-mono">{p.id}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await RechargePackagesApi.softDelete(p.id);
      await refresh();
      toast.success({ title: "套餐已下架" });
    } catch (e) {
      toast.danger({ title: "删除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="充值套餐"
        description="管理小程序充值页可见的积分套餐。删除走软删（下架），保留 ledger 引用。"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增套餐</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FieldInput
            label="编号"
            hint="留空则自动生成"
            value={draft.id}
            onChange={(v) => setDraft({ ...draft, id: v })}
          />
          <FieldInput
            label="积分数"
            type="number"
            value={String(draft.credits)}
            onChange={(v) => setDraft({ ...draft, credits: Number(v) || 0 })}
          />
          <FieldInput
            label="售价（分）"
            hint={`显示价格：¥${(draft.priceCents / 100).toFixed(2)}`}
            type="number"
            value={String(draft.priceCents)}
            onChange={(v) => setDraft({ ...draft, priceCents: Number(v) || 0 })}
          />
          <FieldInput
            label="套餐名"
            value={draft.tag}
            onChange={(v) => setDraft({ ...draft, tag: v })}
          />
          <FieldInput
            label="赠送积分"
            type="number"
            value={String(draft.bonusCredits)}
            onChange={(v) => setDraft({ ...draft, bonusCredits: Number(v) || 0 })}
          />
          <FieldInput
            label="排序权重"
            hint="数字越小越靠前"
            type="number"
            value={String(draft.sortOrder)}
            onChange={(v) => setDraft({ ...draft, sortOrder: Number(v) || 0 })}
          />
          <div>
            <div className="mb-1 text-sm font-medium">推荐标记</div>
            <div className="flex h-9 items-center">
              <Switch
                checked={draft.recommended}
                onCheckedChange={(v) => setDraft({ ...draft, recommended: v })}
              />
              <span className="ml-2 text-sm text-muted-foreground">
                {draft.recommended ? "推荐位" : "普通"}
              </span>
            </div>
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button className="w-full" onClick={() => void onCreate()}>
              提交
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">套餐列表（{list.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>套餐名</TableHead>
                  <TableHead className="text-right">积分</TableHead>
                  <TableHead className="text-right">售价</TableHead>
                  <TableHead className="text-right">赠送</TableHead>
                  <TableHead>推荐</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">排序</TableHead>
                  <TableHead className="w-[200px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-mono">{p.id}</TableCell>
                    <TableCell className="font-medium">{p.tag}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.credits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ¥{(p.priceCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.bonusCredits ?? 0}</TableCell>
                    <TableCell>
                      {p.recommended ? (
                        <Badge tone="warning" className="font-normal">
                          <Star className="h-3 w-3" /> 推荐
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.active === false ? (
                        <Badge tone="neutral" className="font-normal">
                          已下架
                        </Badge>
                      ) : (
                        <Badge tone="success" className="font-normal">
                          在售
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.sortOrder ?? 0}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => void onToggleActive(p)}>
                        {p.active === false ? "上架" : "下架"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(p)}>
                        软删
                      </Button>
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

function FieldInput({
  label,
  hint,
  value,
  onChange,
  type,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
