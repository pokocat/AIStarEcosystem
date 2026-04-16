import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tenants } from "@/lib/admin-data";

export default function TenantsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Tenants"
        title="租户管理"
        description="查看工作区、企业和 MCN 机构的套餐归属、成员规模与钱包余额。"
      />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>租户列表</CardTitle>
          <CardDescription>聚焦租户类型、成员数、套餐与冻结状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>积分余额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.type}</TableCell>
                  <TableCell>{tenant.members}</TableCell>
                  <TableCell>
                    <StatusBadge kind="plan" value={tenant.plan} />
                  </TableCell>
                  <TableCell className="tabular-nums">{tenant.credits}</TableCell>
                  <TableCell>
                    <StatusBadge kind="user-status" value={tenant.status} />
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tenants/${tenant.id}`}>
                        <ArrowRight data-icon="inline-end" />
                        详情
                      </Link>
                    </Button>
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
