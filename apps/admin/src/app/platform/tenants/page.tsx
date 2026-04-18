"use client";

import * as React from "react";
import { Network, Users, KeySquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TENANTS, MEMBERSHIPS } from "@/mocks/accounts";
import { LICENSE_BATCHES } from "@/mocks/licenses";
import { TENANT_KIND, ACCOUNT_STATUS } from "@/constants/status";
import { formatDateCN } from "@/lib/utils";
import { formatCredits } from "@/lib/format";

export default function TenantsPage() {
  const byTenant = React.useMemo(() => {
    const memberCount = new Map<string, number>();
    const licenseBatchCount = new Map<string, number>();
    const licenseGrantCredits = new Map<string, number>();
    MEMBERSHIPS.forEach((m) => memberCount.set(m.tenantId, (memberCount.get(m.tenantId) ?? 0) + 1));
    LICENSE_BATCHES.forEach((b) => {
      licenseBatchCount.set(b.issuerTenantId, (licenseBatchCount.get(b.issuerTenantId) ?? 0) + 1);
      licenseGrantCredits.set(
        b.issuerTenantId,
        (licenseGrantCredits.get(b.issuerTenantId) ?? 0) + b.initialCreditGrant * b.activatedCount
      );
    });
    return { memberCount, licenseBatchCount, licenseGrantCredits };
  }, []);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="机构 Tenant"
        description="记录用户由哪个发放方导入。用于 License 核销率与累计发放点数统计。"
        breadcrumb={[{ label: "平台账户" }, { label: "机构 Tenant" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="机构总数"            value={TENANTS.length}                        icon={Network}   />
        <StatCard label="归属用户总数"        value={MEMBERSHIPS.length}                    icon={Users}     />
        <StatCard label="License 批次总数"    value={LICENSE_BATCHES.length}                icon={KeySquare} />
        <StatCard
          label="累计发放点数 · credits"
          value={formatCredits(
            LICENSE_BATCHES.reduce((s, b) => s + b.initialCreditGrant * b.activatedCount, 0)
          )}
          icon={KeySquare}
          tone="success"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>机构列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>机构</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">归属用户</TableHead>
                <TableHead className="text-right">License 批次</TableHead>
                <TableHead className="text-right">累计发放点数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TENANTS.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><StatusBadge meta={TENANT_KIND[t.kind]} /></TableCell>
                  <TableCell className="text-right tabular-nums">{byTenant.memberCount.get(t.id) ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{byTenant.licenseBatchCount.get(t.id) ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCredits(byTenant.licenseGrantCredits.get(t.id) ?? 0)}
                  </TableCell>
                  <TableCell className="text-xs">{formatDateCN(t.createdAt)}</TableCell>
                  <TableCell><StatusBadge meta={ACCOUNT_STATUS[t.status]} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">详情</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
