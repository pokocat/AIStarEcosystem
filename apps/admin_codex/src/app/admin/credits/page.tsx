import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ledgerRecords, walletSummaries } from "@/lib/admin-data";

export default function CreditsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Credits"
        title="积分概览"
        description="围绕钱包余额结构、资金流向与异常预扣订单的处理效率来组织页面信息。"
        actions={
          <Button asChild>
            <Link href="/admin/credits/adjust">
              <ArrowRight data-icon="inline-end" />
              去人工调账
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {walletSummaries.map((item) => (
          <Card key={item.label}>
            <CardHeader className="gap-1">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="tabular-nums">{item.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">占比 {item.share}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>最近流水</CardTitle>
          <CardDescription>支持未来按 `tenantId` 或 `userId` 对账本流水做过滤。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>主体</TableHead>
                <TableHead>方向</TableHead>
                <TableHead>科目</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerRecords.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.subject}</TableCell>
                  <TableCell>
                    <StatusBadge kind="ledger-direction" value={item.direction} />
                  </TableCell>
                  <TableCell>{item.account}</TableCell>
                  <TableCell className="tabular-nums">{item.amount}</TableCell>
                  <TableCell>{item.operator}</TableCell>
                  <TableCell>{item.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
