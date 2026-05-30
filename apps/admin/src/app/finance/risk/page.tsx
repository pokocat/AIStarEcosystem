"use client";

import * as React from "react";
import { AlertTriangle, Flame, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listTransactions } from "@/api/finance";
import { listActivities } from "@/api/community";
import type { Transaction } from "@/types/finance";
import type { FanActivity } from "@/types/community";
import { formatDateCN } from "@/lib/utils";
import { formatSignedCredits } from "@/lib/format";

/**
 * 基于 credits 阈值合成风控样本（纯展示）：
 *  - 单笔绝对值 ≥ 20,000 credits → 大额流水
 *  - 出账类（withdrawal/spend）状态不是 completed → 异常出账
 *  - 打赏类汇总 ≥ 5,000 credits → 打赏突增
 *  - 粉丝端 ¥ 打赏 ≥ 300 → 粉丝异常打赏
 */
function buildRiskCases(transactions: Transaction[], activities: FanActivity[]) {
  const txnCases = transactions.flatMap((t) => {
    const abs = Math.abs(t.amount);
    const risks: { kind: string; level: "high" | "mid" | "low"; detail: string }[] = [];
    if (abs >= 20_000) risks.push({ kind: "大额流水", level: "mid", detail: `单笔 ${formatSignedCredits(t.amount)} 积分` });
    if ((t.type === "withdrawal" || t.type === "spend") && t.status !== "completed")
      risks.push({ kind: "异常出账", level: "high", detail: `状态 ${t.status}` });
    if (t.source.includes("打赏") && abs >= 5_000)
      risks.push({ kind: "打赏突增", level: "low", detail: "汇总金额偏高，建议抽样核查" });
    return risks.map((r, idx) => ({
      id: `${t.id}-${idx}`,
      refId: t.id,
      date: t.date,
      source: t.source,
      amount: formatSignedCredits(t.amount),
      ...r,
    }));
  });

  const fanCases = activities
    .filter((a) => a.type === "gift" && /¥(\d+)/.test(a.action))
    .map((a, i) => {
      const m = /¥(\d+)/.exec(a.action);
      const v = m ? Number(m[1]) : 0;
      if (v < 300) return null;
      return {
        id: `gift-${i}`,
        refId: a.id,
        date: "当前",
        source: `${a.user} → 打赏`,
        amount: `+¥${v}`,
        kind: "粉丝打赏",
        level: v >= 500 ? "mid" : "low",
        detail: `用户 ${a.user} · ${a.time} 内`,
      } as const;
    })
    .filter(Boolean);

  return [...txnCases, ...(fanCases as NonNullable<(typeof fanCases)[number]>[])];
}

export default function RiskPage() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [activities, setActivities] = React.useState<FanActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [tx, act] = await Promise.all([listTransactions(0, 200), listActivities()]);
        if (active) { setTransactions(tx); setActivities(act); }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const cases = buildRiskCases(transactions, activities);
  const highCount = cases.filter((c) => c.level === "high").length;
  const midCount = cases.filter((c) => c.level === "mid").length;

  return (
    <div className="admin-page">
      <PageHeader
        title="异常风控"
        description="异常流水、大额打赏与可疑提现的人工复核"
        breadcrumb={[{ label: "分发与变现" }, { label: "异常风控" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="风险事件" value={cases.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="高风险" value={highCount} icon={Flame} tone="danger" />
        <StatCard label="中风险" value={midCount} icon={AlertTriangle} tone="warning" />
        <StatCard label="涉及用户" value={new Set(cases.map((c) => c.source)).size} icon={Users} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>风险事件清单</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>等级</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>说明</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge tone={c.level === "high" ? "danger" : c.level === "mid" ? "warning" : "info"}>
                      {c.level === "high" ? "高" : c.level === "mid" ? "中" : "低"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{c.kind}</TableCell>
                  <TableCell className="text-sm">{c.source}</TableCell>
                  <TableCell className="tabular-nums text-sm">{c.amount}</TableCell>
                  <TableCell className="text-sm">{c.date === "当前" ? c.date : formatDateCN(c.date)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.detail}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline">标记为安全</Button>
                      <Button size="sm" variant="destructive">冻结 / 回滚</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !loadError && cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无风险事件</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
