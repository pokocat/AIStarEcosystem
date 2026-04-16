import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { entitlements } from "@/lib/admin-data";

export default function EntitlementsPage() {
  return (
    <>
      <PageHeader eyebrow="Entitlements" title="权益详情" description="统一查看用户与租户已生效的权益项、配额、到期时间和撤销状态。" />
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>权益列表</CardTitle>
          <CardDescription>未来对接 `/api/admin/entitlements` 的分页查询接口。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>主体</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead>功能</TableHead>
                <TableHead>额度</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitlements.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.subject}</TableCell>
                  <TableCell>{item.subjectType}</TableCell>
                  <TableCell>
                    <StatusBadge kind="plan" value={item.plan} />
                  </TableCell>
                  <TableCell>{item.feature}</TableCell>
                  <TableCell>{item.quota}</TableCell>
                  <TableCell>{item.expiresAt}</TableCell>
                  <TableCell>
                    <StatusBadge kind="entitlement-status" value={item.status} />
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
