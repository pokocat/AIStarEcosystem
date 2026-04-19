"use client";

import * as React from "react";
import { Coins, Receipt, Plus, Pencil, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listCreditPacks, listRechargeHistory } from "@/api/settings";
import { CREDIT_PACK_STATUS } from "@/constants/status";
import type { CreditPack, RechargeRecord } from "@/types/settings";
import { formatCredits, formatCurrency } from "@/lib/format";
import { formatDateCN } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  credit_pack: "积分包",
  license_redeem: "秘钥兑换",
  promo_gift: "活动赠送",
};

export default function CreditPacksPage() {
  const [packs, setPacks] = React.useState<CreditPack[]>([]);
  const [history, setHistory] = React.useState<RechargeRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ pack: CreditPack; action: "edit" | "promote" | "archive" } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, h] = await Promise.all([listCreditPacks(), listRechargeHistory(0, 200)]);
        if (active) { setPacks(p); setHistory(h); }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalCreditsSold = history.filter((r) => r.source === "credit_pack").reduce((s, r) => s + r.creditsAdded, 0);
  const totalRevenueCents = history.reduce((s, r) => s + r.priceCents, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="积分包"
        description="积分售卖规格（替代订阅模型）。点数永不过期。"
        breadcrumb={[{ label: "基础数据" }, { label: "积分包" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新建积分包
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="在售规格"        value={packs.filter((p) => p.status === "active").length} icon={Coins} />
        <StatCard label="充值记录"        value={history.length}                                  icon={Receipt} />
        <StatCard label="累计售出积分"    value={formatCredits(totalCreditsSold)}                          icon={Coins}     tone="success" />
        <StatCard label="累计实付"        value={formatCurrency(totalRevenueCents)}                        icon={Receipt}   tone="success" />
      </section>

      {loading && <div className="py-6 text-center text-sm text-muted-foreground">加载中…</div>}
      {!loading && loadError && <div className="py-6 text-center text-sm text-rose-600">加载失败：{loadError}</div>}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {!loading && !loadError && packs.length === 0 && (
          <div className="col-span-full py-6 text-center text-sm text-muted-foreground">暂无积分包</div>
        )}
        {packs.map((p) => (
          <Card key={p.id} className={p.recommended ? "ring-2 ring-indigo-500" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{p.name}</CardTitle>
                {p.recommended && <Badge tone="primary">主推</Badge>}
              </div>
              <div className="text-3xl font-semibold tabular-nums">{formatCurrency(p.priceCents)}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                <span className="font-medium">{formatCredits(p.credits)}</span> 积分 · {p.code}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setTarget({ pack: p, action: "edit" })}>
                  <Pencil className="h-3.5 w-3.5" /> 编辑
                </Button>
                <Button
                  size="sm"
                  variant={p.recommended ? "ghost" : "success"}
                  onClick={() => setTarget({ pack: p, action: "promote" })}
                >
                  {p.recommended ? "取消主推" : "设为主推"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>最近充值 / 兑换</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单号</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-right">入账点数</TableHead>
                <TableHead className="text-right">实付</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">#{r.id.toUpperCase()}</TableCell>
                  <TableCell className="text-sm">{formatDateCN(r.date)}</TableCell>
                  <TableCell className="font-medium">{r.desc}</TableCell>
                  <TableCell><StatusBadge meta={{ label: SOURCE_LABEL[r.source] ?? r.source, tone: "neutral" }} /></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCredits(r.creditsAdded)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.priceCents > 0 ? formatCurrency(r.priceCents) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 text-xs text-muted-foreground border-t">
            积分包状态：
            {packs.map((p) => (
              <span key={p.id} className="ml-2 inline-flex items-center gap-1">
                {p.name}
                <StatusBadge meta={CREDIT_PACK_STATUS[p.status]} />
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "edit"
              ? `编辑积分包：${target.pack.name}`
              : target.action === "promote"
              ? `${target.pack.recommended ? "取消主推" : "设为主推"}：${target.pack.name}`
              : `归档积分包：${target.pack.name}`
          }
          description={`${formatCredits(target.pack.credits)} 积分 · ${formatCurrency(target.pack.priceCents)}`}
          tone="primary"
          confirmLabel="保存"
          requireReason
          reasonPlaceholder="变更说明（将写入审计日志）"
        />
      )}
    </div>
  );
}
