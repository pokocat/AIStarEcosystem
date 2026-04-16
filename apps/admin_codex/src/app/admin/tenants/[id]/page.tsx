import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTenantById, ledgerRecords, users } from "@/lib/admin-data";

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  const tenant = getTenantById(params.id);
  const tenantUsers = users.filter((user) => user.tenant === tenant.name);

  return (
    <>
      <PageHeader
        eyebrow="Tenant Detail"
        title={tenant.name}
        description={`类型：${tenant.type} · 创建者：${tenant.owner} · 创建时间：${tenant.createdAt}`}
        actions={
          <Button variant="outline">
            <Building2 data-icon="inline-start" />
            冻结租户
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">基本信息</TabsTrigger>
          <TabsTrigger value="members">成员列表</TabsTrigger>
          <TabsTrigger value="wallet">钱包与积分</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="gap-1">
                <CardDescription>当前套餐</CardDescription>
                <CardTitle>
                  <StatusBadge kind="plan" value={tenant.plan} />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="gap-1">
                <CardDescription>成员规模</CardDescription>
                <CardTitle>{tenant.members}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="gap-1">
                <CardDescription>积分余额</CardDescription>
                <CardTitle className="tabular-nums">{tenant.credits}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="gap-1">
                <CardDescription>租户状态</CardDescription>
                <CardTitle>
                  <StatusBadge kind="user-status" value={tenant.status} />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>成员列表</CardTitle>
              <CardDescription>此处保留附录 B 中的成员与角色查看位置。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>套餐</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <StatusBadge kind="role" value={user.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="plan" value={user.plan} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="user-status" value={user.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>租户账本</CardTitle>
              <CardDescription>适用于后续按租户维度查看所有成员的积分消耗分布。</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>主体</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead>科目</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.subject}</TableCell>
                      <TableCell>
                        <StatusBadge kind="ledger-direction" value={record.direction} />
                      </TableCell>
                      <TableCell>{record.account}</TableCell>
                      <TableCell>{record.amount}</TableCell>
                      <TableCell>{record.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
