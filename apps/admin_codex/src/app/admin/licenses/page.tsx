import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { licenseBatches } from "@/lib/admin-data";

export default function LicensesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Licenses"
        title="卡密批次"
        description="查看卡密批次、套餐类型、渠道归属与当前库存健康度，便于对账与吊销。"
        actions={
          <Button asChild>
            <Link href="/admin/licenses/create">
              <Plus data-icon="inline-start" />
              创建批次
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>批次列表</CardTitle>
          <CardDescription>批次详情页继续下钻到单卡级别状态与吊销动作。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>批次号</TableHead>
                <TableHead>产品</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>卡密类型</TableHead>
                <TableHead>进度</TableHead>
                <TableHead>渠道归属</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenseBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/admin/licenses/${batch.id}`}>
                      {batch.id}
                    </Link>
                  </TableCell>
                  <TableCell>{batch.product}</TableCell>
                  <TableCell>
                    <StatusBadge kind="plan" value={batch.plan} />
                  </TableCell>
                  <TableCell>{batch.type}</TableCell>
                  <TableCell>{batch.progress}</TableCell>
                  <TableCell>{batch.channel}</TableCell>
                  <TableCell>{batch.validRange}</TableCell>
                  <TableCell>
                    <StatusBadge kind="license-status" value={batch.status} />
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
