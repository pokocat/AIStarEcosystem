import { AlertTriangle, Flame, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TRANSACTIONS } from "@/mocks/finance";
import { ACTIVITIES } from "@/mocks/community";
import { formatDateCN } from "@/lib/utils";

function parseAmount(a: string): number {
  return Number(a.replace(/[^\d-]/g, "")) || 0;
}

/**
 * Synthesize risk cases from transaction + activity mocks.
 * Rule-set:
 *  - amount > ¥20,000 single txn → 大额异动
 *  - withdrawal + status !== completed → 异常提现
 *  - gift amount ≥ ¥500 from new user → 刷礼物疑点
 */
function buildRiskCases() {
  const txnCases = TRANSACTIONS.flatMap((t) => {
    const amount = parseAmount(t.amount);
    const abs = Math.abs(amount);
    const risks: { kind: string; level: "high" | "mid" | "low"; detail: string }[] = [];
    if (abs >= 20000) risks.push({ kind: "大额流水", level: "mid", detail: `单笔 ${t.amount}` });
    if (t.type === "withdrawal" && t.status !== "completed")
      risks.push({ kind: "异常提现", level: "high", detail: `状态 ${t.status}` });
    if (t.source.includes("打赏") && abs >= 5000)
      risks.push({ kind: "打赏突增", level: "low", detail: "汇总金额偏高，建议抽样核查" });
    return risks.map((r, idx) => ({
      id: `${t.id}-${idx}`,
      refId: t.id,
      date: t.date,
      source: t.source,
      amount: t.amount,
      ...r,
    }));
  });

  const fanCases = ACTIVITIES.filter((a) => a.type === "gift" && /¥(\d+)/.test(a.action))
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
  const cases = buildRiskCases();
  const highCount = cases.filter((c) => c.level === "high").length;
  const midCount = cases.filter((c) => c.level === "mid").length;

  return (
    <div className="max-w-screen-2xl mx-auto">
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
              {cases.map((c) => (
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
              {cases.length === 0 && (
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
