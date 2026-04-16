import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { priceRules } from "@/lib/admin-data";

export default function PriceRulesPage() {
  return (
    <>
      <PageHeader eyebrow="Metering" title="价格规则" description="用于维护不同套餐下的计量项扣点规则，并支持活动期价差策略。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Price Rules</CardTitle>
          <CardDescription>后端应以 PriceRule 表为准，前端展示最近生效策略与活动范围。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>计量项</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>消耗积分</TableHead>
                <TableHead>生效时间段</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceRules.map((rule) => (
                <TableRow key={`${rule.meter}-${rule.plan}`}>
                  <TableCell className="font-mono text-xs">{rule.meter}</TableCell>
                  <TableCell>
                    <StatusBadge kind="plan" value={rule.plan} />
                  </TableCell>
                  <TableCell>{rule.cost}</TableCell>
                  <TableCell>{rule.period}</TableCell>
                  <TableCell>
                    <StatusBadge kind="feature-status" value={rule.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
